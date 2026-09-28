from typing import Dict, Any, Tuple, Optional, Union
from sqlalchemy.orm import Session
from app.models.models import SystemSetting

DEFAULT_PRIORITY_WEIGHTS = {
    "criticality_weight": 25.0,
    "urgency_weight": 25.0,
    "overdue_weight": 20.0,
    "defect_weight": 15.0,
    "operational_impact_weight": 15.0
}

# Score factor mappings
CRITICALITY_MAP = {
    "Critical": 1.0,
    "High": 0.75,
    "Medium": 0.50,
    "Low": 0.25
}

URGENCY_MAP = {
    "Immediate": 1.0,
    "High": 0.75,
    "Normal": 0.50,
    "Medium": 0.50,
    "Low": 0.25
}

DEFECT_SEVERITY_MAP = {
    "Critical": 1.0,
    "Severe": 0.80,
    "Moderate": 0.50,
    "Medium": 0.50,
    "Minor": 0.25,
    "Low": 0.25
}

OPERATIONAL_IMPACT_MAP = {
    "Severe": 1.0,
    "High": 0.75,
    "Medium": 0.50,
    "Moderate": 0.50,
    "Low": 0.25
}

def get_configured_weights(db: Session) -> Dict[str, float]:
    """Retrieve weights from SystemSetting or fallback to default weights."""
    setting = db.query(SystemSetting).filter(SystemSetting.key == "priority_weights").first()
    if setting and isinstance(setting.value, dict):
        return {**DEFAULT_PRIORITY_WEIGHTS, **setting.value}
    return DEFAULT_PRIORITY_WEIGHTS.copy()

def calculate_priority_score(
    criticality: str,
    deadline_str: Optional[str] = None,
    overdue: bool = False,
    asset_type: str = "Track",
    preferred_date_str: Optional[str] = None,
    urgency: Optional[str] = None,
    defect_severity: Optional[str] = None,
    operational_impact: Optional[str] = None,
    weights: Optional[Dict[str, float]] = None,
    **kwargs
) -> Tuple[float, Any, Dict[str, Any]]:
    """
    AI-Assisted / Rule-Based Priority Engine
    Calculates transparent weighted priority score (0-100) and factor breakdown.
    Compatible with both legacy 4-param and enterprise 6-param calls.
    """
    w = weights or DEFAULT_PRIORITY_WEIGHTS
    urg = urgency or kwargs.get("urgency", "Normal")
    def_sev = defect_severity or kwargs.get("defect_severity", "Medium")
    op_imp = operational_impact or kwargs.get("operational_impact", "Medium")

    c_factor = CRITICALITY_MAP.get(criticality, 0.5) * w.get("criticality_weight", 25.0)
    u_factor = URGENCY_MAP.get(urgency, 0.5) * w.get("urgency_weight", 25.0)
    o_factor = (w.get("overdue_weight", 20.0)) if overdue else 0.0
    d_factor = DEFECT_SEVERITY_MAP.get(defect_severity, 0.5) * w.get("defect_weight", 15.0)
    i_factor = OPERATIONAL_IMPACT_MAP.get(operational_impact, 0.5) * w.get("operational_impact_weight", 15.0)

    raw_score = c_factor + u_factor + o_factor + d_factor + i_factor
    score = round(min(100.0, max(0.0, raw_score)), 1)

    # Classification
    if score >= 80.0:
        band = "Critical"
    elif score >= 60.0:
        band = "High"
    elif score >= 40.0:
        band = "Medium"
    else:
        band = "Low"

    breakdown = {
        "engine": "AI-Assisted / Rule-Based Priority Engine",
        "total_score": score,
        "band": band,
        "criticality_points": round(c_factor, 1),
        "urgency_points": round(u_factor, 1),
        "overdue_points": round(o_factor, 1),
        "defect_points": round(d_factor, 1),
        "operational_impact_points": round(i_factor, 1),
        "factors": {
            "criticality": round(c_factor, 1),
            "urgency": round(u_factor, 1),
            "overdue": round(o_factor, 1),
            "defect_severity": round(d_factor, 1),
            "operational_impact": round(i_factor, 1)
        },
        "weights_applied": w
    }

    return score, breakdown, band

def recalculate_all_priorities(db: Session) -> Dict[str, Any]:
    """Recalculate priority scores for all maintenance tasks in the database."""
    from app.models.models import MaintenanceTask
    weights = get_configured_weights(db)
    tasks = db.query(MaintenanceTask).all()
    distribution = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}

    for task in tasks:
        score, factors, band = calculate_priority_score(
            criticality=task.criticality or "Medium",
            urgency=task.urgency or "Normal",
            overdue=bool(task.overdue),
            defect_severity=task.defect_severity or "Medium",
            operational_impact=task.operational_impact or "Medium",
            weights=weights
        )
        task.priority_score = score
        task.priority_factors = factors
        distribution[band] = distribution.get(band, 0) + 1

    db.commit()
    return {
        "status": "success",
        "tasks_recalculated": len(tasks),
        "category_distribution": distribution,
        "formula": "criticality_w + urgency_w + overdue_w + defect_w + operational_impact_w"
    }
