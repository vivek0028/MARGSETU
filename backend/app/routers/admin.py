from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.models import (
    User,
    Department,
    SystemSetting,
    AuditLog,
    MaintenanceTask,
    Asset,
    BlockWindow,
    Conflict,
    SchedulePlan
)
from app.services.priority_engine import DEFAULT_PRIORITY_WEIGHTS, recalculate_all_priorities

router = APIRouter(prefix="/api/admin", tags=["Administration Console"])

# ============================================================================
# SCHEMAS
# ============================================================================

class PriorityWeightsUpdate(BaseModel):
    criticality_weight: float = Field(..., ge=0, le=50)
    urgency_weight: float = Field(..., ge=0, le=50)
    overdue_weight: float = Field(..., ge=0, le=50)
    defect_weight: float = Field(..., ge=0, le=50)
    operational_impact_weight: float = Field(..., ge=0, le=50)

class UserRoleUpdate(BaseModel):
    role: str = Field(..., description="ADMIN, PLANNER, CONTROL_OFFICER, ENGINEERING, TRD, SIGNAL_TELECOM, OPERATIONS")
    is_active: Optional[bool] = None

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/users")
def list_system_users(db: Session = Depends(get_db)):
    """List all registered personnel accounts with roles and active statuses."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "employee_id": u.employee_id,
            "department": u.department,
            "designation": u.designation,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None
        }
        for u in users
    ]


@router.put("/users/{user_id}/status")
def update_user_status(user_id: str, req: UserRoleUpdate, db: Session = Depends(get_db)):
    """Update role or active/inactive state of a user account."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    old_role = user.role
    user.role = req.role
    if req.is_active is not None:
        user.is_active = req.is_active

    db.add(AuditLog(
        user_name="Divisional Admin",
        user_role="ADMIN",
        action="USER_ROLE_CHANGED",
        target_id=user.id,
        target_type="USER",
        details=f"Updated role for {user.name} to {req.role}. Active: {user.is_active}.",
        status_change=f"{old_role} -> {req.role}"
    ))

    db.commit()
    db.refresh(user)
    return {
        "status": "success",
        "user_id": user.id,
        "name": user.name,
        "role": user.role,
        "is_active": user.is_active
    }


@router.get("/settings/priority-weights")
def get_priority_weights(db: Session = Depends(get_db)):
    """Retrieve active weights for the AI-assisted priority scoring engine."""
    setting = db.query(SystemSetting).filter(SystemSetting.key == "priority_weights").first()
    if setting and isinstance(setting.value, dict):
        return setting.value
    return DEFAULT_PRIORITY_WEIGHTS


@router.put("/settings/priority-weights")
def update_priority_weights(req: PriorityWeightsUpdate, db: Session = Depends(get_db)):
    """
    Configure weights for the priority scoring engine.
    Optionally triggers recalculation across all active maintenance tasks.
    """
    total = req.criticality_weight + req.urgency_weight + req.overdue_weight + req.defect_weight + req.operational_impact_weight
    if round(total, 1) != 100.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Priority weights must sum to exactly 100.0. Current sum: {total}"
        )

    new_weights = req.model_dump()
    setting = db.query(SystemSetting).filter(SystemSetting.key == "priority_weights").first()
    if setting:
        setting.value = new_weights
        setting.updated_at = datetime.utcnow()
    else:
        setting = SystemSetting(
            key="priority_weights",
            category="priority_weights",
            value=new_weights,
            description="Configured weights for AI-assisted rule-based priority engine."
        )
        db.add(setting)

    # Recalculate tasks automatically with new weights
    recalc_result = recalculate_all_priorities(db)

    db.add(AuditLog(
        user_name="Divisional Admin",
        user_role="ADMIN",
        action="PRIORITY_WEIGHTS_UPDATED",
        target_id="SETTINGS",
        target_type="SYSTEM",
        details=f"Updated priority weights: Criticality={req.criticality_weight}, Urgency={req.urgency_weight}, Overdue={req.overdue_weight}, Defect={req.defect_weight}, Impact={req.operational_impact_weight}."
    ))

    db.commit()
    return {
        "status": "success",
        "weights": new_weights,
        "tasks_recalculated": recalc_result["tasks_recalculated"]
    }


@router.post("/priority-weights")
@router.put("/priority-weights")
def update_priority_weights_flexible(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Flexible endpoint supporting both schema formats for dynamic weight tuning."""
    crit = float(payload.get("criticality_weight", payload.get("criticality", 30)))
    urg = float(payload.get("urgency_weight", payload.get("deadline_urgency", payload.get("urgency", 25))))
    overdue = float(payload.get("overdue_weight", payload.get("age_overdue", payload.get("overdue", 15))))
    defect = float(payload.get("defect_weight", payload.get("defect_severity", payload.get("defect", 15))))
    impact = float(payload.get("operational_impact_weight", payload.get("operational_impact", payload.get("impact", 15))))

    new_weights = {
        "criticality_weight": crit,
        "urgency_weight": urg,
        "overdue_weight": overdue,
        "defect_weight": defect,
        "operational_impact_weight": impact
    }

    setting = db.query(SystemSetting).filter(SystemSetting.key == "priority_weights").first()
    if setting:
        setting.value = new_weights
        setting.updated_at = datetime.utcnow()
    else:
        setting = SystemSetting(
            key="priority_weights",
            category="priority_weights",
            value=new_weights,
            description="Configured weights for AI-assisted rule-based priority engine."
        )
        db.add(setting)

    recalc_result = recalculate_all_priorities(db)
    db.commit()
    return {
        "status": "success",
        "weights": new_weights,
        "tasks_recalculated": recalc_result.get("tasks_recalculated", 0)
    }



@router.get("/system-health")
def get_system_health(db: Session = Depends(get_db)):
    """Return database metrics, entity counts, and solver status."""
    return {
        "status": "healthy",
        "platform": "RailOptiBlock Enterprise 1.0",
        "database": "PostgreSQL 18 (Source of Truth)",
        "solver": "Google OR-Tools CP-SAT (Active)",
        "counts": {
            "users": db.query(User).count(),
            "departments": db.query(Department).count(),
            "assets": db.query(Asset).count(),
            "maintenance_tasks": db.query(MaintenanceTask).count(),
            "block_windows": db.query(BlockWindow).count(),
            "conflicts": db.query(Conflict).count(),
            "plans": db.query(SchedulePlan).count(),
            "audit_logs": db.query(AuditLog).count()
        },
        "server_time": datetime.utcnow().isoformat()
    }
