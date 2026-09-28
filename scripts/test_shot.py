import asyncio
import base64
import json
import os
import subprocess
import time
import httpx
import websockets

FRONTEND_URL = "http://localhost:5174"
CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CDP_PORT = 9227
OUTPUT_DIR = "/Users/vivekarya/.gemini/antigravity-ide/brain/59e63140-92f0-475a-88b9-d0b94aa3ec74"

async def test_shot():
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
            # Get list of pages
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
            await send_cmd("Runtime.enable")
            await send_cmd("Console.enable")
            
            # Navigate
            print("Navigating to /dashboard...")
            nav_id = await send_cmd("Page.navigate", {"url": f"{FRONTEND_URL}/dashboard"})
            
            # Wait 3 seconds for load and render
            start_wait = time.time()
            while time.time() - start_wait < 3.0:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=0.5)
                    msg = json.loads(raw)
                    method = msg.get("method")
                    if method in ["Console.messageAdded", "Runtime.exceptionThrown"]:
                        print(f"BROWSER LOG: {msg}")
                except asyncio.TimeoutError:
                    pass

            # Capture screenshot
            print("Capturing screenshot...")
            shot_id = await send_cmd("Page.captureScreenshot", {"format": "png"})
            
            # Wait for shot response
            for _ in range(20):
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=1.0)
                    msg = json.loads(raw)
                    if msg.get("id") == shot_id:
                        data = msg.get("result", {}).get("data")
                        if data:
                            img_bytes = base64.b64decode(data)
                            target = os.path.join(OUTPUT_DIR, "screenshot_dashboard.png")
                            with open(target, "wb") as f:
                                f.write(img_bytes)
                            print(f"SUCCESS: Saved screenshot_dashboard.png ({len(img_bytes)} bytes)")
                            return True
                        else:
                            print(f"No data in result: {msg}")
                            return False
                except asyncio.TimeoutError:
                    pass
            print("Timed out waiting for screenshot")
            return False
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            proc.kill()

if __name__ == "__main__":
    asyncio.run(test_shot())
