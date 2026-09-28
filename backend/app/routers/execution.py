import uuid
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import ExecutionRecord, MaintenanceTask, BlockWindow, AuditLog, Notification

router = APIRouter(prefix="/api/execution", tags=["Maintenance Execution & Plan vs Actual"])

# ============================================================================
# SCHEMAS
# ============================================================================

class ExecutionStatusUpdate(BaseModel):
    status: str = Field(..., description="READY, IN_PROGRESS, PAUSED, COMPLETED, FAILED, CANCELLED")
    progress_percent: Optional[int] = Field(None, ge=0, le=100)
    actual_start: Optional[str] = None
    actual_end: Optional[str] = None
    delay_minutes: Optional[int] = None
    issue_notes: Optional[str] = None
    completion_notes: Optional[str] = None
    user_name: Optional[str] = "Station Control Master"

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("")
@router.get("/records")
def list_execution_records(
    status: Optional[str] = Query(None, description="Filter by execution status"),
    department: Optional[str] = Query(None, description="Filter by department"),
    plan_id: Optional[str] = Query(None, description="Filter by plan ID"),
    db: Session = Depends(get_db)
):
    """Retrieve operational execution records for maintenance tracking."""
    query = db.query(ExecutionRecord)
    if status and status != "All":
        query = query.filter(ExecutionRecord.status == status)
    if department and department != "All":
        query = query.filter(ExecutionRecord.department == department)
    if plan_id and plan_id != "All":
        query = query.filter(ExecutionRecord.plan_id == plan_id)

    records = query.order_by(ExecutionRecord.created_at.desc()).all()
    return records


@router.get("/plan-vs-actual")
@router.get("/summary")
def get_plan_vs_actual_analytics(db: Session = Depends(get_db)):
    """
    Computes Plan vs Actual metrics across all execution records:
    - Planned vs actual duration
    - Average delay minutes
    - Completion rate %
    - Disruption variance
    """
    records = db.query(ExecutionRecord).all()
    completed = [r for r in records if r.status == "COMPLETED"]

    total_planned_hrs = sum(r.planned_duration_hours or 0.0 for r in records)
    total_actual_hrs = sum(r.actual_duration_hours or r.planned_duration_hours for r in completed)
    avg_delay = round(sum(r.delay_minutes or 0 for r in records) / max(1, len(records)), 1)
    completion_rate = round((len(completed) / max(1, len(records))) * 100, 1)

    items = []
    for r in records:
        variance_hrs = round((r.actual_duration_hours or r.planned_duration_hours) - r.planned_duration_hours, 2)
        items.append({
            "id": r.id,
            "task_id": r.task_id,
            "department": r.department,
            "section": r.section,
            "status": r.status,
            "planned_start": r.planned_start,
            "actual_start": r.actual_start,
            "planned_end": r.planned_end,
            "actual_end": r.actual_end,
            "planned_duration_hours": r.planned_duration_hours,
            "actual_duration_hours": r.actual_duration_hours or r.planned_duration_hours,
            "duration_variance_hours": variance_hrs,
            "delay_minutes": r.delay_minutes,
            "progress_percent": r.progress_percent,
            "assigned_team": r.assigned_team,
            "issue_notes": r.issue_notes,
            "completion_notes": r.completion_notes
        })

    return {
        "summary": {
            "total_records": len(records),
            "completed_records": len(completed),
            "completion_rate_percent": completion_rate,
            "total_planned_hours": round(total_planned_hrs, 1),
            "total_actual_hours": round(total_actual_hrs, 1),
            "average_delay_minutes": avg_delay
        },
        "total_executions": len(records),
        "average_variance_minutes": avg_delay,
        "completion_rate_percent": completion_rate,
        "records": items
    }


@router.put("/{record_id}")
@router.post("/{record_id}/status")
def update_execution_status(
    record_id: str,
    req: ExecutionStatusUpdate,
    db: Session = Depends(get_db)
):
    """
    Transition maintenance execution status (READY -> IN_PROGRESS -> COMPLETED).
    Updates actual timestamps, delay notes, and notifies operations.
    """
    rec = db.query(ExecutionRecord).filter(ExecutionRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Execution record not found.")

    old_status = rec.status
    rec.status = req.status

    if req.progress_percent is not None:
        rec.progress_percent = req.progress_percent

    now_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    if req.status == "IN_PROGRESS" and not rec.actual_start:
        rec.actual_start = req.actual_start or now_iso
        if rec.progress_percent == 0:
            rec.progress_percent = 25

    if req.status == "COMPLETED":
        rec.actual_end = req.actual_end or now_iso
        rec.progress_percent = 100
        if rec.actual_start and not rec.actual_duration_hours:
            try:
                s_dt = datetime.fromisoformat(rec.actual_start.replace("Z", ""))
                e_dt = datetime.fromisoformat(rec.actual_end.replace("Z", ""))
                rec.actual_duration_hours = round((e_dt - s_dt).total_seconds() / 3600.0, 2)
            except Exception:
                rec.actual_duration_hours = rec.planned_duration_hours

        # Update underlying task status to Completed
        task = db.query(MaintenanceTask).filter(MaintenanceTask.task_id == rec.task_id).first()
        if task:
            task.status = "Completed"

    if req.delay_minutes is not None:
        rec.delay_minutes = req.delay_minutes
    if req.issue_notes:
        rec.issue_notes = req.issue_notes
    if req.completion_notes:
        rec.completion_notes = req.completion_notes

    rec.updated_at = datetime.utcnow()

    # Audit log
    db.add(AuditLog(
        user_name=req.user_name or "Operations Officer",
        user_role="OPERATIONS",
        action="EXECUTION_STATUS_UPDATED",
        target_id=rec.id,
        target_type="EXECUTION",
        details=f"Execution {rec.id} ({rec.task_id}) status changed to {rec.status} ({rec.progress_percent}%).",
        status_change=f"{old_status} -> {rec.status}"
    ))

    # Notification
    if req.status in ["IN_PROGRESS", "COMPLETED"]:
        db.add(Notification(
            title=f"Maintenance Execution {rec.status} ({rec.task_id})",
            message=f"Work order {rec.task_id} on {rec.section} is now {rec.status}. Progress: {rec.progress_percent}%.",
            notification_type="EXECUTION",
            link_url="/execution",
            recipient_role="PLANNER"
        ))

    db.commit()
    db.refresh(rec)
    return rec
