from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import TrainMovement
from app.schemas.schemas import TrainMovementResponse

router = APIRouter(prefix="/api/train-movements", tags=["Train Movements"])

@router.get("", response_model=List[TrainMovementResponse])
def get_all_train_movements(
    section: Optional[str] = Query(None, description="Filter by section (e.g. Section A-B)"),
    direction: Optional[str] = Query(None, description="Filter by direction (UP / DOWN)"),
    train_type: Optional[str] = Query(None, description="Filter by train type (Premium Express, Freight, etc.)"),
    db: Session = Depends(get_db)
):
    query = db.query(TrainMovement)
    if section:
        query = query.filter(TrainMovement.section == section)
    if direction:
        query = query.filter(TrainMovement.direction == direction)
    if train_type:
        query = query.filter(TrainMovement.train_type == train_type)
    return query.order_by(TrainMovement.scheduled_departure.asc()).all()
