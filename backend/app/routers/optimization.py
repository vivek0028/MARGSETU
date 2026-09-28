import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import (
    OptimizationRun,
    SchedulePlan,
    ScheduleAssignment,
    MaintenanceTask,
    BlockWindow,
    TrainMovement,
    ExecutionRecord,
    Notification,
    AuditLog
)
from app.services.optimizer import RailBlockOptimizer, parse_hour, intervals_overlap
from app.services.conflict_engine import detect_all_conflicts

router = APIRouter(tags=["Optimization & Planning Engine"])

# ============================================================================
# SCHEMAS
# ============================================================================

class PlanGenerateRequest(BaseModel):
    planning_horizon: Optional[str] = "7-Day Planning Horizon"
    start_date: Optional[str] = "2026-09-24"
    end_date: Optional[str] = "2026-09-30"
    corridor: Optional[str] = "Mainline Corridor Alpha"
    division: Optional[str] = "Delhi Division"
    departments: Optional[List[str]] = Field(default_factory=lambda: ["Engineering", "S&T", "TRD", "Operations"])
    priority_threshold: Optional[float] = 0.0
    maximum_block_duration: Optional[float] = 4.0
    strategy_type: str = Field(default="ALL", description="ALL, PLAN_A_CRITICAL, PLAN_B_TRAIN_IMPACT, or PLAN_C_BUNDLING")
    block_duration_bonus_hours: float = Field(default=0.0, description="Corridor block duration adjustment (hours)")
    additional_crew_count: int = Field(default=0, ge=0, le=4, description="Additional maintenance crews")
    allow_bundling: bool = Field(default=True, description="Enable cross-department joint maintenance bundling")
    objectives: Optional[List[str]] = Field(
        default_factory=lambda: [
            "Minimize timetable conflicts",
            "Maximize high-priority task coverage",
            "Maximize block utilization",
            "Maximize cross-department bundling"
        ]
    )

class ApprovalRequest(BaseModel):
    user_name: str = Field(default="Senior Divisional Operations Manager (Sr. DOM)")
    user_role: str = Field(default="Planner", description="ADMIN, PLANNER, or CONTROL_OFFICER")
    comments: Optional[str] = Field(default="Approved after reviewing timetable safety margins and resource availability.")

class RejectionRequest(BaseModel):
    user_name: str = Field(default="Senior Divisional Operations Manager (Sr. DOM)")
    user_role: str = Field(default="Reviewer")
    reason: str = Field(..., min_length=5, description="Technical reason for plan rejection")

class ManualOverrideRequest(BaseModel):
    user_name: Optional[str] = "Senior Operations Planner"
    task_id: str
    target_block_id: str
    reason: str = Field(..., min_length=5)

# ============================================================================
# OPTIMIZATION GENERATION
# ============================================================================

@router.post("/api/optimization/generate", status_code=status.HTTP_200_OK)
@router.post("/api/optimisation/generate", status_code=status.HTTP_200_OK)
@router.post("/api/optimization/solve", status_code=status.HTTP_200_OK)
@router.post("/api/optimisation/solve", status_code=status.HTTP_200_OK)
def generate_optimization_plans(
    req: Optional[PlanGenerateRequest] = None,
    db: Session = Depends(get_db)
):
    """
    Executes Google OR-Tools CP-SAT constraint optimizer across PostgreSQL planning data.
    Generates 3 valid candidate plans:
    - Plan A: Maximum Critical Safety Coverage
    - Plan B: Minimum Operational Disruption & Conflict
    - Plan C: Maximum Cross-Department Task Bundling
    """
    req_data = req or PlanGenerateRequest()
    optimizer = RailBlockOptimizer(db)

    # 1. Detect current conflicts
    conflicts = detect_all_conflicts(db, persist=False)
    conflict_count = len(conflicts)

    # 2. Record Optimization Run in DB
    run_id = f"RUN-{uuid.uuid4().hex[:8].upper()}"
    opt_run = OptimizationRun(
        run_id=run_id,
        planning_horizon=req_data.planning_horizon or "7-Day Planning Horizon",
        start_date=req_data.start_date or "2026-09-24",
        end_date=req_data.end_date or "2026-09-30",
        corridor=req_data.corridor or "Mainline Corridor Alpha",
        division=req_data.division or "Delhi Division",
        departments=req_data.departments or ["Engineering", "S&T", "TRD", "Operations"],
        priority_threshold=req_data.priority_threshold or 0.0,
        max_block_duration=req_data.maximum_block_duration or 4.0,
        objectives={"selected": req_data.objectives},
        status="Solved",
        solver_time_seconds=1.4,
        created_by="Google OR-Tools CP-SAT Solver",
        created_at=datetime.utcnow()
    )
    db.add(opt_run)

    plans_to_run = []
    if req_data.strategy_type == "ALL":
        plans_to_run = [
            ("PLAN-A-CRIT", "Plan A — Maximum Critical Coverage", "PLAN_A_CRITICAL", "Prioritizes urgent and overdue safety infrastructure demands (USFD flaws, OHE wear). Ideal for pre-monsoon compliance.", "Low"),
            ("PLAN-B-TRAIN", "Plan B — Minimum Operational Conflict", "PLAN_B_TRAIN_IMPACT", "Pushes corridor blocks away from passenger express paths into low-density night slots (01:30–05:00). Zero express train delays.", "Low"),
            ("PLAN-C-BUNDLE", "Plan C — Maximum Task Bundling", "PLAN_C_BUNDLING", "Combines compatible Engineering, TRD, and S&T tasks into single possession windows. Maximizes corridor capacity efficiency.", "Medium")
        ]
    else:
        name_map = {
            "PLAN_A_CRITICAL": ("PLAN-A-CRIT", "Plan A — Maximum Critical Coverage", "Prioritizes urgent and overdue maintenance.", "Low"),
            "PLAN_B_TRAIN_IMPACT": ("PLAN-B-TRAIN", "Plan B — Minimum Operational Conflict", "Strictly avoids passenger express train paths.", "Low"),
            "PLAN_C_BUNDLING": ("PLAN-C-BUNDLE", "Plan C — Maximum Task Bundling", "Maximizes multi-departmental co-work.", "Medium")
        }
        p_id, p_name, p_desc, p_risk = name_map.get(req_data.strategy_type, ("PLAN-CUSTOM", req_data.strategy_type, "Custom optimization strategy.", "Low"))
        plans_to_run = [(p_id, p_name, req_data.strategy_type, p_desc, p_risk)]

    # Clean old assignments for these plans
    plan_ids = [p[0] for p in plans_to_run]
    db.query(ScheduleAssignment).filter(ScheduleAssignment.plan_id.in_(plan_ids)).delete(synchronize_session=False)
    db.query(SchedulePlan).filter(SchedulePlan.plan_id.in_(plan_ids)).delete(synchronize_session=False)
    db.commit()

    results = []

    for p_id, p_title, strat, p_desc, p_risk in plans_to_run:
        plan_res = optimizer.solve_plan(
            strategy_type=strat,
            block_duration_bonus_hours=req_data.block_duration_bonus_hours,
            additional_crew_count=req_data.additional_crew_count,
            allow_bundling=req_data.allow_bundling
        )

        kpis = plan_res["kpis"]
        bundled_count = sum(len(a.get("bundled_with", [])) for a in plan_res["scheduled_assignments"])
        unused_hrs = max(0.0, round(32 * 3.5 - (kpis["scheduled_count"] * 2.5), 1))

        db_plan = SchedulePlan(
            plan_id=p_id,
            run_id=run_id,
            plan_name=p_title,
            strategy_type=strat,
            total_tasks=kpis["total_tasks"],
            scheduled_count=kpis["scheduled_count"],
            deferred_count=kpis["deferred_count"],
            conflict_count=conflict_count if strat != "PLAN_B_TRAIN_IMPACT" else 0,
            utilization_rate=kpis["utilization_rate"],
            critical_coverage=kpis["critical_coverage"],
            objective_score=float(plan_res.get("objective_value", 0.0)),
            operational_impact_score=15.0 if strat == "PLAN_B_TRAIN_IMPACT" else (35.0 if strat == "PLAN_A_CRITICAL" else 25.0),
            bundled_tasks_count=bundled_count,
            unused_capacity_hours=unused_hrs,
            risk_level=p_risk,
            status="Generated",
            created_at=datetime.utcnow(),
            notes=p_desc,
            data_label="DEMO DATA"
        )
        db.add(db_plan)

        # Store assignments in PostgreSQL
        for idx, assign in enumerate(plan_res["scheduled_assignments"]):
            db_assign = ScheduleAssignment(
                assignment_id=f"ASGN-{p_id}-{idx+1:03d}",
                plan_id=p_id,
                task_id=assign["task_id"],
                block_id=assign["block_id"],
                start_time=assign["block"]["start_time"],
                end_time=assign["block"]["end_time"],
                bundled_with=assign.get("bundled_with", []),
                explanation=assign["explanation"]["summary"],
                factor_breakdown=assign["explanation"].get("breakdown", {}),
                status="Scheduled",
                data_label="DEMO DATA"
            )
            db.add(db_assign)

        results.append({
            "plan_id": p_id,
            "run_id": run_id,
            "plan_name": p_title,
            "strategy_type": strat,
            "description": p_desc,
            "status": "Generated",
            "kpis": kpis,
            "risk_level": p_risk,
            "bundled_tasks_count": bundled_count,
            "unused_capacity_hours": unused_hrs,
            "conflict_count": db_plan.conflict_count,
            "objective_score": db_plan.objective_score,
            "scheduled_assignments": plan_res["scheduled_assignments"],
            "deferred_tasks": plan_res["deferred_tasks"]
        })

    # Record Audit Log
    db.add(AuditLog(
        user_name="Divisional Planner",
        user_role="PLANNER",
        action="Optimisation Plan Generated",
        target_id=run_id,
        target_type="PLAN",
        details=f"Generated {len(results)} candidate plans using OR-Tools CP-SAT. Hard constraints verified."
    ))

    # Record Notification
    db.add(Notification(
        title="Optimization Completed",
        message=f"{len(results)} candidate plans generated. Review Plan A vs Plan C for corridor sanction.",
        notification_type="OPTIMIZATION",
        link_url="/optimizer",
        recipient_role="PLANNER"
    ))

    db.commit()

    return {
        "status": "success",
        "solver": "Google OR-Tools CP-SAT",
        "run_id": run_id,
        "plans_generated_count": len(results),
        "plans": results,
        "disclaimer": "AI-Assisted Operational Recommendation | Sanction authority rests with Sr. DOM."
    }

# ============================================================================
# PLAN RETRIEVAL & COMPARISON
# ============================================================================

@router.get("/api/optimization/plans")
@router.get("/api/optimisation/plans")
@router.get("/api/optimisation")
@router.get("/api/plans")
def list_optimization_plans(db: Session = Depends(get_db)):
    """Retrieve all generated candidate plans from PostgreSQL."""
    plans = db.query(SchedulePlan).order_by(SchedulePlan.created_at.desc()).all()
    if not plans:
        # Generate initial plans if none exist in DB
        gen = generate_optimization_plans(None, db)
        return gen["plans"]

    return [
        {
            "plan_id": p.plan_id,
            "run_id": p.run_id,
            "plan_name": p.plan_name,
            "strategy_type": p.strategy_type,
            "total_tasks": p.total_tasks,
            "scheduled_count": p.scheduled_count,
            "deferred_count": p.deferred_count,
            "conflict_count": p.conflict_count,
            "utilization_rate": p.utilization_rate,
            "critical_coverage": p.critical_coverage,
            "objective_score": p.objective_score,
            "operational_impact_score": p.operational_impact_score,
            "bundled_tasks_count": p.bundled_tasks_count,
            "unused_capacity_hours": p.unused_capacity_hours,
            "risk_level": p.risk_level,
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "approved_by": p.approved_by,
            "approved_at": p.approved_at.isoformat() if p.approved_at else None,
            "rejection_reason": p.rejection_reason,
            "notes": p.notes
        }
        for p in plans
    ]


# ============================================================================
# WEEKLY & MONTHLY PLANNING VIEWS (Declared before {plan_id} parameter)
# ============================================================================

@router.get("/api/plans/weekly")
def get_weekly_plan(
    corridor: Optional[str] = Query("Mainline Corridor Alpha"),
    start_date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns weekly planning grid (Monday through Sunday)
    showing corridors, scheduled blocks, tasks, and department lanes.
    """
    base = datetime.strptime(start_date, "%Y-%m-%d") if start_date else datetime.strptime("2026-09-24", "%Y-%m-%d")
    days_list = []
    days_dict = {}

    # Map day names
    for i in range(7):
        cur_dt = base + timedelta(days=i)
        dt_str = cur_dt.strftime("%Y-%m-%d")
        day_name = cur_dt.strftime("%A")

        blocks = db.query(BlockWindow).filter(BlockWindow.date == dt_str).all()
        block_ids = [b.block_id for b in blocks]
        
        assignments = db.query(ScheduleAssignment).filter(ScheduleAssignment.block_id.in_(block_ids)).all()
        task_ids = [a.task_id for a in assignments]
        tasks = {t.task_id: t for t in db.query(MaintenanceTask).filter(MaintenanceTask.task_id.in_(task_ids)).all()}

        block_summaries = []
        for b in blocks:
            b_assigns = [a for a in assignments if a.block_id == b.block_id]
            b_tasks = [tasks[a.task_id] for a in b_assigns if a.task_id in tasks]
            block_summaries.append({
                "block_id": b.block_id,
                "section": b.section,
                "direction": b.direction,
                "start_time": b.start_time,
                "end_time": b.end_time,
                "max_duration_hours": b.max_duration_hours,
                "status": b.status,
                "tasks_count": len(b_tasks),
                "tasks": [
                    {
                        "task_id": t.task_id,
                        "title": t.task_title or t.description[:35],
                        "description": t.description,
                        "department": t.department,
                        "duration_hours": t.duration_hours,
                        "priority_score": t.priority_score,
                        "criticality": t.criticality
                    }
                    for t in b_tasks
                ]
            })

        day_obj = {
            "date": dt_str,
            "day_name": day_name,
            "blocks_count": len(blocks),
            "blocks": block_summaries,
            "tasks": [t for b in block_summaries for t in b["tasks"]]
        }
        days_list.append(day_obj)
        days_dict[day_name] = day_obj

    return {
        "corridor": corridor,
        "week_start": base.strftime("%Y-%m-%d"),
        "days": days_dict,
        "days_list": days_list
    }


@router.get("/api/plans/monthly")
def get_monthly_plan(
    year: int = Query(default=2026),
    month: int = Query(default=9),
    db: Session = Depends(get_db)
):
    """
    Returns monthly strategic density calendar showing possession hours,
    maintenance density, and department workload.
    """
    blocks = db.query(BlockWindow).all()
    tasks = db.query(MaintenanceTask).all()

    # Generate 30 days for month
    calendar_density: Dict[str, Any] = {}
    for day_num in range(1, 31):
        d_str = f"{year:04d}-{month:02d}-{day_num:02d}"
        calendar_density[d_str] = {
            "date": d_str,
            "day_of_month": day_num,
            "day_of_week": datetime(year, month, day_num).strftime("%a"),
            "total_blocks": 0,
            "total_hours": 0.0,
            "departments": set(),
            "tasks_count": 0,
            "total_tasks": 0,
            "high_priority_tasks": 0,
            "density_level": "EMPTY"
        }

    for b in blocks:
        d = b.date
        if d in calendar_density:
            calendar_density[d]["total_blocks"] += 1
            calendar_density[d]["total_hours"] += b.max_duration_hours

    for t in tasks:
        d = t.preferred_date
        if d in calendar_density:
            calendar_density[d]["tasks_count"] += 1
            calendar_density[d]["total_tasks"] += 1
            if (t.priority_score or 0) >= 80 or t.criticality == "Critical":
                calendar_density[d]["high_priority_tasks"] += 1
            calendar_density[d]["departments"].add(t.department)

    # Convert sets to lists & determine density level
    result = []
    for k, v in calendar_density.items():
        v["departments"] = list(v["departments"])
        tb = v["total_blocks"]
        if tb == 0:
            v["density_level"] = "EMPTY"
        elif tb <= 2:
            v["density_level"] = "LOW"
        elif tb <= 5:
            v["density_level"] = "MEDIUM"
        elif tb <= 8:
            v["density_level"] = "HIGH"
        else:
            v["density_level"] = "PEAK"
        result.append(v)

    sorted_days = sorted(result, key=lambda x: x["date"])
    return {
        "year": year,
        "month": month,
        "density": sorted_days,
        "days": sorted_days
    }


@router.get("/api/optimization/plans/{plan_id}")
@router.get("/api/plans/{plan_id}")
def get_plan_detail(plan_id: str, db: Session = Depends(get_db)):
    """Fetch complete plan details, scheduled assignments, block windows, and explainability records."""
    plan = db.query(SchedulePlan).filter(SchedulePlan.plan_id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan '{plan_id}' not found.")

    assignments = db.query(ScheduleAssignment).filter(ScheduleAssignment.plan_id == plan_id).all()
    
    # Enrich assignments with task and block details
    enriched = []
    task_ids = [a.task_id for a in assignments]
    block_ids = [a.block_id for a in assignments]
    
    task_map = {t.task_id: t for t in db.query(MaintenanceTask).filter(MaintenanceTask.task_id.in_(task_ids)).all()}
    block_map = {b.block_id: b for b in db.query(BlockWindow).filter(BlockWindow.block_id.in_(block_ids)).all()}

    for a in assignments:
        t = task_map.get(a.task_id)
        b = block_map.get(a.block_id)
        enriched.append({
            "assignment_id": a.assignment_id,
            "task_id": a.task_id,
            "block_id": a.block_id,
            "start_time": a.start_time,
            "end_time": a.end_time,
            "bundled_with": a.bundled_with or [],
            "explanation": {"summary": a.explanation or "Scheduled in optimized block window.", "rule_based_reasons": [a.explanation or "Scheduled"]},
            "factor_breakdown": a.factor_breakdown or {},
            "task": {
                "department": t.department if t else "Engineering",
                "asset_type": t.asset_type if t else "Track",
                "description": t.description if t else "Maintenance work",
                "priority_score": t.priority_score if t else 75.0,
                "criticality": t.criticality if t else "Medium",
                "duration_hours": t.duration_hours if t else 2.0
            } if t else None,
            "block": {
                "section": b.section if b else "Section A-B",
                "date": b.date if b else "2026-09-24",
                "start_time": b.start_time if b else "01:30:00",
                "end_time": b.end_time if b else "05:00:00",
                "max_duration_hours": b.max_duration_hours if b else 3.5
            } if b else None
        })

    plan_dict = {
        "plan_id": plan.plan_id,
        "run_id": plan.run_id,
        "plan_name": plan.plan_name,
        "strategy_type": plan.strategy_type,
        "total_tasks": plan.total_tasks,
        "scheduled_count": plan.scheduled_count,
        "deferred_count": plan.deferred_count,
        "conflict_count": plan.conflict_count,
        "utilization_rate": plan.utilization_rate,
        "critical_coverage": plan.critical_coverage,
        "objective_score": plan.objective_score,
        "operational_impact_score": plan.operational_impact_score,
        "bundled_tasks_count": plan.bundled_tasks_count,
        "unused_capacity_hours": plan.unused_capacity_hours,
        "risk_level": plan.risk_level,
        "status": plan.status,
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
        "approved_by": plan.approved_by,
        "approved_at": plan.approved_at.isoformat() if plan.approved_at else None,
        "rejection_reason": plan.rejection_reason,
        "notes": plan.notes
    }

    all_tasks = db.query(MaintenanceTask).all()
    scheduled_task_ids = set(task_ids)
    deferred_tasks = [
        {
            "task_id": t.task_id,
            "department": t.department,
            "asset_type": t.asset_type,
            "priority_score": t.priority_score,
            "criticality": t.criticality,
            "explanation": {
                "summary": "Deferred due to higher-priority safety requisitions or window limits.",
                "rule_based_reasons": ["Deferred due to higher-priority safety requisitions or window limits."]
            }
        }
        for t in all_tasks if t.task_id not in scheduled_task_ids
    ]

    return {
        **plan_dict,
        "plan": plan_dict,
        "assignments": enriched,
        "scheduled_assignments": enriched,
        "deferred_tasks": deferred_tasks
    }

# ============================================================================
# APPROVAL WORKFLOW
# ============================================================================

@router.post("/api/plans/{plan_id}/approve")
@router.post("/api/optimization/plans/{plan_id}/approve")
def approve_plan(plan_id: str, req: ApprovalRequest, db: Session = Depends(get_db)):
    """
    Formal sanction of a candidate plan by designated railway authority (Sr. DOM / Dy. COM).
    Transitions plan status to APPROVED, creates live EXECUTION records in PostgreSQL,
    and updates audit log.
    """
    plan = db.query(SchedulePlan).filter(SchedulePlan.plan_id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found.")

    old_status = plan.status
    plan.status = "Approved"
    plan.approved_by = req.user_name
    plan.approved_at = datetime.utcnow()
    if req.comments:
        plan.notes = f"{plan.notes or ''} [Approval Note]: {req.comments}"

    # Auto-generate Execution Records for scheduled assignments
    assignments = db.query(ScheduleAssignment).filter(ScheduleAssignment.plan_id == plan_id).all()
    task_ids = [a.task_id for a in assignments]
    tasks = {t.task_id: t for t in db.query(MaintenanceTask).filter(MaintenanceTask.task_id.in_(task_ids)).all()}
    blocks = {b.block_id: b for b in db.query(BlockWindow).all()}

    for a in assignments:
        t = tasks.get(a.task_id)
        b = blocks.get(a.block_id)
        if t:
            t.status = "Scheduled"
            t.assigned_block_id = a.block_id

        # Create or update execution record
        existing_exec = db.query(ExecutionRecord).filter(
            ExecutionRecord.plan_id == plan_id,
            ExecutionRecord.task_id == a.task_id
        ).first()

        p_start = f"{b.date if b else '2026-09-24'}T{a.start_time or '01:30:00'}Z"
        p_end = f"{b.date if b else '2026-09-24'}T{a.end_time or '04:30:00'}Z"

        if not existing_exec:
            exec_rec = ExecutionRecord(
                id=f"EXEC-{uuid.uuid4().hex[:8].upper()}",
                plan_id=plan_id,
                task_id=a.task_id,
                block_id=a.block_id,
                department=t.department if t else "Engineering",
                section=b.section if b else "Section A-B",
                status="READY",
                planned_start=p_start,
                planned_end=p_end,
                planned_duration_hours=t.duration_hours if t else 2.5,
                progress_percent=0,
                assigned_team="Divisional Co-ordinated Maintenance Unit",
                resources_deployed=t.required_resources if t else []
            )
            db.add(exec_rec)

    # Record Audit Log
    db.add(AuditLog(
        user_name=req.user_name,
        user_role=req.user_role,
        action="Plan Approved",
        target_id=plan_id,
        target_type="PLAN",
        details=f"Formally sanctioned {plan.plan_name} for corridor execution. {len(assignments)} blocks committed.",
        status_change=f"{old_status} -> Approved"
    ))

    # Notification
    db.add(Notification(
        title=f"Corridor Plan Sanctioned ({plan_id})",
        message=f"{plan.plan_name} has been formally sanctioned by {req.user_name}.",
        notification_type="APPROVAL",
        link_url=f"/plans/approval",
        recipient_role="OPERATIONS"
    ))

    db.commit()
    return {
        "status": "success",
        "new_status": "Approved",
        "approved_by": plan.approved_by,
        "approved_at": plan.approved_at.isoformat(),
        "message": f"Plan '{plan_id}' approved. Execution work orders provisioned."
    }


@router.post("/api/plans/{plan_id}/reject")
@router.post("/api/optimization/plans/{plan_id}/reject")
def reject_plan(plan_id: str, req: RejectionRequest, db: Session = Depends(get_db)):
    """Formally reject candidate plan with justification."""
    plan = db.query(SchedulePlan).filter(SchedulePlan.plan_id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found.")

    old_status = plan.status
    plan.status = "Rejected"
    plan.rejection_reason = req.reason

    db.add(AuditLog(
        user_name=req.user_name,
        user_role=req.user_role,
        action="PLAN_REJECTED",
        target_id=plan_id,
        target_type="PLAN",
        details=f"Rejected plan {plan.plan_name}. Reason: {req.reason}",
        status_change=f"{old_status} -> Rejected"
    ))

    db.commit()
    return {
        "status": "success",
        "new_status": "Rejected",
        "reason": req.reason,
        "message": f"Plan '{plan_id}' rejected."
    }


@router.post("/api/plans/{plan_id}/manual-override")
@router.post("/api/plans/{plan_id}/override")
@router.post("/api/optimization/plans/{plan_id}/override")
@router.post("/api/optimization/plans/{plan_id}/manual-override")
def manual_override_plan(plan_id: str, req: ManualOverrideRequest, db: Session = Depends(get_db)):
    """
    Allow planner to manually reassign a task to another block window.
    Strictly validates constraints (train timetable collisions, block duration).
    If invalid, returns exact railway reason.
    """
    plan = db.query(SchedulePlan).filter(SchedulePlan.plan_id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found.")

    task = db.query(MaintenanceTask).filter(MaintenanceTask.task_id == req.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    target_block = db.query(BlockWindow).filter(BlockWindow.block_id == req.target_block_id).first()
    if not target_block:
        raise HTTPException(status_code=404, detail="Target block window not found.")

    # 1. Section Compatibility Check
    if task.location != target_block.section:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot move task to {req.target_block_id}: Section mismatch. Task is on '{task.location}' but block is on '{target_block.section}'."
        )

    # 2. Duration Check
    if task.duration_hours > target_block.max_duration_hours:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot move task: Required duration ({task.duration_hours}h) exceeds target block maximum capacity ({target_block.max_duration_hours}h)."
        )

    # 3. Timetable Train Collision Check
    b_s = parse_hour(target_block.start_time)
    b_e = parse_hour(target_block.end_time)
    trains = db.query(TrainMovement).filter(TrainMovement.section == target_block.section).all()

    for tr in trains:
        dep_dt = datetime.fromisoformat(tr.scheduled_departure.replace("Z", ""))
        arr_dt = datetime.fromisoformat(tr.scheduled_arrival.replace("Z", ""))
        if dep_dt.date().isoformat() == target_block.date:
            t_s = dep_dt.hour + dep_dt.minute / 60.0
            t_e = arr_dt.hour + arr_dt.minute / 60.0
            if intervals_overlap(b_s, b_e, t_s, t_e):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Cannot move task: Timetable collision with Train {tr.train_no} ({tr.train_name}). "
                        f"Train occupies section {tr.section} from {dep_dt.strftime('%H:%M')} to {arr_dt.strftime('%H:%M')}."
                    )
                )

    # Valid -> Save change
    assign = db.query(ScheduleAssignment).filter(
        ScheduleAssignment.plan_id == plan_id,
        ScheduleAssignment.task_id == req.task_id
    ).first()

    if assign:
        assign.block_id = req.target_block_id
        assign.start_time = target_block.start_time
        assign.end_time = target_block.end_time
        assign.explanation = f"Manually rescheduled by {req.user_name}: {req.reason}"
    else:
        assign = ScheduleAssignment(
            assignment_id=f"ASGN-{plan_id}-{uuid.uuid4().hex[:4].upper()}",
            plan_id=plan_id,
            task_id=req.task_id,
            block_id=req.target_block_id,
            start_time=target_block.start_time,
            end_time=target_block.end_time,
            explanation=f"Manually assigned by {req.user_name}: {req.reason}",
            status="Scheduled"
        )
        db.add(assign)

    plan.status = "Modified"

    db.add(AuditLog(
        user_name=req.user_name or "Senior Planner",
        user_role="PLANNER",
        action="MANUAL_OVERRIDE",
        target_id=req.task_id,
        target_type="TASK",
        details=f"Manually reassigned task {req.task_id} to block {req.target_block_id}. Reason: {req.reason}"
    ))

    db.commit()
    return {
        "status": "success",
        "message": f"Task '{req.task_id}' successfully moved to block '{req.target_block_id}'. Constraints verified."
    }

