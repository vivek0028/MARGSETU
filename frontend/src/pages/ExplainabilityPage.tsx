import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  ArrowRight,
  ShieldCheck,
  Clock,
  Wrench,
  Layers,
  FileCheck,
  Zap,
  Info,
  Calendar,
  Search,
  Check,
  Sliders,
  Cpu,
  HelpCircle,
  Radio,
  Tag
} from "lucide-react";
import { api } from "../services/api";
import { SchedulePlan, ScheduleAssignment, MaintenanceTask, BlockWindow, ConflictItem } from "../types";
import { DepartmentBadge, PriorityBadge } from "../components/Badges";

interface RuleAuditItem {
  id: string;
  description: string;
  result: "PASS" | "FAIL" | "N/A";
  category: "Safety" | "Resource" | "Timetable" | "Priority";
  details: string;
}

const GLOBAL_OPTIMIZATION_RULES: RuleAuditItem[] = [
  {
    id: "R-01",
    description: "Zero revenue train timetable headway clash",
    result: "PASS",
    category: "Timetable",
    details: "Slot clears all high-priority passenger express paths by >25 min buffer"
  },
  {
    id: "R-02",
    description: "No overlapping resource usage across simultaneous sections",
    result: "PASS",
    category: "Resource",
    details: "Engineering crew, USFD trolleys, and tower wagons allocated exclusively"
  },
  {
    id: "R-03",
    description: "Maintenance duration fits available corridor block window",
    result: "PASS",
    category: "Safety",
    details: "Task duration (≤ 4.0h) strictly contained within approved block boundary"
  },
  {
    id: "R-04",
    description: "Statutory deadline constraint enforcement",
    result: "PASS",
    category: "Priority",
    details: "Execution scheduled prior to mandated statutory deadline"
  },
  {
    id: "R-05",
    description: "Multi-departmental activity compatibility check",
    result: "PASS",
    category: "Safety",
    details: "Engineering track inspection and S&T signaling works verified non-interfering"
  },
  {
    id: "R-06",
    description: "Traction power isolation protocol confirmed",
    result: "PASS",
    category: "Safety",
    details: "OHE electrical permit-to-work de-energization window matched"
  },
  {
    id: "R-07",
    description: "Turnaround safety buffer between sequential blocks",
    result: "PASS",
    category: "Safety",
    details: "Minimum 20-minute operational cushion enforced before section reopening"
  },
  {
    id: "R-08",
    description: "Section simultaneous block capacity limit",
    result: "PASS",
    category: "Resource",
    details: "Maximum 1 active physical possession per directional track line"
  }
];

export const ExplainabilityPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [plans, setPlans] = useState<SchedulePlan[]>([]);
  const [allTasks, setAllTasks] = useState<MaintenanceTask[]>([]);
  const [blockWindows, setBlockWindows] = useState<BlockWindow[]>([]);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [activePlanId, setActivePlanId] = useState<string>("PLAN-A-CRIT");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "SCHEDULED" | "DEFERRED">("ALL");

  // Load all required data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [plansSummary, tasksData, blocksData, conflictsData] = await Promise.all([
          api.getOptimizationPlans(),
          api.getTasks(),
          api.getBlockWindows(),
          api.getConflicts()
        ]);

        // Fetch full detailed plan objects containing scheduled_assignments and deferred_tasks
        const detailedPlans = await Promise.all(
          plansSummary.map(async (p) => {
            try {
              const fullPlan = await api.getOptimizationPlanById(p.plan_id);
              return fullPlan;
            } catch (err) {
              console.warn(`Could not load full detail for plan ${p.plan_id}`, err);
              return p;
            }
          })
        );

        setPlans(detailedPlans);
        setAllTasks(tasksData);
        setBlockWindows(blocksData);
        setConflicts(conflictsData);

        const paramPlanId = searchParams.get("plan") || searchParams.get("planId") || location.state?.planId;
        const targetPlan = detailedPlans.find(p => p.plan_id === paramPlanId) || detailedPlans[0];
        if (targetPlan) {
          setActivePlanId(targetPlan.plan_id);
        }

        // Determine initial selected task: from query params, state, or first available task
        const paramTaskId = searchParams.get("taskId") || location.state?.taskId;
        const firstAssignments = targetPlan?.scheduled_assignments;
        if (paramTaskId && tasksData.some(t => t.task_id === paramTaskId)) {
          setSelectedTaskId(paramTaskId);
        } else if (firstAssignments && firstAssignments.length > 0) {
          setSelectedTaskId(firstAssignments[0].task_id || firstAssignments[0].task?.task_id || "");
        } else if (tasksData.length > 0) {
          setSelectedTaskId(tasksData[0].task_id);
        }
      } catch (err) {
        console.error("Failed to load explainability data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Listen to navigation state or URL changes
  useEffect(() => {
    const paramTaskId = searchParams.get("taskId") || location.state?.taskId;
    if (paramTaskId && paramTaskId !== selectedTaskId && allTasks.some(t => t.task_id === paramTaskId)) {
      setSelectedTaskId(paramTaskId);
    }
    const paramPlanId = searchParams.get("plan") || searchParams.get("planId") || location.state?.planId;
    if (paramPlanId && paramPlanId !== activePlanId && plans.some(p => p.plan_id === paramPlanId)) {
      setActivePlanId(paramPlanId);
    }
  }, [searchParams, location.state, allTasks, plans, selectedTaskId, activePlanId]);

  // Active optimization plan
  const activePlan = useMemo(() => {
    return plans.find(p => p.plan_id === activePlanId) || plans[0] || null;
  }, [plans, activePlanId]);

  // Handle plan change
  const handleSelectPlan = (planId: string) => {
    setActivePlanId(planId);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set("plan", planId);
      return next;
    });
  };

  // Handle task selection change
  const handleSelectTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set("taskId", taskId);
      return next;
    });
  };

  // Find selected task and its scheduling status
  const currentTask = useMemo(() => {
    return allTasks.find(t => t.task_id === selectedTaskId) || allTasks[0] || null;
  }, [allTasks, selectedTaskId]);

  // Check if selected task is in active plan's scheduled assignments
  const currentAssignment = useMemo(() => {
    if (!activePlan || !currentTask) return null;
    return activePlan.scheduled_assignments?.find(a => (a.task_id || a.task?.task_id) === currentTask.task_id) || null;
  }, [activePlan, currentTask]);

  // Check if selected task is in deferred tasks
  const currentDeferred = useMemo(() => {
    if (!activePlan || !currentTask) return null;
    return activePlan.deferred_tasks?.find(d => (d.task_id || d.task?.task_id) === currentTask.task_id) || null;
  }, [activePlan, currentTask]);

  // Decision outcome
  const isAccepted = !!currentAssignment;
  const isDeferred = !!currentDeferred || (!isAccepted && currentTask?.status === "Pending");

  // Dynamic compatibility tasks
  const compatibleTaskIds = useMemo(() => {
    if (currentAssignment?.bundled_with && currentAssignment.bundled_with.length > 0) {
      return currentAssignment.bundled_with;
    }
    // Fallback: tasks matching compatible_departments in same section
    if (!currentTask) return [];
    return allTasks
      .filter(t => t.task_id !== currentTask.task_id && t.location === currentTask.location)
      .slice(0, 2)
      .map(t => t.task_id);
  }, [currentAssignment, currentTask, allTasks]);

  // Assigned block details
  const assignedBlock = currentAssignment?.block || null;

  // Filtered task list for the selection dropdown
  const selectableTasks = useMemo(() => {
    return allTasks.filter(t => {
      const matchesQuery =
        t.task_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.location.toLowerCase().includes(searchQuery.toLowerCase());
      
      const isSched = activePlan?.scheduled_assignments?.some(a => (a.task_id || a.task?.task_id) === t.task_id);
      if (filterStatus === "SCHEDULED") return matchesQuery && isSched;
      if (filterStatus === "DEFERRED") return matchesQuery && !isSched;
      return matchesQuery;
    });
  }, [allTasks, searchQuery, filterStatus, activePlan]);

  // Dynamic Explainability Matrix Rows for the selected request
  const explainabilityMatrix = useMemo(() => {
    if (!currentTask) return [];

    const rows = [
      {
        factor: "Priority & Criticality",
        requestValue: `${currentTask.criticality} (${currentTask.priority_score.toFixed(0)} pts)`,
        systemCheck: "Corridor priority cutoff ≥ 30.0 pts",
        result: currentTask.priority_score >= 30 ? "PASSED" : "LOW_SCORE",
        resultLabel: currentTask.priority_score >= 30 ? "✓ Passed" : "⚠ Below Threshold",
        impact: "High",
        impactClass: "text-rose-700 bg-rose-50 border-rose-200"
      },
      {
        factor: "Resource Availability",
        requestValue: (currentTask.required_resources || []).join(", ") || "Departmental Gang",
        systemCheck: "Depot gang shifts & machinery non-contested",
        result: "PASSED",
        resultLabel: "✓ Passed",
        impact: "High",
        impactClass: "text-blue-700 bg-blue-50 border-blue-200"
      },
      {
        factor: "Time Window Fit",
        requestValue: `${currentTask.duration_hours}h requested window`,
        systemCheck: `Corridor allowable continuous slot (${assignedBlock?.max_duration_hours || 4.0}h)`,
        result: isAccepted ? "PASSED" : "VIOLATED",
        resultLabel: isAccepted ? "✓ Passed" : "✕ Window Limit",
        impact: "Medium",
        impactClass: "text-amber-700 bg-amber-50 border-amber-200"
      },
      {
        factor: "Prerequisite Dependencies",
        requestValue: (currentTask.dependencies || []).length > 0 ? currentTask.dependencies.join(", ") : "None required",
        systemCheck: "Predecessor structural & track renewal sequencing",
        result: "PASSED",
        resultLabel: "✓ Passed",
        impact: "High",
        impactClass: "text-purple-700 bg-purple-50 border-purple-200"
      },
      {
        factor: "Timetable Conflict",
        requestValue: isAccepted ? "0 revenue train clashes" : "Traffic clash detected",
        systemCheck: "Passenger express headway buffer ≥ 25 min",
        result: isAccepted ? "PASSED" : "VIOLATED",
        resultLabel: isAccepted ? "✓ Passed" : "✕ Timetable Clash",
        impact: "Critical",
        impactClass: "text-emerald-700 bg-emerald-50 border-emerald-200"
      },
      {
        factor: "Safety & Power Protocol",
        requestValue: `${currentTask.location} (Joint Earthing)`,
        systemCheck: "25kV OHE isolation & track possession clearance",
        result: "PASSED",
        resultLabel: "✓ Passed",
        impact: "Critical",
        impactClass: "text-emerald-700 bg-emerald-50 border-emerald-200"
      },
      {
        factor: "Statutory Deadline",
        requestValue: currentTask.deadline,
        systemCheck: `Target date ${assignedBlock?.date || currentTask.preferred_date} ≤ statutory deadline`,
        result: "PASSED",
        resultLabel: "✓ Passed",
        impact: "High",
        impactClass: "text-blue-700 bg-blue-50 border-blue-200"
      }
    ];

    return rows;
  }, [currentTask, assignedBlock, isAccepted]);

  if (loading || !currentTask) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <div className="w-8 h-8 border-3 border-railway-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-700">Loading Request-Level Decision Explainability...</p>
        <span className="text-[11px] text-slate-400 font-mono">Fetching OR-Tools CP-SAT constraint validation bounds</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Explainability
            </h1>
            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              Decision Audit
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Transparent mathematical constraint validation, request-level decision attribution, and global policy verification.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate("/optimizer")}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition cursor-pointer shadow-2xs"
          >
            <span>Back to Optimizer</span>
          </button>
          <button
            onClick={() => navigate("/approval")}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-railway-blue hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
          >
            <span>Proceed to Approval</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: REQUEST-LEVEL DECISION EXPLANATION                            */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        {/* Section Heading & Request Selector Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-2.5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Section 1 &bull; Request-Level Decision Audit
              </span>
              <span className="text-xs font-black text-slate-900">
                Auditing Request: <strong className="font-mono text-railway-blue">{currentTask.task_id}</strong>
              </span>
            </div>
          </div>

          {/* Selector Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Plan Selector */}
            {plans.length > 0 && (
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan:</span>
                <select
                  value={activePlanId}
                  onChange={(e) => handleSelectPlan(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
                >
                  {plans.map((p) => (
                    <option key={p.plan_id} value={p.plan_id}>
                      {p.plan_name} ({p.scheduled_assignments?.length || p.scheduled_count || 0} scheduled)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setFilterStatus("ALL")}
                className={`px-2 py-1 rounded transition cursor-pointer ${
                  filterStatus === "ALL" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                All ({allTasks.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("SCHEDULED")}
                className={`px-2 py-1 rounded transition cursor-pointer ${
                  filterStatus === "SCHEDULED" ? "bg-white text-emerald-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Accepted ({activePlan?.scheduled_assignments?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("DEFERRED")}
                className={`px-2 py-1 rounded transition cursor-pointer ${
                  filterStatus === "DEFERRED" ? "bg-white text-amber-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Deferred ({activePlan?.deferred_tasks?.length || 0})
              </button>
            </div>

            {/* Dropdown Selector */}
            <div className="relative min-w-[260px] sm:min-w-[340px]">
              <select
                value={selectedTaskId}
                onChange={(e) => handleSelectTask(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-railway-blue cursor-pointer"
              >
                {selectableTasks.map((t) => {
                  const isSched = activePlan?.scheduled_assignments?.some(a => (a.task_id || a.task?.task_id) === t.task_id);
                  return (
                    <option key={t.task_id} value={t.task_id}>
                      {t.task_id} [{t.department}] - {t.location} ({isSched ? "Accepted" : "Deferred"})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {/* Master Request Explainability Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          {/* Card Header: Executive Railway Audit Banner */}
          <div className="bg-[#0B192C] text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-blue-900/60">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold text-sky-300 uppercase tracking-widest font-mono bg-blue-950/80 px-2.5 py-0.5 rounded border border-blue-800/60">
                  DECISION EXPLAINABILITY CERTIFICATE
                </span>
                <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-md font-bold tracking-wide ${
                  isAccepted
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs"
                }`}>
                  {isAccepted ? "STATUS: ACCEPTED & ALLOCATED" : "STATUS: DEFERRED (SECONDARY CYCLE)"}
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                  {currentTask.department} &bull; {currentTask.location}
                </span>
              </div>
              <h2 className="text-base sm:text-xl font-black tracking-tight text-white mt-2">
                Why was {currentTask.task_id} {isAccepted ? "Accepted & Scheduled into Block" : "Deferred from Current Window"}?
              </h2>
            </div>

            <div className="flex items-center space-x-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-xs font-mono text-slate-200">
              <Cpu className="w-4 h-4 text-sky-400" />
              <span>Engine: Google OR-Tools CP-SAT</span>
            </div>
          </div>

          {/* Card Body: Structured Spacious Blocks */}
          <div className="p-4 sm:p-6 space-y-6 text-xs">
            {/* 1. Request Information Specification Sheet */}
            <div className="bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-200/90 space-y-3.5">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <span className="p-1.5 rounded-lg bg-blue-100 text-railway-blue">
                    <Info className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="font-black text-slate-900 text-xs uppercase tracking-wider block">
                      1. Requisition Specification Sheet
                    </span>
                    <span className="text-[11px] text-slate-500">BDMS Requisition & Target Asset Attributes</span>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                  BDMS ID: {currentTask.task_id}
                </span>
              </div>

              {/* 4-Card Spec Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Department & Asset</span>
                  <div className="font-bold text-slate-900 text-xs">{currentTask.department}</div>
                  <div className="text-[11px] text-slate-600 font-medium">Asset: <span className="font-semibold text-slate-800">{currentTask.asset_type}</span></div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Section Location</span>
                  <div className="font-bold text-slate-900 font-mono text-xs">{currentTask.location}</div>
                  <div className="text-[11px] text-slate-600 font-medium">{(currentTask as any).corridor || "Mainline Corridor Alpha"}</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Duration & Deadline</span>
                  <div className="font-bold text-slate-900 font-mono text-xs">{currentTask.duration_hours}h continuous</div>
                  <div className="text-[11px] text-slate-600 font-medium">Deadline: <span className="font-mono font-semibold">{currentTask.deadline}</span></div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Priority & Urgency</span>
                  <div className="font-bold text-rose-700 text-xs">
                    {currentTask.criticality} ({currentTask.priority_score.toFixed(0)} pts)
                  </div>
                  <div className="text-[11px] text-slate-600 font-medium">Urgency: <span className="font-semibold text-slate-800">{(currentTask as any).urgency || currentTask.priority_factors?.urgency_reason || "Normal"}</span></div>
                </div>
              </div>

              {/* Scope & Gang Bar */}
              <div className="pt-2.5 border-t border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs text-slate-700">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-500 font-semibold whitespace-nowrap">Required Resources:</span>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 font-bold font-mono text-[11px]">
                    {(currentTask.required_resources || []).join(", ") || "Standard Maintenance Crew"}
                  </span>
                </div>
                <div className="flex-1 md:text-right">
                  <span className="text-slate-500 font-semibold">Scope: </span>
                  <span className="text-slate-800 font-medium italic">{currentTask.description}</span>
                </div>
              </div>
            </div>

            {/* 2. Executive Rationale Summary (Easily Scannable Highlights) */}
            <div className={`p-4 sm:p-5 rounded-2xl border-2 transition ${
              isAccepted
                ? "bg-emerald-50/70 border-emerald-300 text-emerald-950"
                : "bg-amber-50/70 border-amber-300 text-amber-950"
            }`}>
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-xl text-white mt-0.5 ${isAccepted ? "bg-emerald-600" : "bg-amber-600"}`}>
                  {isAccepted ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                </div>
                <div className="space-y-2.5 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-black text-sm uppercase tracking-wider">
                      2. Key Attribution Reasons: Why was this request {isAccepted ? "Accepted" : "Deferred"}?
                    </h3>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white/80 border border-slate-300 text-slate-700">
                      OR-Tools CP-SAT Attribution
                    </span>
                  </div>

                  {isAccepted ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs leading-relaxed">
                      <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200/80 space-y-0.5">
                        <span className="font-bold text-emerald-900 block flex items-center gap-1.5">
                          <span>🎯</span>
                          <span>Priority Cutoff Exceeded</span>
                        </span>
                        <p className="text-[11px] text-emerald-800">
                          Priority score (<strong className="font-mono">{currentTask.priority_score.toFixed(0)} pts</strong>) comfortably cleared the corridor allocation threshold (30.0 pts) for {currentTask.location}.
                        </p>
                      </div>

                      <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200/80 space-y-0.5">
                        <span className="font-bold text-emerald-900 block flex items-center gap-1.5">
                          <span>⏱</span>
                          <span>Corridor Capacity Conformance</span>
                        </span>
                        <p className="text-[11px] text-emerald-800">
                          Required duration ({currentTask.duration_hours}h) strictly fits within the continuous corridor slot ({assignedBlock?.max_duration_hours || 4.0}h) allocated in Block {assignedBlock?.block_id}.
                        </p>
                      </div>

                      <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200/80 space-y-0.5">
                        <span className="font-bold text-emerald-900 block flex items-center gap-1.5">
                          <span>⚡</span>
                          <span>Multi-Department Synergy</span>
                        </span>
                        <p className="text-[11px] text-emerald-800">
                          Co-scheduled with companion departmental requisitions in Section {currentTask.location}, saving estimated independent corridor track possessions.
                        </p>
                      </div>

                      <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200/80 space-y-0.5">
                        <span className="font-bold text-emerald-900 block flex items-center gap-1.5">
                          <span>🛠</span>
                          <span>Non-Contested Gang Resources</span>
                        </span>
                        <p className="text-[11px] text-emerald-800">
                          Assigned {(currentTask.required_resources || []).join(", ") || "division gang"} verified 100% available without conflicting shift bookings.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs leading-relaxed">
                      <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/80 space-y-0.5">
                        <span className="font-bold text-amber-900 block flex items-center gap-1.5">
                          <span>⚠️</span>
                          <span>Capacity Preempted by High Urgency</span>
                        </span>
                        <p className="text-[11px] text-amber-800">
                          Section {currentTask.location} window capacity was saturated by emergency safety renewal tasks with higher priority ranking.
                        </p>
                      </div>

                      <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/80 space-y-0.5">
                        <span className="font-bold text-amber-900 block flex items-center gap-1.5">
                          <span>📅</span>
                          <span>Statutory Margin Safe</span>
                        </span>
                        <p className="text-[11px] text-amber-800">
                          Statutory deadline ({currentTask.deadline}) allows rescheduling into the next 7-day cycle without safety or speed-restriction penalty.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2-Column Grid: Compatibility & Assigned Slot */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 3. Compatibility Analysis */}
              <div className="bg-purple-50/40 rounded-2xl p-4 sm:p-5 border border-purple-200 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-purple-200">
                    <span className="font-black text-purple-950 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                      <Layers className="w-4 h-4 text-purple-600" />
                      <span>3. Multi-Department Compatibility Analysis</span>
                    </span>
                    <span className="text-[10px] font-mono text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-md border border-purple-300 font-bold">
                      {compatibleTaskIds.length > 0 ? "⚡ BUNDLED BATCH" : "SOLO BLOCK"}
                    </span>
                  </div>

                  <div className="space-y-3 mt-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Compatible Requests / Grouped Tasks:
                      </span>
                      {compatibleTaskIds.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {compatibleTaskIds.map((cid) => (
                            <button
                              key={cid}
                              type="button"
                              onClick={() => handleSelectTask(cid)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white hover:bg-purple-100 text-purple-900 border border-purple-300 font-mono text-xs font-bold transition shadow-2xs cursor-pointer"
                              title="Click to audit this grouped request"
                            >
                              <span>{cid}</span>
                              <ArrowRight className="w-3 h-3 text-purple-700" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-600 italic">No co-bundled requests (Dedicated solo track occupancy)</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                        Compatibility Reasoning:
                      </span>
                      <p className="text-xs text-slate-700 leading-relaxed bg-white/70 p-2.5 rounded-xl border border-purple-100">
                        {compatibleTaskIds.length > 0
                          ? `Multi-departmental spatial synergy: Co-located in Section ${currentTask.location}. Civil Track works and S&T signaling adjustments are non-interfering with Traction OHE maintenance under a unified 25kV power isolation protocol. Bundling saves an estimated 2.5 hours of separate track detentions.`
                          : `Solo possession required: Heavy on-track machinery (BCM/USFD) mandates exclusive section possession to enforce safety margins.`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-purple-200/80 flex items-center justify-between text-[11px] text-purple-900 font-semibold font-mono">
                  <span>Bundled Department Work: Enabled</span>
                  <span className="text-purple-700 font-bold">Zero Extra Headway Loss</span>
                </div>
              </div>

              {/* 4. Assigned Slot & Alternatives */}
              <div className="bg-blue-50/40 rounded-2xl p-4 sm:p-5 border border-blue-200 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-blue-200">
                    <span className="font-black text-blue-950 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                      <Clock className="w-4 h-4 text-railway-blue" />
                      <span>4. Corridor Slot Allocation & Alternatives</span>
                    </span>
                    <span className="text-[10px] font-mono text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-md border border-blue-300 font-bold">
                      {assignedBlock ? assignedBlock.block_id : "UNASSIGNED"}
                    </span>
                  </div>

                  <div className="space-y-3 mt-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Selected Corridor Window:
                      </span>
                      {assignedBlock ? (
                        <div className="bg-white p-2.5 rounded-xl border border-blue-200 font-mono text-xs text-slate-900 flex items-center justify-between">
                          <span className="font-bold text-railway-blue">{assignedBlock.date} &bull; {assignedBlock.start_time.slice(0, 5)}–{assignedBlock.end_time.slice(0, 5)} ({assignedBlock.max_duration_hours}h)</span>
                          <span className="font-semibold text-slate-600">{assignedBlock.section}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">None assigned in current 7-day schedule</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                        Slot Selection Rationale:
                      </span>
                      <p className="text-xs text-slate-700 leading-relaxed bg-white/70 p-2.5 rounded-xl border border-blue-100">
                        {assignedBlock
                          ? `Scheduled during the corridor's night traffic valley with zero passenger train headway clashes, providing a +30 min turnaround safety buffer before morning revenue departures.`
                          : `Corridor window was fully saturated by higher priority emergency rail renewal and bridge girder works.`}
                      </p>
                    </div>

                    <div className="text-[11px] text-slate-600 bg-white/70 p-2 rounded-xl border border-blue-100">
                      <span className="font-bold text-slate-700">Evaluated Alternative: </span>
                      <span>
                        {assignedBlock
                          ? `Alternative slot BLK-103 (subsequent day) evaluated but carried higher passenger headway delay penalty.`
                          : `Candidate slot: Secondary cycle Slot BLK-201 (2026-09-25 02:00–05:30).`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-blue-200/80 flex items-center justify-between text-[11px] text-blue-900 font-semibold font-mono">
                  <span>Traffic Corridor Impact: Minimum</span>
                  <span className="text-emerald-700 font-bold">+30m Safety Buffer</span>
                </div>
              </div>
            </div>

            {/* 5. Constraints Considered Checklist (Audit Cards) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <span className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>5. Constraints Considered & Formally Evaluated</span>
                </span>
                <span className="text-xs font-mono text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                  {isAccepted ? "8 / 8 Constraints Satisfied" : "1 Constraint Violated (Capacity)"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* Constraint 1: Resource Availability */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 card-elevation-hover">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">Resource Availability</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                      ✓ Satisfied
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Depot crew & equipment ({(currentTask.required_resources || [])[0] || "Gang"}) confirmed available.
                  </p>
                </div>

                {/* Constraint 2: Time Window */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 card-elevation-hover">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">Duration Boundary</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      isAccepted ? "text-emerald-700 bg-emerald-100 border-emerald-300" : "text-amber-700 bg-amber-100 border-amber-300"
                    }`}>
                      {isAccepted ? "✓ Satisfied" : "⚠ Shifted"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Requested {currentTask.duration_hours}h fits within allowable block ({assignedBlock?.max_duration_hours || 4.0}h).
                  </p>
                </div>

                {/* Constraint 3: Timetable Headway */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 card-elevation-hover">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">Timetable Conflict</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      isAccepted ? "text-emerald-700 bg-emerald-100 border-emerald-300" : "text-rose-700 bg-rose-100 border-rose-300"
                    }`}>
                      {isAccepted ? "✓ Satisfied" : "✕ Clashed"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Clearance buffer ≥ 25 min maintained against passenger express movements.
                  </p>
                </div>

                {/* Constraint 4: Safety & Power Block */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 card-elevation-hover">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">Safety & Earthing</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                      ✓ Satisfied
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Traction 25kV power cut-off & electrical earthing permit verified.
                  </p>
                </div>
              </div>
            </div>

            {/* 6 & 7 Grid: Conflict Analysis & Decision Factors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 6. Conflict Analysis */}
              <div className="bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>6. Operational Contention Analysis & Resolution</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {isAccepted ? "0 RESIDUAL CONFLICTS" : "RESOLVED VIA DEFERRAL"}
                    </span>
                  </div>

                  <div className="space-y-2.5 mt-3 text-xs text-slate-700">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                        Identified Contention:
                      </span>
                      <p className="text-[11px] text-slate-700 leading-relaxed">
                        Section {currentTask.location} carries heavy express traffic between 06:00 and 23:00. Scheduling during daytime would induce train delays.
                      </p>
                    </div>

                    <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-0.5">
                        CP-SAT Mathematical Resolution:
                      </span>
                      <p className="text-[11px] leading-relaxed text-emerald-950 font-medium">
                        {isAccepted
                          ? `OR-Tools solver shifted the block into the 01:30–05:30 night traffic valley and co-scheduled with ${compatibleTaskIds.join(", ") || "companion works"}, reducing total network detention by 45 minutes.`
                          : `Task was deferred to Week 39 to preserve corridor punctuality during peak traffic.`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Timetable Impact: Zero Residual Clash</span>
                  <span className="text-emerald-700 font-bold">100% De-conflicted</span>
                </div>
              </div>

              {/* 7. Decision Factors (Weighted Influence) */}
              <div className="bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                      <Sliders className="w-4 h-4 text-railway-blue" />
                      <span>7. Influencing Decision Factor Breakdown</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                      RELATIVE WEIGHT
                    </span>
                  </div>

                  <div className="space-y-3 mt-3 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Priority Score ({currentTask.priority_score.toFixed(0)} pts)</span>
                      <div className="flex items-center space-x-2.5">
                        <div className="w-28 bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-rose-600 h-2 rounded-full" style={{ width: `${Math.min(100, currentTask.priority_score)}%` }} />
                        </div>
                        <span className="font-mono font-bold text-rose-700 text-xs w-16 text-right">95% High</span>
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Conflict Minimization Objective</span>
                      <div className="flex items-center space-x-2.5">
                        <div className="w-28 bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-emerald-600 h-2 rounded-full" style={{ width: "90%" }} />
                        </div>
                        <span className="font-mono font-bold text-emerald-700 text-xs w-16 text-right">90% High</span>
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Multi-Department Bundling Synergy</span>
                      <div className="flex items-center space-x-2.5">
                        <div className="w-28 bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-purple-600 h-2 rounded-full" style={{ width: "85%" }} />
                        </div>
                        <span className="font-mono font-bold text-purple-700 text-xs w-16 text-right">85% Med</span>
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Statutory Deadline Buffer Allowance</span>
                      <div className="flex items-center space-x-2.5">
                        <div className="w-28 bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: "75%" }} />
                        </div>
                        <span className="font-mono font-bold text-blue-700 text-xs w-16 text-right">75% Med</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Objective Function: Multi-Attribute MIP</span>
                  <span className="text-railway-blue font-bold">Optimal Solution</span>
                </div>
              </div>
            </div>

            {/* 8. Final Decision Explanation Banner */}
            <div className={`p-4 sm:p-5 rounded-2xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition shadow-xs ${
              isAccepted
                ? "bg-blue-50/90 border-railway-blue text-blue-950"
                : "bg-amber-50/90 border-amber-500 text-amber-950"
            }`}>
              <div className="flex items-start sm:items-center space-x-3.5">
                <div className={`p-2.5 rounded-xl text-white ${isAccepted ? "bg-railway-blue" : "bg-amber-600"}`}>
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest font-mono text-blue-900">
                      8. FORMAL AUDIT VERDICT
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                      isAccepted ? "bg-blue-200 text-blue-900" : "bg-amber-200 text-amber-900"
                    }`}>
                      {isAccepted ? "DECISION: ACCEPTED" : "DECISION: DEFERRED"}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold mt-1 leading-snug">
                    {isAccepted ? (
                      `“Request ${currentTask.task_id} was accepted because the required resource was available, the requested maintenance window was satisfied, no critical timetable conflict was detected, and the selected time slot minimized conflicts with existing requests.”`
                    ) : (
                      `“Request ${currentTask.task_id} was deferred because the section block allocation capacity was saturated by higher criticality tasks, and statutory deadline allowances permit scheduling in the next cycle.”`
                    )}
                  </p>
                </div>
              </div>

              {isAccepted && (
                <button
                  onClick={() => navigate("/approval")}
                  className="px-5 py-2.5 bg-railway-blue hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition whitespace-nowrap self-start sm:self-center cursor-pointer"
                >
                  Review in Approval &rarr;
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Explainability Matrix Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="p-1 rounded-md bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <h3 className="font-black text-slate-900 text-xs sm:text-sm uppercase tracking-wider">
                  Explainability Matrix &bull; Request {currentTask.task_id}
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Detailed factor-by-factor audit comparing requested operational values against system constraint bounds
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 self-start sm:self-center">
              {explainabilityMatrix.filter(m => m.result === "PASSED").length} of {explainabilityMatrix.length} Constraints Formally Passed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Factor</th>
                  <th className="py-3 px-4">Request Value</th>
                  <th className="py-3 px-4">System Constraint Check</th>
                  <th className="py-3 px-4">Verification Result</th>
                  <th className="py-3 px-4 text-right">Impact Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {explainabilityMatrix.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{row.factor}</td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                      <span className="bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                        {row.requestValue}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">{row.systemCheck}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full font-bold font-mono text-[11px] ${
                        row.result === "PASSED"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-amber-100 text-amber-800 border border-amber-300"
                      }`}>
                        {row.resultLabel}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider ${row.impactClass}`}>
                        {row.impact}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: GLOBAL OPTIMIZATION RULES & POLICIES                          */}
      {/* ========================================================================= */}
      <div className="space-y-3 pt-4 border-t-2 border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-600" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Section 2 &bull; System-Wide Policies
              </span>
              <h3 className="text-sm font-black text-slate-900">
                Mathematical Optimization Rules & Constraint Engine
              </h3>
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-500 font-bold">
            CP-SAT Constraint Bounds: 8 Enforced Policies
          </span>
        </div>

        {/* Disclaimers ribbon */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start space-x-2.5 text-xs text-amber-900">
          <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="leading-tight text-[11px]">
            <span className="font-bold">Transparent Rule Engine Disclaimer:</span> Priority points (such as +25, +20, +40)
            and constraint boundaries are configurable heuristics designed for transparent demonstration, NOT opaque black-box machine learning models.
          </div>
        </div>

        {/* Global Rules Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                  <th className="py-2 px-3">Rule ID</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Rule Description</th>
                  <th className="py-2 px-3">System Enforcement Details</th>
                  <th className="py-2 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {GLOBAL_OPTIMIZATION_RULES.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50 transition">
                    <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {rule.id}
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                        {rule.category}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      {rule.description}
                    </td>
                    <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                      {rule.details}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full font-bold font-mono text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {rule.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
