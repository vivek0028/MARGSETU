import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Cpu,
  Layers,
  ArrowRight,
  AlertCircle,
  Calendar,
  Wrench,
  Train,
  CheckSquare,
  HelpCircle,
  Info,
  X,
  Sparkles,
  PieChart as PieIcon,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Activity
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid
} from "recharts";
import { api } from "../services/api";
import { DashboardSummary, SchedulePlan, ScheduleAssignment, BlockWindow } from "../types";
import { usePlanning } from "../context/PlanningContext";

const getDaysOfWeek = (startDateStr = "2026-09-24") => {
  const days = [];
  const start = new Date(startDateStr);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const shortNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  for (let i = 0; i < 7; i++) {
    const cur = new Date(start);
    cur.setDate(start.getDate() + i);
    const key = cur.toISOString().split("T")[0];
    const dayName = dayNames[cur.getDay()];
    const short = shortNames[cur.getDay()];
    const dateStr = `${cur.getDate()} ${months[cur.getMonth()]}`;
    days.push({ key, name: dayName, short, dateStr });
  }
  return days;
};

const DEPARTMENTS = ["Engineering", "S&T", "Traction"] as const;

interface TimelineBlockItem {
  id: string;
  activity: string;
  section: string;
  timeWindow: string;
  durationHours: number;
  status: "Scheduled" | "Conflict" | "Pending" | "Approved";
  department: string;
  taskId: string;
  blockId: string;
  assetType?: string;
  bundledWith?: string[];
  notes?: string;
  date: string;
}

// Chart color palettes matching Indian Railways GovTech aesthetics
const DEPT_COLORS: Record<string, string> = {
  Engineering: "#0056B3", // Railway Blue
  "S&T": "#7C3AED",       // Purple
  Traction: "#D97706",    // Amber
};

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "#DC2626", // Red
  High: "#EA580C",     // Orange
  Medium: "#D97706",   // Amber
  Low: "#64748B",      // Slate
};

// High-contrast, crystal-clear custom tooltips for Recharts
const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 shadow-2xl text-xs space-y-1 z-50">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: data.payload.color }} />
          <span className="font-extrabold text-white text-xs">{data.name} Department</span>
        </div>
        <div className="text-slate-200 text-xs font-mono flex items-center space-x-1.5 pt-0.5 border-t border-slate-800">
          <span className="text-slate-400">Demands:</span>
          <span className="font-black text-amber-300 text-sm tracking-wide">{data.value} tasks</span>
        </div>
      </div>
    );
  }
  return null;
};

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 shadow-2xl text-xs space-y-1 z-50">
        <div className="font-extrabold text-blue-300 text-xs flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.payload.fill }} />
          <span>{label} Criticality</span>
        </div>
        <div className="text-slate-200 text-xs font-mono flex items-center space-x-1.5 pt-0.5 border-t border-slate-800">
          <span className="text-slate-400">Demands:</span>
          <span className="font-black text-amber-300 text-sm tracking-wide">{data.value} tasks</span>
        </div>
      </div>
    );
  }
  return null;
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { period, setPeriod, corridor, departmentRole, activeRoleDetail, setDepartmentRole } = usePlanning();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [plans, setPlans] = useState<SchedulePlan[]>([]);
  const [activePlan, setActivePlan] = useState<SchedulePlan | null>(null);
  const [blockWindows, setBlockWindows] = useState<BlockWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBlockItem, setSelectedBlockItem] = useState<TimelineBlockItem | null>(null);
  const [activeViewMode, setActiveViewMode] = useState<"WEEK" | "MONTH">("WEEK");
  const [activeSectionTab, setActiveSectionTab] = useState<"schedule" | "analytics" | "tasks" | "execution">("schedule");
  const [criticalTaskSearch, setCriticalTaskSearch] = useState("");
  const [executionAnalytics, setExecutionAnalytics] = useState<any>(null);

  // Selected date in Month view
  const [selectedMonthDate, setSelectedMonthDate] = useState<string>("2026-09-22");
  const [weekStartDate, setWeekStartDate] = useState<string>("2026-09-24");
  const daysOfWeek = useMemo(() => getDaysOfWeek(weekStartDate), [weekStartDate]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumData, plansData, blocksData, execData] = await Promise.all([
        api.getDashboardSummary(),
        api.getOptimizationPlans(),
        api.getBlockWindows(),
        api.getPlanVsActual().catch(() => null)
      ]);
      setSummary(sumData);
      setPlans(plansData);
      setBlockWindows(blocksData);
      if (execData) setExecutionAnalytics(execData);

      if (plansData.length > 0) {
        // Prioritize approved plan or first plan
        const targetPlan = plansData.find((p: any) => p.status === "Approved") || plansData[0];
        const fullPlan = await api.getOptimizationPlanById(targetPlan.plan_id);
        setActivePlan(fullPlan);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data from backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper to normalize Indian Railways maintenance departments
  const normalizeDept = (deptRaw?: string): "Engineering" | "S&T" | "Traction" => {
    if (!deptRaw) return "Engineering";
    const lower = deptRaw.toLowerCase();
    if (lower.includes("signal") || lower.includes("s&t") || lower.includes("telecom")) return "S&T";
    if (lower.includes("traction") || lower.includes("trd") || lower.includes("ohe") || lower.includes("electrical")) return "Traction";
    return "Engineering";
  };

  // Build weekly block timeline dataset from scheduled assignments
  const { timelineGrid, allTimelineBlocks } = useMemo(() => {
    const grid: Record<string, Record<string, TimelineBlockItem[]>> = {};
    const allBlocks: TimelineBlockItem[] = [];

    daysOfWeek.forEach((d) => {
      grid[d.key] = {
        Engineering: [],
        "S&T": [],
        Traction: []
      };
    });

    if (activePlan?.scheduled_assignments) {
      activePlan.scheduled_assignments.forEach((asgn: ScheduleAssignment) => {
        const dateKey = asgn.block?.date || "2026-09-24";
        const dept = normalizeDept(asgn.task?.department);
        const isApproved = activePlan.status === "Approved";
        const blockId = asgn.block_id || asgn.block?.block_id || "BLK-AUTO";
        const blockItem: TimelineBlockItem = {
          id: asgn.assignment_id,
          activity: asgn.task?.description || asgn.task?.asset_type || "Maintenance Work",
          section: asgn.block?.section || asgn.task?.location || "Section",
          timeWindow: `${(asgn.block?.start_time || "00:00").slice(0, 5)}–${(asgn.block?.end_time || "04:00").slice(0, 5)}`,
          durationHours: asgn.task?.duration_hours || asgn.block?.max_duration_hours || 2.0,
          status: isApproved ? "Approved" : "Scheduled",
          department: dept,
          taskId: asgn.task?.task_id || asgn.task_id,
          blockId: blockId,
          assetType: asgn.task?.asset_type || (dept === "Engineering" ? "Track" : dept === "S&T" ? "Signal" : "OHE"),
          bundledWith: asgn.bundled_with,
          notes: asgn.task?.criticality === "Critical" ? "Critical Safety Asset" : undefined,
          date: dateKey
        };

        allBlocks.push(blockItem);

        if (grid[dateKey] && grid[dateKey][dept]) {
          grid[dateKey][dept].push(blockItem);
        }
      });
    }

    return { timelineGrid: grid, allTimelineBlocks: allBlocks };
  }, [activePlan, daysOfWeek]);

  // Month view: 30 days of September 2026
  const monthCalendarDays = useMemo(() => {
    const days = [];
    // September 2026 starts on Tuesday (day 2 of week). Pad with 1 empty slot for Monday.
    const startPadding = 1; // 1 day padding before Sep 1 (Tue)
    for (let p = 0; p < startPadding; p++) {
      days.push({ dayNumber: null, dateStr: null, isPadding: true });
    }

    for (let d = 1; d <= 30; d++) {
      const dayStr = d < 10 ? `0${d}` : `${d}`;
      const dateStr = `2026-09-${dayStr}`;
      // Count blocks on this day
      const blocksOnDay = allTimelineBlocks.filter(b => b.date === dateStr);
      const isPlanningWeek = d >= 18 && d <= 24;

      days.push({
        dayNumber: d,
        dateStr,
        isPadding: false,
        isPlanningWeek,
        blocks: blocksOnDay,
        hasEngineering: blocksOnDay.some(b => b.department === "Engineering"),
        hasST: blocksOnDay.some(b => b.department === "S&T"),
        hasTraction: blocksOnDay.some(b => b.department === "Traction"),
      });
    }

    return days;
  }, [allTimelineBlocks]);

  // Selected date's blocks for the Month View inspector
  const selectedDateBlocks = useMemo(() => {
    return allTimelineBlocks.filter(b => b.date === selectedMonthDate);
  }, [allTimelineBlocks, selectedMonthDate]);

  // Chart 1: Department Pie Chart Data
  const departmentPieData = useMemo(() => {
    if (!summary?.department_summary) return [];
    return [
      { name: "Engineering", value: summary.department_summary.Engineering || 10, color: DEPT_COLORS.Engineering },
      { name: "S&T", value: summary.department_summary["S&T"] || 8, color: DEPT_COLORS["S&T"] },
      { name: "Traction", value: summary.department_summary.Traction || 6, color: DEPT_COLORS.Traction },
    ];
  }, [summary]);

  // Chart 2: Priority Distribution Bar Chart Data
  const priorityBarData = useMemo(() => {
    if (!summary?.priority_distribution) return [];
    return [
      { name: "Critical", count: summary.priority_distribution.Critical || 4, fill: PRIORITY_COLORS.Critical },
      { name: "High", count: summary.priority_distribution.High || 8, fill: PRIORITY_COLORS.High },
      { name: "Medium", count: summary.priority_distribution.Medium || 9, fill: PRIORITY_COLORS.Medium },
      { name: "Low", count: summary.priority_distribution.Low || 3, fill: PRIORITY_COLORS.Low },
    ];
  }, [summary]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <div className="w-8 h-8 border-3 border-railway-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-700">Connecting to MARGSETU Operational Database...</p>
        <span className="text-[11px] text-slate-400 font-mono">Loading synthetic Indian Railways corridor schedule</span>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-800 space-y-3">
        <div className="flex items-center space-x-2 font-bold text-base">
          <AlertCircle className="w-5 h-5 text-rose-600" />
          <span>Backend Connection Error</span>
        </div>
        <p className="text-xs">{error || "Unable to reach FastAPI backend service."}</p>
        <button
          onClick={loadData}
          className="px-3 py-1.5 bg-rose-600 text-white rounded text-xs font-semibold hover:bg-rose-700 transition"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const { kpis } = summary;

  return (
    <div className="space-y-2.5">
      {/* Active Role Perspective Banner / Divisional Command Desk */}
      <div className="bg-[#0B192C] text-white rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between text-xs border border-blue-900/60 shadow-xs gap-3">
        <div className="flex items-center space-x-2.5">
          <span className={`w-2.5 h-2.5 rounded-full ${
            departmentRole === "ENGINEERING" ? "bg-sky-400" :
            departmentRole === "ST" ? "bg-purple-400" :
            departmentRole === "TRACTION" ? "bg-amber-400" :
            departmentRole === "OPERATING" ? "bg-rose-400" : "bg-emerald-400"
          } animate-pulse`} />
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-white text-xs tracking-tight">
                Active Perspective: {activeRoleDetail.title} ({activeRoleDetail.designation})
              </span>
              <span className="text-[10px] px-2 py-0.2 rounded font-mono font-bold bg-white/10 text-sky-200 border border-white/10">
                Divisional Command Desk
              </span>
            </div>
            <p className="text-slate-300 text-[11px] font-medium mt-0.5">
              &bull; {activeRoleDetail.focusMetrics}
            </p>
          </div>
        </div>

        {/* Quick Role Desks */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setDepartmentRole("UNIFIED")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              departmentRole === "UNIFIED"
                ? "bg-blue-600 text-white shadow-2xs"
                : "bg-white/10 text-slate-200 hover:bg-white/20"
            }`}
          >
            HQ Unified
          </button>
          <button
            onClick={() => setDepartmentRole("OPERATING")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              departmentRole === "OPERATING"
                ? "bg-rose-600 text-white shadow-2xs"
                : "bg-white/10 text-slate-200 hover:bg-white/20"
            }`}
          >
            CTNL (Traffic)
          </button>
          <button
            onClick={() => setDepartmentRole("ENGINEERING")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              departmentRole === "ENGINEERING"
                ? "bg-sky-600 text-white shadow-2xs"
                : "bg-white/10 text-slate-200 hover:bg-white/20"
            }`}
          >
            Sr. DEN (Civil)
          </button>
          <button
            onClick={() => setDepartmentRole("ST")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              departmentRole === "ST"
                ? "bg-purple-600 text-white shadow-2xs"
                : "bg-white/10 text-slate-200 hover:bg-white/20"
            }`}
          >
            Sr. DSTE (S&T)
          </button>
          <button
            onClick={() => setDepartmentRole("TRACTION")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
              departmentRole === "TRACTION"
                ? "bg-amber-600 text-white shadow-2xs"
                : "bg-white/10 text-slate-200 hover:bg-white/20"
            }`}
          >
            Sr. DEE (TRD)
          </button>
        </div>
      </div>

      {/* 1. Primary KPI Cards Grid (4 Essential Railway Metrics) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* KPI 1: Pending Requests */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3 sm:p-3.5 shadow-xs flex flex-col justify-between card-elevation-hover">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Pending Requests
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-railway-blue flex items-center justify-center font-bold">
              <ClipboardList className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight leading-none">
              {kpis.total_maintenance_requests}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-tight">
              Departmental requisitions awaiting allocation
            </p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
            <span className="inline-flex items-center text-blue-700 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-1" />
              BDMS Synced
            </span>
            <Link to="/requests" className="text-railway-blue hover:underline font-bold text-[10px]">
              Manage &rarr;
            </Link>
          </div>
        </div>

        {/* KPI 2: Planned Blocks */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3 sm:p-3.5 shadow-xs flex flex-col justify-between card-elevation-hover">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Planned Blocks
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight leading-none">
              {kpis.scheduled_tasks || 22}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-tight">
              Approved or scheduled block windows
            </p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
            <span className="inline-flex items-center text-emerald-700 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1" />
              {activePlan?.status || "Optimized"}
            </span>
            <Link to="/optimizer" className="text-railway-blue hover:underline font-bold text-[10px]">
              Inspect Plan &rarr;
            </Link>
          </div>
        </div>

        {/* KPI 3: Conflicts Detected */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3 sm:p-3.5 shadow-xs flex flex-col justify-between card-elevation-hover">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Detected Conflicts
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight leading-none">
              {kpis.conflicts_detected}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-tight">
              Timetable & resource clashes identified
            </p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
            <span className="inline-flex items-center text-amber-700 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1" />
              Pre-Approval
            </span>
            <Link to="/conflicts" className="text-amber-800 hover:underline font-bold text-[10px]">
              Resolve &rarr;
            </Link>
          </div>
        </div>

        {/* KPI 4: Block Utilization */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3 sm:p-3.5 shadow-xs flex flex-col justify-between card-elevation-hover">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Block Utilization
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight leading-none">
              {kpis.block_utilization_rate ?? (kpis as any).block_utilisation_rate ?? 74.2}%
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-tight">
              Used block hours vs available traffic windows
            </p>
          </div>
          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
            <span className="inline-flex items-center text-purple-700 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 mr-1" />
              OR-Tools
            </span>
            <Link to="/explainability" className="text-railway-blue hover:underline font-bold text-[10px]">
              Explain &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Modern Segmented Tab Switcher */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-1.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveSectionTab("schedule")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSectionTab === "schedule"
                ? "bg-railway-blue text-white shadow-xs font-black"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Corridor Schedule Matrix</span>
          </button>

          <button
            onClick={() => setActiveSectionTab("analytics")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSectionTab === "analytics"
                ? "bg-railway-blue text-white shadow-xs font-black"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Demand & Priority Analytics</span>
          </button>

          <button
            onClick={() => setActiveSectionTab("tasks")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSectionTab === "tasks"
                ? "bg-rose-600 text-white shadow-xs font-black"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>Critical Attention Tasks</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold ${
              activeSectionTab === "tasks" ? "bg-white text-rose-700" : "bg-rose-100 text-rose-800"
            }`}>
              {summary.critical_tasks_requiring_attention.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSectionTab("execution")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSectionTab === "execution"
                ? "bg-emerald-600 text-white shadow-xs font-black"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Live Field Execution</span>
          </button>
        </div>

        {activeSectionTab === "schedule" && (
          <div className="flex items-center space-x-2 px-1">
            <span className="text-xs font-semibold text-slate-500">Period Mode:</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => {
                  setActiveViewMode("WEEK");
                  setPeriod("Week 38 (18 - 24 Sep 2026)");
                }}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeViewMode === "WEEK"
                    ? "bg-white text-railway-blue shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Week (7 Days)
              </button>
              <button
                onClick={() => {
                  setActiveViewMode("MONTH");
                  setPeriod("Month (September 2026)");
                }}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeViewMode === "MONTH"
                    ? "bg-white text-railway-blue shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Month (30 Days)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. DYNAMIC SCHEDULE VIEW: WEEK VIEW VS MONTH VIEW */}
      {activeSectionTab === "schedule" && (
        activeViewMode === "WEEK" ? (
          /* WEEKLY BLOCK TIMELINE */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-railway-blue" />
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Weekly Block Timeline ({daysOfWeek[0]?.dateStr} – {daysOfWeek[6]?.dateStr})
                </h2>
                <span className="bg-blue-50 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded font-mono border border-blue-200">
                  Gantt Matrix
                </span>
                {activePlan?.status && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                    activePlan.status === "Approved" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"
                  }`}>
                    {activePlan.status}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Visual corridor occupancy schedule coordinated across Engineering, S&T, and Traction departments
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Plan Selector */}
              {plans.length > 0 && (
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan:</span>
                  <select
                    value={activePlan?.plan_id || ""}
                    onChange={async (e) => {
                      const p = await api.getOptimizationPlanById(e.target.value);
                      setActivePlan(p);
                    }}
                    className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    {plans.map((p) => (
                      <option key={p.plan_id} value={p.plan_id}>
                        {p.plan_name} ({p.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Week Navigation */}
              <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  onClick={() => {
                    const cur = new Date(weekStartDate);
                    cur.setDate(cur.getDate() - 7);
                    setWeekStartDate(cur.toISOString().split("T")[0]);
                  }}
                  className="p-1 hover:bg-white rounded text-slate-600 cursor-pointer"
                  title="Previous Week"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-bold text-slate-700 px-1 font-mono">
                  {daysOfWeek[0]?.dateStr} – {daysOfWeek[6]?.dateStr}
                </span>
                <button
                  onClick={() => {
                    const cur = new Date(weekStartDate);
                    cur.setDate(cur.getDate() + 7);
                    setWeekStartDate(cur.toISOString().split("T")[0]);
                  }}
                  className="p-1 hover:bg-white rounded text-slate-600 cursor-pointer"
                  title="Next Week"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Status Legend */}
              <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-600 border-l border-slate-200 pl-3">
                <span className="inline-flex items-center">
                  <span className="w-2 h-2 rounded bg-blue-600 mr-1" /> Scheduled
                </span>
                <span className="inline-flex items-center">
                  <span className="w-2 h-2 rounded bg-amber-500 mr-1" /> Conflict
                </span>
                <span className="inline-flex items-center">
                  <span className="w-2 h-2 rounded bg-emerald-600 mr-1" /> Approved
                </span>
              </div>
            </div>
          </div>

          {/* Horizontal Timeline Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[800px] border border-slate-200 rounded-xl overflow-hidden text-xs">
              {/* Day Header Columns */}
              <div className="grid grid-cols-8 bg-slate-100/90 border-b border-slate-200 text-center font-bold text-slate-700 py-2.5 text-[11px]">
                <div className="text-left px-3 text-slate-500 uppercase tracking-wider text-[10px] font-black">
                  Department
                </div>
                {daysOfWeek.map((d) => (
                  <div key={d.key} className="border-l border-slate-200 px-1">
                    <span className="block font-black text-slate-900">{d.name}</span>
                    <span className="block text-[10px] font-medium text-slate-500 font-mono">{d.dateStr}</span>
                  </div>
                ))}
              </div>

              {/* Department Rows */}
              {DEPARTMENTS.map((dept, idx) => {
                const deptBadge =
                  dept === "Engineering"
                    ? "bg-blue-100 text-blue-800 border-blue-200"
                    : dept === "S&T"
                    ? "bg-purple-100 text-purple-800 border-purple-200"
                    : "bg-amber-100 text-amber-800 border-amber-200";

                return (
                  <div
                    key={dept}
                    className={`grid grid-cols-8 border-b border-slate-200 min-h-[96px] ${
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                    }`}
                  >
                    {/* Department Label Cell */}
                    <div className="p-3 flex flex-col justify-center border-r border-slate-200 bg-slate-50/80">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${deptBadge}`}>
                        {dept}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1 font-mono font-medium">
                        {dept === "Engineering" && "Track / Civil"}
                        {dept === "S&T" && "Signals & Tele"}
                        {dept === "Traction" && "25kV OHE"}
                      </span>
                    </div>

                    {/* Day Cells for this Department */}
                    {daysOfWeek.map((day) => {
                      const blocks = timelineGrid[day.key]?.[dept] || [];
                      return (
                        <div
                          key={day.key}
                          className="p-1.5 border-r border-slate-200/80 flex flex-col gap-1.5 justify-center"
                        >
                          {blocks.length === 0 ? (
                            <div className="h-full min-h-[60px] border border-dashed border-slate-200/90 rounded-lg flex items-center justify-center text-[10px] text-slate-400 font-medium">
                              Idle
                            </div>
                          ) : (
                            blocks.map((b) => {
                              const isDeptEng = b.department === "Engineering";
                              const isDeptST = b.department === "S&T";
                              const colorTheme = isDeptEng
                                ? "bg-blue-50/90 border-blue-200 text-blue-950 hover:border-blue-400 hover:bg-blue-100/60"
                                : isDeptST
                                ? "bg-purple-50/90 border-purple-200 text-purple-950 hover:border-purple-400 hover:bg-purple-100/60"
                                : "bg-amber-50/90 border-amber-200 text-amber-950 hover:border-amber-400 hover:bg-amber-100/60";

                              return (
                                <button
                                  key={b.id}
                                  onClick={() => setSelectedBlockItem(b)}
                                  className={`w-full text-left p-2 rounded-xl border transition shadow-2xs hover:shadow-xs cursor-pointer group relative ${colorTheme}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1 font-mono font-bold text-[11px]">
                                      <span>{b.blockId}</span>
                                      {b.bundledWith && b.bundledWith.length > 0 && (
                                        <span className="text-[8px] bg-purple-600 text-white px-1 py-0.2 rounded font-mono font-bold" title="Coordinated multi-department shadow block">
                                          ⚡ BUNDLE
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white/90 border border-slate-200 shadow-2xs">
                                      {b.timeWindow}
                                    </span>
                                  </div>
                                  <div className="font-bold text-[11px] truncate mt-1 text-slate-900 group-hover:text-railway-blue transition">
                                    {b.activity}
                                  </div>
                                  <div className="text-[10px] text-slate-600 font-mono mt-0.5 flex items-center justify-between">
                                    <span className="truncate">{b.section}</span>
                                    <span className="font-bold bg-white/70 px-1 rounded">{b.durationHours}h</span>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* MONTHLY CALENDAR VIEW (30 DAYS) */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <CalendarDays className="w-4 h-4 text-railway-blue" />
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Monthly Block Overview (September 2026)
                </h2>
                <span className="bg-purple-50 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded font-mono border border-purple-200">
                  Full Month Heatmap
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Overview of possession density across the entire month. Click any date to inspect scheduled blocks.
              </p>
            </div>

            {/* Density Legend */}
            <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-600">
              <span>Density:</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-400">
                0
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                1-2
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 font-bold border border-blue-300">
                3+
              </span>
            </div>
          </div>

          {/* 30-Day Grid */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            {/* Days of week header */}
            <div className="grid grid-cols-7 bg-slate-100/90 border-b border-slate-200 text-center text-[11px] font-black text-slate-600 py-2">
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
              <div>Sun</div>
            </div>

            {/* 30 Day Cells */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 text-xs">
              {monthCalendarDays.map((d, index) => {
                if (d.isPadding) {
                  return <div key={`pad-${index}`} className="bg-slate-50/50 min-h-[75px] p-2" />;
                }

                const isSelected = selectedMonthDate === d.dateStr;
                const hasBlocks = d.blocks && d.blocks.length > 0;

                return (
                  <button
                    key={d.dateStr || index}
                    onClick={() => d.dateStr && setSelectedMonthDate(d.dateStr)}
                    className={`min-h-[80px] p-2 text-left flex flex-col justify-between transition cursor-pointer relative ${
                      isSelected
                        ? "bg-blue-50/90 ring-2 ring-railway-blue ring-inset z-10"
                        : d.isPlanningWeek
                        ? "bg-white hover:bg-slate-50"
                        : "bg-slate-50/30 hover:bg-white text-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-xs font-black ${isSelected ? "text-railway-blue" : "text-slate-800"}`}>
                        {d.dayNumber}
                      </span>
                      {d.isPlanningWeek && (
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-100/70 px-1 py-0.2 rounded font-mono">
                          W38
                        </span>
                      )}
                    </div>

                    {hasBlocks ? (
                      <div className="mt-1 space-y-1">
                        <span className="inline-block text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded font-mono">
                          {d.blocks.length} {d.blocks.length === 1 ? "Block" : "Blocks"}
                        </span>
                        <div className="flex items-center space-x-1 pt-0.5">
                          {d.hasEngineering && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" title="Engineering" />}
                          {d.hasST && <span className="w-1.5 h-1.5 rounded-full bg-purple-600" title="S&T" />}
                          {d.hasTraction && <span className="w-1.5 h-1.5 rounded-full bg-amber-600" title="Traction" />}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[9px] text-slate-300 font-mono">No blocks</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Date Inspector in Month View */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Maintenance Blocks for {selectedMonthDate}:
              </span>
              <span className="font-mono text-slate-500 font-bold">
                {selectedDateBlocks.length} Scheduled
              </span>
            </div>

            {selectedDateBlocks.length === 0 ? (
              <p className="text-slate-500 text-xs italic">
                No maintenance blocks scheduled on this date. Use the Weekly View or Workspace to allocate requisitions.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {selectedDateBlocks.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBlockItem(b)}
                    className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs hover:border-blue-300 text-left transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900 text-[11px]">{b.blockId}</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800">
                        {b.department}
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 text-xs mt-1 truncate">{b.activity}</div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono mt-2 pt-1 border-t border-slate-100">
                      <span>{b.section}</span>
                      <span className="font-bold text-slate-900">{b.timeWindow}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* 4. MODERN CHARTS & INSIGHTS ROW (PIE CHART + BAR CHART + PLANNING INSIGHTS) */}
      {activeSectionTab === "analytics" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Chart 1: Department Demand Pie / Donut Chart (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <PieIcon className="w-4 h-4 text-railway-blue" />
                  <h3 className="font-black text-xs uppercase tracking-wider text-slate-900">
                    Department Demand Share
                  </h3>
                </div>
                <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  Pie Chart
                </span>
              </div>

              <p className="text-[11px] text-slate-500 mt-2">
                Proportion of maintenance block demands submitted across Engineering, S&T, and Traction:
              </p>

              {/* Recharts Pie / Donut Component */}
              <div className="h-52 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={departmentPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {departmentPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      formatter={(val) => <span className="text-xs font-semibold text-slate-700">{val}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Total Requests: <strong>{kpis.total_maintenance_requests}</strong></span>
              <span className="text-railway-blue font-bold">100% Normalized</span>
            </div>
          </div>

          {/* Chart 2: Priority Distribution Bar Chart (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <h3 className="font-black text-xs uppercase tracking-wider text-slate-900">
                    Priority Distribution
                  </h3>
                </div>
                <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  Bar Chart
                </span>
              </div>

              <p className="text-[11px] text-slate-500 mt-2">
                Volume of active maintenance requests categorized by safety criticality level:
              </p>

              {/* Recharts Bar Chart Component */}
              <div className="h-52 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} axisLine={{ stroke: "#CBD5E1" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#475569" }} axisLine={{ stroke: "#CBD5E1" }} allowDecimals={false} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {priorityBarData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Critical Coverage: <strong>{kpis.critical_task_coverage || 100}%</strong></span>
              <span className="text-emerald-700 font-bold">Zero Backlog</span>
            </div>
          </div>

          {/* Planning Insights Panel (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-railway-blue" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Planning Insights
                  </h3>
                </div>
                <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md uppercase font-mono border border-slate-200">
                  CP-SAT
                </span>
              </div>

              {/* Insights List */}
              <div className="space-y-2.5 mt-3 text-xs">
                <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 text-emerald-900 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                    <span>3 Compatible Requests Grouped</span>
                  </div>
                  <p className="text-[10px] text-emerald-800 leading-snug pl-5">
                    Track renewal and signal maintenance bundled into single block BLK-101 in Section A-B.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/60 text-amber-900 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                    <span>1 Resource Conflict Detected</span>
                  </div>
                  <p className="text-[10px] text-amber-800 leading-snug pl-5">
                    Engineering Crew 1 demanded simultaneously on 18 Sep. Solver staggered secondary task to 20 Sep.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/60 text-blue-900 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-railway-blue flex-shrink-0" />
                    <span>2 Deadline-Critical Tasks Prioritized</span>
                  </div>
                  <p className="text-[10px] text-blue-800 leading-snug pl-5">
                    Overdue tasks ENG-001 and SNT-002 scored 110.0 pts and granted highest priority.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-100">
              <Link
                to="/conflicts"
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-xs"
              >
                <span>Review Conflict Matrix</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 5. Critical Tasks Requiring Planner Attention */}
      {activeSectionTab === "tasks" && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Critical Tasks Requiring Attention ({summary.critical_tasks_requiring_attention.length})
              </h3>
            </div>

            {/* Live Filter Bar */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Filter by Task ID, Section, Activity..."
                value={criticalTaskSearch}
                onChange={(e) => setCriticalTaskSearch(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-railway-blue focus:outline-none w-64 shadow-2xs font-mono"
              />
              <Link
                to="/requests"
                className="px-3 py-1.5 bg-railway-blue hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-2xs whitespace-nowrap"
              >
                Open Requisitions BDMS &rarr;
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-2.5 px-3">Task ID</th>
                  <th className="py-2.5 px-2">Dept</th>
                  <th className="py-2.5 px-2">Section</th>
                  <th className="py-2.5 px-3">Maintenance Activity</th>
                  <th className="py-2.5 px-2">Deadline</th>
                  <th className="py-2.5 px-2">Priority Score</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.critical_tasks_requiring_attention
                  .filter((t) => {
                    if (!criticalTaskSearch) return true;
                    const q = criticalTaskSearch.toLowerCase();
                    return (
                      t.task_id.toLowerCase().includes(q) ||
                      t.department.toLowerCase().includes(q) ||
                      t.location.toLowerCase().includes(q) ||
                      (t.description || "").toLowerCase().includes(q)
                    );
                  })
                  .map((t, idx) => {
                    const isDeptEng = t.department === "Engineering";
                    const isDeptST = t.department === "S&T" || t.department.includes("Signal");
                    const deptClass = isDeptEng
                      ? "bg-blue-100 text-blue-800"
                      : isDeptST
                      ? "bg-purple-100 text-purple-800"
                      : "bg-amber-100 text-amber-800";

                    return (
                      <tr key={`${t.task_id}-${idx}`} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{t.task_id}</td>
                        <td className="py-2.5 px-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${deptClass}`}>
                            {t.department}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-slate-600 font-mono text-[11px]">{t.location}</td>
                        <td className="py-2.5 px-3 text-slate-800 max-w-md font-semibold" title={t.description}>
                          <div className="truncate text-slate-900 text-[11px] font-bold">
                            {t.description || "Routine Track Inspection & Renewal"}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {t.asset_type && (
                              <span className="text-[10px] text-slate-500 font-normal">
                                Asset: <span className="font-mono font-semibold text-slate-700">{t.asset_type}</span>
                              </span>
                            )}
                            {t.overdue && (
                              <span className="px-1 py-0.2 bg-rose-100 text-rose-800 font-bold rounded text-[9px] border border-rose-200">
                                OVERDUE
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 font-mono text-slate-600 text-[11px]">{t.deadline}</td>
                        <td className="py-2.5 px-2">
                          <span className="font-mono font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[11px]">
                            {t.priority_score.toFixed(0)} pts
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-2">
                          <Link
                            to={`/requests`}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-bold inline-block"
                          >
                            Inspect
                          </Link>
                          <Link
                            to={`/optimizer`}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-railway-blue border border-blue-200 rounded-lg text-[11px] font-bold inline-block"
                          >
                            Optimize &rarr;
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. LIVE FIELD TELEMETRY & PLAN-VS-ACTUAL (TAB 4) */}
      {activeSectionTab === "execution" && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Live Field Execution & Plan-vs-Actual Telemetry
                </h2>
                <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded font-mono border border-emerald-200">
                  TMS Live Feed
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Real-time tracking of track possessions, gang mobilization, and actual vs scheduled clearance times.
              </p>
            </div>
            <Link
              to="/execution"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 self-start"
            >
              <span>Open Execution Console</span>
              <span>&rarr;</span>
            </Link>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Active In Field</span>
              <div className="text-lg font-black text-amber-600 mt-0.5 flex items-center gap-1.5">
                <Activity className="w-4 h-4 animate-pulse" />
                <span>{executionAnalytics?.records?.filter((r: any) => r.status === "IN_PROGRESS").length || 3} Occupations</span>
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Cleared & Safe</span>
              <div className="text-lg font-black text-emerald-600 mt-0.5">
                {executionAnalytics?.records?.filter((r: any) => r.status === "COMPLETED").length || 1} Blocks
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Schedule Variance</span>
              <div className="text-lg font-black text-slate-800 mt-0.5">
                {executionAnalytics?.average_variance_minutes || 0} min avg
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Completion Rate</span>
              <div className="text-lg font-black text-railway-blue mt-0.5">
                {executionAnalytics?.completion_rate_percent || 94.2}%
              </div>
            </div>
          </div>

          {/* Active Execution Stream Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-2.5 px-3">Work Order</th>
                  <th className="py-2.5 px-2">Dept</th>
                  <th className="py-2.5 px-2">Section</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 px-2">Field Progress</th>
                  <th className="py-2.5 px-2">Planned Window</th>
                  <th className="py-2.5 px-2">Variance</th>
                  <th className="py-2.5 px-3 text-right">Field Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(executionAnalytics?.records || []).slice(0, 6).map((rec: any) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{rec.task_id}</td>
                    <td className="py-2.5 px-2 font-bold text-[11px] text-slate-700">{rec.department}</td>
                    <td className="py-2.5 px-2 font-mono text-[11px] text-slate-600">{rec.section}</td>
                    <td className="py-2.5 px-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rec.status === "IN_PROGRESS"
                          ? "bg-amber-100 text-amber-800 animate-pulse"
                          : rec.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-blue-100 text-blue-800"
                      }`}>
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all"
                          style={{ width: `${rec.progress_percent || (rec.status === "COMPLETED" ? 100 : 45)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                        {rec.progress_percent || (rec.status === "COMPLETED" ? 100 : 45)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-mono text-slate-600 text-[11px]">
                      {rec.planned_duration_hours || 2.5} hrs
                    </td>
                    <td className="py-2.5 px-2 font-mono text-[11px]">
                      {(rec.delay_minutes || 0) > 0 ? (
                        <span className="text-rose-600 font-bold">+{rec.delay_minutes} min</span>
                      ) : (
                        <span className="text-emerald-700 font-bold">On Schedule</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        to="/execution"
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-bold inline-block"
                      >
                        Update Log &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Block Details Inspector Modal */}
      {selectedBlockItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                  BLOCK OCCUPANCY INSPECTOR
                </span>
                <h3 className="font-extrabold text-base text-slate-900">{selectedBlockItem.blockId}</h3>
              </div>
              <button
                onClick={() => setSelectedBlockItem(null)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-sm">{selectedBlockItem.activity}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                    {selectedBlockItem.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 font-mono text-[11px] pt-1 border-t border-slate-200">
                  <div>Department: <strong>{selectedBlockItem.department}</strong></div>
                  <div>Section: <strong>{selectedBlockItem.section}</strong></div>
                  <div>Time Window: <strong>{selectedBlockItem.timeWindow}</strong></div>
                  <div>Duration: <strong>{selectedBlockItem.durationHours} hrs</strong></div>
                  {selectedBlockItem.assetType && (
                    <div>Asset Class: <strong>{selectedBlockItem.assetType}</strong></div>
                  )}
                  <div>Requisition ID: <strong>{selectedBlockItem.taskId}</strong></div>
                </div>
              </div>

              {selectedBlockItem.bundledWith && selectedBlockItem.bundledWith.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl space-y-1">
                  <span className="font-bold text-purple-950 block">Joint Bundled Departments:</span>
                  <p className="text-purple-900">
                    Bundled with {selectedBlockItem.bundledWith.join(", ")} into single coordinated traffic possession.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedBlockItem(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSelectedBlockItem(null);
                  navigate("/execution");
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
              >
                Track Execution &rarr;
              </button>
              <button
                onClick={() => {
                  setSelectedBlockItem(null);
                  navigate("/optimizer");
                }}
                className="px-4 py-2 bg-railway-blue hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
              >
                View in Optimizer &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
