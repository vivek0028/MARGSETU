import io
import csv
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException, Response
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

router = APIRouter(prefix="/api/reports", tags=["Reports & Compliance Documentation"])

@router.get("")
@router.get("/list")
@router.get("/summary")
def list_available_report_templates():
    """List standard report templates available for export."""
    return [
        {
            "id": "RPT-WEEKLY-PLAN",
            "name": "Weekly Corridor Planning Schedule",
            "description": "Corridor-wise weekly traffic and power block possessions with assigned gangs and tasks.",
            "category": "Operational Planning",
            "formats": ["CSV", "JSON"]
        },
        {
            "id": "RPT-MAINTENANCE-SUMMARY",
            "name": "Maintenance Work Orders & Safety Requisitions",
            "description": "Comprehensive register of active, scheduled, and completed maintenance work orders with AI priority scores.",
            "category": "Maintenance",
            "formats": ["CSV", "JSON"]
        },
        {
            "id": "RPT-CONFLICTS",
            "name": "Corridor Timetable & Resource Conflicts Log",
            "description": "Active and resolved operational conflicts with suggested and applied resolutions.",
            "category": "Safety & Control",
            "formats": ["CSV", "JSON"]
        },
        {
            "id": "RPT-EXECUTION-VARIANCE",
            "name": "Plan vs Actual Execution Performance",
            "description": "Duration variance, delay times, and completion rate of sanctioned maintenance blocks.",
            "category": "Performance Monitoring",
            "formats": ["CSV", "JSON"]
        },
        {
            "id": "RPT-AUDIT-TRAIL",
            "name": "Append-Only Operational Audit Trail",
            "description": "Chronological audit records of all approval, override, and scheduling decisions.",
            "category": "Compliance & Audit",
            "formats": ["CSV", "JSON"]
        }
    ]


@router.get("/export")
def export_report_data(
    report_id: str = Query(..., description="RPT-WEEKLY-PLAN, RPT-MAINTENANCE-SUMMARY, RPT-CONFLICTS, RPT-EXECUTION-VARIANCE, RPT-AUDIT-TRAIL"),
    export_format: str = Query(default="csv", description="csv or json"),
    db: Session = Depends(get_db)
):
    """
    Export dynamic report data in CSV or JSON format.
    Data is queried live from PostgreSQL.
    """
    if report_id == "RPT-MAINTENANCE-SUMMARY":
        tasks = db.query(MaintenanceTask).all()
        data = [
            {
                "Task_ID": t.task_id,
                "Department": t.department,
                "Asset_Type": t.asset_type,
                "Location": t.location,
                "Priority_Score": t.priority_score,
                "Criticality": t.criticality,
                "Urgency": t.urgency,
                "Defect_Severity": t.defect_severity,
                "Duration_Hours": t.duration_hours,
                "Preferred_Date": t.preferred_date,
                "Deadline": t.deadline,
                "Status": t.status,
                "Assigned_Block": t.assigned_block_id or "Unassigned"
            }
            for t in tasks
        ]
        filename = f"railoptiblock_maintenance_{datetime.utcnow().strftime('%Y%m%d')}.csv"

    elif report_id == "RPT-CONFLICTS":
        conflicts = db.query(Conflict).all()
        data = [
            {
                "Conflict_ID": c.conflict_id,
                "Type": c.conflict_type,
                "Severity": c.severity,
                "Status": c.status,
                "Corridor": c.affected_corridor,
                "Affected_Tasks": "; ".join(c.affected_tasks or []),
                "Affected_Trains": "; ".join(c.affected_trains or []),
                "Explanation": c.explanation,
                "Suggested_Resolution": c.suggested_resolution,
                "Resolved_By": c.resolved_by or "Unresolved"
            }
            for c in conflicts
        ]
        filename = f"railoptiblock_conflicts_{datetime.utcnow().strftime('%Y%m%d')}.csv"

    elif report_id == "RPT-EXECUTION-VARIANCE":
        records = db.query(ExecutionRecord).all()
        data = [
            {
                "Execution_ID": r.id,
                "Task_ID": r.task_id,
                "Department": r.department,
                "Section": r.section,
                "Status": r.status,
                "Planned_Start": r.planned_start,
                "Actual_Start": r.actual_start or "N/A",
                "Planned_Hours": r.planned_duration_hours,
                "Actual_Hours": r.actual_duration_hours or r.planned_duration_hours,
                "Delay_Minutes": r.delay_minutes,
                "Progress_Percent": r.progress_percent,
                "Assigned_Team": r.assigned_team
            }
            for r in records
        ]
        filename = f"railoptiblock_execution_{datetime.utcnow().strftime('%Y%m%d')}.csv"

    elif report_id == "RPT-AUDIT-TRAIL":
        audits = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(200).all()
        data = [
            {
                "Log_ID": a.log_id,
                "Timestamp": a.timestamp.isoformat() if a.timestamp else "",
                "User": a.user_name,
                "Role": a.user_role,
                "Action": a.action,
                "Target_Type": a.target_type,
                "Target_ID": a.target_id,
                "Details": a.details,
                "IP_Address": a.ip_address
            }
            for a in audits
        ]
        filename = f"railoptiblock_audit_{datetime.utcnow().strftime('%Y%m%d')}.csv"

    else:
        # Default: Weekly Plan / Block Windows
        blocks = db.query(BlockWindow).all()
        data = [
            {
                "Block_ID": b.block_id,
                "Corridor": b.corridor,
                "Section": b.section,
                "Date": b.date,
                "Start_Time": b.start_time,
                "End_Time": b.end_time,
                "Max_Duration_Hours": b.max_duration_hours,
                "Block_Type": b.block_type,
                "Status": b.status
            }
            for b in blocks
        ]
        filename = f"railoptiblock_weekly_plan_{datetime.utcnow().strftime('%Y%m%d')}.csv"

    if export_format.lower() == "json":
        return {"report_id": report_id, "generated_at": datetime.utcnow().isoformat(), "records_count": len(data), "data": data}

    # CSV Generation
    if not data:
        return Response(content="No records found.", media_type="text/csv")

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(data[0].keys()))
    writer.writeheader()
    writer.writerows(data)

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/execution/csv")
def export_execution_csv(db: Session = Depends(get_db)):
    """Export execution variance report directly in CSV format."""
    return export_report_data(report_id="RPT-EXECUTION-VARIANCE", export_format="csv", db=db)


@router.get("/plan/{plan_id}/json")
def export_plan_json(plan_id: str, db: Session = Depends(get_db)):
    """Export schedule plan breakdown directly in JSON format."""
    plan = db.query(SchedulePlan).filter(SchedulePlan.plan_id == plan_id).first()
    if not plan:
        plan = db.query(SchedulePlan).first()
    if not plan:
        return {"plan_id": plan_id, "status": "DRAFT", "tasks": []}
    return {
        "plan_id": plan.plan_id,
        "plan_name": plan.plan_name,
        "strategy_type": plan.strategy_type,
        "status": plan.status,
        "scheduled_tasks_count": plan.scheduled_count,
        "total_tasks": plan.total_tasks,
        "bundled_tasks_count": plan.bundled_tasks_count,
        "utilization_rate": plan.utilization_rate,
        "critical_coverage": plan.critical_coverage,
        "objective_score": plan.objective_score,
        "operational_impact_score": plan.operational_impact_score,
        "risk_level": plan.risk_level
    }

