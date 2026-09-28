export interface User {
  user_id: string;
  email: string;
  full_name: string;
  role: string; // "ADMIN" | "PLANNER" | "CONTROL_OFFICER" | "ENGINEERING" | "TRD" | "SIGNAL_TELECOM" | "OPERATIONS" | "VIEWER"
  department?: string;
  is_active: boolean;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  user: User;
}

export interface Asset {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  department: string;
  corridor_name: string;
  section: string;
  condition_score: number;
  status: string; // "OPERATIONAL" | "NEEDS_INSPECTION" | "DEFECT_REPORTED" | "CRITICAL" | "MAINTENANCE_IN_PROGRESS"
  health_status?: string;
  installation_date?: string;
  last_inspection_date?: string;
  created_at?: string;
}

export interface AssetDefect {
  defect_id: string;
  asset_id: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  reported_by?: string;
  reported_at: string;
  resolved_at?: string | null;
}

export interface MaintenanceTask {
  task_id: string;
  department: string;
  asset_type: string;
  asset_id?: string | null;
  location: string;
  description: string;
  duration_hours: number;
  preferred_date: string;
  deadline: string;
  criticality: string;
  overdue: boolean;
  required_resources: string[];
  dependencies: string[];
  compatible_departments: string[];
  status: string; // "PENDING" | "SCHEDULED" | "DEFERRED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
  priority_score: number;
  priority_factors?: {
    criticality_points?: number;
    deadline_urgency_points?: number;
    urgency_reason?: string;
    overdue_points?: number;
    operational_impact_points?: number;
    impact_level?: string;
    age_factor_points?: number;
    total_score?: number;
    category?: string;
  };
  assigned_block_id?: string | null;
  data_source?: string;
  data_label?: string;
  created_at?: string;
}

export interface BlockWindow {
  block_id: string;
  section: string;
  direction: "UP" | "DOWN" | "BOTH" | string;
  date: string;
  start_time: string;
  end_time: string;
  max_duration_hours: number;
  status: string; // "AVAILABLE" | "BOOKED" | "IN_PROGRESS" | "COMPLETED"
  corridor_name?: string;
  assigned_tasks_count?: number;
}

export interface TrainMovement {
  train_no: string;
  train_name: string;
  train_type: string;
  section: string;
  direction: "UP" | "DOWN" | string;
  scheduled_departure: string;
  scheduled_arrival: string;
  priority_rank: number;
  speed_kmph: number;
  operating_days?: string[];
}

export interface Resource {
  resource_id: string;
  name: string;
  resource_type: string;
  department: string;
  home_depot: string;
  available: boolean;
}

export interface ConflictItem {
  conflict_id: string;
  conflict_type: string;
  severity: "CRITICAL" | "HIGH" | "WARNING" | "MEDIUM" | "LOW" | string;
  affected_tasks: string[];
  affected_trains: string[];
  explanation: string;
  suggested_resolution: string;
  status: "OPEN" | "RESOLVED" | "IGNORED" | string;
  detected_at?: string;
}

export interface PlanKPIs {
  total_tasks: number;
  scheduled_count: number;
  deferred_count: number;
  utilization_rate: number;
  used_block_hours?: number;
  total_available_hours?: number;
  critical_coverage: number;
  critical_tasks_scheduled?: number;
  total_critical_tasks?: number;
  bundled_blocks_count: number;
  active_blocks_count: number;
  total_available_blocks: number;
  estimated_delay_minutes?: number;
  power_shutdown_hours?: number;
}

export interface ScheduleAssignment {
  assignment_id: string;
  task_id: string;
  task: MaintenanceTask;
  block_id: string;
  block: BlockWindow;
  bundled_with: string[];
  explanation: {
    summary: string;
    rule_based_reasons?: string[];
    reasons?: string[];
  };
}

export interface DeferredTaskItem {
  task_id: string;
  task: MaintenanceTask;
  explanation: {
    summary: string;
    rule_based_reasons?: string[];
    reasons?: string[];
  };
}

export interface SchedulePlan {
  plan_id: string;
  plan_name: string;
  strategy_type: "MIN_TRAIN_DELAY" | "MAX_THROUGHPUT" | "BALANCED" | string;
  description?: string;
  status: "DRAFT" | "PROPOSED" | "APPROVED" | "REJECTED" | "SANCTIONED" | string;
  kpis: PlanKPIs;
  total_tasks?: number;
  scheduled_count?: number;
  deferred_count?: number;
  conflict_count?: number;
  utilization_rate?: number;
  critical_coverage?: number;
  objective_score?: number;
  objective_value?: number;
  scheduled_assignments?: ScheduleAssignment[];
  deferred_tasks?: DeferredTaskItem[];
  created_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  notes?: string | null;
}

export interface ExecutionRecord {
  execution_id: string;
  task_id: string;
  block_id: string;
  planned_start_time?: string;
  planned_end_time?: string;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  duration_hours: number;
  actual_duration_hours?: number | null;
  variance_minutes?: number | null;
  status: "READY" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" | "ABORTED";
  work_summary?: string | null;
  crew_lead?: string | null;
  created_at?: string;
  updated_at?: string;
  task?: MaintenanceTask;
  block?: BlockWindow;
}

export interface DashboardSummary {
  kpis: {
    total_maintenance_requests: number;
    high_priority_tasks: number;
    conflicts_detected: number;
    scheduled_tasks: number;
    deferred_tasks: number;
    block_utilisation_rate: number;
    block_utilization_rate?: number;
    critical_task_coverage: number;
    total_assets?: number;
    active_executions?: number;
  };
  department_summary: Record<string, number>;
  priority_distribution: {
    Critical: number;
    High: number;
    Medium: number;
    Low: number;
  };
  conflict_summary: {
    total: number;
    critical: number;
    warning: number;
    timetable: number;
    resource: number;
    location: number;
    dependency: number;
    duration: number;
  };
  critical_tasks_requiring_attention: Array<{
    task_id: string;
    department: string;
    asset_type: string;
    location: string;
    description: string;
    priority_score: number;
    deadline: string;
    overdue: boolean;
    status: string;
  }>;
  recent_planner_activity: Array<{
    log_id: string;
    timestamp: string;
    user_role: string;
    action: string;
    target_id: string;
    details: string;
    status_change?: string | null;
  }>;
  disclaimer: string;
}

export interface DataSourceItem {
  source_id: string;
  name: string;
  full_name: string;
  system_type: string;
  status: string;
  last_sync: string;
  record_count: number;
  description: string;
}

export interface CompatibilityBundle {
  bundle_id: string;
  bundle_name: string;
  location: string;
  departments: string[];
  task_ids: string[];
  tasks: Array<{
    task_id: string;
    department: string;
    asset_type: string;
    description: string;
    duration_hours: number;
    criticality: string;
  }>;
  compatibility_score: number;
  parallel_duration_hours: number;
  recommended_block_id: string | null;
  reasons: string[];
  estimated_traffic_path_savings: string;
}

export interface InAppNotification {
  notification_id?: string;
  id?: string;
  title: string;
  message: string;
  type?: "INFO" | "WARNING" | "CRITICAL" | "SUCCESS" | string;
  notification_type?: string;
  read?: boolean;
  is_read?: boolean;
  link?: string;
  link_url?: string;
  created_at?: string;
}

export interface GlobalSearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: "TASK" | "ASSET" | "BLOCK" | "TRAIN" | "CONFLICT" | "PLAN";
  url: string;
}

export interface WeeklyPlanSection {
  corridor: string;
  days: {
    [dayName: string]: {
      date: string;
      blocks: BlockWindow[];
      tasks: MaintenanceTask[];
    };
  };
}

export interface MonthlyPlanDay {
  date: string;
  day_of_month: number;
  day_of_week: string;
  total_blocks: number;
  total_tasks: number;
  high_priority_tasks: number;
  density_level: "EMPTY" | "LOW" | "MEDIUM" | "HIGH" | "PEAK";
}

export interface TaskValidationCheck {
  id: string;
  name: string;
  status: "Passed" | "Failed" | "Warning";
  reason: string;
}

export interface TaskValidationCandidate {
  task_id: string;
  department: string;
  description: string;
  duration_hours: number;
  preferred_date: string;
}

export interface TaskValidationBlockOption {
  block_id: string;
  section: string;
  date: string;
  start_time: string;
  end_time: string;
  duration: number;
  block_type: string;
  status: string;
}

export interface SuggestedResolutionOption {
  action: "BUNDLE_TASKS" | "LINK_TIMETABLE" | "ADJUST_WINDOW" | string;
  title: string;
  description: string;
  candidates?: TaskValidationCandidate[];
  blocks?: TaskValidationBlockOption[];
}

export interface TaskValidationConflict {
  conflict_id: string;
  conflict_type: string;
  severity: string;
  affected_tasks: string[];
  affected_trains: string[];
  affected_corridor: string;
  start_time?: string | null;
  end_time?: string | null;
  explanation: string;
  suggested_resolution: string;
  status: string;
}

export interface TaskValidationResponse {
  task_id: string;
  task_title: string;
  department: string;
  location: string;
  status: string;
  assigned_block_id?: string | null;
  overall_status: "Passed" | "Failed" | "Warning";
  has_conflicts: boolean;
  checks: TaskValidationCheck[];
  conflicts: TaskValidationConflict[];
  suggested_resolutions: SuggestedResolutionOption[];
}

export interface TaskResolvePayload {
  resolution_action: "BUNDLE_TASKS" | "LINK_TIMETABLE" | "ADJUST_WINDOW" | string;
  target_block_id?: string;
  target_date?: string;
  notes?: string;
  user_name?: string;
}

export interface TaskResolveResponse {
  status: string;
  message: string;
  task_id: string;
  task_status: string;
  assigned_block_id?: string;
  resolved_conflicts: string[];
  task?: MaintenanceTask;
}

