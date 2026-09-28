from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Department, Asset, MaintenanceTask, Resource

router = APIRouter(prefix="/api/departments", tags=["Divisional Departments"])

@router.get("")
def list_departments(db: Session = Depends(get_db)):
    """List all official Indian Railways departments configured in the division."""
    depts = db.query(Department).all()
    res = []
    for d in depts:
        assets_c = db.query(Asset).filter(Asset.department.ilike(f"%{d.code}%")).count()
        tasks_c = db.query(MaintenanceTask).filter(MaintenanceTask.department.ilike(f"%{d.code}%")).count()
        res_c = db.query(Resource).filter(Resource.department.ilike(f"%{d.code}%")).count()
        res.append({
            "id": d.id,
            "code": d.code,
            "name": d.name,
            "head_name": d.head_name,
            "contact_email": d.contact_email,
            "description": d.description,
            "assets_count": assets_c,
            "tasks_count": tasks_c,
            "resources_count": res_c
        })
    return res


@router.get("/{dept_id}")
def get_department_detail(dept_id: str, db: Session = Depends(get_db)):
    """Fetch department detail with asset, task, and resource counts."""
    dept = db.query(Department).filter((Department.id == dept_id) | (Department.code == dept_id)).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")

    assets = db.query(Asset).filter(Asset.department.ilike(f"%{dept.code}%")).limit(10).all()
    tasks = db.query(MaintenanceTask).filter(MaintenanceTask.department.ilike(f"%{dept.code}%")).limit(10).all()

    return {
        "department": dept,
        "sample_assets": assets,
        "sample_tasks": tasks
    }
