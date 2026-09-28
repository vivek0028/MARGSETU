from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.models import (
    MaintenanceTask,
    BlockWindow,
    Conflict,
    ExecutionRecord,
    SchedulePlan,
    Asset
)

router = APIRouter(prefix="/api/analytics", tags=["Operational Analytics & Business Intelligence"])

@router.get("/overview")
def get_analytics_overview(
    days: int = Query(default=30, ge=7, le=365),
    db: Session = Depends(get_db)
):
    """
    Returns enterprise-grade operational analytics computed directly from PostgreSQL tables.
    """
    # 1. Maintenance by Department
    dept_counts = db.query(
        MaintenanceTask.department,
        func.count(MaintenanceTask.task_id)
    ).group_by(MaintenanceTask.department).all()

    workload_by_dept = [
        {"department": dept, "count": count}
        for dept, count in dept_counts
    ]

    # 2. Maintenance by Asset Type
    asset_type_counts = db.query(
        MaintenanceTask.asset_type,
        func.count(MaintenanceTask.task_id)
    ).group_by(MaintenanceTask.asset_type).all()

    workload_by_asset_type = [
        {"asset_type": at, "count": count}
        for at, count in asset_type_counts
    ]

    # 3. Priority Distribution
    priority_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
    tasks = db.query(MaintenanceTask.priority_score).all()
    for t in tasks:
        score = t[0] or 0.0
        if score >= 80.0:
            priority_counts["Critical"] += 1
        elif score >= 60.0:
            priority_counts["High"] += 1
        elif score >= 40.0:
            priority_counts["Medium"] += 1
        else:
            priority_counts["Low"] += 1

    priority_distribution = [
        {"priority": k, "count": v}
        for k, v in priority_counts.items()
    ]

    # 4. Block Window Utilization
    blocks = db.query(BlockWindow).all()
    total_blocks = len(blocks)
    allocated_blocks = sum(1 for b in blocks if b.status == "Allocated" or b.status == "Reserved")
    available_blocks = sum(1 for b in blocks if b.status == "Available")
    total_block_hours = round(sum(b.max_duration_hours for b in blocks), 1)
    allocated_hours = round(sum(b.max_duration_hours for b in blocks if b.status in ["Allocated", "Reserved"]), 1)
    unused_hours = round(total_block_hours - allocated_hours, 1)
    utilization_rate = round((allocated_hours / max(1.0, total_block_hours)) * 100, 1)

    block_utilization = {
        "total_blocks": total_blocks,
        "allocated_blocks": allocated_blocks,
        "available_blocks": available_blocks,
        "total_block_hours": total_block_hours,
        "allocated_hours": allocated_hours,
        "unused_hours": unused_hours,
        "utilization_rate_percent": utilization_rate
    }

    # 5. Conflicts by Type & Severity
    conf_types = db.query(
        Conflict.conflict_type,
        func.count(Conflict.conflict_id)
    ).group_by(Conflict.conflict_type).all()

    conf_by_type = [
        {"type": ct, "count": count}
        for ct, count in conf_types
    ]

    # 6. Execution Status & Delay Analysis
    exec_records = db.query(ExecutionRecord).all()
    exec_status_counts: Dict[str, int] = {}
    for r in exec_records:
        exec_status_counts[r.status] = exec_status_counts.get(r.status, 0) + 1

    avg_delay = round(sum(r.delay_minutes or 0 for r in exec_records) / max(1, len(exec_records)), 1)
    planned_vs_actual = [
        {
            "task_id": r.task_id,
            "department": r.department,
            "planned_hours": r.planned_duration_hours,
            "actual_hours": r.actual_duration_hours or r.planned_duration_hours,
            "delay_minutes": r.delay_minutes or 0
        }
        for r in exec_records[:8]
    ]

    # 7. Asset Condition Health Bands
    assets = db.query(Asset.condition_score).all()
    asset_health = {"Good (80-100)": 0, "Fair (65-79)": 0, "Degraded (<65)": 0}
    for a in assets:
        cond = a[0] or 80.0
        if cond >= 80.0:
            asset_health["Good (80-100)"] += 1
        elif cond >= 65.0:
            asset_health["Fair (65-79)"] += 1
        else:
            asset_health["Degraded (<65)"] += 1

    return {
        "period_days": days,
        "workload_by_department": workload_by_dept,
        "workload_by_asset_type": workload_by_asset_type,
        "priority_distribution": priority_distribution,
        "block_utilization": block_utilization,
        "conflicts_by_type": conf_by_type,
        "execution_status_distribution": [{"status": k, "count": v} for k, v in exec_status_counts.items()],
        "planned_vs_actual_samples": planned_vs_actual,
        "average_delay_minutes": avg_delay,
        "asset_health_distribution": [{"band": k, "count": v} for k, v in asset_health.items()]
    }
