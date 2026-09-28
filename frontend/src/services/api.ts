import {
  MaintenanceTask,
  BlockWindow,
  TrainMovement,
  Resource,
  ConflictItem,
  SchedulePlan,
  DashboardSummary,
  DataSourceItem,
  CompatibilityBundle,
  Asset,
  AssetDefect,
  ExecutionRecord,
  InAppNotification,
  GlobalSearchResult,
  WeeklyPlanSection,
  MonthlyPlanDay,
  User,
  AuthResponse,
  TaskValidationResponse,
  TaskResolvePayload,
  TaskResolveResponse
} from "../types";

const LIVE_BACKEND_URL = "https://margsetu.onrender.com";

function getBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  
  // If an explicit valid URL is set (not an unresolved placeholder)
  if (envUrl && !envUrl.includes("<") && !envUrl.includes(">") && !envUrl.includes("your-render-backend-url")) {
    return envUrl.replace(/\/+$/, "").replace(/\/api$/, "");
  }

  // When deployed to production (e.g. Vercel), automatically point to the live Render backend
  if (import.meta.env.PROD || (typeof window !== "undefined" && !window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1"))) {
    return LIVE_BACKEND_URL;
  }

  // In local development, use empty string so Vite proxy handles /api to port 8001
  return "";
}

export const API_BASE_URL = getBaseUrl();

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("rail_access_token");
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  let path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  // Prevent duplicate /api/api path segments
  if (path.startsWith("/api/api/")) {
    path = path.replace(/^\/api\/api\//, "/api/");
  }

  const url = `${API_BASE_URL}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
        ...(options?.headers || {})
      }
    });
  } catch (networkErr: any) {
    throw new Error(
      `Unable to reach backend at ${API_BASE_URL} (${networkErr?.message || "Connection failed"}). Ensure backend is active on port 8001.`
    );
  }

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const err = await response.json();
      if (typeof err.detail === "string") {
        errorDetail = err.detail;
      } else if (Array.isArray(err.detail)) {
        errorDetail = err.detail
          .map((d: any) => (d.msg ? `${d.loc ? d.loc.slice(-1)[0] + ": " : ""}${d.msg}` : JSON.stringify(d)))
          .join("; ");
      } else if (err.message && typeof err.message === "string") {
        errorDetail = err.message;
      } else if (err.detail) {
        errorDetail = JSON.stringify(err.detail);
      }
    } catch {
      // Fallback
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  login: (data: { email: string; password: string }) =>
    fetchJson<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  register: (data: { email: string; password: string; full_name: string; role?: string; department?: string }) =>
    fetchJson<User>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  getMe: () => fetchJson<User>("/api/auth/me"),

  changePassword: (data: { old_password: string; new_password: string }) =>
    fetchJson<{ message: string }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  // Health & Overview
  getHealth: () => fetchJson<{ status: string; mode?: string }>("/api/health"),
  getDashboardSummary: () => fetchJson<DashboardSummary>("/api/dashboard/summary"),

  // Maintenance Tasks
  getTasks: (params?: { department?: string; status?: string; location?: string; criticality?: string }) => {
    const query = new URLSearchParams();
    if (params?.department) query.append("department", params.department);
    if (params?.status) query.append("status", params.status);
    if (params?.location) query.append("location", params.location);
    if (params?.criticality) query.append("criticality", params.criticality);
    const qs = query.toString();
    return fetchJson<MaintenanceTask[]>(`/api/tasks${qs ? `?${qs}` : ""}`);
  },

  getTaskById: (taskId: string) => fetchJson<MaintenanceTask>(`/api/tasks/${taskId}`),

  getTaskValidation: (taskId: string) =>
    fetchJson<TaskValidationResponse>(`/api/tasks/${taskId}/validation`),

  resolveTaskConflict: (taskId: string, payload: TaskResolvePayload) =>
    fetchJson<TaskResolveResponse>(`/api/tasks/${taskId}/resolve`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  createTask: (data: Partial<MaintenanceTask>) =>
    fetchJson<MaintenanceTask>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  updateTask: (taskId: string, data: Partial<MaintenanceTask>) =>
    fetchJson<MaintenanceTask>(`/api/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),

  deleteTask: (taskId: string) =>
    fetchJson<{ message: string }>(`/api/tasks/${taskId}`, {
      method: "DELETE"
    }),

  importDemoTasks: () =>
    fetchJson<{ status: string; records_imported: number; total_active: number; message?: string }>("/api/tasks/import-demo", {
      method: "POST"
    }),

  recalculatePriorities: () =>
    fetchJson<{
      status: string;
      tasks_recalculated: number;
      category_distribution: Record<string, number>;
      formula: string;
    }>("/api/priority/recalculate", {
      method: "POST"
    }),

  // Assets Management
  getAssets: (params?: { department?: string; status?: string; corridor_name?: string }) => {
    const query = new URLSearchParams();
    if (params?.department) query.append("department", params.department);
    if (params?.status) query.append("status", params.status);
    if (params?.corridor_name) query.append("corridor_name", params.corridor_name);
    const qs = query.toString();
    return fetchJson<Asset[]>(`/api/assets${qs ? `?${qs}` : ""}`);
  },

  getAssetById: (assetId: string) => fetchJson<Asset>(`/api/assets/${assetId}`),

  createAsset: (data: Partial<Asset>) =>
    fetchJson<Asset>("/api/assets", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  updateAsset: (assetId: string, data: Partial<Asset>) =>
    fetchJson<Asset>(`/api/assets/${assetId}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),

  deleteAsset: (assetId: string) =>
    fetchJson<{ message: string }>(`/api/assets/${assetId}`, {
      method: "DELETE"
    }),

  getAssetDefects: (assetId: string) => fetchJson<AssetDefect[]>(`/api/assets/${assetId}/defects`),

  logAssetDefect: (assetId: string, data: { description: string; severity: string }) =>
    fetchJson<AssetDefect>(`/api/assets/${assetId}/defects`, {
      method: "POST",
      body: JSON.stringify(data)
    }),

  // Block Windows
  getBlockWindows: (params?: { corridor_name?: string; date?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.corridor_name) query.append("corridor_name", params.corridor_name);
    if (params?.date) query.append("date", params.date);
    if (params?.status) query.append("status", params.status);
    const qs = query.toString();
    return fetchJson<BlockWindow[]>(`/api/block-windows${qs ? `?${qs}` : ""}`);
  },

  createBlockWindow: (data: Partial<BlockWindow>) =>
    fetchJson<BlockWindow>("/api/block-windows", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  deleteBlockWindow: (blockId: string) =>
    fetchJson<{ message: string }>(`/api/block-windows/${blockId}`, {
      method: "DELETE"
    }),

  // Timetable & Train Movements
  getTrainMovements: (params?: { section?: string; direction?: string }) => {
    const query = new URLSearchParams();
    if (params?.section) query.append("section", params.section);
    if (params?.direction) query.append("direction", params.direction);
    const qs = query.toString();
    return fetchJson<TrainMovement[]>(`/api/train-movements${qs ? `?${qs}` : ""}`);
  },

  createTrainMovement: (data: Partial<TrainMovement>) =>
    fetchJson<TrainMovement>("/api/train-movements", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  deleteTrainMovement: (trainNo: string) =>
    fetchJson<{ message: string }>(`/api/train-movements/${trainNo}`, {
      method: "DELETE"
    }),

  uploadTimetableCSV: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE_URL}/api/timetable/import-csv`, {
      method: "POST",
      headers: { ...getAuthHeader() },
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "CSV import failed");
    }
    return res.json() as Promise<{ status: string; records_imported: number }>;
  },

  // Conflict Detection & Incident Room
  getConflicts: (params?: { severity?: string; conflict_type?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.severity) query.append("severity", params.severity);
    if (params?.conflict_type) query.append("conflict_type", params.conflict_type);
    if (params?.status) query.append("status", params.status);
    const qs = query.toString();
    return fetchJson<ConflictItem[]>(`/api/conflicts${qs ? `?${qs}` : ""}`);
  },

  detectConflicts: () =>
    fetchJson<{
      status: string;
      total_conflicts_detected: number;
      conflicts: ConflictItem[];
      summary: any;
    }>("/api/conflicts/detect", {
      method: "POST"
    }),

  resolveConflict: (conflictId: string, data: { resolution_notes: string; resolution_strategy?: string; resolution_action?: string }) =>
    fetchJson<{ status: string; conflict_id: string; resolution: string }>(`/api/conflicts/${conflictId}/resolve`, {
      method: "POST",
      body: JSON.stringify(data)
    }),

  ignoreConflict: (conflictId: string, data: { reason: string }) =>
    fetchJson<{ status: string; conflict_id: string; status_change: string }>(`/api/conflicts/${conflictId}/ignore`, {
      method: "POST",
      body: JSON.stringify(data)
    }),

  // Optimization Plans & Candidate Generation (Plan A, B, C)
  getOptimizationPlans: () => fetchJson<SchedulePlan[]>("/api/optimization/plans"),

  getOptimizationPlanById: (planId: string) =>
    fetchJson<SchedulePlan>(`/api/optimization/plans/${planId}`),

  generateOptimizationPlans: (params?: {
    strategy_type?: string;
    block_duration_bonus_hours?: number;
    additional_crew_count?: number;
    allow_bundling?: boolean;
  }) =>
    fetchJson<{
      status: string;
      solver: string;
      plans_generated_count: number;
      plans: SchedulePlan[];
    }>("/api/optimization/generate", {
      method: "POST",
      body: JSON.stringify(params || { strategy_type: "ALL" })
    }),

  approvePlan: (planId: string, data: { user_name: string; user_role: string; comments?: string }) =>
    fetchJson<{ status: string; new_status: string; approved_by: string }>(`/api/plans/${planId}/approve`, {
      method: "POST",
      body: JSON.stringify(data)
    }),

  rejectPlan: (planId: string, data: { user_name: string; user_role: string; reason: string }) =>
    fetchJson<{ status: string; new_status: string; reason: string }>(`/api/plans/${planId}/reject`, {
      method: "POST",
      body: JSON.stringify(data)
    }),

  overridePlanAssignment: (planId: string, data: { task_id: string; target_block_id?: string; block_id?: string; reason: string; user_name?: string }) => {
    const payload = {
      task_id: data.task_id,
      target_block_id: data.target_block_id || data.block_id,
      reason: data.reason,
      user_name: data.user_name || "Senior Operations Planner"
    };
    return fetchJson<any>(`/api/plans/${planId}/manual-override`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  // Weekly & Monthly Planning
  getWeeklyPlan: (params?: { corridor?: string; start_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.corridor) query.append("corridor", params.corridor);
    if (params?.start_date) query.append("start_date", params.start_date);
    const qs = query.toString();
    return fetchJson<{ corridor_name: string; days: Record<string, { blocks: BlockWindow[]; tasks: MaintenanceTask[] }> }>(
      `/api/plans/weekly${qs ? `?${qs}` : ""}`
    );
  },

  getMonthlyPlan: (month?: number, year?: number) => {
    const query = new URLSearchParams();
    if (month) query.append("month", month.toString());
    if (year) query.append("year", year.toString());
    const qs = query.toString();
    return fetchJson<{ month: number; year: number; days: MonthlyPlanDay[] }>(`/api/plans/monthly${qs ? `?${qs}` : ""}`);
  },

  // Execution Tracking (Plan vs Actual)
  getExecutionRecords: (params?: { status?: string; task_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append("status", params.status);
    if (params?.task_id) query.append("task_id", params.task_id);
    const qs = query.toString();
    return fetchJson<ExecutionRecord[]>(`/api/execution${qs ? `?${qs}` : ""}`);
  },

  updateExecutionRecord: (executionId: string, data: {
    status: string;
    actual_start_time?: string;
    actual_end_time?: string;
    work_summary?: string;
    crew_lead?: string;
  }) =>
    fetchJson<ExecutionRecord>(`/api/execution/${executionId}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),

  getPlanVsActual: () => fetchJson<{
    total_executions: number;
    completed: number;
    in_progress: number;
    average_variance_minutes: number;
    delay_incidents: number;
    records: ExecutionRecord[];
  }>("/api/execution/plan-vs-actual"),

  // Analytics & KPIs
  getAnalyticsKPIs: () => fetchJson<any>("/api/analytics/kpis"),
  getDepartmentWorkload: () => fetchJson<any[]>("/api/analytics/department-workload"),
  getBlockUtilization: () => fetchJson<any[]>("/api/analytics/block-utilization"),
  getDelayTrends: () => fetchJson<any[]>("/api/analytics/delay-trends"),

  // Reports Hub
  getExecutionReportCsvUrl: () => `${API_BASE_URL}/api/reports/execution/csv`,
  getPlanReportJsonUrl: (planId: string) => `${API_BASE_URL}/api/reports/plan/${planId}/json`,

  // Notifications
  getNotifications: (unreadOnly = false) =>
    fetchJson<InAppNotification[]>(`/api/notifications?unread_only=${unreadOnly}`),

  markNotificationRead: (notificationId: string) =>
    fetchJson<{ message: string }>(`/api/notifications/${notificationId}/read`, {
      method: "POST"
    }),

  markAllNotificationsRead: () =>
    fetchJson<{ message: string }>("/api/notifications/read-all", {
      method: "POST"
    }),

  // Admin & System Settings
  getSystemSettings: () => fetchJson<{ weights: Record<string, number>; max_solver_time_seconds: number }>("/api/admin/settings"),

  updatePriorityWeights: (weights: Record<string, number>) =>
    fetchJson<{ status: string; updated_weights: Record<string, number> }>("/api/admin/priority-weights", {
      method: "POST",
      body: JSON.stringify(weights)
    }),

  getSystemHealth: () => fetchJson<any>("/api/admin/health"),
  getUsers: () => fetchJson<User[]>("/api/admin/users"),

  // Unified Global Search
  searchAll: (query: string) =>
    fetchJson<{ query: string; total_results: number; results: GlobalSearchResult[] }>(
      `/api/search?q=${encodeURIComponent(query)}`
    ),

  // Simulation & Compatibility
  runSimulation: (params: {
    block_duration_bonus_hours: number;
    additional_crew_count: number;
    allow_bundling: boolean;
    strategy_type: string;
  }) =>
    fetchJson<{
      status: string;
      baseline_kpis: any;
      simulated_kpis: any;
      delta: any;
      impact_summary: string;
      simulated_scheduled_assignments: any[];
      simulated_deferred_tasks: any[];
    }>("/api/simulation/run", {
      method: "POST",
      body: JSON.stringify(params)
    }),

  getCompatibilityBundles: () =>
    fetchJson<{
      status: string;
      bundles_identified_count: number;
      bundles: CompatibilityBundle[];
    }>("/api/compatibility/analyse"),

  getDataSources: () => fetchJson<DataSourceItem[]>("/api/data-sources"),
  getResources: () => fetchJson<Resource[]>("/api/resources"),
  getAuditLogs: (limit = 50) => fetchJson<any[]>(`/api/audit-logs?limit=${limit}`)
};
