from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import DataSource
from app.schemas.schemas import DataSourceResponse
from app.adapters.bdms_adapter import BDMSAdapter
from app.adapters.tms_adapter import TMSAdapter
from app.adapters.smms_adapter import SMMSAdapter
from app.adapters.tdms_adapter import TDMSAdapter
from app.adapters.coa_adapter import COAAdapter
from app.adapters.goods_forecast_adapter import GoodsForecastAdapter

router = APIRouter(prefix="/api/data-sources", tags=["Data Sources / Adapters"])

@router.get("", response_model=List[DataSourceResponse])
def get_data_sources(db: Session = Depends(get_db)):
    sources = db.query(DataSource).all()
    if not sources:
        # Fallback to direct adapter metadata if DB not yet seeded
        adapters = [
            BDMSAdapter(),
            TMSAdapter(),
            SMMSAdapter(),
            TDMSAdapter(),
            COAAdapter(),
            GoodsForecastAdapter()
        ]
        results = []
        for adp in adapters:
            meta = getattr(adp, "load_bdms_requests", getattr(adp, "load_tms_tasks", getattr(adp, "load_smms_tasks", getattr(adp, "load_tdms_tasks", getattr(adp, "load_timetable_constraints", getattr(adp, "load_goods_forecast", None))))))()
            m = meta["metadata"]
            results.append({
                "source_id": f"SRC-{m['source']}",
                "name": m["source"],
                "full_name": m["full_name"],
                "system_type": getattr(adp, "SYSTEM_TYPE", "Railway Information System"),
                "status": m["status"],
                "last_sync": m["last_sync"],
                "record_count": m["record_count"],
                "description": m["disclaimer"],
                "data_label": "DEMO DATA"
            })
        return results
    return sources
