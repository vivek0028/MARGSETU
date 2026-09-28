import json
from pathlib import Path
from typing import Dict, Any, List
from app.adapters.bdms_adapter import get_data_dir

class COAAdapter:
    """
    Mock adapter for Control Office Application (COA).
    Provides train timetable schedules, section occupation, and path availability constraints.
    NOTE: Uses synthetic demo data only. Does NOT connect to live Indian Railways COA.
    """
    SOURCE_NAME = "COA"
    FULL_NAME = "Control Office Application"
    SYSTEM_TYPE = "Section Train Movement & Corridor Operational Timetable"

    def __init__(self):
        self.movements_path = get_data_dir() / "train_movements.json"
        self.blocks_path = get_data_dir() / "block_windows.json"

    def load_timetable_constraints(self) -> Dict[str, Any]:
        trains: List[Dict[str, Any]] = []
        if self.movements_path.exists():
            with open(self.movements_path, "r", encoding="utf-8") as f:
                trains = json.load(f)

        windows: List[Dict[str, Any]] = []
        if self.blocks_path.exists():
            with open(self.blocks_path, "r", encoding="utf-8") as f:
                windows = json.load(f)

        metadata = {
            "source": self.SOURCE_NAME,
            "full_name": self.FULL_NAME,
            "status": "Connected (Demo Mode)",
            "record_count": len(trains) + len(windows),
            "train_count": len(trains),
            "window_count": len(windows),
            "last_sync": "2026-09-17T10:15:00",
            "is_live_connection": False,
            "disclaimer": "Synthetic train paths and block windows for demo purposes only."
        }
        return {
            "metadata": metadata,
            "train_movements": trains,
            "block_windows": windows
        }
