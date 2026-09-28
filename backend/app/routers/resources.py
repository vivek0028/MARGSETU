from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Resource
from app.schemas.schemas import ResourceResponse

router = APIRouter(prefix="/api/resources", tags=["Resources"])

@router.get("", response_model=List[ResourceResponse])
def get_all_resources(
    department: Optional[str] = Query(None, description="Filter by department"),
    available_only: Optional[bool] = Query(None, description="Filter available resources only"),
    db: Session = Depends(get_db)
):
    query = db.query(Resource)
    if department:
        query = query.filter(Resource.department == department)
    if available_only is not None:
        query = query.filter(Resource.available == available_only)
    return query.order_by(Resource.resource_id.asc()).all()
