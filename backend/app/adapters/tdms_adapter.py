import json
from pathlib import Path
from typing import Dict, Any, List
from app.adapters.bdms_adapter import get_data_dir

class TDMSAdapter:
    """
    Mock adapter for Traction Distribution Maintenance System (TDMS).
    Feeds OHE catenary, power feeding, insulator washing, and substation maintenance blocks.
    NOTE: Uses synthetic demo data only. Does NOT connect to live Indian Railways TDMS.
    """
    SOURCE_NAME = "TDMS"
    FULL_NAME = "Traction Distribution Maintenance System"
    SYSTEM_TYPE = "Overhead Equipment (OHE) & Traction Substations"

    def __init__(self):
        self.data_path = get_data_dir() / "maintenance_tasks.json"

    def load_tdms_tasks(self) -> Dict[str, Any]:
        records: List[Dict[str, Any]] = []
        if self.data_path.exists():
            with open(self.data_path, "r", encoding="utf-8") as f:
                raw_data = json.load(f)
                for item in raw_data:
                    if item.get("department") == "Traction":
                        record = {
                            "task_id": item["task_id"],
                            "department": "Traction",
                            "asset_type": item["asset_type"],
                            "location": item["location"],
                            "description": item["description"],
                            "duration_hours": float(item["duration_hours"]),
                            "preferred_date": item["preferred_date"],
                            "deadline": item["deadline"],
                            "criticality": item["criticality"],
                            "overdue": bool(item.get("overdue", False)),
                            "required_resources": item.get("required_resources", []),
                            "dependencies": item.get("dependencies", []),
                            "compatible_departments": item.get("compatible_departments", []),
                            "status": item.get("status", "Pending"),
                            "data_source": self.SOURCE_NAME,
                            "data_label": "DEMO DATA"
                        }
                        records.append(record)

        metadata = {
            "source": self.SOURCE_NAME,
            "full_name": self.FULL_NAME,
            "status": "Connected (Demo Mode)",
            "record_count": len(records),
            "last_sync": "2026-09-17T09:50:00",
            "is_live_connection": False,
            "disclaimer": "Synthetic traction electrification records for demo purposes only."
        }
        return {"metadata": metadata, "records": records}
