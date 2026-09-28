import asyncio
import json
import subprocess
import time
import httpx
import websockets

BACKEND_URL = "http://localhost:8001"
FRONTEND_URL = "http://localhost:5174"
CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CDP_PORT = 9228

API_ENDPOINTS = [
    ("/health", "GET"),
    ("/api/health", "GET"),
    ("/api/dashboard/summary", "GET"),
    ("/api/tasks", "GET"),
    ("/api/assets", "GET"),
    ("/api/block-windows", "GET"),
    ("/api/timetable/trains", "GET"),
    ("/api/conflicts", "GET"),
    ("/api/conflicts/summary", "GET"),
    ("/api/optimization/plans", "GET"),
    ("/api/resources", "GET"),
    ("/api/execution/records", "GET"),
    ("/api/execution/summary", "GET"),
    ("/api/reports/summary", "GET"),
    ("/api/simulation/scenarios", "GET"),
    ("/api/data-sources", "GET"),
    ("/api/audit", "GET"),
    ("/api/departments", "GET"),
    ("/api/compatibility", "GET"),
]

PAGES = [
    "/dashboard",
    "/requests",
    "/assets",
    "/block-windows",
    "/timetable",
    "/conflicts",
    "/optimizer",
    "/plans/weekly",
    "/plans/monthly",
    "/approval",
    "/explainability",
    "/execution",
    "/reports",
    "/simulation",
    "/workspace",
    "/audit",
    "/data-sources",
    "/settings",
    "/admin",
]

def test_backend_apis():
    print("\n" + "="*50)
    print("TESTING BACKEND APIS ON PORT 8001")
    print("="*50)
    results = {}
    with httpx.Client(timeout=5.0) as client:
        for ep, method in API_ENDPOINTS:
            url = f"{BACKEND_URL}{ep}"
            try:
                res = client.get(url) if method == "GET" else client.post(url)
                status = res.status_code
                ok = status == 200
                results[ep] = (status, "OK" if ok else res.text[:100])
                print(f"[{'PASS' if ok else 'FAIL'}] {method} {ep} -> {status}")
            except Exception as e:
                results[ep] = (0, str(e))
                print(f"[FAIL] {method} {ep} -> ERROR: {e}")
    return results

async def test_frontend_pages():
    print("\n" + "="*50)
    print("TESTING FRONTEND PAGES ON PORT 5174 VIA CHROME CDP")
    print("="*50)
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

    page_results = {}
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
            await send_cmd("Runtime.enable")
            await send_cmd("Console.enable")

            for path in PAGES:
                url = f"{FRONTEND_URL}{path}"
                errors = []
                # Clear or attach listener
                await send_cmd("Page.navigate", {"url": url})
                
                # Listen for messages over 1.2s
                start = time.time()
                while time.time() - start < 1.2:
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=0.2)
                        msg = json.loads(raw)
                        method = msg.get("method")
                        if method == "Console.messageAdded":
                            lvl = msg["params"]["message"]["level"]
                            txt = msg["params"]["message"]["text"]
                            if lvl in ["error"] and "favicon" not in txt:
                                errors.append(f"Console {lvl}: {txt[:80]}")
                        elif method == "Runtime.exceptionThrown":
                            exc_details = msg["params"]["exceptionDetails"]
                            text = exc_details.get("exception", {}).get("description") or exc_details.get("text")
                            errors.append(f"Exception: {text}")
                            print(f"FULL EXCEPTION ON {path}: {text}")
                    except asyncio.TimeoutError:
                        pass
                
                ok = len(errors) == 0
                page_results[path] = (ok, errors)
                status_str = "PASS" if ok else "FAIL"
                print(f"[{status_str}] {path} -> {'Clean' if ok else '; '.join(errors)}")

    finally:
        proc.terminate()
        proc.wait()

    return page_results

if __name__ == "__main__":
    api_res = test_backend_apis()
    page_res = asyncio.run(test_frontend_pages())
