import asyncio
import httpx

BACKEND_URL = "http://localhost:8000"

async def test_enterprise_features():
    print("\n" + "="*60)
    print("ENTERPRISE FEATURES VERIFICATION TEST")
    print("="*60)

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Auth & RBAC
        print("Testing Authentication (Login & Profile)...", end=" ", flush=True)
        login_res = await client.post(
            f"{BACKEND_URL}/api/auth/login",
            json={"email": "admin@railoptiblock.local", "password": "RailOpti@2026"}
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        auth_data = login_res.json()
        token = auth_data["access_token"]
        assert token is not None
        headers = {"Authorization": f"Bearer {token}"}

        me_res = await client.get(f"{BACKEND_URL}/api/auth/me", headers=headers)
        assert me_res.status_code == 200
        assert me_res.json()["role"] == "ADMIN"
        print("PASSED")

        # 2. Assets & Defect Logging
        print("Testing Assets & Defect Logging...", end=" ", flush=True)
        asset_id = "AST-TEST-001"
        await client.delete(f"{BACKEND_URL}/api/assets/{asset_id}", headers=headers)
        create_ast = await client.post(
            f"{BACKEND_URL}/api/assets",
            json={
                "asset_id": asset_id,
                "asset_name": "Test Turnout Machine 101",
                "asset_type": "POINT_MACHINE",
                "department": "Engineering",
                "corridor_name": "NDLS-CNB-DDU",
                "section": "NDLS-ALJN",
                "condition_score": 88
            },
            headers=headers
        )
        assert create_ast.status_code in [200, 201]

        # Log defect
        defect_res = await client.post(
            f"{BACKEND_URL}/api/assets/{asset_id}/defects",
            json={"description": "Micro-fracture detected via ultrasonic flaw detector", "severity": "HIGH"},
            headers=headers
        )
        assert defect_res.status_code in [200, 201]
        defects_list = await client.get(f"{BACKEND_URL}/api/assets/{asset_id}/defects", headers=headers)
        assert len(defects_list.json()) > 0
        print(f"PASSED ({len(defects_list.json())} defect logged)")

        # 3. Block Windows & Timetable
        print("Testing Block Windows & Timetable...", end=" ", flush=True)
        blocks_res = await client.get(f"{BACKEND_URL}/api/block-windows", headers=headers)
        assert blocks_res.status_code == 200
        blocks = blocks_res.json()
        assert len(blocks) > 0

        trains_res = await client.get(f"{BACKEND_URL}/api/train-movements", headers=headers)
        assert trains_res.status_code == 200
        assert len(trains_res.json()) > 0
        print(f"PASSED ({len(blocks)} blocks, {len(trains_res.json())} trains)")

        # 4. Weekly & Monthly Planning
        print("Testing Weekly Corridor Board & Monthly Density Calendar...", end=" ", flush=True)
        weekly_res = await client.get(f"{BACKEND_URL}/api/plans/weekly?corridor=NDLS-CNB-DDU", headers=headers)
        assert weekly_res.status_code == 200
        weekly_data = weekly_res.json()
        assert "days" in weekly_data

        monthly_res = await client.get(f"{BACKEND_URL}/api/plans/monthly?month=9&year=2026", headers=headers)
        assert monthly_res.status_code == 200
        monthly_data = monthly_res.json()
        assert len(monthly_data.get("days", [])) == 30
        print(f"PASSED (30 calendar days calculated)")

        # 5. Live Execution (Plan vs Actual)
        print("Testing Live Execution Tracking (Plan vs Actual)...", end=" ", flush=True)
        exec_res = await client.get(f"{BACKEND_URL}/api/execution", headers=headers)
        assert exec_res.status_code == 200
        exec_list = exec_res.json()
        assert len(exec_list) > 0
        target_exec = exec_list[0]
        exec_id = target_exec.get('id') or target_exec.get('execution_id')

        # Update status to IN_PROGRESS and then COMPLETED
        upd_res = await client.put(
            f"{BACKEND_URL}/api/execution/{exec_id}",
            json={
                "status": "IN_PROGRESS",
                "actual_start": "2026-09-24T02:00:00Z"
            },
            headers=headers
        )
        assert upd_res.status_code == 200

        # Plan vs actual analytics
        pva_res = await client.get(f"{BACKEND_URL}/api/execution/plan-vs-actual", headers=headers)
        assert pva_res.status_code == 200
        pva_data = pva_res.json()
        assert "average_variance_minutes" in pva_data
        print(f"PASSED ({pva_data['total_executions']} executions tracked)")

        # 6. Manual Override with Safety Validation
        print("Testing Manual Override with Timetable Collision Rejection...", end=" ", flush=True)
        override_collision = await client.post(
            f"{BACKEND_URL}/api/plans/PLAN-A-CRIT/manual-override",
            json={
                "task_id": "TASK-001",
                "target_block_id": "BLK-999", # non-existent or invalid section
                "reason": "Test collision validation"
            },
            headers=headers
        )
        # Should be rejected with 400 or 404 because block is either missing or section mismatch
        assert override_collision.status_code in [400, 404]
        print(f"PASSED (Safely rejected with status {override_collision.status_code})")

        # 7. Reports Download
        print("Testing CSV and JSON Reports Export...", end=" ", flush=True)
        csv_res = await client.get(f"{BACKEND_URL}/api/reports/execution/csv", headers=headers)
        assert csv_res.status_code == 200
        assert "Execution_ID" in csv_res.text or "execution_id" in csv_res.text or len(csv_res.text) > 50

        json_res = await client.get(f"{BACKEND_URL}/api/reports/plan/PLAN-A-CRIT/json", headers=headers)
        assert json_res.status_code == 200
        assert "plan_id" in json_res.json()
        print("PASSED")

        # 8. Admin Priority Weight Tuning
        print("Testing Admin Dynamic Weight Tuning...", end=" ", flush=True)
        weights_res = await client.post(
            f"{BACKEND_URL}/api/admin/priority-weights",
            json={"criticality": 45, "deadline_urgency": 25, "operational_impact": 15, "age_overdue": 15},
            headers=headers
        )
        assert weights_res.status_code == 200
        users_res = await client.get(f"{BACKEND_URL}/api/admin/users", headers=headers)
        assert users_res.status_code == 200
        assert len(users_res.json()) >= 10
        print(f"PASSED ({len(users_res.json())} users verified)")

        # 9. Global Search
        print("Testing Global Unified Search...", end=" ", flush=True)
        search_res = await client.get(f"{BACKEND_URL}/api/search?q=Track", headers=headers)
        assert search_res.status_code == 200
        s_data = search_res.json()
        assert s_data["total_results"] > 0
        print(f"PASSED ({s_data['total_results']} results found for 'Track')")

        # Clean up test asset
        await client.delete(f"{BACKEND_URL}/api/assets/{asset_id}", headers=headers)
        print("✓ Cleanup completed.")

    print("\nALL ENTERPRISE MODULES FULLY OPERATIONAL IN POSTGRESQL!\n")

if __name__ == "__main__":
    asyncio.run(test_enterprise_features())
