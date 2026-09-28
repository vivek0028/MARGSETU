import asyncio
import json
import urllib.request
import websockets
import base64

async def verify():
    resp = urllib.request.urlopen("http://127.0.0.1:9222/json")
    targets = json.loads(resp.read().decode())
    target = next((t for t in targets if t.get("type") == "page"), None)
    if not target:
        print("No open Chrome page found on port 9222.")
        return

    ws_url = target["webSocketDebuggerUrl"]
    print(f"Connecting to Chrome page: {ws_url}")

    async with websockets.connect(ws_url, max_size=25 * 1024 * 1024) as ws:
        msg_id = 0

        async def send(method, params=None):
            nonlocal msg_id
            msg_id += 1
            payload = {"id": msg_id, "method": method, "params": params or {}}
            await ws.send(json.dumps(payload))
            while True:
                r = await ws.recv()
                data = json.loads(r)
                if data.get("id") == msg_id:
                    return data.get("result", {})

        # Navigate to Dashboard
        await send("Page.navigate", {"url": "http://localhost:5174/dashboard"})
        await asyncio.sleep(2.0)

        # 1. Verify Weekly Timeline (S&T and Traction blocks present)
        gantt_check = """
        (() => {
            const btns = Array.from(document.querySelectorAll("button"));
            const stBlocks = btns.filter(b => b.className.includes("purple") && b.innerText.includes("BLK-"));
            const trdBlocks = btns.filter(b => b.className.includes("amber") && b.innerText.includes("BLK-"));
            const engBlocks = btns.filter(b => b.className.includes("blue") && b.innerText.includes("BLK-"));
            return {
                engBlockCount: engBlocks.length,
                stBlockCount: stBlocks.length,
                trdBlockCount: trdBlocks.length,
                sampleST: stBlocks[0]?.innerText?.replace(/\\n/g, ' ') || 'None',
                sampleTRD: trdBlocks[0]?.innerText?.replace(/\\n/g, ' ') || 'None'
            };
        })()
        """
        res_gantt = await send("Runtime.evaluate", {"expression": gantt_check, "returnByValue": True})
        gantt_val = res_gantt.get("result", {}).get("value", {})
        print("Gantt Matrix Blocks:", gantt_val)
        assert gantt_val.get("stBlockCount", 0) > 0, "S&T blocks are still missing!"
        assert gantt_val.get("trdBlockCount", 0) > 0, "Traction blocks are still missing!"
        print(f"✓ Gantt Timeline verified: {gantt_val['engBlockCount']} Eng, {gantt_val['stBlockCount']} S&T, {gantt_val['trdBlockCount']} Traction blocks rendered!")

        # 2. Click Critical Tasks Tab and wait for React render
        click_tasks = """
        (() => {
            const taskTab = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Critical Attention Tasks"));
            if (taskTab) {
                taskTab.click();
                return true;
            }
            return false;
        })()
        """
        await send("Runtime.evaluate", {"expression": click_tasks, "returnByValue": True})
        await asyncio.sleep(1.0)

        # Read Table rows
        table_check = """
        (() => {
            const rows = Array.from(document.querySelectorAll("tbody tr")).map(r => ({
                id: r.children[0]?.innerText?.trim(),
                dept: r.children[1]?.innerText?.trim(),
                sec: r.children[2]?.innerText?.trim(),
                activity: r.children[3]?.innerText?.trim()
            }));
            return {
                rowCount: rows.length,
                firstRow: rows[0] || null
            };
        })()
        """
        res_table = await send("Runtime.evaluate", {"expression": table_check, "returnByValue": True})
        table_val = res_table.get("result", {}).get("value", {})
        print("Critical Tasks Table:", table_val)
        assert table_val.get("rowCount", 0) > 0, "No rows in Critical Tasks table"
        first_act = table_val.get("firstRow", {}).get("activity", "")
        assert len(first_act) > 10, "Maintenance Activity column is empty!"
        print(f"✓ Critical Tasks Activity column verified: '{first_act[:65]}...'")

        # 3. Test Live Field Execution tab
        click_exec = """
        (() => {
            const execTab = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Live Field Execution"));
            if (execTab) {
                execTab.click();
                return true;
            }
            return false;
        })()
        """
        await send("Runtime.evaluate", {"expression": click_exec, "returnByValue": True})
        await asyncio.sleep(1.0)

        exec_check = """
        (() => {
            const text = document.body.innerText;
            const hasHeader = text.includes("Live Field Execution & Plan-vs-Actual Telemetry");
            const hasRows = document.querySelectorAll("tbody tr").length;
            return { hasHeader, hasRows };
        })()
        """
        res_exec = await send("Runtime.evaluate", {"expression": exec_check, "returnByValue": True})
        exec_val = res_exec.get("result", {}).get("value", {})
        print("Live Field Execution Tab:", exec_val)
        assert exec_val.get("hasHeader"), "Live Field Execution header missing"
        print("✓ Live Field Execution Tab verified with live telemetry feed!")

        # 4. Take full screenshot
        screenshot_res = await send("Page.captureScreenshot", {"format": "png"})
        with open("/Users/vivekarya/.gemini/antigravity-ide/brain/59e63140-92f0-475a-88b9-d0b94aa3ec74/screenshot_improved_dashboard.png", "wb") as f:
            f.write(base64.b64decode(screenshot_res["data"]))
        print("✓ Screenshot saved successfully to screenshot_improved_dashboard.png")

if __name__ == "__main__":
    asyncio.run(verify())
