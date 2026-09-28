from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.priority_engine import recalculate_all_priorities

router = APIRouter(prefix="/api/priority", tags=["Priority Scoring"])

@router.post("/recalculate", status_code=status.HTTP_200_OK)
def recalculate_task_priorities(db: Session = Depends(get_db)):
    """
    Recalculates deterministic priority scores for all maintenance tasks across the network.
    """
    res = recalculate_all_priorities(db)
    return res
