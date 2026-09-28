from typing import Dict, Any, List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import (
    MaintenanceTask,
    BlockWindow,
    Conflict,
    SchedulePlan,
    ExecutionRecord,
    AuditLog
)

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard Summary & Command Center"])

@router.get("/summary")
@router.get("/overview")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """
    Returns live operations command center dashboard metrics
    queried directly from PostgreSQL database.
    """
    tasks = db.query(MaintenanceTask).all()
    blocks = db.query(BlockWindow).all()
    conflicts = db.query(Conflict).all()
    plans = db.query(SchedulePlan).all()
    exec_records = db.query(ExecutionRecord).all()
    recent_logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(8).all()

    # 1. Real Database-Driven KPIs
    total_tasks = len(tasks)
    active_requests = sum(1 for t in tasks if t.status in ["Pending", "Scheduled", "In_Progress"])
    pending_requests = sum(1 for t in tasks if t.status == "Pending")
    high_priority_tasks = sum(1 for t in tasks if (t.priority_score or 0.0) >= 60.0 or t.criticality in ["Critical", "High"] or t.overdue)
    active_conflicts = sum(1 for c in conflicts if c.status == "Active")
    available_blocks = sum(1 for b in blocks if b.status == "Available")
    plans_awaiting_approval = sum(1 for p in plans if p.status in ["Generated", "Under Review", "Draft", "Modified"])
    approved_blocks = sum(1 for b in blocks if b.status in ["Allocated", "Reserved"])
    tasks_in_execution = sum(1 for r in exec_records if r.status == "IN_PROGRESS")

    # 2. Block Utilization
    total_block_hours = round(sum(b.max_duration_hours for b in blocks), 1)
    allocated_hours = round(sum(b.max_duration_hours for b in blocks if b.status in ["Allocated", "Reserved"]), 1)
    unused_hours = round(max(0.0, total_block_hours - allocated_hours), 1)
    utilization_rate = round((allocated_hours / max(1.0, total_block_hours)) * 100, 1)

    # 3. Department Workload
    dept_workload = {
        "Engineering": sum(1 for t in tasks if "engineering" in t.department.lower()),
        "TRD": sum(1 for t in tasks if "trd" in t.department.lower() or "traction" in t.department.lower()),
        "S&T": sum(1 for t in tasks if "signal" in t.department.lower() or "s&t" in t.department.lower() or "telecom" in t.department.lower()),
        "Operations": sum(1 for t in tasks if "operat" in t.department.lower())
    }

    # 4. Priority Distribution
    priority_dist = {
        "Critical": sum(1 for t in tasks if (t.priority_score or 0) >= 80),
        "High": sum(1 for t in tasks if 60 <= (t.priority_score or 0) < 80),
        "Medium": sum(1 for t in tasks if 40 <= (t.priority_score or 0) < 60),
        "Low": sum(1 for t in tasks if (t.priority_score or 0) < 40)
    }

    # 5. Active Conflicts List
    active_conflict_items = [
        {
            "conflict_id": c.conflict_id,
            "conflict_type": c.conflict_type,
            "severity": c.severity,
            "affected_corridor": c.affected_corridor,
            "start_time": c.start_time,
            "end_time": c.end_time,
            "status": c.status,
            "explanation": c.explanation,
            "suggested_resolution": c.suggested_resolution
        }
        for c in conflicts
        if c.status == "Active"
    ][:6]

    # 6. Upcoming Blocks (Next 7 Days)
    upcoming_blocks = [
        {
            "block_id": b.block_id,
            "corridor": b.corridor,
            "section": b.section,
            "date": b.date,
            "start_time": b.start_time,
            "end_time": b.end_time,
            "max_duration_hours": b.max_duration_hours,
            "status": b.status,
            "block_type": b.block_type
        }
        for b in sorted(blocks, key=lambda x: (x.date, x.start_time))
    ][:8]

    # 7. Critical Tasks Requiring Immediate Action
    critical_attention = [
        {
            "task_id": t.task_id,
            "task_title": t.task_title or (t.description[:35] if t.description else "Maintenance Requisition"),
            "description": t.description or t.task_title or "Urgent track/catenary maintenance",
            "department": t.department,
            "asset_type": t.asset_type,
            "location": t.location,
            "priority_score": t.priority_score,
            "deadline": t.deadline,
            "overdue": t.overdue,
            "status": t.status
        }
        for t in sorted(tasks, key=lambda x: x.priority_score or 0.0, reverse=True)
        if (t.priority_score or 0.0) >= 80 or t.overdue
    ][:6]

    # 8. Recent Audit Activity Stream
    activity = [
        {
            "log_id": log.log_id,
            "timestamp": log.timestamp.strftime("%H:%M - %b %d") if log.timestamp else "",
            "user_name": log.user_name,
            "user_role": log.user_role,
            "action": log.action,
            "target_id": log.target_id,
            "details": log.details,
            "status_change": log.status_change
        }
        for log in recent_logs
    ]

    return {
        "kpis": {
            "active_maintenance_requests": active_requests,
            "pending_requests": pending_requests,
            "high_priority_tasks": high_priority_tasks,
            "active_conflicts": active_conflicts,
            "conflicts_detected": active_conflicts,
            "available_block_windows": available_blocks,
            "plans_awaiting_approval": plans_awaiting_approval,
            "approved_blocks": approved_blocks,
            "tasks_in_execution": tasks_in_execution,
            "total_maintenance_requests": total_tasks,
            "block_utilization_rate": utilization_rate,
            "available_hours": round(total_block_hours - allocated_hours, 1),
            "allocated_hours": allocated_hours,
            "total_hours": total_block_hours
        },
        "block_utilization": {
            "available_hours": unused_hours,
            "allocated_hours": allocated_hours,
            "unused_hours": unused_hours,
            "total_hours": total_block_hours,
            "utilization_percent": utilization_rate
        },
        "workload_by_department": dept_workload,
        "department_summary": dept_workload,
        "priority_distribution": priority_dist,
        "conflict_summary": {
            "total": len(conflicts),
            "critical": sum(1 for c in conflicts if c.severity == "Critical"),
            "warning": sum(1 for c in conflicts if c.severity == "Warning"),
            "timetable": sum(1 for c in conflicts if c.conflict_type == "Timetable"),
            "resource": sum(1 for c in conflicts if c.conflict_type == "Resource"),
            "location": sum(1 for c in conflicts if c.conflict_type == "Location"),
            "dependency": sum(1 for c in conflicts if c.conflict_type == "Dependency"),
            "duration": sum(1 for c in conflicts if c.conflict_type == "Duration")
        },
        "active_conflicts": active_conflict_items,
        "upcoming_blocks": upcoming_blocks,
        "critical_attention_tasks": critical_attention,
        "critical_tasks_requiring_attention": critical_attention,
        "recent_activity": activity
    }
