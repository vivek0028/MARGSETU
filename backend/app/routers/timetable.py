import io
import csv
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import TrainMovement, TimetableEntry, AuditLog

router = APIRouter(prefix="/api/timetable", tags=["Train Timetable & Movement Control"])
movements_alias_router = APIRouter(prefix="/api/train-movements", tags=["Train Timetable & Movement Control"])

# ============================================================================
# SCHEMAS
# ============================================================================

class TrainCreateRequest(BaseModel):
    train_no: str = Field(..., min_length=2, max_length=50)
    train_name: str = Field(..., min_length=2, max_length=100)
    train_type: str = Field(default="Express", description="Vande Bharat, Premium Express, Superfast, Freight, Passenger")
    origin: Optional[str] = "New Delhi (NDLS)"
    destination: Optional[str] = "Kanpur Central (CNB)"
    corridor: Optional[str] = "Mainline Corridor Alpha"
    section: str = Field(..., description="Section A-B, Section B-C, etc.")
    direction: str = Field(..., description="UP, DOWN")
    scheduled_departure: str = Field(..., description="ISO datetime string e.g. 2026-09-24T06:00:00Z")
    scheduled_arrival: str = Field(..., description="ISO datetime string e.g. 2026-09-24T08:30:00Z")
    priority_rank: Optional[int] = Field(default=2, ge=1, le=4)
    speed_kmph: Optional[float] = 100.0
    frequency: Optional[str] = "Daily"

class TrainUpdateRequest(BaseModel):
    train_name: Optional[str] = None
    train_type: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    corridor: Optional[str] = None
    section: Optional[str] = None
    direction: Optional[str] = None
    scheduled_departure: Optional[str] = None
    scheduled_arrival: Optional[str] = None
    priority_rank: Optional[int] = None
    speed_kmph: Optional[float] = None
    frequency: Optional[str] = None

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("")
@router.get("/trains")
@movements_alias_router.get("")
@movements_alias_router.get("/trains")
def list_train_timetable(
    section: Optional[str] = Query(None, description="Filter by section (e.g. Section A-B)"),
    direction: Optional[str] = Query(None, description="UP / DOWN"),
    train_type: Optional[str] = Query(None, description="Filter by train type"),
    search: Optional[str] = Query(None, description="Search train number or name"),
    db: Session = Depends(get_db)
):
    """Retrieve scheduled passenger and freight train movements."""
    query = db.query(TrainMovement)
    if section and section != "All":
        query = query.filter(TrainMovement.section == section)
    if direction and direction != "All":
        query = query.filter(TrainMovement.direction == direction)
    if train_type and train_type != "All":
        query = query.filter(TrainMovement.train_type == train_type)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (TrainMovement.train_no.ilike(s)) |
            (TrainMovement.train_name.ilike(s))
        )

    trains = query.order_by(TrainMovement.scheduled_departure.asc()).all()
    return trains


@router.get("/{train_no}")
@movements_alias_router.get("/{train_no}")
def get_train_by_no(train_no: str, db: Session = Depends(get_db)):
    """Fetch train schedule details along with station timetable entries."""
    train = db.query(TrainMovement).filter(TrainMovement.train_no == train_no).first()
    if not train:
        raise HTTPException(status_code=404, detail=f"Train '{train_no}' not found in timetable.")

    entries = db.query(TimetableEntry).filter(TimetableEntry.train_no == train_no).all()
    return {
        "train": train,
        "stops": entries
    }


@router.post("", status_code=status.HTTP_201_CREATED)
@movements_alias_router.post("", status_code=status.HTTP_201_CREATED)
def create_train(req: TrainCreateRequest, db: Session = Depends(get_db)):
    """Add a new train path to the operational timetable."""
    if db.query(TrainMovement).filter(TrainMovement.train_no == req.train_no).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Train number '{req.train_no}' already exists in timetable."
        )

    new_train = TrainMovement(
        train_no=req.train_no,
        train_name=req.train_name,
        train_type=req.train_type,
        origin=req.origin or "New Delhi (NDLS)",
        destination=req.destination or "Kanpur Central (CNB)",
        corridor=req.corridor or "Mainline Corridor Alpha",
        section=req.section,
        direction=req.direction,
        scheduled_departure=req.scheduled_departure,
        scheduled_arrival=req.scheduled_arrival,
        priority_rank=req.priority_rank or 2,
        speed_kmph=req.speed_kmph or 100.0,
        frequency=req.frequency or "Daily",
        data_label="DEMO DATA",
        created_at=datetime.utcnow()
    )
    db.add(new_train)

    db.add(AuditLog(
        user_name="Control Officer",
        user_role="CONTROL_OFFICER",
        action="TRAIN_ADDED",
        target_id=new_train.train_no,
        target_type="TRAIN",
        details=f"Added train {new_train.train_no} ({new_train.train_name}) on {new_train.section}."
    ))

    db.commit()
    db.refresh(new_train)
    return new_train


@router.put("/{train_no}")
@movements_alias_router.put("/{train_no}")
def update_train(train_no: str, req: TrainUpdateRequest, db: Session = Depends(get_db)):
    """Update train timetable information."""
    train = db.query(TrainMovement).filter(TrainMovement.train_no == train_no).first()
    if not train:
        raise HTTPException(status_code=404, detail="Train movement not found.")

    for field, val in req.model_dump(exclude_unset=True).items():
        setattr(train, field, val)

    db.add(AuditLog(
        user_name="Control Officer",
        user_role="CONTROL_OFFICER",
        action="TRAIN_UPDATED",
        target_id=train.train_no,
        target_type="TRAIN",
        details=f"Updated timetable schedule for train {train.train_no}."
    ))

    db.commit()
    db.refresh(train)
    return train


@router.delete("/{train_no}")
@movements_alias_router.delete("/{train_no}")
def delete_train(train_no: str, db: Session = Depends(get_db)):
    """Remove a train schedule from the timetable."""
    train = db.query(TrainMovement).filter(TrainMovement.train_no == train_no).first()
    if not train:
        raise HTTPException(status_code=404, detail="Train movement not found.")

    db.delete(train)
    db.add(AuditLog(
        user_name="Control Officer",
        user_role="CONTROL_OFFICER",
        action="TRAIN_DELETED",
        target_id=train_no,
        target_type="TRAIN",
        details=f"Cancelled and deleted train schedule {train_no}."
    ))
    db.commit()
    return {"status": "success", "message": f"Train {train_no} deleted."}


@router.post("/import-csv")
def import_timetable_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Import train timetable entries via CSV file.
    Validates headers and row values before persisting to PostgreSQL.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files (.csv) are accepted.")

    contents = file.file.read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(contents))

    required_headers = {"train_no", "train_name", "train_type", "section", "direction", "scheduled_departure", "scheduled_arrival"}
    if not required_headers.issubset(set(reader.fieldnames or [])):
        missing = required_headers - set(reader.fieldnames or [])
        raise HTTPException(
            status_code=400,
            detail=f"CSV missing mandatory columns: {', '.join(missing)}"
        )

    imported_count = 0
    errors = []

    for idx, row in enumerate(reader, start=1):
        try:
            t_no = row["train_no"].strip()
            if not t_no:
                continue

            existing = db.query(TrainMovement).filter(TrainMovement.train_no == t_no).first()
            if existing:
                existing.train_name = row.get("train_name", existing.train_name)
                existing.train_type = row.get("train_type", existing.train_type)
                existing.section = row.get("section", existing.section)
                existing.direction = row.get("direction", existing.direction)
                existing.scheduled_departure = row.get("scheduled_departure", existing.scheduled_departure)
                existing.scheduled_arrival = row.get("scheduled_arrival", existing.scheduled_arrival)
            else:
                train = TrainMovement(
                    train_no=t_no,
                    train_name=row.get("train_name", "Express Rake"),
                    train_type=row.get("train_type", "Superfast"),
                    origin=row.get("origin", "New Delhi (NDLS)"),
                    destination=row.get("destination", "Kanpur Central (CNB)"),
                    corridor=row.get("corridor", "Mainline Corridor Alpha"),
                    section=row.get("section", "Section A-B"),
                    direction=row.get("direction", "UP"),
                    scheduled_departure=row.get("scheduled_departure"),
                    scheduled_arrival=row.get("scheduled_arrival"),
                    priority_rank=int(row.get("priority_rank", 2)),
                    speed_kmph=float(row.get("speed_kmph", 100.0)),
                    frequency=row.get("frequency", "Daily"),
                    data_label="DEMO DATA"
                )
                db.add(train)
            imported_count += 1
        except Exception as e:
            errors.append(f"Row {idx}: {str(e)}")

    db.add(AuditLog(
        user_name="Control Officer",
        user_role="CONTROL_OFFICER",
        action="TIMETABLE_IMPORTED",
        target_id="CSV_UPLOAD",
        target_type="TIMETABLE",
        details=f"Imported/updated {imported_count} train paths via CSV upload."
    ))

    db.commit()
    return {
        "status": "success",
        "imported_count": imported_count,
        "errors": errors[:5] if errors else []
    }
