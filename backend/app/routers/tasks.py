import json
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from pydantic import BaseModel, Field
from app.database import get_db
from app.models.models import (
    MaintenanceTask,
    Asset,
    AuditLog,
    Notification,
    Conflict,
    BlockWindow,
    SchedulePlan,
    ScheduleAssignment,
    TrainMovement
)
from app.schemas.schemas import (
    MaintenanceTaskCreate,
    MaintenanceTaskUpdate,
    MaintenanceTaskResponse
)
from app.services.priority_engine import calculate_priority_score, recalculate_all_priorities, get_configured_weights

router = APIRouter(prefix="/api/tasks", tags=["Maintenance Requisitions & Work Orders"])
maintenance_alias_router = APIRouter(prefix="/api/maintenance", tags=["Maintenance Requisitions & Work Orders"])
requests_router = APIRouter(prefix="/api/requests", tags=["Maintenance Requisitions & Work Orders"])

@router.get("", response_model=List[MaintenanceTaskResponse])
@maintenance_alias_router.get("", response_model=List[MaintenanceTaskResponse])
@requests_router.get("", response_model=List[MaintenanceTaskResponse])
def get_all_tasks(
    department: Optional[str] = Query(None, description="Filter by department (Engineering, TRD, S&T, Operations)"),
    status: Optional[str] = Query(None, description="Filter by status (Pending, Scheduled, In_Progress, Completed, etc.)"),
    location: Optional[str] = Query(None, description="Filter by section location"),
    criticality: Optional[str] = Query(None, description="Filter by criticality level"),
    corridor: Optional[str] = Query(None, description="Filter by corridor"),
    asset_id: Optional[str] = Query(None, description="Filter by asset ID"),
    overdue: Optional[bool] = Query(None, description="Filter by overdue status"),
    search: Optional[str] = Query(None, description="Search description, title, or task ID"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=150, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Retrieve filtered, paginated list of railway maintenance work orders."""
    query = db.query(MaintenanceTask)

    if department and department != "All":
        query = query.filter(MaintenanceTask.department.ilike(f"%{department}%"))
    if status and status != "All":
        query = query.filter(MaintenanceTask.status == status)
    if location and location != "All":
        query = query.filter(MaintenanceTask.location == location)
    if criticality and criticality != "All":
        query = query.filter(MaintenanceTask.criticality == criticality)
    if corridor and corridor != "All":
        query = query.filter(MaintenanceTask.corridor == corridor)
    if asset_id and asset_id != "All":
        query = query.filter(MaintenanceTask.asset_id == asset_id)
    if overdue is not None:
        query = query.filter(MaintenanceTask.overdue == overdue)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (MaintenanceTask.task_id.ilike(s)) |
            (MaintenanceTask.task_title.ilike(s)) |
            (MaintenanceTask.description.ilike(s)) |
            (MaintenanceTask.location.ilike(s))
        )

    tasks = query.order_by(MaintenanceTask.priority_score.desc()).offset(skip).limit(limit).all()
    return tasks


@router.post("/import-demo")
@router.get("/import-demo")
@maintenance_alias_router.post("/import-demo")
@maintenance_alias_router.get("/import-demo")
@requests_router.post("/import-demo")
@requests_router.get("/import-demo")
def import_demo_tasks_endpoint(db: Session = Depends(get_db)):
    """
    Imports and ensures demo maintenance tasks and corridor requisitions are active in PostgreSQL.
    """
    try:
        from seed_data import seed_database
        seed_database(force=True)
    except Exception as e:
        print(f"[IMPORT_DEMO] Notice during seed: {e}")

    task_count = db.query(MaintenanceTask).count()

    db.add(AuditLog(
        user_name="System / Demo Loader",
        user_role="ADMIN",
        action="DEMO_DATA_IMPORTED",
        target_id="ALL_TASKS",
        target_type="TASK",
        details=f"Demo dataset synced successfully. Total active tasks: {task_count}."
    ))
    db.commit()

    return {
        "status": "success",
        "message": f"Demo dataset verified & loaded into PostgreSQL engine ({task_count} active tasks).",
        "records_imported": task_count,
        "total_active": task_count
    }


@router.get("/{task_id}", response_model=MaintenanceTaskResponse)
@maintenance_alias_router.get("/{task_id}", response_model=MaintenanceTaskResponse)
def get_task_by_id(task_id: str, db: Session = Depends(get_db)):
    """Fetch single maintenance work order by Task ID."""
    task = db.query(MaintenanceTask).filter(MaintenanceTask.task_id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Maintenance task with ID '{task_id}' was not found in the database."
        )
    return task


@router.post("", response_model=MaintenanceTaskResponse, status_code=status.HTTP_201_CREATED)
@maintenance_alias_router.post("", response_model=MaintenanceTaskResponse, status_code=status.HTTP_201_CREATED)
def create_maintenance_task(task_in: MaintenanceTaskCreate, db: Session = Depends(get_db)):
    """
    Create a new railway maintenance work order.
    Calculates priority score dynamically using the AI-assisted scoring engine.
    """
    # 1. Check duplicate task_id
    existing = db.query(MaintenanceTask).filter(MaintenanceTask.task_id == task_in.task_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Task ID '{task_in.task_id}' already exists. Duplicate task IDs are not allowed."
        )

    # 2. Match to Asset if asset_id not provided but location and type match
    assigned_asset_id = task_in.asset_id
    if not assigned_asset_id:
        asset_match = db.query(Asset).filter(
            Asset.location == task_in.location,
            Asset.department.ilike(f"%{task_in.department[:3]}%")
        ).first()
        if asset_match:
            assigned_asset_id = asset_match.id

    # 3. Calculate rule-based priority score with configured weights
    weights = get_configured_weights(db)
    score, factors, band = calculate_priority_score(
        criticality=task_in.criticality,
        urgency=task_in.urgency or "Normal",
        overdue=task_in.overdue,
        defect_severity=task_in.defect_severity or "Medium",
        operational_impact=task_in.operational_impact or "Medium",
        weights=weights
    )

    # 4. Create ORM instance
    db_task = MaintenanceTask(
        task_id=task_in.task_id,
        asset_id=assigned_asset_id,
        department=task_in.department,
        asset_type=task_in.asset_type,
        location=task_in.location,
        corridor=task_in.corridor or "Mainline Corridor Alpha",
        task_title=task_in.task_title or f"{task_in.asset_type} Maintenance ({task_in.location})",
        description=task_in.description,
        maintenance_type="Corrective" if task_in.criticality == "Critical" else "Preventive",
        duration_hours=task_in.duration_hours,
        preferred_date=task_in.preferred_date,
        preferred_start=task_in.preferred_start or "01:30:00",
        preferred_end=task_in.preferred_end or "04:30:00",
        deadline=task_in.deadline,
        criticality=task_in.criticality,
        urgency=task_in.urgency or "Normal",
        defect_severity=task_in.defect_severity or "Medium",
        operational_impact=task_in.operational_impact or "Medium",
        overdue=task_in.overdue,
        required_team_size=task_in.required_team_size or 6,
        required_resources=task_in.required_resources,
        dependencies=task_in.dependencies,
        compatible_departments=task_in.compatible_departments,
        safety_requirements=task_in.safety_requirements or "Line block and electrical isolation required.",
        notes=task_in.notes,
        status=task_in.status,
        priority_score=score,
        priority_factors=factors,
        data_source="BDMS",
        data_label="DEMO DATA",
        created_at=datetime.utcnow()
    )
    db.add(db_task)

    # 5. Record immutable audit log
    db.add(AuditLog(
        user_name="Divisional Planner",
        user_role="PLANNER",
        action="Task Created",
        target_id=db_task.task_id,
        target_type="TASK",
        details=f"Created work order {db_task.task_id} ({db_task.department}): {db_task.task_title}. Priority Score: {score} ({band})."
    ))

    # 6. Notification if Critical
    if score >= 80.0 or task_in.criticality == "Critical":
        db.add(Notification(
            title=f"Critical Maintenance Requisition ({db_task.task_id})",
            message=f"Critical safety maintenance registered on {db_task.location} ({db_task.department}). Score: {score}.",
            notification_type="REQUEST",
            link_url=f"/maintenance",
            recipient_role="PLANNER"
        ))

    db.commit()
    db.refresh(db_task)
    return db_task


@router.put("/{task_id}", response_model=MaintenanceTaskResponse)
@maintenance_alias_router.put("/{task_id}", response_model=MaintenanceTaskResponse)
def update_maintenance_task(task_id: str, task_in: MaintenanceTaskUpdate, db: Session = Depends(get_db)):
    """Update existing maintenance work order and recalculate priority score."""
    task = db.query(MaintenanceTask).filter(MaintenanceTask.task_id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task ID '{task_id}' was not found in the database."
        )

    old_status = task.status
    update_data = task_in.model_dump(exclude_unset=True)

    for field, val in update_data.items():
        setattr(task, field, val)

    # Recalculate priority score
    weights = get_configured_weights(db)
    score, factors, band = calculate_priority_score(
        criticality=task.criticality or "Medium",
        urgency=task.urgency or "Normal",
        overdue=bool(task.overdue),
        defect_severity=task.defect_severity or "Medium",
        operational_impact=task.operational_impact or "Medium",
        weights=weights
    )
    task.priority_score = score
    task.priority_factors = factors
    task.updated_at = datetime.utcnow()

    # Audit log
    db.add(AuditLog(
        user_name="Divisional Planner",
        user_role="PLANNER",
        action="TASK_UPDATED",
        target_id=task.task_id,
        target_type="TASK",
        details=f"Updated task {task.task_id}. Status: {task.status}, Priority Score: {score}.",
        status_change=f"{old_status} -> {task.status}" if old_status != task.status else None
    ))

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}")
@maintenance_alias_router.delete("/{task_id}")
def delete_maintenance_task(task_id: str, db: Session = Depends(get_db)):
    """Delete a maintenance requisition from the database."""
    task = db.query(MaintenanceTask).filter(MaintenanceTask.task_id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task ID '{task_id}' was not found in the database."
        )

    db.delete(task)
    db.add(AuditLog(
        user_name="Divisional Planner",
        user_role="PLANNER",
        action="TASK_DELETED",
        target_id=task_id,
        target_type="TASK",
        details=f"Deleted maintenance task requisition {task_id}."
    ))
    db.commit()
    return {"status": "success", "message": f"Maintenance task '{task_id}' was deleted successfully."}


@router.post("/recalculate-priorities")
@maintenance_alias_router.post("/recalculate-priorities")
def recalculate_priorities_endpoint(db: Session = Depends(get_db)):
    """Batch recalculate priority scores for all tasks using active admin weights."""
    res = recalculate_all_priorities(db)
    db.add(AuditLog(
        user_name="Divisional Administrator",
        user_role="ADMIN",
        action="PRIORITIES_RECALCULATED",
        target_id="ALL_TASKS",
        target_type="TASK",
        details=f"Recalculated priority scores for {res['tasks_recalculated']} tasks."
    ))
    db.commit()
    return res


# ============================================================================
# TASK VALIDATION & INTERACTIVE CONFLICT RESOLUTION
# ============================================================================

class TaskResolveRequest(BaseModel):
    resolution_action: str = Field(default="BUNDLE_TASKS", description="BUNDLE_TASKS, LINK_TIMETABLE, ADJUST_WINDOW")
    target_block_id: Optional[str] = None
    target_date: Optional[str] = None
    notes: Optional[str] = "Resolved via multi-department corridor bundling."
    user_name: Optional[str] = "Senior Operations Planner"


@router.get("/{task_id}/validation")
@maintenance_alias_router.get("/{task_id}/validation")
@requests_router.get("/{task_id}/validation")
def get_task_validation(task_id: str, db: Session = Depends(get_db)):
    """
    Evaluates comprehensive 5D operational conflict & validation status for a specific task:
    1. Time Conflict
    2. Location Conflict
    3. Operational / Timetable Conflict
    4. Resource Conflict
    5. Dependency Conflict
    Returns clear status (Passed / Failed / Warning) and railway operational reasons.
    """
    task = db.query(MaintenanceTask).filter(MaintenanceTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Fetch active conflicts affecting this task
    all_conflicts = db.query(Conflict).all()
    task_conflicts = [
        c for c in all_conflicts 
        if c.status == "Active" and c.affected_tasks and task_id in c.affected_tasks
    ]

    tt_conflicts = [c for c in task_conflicts if c.conflict_type in ["Timetable", "Operational"]]
    res_conflicts = [c for c in task_conflicts if c.conflict_type == "Resource"]
    loc_conflicts = [c for c in task_conflicts if c.conflict_type in ["Location", "Corridor"]]
    dep_conflicts = [c for c in task_conflicts if c.conflict_type == "Dependency"]
    dur_conflicts = [c for c in task_conflicts if c.conflict_type in ["Duration", "Time"]]

    # 1. Time Conflict
    if dur_conflicts:
        time_status = "Failed"
        time_reason = f"❌ Time Conflict — {dur_conflicts[0].explanation}"
    elif task.assigned_block_id or task.status in ["Scheduled", "Bundled", "Approved"]:
        time_status = "Passed"
        time_reason = f"✓ Time Validation — Requested window ({task.duration_hours}h) fits assigned block ({task.assigned_block_id}) with zero overlap."
    elif task.duration_hours > 3.5:
        time_status = "Warning"
        time_reason = f"⚠ Time Warning — Requested window ({task.duration_hours}h) exceeds standard 3.0h daytime possession. Special absolute window needed."
    else:
        time_status = "Passed"
        time_reason = f"✓ Time Validation — Requested window ({task.duration_hours}h) fits corridor allowable possession window."

    # 2. Location Conflict
    if loc_conflicts:
        loc_status = "Failed"
        loc_reason = f"❌ Location Conflict — {loc_conflicts[0].explanation}"
    else:
        loc_status = "Passed"
        loc_reason = f"✓ Location Check — Section {task.location} track occupancy cleared. No opposing physical possession requested."

    # 3. Operational / Timetable Conflict
    if tt_conflicts:
        tt_status = "Failed"
        tt_reason = f"❌ Operational Conflict — {tt_conflicts[0].explanation}"
    elif task.assigned_block_id or task.status in ["Scheduled", "Bundled", "Approved"]:
        tt_status = "Passed"
        tt_reason = "✓ Operational Check — Timetable path validated. Clears all high-priority passenger express paths (>25 min buffer)."
    else:
        trains_on_section = db.query(TrainMovement).filter(TrainMovement.section == task.location).count()
        if trains_on_section > 4 and task.criticality == "Critical" and not task.assigned_block_id:
            tt_status = "Warning"
            tt_reason = f"⚠ Timetable Caution — High train traffic corridor ({trains_on_section} scheduled movements). Synchronize with shadow block."
        else:
            tt_status = "Passed"
            tt_reason = "✓ Operational Check — Zero revenue train headway clash. Safe clearance > 30 mins to nearest passenger express."

    # 4. Resource Conflict
    if res_conflicts:
        res_status = "Failed"
        res_reason = f"❌ Resource Conflict — {res_conflicts[0].explanation}"
    elif not task.required_resources or len(task.required_resources) == 0:
        res_status = "Warning"
        res_reason = "⚠ Resource Notice — No specific machinery requisitioned. Standard departmental maintenance gang allocated."
    else:
        res_status = "Passed"
        res_reason = f"✓ Resource Check — Required Engineering team and equipment ({', '.join(task.required_resources)}) are available."

    # 5. Dependency Conflict
    if dep_conflicts:
        dep_status = "Failed"
        dep_reason = f"❌ Dependency Conflict — {dep_conflicts[0].explanation}"
    elif task.dependencies and len(task.dependencies) > 0:
        pred_tasks = db.query(MaintenanceTask).filter(MaintenanceTask.task_id.in_(task.dependencies)).all()
        incomplete = [p.task_id for p in pred_tasks if p.status != "Completed"]
        if incomplete:
            dep_status = "Warning"
            dep_reason = f"⚠ Dependency Caution — Predecessor task(s) {', '.join(incomplete)} scheduled prior to execution."
        else:
            dep_status = "Passed"
            dep_reason = "✓ Dependency Check — All predecessor maintenance prerequisites and safety permits satisfied."
    else:
        dep_status = "Passed"
        dep_reason = "✓ Dependency Check — No predecessor dependency constraints. Direct line possession permitted."

    checks = [
        {"id": "time", "name": "Time Conflict", "status": time_status, "reason": time_reason},
        {"id": "location", "name": "Location Conflict", "status": loc_status, "reason": loc_reason},
        {"id": "operational", "name": "Operational / Timetable Conflict", "status": tt_status, "reason": tt_reason},
        {"id": "resource", "name": "Resource Conflict", "status": res_status, "reason": res_reason},
        {"id": "dependency", "name": "Dependency Conflict", "status": dep_status, "reason": dep_reason},
    ]

    has_fail = any(c["status"] == "Failed" for c in checks)
    has_warn = any(c["status"] == "Warning" for c in checks)
    overall_status = "Failed" if has_fail else ("Warning" if has_warn else "Passed")

    avail_blocks = db.query(BlockWindow).filter(BlockWindow.section == task.location).all()
    block_options = [
        {
            "block_id": b.block_id,
            "section": b.section,
            "date": b.date,
            "start_time": b.start_time,
            "end_time": b.end_time,
            "duration": b.max_duration_hours,
            "block_type": b.block_type,
            "status": b.status
        }
        for b in avail_blocks
    ]

    compat_candidates = db.query(MaintenanceTask).filter(
        MaintenanceTask.location == task.location,
        MaintenanceTask.task_id != task.task_id,
        MaintenanceTask.department != task.department
    ).limit(3).all()

    bundle_options = [
        {
            "task_id": c.task_id,
            "department": c.department,
            "description": c.description,
            "duration_hours": c.duration_hours,
            "preferred_date": c.preferred_date
        }
        for c in compat_candidates
    ]

    return {
        "task_id": task.task_id,
        "task_title": task.task_title or task.description,
        "department": task.department,
        "location": task.location,
        "status": task.status,
        "assigned_block_id": task.assigned_block_id,
        "overall_status": overall_status,
        "has_conflicts": len(task_conflicts) > 0 or has_fail,
        "checks": checks,
        "conflicts": [
            {
                "conflict_id": c.conflict_id,
                "conflict_type": c.conflict_type,
                "severity": c.severity,
                "affected_tasks": c.affected_tasks or [],
                "affected_trains": c.affected_trains or [],
                "affected_corridor": c.affected_corridor,
                "start_time": c.start_time,
                "end_time": c.end_time,
                "explanation": c.explanation,
                "suggested_resolution": c.suggested_resolution,
                "status": c.status
            }
            for c in task_conflicts
        ],
        "suggested_resolutions": [
            {
                "action": "BUNDLE_TASKS",
                "title": "Join / Multi-Department Work (Bundling)",
                "description": f"Combine with compatible {', '.join([c.department for c in compat_candidates]) or 'S&T / TRD'} tasks in {task.location} into a single synchronized possession block.",
                "candidates": bundle_options
            },
            {
                "action": "LINK_TIMETABLE",
                "title": "Link with Timetable Window",
                "description": f"Align maintenance activity with an available/non-conflicting corridor timetable window in {task.location}.",
                "blocks": block_options[:4]
            },
            {
                "action": "ADJUST_WINDOW",
                "title": "Adjust Time / Location Window",
                "description": f"Shift request preferred date to an alternate date (+1 day) or off-peak slot (01:30 - 05:00) to clear resource/traffic bottlenecks."
            }
        ]
    }


@router.post("/{task_id}/resolve")
@maintenance_alias_router.post("/{task_id}/resolve")
@requests_router.post("/{task_id}/resolve")
def resolve_task_conflict(task_id: str, req: TaskResolveRequest, db: Session = Depends(get_db)):
    """
    Applies planner's selected resolution to resolve task conflicts:
    1. Updates any active conflict records linked to this task to 'Resolved'.
    2. Assigns the task to an available/bundle corridor block window.
    3. Updates task status to 'Scheduled' or 'Bundled'.
    4. Registers ScheduleAssignment in active plan so it immediately reflects in Weekly & Monthly Planner.
    5. Records append-only audit trail entry.
    """
    task = db.query(MaintenanceTask).filter(MaintenanceTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    old_status = task.status

    # 1. Mark related active conflicts as Resolved
    all_conflicts = db.query(Conflict).all()
    resolved_conflict_ids = []
    for c in all_conflicts:
        if c.status == "Active" and c.affected_tasks and task_id in c.affected_tasks:
            c.status = "Resolved"
            c.resolution_notes = f"[{req.resolution_action}] {req.notes or 'Resolved by planner'}"
            c.resolved_by = req.user_name
            c.resolved_at = datetime.utcnow()
            resolved_conflict_ids.append(c.conflict_id)

    # 2. Find target block window
    block = None
    if req.target_block_id:
        block = db.query(BlockWindow).filter(BlockWindow.block_id == req.target_block_id).first()
    if not block:
        # Search available block matching task location
        block = db.query(BlockWindow).filter(
            BlockWindow.section == task.location,
            BlockWindow.max_duration_hours >= task.duration_hours
        ).first()
    if not block:
        block = db.query(BlockWindow).filter(BlockWindow.section == task.location).first()
    if not block:
        block = db.query(BlockWindow).first()

    # 3. Apply resolution adjustments
    if req.resolution_action == "ADJUST_WINDOW":
        if req.target_date:
            task.preferred_date = req.target_date
        elif block and block.date:
            task.preferred_date = block.date
        task.status = "Scheduled"
    elif req.resolution_action == "BUNDLE_TASKS":
        task.status = "Bundled"
    else: # LINK_TIMETABLE
        task.status = "Scheduled"

    if block:
        task.assigned_block_id = block.block_id
        block.status = "Allocated"

    task.updated_at = datetime.utcnow()

    # 4. Integrate into active plan ScheduleAssignment
    plan = db.query(SchedulePlan).filter(SchedulePlan.status == "Approved").first() or db.query(SchedulePlan).first()
    if plan and block:
        existing_asgn = db.query(ScheduleAssignment).filter(
            ScheduleAssignment.plan_id == plan.plan_id,
            ScheduleAssignment.task_id == task.task_id
        ).first()
        if not existing_asgn:
            # Find bundled tasks on this block
            bundled_tasks = [
                t.task_id for t in db.query(MaintenanceTask).filter(
                    MaintenanceTask.assigned_block_id == block.block_id,
                    MaintenanceTask.task_id != task.task_id
                ).all()
            ]
            new_asgn = ScheduleAssignment(
                assignment_id=f"ASGN-{uuid.uuid4().hex[:8].upper()}",
                plan_id=plan.plan_id,
                task_id=task.task_id,
                block_id=block.block_id,
                start_time=block.start_time,
                end_time=block.end_time,
                status="Scheduled",
                bundled_with=bundled_tasks,
                explanation=f"Allocated to {block.block_id} following {req.resolution_action} conflict resolution."
            )
            db.add(new_asgn)
            plan.scheduled_count = (plan.scheduled_count or 0) + 1

    # 5. Audit Log
    db.add(AuditLog(
        user_name=req.user_name,
        user_role="PLANNER",
        action="TASK_CONFLICT_RESOLVED",
        target_id=task.task_id,
        target_type="TASK",
        details=f"Task {task.task_id} resolved via {req.resolution_action}. Assigned Block: {block.block_id if block else 'None'}. Conflicts cleared: {', '.join(resolved_conflict_ids) or 'None'}.",
        status_change=f"{old_status} -> {task.status}"
    ))

    db.commit()
    db.refresh(task)

    return {
        "status": "success",
        "message": f"Conflict successfully resolved via {req.resolution_action}.",
        "task_id": task.task_id,
        "new_status": task.status,
        "assigned_block_id": task.assigned_block_id,
        "assigned_block": {
            "block_id": block.block_id,
            "section": block.section,
            "date": block.date,
            "start_time": block.start_time,
            "end_time": block.end_time
        } if block else None,
        "resolved_conflicts_count": len(resolved_conflict_ids),
        "resolved_conflict_ids": resolved_conflict_ids
    }
