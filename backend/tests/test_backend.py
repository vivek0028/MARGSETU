import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app

# Create test SQLite database
TEST_DB_URL = "sqlite:///./test_railblock.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    
    db = TestingSessionLocal()
    import json
    from pathlib import Path
    from app.services.priority_engine import calculate_priority_score
    from app.models.models import MaintenanceTask, TrainMovement, BlockWindow, Resource, DataSource
    
    data_dir = Path(__file__).resolve().parent.parent.parent / "data"
    with open(data_dir / "maintenance_tasks.json", "r") as f:
        tasks = json.load(f)
        for t in tasks:
            sc, fac, _ = calculate_priority_score(t["criticality"], t["deadline"], t.get("overdue", False), t["asset_type"])
            task = MaintenanceTask(
                task_id=t["task_id"],
                department=t["department"],
                asset_type=t["asset_type"],
                location=t["location"],
                description=t["description"],
                duration_hours=float(t["duration_hours"]),
                preferred_date=t["preferred_date"],
                deadline=t["deadline"],
                criticality=t["criticality"],
                overdue=bool(t.get("overdue", False)),
                required_resources=t.get("required_resources", []),
                dependencies=t.get("dependencies", []),
                compatible_departments=t.get("compatible_departments", []),
                status=t.get("status", "Pending"),
                priority_score=sc,
                priority_factors=fac,
                data_source=t.get("data_source", "BDMS"),
                data_label="DEMO DATA"
            )
            db.add(task)
            
    with open(data_dir / "train_movements.json", "r") as f:
        trains = json.load(f)
        for tr in trains:
            db.add(TrainMovement(
                train_no=tr["train_no"],
                train_name=tr["train_name"],
                train_type=tr["train_type"],
                section=tr["section"],
                direction=tr["direction"],
                scheduled_departure=tr["scheduled_departure"],
                scheduled_arrival=tr["scheduled_arrival"],
                priority_rank=tr.get("priority_rank", 2),
                speed_kmph=float(tr.get("speed_kmph", 100.0)),
                data_label="DEMO DATA"
            ))
            
    with open(data_dir / "block_windows.json", "r") as f:
        blocks = json.load(f)
        for b in blocks:
            db.add(BlockWindow(
                block_id=b["block_id"],
                section=b["section"],
                direction=b["direction"],
                date=b["date"],
                start_time=b["start_time"],
                end_time=b["end_time"],
                max_duration_hours=float(b["max_duration_hours"]),
                status=b.get("status", "Available"),
                data_label="DEMO DATA"
            ))
            
    with open(data_dir / "resources.json", "r") as f:
        resources = json.load(f)
        for r in resources:
            db.add(Resource(
                resource_id=r["resource_id"],
                name=r["name"],
                resource_type=r["resource_type"],
                department=r["department"],
                home_depot=r["home_depot"],
                available=bool(r.get("available", True)),
                data_label="DEMO DATA"
            ))
            
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)
    import os
    if os.path.exists("./test_railblock.db"):
        os.remove("./test_railblock.db")

client = TestClient(app)

# 1. Health endpoint test
def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "DEMO DATA" in data["mode"]

# 2. Get all tasks test
def test_get_all_tasks():
    res = client.get("/api/tasks")
    assert res.status_code == 200
    tasks = res.json()
    assert len(tasks) >= 22
    assert any(t["task_id"] == "ENG-001" for t in tasks)

# 3. Create valid task & duplicate check
def test_create_task_and_duplicate():
    new_task = {
        "task_id": "ENG-TEST-55",
        "department": "Engineering",
        "asset_type": "Track",
        "location": "Section A-B",
        "description": "Ultrasonic rail test",
        "duration_hours": 2.0,
        "preferred_date": "2026-09-20",
        "deadline": "2026-09-22",
        "criticality": "High",
        "overdue": False,
        "required_resources": [],
        "dependencies": [],
        "compatible_departments": ["Engineering", "S&T"],
        "status": "Pending"
    }
    res = client.post("/api/tasks", json=new_task)
    assert res.status_code == 201

    dup_res = client.post("/api/tasks", json=new_task)
    assert dup_res.status_code == 409

# 4. Conflict detection test
def test_conflict_detection():
    res = client.post("/api/conflicts/detect")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["total_conflicts_detected"] > 0
    assert any(c["conflict_type"] == "Timetable" for c in data["conflicts"])
    assert any(c["conflict_type"] == "Resource" for c in data["conflicts"])
    assert any(c["conflict_type"] == "Duration" for c in data["conflicts"])

    # Test GET /api/conflicts
    get_res = client.get("/api/conflicts")
    assert get_res.status_code == 200
    assert len(get_res.json()) > 0

# 5. Compatibility & bundling analysis test
def test_compatibility_analysis():
    res = client.get("/api/compatibility/analyse")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["bundles_identified_count"] > 0
    bundle = data["bundles"][0]
    assert "compatibility_score" in bundle
    assert len(bundle["task_ids"]) >= 2
    assert len(bundle["reasons"]) > 0

# 6. Priority recalculation test
def test_recalculate_priority():
    res = client.post("/api/priority/recalculate")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["tasks_recalculated"] >= 22
    assert "category_distribution" in data

# 7. OR-Tools Optimization Plans Generation test
def test_generate_optimization_plans():
    payload = {
        "strategy_type": "ALL",
        "block_duration_bonus_hours": 0.0,
        "additional_crew_count": 0,
        "allow_bundling": True
    }
    res = client.post("/api/optimization/generate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["plans_generated_count"] == 3
    assert data["solver"] == "Google OR-Tools CP-SAT"

    plan_a = next(p for p in data["plans"] if p["strategy_type"] == "PLAN_A_CRITICAL")
    assert plan_a["kpis"]["scheduled_count"] > 0
    assert len(plan_a["scheduled_assignments"]) > 0
    assert len(plan_a["deferred_tasks"]) > 0

    # Verify deterministic explanations
    first_assign = plan_a["scheduled_assignments"][0]
    assert "explanation" in first_assign
    assert len(first_assign["explanation"]["rule_based_reasons"]) > 0
    assert "AI decided this" not in first_assign["explanation"]["summary"]

    first_deferred = plan_a["deferred_tasks"][0]
    assert "explanation" in first_deferred
    assert len(first_deferred["explanation"]["rule_based_reasons"]) > 0

# 8. List & Detail Optimization Plans test
def test_list_and_get_plan_detail():
    res = client.get("/api/optimization/plans")
    assert res.status_code == 200
    plans = res.json()
    assert len(plans) >= 3

    plan_id = plans[0]["plan_id"]
    detail_res = client.get(f"/api/optimization/plans/{plan_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["plan_id"] == plan_id
    assert "scheduled_assignments" in detail
    assert "deferred_tasks" in detail

# 9. Plan Approval and Rejection workflow test
def test_plan_approval_and_rejection():
    # Approve Plan A
    appr_payload = {
        "user_name": "Chief Dispatcher Sharma",
        "user_role": "Reviewer",
        "comments": "Plan verified for safety and freight clearance."
    }
    res = client.post("/api/plans/PLAN-A-CRIT/approve", json=appr_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["new_status"] == "Approved"
    assert "Chief Dispatcher Sharma" in data["approved_by"]

    # Reject Plan B
    rej_payload = {
        "user_name": "Senior DOM Verma",
        "user_role": "Reviewer",
        "reason": "Requires night track illumination gang."
    }
    rej_res = client.post("/api/plans/PLAN-B-TRAIN/reject", json=rej_payload)
    assert rej_res.status_code == 200
    assert rej_res.json()["new_status"] == "Rejected"

# 10. What-If Simulation test
def test_what_if_simulation():
    sim_payload = {
        "block_duration_bonus_hours": 1.0,
        "additional_crew_count": 1,
        "allow_bundling": True,
        "strategy_type": "PLAN_A_CRITICAL"
    }
    res = client.post("/api/simulation/run", json=sim_payload)
    assert res.status_code == 200
    sim_data = res.json()
    assert sim_data["status"] == "success"
    assert "baseline_kpis" in sim_data
    assert "simulated_kpis" in sim_data
    assert "delta" in sim_data
    assert "scheduled_tasks_delta" in sim_data["delta"]
    assert len(sim_data["impact_summary"]) > 0

# 11. Dashboard Summary test
def test_dashboard_summary():
    res = client.get("/api/dashboard/summary")
    assert res.status_code == 200
    data = res.json()
    assert "kpis" in data
    assert data["kpis"]["total_maintenance_requests"] >= 22
    assert "department_summary" in data
    assert "priority_distribution" in data
    assert "conflict_summary" in data
    assert len(data["critical_tasks_requiring_attention"]) > 0

# 12. Audit Logs test
def test_audit_logs():
    res = client.get("/api/audit-logs")
    assert res.status_code == 200
    logs = res.json()
    assert len(logs) > 0
    assert any(log["action"] in ["Plan Approved", "Optimisation Plan Generated", "Task Created"] for log in logs)

# 13. Deployment API Route Aliases & CORS Verification
def test_deployment_and_route_aliases():
    # 1. /api/health and /health
    res_api_health = client.get("/api/health")
    assert res_api_health.status_code == 200
    assert res_api_health.json()["status"] == "healthy"

    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "healthy"

    # 2. /api/overview
    res_overview = client.get("/api/overview")
    assert res_overview.status_code == 200
    assert "kpis" in res_overview.json()

    # 3. /api/requests
    res_requests = client.get("/api/requests")
    assert res_requests.status_code == 200
    assert isinstance(res_requests.json(), list)

    # 4. /api/plans
    res_plans = client.get("/api/plans")
    assert res_plans.status_code == 200
    assert isinstance(res_plans.json(), list)

    # 5. /api/conflicts
    res_conflicts = client.get("/api/conflicts")
    assert res_conflicts.status_code == 200
    assert isinstance(res_conflicts.json(), list)

    # 6. /api/optimisation
    res_opt = client.get("/api/optimisation")
    assert res_opt.status_code == 200
    assert isinstance(res_opt.json(), list)

    # 7. /api/audit
    res_audit = client.get("/api/audit")
    assert res_audit.status_code == 200
    assert isinstance(res_audit.json(), list)

    # 8. CORS Verification: OPTIONS /api/dashboard/summary with Origin
    opt_dash = client.options(
        "/api/dashboard/summary",
        headers={
            "Origin": "https://railblock-advisor-frontend.vercel.app",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert opt_dash.status_code == 200
    assert opt_dash.headers.get("access-control-allow-origin") == "https://railblock-advisor-frontend.vercel.app"

    # 9. CORS Verification: GET /api/dashboard/summary with Origin header
    get_dash = client.get(
        "/api/dashboard/summary",
        headers={
            "Origin": "https://railblock-advisor-frontend.vercel.app"
        }
    )
    assert get_dash.status_code == 200
    assert get_dash.headers.get("access-control-allow-origin") == "https://railblock-advisor-frontend.vercel.app"

    # 10. CORS Verification: OPTIONS /api/optimization/plans with Origin header
    opt_plans = client.options(
        "/api/optimization/plans",
        headers={
            "Origin": "https://railblock-advisor-frontend.vercel.app",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert opt_plans.status_code == 200
    assert opt_plans.headers.get("access-control-allow-origin") == "https://railblock-advisor-frontend.vercel.app"

    # 11. CORS Verification: Preview deployment safe regex and localhost:4173
    opt_prev = client.options(
        "/api/dashboard/summary",
        headers={
            "Origin": "https://railblock-advisor-frontend-git-main-vivek0028.vercel.app",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert opt_prev.status_code == 200
    assert opt_prev.headers.get("access-control-allow-origin") == "https://railblock-advisor-frontend-git-main-vivek0028.vercel.app"

    opt_4173 = client.options(
        "/api/dashboard/summary",
        headers={
            "Origin": "http://localhost:4173",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert opt_4173.status_code == 200
    assert opt_4173.headers.get("access-control-allow-origin") == "http://localhost:4173"

    # 12. Resiliency check: /api/api/ normalization
    res_dup = client.get("/api/api/health")
    assert res_dup.status_code == 200
    assert res_dup.json()["status"] == "healthy"



