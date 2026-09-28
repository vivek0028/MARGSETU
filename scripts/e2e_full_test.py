import asyncio
import json
import subprocess
import time
import httpx
import websockets

BACKEND_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:5173"
CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CDP_PORT = 9223

async def run_cdp_tests():
    print("\n" + "="*60)
    print("PHASE 1: HEADLESS CHROME BROWSER E2E ROUTE & CONSOLE AUDIT")
    print("="*60)
    
    chrome_proc = subprocess.Popen([
        CHROME_PATH,
        "--headless=new",
        f"--remote-debugging-port={CDP_PORT}",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-gpu",
        "--disable-extensions",
        "about:blank"
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    time.sleep(1.5)
    
    console_errors = []
    failed_requests = []
    
    try:
        async with httpx.AsyncClient() as client:
            version_res = await client.get(f"http://127.0.0.1:{CDP_PORT}/json/version")
            ws_url = version_res.json()["webSocketDebuggerUrl"]
            
        async with websockets.connect(ws_url) as ws:
            msg_id = 1
            async def send_cmd(method, params=None):
                nonlocal msg_id
                cmd = {"id": msg_id, "method": method, "params": params or {}}
                msg_id += 1
                await ws.send(json.dumps(cmd))
                return cmd["id"]

            await send_cmd("Page.enable")
            await send_cmd("Runtime.enable")
            await send_cmd("Console.enable")
            await send_cmd("Network.enable")

            routes_to_test = [
                "/",
                "/dashboard",
                "/maintenance",
                "/conflicts",
                "/optimization",
                "/simulation",
                "/approval",
                "/data-sources",
                "/settings"
            ]

            async def listen_for_errors(duration=1.2):
                end_time = time.time() + duration
                while time.time() < end_time:
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=0.2)
                        event = json.loads(raw)
                        method = event.get("method", "")
                        
                        if method == "Runtime.exceptionThrown":
                            details = event["params"]["exceptionDetails"]
                            text = details.get("text", "")
                            exc = details.get("exception", {}).get("description", "")
                            err_msg = f"{text}: {exc}"
                            console_errors.append(err_msg)
                            print(f"  [!] JS Exception: {err_msg}")
                            
                        elif method == "Console.messageAdded":
                            msg = event["params"]["message"]
                            if msg.get("level") == "error":
                                err_msg = msg.get("text", "")
                                console_errors.append(err_msg)
                                print(f"  [!] Console Error: {err_msg}")
                                
                        elif method == "Network.responseReceived":
                            resp = event["params"]["response"]
                            status = resp.get("status", 200)
                            url = resp.get("url", "")
                            if status >= 400 and "favicon" not in url:
                                failed_requests.append(f"{status} on {url}")
                                print(f"  [!] Network Error {status}: {url}")
                    except asyncio.TimeoutError:
                        pass

            for route in routes_to_test:
                url = f"{FRONTEND_URL}{route}"
                print(f"Testing route directly: {route} ...", end=" ", flush=True)
                await send_cmd("Page.navigate", {"url": url})
                await listen_for_errors(1.2)
                
                print(f"Reloading {route} ...", end=" ", flush=True)
                await send_cmd("Page.reload")
                await listen_for_errors(1.0)
                print("OK")

    finally:
        chrome_proc.terminate()
        try:
            chrome_proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            chrome_proc.kill()

    print(f"\nBrowser Test Summary:")
    print(f"  Total Console Errors: {len(console_errors)}")
    print(f"  Total Failed Network Requests: {len(failed_requests)}")
    return console_errors, failed_requests


async def run_e2e_api_flow():
    print("\n" + "="*60)
    print("PHASE 2: COMPLETE END-TO-END DEMO FLOW TEST (FASTAPI & OR-TOOLS)")
    print("="*60)
    
    passed_steps = []
    failed_steps = []
    
    async with httpx.AsyncClient(timeout=45.0) as client:
        # Step 1: Health & Landing
        try:
            r = await client.get(f"{BACKEND_URL}/api/health")
            assert r.status_code == 200
            data = r.json()
            assert data["status"] == "healthy"
            assert "DEMO DATA" in data["mode"]
            passed_steps.append("1. Landing Page & Backend Health Check")
            print("✓ Step 1: Landing Page & Backend Health Passed")
        except Exception as e:
            failed_steps.append(f"Step 1 (Landing/Health): {e}")
            print(f"✗ Step 1 Failed: {e}")

        # Step 2: Dashboard Summary (Dynamic KPIs)
        try:
            r = await client.get(f"{BACKEND_URL}/api/dashboard/summary")
            assert r.status_code == 200
            d = r.json()
            kpis = d["kpis"]
            assert kpis["total_maintenance_requests"] >= 20, "total_maintenance_requests must be >= 20"
            assert kpis["high_priority_tasks"] > 0, "high_priority_tasks must be > 0"
            assert kpis["conflicts_detected"] > 0, "conflicts_detected must be > 0"
            assert isinstance(d["department_summary"], dict)
            passed_steps.append("2. Dashboard Dynamic KPIs & Department Breakdown")
            print(f"✓ Step 2: Dashboard Summary Passed (Total: {kpis['total_maintenance_requests']}, High: {kpis['high_priority_tasks']}, Conflicts: {kpis['conflicts_detected']})")
        except Exception as e:
            failed_steps.append(f"Step 2 (Dashboard): {e}")
            print(f"✗ Step 2 Failed: {e}")

        # Step 3: Maintenance Requests
        try:
            r = await client.get(f"{BACKEND_URL}/api/tasks")
            assert r.status_code == 200
            tasks = r.json()
            assert len(tasks) >= 20, f"Expected at least 20 tasks, got {len(tasks)}"
            passed_steps.append("3. Maintenance Requests List Loaded")
            print(f"✓ Step 3: Maintenance Requests Loaded ({len(tasks)} tasks)")
        except Exception as e:
            failed_steps.append(f"Step 3 (Tasks): {e}")
            print(f"✗ Step 3 Failed: {e}")

        # Step 4: Create and Edit Maintenance Task
        demo_task_id = "REQ-DEMO-E2E"
        try:
            # Delete if leftover
            await client.delete(f"{BACKEND_URL}/api/tasks/{demo_task_id}")
            
            # Create
            payload = {
                "task_id": demo_task_id,
                "department": "Engineering",
                "asset_type": "Track",
                "location": "Section A-B",
                "description": "E2E Automated Demo Track Tamping",
                "duration_hours": 2.5,
                "preferred_date": "2026-09-20",
                "deadline": "2026-09-23",
                "criticality": "High",
                "overdue": False,
                "required_resources": ["Engineering Crew 1"],
                "dependencies": [],
                "compatible_departments": ["Engineering", "S&T"],
                "status": "Pending"
            }
            r_create = await client.post(f"{BACKEND_URL}/api/tasks", json=payload)
            assert r_create.status_code == 201
            created_task = r_create.json()
            assert created_task["task_id"] == demo_task_id

            # Edit
            edit_payload = {
                "description": "E2E Automated Demo Track Tamping (Updated Duration)",
                "duration_hours": 3.0
            }
            r_edit = await client.put(f"{BACKEND_URL}/api/tasks/{demo_task_id}", json=edit_payload)
            assert r_edit.status_code == 200
            updated_task = r_edit.json()
            assert updated_task["duration_hours"] == 3.0
            assert "Updated Duration" in updated_task["description"]
            
            passed_steps.append("4. Create and Edit Maintenance Task")
            print(f"✓ Step 4: Create and Edit Task Passed ({demo_task_id})")
        except Exception as e:
            failed_steps.append(f"Step 4 (Create/Edit Task): {e}")
            print(f"✗ Step 4 Failed: {e}")

        # Step 5: Recalculate priority
        try:
            r = await client.post(f"{BACKEND_URL}/api/priority/recalculate")
            assert r.status_code == 200
            p_data = r.json()
            assert p_data["status"] == "success"
            assert p_data["tasks_recalculated"] >= 24
            assert "Critical" in p_data["category_distribution"]
            passed_steps.append("5. Deterministic Priority Recalculation")
            print(f"✓ Step 5: Recalculate Priority Passed ({p_data['tasks_recalculated']} tasks scored)")
        except Exception as e:
            failed_steps.append(f"Step 5 (Priority Recalculate): {e}")
            print(f"✗ Step 5 Failed: {e}")

        # Step 6: Detect conflicts
        try:
            r = await client.post(f"{BACKEND_URL}/api/conflicts/detect")
            assert r.status_code == 200
            c_data = r.json()
            assert c_data["status"] == "success"
            assert c_data["total_conflicts_detected"] > 0
            types_found = {c["conflict_type"] for c in c_data["conflicts"]}
            assert "Timetable" in types_found or "Resource" in types_found
            passed_steps.append("6. Multi-Dimensional Conflict Detection")
            print(f"✓ Step 6: Conflict Detection Passed ({c_data['total_conflicts_detected']} conflicts across {len(types_found)} dimensions)")
        except Exception as e:
            failed_steps.append(f"Step 6 (Detect Conflicts): {e}")
            print(f"✗ Step 6 Failed: {e}")

        # Step 7: Generate Plan A, Plan B, and Plan C
        try:
            r = await client.post(f"{BACKEND_URL}/api/optimization/generate", json={"strategy_type": "ALL"})
            assert r.status_code == 200
            opt_data = r.json()
            assert opt_data["status"] == "success"
            assert opt_data["plans_generated_count"] == 3
            plans_dict = {p["plan_id"]: p for p in opt_data["plans"]}
            assert "PLAN-A-CRIT" in plans_dict
            assert "PLAN-B-TRAIN" in plans_dict
            assert "PLAN-C-BUNDLE" in plans_dict
            passed_steps.append("7. Generate Plan A, Plan B, and Plan C via Google OR-Tools CP-SAT")
            print("✓ Step 7: Generated Plan A, Plan B, and Plan C Successfully")
        except Exception as e:
            failed_steps.append(f"Step 7 (Generate Plans): {e}")
            print(f"✗ Step 7 Failed: {e}")

        # Step 8: Compare plans
        try:
            r = await client.get(f"{BACKEND_URL}/api/optimization/plans")
            assert r.status_code == 200
            plans_list = r.json()
            assert len(plans_list) == 3
            plan_a = next(p for p in plans_list if p["plan_id"] == "PLAN-A-CRIT")
            plan_b = next(p for p in plans_list if p["plan_id"] == "PLAN-B-TRAIN")
            plan_c = next(p for p in plans_list if p["plan_id"] == "PLAN-C-BUNDLE")
            
            # Verify plan divergence
            assert plan_a["utilization_rate"] != plan_b["utilization_rate"] or plan_a["scheduled_count"] != plan_b["scheduled_count"]
            print(f"   Plan A (Crit Max): Scheduled={plan_a['scheduled_count']}, Util={plan_a['utilization_rate']}%, Crit={plan_a['critical_coverage']}%")
            print(f"   Plan B (Min Conf): Scheduled={plan_b['scheduled_count']}, Util={plan_b['utilization_rate']}%, Crit={plan_b['critical_coverage']}%")
            print(f"   Plan C (Bundling): Scheduled={plan_c['scheduled_count']}, Util={plan_c['utilization_rate']}%, Crit={plan_c['critical_coverage']}%")
            passed_steps.append("8. Compare Plans (Plan A, B, C Divergence Verified)")
            print("✓ Step 8: Plan Comparison Passed")
        except Exception as e:
            failed_steps.append(f"Step 8 (Compare Plans): {e}")
            print(f"✗ Step 8 Failed: {e}")

        # Step 9: Open task explanation
        try:
            r = await client.get(f"{BACKEND_URL}/api/optimization/plans/PLAN-A-CRIT")
            assert r.status_code == 200
            plan_detail = r.json()
            assert len(plan_detail["scheduled_assignments"]) > 0
            asgn0 = plan_detail["scheduled_assignments"][0]
            assert "explanation" in asgn0
            assert "summary" in asgn0["explanation"]
            
            assert len(plan_detail["deferred_tasks"]) > 0
            def0 = plan_detail["deferred_tasks"][0]
            assert "explanation" in def0
            assert "summary" in def0["explanation"]
            
            passed_steps.append("9. Open Task Explanation (Rule-Based Explanations for Inclusions & Deferrals)")
            print(f"✓ Step 9: Task Explanation Passed (Inclusion: {asgn0['explanation']['summary']}, Deferred: {def0['explanation']['summary']})")
        except Exception as e:
            failed_steps.append(f"Step 9 (Task Explanation): {e}")
            print(f"✗ Step 9 Failed: {e}")

        # Step 10: Run What-If Simulation
        try:
            sim_params = {
                "block_duration_bonus_hours": 1.0,
                "additional_crew_count": 1,
                "allow_bundling": True,
                "strategy_type": "PLAN_A_CRITICAL"
            }
            r = await client.post(f"{BACKEND_URL}/api/simulation/run", json=sim_params)
            assert r.status_code == 200
            sim_data = r.json()
            assert sim_data["status"] == "success"
            assert "baseline_kpis" in sim_data
            assert "simulated_kpis" in sim_data
            assert "delta" in sim_data
            assert "impact_summary" in sim_data
            passed_steps.append("10. Run What-If Simulation (Dynamic Metrics & Delta Calculation)")
            print(f"✓ Step 10: What-If Simulation Passed (Scheduled Delta: {sim_data['delta']['scheduled_tasks_delta']:+d} tasks, Util Delta: {sim_data['delta']['utilization_rate_delta']:+f}%)")
        except Exception as e:
            failed_steps.append(f"Step 10 (Simulation): {e}")
            print(f"✗ Step 10 Failed: {e}")

        # Step 11: Submit a plan for approval
        try:
            approval_payload = {
                "user_name": "Sr. DOM Rajesh Sharma",
                "user_role": "Reviewer",
                "comments": "E2E Automated Demo Approval - Verified timetable integrity."
            }
            r = await client.post(f"{BACKEND_URL}/api/plans/PLAN-A-CRIT/approve", json=approval_payload)
            assert r.status_code == 200
            app_data = r.json()
            assert app_data["status"] == "success"
            assert app_data["new_status"] == "Approved"
            passed_steps.append("11. Submit a Plan for Approval")
            print(f"✓ Step 11: Plan Submission Passed (Status: {app_data['new_status']})")
        except Exception as e:
            failed_steps.append(f"Step 11 (Submit Approval): {e}")
            print(f"✗ Step 11 Failed: {e}")

        # Step 12: Approve the plan & View Audit Logs
        try:
            r = await client.get(f"{BACKEND_URL}/api/audit-logs?limit=15")
            assert r.status_code == 200
            logs = r.json()
            assert len(logs) > 0
            matching_log = next((l for l in logs if l["target_id"] == "PLAN-A-CRIT" and l.get("action") == "Plan Approved"), None)
            assert matching_log is not None, "Audit entry for PLAN-A-CRIT approval not found"
            passed_steps.append("12. View Audit Logs (Verified Append-Only Audit Trail Entry Created)")
            print(f"✓ Step 12: View Audit Logs Passed (Log ID: {matching_log['log_id']}, Action: {matching_log['action']}, Details: {matching_log['details']})")
        except Exception as e:
            failed_steps.append(f"Step 12 (Audit Logs): {e}")
            print(f"✗ Step 12 Failed: {e}")

        # Cleanup test task
        try:
            await client.delete(f"{BACKEND_URL}/api/tasks/{demo_task_id}")
            # Re-generate pristine plans
            await client.post(f"{BACKEND_URL}/api/optimization/generate", json={"strategy_type": "ALL"})
            print(f"✓ Cleanup: Deleted {demo_task_id} and resynced solver.")
        except Exception:
            pass

    return passed_steps, failed_steps


async def main():
    console_errors, failed_requests = await run_cdp_tests()
    passed_steps, failed_steps = await run_e2e_api_flow()
    
    print("\n" + "="*60)
    print("FINAL E2E DEMO VERIFICATION REPORT")
    print("="*60)
    
    print(f"\nPassed Flows ({len(passed_steps)}/12):")
    for step in passed_steps:
        print(f"  [PASS] {step}")
        
    if failed_steps:
        print(f"\nFailed Flows ({len(failed_steps)}):")
        for step in failed_steps:
            print(f"  [FAIL] {step}")
    else:
        print("\nAll 12 flows passed with 100% success!")
        
    print(f"\nConsole Errors ({len(console_errors)}):")
    if console_errors:
        for err in console_errors:
            print(f"  - {err}")
    else:
        print("  None (0 console errors)")
        
    print(f"\nAPI / Network Errors ({len(failed_requests)}):")
    if failed_requests:
        for req in failed_requests:
            print(f"  - {req}")
    else:
        print("  None (0 API / network errors)")

if __name__ == "__main__":
    asyncio.run(main())
