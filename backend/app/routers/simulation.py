import uuid
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import AuditLog
from app.services.optimizer import RailBlockOptimizer

router = APIRouter(prefix="/api/simulation", tags=["What-If Simulation"])

class SimulationRequest(BaseModel):
    block_duration_bonus_hours: float = Field(default=0.5, ge=-2.0, le=3.0, description="Block duration adjustment (+/- hours)")
    additional_crew_count: int = Field(default=1, ge=0, le=2, description="Additional maintenance gangs deployed (0, 1, or 2)")
    allow_bundling: bool = Field(default=True, description="Allow multi-department joint maintenance bundling")
    strategy_type: str = Field(default="PLAN_A_CRITICAL", description="Base optimization strategy")

@router.get("/scenarios", status_code=status.HTTP_200_OK)
def get_preset_simulation_scenarios():
    """Retrieve standard railway operational what-if simulation templates."""
    return [
        {
            "id": "SCEN-01",
            "name": "Corridor Surge — +1hr Extended Possession",
            "description": "Evaluate impact of granting +1.0 hour extended block window during low-traffic night hours.",
            "block_duration_bonus_hours": 1.0,
            "additional_crew_count": 0,
            "allow_bundling": True,
            "strategy_type": "PLAN_A_CRITICAL"
        },
        {
            "id": "SCEN-02",
            "name": "Emergency Gang Surge — +2 Maintenance Crews",
            "description": "Simulate mobilizing 2 supplemental divisional contractor maintenance gangs across corridor.",
            "block_duration_bonus_hours": 0.0,
            "additional_crew_count": 2,
            "allow_bundling": True,
            "strategy_type": "PLAN_C_BUNDLING"
        },
        {
            "id": "SCEN-03",
            "name": "Tight Traffic Curfew — -0.5hr Possession Truncation",
            "description": "Stress-test corridor capacity when traffic control restricts maintenance possessions by 30 mins.",
            "block_duration_bonus_hours": -0.5,
            "additional_crew_count": 0,
            "allow_bundling": False,
            "strategy_type": "PLAN_B_BALANCED"
        }
    ]


@router.post("/run", status_code=status.HTTP_200_OK)
def run_what_if_simulation(
    req: SimulationRequest,
    db: Session = Depends(get_db)
):
    """
    Executes a What-If scenario simulation using Google OR-Tools CP-SAT.
    Compares baseline operational constraint results against simulated parameter modifications.
    """
    optimizer = RailBlockOptimizer(db)

    # 1. Run Baseline (Standard parameters)
    baseline_res = optimizer.solve_plan(
        strategy_type=req.strategy_type,
        block_duration_bonus_hours=0.0,
        additional_crew_count=0,
        allow_bundling=True
    )

    # 2. Run Simulated (User parameters)
    simulated_res = optimizer.solve_plan(
        strategy_type=req.strategy_type,
        block_duration_bonus_hours=req.block_duration_bonus_hours,
        additional_crew_count=req.additional_crew_count,
        allow_bundling=req.allow_bundling
    )

    b_kpis = baseline_res["kpis"]
    s_kpis = simulated_res["kpis"]

    # 3. Compute Delta Comparison
    delta = {
        "scheduled_tasks_delta": s_kpis["scheduled_count"] - b_kpis["scheduled_count"],
        "deferred_tasks_delta": s_kpis["deferred_count"] - b_kpis["deferred_count"],
        "utilization_rate_delta": round(s_kpis["utilization_rate"] - b_kpis["utilization_rate"], 1),
        "critical_coverage_delta": round(s_kpis["critical_coverage"] - b_kpis["critical_coverage"], 1),
        "bundled_blocks_delta": s_kpis["bundled_blocks_count"] - b_kpis["bundled_blocks_count"]
    }

    # Format human-readable impact statement
    impact_narrative = []
    if delta["scheduled_tasks_delta"] > 0:
        impact_narrative.append(f"+{delta['scheduled_tasks_delta']} additional maintenance task(s) successfully scheduled.")
    elif delta["scheduled_tasks_delta"] < 0:
        impact_narrative.append(f"{abs(delta['scheduled_tasks_delta'])} fewer tasks scheduled due to tighter corridor constraints.")
    else:
        impact_narrative.append("Total scheduled task count remains constant.")

    if delta["critical_coverage_delta"] > 0:
        impact_narrative.append(f"Critical task coverage increased by {delta['critical_coverage_delta']}%.")

    if delta["bundled_blocks_delta"] > 0:
        impact_narrative.append(f"+{delta['bundled_blocks_delta']} joint departmental bundle(s) established, saving traffic windows.")

    # Audit logging
    audit_entry = AuditLog(
        log_id=f"AUD-SIM-{uuid.uuid4().hex[:8]}",
        user_role="Planner",
        action="What-If Simulation Run",
        target_id="SIMULATION",
        target_type="PLAN",
        details=(
            f"Simulation executed with BlockDurationDelta={req.block_duration_bonus_hours}h, "
            f"ExtraCrews={req.additional_crew_count}, Bundling={req.allow_bundling}. "
            f"Delta: {delta['scheduled_tasks_delta']:+d} tasks scheduled."
        )
    )
    db.add(audit_entry)
    db.commit()

    return {
        "status": "success",
        "parameters": {
            "block_duration_bonus_hours": req.block_duration_bonus_hours,
            "additional_crew_count": req.additional_crew_count,
            "allow_bundling": req.allow_bundling,
            "strategy_type": req.strategy_type
        },
        "baseline_kpis": b_kpis,
        "simulated_kpis": s_kpis,
        "delta": delta,
        "impact_summary": " ".join(impact_narrative),
        "simulated_scheduled_assignments": simulated_res["scheduled_assignments"],
        "simulated_deferred_tasks": simulated_res["deferred_tasks"],
        "disclaimer": "AI-Assisted Simulation | Non-autonomous decision support model."
    }
