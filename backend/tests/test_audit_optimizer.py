import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.models import MaintenanceTask, BlockWindow, TrainMovement, Resource
from app.services.optimizer import RailBlockOptimizer
from app.services.priority_engine import calculate_priority_score

# Setup isolated SQLite test DB for optimizer audit
TEST_DB_URL = "sqlite:///./test_audit_optimizer.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(scope="module", autouse=True)
def init_audit_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)

    db = TestingSession()
    import json
    from pathlib import Path
    data_dir = Path(__file__).resolve().parent.parent.parent / "data"

    with open(data_dir / "maintenance_tasks.json", "r") as f:
        for t in json.load(f):
            sc, fac, _ = calculate_priority_score(t["criticality"], t["deadline"], t.get("overdue", False), t["asset_type"])
            db.add(MaintenanceTask(
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
                data_source="BDMS",
                data_label="DEMO DATA"
            ))

    with open(data_dir / "train_movements.json", "r") as f:
        for tr in json.load(f):
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
        for b in json.load(f):
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
        for r in json.load(f):
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
    if os.path.exists("./test_audit_optimizer.db"):
        os.remove("./test_audit_optimizer.db")


# 1. Audit Test: Plan A, Plan B, Plan C have genuinely different objective behaviors
def test_plans_have_different_objectives_and_behaviors():
    db = TestingSession()
    optimizer = RailBlockOptimizer(db)

    plan_a = optimizer.solve_plan(strategy_type="PLAN_A_CRITICAL")
    plan_b = optimizer.solve_plan(strategy_type="PLAN_B_TRAIN_IMPACT")
    plan_c = optimizer.solve_plan(strategy_type="PLAN_C_BUNDLING")

    db.close()

    # Verify all solved
    assert plan_a["status"] in ["OPTIMAL", "FEASIBLE"]
    assert plan_b["status"] in ["OPTIMAL", "FEASIBLE"]
    assert plan_c["status"] in ["OPTIMAL", "FEASIBLE"]

    # Objective values must be different
    assert plan_a["objective_value"] != plan_b["objective_value"]
    assert plan_a["objective_value"] != plan_c["objective_value"]
    assert plan_b["objective_value"] != plan_c["objective_value"]

    # Plan B must NOT schedule any tasks in train-conflicting daytime blocks (BLK-102 on Section B-C with Shatabdi/Coal freight)
    b_blocks_used = {asgn["block_id"] for asgn in plan_b["scheduled_assignments"]}
    assert "BLK-102" not in b_blocks_used, "Plan B should avoid BLK-102 due to daytime train movement overlap"

    # Plan C should have an active block penalty, encouraging compact block usage
    assert "active_blocks_count" in plan_c["kpis"]


# 2. Audit Test: Utilisation Calculation (Used Hours / Available Hours * 100)
def test_utilisation_calculation():
    db = TestingSession()
    optimizer = RailBlockOptimizer(db)
    res = optimizer.solve_plan(strategy_type="PLAN_A_CRITICAL")
    db.close()

    kpis = res["kpis"]
    assert "used_block_hours" in kpis
    assert "total_available_hours" in kpis
    assert kpis["total_available_hours"] > 0

    expected_util = round((kpis["used_block_hours"] / kpis["total_available_hours"]) * 100, 1)
    assert kpis["utilization_rate"] == expected_util
    assert kpis["utilization_rate"] <= 100.0
    print(f"Verified Utilisation: {kpis['used_block_hours']}h / {kpis['total_available_hours']}h = {kpis['utilization_rate']}%")


# 3. Audit Test: Critical Task Coverage Calculation
def test_critical_coverage_calculation():
    db = TestingSession()
    optimizer = RailBlockOptimizer(db)
    res = optimizer.solve_plan(strategy_type="PLAN_A_CRITICAL")
    db.close()

    kpis = res["kpis"]
    assert "critical_tasks_scheduled" in kpis
    assert "total_critical_tasks" in kpis
    assert kpis["total_critical_tasks"] > 0

    expected_coverage = round((kpis["critical_tasks_scheduled"] / kpis["total_critical_tasks"]) * 100, 1)
    assert kpis["critical_coverage"] == expected_coverage
    print(f"Verified Critical Coverage: {kpis['critical_tasks_scheduled']} / {kpis['total_critical_tasks']} = {kpis['critical_coverage']}%")


# 4. Audit Test: Stress Test (Reduced block hours + Unavailable Resource + Train overlap)
def test_stress_reduced_hours_and_unavailable_resource():
    db = TestingSession()

    # Step A: Mark "Track Machine 1 (BCM)" as unavailable
    bcm = db.query(Resource).filter(Resource.name.like("%BCM%")).first()
    assert bcm is not None
    bcm.available = False
    db.commit()

    optimizer = RailBlockOptimizer(db)

    # Solve with reduced block duration (-1.5 hours)
    stressed_res = optimizer.solve_plan(
        strategy_type="PLAN_A_CRITICAL",
        block_duration_bonus_hours=-1.5,
        allow_bundling=False  # Sequential only
    )

    # Revert resource availability for cleanliness
    bcm.available = True
    db.commit()
    db.close()

    # Under reduced block hours and missing heavy machine, tasks requiring BCM must be deferred!
    deferred_task_ids = {d["task_id"] for d in stressed_res["deferred_tasks"]}
    assert "ENG-001" in deferred_task_ids, "ENG-001 requires BCM which was marked unavailable"

    # Verify explanation mentions resource unavailability
    eng_001_def = next(d for d in stressed_res["deferred_tasks"] if d["task_id"] == "ENG-001")
    reasons_text = " ".join(eng_001_def["explanation"]["reasons"])
    assert "Resource Unavailability" in reasons_text or "out of service" in reasons_text
    print("Stress test passed: ENG-001 correctly deferred with reason:", reasons_text)
