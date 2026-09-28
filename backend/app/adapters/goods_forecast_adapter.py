from typing import Dict, Any, List

class GoodsForecastAdapter:
    """
    Mock adapter for Freight Operations Information System (FOIS) / Goods Forecast.
    Feeds anticipated freight traffic patterns and coal/container rake movements.
    NOTE: Uses synthetic demo data only. Does NOT connect to live Indian Railways FOIS.
    """
    SOURCE_NAME = "GOODS_FORECAST"
    FULL_NAME = "Freight Operations Information System (Goods Forecast)"
    SYSTEM_TYPE = "Freight Traffic Flow & Corridor Demand Forecasting"

    def load_goods_forecast(self) -> Dict[str, Any]:
        records: List[Dict[str, Any]] = [
            {
                "forecast_id": "GFC-01",
                "section": "Section B-C",
                "traffic_type": "Thermal Coal Freight",
                "expected_density": "High",
                "priority_window_gap": "11:30 - 13:30",
                "remarks": "Critical thermal plant supply rake movement",
                "data_label": "DEMO DATA"
            },
            {
                "forecast_id": "GFC-02",
                "section": "Section C-D",
                "traffic_type": "CONCOR Double Stack Containers",
                "expected_density": "Moderate",
                "priority_window_gap": "10:30 - 13:00",
                "remarks": "Export container cargo priority",
                "data_label": "DEMO DATA"
            }
        ]
        metadata = {
            "source": self.SOURCE_NAME,
            "full_name": self.FULL_NAME,
            "status": "Connected (Demo Mode)",
            "record_count": len(records),
            "last_sync": "2026-09-17T10:20:00",
            "is_live_connection": False,
            "disclaimer": "Synthetic freight traffic forecast for demo purposes only."
        }
        return {"metadata": metadata, "records": records}
