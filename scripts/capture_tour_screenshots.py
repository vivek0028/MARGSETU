import asyncio
import base64
import json
import os
import subprocess
import time
import httpx
import websockets

FRONTEND_URL = "http://localhost:5173"
CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CDP_PORT = 9228
OUTPUT_DIR = "/Users/vivekarya/.gemini/antigravity-ide/brain/59e63140-92f0-475a-88b9-d0b94aa3ec74"

PAGES = [
    ("/dashboard", "screenshot_dashboard.png"),
    ("/maintenance", "screenshot_maintenance.png"),
    ("/assets", "screenshot_assets.png"),
    ("/block-windows", "screenshot_block_windows.png"),
    ("/plans/weekly", "screenshot_weekly_board.png"),
    ("/plans/monthly", "screenshot_monthly_calendar.png"),
    ("/execution", "screenshot_execution.png"),
    ("/optimization", "screenshot_optimization.png"),
    ("/conflicts", "screenshot_conflicts.png"),
    ("/admin", "screenshot_admin.png")
]

async def capture_all():
    print(f"Launching Chrome CDP on port {CDP_PORT}...")
    proc = subprocess.Popen([
        CHROME_PATH,
        "--headless=new",
        f"--remote-debugging-port={CDP_PORT}",
        "--window-size=1440,900",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-gpu",
        "about:blank"
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    time.sleep(1.5)

    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"http://127.0.0.1:{CDP_PORT}/json")
            pages = [p for p in res.json() if p.get("type") == "page"]
            ws_url = pages[0]["webSocketDebuggerUrl"]

        async with websockets.connect(ws_url, max_size=30*1024*1024) as ws:
            msg_id = 1
            async def send_cmd(method, params=None):
                nonlocal msg_id
                cid = msg_id
                msg_id += 1
                await ws.send(json.dumps({"id": cid, "method": method, "params": params or {}}))
                return cid

            await send_cmd("Page.enable")
            await send_cmd("Emulation.setDeviceMetricsOverride", {
                "width": 1440,
                "height": 900,
                "deviceScaleFactor": 1,
                "mobile": False
            })

            for route, filename in PAGES:
                print(f"Navigating to {route}...", end=" ", flush=True)
                await send_cmd("Page.navigate", {"url": f"{FRONTEND_URL}{route}"})

                # wait for page load and API fetch
                start_wait = time.time()
                while time.time() - start_wait < 2.0:
                    try:
                        await asyncio.wait_for(ws.recv(), timeout=0.3)
                    except asyncio.TimeoutError:
                        pass

                shot_id = await send_cmd("Page.captureScreenshot", {"format": "png"})
                saved = False
                for _ in range(25):
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=0.5)
                        msg = json.loads(raw)
                        if msg.get("id") == shot_id:
                            data = msg.get("result", {}).get("data")
                            if data:
                                img_bytes = base64.b64decode(data)
                                target = os.path.join(OUTPUT_DIR, filename)
                                with open(target, "wb") as f:
                                    f.write(img_bytes)
                                print(f"Saved {filename} ({len(img_bytes)} bytes)")
                                saved = True
                                break
                    except asyncio.TimeoutError:
                        pass
                if not saved:
                    print(f"Failed to capture {filename}")

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            proc.kill()

if __name__ == "__main__":
    asyncio.run(capture_all())
