from datetime import datetime, time
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.models import MaintenanceTask, TrainMovement, BlockWindow, Conflict

def parse_time_str(t_str: str) -> time:
    """Parses HH:MM:SS string to datetime.time."""
    parts = t_str.split(":")
    return time(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)

def detect_all_conflicts(db: Session, persist: bool = True) -> List[Dict[str, Any]]:
    """
    Comprehensive rule-based conflict detection engine across 5 operational dimensions:
    1. Timetable Conflict (Train path vs Maintenance Block overlap)
    2. Resource Conflict (Simultaneous resource double-booking)
    3. Location Conflict (Incompatible track occupancies)
    4. Dependency Conflict (Predecessor task violation)
    5. Duration Conflict (Task exceeds available block window)
    """
    tasks: List[MaintenanceTask] = db.query(MaintenanceTask).all()
    trains: List[TrainMovement] = db.query(TrainMovement).all()
    blocks: List[BlockWindow] = db.query(BlockWindow).all()

    conflicts: List[Dict[str, Any]] = []
    conflict_idx = 1

    # Map tasks by ID and date
    task_map = {t.task_id: t for t in tasks}

    # ---------------------------------------------------------
    # 1. Timetable Conflicts
    # ---------------------------------------------------------
    # Check if block windows collide with high-priority scheduled trains
    for b in blocks:
        b_start = parse_time_str(b.start_time)
        b_end = parse_time_str(b.end_time)

        for tr in trains:
            # Check section and direction overlap
            section_match = (tr.section == b.section)
            direction_match = (b.direction == "BOTH" or tr.direction == b.direction)

            if section_match and direction_match:
                try:
                    # Train scheduled times (extract date and time)
                    dep_dt = datetime.fromisoformat(tr.scheduled_departure.replace("Z", ""))
                    arr_dt = datetime.fromisoformat(tr.scheduled_arrival.replace("Z", ""))
                    tr_date = dep_dt.date().isoformat()

                    if tr_date == b.date:
                        t_start = dep_dt.time()
                        t_end = arr_dt.time()

                        # Check time window intersection
                        if not (b_end <= t_start or b_start >= t_end):
                            tasks_in_block = [t.task_id for t in tasks if t.assigned_block_id == b.block_id or (t.location == b.section and t.preferred_date == b.date)]
                            severity = "Critical" if tr.priority_rank == 1 else "Warning"
                            conflicts.append({
                                "conflict_id": f"CONF-TT-{conflict_idx:03d}",
                                "conflict_type": "Timetable",
                                "severity": severity,
                                "affected_tasks": tasks_in_block[:3],
                                "affected_trains": [tr.train_no],
                                "explanation": (
                                    f"Block window {b.block_id} ({b.start_time} - {b.end_time}) on {b.section} ({b.direction}) "
                                    f"directly conflicts with scheduled train movement of {tr.train_name} ({tr.train_no}) "
                                    f"between {t_start.strftime('%H:%M')} and {t_end.strftime('%H:%M')}."
                                ),
                                "suggested_resolution": (
                                    f"Adjust block start after {t_end.strftime('%H:%M')} or reschedule corridor maintenance to "
                                    f"the designated night curfew window (01:30 - 05:00)."
                                ),
                                "status": "Active"
                            })
                            conflict_idx += 1
                except Exception:
                    continue

    # ---------------------------------------------------------
    # 2. Resource Conflicts (Same resource requested concurrently)
    # ---------------------------------------------------------
    # Group tasks by date and resource
    date_resource_tasks: Dict[str, Dict[str, List[str]]] = {}
    for t in tasks:
        d = t.preferred_date
        if d not in date_resource_tasks:
            date_resource_tasks[d] = {}
        for r in (t.required_resources or []):
            if r not in date_resource_tasks[d]:
                date_resource_tasks[d][r] = []
            date_resource_tasks[d][r].append(t.task_id)

    for d, res_dict in date_resource_tasks.items():
        for res_name, task_ids in res_dict.items():
            if len(task_ids) > 1:
                # E.g. Track Machine requested by two separate gangs
                conflicts.append({
                    "conflict_id": f"CONF-RES-{conflict_idx:03d}",
                    "conflict_type": "Resource",
                    "severity": "Critical" if "Machine" in res_name else "Warning",
                    "affected_tasks": task_ids,
                    "affected_trains": [],
                    "explanation": (
                        f"Resource contention: Resource '{res_name}' is concurrently requisitioned by {len(task_ids)} tasks "
                        f"({', '.join(task_ids)}) on preferred date {d}."
                    ),
                    "suggested_resolution": (
                        f"Stagger maintenance schedules or prioritize the higher priority task ({max(task_ids, key=lambda x: task_map[x].priority_score)}) "
                        f"and shift the secondary task to an alternate block window."
                    ),
                    "status": "Active"
                })
                conflict_idx += 1

    # ---------------------------------------------------------
    # 3. Location Conflicts (Incompatible concurrent section tasks)
    # ---------------------------------------------------------
    date_section_tasks: Dict[str, Dict[str, List[MaintenanceTask]]] = {}
    for t in tasks:
        d = t.preferred_date
        sec = t.location
        if d not in date_section_tasks:
            date_section_tasks[d] = {}
        if sec not in date_section_tasks[d]:
            date_section_tasks[d][sec] = []
        date_section_tasks[d][sec].append(t)

    for d, sec_dict in date_section_tasks.items():
        for sec, t_list in sec_dict.items():
            # If tasks in the same section have mutually incompatible departments or heavy machinery
            heavy_tasks = [t for t in t_list if t.asset_type in ["Bridge", "Track"] and t.duration_hours >= 3.5]
            if len(heavy_tasks) > 1:
                conflicts.append({
                    "conflict_id": f"CONF-LOC-{conflict_idx:03d}",
                    "conflict_type": "Location",
                    "severity": "Critical",
                    "affected_tasks": [t.task_id for t in heavy_tasks],
                    "affected_trains": [],
                    "explanation": (
                        f"Multiple major infrastructure operations on {sec} on {d}: "
                        f"{', '.join(t.task_id for t in heavy_tasks)} require simultaneous full block access."
                    ),
                    "suggested_resolution": (
                        "Sequence track screening and bridge rehabilitation sequentially rather than in parallel."
                    ),
                    "status": "Active"
                })
                conflict_idx += 1

    # ---------------------------------------------------------
    # 4. Dependency Conflicts
    # ---------------------------------------------------------
    for t in tasks:
        if t.dependencies:
            for dep_id in t.dependencies:
                dep_task = task_map.get(dep_id)
                if dep_task:
                    # If dependent task is scheduled before or on the same date without bundle
                    if t.preferred_date < dep_task.preferred_date:
                        conflicts.append({
                            "conflict_id": f"CONF-DEP-{conflict_idx:03d}",
                            "conflict_type": "Dependency",
                            "severity": "Warning",
                            "affected_tasks": [t.task_id, dep_id],
                            "affected_trains": [],
                            "explanation": (
                                f"Task {t.task_id} is scheduled on {t.preferred_date}, prior to its predecessor "
                                f"task {dep_id} scheduled on {dep_task.preferred_date}."
                            ),
                            "suggested_resolution": (
                                f"Shift {t.task_id} to a date after {dep_task.preferred_date} or complete predecessor {dep_id} first."
                            ),
                            "status": "Active"
                        })
                        conflict_idx += 1

    # ---------------------------------------------------------
    # 5. Duration Conflicts
    # ---------------------------------------------------------
    # Compare each task duration against the maximum available window duration in its target section
    section_max_durations: Dict[str, float] = {}
    for b in blocks:
        section_max_durations[b.section] = max(section_max_durations.get(b.section, 0.0), b.max_duration_hours)

    for t in tasks:
        max_available = section_max_durations.get(t.location, 3.5)
        if t.duration_hours > max_available:
            conflicts.append({
                "conflict_id": f"CONF-DUR-{conflict_idx:03d}",
                "conflict_type": "Duration",
                "severity": "Critical",
                "affected_tasks": [t.task_id],
                "affected_trains": [],
                "explanation": (
                    f"Task {t.task_id} requires {t.duration_hours} hours of continuous disconnection, "
                    f"exceeding the longest allowable corridor block ({max_available} hrs) in {t.location}."
                ),
                "suggested_resolution": (
                    "Split task into multiple phased sub-blocks or request an extended Special Corridor Traffic Block."
                ),
                "status": "Active"
            })
            conflict_idx += 1

    # Persist to database if requested
    if persist:
        db.query(Conflict).delete()
        for c in conflicts:
            db_conflict = Conflict(
                conflict_id=c["conflict_id"],
                conflict_type=c["conflict_type"],
                severity=c["severity"],
                affected_tasks=c["affected_tasks"],
                affected_trains=c["affected_trains"],
                explanation=c["explanation"],
                suggested_resolution=c["suggested_resolution"],
                status=c["status"],
                data_label="DEMO DATA"
            )
            db.add(db_conflict)
        db.commit()

    return conflicts
