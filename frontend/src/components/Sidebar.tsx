import React, { useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  AlertTriangle,
  Cpu,
  HelpCircle,
  CheckSquare,
  History,
  Sliders,
  CalendarDays,
  Database,
  Settings,
  UserCheck,
  X,
  Train,
  Wrench,
  PlayCircle,
  FileText,
  Calendar,
  Layers,
  Shield
} from "lucide-react";
import { usePlanning, DepartmentRole, ROLE_CONFIGS } from "../context/PlanningContext";
import { useAuth } from "../context/AuthContext";

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  step?: number;
}

const CORE_OPERATIONS: NavItem[] = [
  { name: "Command Center Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Maintenance Work-Orders", path: "/maintenance", icon: ClipboardList, badge: "BDMS" },
  { name: "Assets & Infrastructure", path: "/assets", icon: Wrench, badge: "LIFECYCLE" },
  { name: "Corridor Block Windows", path: "/block-windows", icon: CalendarDays },
  { name: "Timetable & Train Paths", path: "/timetable", icon: Train, badge: "TMS" },
];

const OPTIMIZATION_SUITE: NavItem[] = [
  { name: "5D Conflict Incident Room", path: "/conflicts", icon: AlertTriangle, badge: "5D ENGINE" },
  { name: "CP-SAT Optimization Plans", path: "/optimizer", icon: Cpu, badge: "A/B/C" },
  { name: "Weekly Corridor Board", path: "/plans/weekly", icon: Calendar },
  { name: "Monthly Density Calendar", path: "/plans/monthly", icon: Layers },
  { name: "Human Sanction & Approval", path: "/approval", icon: CheckSquare, badge: "HITL" },
  { name: "Decision Explainability", path: "/explainability", icon: HelpCircle },
];

const LIVE_EXECUTION_TOOLS: NavItem[] = [
  { name: "Live Execution (Plan vs Actual)", path: "/execution", icon: PlayCircle, badge: "LIVE" },
  { name: "What-If Capacity Simulation", path: "/simulation", icon: Sliders },
  { name: "Reports & Data Exports", path: "/reports", icon: FileText },
  { name: "Audit Trail History", path: "/audit", icon: History },
  { name: "System Admin & Weights", path: "/admin", icon: Shield, badge: "RBAC" },
];

export const Sidebar: React.FC = () => {
  const { departmentRole, setDepartmentRole, sidebarOpen, setSidebarOpen } = usePlanning();
  const { user } = useAuth();

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSidebarOpen]);

  return (
    <>
      {/* Dimmed Backdrop Overlay */}
      <div
        onClick={() => setSidebarOpen(false)}
        className={`fixed inset-0 bg-slate-950/50 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-80 max-w-[88vw] bg-white z-50 shadow-2xl flex flex-col justify-between transform transition-transform duration-300 ease-out border-r border-slate-200 select-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Operations Pipeline Drawer"
      >
        {/* Drawer Top Header */}
        <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0056B3] to-[#0A3161] flex items-center justify-center text-white shadow-xs">
              <Train className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-black tracking-wider text-slate-900">MARGSETU</div>
              <div className="text-[10px] text-slate-500 font-medium -mt-0.5">Enterprise Railway Suite</div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition cursor-pointer"
            title="Close Menu (Esc)"
            aria-label="Close Menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Workflow Navigation Links */}
        <div className="py-3 px-3 space-y-4 overflow-y-auto flex-1">
          {/* Section 1: Core Operations */}
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-black tracking-wider text-slate-400 uppercase">
              Core Operations
            </div>
            {CORE_OPERATIONS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 group ${
                      isActive
                        ? "bg-gradient-to-r from-[#0056B3] to-[#0A417C] text-white shadow-xs"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center space-x-2.5">
                        <Icon
                          className={`w-4 h-4 flex-shrink-0 ${
                            isActive ? "text-white" : "text-slate-500 group-hover:text-slate-800"
                          }`}
                        />
                        <span className="truncate">{item.name}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md font-mono ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>

          {/* Section 2: Optimization & Decision */}
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-black tracking-wider text-slate-400 uppercase">
              Optimization &amp; Planning
            </div>
            {OPTIMIZATION_SUITE.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 group ${
                      isActive
                        ? "bg-gradient-to-r from-[#0056B3] to-[#0A417C] text-white shadow-xs"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center space-x-2.5">
                        <Icon
                          className={`w-4 h-4 flex-shrink-0 ${
                            isActive ? "text-white" : "text-slate-500 group-hover:text-slate-800"
                          }`}
                        />
                        <span className="truncate">{item.name}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md font-mono ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>

          {/* Section 3: Live Monitoring & Intelligence */}
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-black tracking-wider text-slate-400 uppercase">
              Monitoring &amp; Control
            </div>
            {LIVE_EXECUTION_TOOLS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 group ${
                      isActive
                        ? "bg-gradient-to-r from-[#0056B3] to-[#0A417C] text-white shadow-xs"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center space-x-2.5">
                        <Icon
                          className={`w-4 h-4 flex-shrink-0 ${
                            isActive ? "text-white" : "text-slate-500 group-hover:text-slate-800"
                          }`}
                        />
                        <span className="truncate">{item.name}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md font-mono ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Bottom of Drawer: System Status & Role Selector */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/80 space-y-2.5 flex-shrink-0">
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="text-[11px] font-bold text-slate-500">PostgreSQL Status</span>
            <div className="flex items-center space-x-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Production Live</span>
            </div>
          </div>

          {/* Active Role Perspective Selector */}
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              <UserCheck className="w-3 h-3 text-blue-600" />
              <span>Department Perspective</span>
            </div>
            <select
              value={departmentRole}
              onChange={(e) => setDepartmentRole(e.target.value as any)}
              className="w-full text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer border-none p-0"
            >
              {(Object.keys(ROLE_CONFIGS) as DepartmentRole[]).map((key) => (
                <option key={key} value={key}>
                  {ROLE_CONFIGS[key].title} ({ROLE_CONFIGS[key].designation})
                </option>
              ))}
            </select>
          </div>
        </div>
      </aside>
    </>
  );
};
