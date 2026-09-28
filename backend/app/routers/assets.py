import uuid
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Asset, AssetDefect, MaintenanceTask, AuditLog, User
from app.services.auth_service import get_current_user_optional, require_roles

router = APIRouter(prefix="/api/assets", tags=["Asset Infrastructure Management"])

# ============================================================================
# SCHEMAS
# ============================================================================

class AssetCreateRequest(BaseModel):
    asset_code: Optional[str] = None
    asset_id: Optional[str] = None
    asset_name: str = Field(..., min_length=3, max_length=150)
    asset_type: str = Field(default="Track")
    department: str = Field(default="Engineering")
    corridor: Optional[str] = "Mainline Corridor Alpha"
    corridor_name: Optional[str] = None
    location: Optional[str] = None
    section: Optional[str] = None
    kilometer: Optional[str] = "KM 120.0 - 124.0"
    status: Optional[str] = "Operational"
    criticality: Optional[str] = "Medium"
    installation_date: Optional[str] = "2020-01-01"
    condition_score: Optional[float] = Field(default=85.0, ge=0, le=100)
    owner_department: Optional[str] = None

class AssetUpdateRequest(BaseModel):
    asset_name: Optional[str] = None
    asset_type: Optional[str] = None
    department: Optional[str] = None
    corridor: Optional[str] = None
    location: Optional[str] = None
    kilometer: Optional[str] = None
    status: Optional[str] = None
    criticality: Optional[str] = None
    condition_score: Optional[float] = Field(default=None, ge=0, le=100)
    last_maintenance: Optional[str] = None
    next_maintenance: Optional[str] = None

class DefectCreateRequest(BaseModel):
    defect_type: Optional[str] = "Track Flaw"
    severity: str = Field(default="Medium")
    description: str = Field(..., min_length=5)
    reported_by: Optional[str] = "Track Inspector"

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("")
def list_assets(
    department: Optional[str] = None,
    asset_type: Optional[str] = None,
    status: Optional[str] = None,
    location: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Retrieve filtered list of railway infrastructure assets."""
    query = db.query(Asset)

    if department and department != "All":
        query = query.filter(Asset.department == department)
    if asset_type and asset_type != "All":
        query = query.filter(Asset.asset_type == asset_type)
    if status and status != "All":
        query = query.filter(Asset.status == status)
    if location and location != "All":
        query = query.filter(Asset.location == location)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (Asset.asset_name.ilike(s)) |
            (Asset.asset_code.ilike(s)) |
            (Asset.kilometer.ilike(s))
        )

    assets = query.order_by(Asset.condition_score.asc()).limit(limit).all()

    return [
        {
            "id": a.id,
            "asset_code": a.asset_code,
            "asset_name": a.asset_name,
            "asset_type": a.asset_type,
            "department": a.department,
            "corridor": a.corridor,
            "location": a.location,
            "kilometer": a.kilometer,
            "status": a.status,
            "criticality": a.criticality,
            "installation_date": a.installation_date,
            "last_maintenance": a.last_maintenance,
            "next_maintenance": a.next_maintenance,
            "condition_score": a.condition_score,
            "defect_count": a.defect_count,
            "owner_department": a.owner_department
        }
        for a in assets
    ]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_asset(
    req: AssetCreateRequest,
    db: Session = Depends(get_db)
):
    """Create a new physical railway infrastructure asset."""
    code = (req.asset_code or req.asset_id or f"AST-{uuid.uuid4().hex[:6].upper()}").upper()
    loc = req.location or req.section or "Section A-B"
    corr = req.corridor_name or req.corridor or "Mainline Corridor Alpha"

    if db.query(Asset).filter(Asset.asset_code == code).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Asset with code '{code}' already exists."
        )

    new_id = req.asset_id or f"AST-{req.asset_type[:3].upper()}-{uuid.uuid4().hex[:6].upper()}"
    new_asset = Asset(
        id=new_id,
        asset_code=code,
        asset_name=req.asset_name,
        asset_type=req.asset_type,
        department=req.department,
        corridor=corr,
        location=loc,
        kilometer=req.kilometer,
        status=req.status or "Operational",
        criticality=req.criticality or "Medium",
        installation_date=req.installation_date,
        condition_score=req.condition_score if req.condition_score is not None else 85.0,
        owner_department=req.owner_department or req.department,
        defect_count=0
    )
    db.add(new_asset)

    db.add(AuditLog(
        user_name="System User",
        user_role="ENGINEERING",
        action="ASSET_CREATED",
        target_id=new_id,
        target_type="ASSET",
        details=f"Created new asset {new_asset.asset_code}: {new_asset.asset_name} in {new_asset.location}."
    ))

    db.commit()
    db.refresh(new_asset)

    return new_asset


@router.get("/{asset_id}")
def get_asset_detail(asset_id: str, db: Session = Depends(get_db)):
    """Fetch complete asset detail with condition history, defects, and maintenance requests."""
    asset = db.query(Asset).filter((Asset.id == asset_id) | (Asset.asset_code == asset_id)).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")

    defects = db.query(AssetDefect).filter(AssetDefect.asset_id == asset.id).order_by(AssetDefect.reported_at.desc()).all()
    tasks = db.query(MaintenanceTask).filter(
        (MaintenanceTask.asset_id == asset.id) |
        (MaintenanceTask.location == asset.location) & (MaintenanceTask.department == asset.department)
    ).limit(10).all()

    return {
        "asset": {
            "id": asset.id,
            "asset_code": asset.asset_code,
            "asset_name": asset.asset_name,
            "asset_type": asset.asset_type,
            "department": asset.department,
            "corridor": asset.corridor,
            "location": asset.location,
            "kilometer": asset.kilometer,
            "status": asset.status,
            "criticality": asset.criticality,
            "installation_date": asset.installation_date,
            "last_maintenance": asset.last_maintenance,
            "next_maintenance": asset.next_maintenance,
            "condition_score": asset.condition_score,
            "defect_count": len(defects),
            "owner_department": asset.owner_department
        },
        "defects": [
            {
                "id": d.id,
                "defect_type": d.defect_type,
                "severity": d.severity,
                "description": d.description,
                "reported_by": d.reported_by,
                "status": d.status,
                "reported_at": d.reported_at.isoformat() if d.reported_at else None
            }
            for d in defects
        ],
        "associated_tasks": [
            {
                "task_id": t.task_id,
                "task_title": t.task_title or t.description[:40],
                "department": t.department,
                "status": t.status,
                "priority_score": t.priority_score,
                "duration_hours": t.duration_hours,
                "preferred_date": t.preferred_date
            }
            for t in tasks
        ]
    }


@router.put("/{asset_id}")
def update_asset(
    asset_id: str,
    req: AssetUpdateRequest,
    db: Session = Depends(get_db)
):
    """Update asset condition, maintenance dates, or status."""
    asset = db.query(Asset).filter((Asset.id == asset_id) | (Asset.asset_code == asset_id)).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")

    old_data = {"status": asset.status, "condition_score": asset.condition_score}

    if req.asset_name: asset.asset_name = req.asset_name
    if req.asset_type: asset.asset_type = req.asset_type
    if req.department: asset.department = req.department
    if req.corridor: asset.corridor = req.corridor
    if req.location: asset.location = req.location
    if req.kilometer: asset.kilometer = req.kilometer
    if req.status: asset.status = req.status
    if req.criticality: asset.criticality = req.criticality
    if req.condition_score is not None: asset.condition_score = req.condition_score
    if req.last_maintenance: asset.last_maintenance = req.last_maintenance
    if req.next_maintenance: asset.next_maintenance = req.next_maintenance

    db.add(AuditLog(
        user_name="Operations Engineer",
        user_role="ENGINEERING",
        action="ASSET_UPDATED",
        target_id=asset.id,
        target_type="ASSET",
        details=f"Updated asset {asset.asset_code}. Condition score: {asset.condition_score}, status: {asset.status}.",
        old_value=old_data,
        new_value={"status": asset.status, "condition_score": asset.condition_score}
    ))

    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{asset_id}")
def delete_asset(asset_id: str, db: Session = Depends(get_db)):
    """Delete an asset from the registry."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")

    db.delete(asset)
    db.add(AuditLog(
        user_name="Divisional Admin",
        user_role="ADMIN",
        action="ASSET_DELETED",
        target_id=asset_id,
        target_type="ASSET",
        details=f"Decommissioned and deleted asset {asset.asset_code}."
    ))
    db.commit()
    return {"status": "success", "message": f"Asset {asset_id} deleted successfully."}


@router.post("/{asset_id}/defects", status_code=status.HTTP_201_CREATED)
def report_asset_defect(
    asset_id: str,
    req: DefectCreateRequest,
    db: Session = Depends(get_db)
):
    """Report a new defect on an asset."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")

    defect = AssetDefect(
        id=f"DEF-{uuid.uuid4().hex[:8].upper()}",
        asset_id=asset.id,
        defect_type=req.defect_type,
        severity=req.severity,
        description=req.description,
        reported_by=req.reported_by or "Inspector",
        status="Open",
        reported_at=datetime.utcnow()
    )
    db.add(defect)

    # Increment defect count and update asset condition
    asset.defect_count = (asset.defect_count or 0) + 1
    if req.severity == "Critical":
        asset.condition_score = max(40.0, (asset.condition_score or 80.0) - 15.0)
        asset.status = "Degraded"
        asset.criticality = "Critical"

    db.commit()
    db.refresh(defect)
    return defect


@router.get("/{asset_id}/defects")
def get_asset_defects(asset_id: str, db: Session = Depends(get_db)):
    """List all reported defects for a specific asset."""
    asset = db.query(Asset).filter((Asset.id == asset_id) | (Asset.asset_code == asset_id)).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found.")
    defects = db.query(AssetDefect).filter(AssetDefect.asset_id == asset.id).all()
    return defects
