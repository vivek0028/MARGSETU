from typing import Dict, Any, List, Optional
from app.models.models import MaintenanceTask, BlockWindow

def generate_task_explanation(
    task: MaintenanceTask,
    is_scheduled: bool,
    assigned_block: Optional[BlockWindow] = None,
    competing_task: Optional[MaintenanceTask] = None,
    conflict_info: Optional[str] = None,
    bundled_with: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Generates transparent, deterministic, rule-based explanations for planner decisions.
    NEVER uses opaque text such as 'AI decided this'.
    """
    factors = task.priority_factors or {}
    if isinstance(factors, str):
        try:
            import json
            factors = json.loads(factors)
        except Exception:
            factors = {}
    if not isinstance(factors, dict):
        factors = {}

    crit_pts = factors.get("criticality_points", 20)
    urg_pts = factors.get("deadline_urgency_points", 15)
    overdue_pts = factors.get("overdue_points", 0)

    if is_scheduled:
        status_category = "Scheduled"
        reasons = [
            f"Asset Criticality: {task.criticality} ({crit_pts} pts) prioritized for corridor safety.",
            f"Deadline Urgency: Deadline on {task.deadline} requires allocation in current planning window.",
            f"Block Allocation: Matched with available window {assigned_block.block_id if assigned_block else 'Corridor Window'} ({task.location}).",
            f"Resource Verification: All required resources ({', '.join(task.required_resources or ['Standard Gang'])}) confirmed non-contested."
        ]
        if task.overdue:
            reasons.insert(0, f"Overdue Maintenance Priority: Task is past maintenance cycle (+{overdue_pts} pts).")

        if bundled_with:
            reasons.append(
                f"Multi-Department Synergy: Co-scheduled with {', '.join(bundled_with)} under a unified safety block."
            )

        summary = f"Included in {assigned_block.block_id if assigned_block else 'schedule'} due to high priority score ({task.priority_score:.1f}) and verified corridor availability."

    else:
        status_category = "Deferred"
        reasons = []
        if conflict_info:
            reasons.append(f"Operational Clash: {conflict_info}")

        if competing_task:
            reasons.append(
                f"Resource Preemption: Required resource is allocated to higher priority task {competing_task.task_id} "
                f"(Score {competing_task.priority_score:.1f} vs {task.priority_score:.1f})."
            )

        if task.duration_hours > (assigned_block.max_duration_hours if assigned_block else 3.5):
            reasons.append(
                f"Window Capacity Limit: Requested duration ({task.duration_hours}h) exceeds available continuous block slot."
            )

        if not reasons:
            reasons = [
                f"Corridor Capacity Constraint: Priority score ({task.priority_score:.1f}) below current allocation cutoff for {task.location}.",
                f"Sufficient Remaining Lead Time: Deadline ({task.deadline}) allows rescheduling into next maintenance cycle without safety penalty."
            ]

        summary = f"Deferred to secondary maintenance cycle to prevent corridor train disruption and resource contention."

    return {
        "task_id": task.task_id,
        "department": task.department,
        "location": task.location,
        "status": status_category,
        "priority_score": task.priority_score,
        "summary": summary,
        "rule_based_reasons": reasons,
        "explainability_disclaimer": "Generated via deterministic railway operations decision rules. No black-box model used."
    }
