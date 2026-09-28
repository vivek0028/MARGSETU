from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.models import MaintenanceTask, BlockWindow

def analyse_task_compatibility(db: Session) -> List[Dict[str, Any]]:
    """
    Identifies compatible cross-departmental maintenance tasks that can be
    co-scheduled into a unified maintenance block (Joint Engineering + S&T + Traction blocks).
    
    Compatibility criteria:
    - Same corridor section
    - Cross-departmental synergy (Engineering, S&T, Traction)
    - Compatible departments declared in task schema
    - Non-competing resource requirements
    - Combined or parallel execution fits block window
    """
    tasks: List[MaintenanceTask] = db.query(MaintenanceTask).all()
    blocks: List[BlockWindow] = db.query(BlockWindow).all()

    # Group candidate tasks by location
    location_tasks: Dict[str, List[MaintenanceTask]] = {}
    for t in tasks:
        loc = t.location
        if loc not in location_tasks:
            location_tasks[loc] = []
        location_tasks[loc].append(t)

    bundles: List[Dict[str, Any]] = []
    bundle_id_counter = 1

    for loc, t_list in location_tasks.items():
        # Look for multi-department combinations in this section
        eng_tasks = [t for t in t_list if t.department == "Engineering" and "S&T" in (t.compatible_departments or [])]
        snt_tasks = [t for t in t_list if t.department == "S&T" and "Engineering" in (t.compatible_departments or [])]
        trc_tasks = [t for t in t_list if t.department == "Traction" and "Engineering" in (t.compatible_departments or [])]

        # Check for 3-way or 2-way bundle opportunities
        if eng_tasks and snt_tasks:
            for e in eng_tasks:
                for s in snt_tasks:
                    # Check if resources are distinct
                    e_res = set(e.required_resources or [])
                    s_res = set(s.required_resources or [])
                    if e_res.intersection(s_res):
                        continue  # Resource clash

                    bundled_tasks = [e, s]
                    partner_trc = None
                    # Try to add a compatible traction task if available
                    for tr in trc_tasks:
                        tr_res = set(tr.required_resources or [])
                        if not tr_res.intersection(e_res) and not tr_res.intersection(s_res):
                            partner_trc = tr
                            bundled_tasks.append(tr)
                            break

                    task_ids = [t.task_id for t in bundled_tasks]
                    dept_names = list({t.department for t in bundled_tasks})
                    total_dur = max(t.duration_hours for t in bundled_tasks)  # Parallel safety block

                    # Compute score based on department diversity and resource synergy
                    base_score = 75
                    if len(dept_names) >= 3:
                        base_score += 18
                    elif len(dept_names) == 2:
                        base_score += 10

                    if any(t.overdue for t in bundled_tasks):
                        base_score += 5

                    score = min(98, base_score)

                    reasons = [
                        f"Shared railway corridor section ({loc})",
                        f"Joint departmental coordination across {', '.join(dept_names)}",
                        "No mutual heavy resource contention",
                        f"Parallel execution within {total_dur}h traffic block window",
                        "Preserves corridor path throughput by avoiding multiple disconnections"
                    ]

                    # Find matching available block window in this section
                    matching_blocks = [b.block_id for b in blocks if b.section == loc and b.max_duration_hours >= total_dur]

                    bundles.append({
                        "bundle_id": f"BUNDLE-{bundle_id_counter:03d}",
                        "bundle_name": f"Joint {' + '.join(dept_names)} Maintenance Block",
                        "location": loc,
                        "departments": dept_names,
                        "task_ids": task_ids,
                        "tasks": [
                            {
                                "task_id": t.task_id,
                                "department": t.department,
                                "asset_type": t.asset_type,
                                "description": t.description,
                                "duration_hours": t.duration_hours,
                                "criticality": t.criticality
                            } for t in bundled_tasks
                        ],
                        "compatibility_score": score,
                        "parallel_duration_hours": total_dur,
                        "recommended_block_id": matching_blocks[0] if matching_blocks else None,
                        "reasons": reasons,
                        "estimated_traffic_path_savings": f"{len(bundled_tasks) - 1} separate corridor block(s) saved"
                    })
                    bundle_id_counter += 1

                    # Limit combinatorial explosion for demo clarity
                    if len(bundles) >= 6:
                        break
                if len(bundles) >= 6:
                    break

    return bundles
