import uuid
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import BlockWindow, AuditLog
from app.services.optimizer import parse_hour, intervals_overlap

router = APIRouter(prefix="/api/block-windows", tags=["Block Windows & Corridor Capacity"])

# ============================================================================
# SCHEMAS
# ============================================================================

class BlockWindowCreate(BaseModel):
    block_id: Optional[str] = None
    corridor: Optional[str] = "Mainline Corridor Alpha"
    section: str = Field(..., description="Section A-B, Section B-C, etc.")
    direction: Optional[str] = Field(default="BOTH", description="UP, DOWN, BOTH")
    date: str = Field(..., description="YYYY-MM-DD")
    start_time: str = Field(..., description="HH:MM:SS or HH:MM")
    end_time: str = Field(..., description="HH:MM:SS or HH:MM")
    max_duration_hours: Optional[float] = None
    block_type: Optional[str] = "Routine Shadow Block"
    allowed_departments: Optional[List[str]] = Field(default_factory=lambda: ["Engineering", "S&T", "TRD", "Operations"])
    status: Optional[str] = "Available"
    reason: Optional[str] = "Scheduled corridor maintenance window."

class BlockWindowUpdate(BaseModel):
    corridor: Optional[str] = None
    section: Optional[str] = None
    direction: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    max_duration_hours: Optional[float] = None
    block_type: Optional[str] = None
    allowed_departments: Optional[List[str]] = None
    status: Optional[str] = None
    reason: Optional[str] = None

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("")
def list_block_windows(
    section: Optional[str] = Query(None, description="Filter by section (e.g. Section A-B)"),
    corridor: Optional[str] = Query(None, description="Filter by corridor"),
    date: Optional[str] = Query(None, description="Filter by date (YYYY-MM-DD)"),
    status: Optional[str] = Query(None, description="Filter by status (Available, Reserved, Allocated, Completed, Cancelled)"),
    department: Optional[str] = Query(None, description="Filter by department"),
    db: Session = Depends(get_db)
):
    """Retrieve list of scheduled railway corridor traffic and power block windows."""
    query = db.query(BlockWindow)
    if section and section != "All":
        query = query.filter(BlockWindow.section == section)
    if corridor and corridor != "All":
        query = query.filter(BlockWindow.corridor == corridor)
    if date and date != "All":
        query = query.filter(BlockWindow.date == date)
    if status and status != "All":
        query = query.filter(BlockWindow.status == status)

    windows = query.order_by(BlockWindow.date.asc(), BlockWindow.start_time.asc()).all()

    # If department filter requested, filter in-memory since allowed_departments is JSON
    if department and department != "All":
        windows = [w for w in windows if not w.allowed_departments or department in w.allowed_departments]

    return windows


@router.get("/{block_id}")
def get_block_window_by_id(block_id: str, db: Session = Depends(get_db)):
    """Fetch details for a specific block window."""
    block = db.query(BlockWindow).filter(BlockWindow.block_id == block_id).first()
    if not block:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Block window '{block_id}' not found."
        )
    return block


@router.post("", status_code=status.HTTP_201_CREATED)
def create_block_window(req: BlockWindowCreate, db: Session = Depends(get_db)):
    """
    Create a new block window with strict backend overlap collision prevention.
    Rejects overlapping windows on the same corridor, section, date, and direction.
    """
    b_id = req.block_id or f"BLK-{uuid.uuid4().hex[:6].upper()}"

    # Verify ID is unique
    if db.query(BlockWindow).filter(BlockWindow.block_id == b_id).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Block ID '{b_id}' already exists."
        )

    # Format times with seconds if missing
    s_time = req.start_time if len(req.start_time.split(":")) == 3 else f"{req.start_time}:00"
    e_time = req.end_time if len(req.end_time.split(":")) == 3 else f"{req.end_time}:00"

    try:
        new_start_h = parse_hour(s_time)
        new_end_h = parse_hour(e_time)
        if new_end_h <= new_start_h:
            # Handle crossing midnight, e.g. 23:30 to 03:30
            duration = (24.0 - new_start_h) + new_end_h
        else:
            duration = new_end_h - new_start_h
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid time format. Expected HH:MM:SS.")

    max_dur = req.max_duration_hours or round(duration, 2)

    # Overlap Validation (Collision Prevention)
    existing_blocks = db.query(BlockWindow).filter(
        BlockWindow.date == req.date,
        BlockWindow.section == req.section,
        BlockWindow.status != "Cancelled"
    ).all()

    for eb in existing_blocks:
        eb_s = parse_hour(eb.start_time)
        eb_e = parse_hour(eb.end_time)
        eb_e_adj = eb_e if eb_e > eb_s else eb_e + 24.0
        new_e_adj = new_end_h if new_end_h > new_start_h else new_end_h + 24.0

        if intervals_overlap(new_start_h, new_e_adj, eb_s, eb_e_adj):
            # Check direction conflict
            if req.direction == "BOTH" or eb.direction == "BOTH" or req.direction == eb.direction:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Block collision detected! Window overlaps with existing active block "
                        f"'{eb.block_id}' ({eb.start_time} - {eb.end_time}) on {eb.section} ({eb.date})."
                    )
                )

    new_block = BlockWindow(
        block_id=b_id,
        corridor=req.corridor or "Mainline Corridor Alpha",
        corridor_name=req.corridor or "Mainline Corridor Alpha",
        section=req.section,
        direction=req.direction or "BOTH",
        date=req.date,
        start_time=s_time,
        end_time=e_time,
        max_duration_hours=max_dur,
        block_type=req.block_type or "Routine Shadow Block",
        allowed_departments=req.allowed_departments or ["Engineering", "S&T", "TRD", "Operations"],
        status=req.status or "Available",
        reason=req.reason,
        data_label="DEMO DATA",
        created_at=datetime.utcnow()
    )
    db.add(new_block)

    # Audit log
    db.add(AuditLog(
        user_name="Control Officer",
        user_role="CONTROL_OFFICER",
        action="BLOCK_WINDOW_CREATED",
        target_id=new_block.block_id,
        target_type="BLOCK",
        details=f"Created block window {new_block.block_id} on {new_block.section} ({new_block.date} {new_block.start_time}-{new_block.end_time})."
    ))

    db.commit()
    db.refresh(new_block)
    return new_block


@router.put("/{block_id}")
def update_block_window(block_id: str, req: BlockWindowUpdate, db: Session = Depends(get_db)):
    """Update an existing block window with collision validation."""
    block = db.query(BlockWindow).filter(BlockWindow.block_id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block window not found.")

    update_dict = req.model_dump(exclude_unset=True)

    # Check for overlap if times or dates changed
    chk_date = update_dict.get("date", block.date)
    chk_sec = update_dict.get("section", block.section)
    chk_s = update_dict.get("start_time", block.start_time)
    chk_e = update_dict.get("end_time", block.end_time)
    chk_dir = update_dict.get("direction", block.direction)

    s_time = chk_s if len(chk_s.split(":")) == 3 else f"{chk_s}:00"
    e_time = chk_e if len(chk_e.split(":")) == 3 else f"{chk_e}:00"

    new_start_h = parse_hour(s_time)
    new_end_h = parse_hour(e_time)
    new_e_adj = new_end_h if new_end_h > new_start_h else new_end_h + 24.0

    existing_blocks = db.query(BlockWindow).filter(
        BlockWindow.date == chk_date,
        BlockWindow.section == chk_sec,
        BlockWindow.block_id != block_id,
        BlockWindow.status != "Cancelled"
    ).all()

    for eb in existing_blocks:
        eb_s = parse_hour(eb.start_time)
        eb_e = parse_hour(eb.end_time)
        eb_e_adj = eb_e if eb_e > eb_s else eb_e + 24.0

        if intervals_overlap(new_start_h, new_e_adj, eb_s, eb_e_adj):
            if chk_dir == "BOTH" or eb.direction == "BOTH" or chk_dir == eb.direction:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Update failed: Overlaps with existing block '{eb.block_id}' ({eb.start_time} - {eb.end_time})."
                )

    for field, val in update_dict.items():
        setattr(block, field, val)

    db.add(AuditLog(
        user_name="Control Officer",
        user_role="CONTROL_OFFICER",
        action="BLOCK_WINDOW_UPDATED",
        target_id=block.block_id,
        target_type="BLOCK",
        details=f"Updated block window {block.block_id}. Status: {block.status}."
    ))

    db.commit()
    db.refresh(block)
    return block


@router.delete("/{block_id}")
def delete_block_window(block_id: str, db: Session = Depends(get_db)):
    """Delete a block window or cancel it if already linked."""
    block = db.query(BlockWindow).filter(BlockWindow.block_id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block window not found.")

    db.delete(block)
    db.add(AuditLog(
        user_name="Control Officer",
        user_role="CONTROL_OFFICER",
        action="BLOCK_WINDOW_DELETED",
        target_id=block_id,
        target_type="BLOCK",
        details=f"Deleted block window {block_id}."
    ))
    db.commit()
    return {"status": "success", "message": f"Block window '{block_id}' deleted."}
