from datetime import date, datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict

VALID_DEPARTMENTS = {
    "Engineering", "S&T", "Signal & Telecom", "Traction", "TRD", "Operations", "Operating", "Mechanical", "Safety"
}
VALID_CRITICALITY = {"Critical", "High", "Medium", "Low"}
VALID_STATUS = {"Pending", "Scheduled", "Bundled", "Approved", "Deferred", "In_Progress", "Completed", "Cancelled"}
VALID_ASSET_TYPES = {
    "Track", "Signal", "OHE", "Bridge", "Telecom", "Point Machine",
    "Traction Substation", "Track Circuit", "Electrical", "Equipment", "Other"
}

class MaintenanceTaskBase(BaseModel):
    task_id: str = Field(..., description="Unique task identifier, cannot be empty", min_length=1)
    department: str = Field(..., description="Engineering, TRD/Traction, S&T, Operations")
    asset_type: str = Field(..., description="Track, Signal, OHE, Bridge, Telecom, Point Machine, etc.")
    location: str = Field(..., description="Railway section location, e.g. Section A-B")
    description: str = Field(..., description="Detailed description of maintenance work", min_length=3)
    duration_hours: float = Field(..., description="Required duration in hours, must be greater than 0", gt=0.0)
    preferred_date: str = Field(..., description="Preferred maintenance date (YYYY-MM-DD)")
    deadline: str = Field(..., description="Deadline for task completion (YYYY-MM-DD)")
    criticality: str = Field(default="Medium", description="Critical, High, Medium, or Low")
    urgency: Optional[str] = Field(default="Normal", description="Immediate, High, Normal, Low")
    defect_severity: Optional[str] = Field(default="Medium", description="Critical, Severe, Moderate, Minor")
    operational_impact: Optional[str] = Field(default="Medium", description="Severe, High, Medium, Low")
    overdue: bool = Field(default=False, description="Whether task is past its maintenance due cycle")
    asset_id: Optional[str] = None
    corridor: Optional[str] = "Mainline Corridor Alpha"
    task_title: Optional[str] = None
    preferred_start: Optional[str] = None
    preferred_end: Optional[str] = None
    required_team_size: Optional[int] = 6
    required_resources: List[str] = Field(default_factory=list, description="Required equipment or gangs")
    dependencies: List[str] = Field(default_factory=list, description="List of precursor task IDs")
    compatible_departments: List[str] = Field(default_factory=list, description="Departments suitable for co-planning")
    safety_requirements: Optional[str] = None
    notes: Optional[str] = None
    status: str = Field(default="Pending", description="Pending, Scheduled, Deferred, In_Progress, Completed, Cancelled")

    @field_validator("task_id")
    @classmethod
    def validate_task_id(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Task ID cannot be empty or whitespace only.")
        return clean

    @field_validator("department")
    @classmethod
    def validate_department(cls, v: str) -> str:
        clean = v.strip()
        if clean not in VALID_DEPARTMENTS:
            # Map common synonyms
            if clean in ["TRD", "Traction"]:
                return clean
            if "signal" in clean.lower():
                return "Signal & Telecom"
            raise ValueError(f"Invalid department '{v}'. Allowed departments are: {', '.join(sorted(VALID_DEPARTMENTS))}")
        return clean

    @field_validator("criticality")
    @classmethod
    def validate_criticality(cls, v: str) -> str:
        if v not in VALID_CRITICALITY:
            raise ValueError(f"Invalid criticality '{v}'. Allowed values are: {', '.join(sorted(VALID_CRITICALITY))}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUS:
            raise ValueError(f"Invalid status '{v}'. Allowed values are: {', '.join(sorted(VALID_STATUS))}")
        return v

    model_config = ConfigDict(extra="ignore")

    @field_validator("asset_type")
    @classmethod
    def validate_asset_type(cls, v: str) -> str:
        clean = v.strip()
        # Direct match
        if clean in VALID_ASSET_TYPES:
            return clean
        # Common synonym normalization
        lower = clean.lower()
        if "track" in lower or "rail" in lower or "tamp" in lower or "ballast" in lower:
            return "Track"
        if "signal" in lower or "interlock" in lower:
            return "Signal"
        if "ohe" in lower or "catenary" in lower or "traction" in lower or "pantograph" in lower:
            return "OHE"
        if "point" in lower or "switch" in lower:
            return "Point Machine"
        if "bridge" in lower or "culvert" in lower:
            return "Bridge"
        if "telecom" in lower or "comms" in lower or "ofc" in lower:
            return "Telecom"
        raise ValueError(f"Invalid asset type '{v}'. Allowed types are: {', '.join(sorted(VALID_ASSET_TYPES))}")

    @field_validator("preferred_date")
    @classmethod
    def validate_preferred_date(cls, v: str) -> str:
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"Invalid preferred_date format '{v}'. Expected YYYY-MM-DD.")
        return v

    @field_validator("deadline")
    @classmethod
    def validate_deadline(cls, v: str) -> str:
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"Invalid deadline format '{v}'. Expected YYYY-MM-DD.")
        return v

    @model_validator(mode="after")
    def validate_deadline_after_preferred(self) -> "MaintenanceTaskBase":
        pref = date.fromisoformat(self.preferred_date)
        dead = date.fromisoformat(self.deadline)
        if dead < pref:
            raise ValueError(
                f"Deadline ({self.deadline}) cannot be before preferred start date ({self.preferred_date})."
            )
        return self


class MaintenanceTaskCreate(MaintenanceTaskBase):
    pass


class MaintenanceTaskUpdate(BaseModel):
    department: Optional[str] = None
    asset_type: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    duration_hours: Optional[float] = Field(default=None, gt=0.0)
    preferred_date: Optional[str] = None
    deadline: Optional[str] = None
    criticality: Optional[str] = None
    overdue: Optional[bool] = None
    required_resources: Optional[List[str]] = None
    dependencies: Optional[List[str]] = None
    compatible_departments: Optional[List[str]] = None
    status: Optional[str] = None
    assigned_block_id: Optional[str] = None

    @field_validator("department")
    @classmethod
    def validate_department_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_DEPARTMENTS:
            raise ValueError(f"Invalid department '{v}'. Allowed departments are: {', '.join(sorted(VALID_DEPARTMENTS))}")
        return v

    @field_validator("criticality")
    @classmethod
    def validate_criticality_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_CRITICALITY:
            raise ValueError(f"Invalid criticality '{v}'. Allowed values are: {', '.join(sorted(VALID_CRITICALITY))}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_STATUS:
            raise ValueError(f"Invalid status '{v}'. Allowed values are: {', '.join(sorted(VALID_STATUS))}")
        return v

    @field_validator("preferred_date")
    @classmethod
    def validate_pref_date_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            try:
                date.fromisoformat(v)
            except ValueError:
                raise ValueError(f"Invalid preferred_date format '{v}'. Expected YYYY-MM-DD.")
        return v

    @field_validator("deadline")
    @classmethod
    def validate_deadline_opt(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            try:
                date.fromisoformat(v)
            except ValueError:
                raise ValueError(f"Invalid deadline format '{v}'. Expected YYYY-MM-DD.")
        return v

    @model_validator(mode="after")
    def validate_deadline_dates(self) -> "MaintenanceTaskUpdate":
        if self.preferred_date and self.deadline:
            pref = date.fromisoformat(self.preferred_date)
            dead = date.fromisoformat(self.deadline)
            if dead < pref:
                raise ValueError(
                    f"Deadline ({self.deadline}) cannot be before preferred start date ({self.preferred_date})."
                )
        return self


class MaintenanceTaskResponse(MaintenanceTaskBase):
    priority_score: float = 0.0
    priority_factors: Optional[Any] = Field(default_factory=dict)
    assigned_block_id: Optional[str] = None
    data_source: str = "BDMS"
    data_label: str = "DEMO DATA"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TrainMovementResponse(BaseModel):
    train_no: str
    train_name: str
    train_type: str
    section: str
    direction: str
    scheduled_departure: str
    scheduled_arrival: str
    priority_rank: int
    speed_kmph: float
    data_label: str = "DEMO DATA"

    model_config = ConfigDict(from_attributes=True)


class BlockWindowResponse(BaseModel):
    block_id: str
    section: str
    direction: str
    date: str
    start_time: str
    end_time: str
    max_duration_hours: float
    status: str
    corridor_name: str
    data_label: str = "DEMO DATA"

    model_config = ConfigDict(from_attributes=True)


class ResourceResponse(BaseModel):
    resource_id: str
    name: str
    resource_type: str
    department: str
    home_depot: str
    available: bool
    data_label: str = "DEMO DATA"

    model_config = ConfigDict(from_attributes=True)


class DataSourceResponse(BaseModel):
    source_id: str
    name: str
    full_name: str
    system_type: str
    status: str
    last_sync: str
    record_count: int
    description: str
    data_label: str = "DEMO DATA"

    model_config = ConfigDict(from_attributes=True)


class AuditLogResponse(BaseModel):
    log_id: str
    timestamp: datetime
    user_role: str
    action: str
    target_id: str
    target_type: str
    details: str
    status_change: Optional[str] = None
    data_label: str = "DEMO DATA"

    model_config = ConfigDict(from_attributes=True)
