import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Train,
  ShieldAlert,
  Layers,
  Cpu,
  CheckCircle2,
  ArrowRight,
  Database,
  Sliders,
  CalendarCheck,
  Building2,
  FileSpreadsheet,
  AlertTriangle,
  HelpCircle,
  CheckSquare,
  History,
  Sparkles
} from "lucide-react";
import { api } from "../services/api";

const PIPELINE_STEPS = [
  { step: 1, name: "Demands", sub: "BDMS / Requisitions", path: "/requests", color: "blue" },
  { step: 2, name: "Validation", sub: "Live 4-Point Check", path: "/requests", color: "indigo" },
  { step: 3, name: "Conflicts", sub: "5-D Clash Engine", path: "/conflicts", color: "rose" },
  { step: 4, name: "Optimization", sub: "OR-Tools CP-SAT", path: "/optimizer", color: "purple" },
  { step: 5, name: "Explainability", sub: "Transparent Rules", path: "/explainability", color: "blue" },
  { step: 6, name: "Human Approval", sub: "Sanction Gates", path: "/approval", color: "emerald" },
  { step: 7, name: "Audit Trail", sub: "Append-Only Log", path: "/audit", color: "slate" },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [syncStatus, setSyncStatus] = React.useState<string | null>(null);

  const handleLoadDemoData = async () => {
    setLoading(true);
    try {
      const res = await api.importDemoTasks();
      setSyncStatus(res.message || "Demo dataset verified & loaded into PostgreSQL engine!");
      setTimeout(() => {
        navigate("/dashboard");
      }, 1200);
    } catch (err: any) {
      setSyncStatus(`Sync error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 py-2">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#0B192C] via-[#0E2440] to-[#1E3E62] text-white rounded-3xl p-8 sm:p-12 shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl space-y-4 relative z-10">
          <div className="inline-flex items-center space-x-2 bg-blue-500/20 text-blue-200 border border-blue-400/30 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide">
            <Train className="w-4 h-4 text-blue-300" />
            <span>Smart India Hackathon 2026 &bull; Problem Statement 26027</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            MARGSETU
          </h1>
          <p className="text-base sm:text-xl text-blue-100 font-semibold leading-relaxed">
            AI-Assisted Maintenance Block Planning Decision-Support System for Indian Railways
          </p>
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
            Coordinate multi-departmental track possession demands, detect timetable clashes and resource bottlenecks,
            and synthesize constraint-optimized maintenance blocks across Engineering, S&T, and Traction departments
            using deterministic Google OR-Tools CP-SAT integer programming.
          </p>

          <div className="pt-3 flex flex-wrap gap-3 items-center">
            <Link
              to="/dashboard"
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-railway-blue hover:from-blue-500 hover:to-blue-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition active:scale-95"
            >
              <span>Open Planning Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <button
              onClick={handleLoadDemoData}
              disabled={loading}
              className="inline-flex items-center space-x-2 px-5 py-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-sm transition active:scale-95"
            >
              <Database className="w-4 h-4 text-emerald-400" />
              <span>{loading ? "Loading Dataset..." : "Load Demo Dataset"}</span>
            </button>
          </div>

          {syncStatus && (
            <div className="mt-3 text-xs text-emerald-300 font-mono bg-emerald-950/70 px-3.5 py-1.5 rounded-lg border border-emerald-500/40 inline-block">
              {syncStatus}
            </div>
          )}

          {/* Mandatory Demo Disclosure */}
          <div className="pt-5 border-t border-slate-700/80 flex items-center space-x-2 text-xs text-slate-400">
            <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              Synthetic Indian Railways Corridor Alpha Data &bull; Not Connected to Live PRS/FOIS/COA Systems &bull; Non-Autonomous Human-in-the-Loop Control
            </span>
          </div>
        </div>
      </div>

      {/* Decision Workflow Pipeline Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-railway-blue" />
            <h3 className="font-black text-xs uppercase tracking-wider text-slate-900">
              End-to-End Operational Decision Pipeline
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500 font-semibold">
            Click any step to inspect
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
          {PIPELINE_STEPS.map((step) => (
            <Link
              key={step.step}
              to={step.path}
              className="group p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-blue-300 hover:shadow-xs transition text-left flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="w-5 h-5 rounded-md bg-white border border-slate-200 text-slate-700 font-mono font-bold text-[10px] flex items-center justify-center group-hover:bg-railway-blue group-hover:text-white group-hover:border-railway-blue transition">
                  {step.step}
                </span>
                <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-railway-blue group-hover:translate-x-0.5 transition" />
              </div>
              <div className="mt-2">
                <strong className="text-slate-900 text-xs block font-bold group-hover:text-railway-blue transition">
                  {step.name}
                </strong>
                <span className="text-[10px] text-slate-500 block truncate">
                  {step.sub}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Three Main Architecture Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md transition space-y-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-railway-blue flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-black text-slate-900">1. Unified Multi-Dept Requisitions</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Consolidate fragmented demands from BDMS, Track (TMS), Signals (SMMS), and OHE (TDMS) into a unified workspace with live 4-point constraint pre-validation and deterministic priority scoring.
          </p>
          <div className="pt-2">
            <Link to="/requests" className="text-xs font-bold text-railway-blue hover:underline inline-flex items-center space-x-1">
              <span>View Maintenance Requests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md transition space-y-3">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-black text-slate-900">2. CP-SAT Integer Programming</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Google OR-Tools mathematically bounds train timetable paths, depot crew capacities, track occupancy rules, and joint maintenance bundling to formulate conflict-free block schedules.
          </p>
          <div className="pt-2">
            <Link to="/optimizer" className="text-xs font-bold text-purple-700 hover:underline inline-flex items-center space-x-1">
              <span>Inspect Block Optimizer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md transition space-y-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-black text-slate-900">3. Explainable Human-in-the-Loop</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Zero opaque machine learning. Every block proposal provides verifiable constraint proofs and rule justifications, keeping ultimate power disconnection and track sanction authority with railway controllers.
          </p>
          <div className="pt-2">
            <Link to="/approval" className="text-xs font-bold text-emerald-700 hover:underline inline-flex items-center space-x-1">
              <span>Open Approval Screen</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Simulated Railway Corridor Specifications */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs text-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h4 className="font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-2 text-xs">
            <Building2 className="w-4 h-4 text-slate-600" />
            <span>Simulated Railway Operational Corridor Specifications</span>
          </h4>
          <span className="font-mono text-[11px] text-slate-500 font-semibold">Corridor Alpha &bull; IR Zone NR-DLI</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700 pt-1">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
            <span className="text-slate-400 block text-[10px] font-bold uppercase">Corridor Name</span>
            <strong className="text-slate-900 text-xs">Mainline Corridor Alpha</strong>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
            <span className="text-slate-400 block text-[10px] font-bold uppercase">Active Sections</span>
            <strong className="text-slate-900 text-xs">Sec A-B, Sec B-C, Sec C-D</strong>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
            <span className="text-slate-400 block text-[10px] font-bold uppercase">Track Architecture</span>
            <strong className="text-slate-900 text-xs">Electrified Double Line (UP/DN)</strong>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
            <span className="text-slate-400 block text-[10px] font-bold uppercase">Coordination Scope</span>
            <strong className="text-slate-900 text-xs">Engineering, S&T, Traction</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
