import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, JSON, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.database import Base

# ============================================================================
# USER, AUTH & ROLE MODELS
# ============================================================================

class User(Base):
    __tablename__ = "users"

    id = Column(String(50), primary_key=True, default=lambda: f"USR-{uuid.uuid4().hex[:8].upper()}")
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    employee_id = Column(String(50), unique=True, index=True, nullable=False)
    department = Column(String(50), nullable=False, default="Engineering")
    designation = Column(String(100), nullable=False, default="Senior Operations Officer")
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="PLANNER")  # ADMIN, PLANNER, CONTROL_OFFICER, ENGINEERING, TRD, SIGNAL_TELECOM, OPERATIONS
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    notifications = relationship("Notification", back_populates="recipient", cascade="all, delete-orphan")


class Department(Base):
    __tablename__ = "departments"

    id = Column(String(50), primary_key=True)  # ENG, TRD, SNT, OPS, CTRL, ADM
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    head_name = Column(String(100), nullable=True)
    contact_email = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================================================
# INFRASTRUCTURE & ASSET MODELS
# ============================================================================

class Corridor(Base):
    __tablename__ = "corridors"

    id = Column(String(50), primary_key=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(150), nullable=False)
    division = Column(String(100), nullable=False, default="Delhi Division")
    zone = Column(String(50), nullable=False, default="Northern Railway")
    total_km = Column(Float, default=100.0)
    sections = Column(JSON, default=list)  # ["Section A-B", "Section B-C", "Section C-D"]
    created_at = Column(DateTime, default=datetime.utcnow)


class Asset(Base):
    __tablename__ = "assets"

    id = Column(String(50), primary_key=True)  # AST-TRK-001, AST-SIG-002
    asset_code = Column(String(50), unique=True, index=True, nullable=False)
    asset_name = Column(String(150), nullable=False)
    asset_type = Column(String(50), nullable=False, index=True)  # Track, Signal, Telecom, Traction, Bridge, Electrical, Equipment, Other
    department = Column(String(50), nullable=False, index=True)  # Engineering, TRD, S&T, Operations
    corridor = Column(String(100), nullable=False, index=True)
    location = Column(String(100), nullable=False, index=True)  # Section A-B, etc.
    kilometer = Column(String(50), nullable=True)  # e.g., "KM 124.5 - 128.0"
    status = Column(String(30), default="Operational", index=True)  # Operational, Degraded, Under_Maintenance, Out_of_Service
    criticality = Column(String(20), default="Medium")  # Critical, High, Medium, Low
    installation_date = Column(String(20), nullable=True)
    last_maintenance = Column(String(20), nullable=True)
    next_maintenance = Column(String(20), nullable=True)
    condition_score = Column(Float, default=85.0)  # 0 to 100
    defect_count = Column(Integer, default=0)
    owner_department = Column(String(50), default="Engineering")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    defects = relationship("AssetDefect", back_populates="asset", cascade="all, delete-orphan")


class AssetDefect(Base):
    __tablename__ = "asset_defects"

    id = Column(String(50), primary_key=True, default=lambda: f"DEF-{uuid.uuid4().hex[:8].upper()}")
    asset_id = Column(String(50), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)
    defect_type = Column(String(100), nullable=False)
    severity = Column(String(20), nullable=False, default="Medium")  # Critical, High, Medium, Low
    description = Column(Text, nullable=False)
    reported_by = Column(String(100), default="Track Inspector")
    status = Column(String(30), default="Open")  # Open, In_Progress, Resolved
    reported_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    asset = relationship("Asset", back_populates="defects")


# ============================================================================
# MAINTENANCE REQUESTS & TASKS
# ============================================================================

class MaintenanceTask(Base):
    """
    Core maintenance requisition work order.
    Matches both legacy 'MaintenanceTask' and production work order entity.
    """
    __tablename__ = "maintenance_tasks"

    task_id = Column(String(50), primary_key=True, index=True)
    asset_id = Column(String(50), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True, index=True)
    department = Column(String(50), nullable=False, index=True)  # Engineering, S&T, Traction/TRD, Operations
    asset_type = Column(String(50), nullable=False)  # Track, Signal, OHE, Bridge, Telecom, Point Machine
    location = Column(String(100), nullable=False, index=True)  # Section A-B, Section B-C, Section C-D
    corridor = Column(String(100), default="Mainline Corridor Alpha")
    task_title = Column(String(150), nullable=True)
    description = Column(Text, nullable=False)
    maintenance_type = Column(String(50), default="Corrective")  # Corrective, Preventive, Emergency, Overhaul
    duration_hours = Column(Float, nullable=False)
    preferred_date = Column(String(20), nullable=False)  # YYYY-MM-DD
    preferred_start = Column(String(20), nullable=True)  # HH:MM:SS
    preferred_end = Column(String(20), nullable=True)    # HH:MM:SS
    deadline = Column(String(20), nullable=False)        # YYYY-MM-DD
    
    # Priority Factors
    criticality = Column(String(20), nullable=False, default="Medium")  # Critical, High, Medium, Low
    urgency = Column(String(20), default="Normal")                      # Immediate, High, Normal, Low
    defect_severity = Column(String(20), default="Medium")              # Critical, Severe, Moderate, Minor
    operational_impact = Column(String(20), default="Medium")           # Severe, High, Medium, Low
    overdue = Column(Boolean, default=False)
    
    # Operational Resources & Safety
    required_team_size = Column(Integer, default=6)
    required_resources = Column(JSON, default=list)        # List[str] e.g. ["Track Tamping Machine (CSM)", "Engineering Gang 1"]
    dependencies = Column(JSON, default=list)              # List[str] e.g. ["TASK-001"]
    compatible_departments = Column(JSON, default=list)    # List[str] e.g. ["S&T", "TRD"]
    safety_requirements = Column(Text, default="Line block and traction power isolation (OHE Permit-to-Work) required.")
    notes = Column(Text, nullable=True)

    # Priority Scoring Engine Breakdown
    priority_factors = Column(JSON, default=dict)          # {"criticality": 25, "urgency": 20, "overdue": 15, "defect": 17, "operational_impact": 10}
    priority_score = Column(Float, default=0.0, index=True) # 0.0 to 100.0

    # Status & Assignment
    status = Column(String(30), default="Pending", index=True)  # Pending, Scheduled, Deferred, In_Progress, Completed, Cancelled
    assigned_block_id = Column(String(50), nullable=True)
    created_by = Column(String(100), default="Divisional Maintenance Engineer")
    created_by_id = Column(String(50), nullable=True)
    data_source = Column(String(50), default="BDMS")
    data_label = Column(String(50), default="DEMO DATA")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Alias MaintenanceRequest to MaintenanceTask for semantic clarity
MaintenanceRequest = MaintenanceTask


# ============================================================================
# BLOCK WINDOWS & TIMETABLE
# ============================================================================

class BlockWindow(Base):
    __tablename__ = "block_windows"

    block_id = Column(String(50), primary_key=True, index=True)
    corridor = Column(String(100), default="Mainline Corridor Alpha", index=True)
    corridor_name = Column(String(100), default="Mainline Corridor Alpha")
    section = Column(String(100), nullable=False, index=True)
    direction = Column(String(20), nullable=False)  # UP, DOWN, BOTH
    date = Column(String(20), nullable=False, index=True)  # YYYY-MM-DD
    start_time = Column(String(20), nullable=False)  # HH:MM:SS
    end_time = Column(String(20), nullable=False)    # HH:MM:SS
    max_duration_hours = Column(Float, nullable=False)
    block_type = Column(String(50), default="Routine Shadow Block")  # Routine Shadow Block, Absolute Traffic Block, Power Block, Emergency Block
    allowed_departments = Column(JSON, default=lambda: ["Engineering", "S&T", "Traction", "Operations"])
    status = Column(String(30), default="Available", index=True)  # Available, Reserved, Allocated, Completed, Cancelled
    reason = Column(Text, nullable=True)
    data_label = Column(String(50), default="DEMO DATA")
    created_at = Column(DateTime, default=datetime.utcnow)


class TrainMovement(Base):
    __tablename__ = "train_movements"

    train_no = Column(String(50), primary_key=True, index=True)
    train_name = Column(String(100), nullable=False)
    train_type = Column(String(50), nullable=False)  # Vande Bharat, Premium Express, Superfast, Freight, Passenger
    origin = Column(String(100), default="New Delhi (NDLS)")
    destination = Column(String(100), default="Kanpur Central (CNB)")
    corridor = Column(String(100), default="Mainline Corridor Alpha")
    section = Column(String(100), nullable=False, index=True)
    direction = Column(String(20), nullable=False)  # UP, DOWN
    scheduled_departure = Column(String(30), nullable=False)  # ISO datetime string
    scheduled_arrival = Column(String(30), nullable=False)    # ISO datetime string
    priority_rank = Column(Integer, default=2)  # 1 (Highest, e.g. Vande Bharat/Rajdhani) to 4 (Freight)
    speed_kmph = Column(Float, default=100.0)
    frequency = Column(String(50), default="Daily")
    data_label = Column(String(50), default="DEMO DATA")
    created_at = Column(DateTime, default=datetime.utcnow)

    timetable_entries = relationship("TimetableEntry", back_populates="train", cascade="all, delete-orphan")


class TimetableEntry(Base):
    __tablename__ = "timetable_entries"

    id = Column(String(50), primary_key=True, default=lambda: f"TT-{uuid.uuid4().hex[:8].upper()}")
    train_no = Column(String(50), ForeignKey("train_movements.train_no", ondelete="CASCADE"), nullable=False, index=True)
    station_code = Column(String(20), nullable=False)
    station_name = Column(String(100), nullable=False)
    arrival_time = Column(String(20), nullable=True)   # HH:MM
    departure_time = Column(String(20), nullable=True) # HH:MM
    platform = Column(String(10), default="1")
    halt_minutes = Column(Integer, default=2)
    day_number = Column(Integer, default=1)

    train = relationship("TrainMovement", back_populates="timetable_entries")


# ============================================================================
# MACHINERY & CREW RESOURCES
# ============================================================================

class Resource(Base):
    __tablename__ = "resources"

    resource_id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    resource_type = Column(String(100), nullable=False)  # Heavy Machinery, Gang/Crew, Tower Wagon, Inspection Vehicle
    department = Column(String(50), nullable=False, index=True)
    home_depot = Column(String(100), nullable=False)
    available = Column(Boolean, default=True)
    contact_number = Column(String(50), default="+91-11-2334-0000")
    specifications = Column(JSON, default=dict)
    data_label = Column(String(50), default="DEMO DATA")


# ============================================================================
# CONFLICTS & RESOLUTIONS
# ============================================================================

class Conflict(Base):
    __tablename__ = "conflicts"

    conflict_id = Column(String(50), primary_key=True, index=True)
    conflict_type = Column(String(50), nullable=False)  # Timetable, Resource, Location, Dependency, Duration, Corridor, Department
    severity = Column(String(20), nullable=False)       # Critical, Warning, Attention, Resolved
    affected_tasks = Column(JSON, default=list)        # List[task_id]
    affected_trains = Column(JSON, default=list)       # List[train_no]
    affected_corridor = Column(String(100), default="Mainline Corridor Alpha")
    start_time = Column(String(30), nullable=True)
    end_time = Column(String(30), nullable=True)
    explanation = Column(Text, nullable=False)
    suggested_resolution = Column(Text, nullable=False)
    status = Column(String(30), default="Active", index=True)       # Active, Resolved, Ignored
    resolution_notes = Column(Text, nullable=True)
    resolved_by = Column(String(100), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    data_label = Column(String(50), default="DEMO DATA")


# ============================================================================
# OPTIMIZATION RUNS, CANDIDATE PLANS & ASSIGNMENTS
# ============================================================================

class OptimizationRun(Base):
    __tablename__ = "optimization_runs"

    run_id = Column(String(50), primary_key=True, default=lambda: f"RUN-{uuid.uuid4().hex[:8].upper()}")
    planning_horizon = Column(String(50), default="7-Day Horizon")
    start_date = Column(String(20), nullable=False)
    end_date = Column(String(20), nullable=False)
    corridor = Column(String(100), default="Mainline Corridor Alpha")
    division = Column(String(100), default="Delhi Division")
    departments = Column(JSON, default=lambda: ["Engineering", "S&T", "Traction", "Operations"])
    priority_threshold = Column(Float, default=0.0)
    max_block_duration = Column(Float, default=4.0)
    objectives = Column(JSON, default=dict)
    status = Column(String(30), default="Solved")  # Running, Solved, Infeasible, Failed
    solver_time_seconds = Column(Float, default=1.2)
    created_by = Column(String(100), default="System Optimizer")
    created_at = Column(DateTime, default=datetime.utcnow)

    plans = relationship("SchedulePlan", back_populates="run", cascade="all, delete-orphan")


class SchedulePlan(Base):
    __tablename__ = "schedule_plans"

    plan_id = Column(String(50), primary_key=True, index=True)
    run_id = Column(String(50), ForeignKey("optimization_runs.run_id", ondelete="SET NULL"), nullable=True)
    plan_name = Column(String(100), nullable=False)
    strategy_type = Column(String(50), nullable=False)  # PLAN_A_CRITICAL, PLAN_B_TRAIN_IMPACT, PLAN_C_BUNDLING, SIMULATION, CUSTOM
    total_tasks = Column(Integer, default=0)
    scheduled_count = Column(Integer, default=0)
    deferred_count = Column(Integer, default=0)
    conflict_count = Column(Integer, default=0)
    utilization_rate = Column(Float, default=0.0)
    critical_coverage = Column(Float, default=0.0)
    objective_score = Column(Float, default=0.0)
    operational_impact_score = Column(Float, default=0.0)
    bundled_tasks_count = Column(Integer, default=0)
    unused_capacity_hours = Column(Float, default=0.0)
    risk_level = Column(String(20), default="Low")  # Low, Medium, High
    status = Column(String(30), default="Generated", index=True)  # Draft, Generated, Under Review, Approved, Rejected, Modified, Executing, Completed
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    data_label = Column(String(50), default="DEMO DATA")

    run = relationship("OptimizationRun", back_populates="plans")
    assignments = relationship("ScheduleAssignment", back_populates="plan", cascade="all, delete-orphan")


class ScheduleAssignment(Base):
    __tablename__ = "schedule_assignments"

    assignment_id = Column(String(50), primary_key=True, index=True)
    plan_id = Column(String(50), ForeignKey("schedule_plans.plan_id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(String(50), nullable=False, index=True)
    block_id = Column(String(50), nullable=False, index=True)
    start_time = Column(String(30), nullable=True)
    end_time = Column(String(30), nullable=True)
    bundled_with = Column(JSON, default=list)  # List[task_id]
    explanation = Column(Text, nullable=True)
    factor_breakdown = Column(JSON, default=dict)
    status = Column(String(30), default="Scheduled")
    data_label = Column(String(50), default="DEMO DATA")

    plan = relationship("SchedulePlan", back_populates="assignments")


# ============================================================================
# WHAT-IF SCENARIOS
# ============================================================================

class Scenario(Base):
    __tablename__ = "scenarios"

    scenario_id = Column(String(50), primary_key=True, default=lambda: f"SCN-{uuid.uuid4().hex[:8].upper()}")
    base_plan_id = Column(String(50), nullable=True)
    scenario_name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    parameters = Column(JSON, default=dict)  # {"duration_bonus": 1.0, "crews": 1, "allow_bundling": True}
    kpis = Column(JSON, default=dict)        # {"scheduled": 15, "utilization": 82.5}
    delta = Column(JSON, default=dict)       # {"task_delta": +3, "utilization_delta": +12.5}
    created_by = Column(String(100), default="Senior Operations Planner")
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================================================
# EXECUTION TRACKING (PLAN VS ACTUAL)
# ============================================================================

class ExecutionRecord(Base):
    __tablename__ = "execution_records"

    id = Column(String(50), primary_key=True, default=lambda: f"EXEC-{uuid.uuid4().hex[:8].upper()}")
    plan_id = Column(String(50), nullable=False, index=True)
    task_id = Column(String(50), nullable=False, index=True)
    block_id = Column(String(50), nullable=False, index=True)
    department = Column(String(50), nullable=False)
    section = Column(String(100), nullable=False)
    status = Column(String(30), default="READY", index=True)  # NOT_STARTED, READY, IN_PROGRESS, PAUSED, COMPLETED, FAILED, CANCELLED
    planned_start = Column(String(30), nullable=False)
    actual_start = Column(String(30), nullable=True)
    planned_end = Column(String(30), nullable=False)
    actual_end = Column(String(30), nullable=True)
    planned_duration_hours = Column(Float, default=2.0)
    actual_duration_hours = Column(Float, nullable=True)
    delay_minutes = Column(Integer, default=0)
    progress_percent = Column(Integer, default=0)
    assigned_team = Column(String(100), default="Delhi Central Maintenance Gang #1")
    resources_deployed = Column(JSON, default=list)
    issue_notes = Column(Text, nullable=True)
    completion_notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================================================
# NOTIFICATIONS & AUDIT TRAILS
# ============================================================================

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(50), primary_key=True, default=lambda: f"NOTIF-{uuid.uuid4().hex[:8].upper()}")
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    recipient_role = Column(String(50), nullable=True)  # ADMIN, PLANNER, etc. (null = all)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), default="SYSTEM")  # REQUEST, CONFLICT, OPTIMIZATION, APPROVAL, EXECUTION, SYSTEM
    is_read = Column(Boolean, default=False, index=True)
    link_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    recipient = relationship("User", back_populates="notifications")


class AuditLog(Base):
    """
    Append-Only Audit Trail: Records every operational interaction, plan approval,
    override, and status change with authorizer role and before/after values.
    """
    __tablename__ = "audit_logs"

    log_id = Column(String(50), primary_key=True, index=True, default=lambda: f"LOG-{uuid.uuid4().hex[:8].upper()}")
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    user_id = Column(String(50), nullable=True)
    user_name = Column(String(100), default="Senior Operations Planner")
    user_role = Column(String(50), default="Planner")    # ADMIN, PLANNER, CONTROL_OFFICER, ENGINEERING, TRD, SIGNAL_TELECOM, OPERATIONS
    action = Column(String(100), nullable=False, index=True)  # Plan Generated, Task Added, Plan Approved, Conflict Resolved, etc.
    target_id = Column(String(50), nullable=False, index=True)
    target_type = Column(String(50), nullable=False)     # TASK, PLAN, BLOCK, CONFLICT, ASSET, EXECUTION
    details = Column(Text, nullable=False)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    ip_address = Column(String(50), default="127.0.0.1")
    reason = Column(Text, nullable=True)
    status_change = Column(String(100), nullable=True)
    data_label = Column(String(50), default="DEMO DATA")


class DataSource(Base):
    __tablename__ = "data_sources"

    source_id = Column(String(50), primary_key=True, index=True)
    name = Column(String(50), nullable=False)            # BDMS, TMS, SMMS, TDMS, COA, GOODS_FORECAST
    full_name = Column(String(100), nullable=False)
    system_type = Column(String(100), nullable=False)
    status = Column(String(50), default="Connected (Demo Mode)")
    last_sync = Column(String(30), nullable=False)
    record_count = Column(Integer, default=0)
    description = Column(Text, nullable=False)
    data_label = Column(String(50), default="DEMO DATA")


class PlannerDecision(Base):
    __tablename__ = "planner_decisions"

    decision_id = Column(String(50), primary_key=True, index=True, default=lambda: f"DEC-{uuid.uuid4().hex[:8].upper()}")
    plan_id = Column(String(50), nullable=False, index=True)
    task_id = Column(String(50), nullable=True)
    action = Column(String(50), nullable=False)  # Approve, Reject, Modify, Override, Comment
    justification = Column(Text, nullable=False)
    planner_role = Column(String(50), default="Planner")
    timestamp = Column(DateTime, default=datetime.utcnow)
    data_label = Column(String(50), default="DEMO DATA")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    category = Column(String(50), default="general")  # priority_weights, solver_settings, corridor_rules
    value = Column(JSON, nullable=False)
    description = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
