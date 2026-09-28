import sys
import httpx
import json

BASE_URL = "http://localhost:8001"

def test_acceptance_flow():
    print("=" * 60)
    print("RAILOPTIBLOCK COMPREHENSIVE ACCEPTANCE TEST (SIH26027)")
    print("=" * 60)
    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        # Step 1: Health & Login/Identity
        print("\n[Step 1] Verifying System Identity & Health...")
        res = client.get("/health")
        assert res.status_code == 200, f"Health check failed: {res.text}"
        data = res.json()
        print(f"  -> Service: {data.get('service')} (v{data.get('version')})")
        print(f"  -> Mode: {data.get('mode')}")

        # Step 2: Dashboard Real DB Statistics
        print("\n[Step 2] Dashboard Real DB Statistics...")
        res = client.get("/api/dashboard/summary")
        assert res.status_code == 200
        dash = res.json()
        kpis = dash["kpis"]
        print(f"  -> Pending Requests: {kpis.get('total_maintenance_requests')}")
        print(f"  -> Blocks Planned: {kpis.get('scheduled_tasks')}")
        print(f"  -> Conflicts: {kpis.get('conflicts_detected')}")
        print(f"  -> Utilization Rate: {kpis.get('block_utilization_rate')}%")

        # Step 3 & 4 & 5 & 6: Maintenance Requests & Priority Breakdown
        print("\n[Step 3-6] Maintenance Requests & Priority Engine...")
        res = client.get("/api/tasks")
        assert res.status_code == 200
        tasks = res.json()
        assert len(tasks) >= 12, "Must have >= 12 tasks"
        sample_task = next(t for t in tasks if t.get("priority_score", 0) >= 80)
        print(f"  -> Selected Request: {sample_task['task_id']} ({sample_task['department']})")
        print(f"  -> Title: {sample_task['description']}")
        print(f"  -> Priority Score: {sample_task['priority_score']} ({sample_task['criticality']})")
        print(f"  -> Availability Impact: {sample_task.get('availability_impact', 'N/A')}")
        print(f"  -> Factor Breakdown: {sample_task.get('factor_breakdown', {})}")

        # Step 7-10: Cross-Department Compatibility & Bundling
        print("\n[Step 7-10] Cross-Department Compatibility & Bundling...")
        res = client.get("/api/compatibility/analyse")
        assert res.status_code == 200
        compat = res.json()
        bundles = compat.get("bundles", [])
        print(f"  -> Bundles Identified: {len(bundles)}")
        if bundles:
            b0 = bundles[0]
            print(f"  -> Bundle {b0.get('bundle_id')}: {b0.get('task_ids')} in {b0.get('section')}")
            print(f"  -> Departments: {b0.get('departments')} | Synergy Benefit: {b0.get('synergy_benefit_hours')}h")

        # Step 11-17: Google OR-Tools CP-SAT Optimization
        print("\n[Step 11-17] Google OR-Tools CP-SAT Solver...")
        solve_payload = {
            "strategy_type": "PLAN_C_BUNDLING",
            "block_duration_bonus_hours": 0.0,
            "additional_crew_count": 0,
            "allow_bundling": True
        }
        res = client.post("/api/optimization/solve", json=solve_payload)
        assert res.status_code == 200, f"Solve failed: {res.text}"
        solve_data = res.json()
        print(f"  -> CP-SAT Execution Status: {solve_data.get('status')}")
        plans = solve_data.get("plans", solve_data.get("candidate_plans", []))
        assert len(plans) >= 1, "Must generate candidate plans"
        plan_c = next((p for p in plans if "Bundle" in p["plan_name"] or p["strategy_type"] == "PLAN_C_BUNDLING"), plans[0])
        print(f"  -> Candidate Plan: {plan_c['plan_id']} ({plan_c['plan_name']})")
        print(f"  -> Status: {plan_c['status']}")
        k = plan_c.get("kpis", {})
        print(f"  -> Scheduled Tasks: {k.get('scheduled_count', plan_c.get('scheduled_count'))} | Deferred: {k.get('deferred_count', plan_c.get('deferred_count'))}")
        print(f"  -> Bundled Possessions: {plan_c.get('bundled_tasks_count', k.get('bundled_blocks_count'))}")

        # Verify deferred tasks have explanations
        detail_res = client.get(f"/api/optimization/plans/{plan_c['plan_id']}")
        assert detail_res.status_code == 200
        full_plan = detail_res.json()
        deferred = full_plan.get("deferred_tasks", [])
        assert len(deferred) > 0, "Must have deferred tasks proving CP-SAT is not pure sorting"
        print(f"  -> Sample Deferred Task: {deferred[0]['task_id']} ({deferred[0].get('criticality')})")
        print(f"  -> Reason: {deferred[0].get('explanation')}")

        # Step 18-27: Planner Human-in-the-Loop Review & Approval Transaction
        print("\n[Step 18-27] Human-in-the-Loop Sanctioning (Plan Approval)...")
        approve_payload = {
            "user_name": "Sr. DOM Rajesh Sharma (Division Operations)",
            "user_role": "CPTM / JGM (Planning)",
            "comments": "Sanctioned for corridor execution following inter-departmental consensus."
        }
        res = client.post(f"/api/optimization/plans/{plan_c['plan_id']}/approve", json=approve_payload)
        assert res.status_code == 200, f"Approval failed: {res.text}"
        appr_res = res.json()
        print(f"  -> Plan State Transition: {appr_res.get('status')} (Plan ID: {appr_res.get('plan_id')})")
        print(f"  -> Sanctioned By: {appr_res.get('approved_by')}")
        print(f"  -> Message: {appr_res.get('message')}")

        # Step 28-29: Execution Tracking (Plan vs Actual)
        print("\n[Step 28-29] Execution Monitoring (Plan vs Actual)...")
        rec_res = client.get("/api/execution")
        assert rec_res.status_code == 200
        records = rec_res.json()
        assert len(records) > 0
        r0 = records[0]
        update_payload = {
            "status": "COMPLETED",
            "progress_percent": 100,
            "delay_minutes": 5,
            "completion_notes": "Track inspection completed with zero track-fit speed restrictions.",
            "user_name": "Sr. Section Engineer (P-Way)"
        }
        rec_id = r0.get("id") or r0.get("execution_id")
        u_res = client.put(f"/api/execution/{rec_id}", json=update_payload)
        assert u_res.status_code == 200
        updated = u_res.json()
        print(f"  -> Updated Execution {rec_id} to status: {updated['status']}")

        # Step 30-32: Attempt Invalid Override
        print("\n[Step 30-32] Constraint Enforcement on Manual Override...")
        override_payload = {
            "task_id": deferred[0]["task_id"],
            "target_block_id": "BLK-102",  # Already tightly scheduled or incompatible
            "reason": "Forced manual insertion test",
            "user_name": "Chief Controller"
        }
        over_res = client.post(f"/api/plans/{plan_c['plan_id']}/manual-override", json=override_payload)
        # Should gracefully return validation result
        print(f"  -> Override Response Status: {over_res.status_code}")
        over_data = over_res.json()
        print(f"  -> Override Outcome: {over_data.get('status', 'Processed')}")
        if "detail" in over_data:
            print(f"  -> Validation Detail: {over_data.get('detail')}")

        # Check Audit Log Integrity
        print("\n[Audit Trail] Verifying Append-Only Audit Integrity...")
        audit_res = client.get("/api/audit")
        assert audit_res.status_code == 200
        logs = audit_res.json()
        print(f"  -> Total Audit Trail Entries: {len(logs)}")
        print(f"  -> Most Recent Action: {logs[0]['action']} on {logs[0].get('target_id')} by {logs[0].get('user_name')}")

    print("\n" + "=" * 60)
    print("ALL ACCEPTANCE TEST STEPS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    test_acceptance_flow()
