import uuid
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import (
    Conflict,
    MaintenanceTask,
    TrainMovement,
    AuditLog,
    Notification,
    BlockWindow,
    SchedulePlan,
    ScheduleAssignment
)
from app.services.conflict_engine import detect_all_conflicts

router = APIRouter(prefix="/api/conflicts", tags=["Conflict Detection & Resolution"])

# ============================================================================
# SCHEMAS
# ============================================================================

class ConflictResolveRequest(BaseModel):
    user_name: Optional[str] = "Senior Operations Planner"
    resolution_action: Optional[str] = "BUNDLE_TASKS"
    resolution_strategy: Optional[str] = None
    resolution_notes: Optional[str] = "Resolved via multi-department corridor bundling."

class ConflictAssignRequest(BaseModel):
    assignee_name: str
    notes: Optional[str] = None

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("")
def get_conflicts(
    severity: Optional[str] = Query(None, description="Critical, Warning, Attention, Resolved"),
    conflict_type: Optional[str] = Query(None, description="Timetable, Resource, Location, Dependency, Duration, Corridor, Department"),
    status: Optional[str] = Query(None, description="Active, Resolved, Ignored"),
    db: Session = Depends(get_db)
):
    """Retrieve operational conflicts identified across the corridor."""
    query = db.query(Conflict)
    if severity and severity != "All":
        query = query.filter(Conflict.severity == severity)
    if conflict_type and conflict_type != "All":
        query = query.filter(Conflict.conflict_type == conflict_type)
    if status and status != "All":
        query = query.filter(Conflict.status == status)

    conflicts = query.order_by(Conflict.created_at.desc()).all()
    if not conflicts and not severity and not conflict_type and not status:
        # If empty, run detection
        conflicts_data = detect_all_conflicts(db, persist=True)
        return conflicts_data

    return [
        {
            "conflict_id": c.conflict_id,
            "conflict_type": c.conflict_type,
            "severity": c.severity,
            "status": c.status,
            "affected_tasks": c.affected_tasks or [],
            "affected_trains": c.affected_trains or [],
            "affected_corridor": c.affected_corridor,
            "start_time": c.start_time,
            "end_time": c.end_time,
            "explanation": c.explanation,
            "suggested_resolution": c.suggested_resolution,
            "resolution_notes": c.resolution_notes,
            "resolved_by": c.resolved_by,
            "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
            "detected_at": c.created_at.isoformat() if c.created_at else None,
            "data_label": "DEMO DATA"
        }
        for c in conflicts
    ]


@router.get("/summary")
def get_conflicts_summary(db: Session = Depends(get_db)):
    """Fetch aggregated summary breakdown of operational conflicts."""
    conflicts = db.query(Conflict).all()
    total = len(conflicts)
    critical = sum(1 for c in conflicts if c.severity == "Critical")
    warning = sum(1 for c in conflicts if c.severity == "Warning")
    resolved = sum(1 for c in conflicts if c.status == "Resolved")
    active = sum(1 for c in conflicts if c.status == "Active")
    timetable = sum(1 for c in conflicts if c.conflict_type == "Timetable")
    resource = sum(1 for c in conflicts if c.conflict_type == "Resource")
    location = sum(1 for c in conflicts if c.conflict_type == "Location")
    dependency = sum(1 for c in conflicts if c.conflict_type == "Dependency")

    return {
        "total": total,
        "active": active,
        "resolved": resolved,
        "critical": critical,
        "warning": warning,
        "timetable": timetable,
        "resource": resource,
        "location": location,
        "dependency": dependency
    }


@router.get("/{conflict_id}")
def get_conflict_by_id(conflict_id: str, db: Session = Depends(get_db)):
    """Fetch complete conflict details including affected tasks and train paths."""
    conflict = db.query(Conflict).filter(Conflict.conflict_id == conflict_id).first()
    if not conflict:
        raise HTTPException(status_code=404, detail="Conflict not found.")

    tasks = []
    if conflict.affected_tasks:
        tasks = db.query(MaintenanceTask).filter(MaintenanceTask.task_id.in_(conflict.affected_tasks)).all()

    trains = []
    if conflict.affected_trains:
        trains = db.query(TrainMovement).filter(TrainMovement.train_no.in_(conflict.affected_trains)).all()

    return {
        "conflict": {
            "conflict_id": conflict.conflict_id,
            "conflict_type": conflict.conflict_type,
            "severity": conflict.severity,
            "status": conflict.status,
            "affected_tasks": conflict.affected_tasks or [],
            "affected_trains": conflict.affected_trains or [],
            "affected_corridor": conflict.affected_corridor,
            "start_time": conflict.start_time,
            "end_time": conflict.end_time,
            "explanation": conflict.explanation,
            "suggested_resolution": conflict.suggested_resolution,
            "resolution_notes": conflict.resolution_notes,
            "resolved_by": conflict.resolved_by,
            "resolved_at": conflict.resolved_at.isoformat() if conflict.resolved_at else None,
            "detected_at": conflict.created_at.isoformat() if conflict.created_at else None
        },
        "tasks_detail": [
            {
                "task_id": t.task_id,
                "task_title": t.task_title or t.description[:40],
                "department": t.department,
                "location": t.location,
                "priority_score": t.priority_score,
                "duration_hours": t.duration_hours,
                "preferred_date": t.preferred_date
            }
            for t in tasks
        ],
        "trains_detail": [
            {
                "train_no": tr.train_no,
                "train_name": tr.train_name,
                "train_type": tr.train_type,
                "section": tr.section,
                "direction": tr.direction,
                "scheduled_departure": tr.scheduled_departure,
                "scheduled_arrival": tr.scheduled_arrival
            }
            for tr in trains
        ]
    }


@router.post("/detect", status_code=status.HTTP_200_OK)
def trigger_conflict_detection(db: Session = Depends(get_db)):
    """Executes the multi-factor conflict detection engine across current timetable and maintenance demands."""
    detected = detect_all_conflicts(db, persist=True)

    db.add(AuditLog(
        user_name="Divisional Planner",
        user_role="PLANNER",
        action="CONFLICT_DETECTION_RUN",
        target_id="SYSTEM",
        target_type="CONFLICT",
        details=f"Conflict detection triggered. {len(detected)} operational conflicts identified across corridor."
    ))
    db.commit()

    return {
        "status": "success",
        "total_conflicts_detected": len(detected),
        "conflicts": detected,
        "summary": {
            "critical_count": sum(1 for c in detected if c["severity"] == "Critical"),
            "warning_count": sum(1 for c in detected if c["severity"] == "Warning"),
            "timetable_count": sum(1 for c in detected if c["conflict_type"] == "Timetable"),
            "resource_count": sum(1 for c in detected if c["conflict_type"] == "Resource"),
            "location_count": sum(1 for c in detected if c["conflict_type"] == "Location"),
            "dependency_count": sum(1 for c in detected if c["conflict_type"] == "Dependency"),
            "duration_count": sum(1 for c in detected if c["conflict_type"] == "Duration")
        },
        "disclaimer": "AI-Assisted Conflict Detection | Decision Support for Indian Railways Planners"
    }


@router.post("/{conflict_id}/resolve")
def resolve_conflict(conflict_id: str, req: ConflictResolveRequest, db: Session = Depends(get_db)):
    """
    Formally resolve an operational conflict in the database.
    Updates conflict status, records audit log, and notifies control team.
    """
    conflict = db.query(Conflict).filter(Conflict.conflict_id == conflict_id).first()
    if not conflict:
        raise HTTPException(status_code=404, detail="Conflict not found.")

    conflict.status = "Resolved"
    conflict.resolution_notes = f"[{req.resolution_action}] {req.resolution_notes}"
    conflict.resolved_by = req.user_name
    conflict.resolved_at = datetime.utcnow()

    # Automatically transition affected tasks to Scheduled / Bundled & assign to Corridor Block
    plan = db.query(SchedulePlan).filter(SchedulePlan.status == "Approved").first() or db.query(SchedulePlan).first()
    updated_tasks = []

    if conflict.affected_tasks:
        for tid in conflict.affected_tasks:
            t = db.query(MaintenanceTask).filter(MaintenanceTask.task_id == tid).first()
            if t:
                t.status = "Bundled" if req.resolution_action == "BUNDLE_TASKS" else "Scheduled"
                
                # Locate suitable corridor block window
                block = db.query(BlockWindow).filter(
                    BlockWindow.section == t.location,
                    BlockWindow.max_duration_hours >= t.duration_hours
                ).first() or db.query(BlockWindow).filter(BlockWindow.section == t.location).first() or db.query(BlockWindow).first()

                if block:
                    t.assigned_block_id = block.block_id
                    block.status = "Allocated"
                    if req.resolution_action == "ADJUST_WINDOW" and block.date:
                        t.preferred_date = block.date

                    # Create schedule assignment in active plan so it immediately displays in Weekly/Monthly Planner
                    if plan:
                        existing_asgn = db.query(ScheduleAssignment).filter(
                            ScheduleAssignment.plan_id == plan.plan_id,
                            ScheduleAssignment.task_id == t.task_id
                        ).first()
                        if not existing_asgn:
                            new_asgn = ScheduleAssignment(
                                assignment_id=f"ASGN-{uuid.uuid4().hex[:8].upper()}",
                                plan_id=plan.plan_id,
                                task_id=t.task_id,
                                block_id=block.block_id,
                                start_time=block.start_time,
                                end_time=block.end_time,
                                status="Scheduled",
                                bundled_with=[x for x in conflict.affected_tasks if x != t.task_id],
                                explanation=f"Resolved via {req.resolution_action}. Bundled into {block.block_id}."
                            )
                            db.add(new_asgn)
                            plan.scheduled_count = (plan.scheduled_count or 0) + 1

                t.updated_at = datetime.utcnow()
                updated_tasks.append(t.task_id)

    db.add(AuditLog(
        user_name=req.user_name,
        user_role="PLANNER",
        action="CONFLICT_RESOLVED",
        target_id=conflict_id,
        target_type="CONFLICT",
        details=f"Conflict {conflict_id} resolved via {req.resolution_action}: {req.resolution_notes}. Updated tasks: {', '.join(updated_tasks) or 'None'}.",
        status_change="Active -> Resolved"
    ))

    db.add(Notification(
        title=f"Conflict Resolved ({conflict_id})",
        message=f"Conflict {conflict_id} resolved by {req.user_name}: {req.resolution_notes}",
        notification_type="CONFLICT",
        link_url=f"/conflicts",
        recipient_role="CONTROL_OFFICER"
    ))

    db.commit()
    return {
        "status": "success",
        "message": f"Conflict {conflict_id} marked as Resolved.",
        "conflict": {
            "conflict_id": conflict.conflict_id,
            "status": conflict.status,
            "resolved_by": conflict.resolved_by,
            "resolved_at": conflict.resolved_at.isoformat()
        },
        "updated_tasks": updated_tasks
    }


@router.post("/{conflict_id}/ignore")
def ignore_conflict(conflict_id: str, reason: str = Query(..., min_length=5), db: Session = Depends(get_db)):
    """Mark a conflict as Ignored with written justification."""
    conflict = db.query(Conflict).filter(Conflict.conflict_id == conflict_id).first()
    if not conflict:
        raise HTTPException(status_code=404, detail="Conflict not found.")

    conflict.status = "Ignored"
    conflict.resolution_notes = f"[IGNORED] {reason}"
    conflict.resolved_at = datetime.utcnow()

    db.add(AuditLog(
        user_name="Control Officer",
        user_role="CONTROL_OFFICER",
        action="CONFLICT_IGNORED",
        target_id=conflict_id,
        target_type="CONFLICT",
        details=f"Conflict {conflict_id} marked as Ignored. Justification: {reason}",
        status_change="Active -> Ignored"
    ))
    db.commit()
    return {"status": "success", "message": f"Conflict {conflict_id} ignored."}
