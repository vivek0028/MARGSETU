from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import AuditLog
from app.schemas.schemas import AuditLogResponse

router = APIRouter(prefix="/api/audit-logs", tags=["Append-Only Audit Trail"])

@router.get("", response_model=List[AuditLogResponse])
def get_audit_logs(
    target_type: Optional[str] = Query(None, description="Filter by target type (TASK, PLAN, CONFLICT, SYSTEM)"),
    user_role: Optional[str] = Query(None, description="Filter by user role (Planner, Reviewer, Administrator)"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """
    Append-Only Audit Trail: The audit trail records approval and workflow events for the prototype.
    """
    query = db.query(AuditLog)
    if target_type:
        query = query.filter(AuditLog.target_type == target_type)
    if user_role:
        query = query.filter(AuditLog.user_role == user_role)
    return query.order_by(AuditLog.timestamp.desc()).limit(limit).all()

# Alias router for /api/audit -> Append-Only Audit Trail
audit_alias_router = APIRouter(prefix="/api/audit", tags=["Append-Only Audit Trail"])

@audit_alias_router.get("", response_model=List[AuditLogResponse])
def get_audit_alias(
    target_type: Optional[str] = Query(None, description="Filter by target type (TASK, PLAN, CONFLICT, SYSTEM)"),
    user_role: Optional[str] = Query(None, description="Filter by user role (Planner, Reviewer, Administrator)"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    return get_audit_logs(target_type, user_role, limit, db)

