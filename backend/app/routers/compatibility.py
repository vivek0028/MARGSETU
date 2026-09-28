from typing import List, Dict, Any
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.compatibility_engine import analyse_task_compatibility

router = APIRouter(prefix="/api/compatibility", tags=["Task Compatibility & Bundling"])

@router.get("", status_code=status.HTTP_200_OK)
@router.get("/analyse", status_code=status.HTTP_200_OK)
@router.post("/analyse", status_code=status.HTTP_200_OK)
def get_compatibility_analysis(db: Session = Depends(get_db)):
    """
    Analyzes cross-departmental compatibility and identifies candidate tasks for joint maintenance blocks.
    """
    bundles = analyse_task_compatibility(db)
    return {
        "status": "success",
        "bundles_identified_count": len(bundles),
        "bundles": bundles,
        "disclaimer": "AI-Assisted Task Bundling Recommendation | Subject to Divisional Joint Coordination Review"
    }
