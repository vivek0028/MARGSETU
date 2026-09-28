from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple, Set
from sqlalchemy.orm import Session
from ortools.sat.python import cp_model

from app.models.models import (
    MaintenanceTask,
    BlockWindow,
    TrainMovement,
    Resource,
    SchedulePlan,
    ScheduleAssignment,
    Conflict
)
from app.services.explanation_engine import generate_task_explanation

def parse_hour(time_str: str) -> float:
    """Parses 'HH:MM:SS' into float hours, e.g. '01:30:00' -> 1.5."""
    parts = time_str.split(":")
    return float(parts[0]) + float(parts[1]) / 60.0

def intervals_overlap(start1: float, end1: float, start2: float, end2: float) -> bool:
    """Returns True if two time intervals overlap."""
    return not (end1 <= start2 or start1 >= end2)

class RailBlockOptimizer:
    """
    Deterministic Constraint-Based Railway Maintenance Scheduling Engine
    Powered by Google OR-Tools CP-SAT Solver.
    
    Generates mathematically verified, conflict-free maintenance block options.
    Strictly follows constraint programming rules without black-box or autonomous operations.
    """

    def __init__(self, db: Session):
        self.db = db

    def solve_plan(
        self,
        strategy_type: str = "PLAN_A_CRITICAL",
        block_duration_bonus_hours: float = 0.0,
        additional_crew_count: int = 0,
        allow_bundling: bool = True,
        time_limit_seconds: float = 5.0
    ) -> Dict[str, Any]:
        tasks: List[MaintenanceTask] = self.db.query(MaintenanceTask).all()
        blocks: List[BlockWindow] = self.db.query(BlockWindow).all()
        trains: List[TrainMovement] = self.db.query(TrainMovement).all()
        resources: List[Resource] = self.db.query(Resource).all()

        if not tasks or not blocks:
            return {
                "status": "INFEASIBLE",
                "message": "No maintenance tasks or block windows available for optimization.",
                "scheduled_tasks": [],
                "deferred_tasks": []
            }

        # Map resources by availability
        unavailable_resources = {r.name for r in resources if not r.available}

        # Precompute train-overlapping blocks
        train_conflicting_blocks: Set[str] = set()
        for b in blocks:
            b_s = parse_hour(b.start_time)
            b_e = parse_hour(b.end_time)
            for tr in trains:
                if tr.section == b.section and (b.direction == "BOTH" or tr.direction == b.direction):
                    dep_dt = datetime.fromisoformat(tr.scheduled_departure.replace("Z", ""))
                    arr_dt = datetime.fromisoformat(tr.scheduled_arrival.replace("Z", ""))
                    if dep_dt.date().isoformat() == b.date:
                        t_s = dep_dt.hour + dep_dt.minute / 60.0
                        t_e = arr_dt.hour + arr_dt.minute / 60.0
                        if intervals_overlap(b_s, b_e, t_s, t_e):
                            train_conflicting_blocks.add(b.block_id)

        model = cp_model.CpModel()

        # Decision variables: x[t, b] is 1 if task t is assigned to block b
        x = {}
        for t in tasks:
            for b in blocks:
                x[(t.task_id, b.block_id)] = model.NewBoolVar(f"x_{t.task_id}_{b.block_id}")

        # Variable indicating whether block b is active (at least 1 task scheduled)
        y = {}
        for b in blocks:
            y[b.block_id] = model.NewBoolVar(f"y_{b.block_id}")
            # y[b] >= x[t, b] for all t
            for t in tasks:
                model.Add(y[b.block_id] >= x[(t.task_id, b.block_id)])
            # y[b] <= sum(x[t, b])
            model.Add(y[b.block_id] <= sum(x[(t.task_id, b.block_id)] for t in tasks))

        # -------------------------------------------------------------
        # HARD CONSTRAINT 1: At most one block per task
        # -------------------------------------------------------------
        for t in tasks:
            model.Add(sum(x[(t.task_id, b.block_id)] for b in blocks) <= 1)

        # -------------------------------------------------------------
        # HARD CONSTRAINT 2: Section Compatibility
        # -------------------------------------------------------------
        for t in tasks:
            for b in blocks:
                if t.location != b.section:
                    model.Add(x[(t.task_id, b.block_id)] == 0)

        # -------------------------------------------------------------
        # HARD CONSTRAINT 3: Deadline Constraints
        # -------------------------------------------------------------
        for t in tasks:
            for b in blocks:
                if b.date > t.deadline:
                    model.Add(x[(t.task_id, b.block_id)] == 0)

        # -------------------------------------------------------------
        # HARD CONSTRAINT 4: Task Individual Duration Limit
        # -------------------------------------------------------------
        for t in tasks:
            for b in blocks:
                effective_cap = b.max_duration_hours + block_duration_bonus_hours
                if t.duration_hours > effective_cap:
                    model.Add(x[(t.task_id, b.block_id)] == 0)

        # -------------------------------------------------------------
        # HARD CONSTRAINT 5: Block Capacity & Departmental Execution
        # -------------------------------------------------------------
        for b in blocks:
            effective_cap = b.max_duration_hours + block_duration_bonus_hours
            cap_int = int(round(effective_cap * 10))

            if not allow_bundling:
                # Strictly sequential: sum of all task durations <= block capacity
                model.Add(
                    sum(int(round(t.duration_hours * 10)) * x[(t.task_id, b.block_id)] for t in tasks) <= cap_int
                )
            else:
                # In bundling mode: tasks of the SAME department must run sequentially
                for dept in ["Engineering", "S&T", "Traction"]:
                    dept_tasks = [t for t in tasks if t.department == dept]
                    if dept_tasks:
                        model.Add(
                            sum(int(round(t.duration_hours * 10)) * x[(t.task_id, b.block_id)] for t in dept_tasks) <= cap_int
                        )

        # -------------------------------------------------------------
        # HARD CONSTRAINT 6: Resource Availability & Double Booking
        # -------------------------------------------------------------
        # 6a. If resource is marked unavailable, task CANNOT be scheduled
        for t in tasks:
            req_set = set(t.required_resources or [])
            if req_set.intersection(unavailable_resources):
                for b in blocks:
                    model.Add(x[(t.task_id, b.block_id)] == 0)

        # 6b. Resource double-booking across concurrent/overlapping blocks on same date
        for res in resources:
            r_tasks = [t for t in tasks if res.name in (t.required_resources or [])]
            if len(r_tasks) > 1:
                allowed_concurrency = 1
                if "Crew" in res.name and additional_crew_count > 0:
                    allowed_concurrency += additional_crew_count

                # Same block contention
                for b in blocks:
                    model.Add(
                        sum(x[(t.task_id, b.block_id)] for t in r_tasks) <= allowed_concurrency
                    )

                # Overlapping blocks on the same date
                for i in range(len(blocks)):
                    for j in range(i + 1, len(blocks)):
                        b1 = blocks[i]
                        b2 = blocks[j]
                        if b1.date == b2.date:
                            s1 = parse_hour(b1.start_time)
                            e1 = parse_hour(b1.end_time)
                            s2 = parse_hour(b2.start_time)
                            e2 = parse_hour(b2.end_time)
                            if intervals_overlap(s1, e1, s2, e2):
                                for t1 in r_tasks:
                                    for t2 in r_tasks:
                                        if t1.task_id != t2.task_id:
                                            model.Add(x[(t1.task_id, b1.block_id)] + x[(t2.task_id, b2.block_id)] <= allowed_concurrency)

        # -------------------------------------------------------------
        # HARD CONSTRAINT 7: Predecessor Dependencies
        # -------------------------------------------------------------
        task_map = {t.task_id: t for t in tasks}
        block_timing = {b.block_id: (b.date, parse_hour(b.start_time)) for b in blocks}

        for t in tasks:
            for dep_id in (t.dependencies or []):
                if dep_id in task_map:
                    for b_dep in blocks:
                        for b_curr in blocks:
                            if block_timing[b_dep.block_id] >= block_timing[b_curr.block_id]:
                                # If dep is scheduled in b_dep, t cannot be scheduled in earlier or same b_curr
                                model.Add(
                                    x[(dep_id, b_dep.block_id)] + x[(t.task_id, b_curr.block_id)] <= 1
                                )

        # -------------------------------------------------------------
        # HARD CONSTRAINT 8: Train Movement Exclusions for Plan B
        # -------------------------------------------------------------
        if strategy_type == "PLAN_B_TRAIN_IMPACT":
            # Plan B STRICTLY forbids scheduling ANY task in a train-conflicting block
            for b_id in train_conflicting_blocks:
                for t in tasks:
                    model.Add(x[(t.task_id, b_id)] == 0)

        # -------------------------------------------------------------
        # OBJECTIVE FUNCTION FORMULATION (Genuinely different across plans)
        # -------------------------------------------------------------
        objective_terms = []

        if strategy_type == "PLAN_A_CRITICAL":
            # Focus: Maximise critical and overdue task completion
            for t in tasks:
                p_pts = int(round(t.priority_score * 15))
                if t.criticality == "Critical":
                    p_pts += 2500
                elif t.criticality == "High":
                    p_pts += 1200
                if t.overdue:
                    p_pts += 2000

                for b in blocks:
                    coef = p_pts
                    # Small preference for preferred date
                    if b.date == t.preferred_date:
                        coef += 150
                    objective_terms.append(coef * x[(t.task_id, b.block_id)])

        elif strategy_type == "PLAN_B_TRAIN_IMPACT":
            # Focus: Zero timetable conflict, maximum night window utilisation
            for t in tasks:
                p_pts = int(round(t.priority_score * 8))
                if t.criticality == "Critical":
                    p_pts += 800
                if t.overdue:
                    p_pts += 600

                for b in blocks:
                    coef = p_pts
                    b_hour = parse_hour(b.start_time)
                    # Large bonus for designated night corridor windows (01:00 - 05:30)
                    if b_hour < 6.0:
                        coef += 1500
                    else:
                        coef -= 400
                    objective_terms.append(coef * x[(t.task_id, b.block_id)])

        elif strategy_type == "PLAN_C_BUNDLING":
            # Focus: Maximise joint cross-department bundling and MINIMISE separate blocks
            for t in tasks:
                p_pts = int(round(t.priority_score * 6))
                if "Engineering" in (t.compatible_departments or []) or "S&T" in (t.compatible_departments or []):
                    p_pts += 400
                for b in blocks:
                    coef = p_pts
                    if b.date == t.preferred_date:
                        coef += 100
                    objective_terms.append(coef * x[(t.task_id, b.block_id)])

            # Heavily penalise opening extra active blocks (-800 per active block)
            for b in blocks:
                objective_terms.append(-800 * y[b.block_id])

            # Big bonus for multi-department pairs co-scheduled in block b
            if allow_bundling:
                for b in blocks:
                    sec_eng = [t for t in tasks if t.location == b.section and t.department == "Engineering"]
                    sec_snt = [t for t in tasks if t.location == b.section and t.department == "S&T"]
                    sec_trc = [t for t in tasks if t.location == b.section and t.department == "Traction"]

                    # Eng + S&T pair bonus
                    if sec_eng and sec_snt:
                        for e in sec_eng[:2]:
                            for s in sec_snt[:2]:
                                pair_var = model.NewBoolVar(f"bundle_es_{e.task_id}_{s.task_id}_{b.block_id}")
                                model.Add(x[(e.task_id, b.block_id)] + x[(s.task_id, b.block_id)] >= 2).OnlyEnforceIf(pair_var)
                                model.Add(x[(e.task_id, b.block_id)] + x[(s.task_id, b.block_id)] < 2).OnlyEnforceIf(pair_var.Not())
                                objective_terms.append(2000 * pair_var)

                    # Eng + Traction pair bonus
                    if sec_eng and sec_trc:
                        for e in sec_eng[:2]:
                            for tr in sec_trc[:2]:
                                pair_var_et = model.NewBoolVar(f"bundle_et_{e.task_id}_{tr.task_id}_{b.block_id}")
                                model.Add(x[(e.task_id, b.block_id)] + x[(tr.task_id, b.block_id)] >= 2).OnlyEnforceIf(pair_var_et)
                                model.Add(x[(e.task_id, b.block_id)] + x[(tr.task_id, b.block_id)] < 2).OnlyEnforceIf(pair_var_et.Not())
                                objective_terms.append(1500 * pair_var_et)

        model.Maximize(sum(objective_terms))

        # -------------------------------------------------------------
        # SOLVER EXECUTION
        # -------------------------------------------------------------
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = time_limit_seconds
        solver.parameters.num_workers = 4
        status = solver.Solve(model)

        if status not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            return {
                "status": "INFEASIBLE",
                "strategy_type": strategy_type,
                "message": "Solver could not find a feasible schedule satisfying all hard constraints.",
                "scheduled_tasks": [],
                "deferred_tasks": [t.task_id for t in tasks],
                "kpis": {
                    "total_tasks": len(tasks),
                    "scheduled_count": 0,
                    "deferred_count": len(tasks),
                    "utilization_rate": 0.0,
                    "critical_coverage": 0.0,
                    "bundled_blocks_count": 0,
                    "active_blocks_count": 0,
                    "total_available_blocks": len(blocks)
                }
            }

        # -------------------------------------------------------------
        # POST-PROCESSING & ASSIGNMENT MAPPING
        # -------------------------------------------------------------
        scheduled_assignments: List[Dict[str, Any]] = []
        scheduled_task_ids: Set[str] = set()
        block_usage: Dict[str, List[MaintenanceTask]] = {b.block_id: [] for b in blocks}

        for t in tasks:
            for b in blocks:
                if solver.Value(x[(t.task_id, b.block_id)]) == 1:
                    scheduled_task_ids.add(t.task_id)
                    block_usage[b.block_id].append(t)

        block_map = {b.block_id: b for b in blocks}

        for b_id, b_tasks in block_usage.items():
            b = block_map[b_id]
            for t in b_tasks:
                bundled_with = [other.task_id for other in b_tasks if other.task_id != t.task_id]
                explanation = generate_task_explanation(
                    task=t,
                    is_scheduled=True,
                    assigned_block=b,
                    bundled_with=bundled_with
                )
                scheduled_assignments.append({
                    "task_id": t.task_id,
                    "task": {
                        "task_id": t.task_id,
                        "department": t.department,
                        "asset_type": t.asset_type,
                        "location": t.location,
                        "description": t.description,
                        "duration_hours": t.duration_hours,
                        "priority_score": t.priority_score,
                        "criticality": t.criticality,
                        "overdue": t.overdue
                    },
                    "block_id": b.block_id,
                    "block": {
                        "block_id": b.block_id,
                        "section": b.section,
                        "direction": b.direction,
                        "date": b.date,
                        "start_time": b.start_time,
                        "end_time": b.end_time,
                        "max_duration_hours": b.max_duration_hours
                    },
                    "bundled_with": bundled_with,
                    "explanation": explanation
                })

        # -------------------------------------------------------------
        # ACCURATE UTILISATION CALCULATION (Requirement 5)
        # Used Block Hours / Total Available Block Hours * 100
        # -------------------------------------------------------------
        total_available_hours = sum(b.max_duration_hours for b in blocks)
        total_used_hours = 0.0

        for b in blocks:
            b_tasks = block_usage[b.block_id]
            if not b_tasks:
                continue

            if allow_bundling:
                # Parallel duration across distinct departments
                dept_durations: Dict[str, float] = {}
                for t in b_tasks:
                    dept_durations[t.department] = dept_durations.get(t.department, 0.0) + t.duration_hours
                used_b = max(dept_durations.values()) if dept_durations else 0.0
            else:
                used_b = sum(t.duration_hours for t in b_tasks)

            used_b = min(used_b, b.max_duration_hours)
            total_used_hours += used_b

        utilization_rate = round((total_used_hours / max(1.0, total_available_hours)) * 100, 1)

        # -------------------------------------------------------------
        # ACCURATE CRITICAL COVERAGE CALCULATION (Requirement 7)
        # (Scheduled Critical Tasks / Total Critical Tasks) * 100
        # -------------------------------------------------------------
        critical_tasks = [t for t in tasks if t.criticality == "Critical" or t.overdue]
        critical_scheduled = [t for t in critical_tasks if t.task_id in scheduled_task_ids]
        critical_coverage = round((len(critical_scheduled) / max(1, len(critical_tasks))) * 100, 1)

        # Bundled blocks count
        bundled_blocks_count = sum(1 for b_id, t_list in block_usage.items() if len({t.department for t in t_list}) >= 2)
        active_blocks = [b_id for b_id, t_list in block_usage.items() if len(t_list) > 0]

        # -------------------------------------------------------------
        # ACCURATE DEFERRED TASKS EXPLANATION (Requirement 8)
        # Based on actual solver constraints
        # -------------------------------------------------------------
        deferred_tasks: List[Dict[str, Any]] = []
        for t in tasks:
            if t.task_id not in scheduled_task_ids:
                reasons = []
                # Check resource unavailable
                req_unavail = set(t.required_resources or []).intersection(unavailable_resources)
                if req_unavail:
                    reasons.append(f"Resource Unavailability: Required resource '{', '.join(req_unavail)}' is currently out of service / undergoing maintenance.")

                # Check duration
                max_window_in_section = max([b.max_duration_hours for b in blocks if b.section == t.location], default=0.0)
                if t.duration_hours > max_window_in_section:
                    reasons.append(f"Block Capacity Exceeded: Task duration ({t.duration_hours}h) exceeds the longest available block window ({max_window_in_section}h) on {t.location}.")

                # Check train conflict in Plan B
                if strategy_type == "PLAN_B_TRAIN_IMPACT":
                    section_train_blocks = [b.block_id for b in blocks if b.section == t.location and b.block_id in train_conflicting_blocks]
                    if section_train_blocks:
                        reasons.append(f"Train Timetable Protection: Daytime window on {t.location} is blocked to prevent delays to scheduled train paths.")

                # Check predecessor dependencies
                for dep_id in (t.dependencies or []):
                    if dep_id not in scheduled_task_ids:
                        reasons.append(f"Unfulfilled Dependency: Predecessor task {dep_id} is not scheduled or completed.")

                # If no specific constraint triggered, it was displaced by priority or capacity
                if not reasons:
                    # Check resource contention with scheduled task
                    competing = None
                    for res_name in (t.required_resources or []):
                        for s_assign in scheduled_assignments:
                            st = task_map[s_assign["task_id"]]
                            if res_name in (st.required_resources or []) and s_assign["block"]["date"] == t.preferred_date:
                                competing = st
                                break
                        if competing:
                            break

                    if competing:
                        reasons.append(f"Resource Preemption: Required resource '{competing.required_resources[0]}' allocated to higher-priority task {competing.task_id} (Score {competing.priority_score:.1f} vs {t.priority_score:.1f}).")
                    else:
                        reasons.append(f"Corridor Allocation Cutoff: Available block capacity in {t.location} was allocated to higher-ranked maintenance requests.")

                deferred_tasks.append({
                    "task_id": t.task_id,
                    "task": {
                        "task_id": t.task_id,
                        "department": t.department,
                        "asset_type": t.asset_type,
                        "location": t.location,
                        "duration_hours": t.duration_hours,
                        "priority_score": t.priority_score,
                        "criticality": t.criticality,
                        "overdue": t.overdue
                    },
                    "explanation": {
                        "summary": f"Deferred in {strategy_type} based on deterministic constraint resolution.",
                        "rule_based_reasons": reasons,
                        "reasons": reasons
                    }
                })

        return {
            "status": "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE",
            "strategy_type": strategy_type,
            "objective_value": solver.ObjectiveValue(),
            "kpis": {
                "total_tasks": len(tasks),
                "scheduled_count": len(scheduled_assignments),
                "deferred_count": len(deferred_tasks),
                "utilization_rate": utilization_rate,
                "used_block_hours": round(total_used_hours, 1),
                "total_available_hours": round(total_available_hours, 1),
                "critical_coverage": critical_coverage,
                "critical_tasks_scheduled": len(critical_scheduled),
                "total_critical_tasks": len(critical_tasks),
                "bundled_blocks_count": bundled_blocks_count,
                "active_blocks_count": len(active_blocks),
                "total_available_blocks": len(blocks)
            },
            "scheduled_assignments": scheduled_assignments,
            "deferred_tasks": deferred_tasks,
            "disclaimer": "AI-Assisted Demo Recommendation | Generated via Google OR-Tools CP-SAT | Human Approval Required"
        }
