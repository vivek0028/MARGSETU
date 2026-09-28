from typing import List, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import (
    MaintenanceTask,
    Asset,
    SchedulePlan,
    Conflict,
    TrainMovement,
    BlockWindow
)

router = APIRouter(prefix="/api/search", tags=["Global Operational Search"])

@router.get("")
def global_search(
    q: str = Query(..., min_length=2, description="Search query string"),
    db: Session = Depends(get_db)
):
    """
    Global search across Maintenance Requests, Assets, Plans, Conflicts, Trains, and Block Windows.
    Returns grouped results for fast navigation.
    """
    s = f"%{q.strip()}%"

    # 1. Maintenance Tasks
    tasks = db.query(MaintenanceTask).filter(
        (MaintenanceTask.task_id.ilike(s)) |
        (MaintenanceTask.task_title.ilike(s)) |
        (MaintenanceTask.description.ilike(s)) |
        (MaintenanceTask.location.ilike(s))
    ).limit(5).all()

    # 2. Assets
    assets = db.query(Asset).filter(
        (Asset.id.ilike(s)) |
        (Asset.asset_code.ilike(s)) |
        (Asset.asset_name.ilike(s)) |
        (Asset.location.ilike(s))
    ).limit(5).all()

    # 3. Plans
    plans = db.query(SchedulePlan).filter(
        (SchedulePlan.plan_id.ilike(s)) |
        (SchedulePlan.plan_name.ilike(s))
    ).limit(5).all()

    # 4. Conflicts
    conflicts = db.query(Conflict).filter(
        (Conflict.conflict_id.ilike(s)) |
        (Conflict.explanation.ilike(s))
    ).limit(5).all()

    # 5. Trains
    trains = db.query(TrainMovement).filter(
        (TrainMovement.train_no.ilike(s)) |
        (TrainMovement.train_name.ilike(s))
    ).limit(5).all()

    # 6. Block Windows
    blocks = db.query(BlockWindow).filter(
        (BlockWindow.block_id.ilike(s)) |
        (BlockWindow.section.ilike(s))
    ).limit(5).all()

    total_matches = len(tasks) + len(assets) + len(plans) + len(conflicts) + len(trains) + len(blocks)

    return {
        "query": q,
        "total_matches": total_matches,
        "total_results": total_matches,
        "results": {
            "maintenance": [
                {
                    "id": t.task_id,
                    "title": t.task_title or t.description[:35],
                    "subtitle": f"{t.department} • {t.location} • Score: {t.priority_score}",
                    "link": f"/maintenance"
                }
                for t in tasks
            ],
            "assets": [
                {
                    "id": a.id,
                    "title": a.asset_name,
                    "subtitle": f"{a.asset_code} • {a.asset_type} • Condition: {a.condition_score}",
                    "link": f"/assets/{a.id}"
                }
                for a in assets
            ],
            "plans": [
                {
                    "id": p.plan_id,
                    "title": p.plan_name,
                    "subtitle": f"Status: {p.status} • Tasks: {p.scheduled_count}",
                    "link": f"/optimizer"
                }
                for p in plans
            ],
            "conflicts": [
                {
                    "id": c.conflict_id,
                    "title": f"{c.conflict_type} Conflict ({c.severity})",
                    "subtitle": c.explanation[:45] + "...",
                    "link": f"/conflicts"
                }
                for c in conflicts
            ],
            "trains": [
                {
                    "id": tr.train_no,
                    "title": f"Train {tr.train_no} — {tr.train_name}",
                    "subtitle": f"{tr.train_type} • {tr.section} ({tr.direction})",
                    "link": f"/timetable"
                }
                for tr in trains
            ],
            "blocks": [
                {
                    "id": b.block_id,
                    "title": f"Block {b.block_id} ({b.section})",
                    "subtitle": f"{b.date} {b.start_time}-{b.end_time} • {b.status}",
                    "link": f"/block-windows"
                }
                for b in blocks
            ]
        }
    }
