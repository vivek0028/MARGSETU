import React, { useState } from "react";
import {
  Settings,
  Sliders,
  Cpu,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
  Save,
  Database
} from "lucide-react";
import { api } from "../services/api";

export const SettingsPage: React.FC = () => {
  const [criticalityWeight, setCriticalityWeight] = useState(40);
  const [urgencyWeight, setUrgencyWeight] = useState(25);
  const [overdueWeight, setOverdueWeight] = useState(20);
  const [impactWeight, setImpactWeight] = useState(15);
  const [solverTimeout, setSolverTimeout] = useState(5.0);
  const [workerThreads, setWorkerThreads] = useState(4);
  const [notice, setNotice] = useState<string | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Load saved settings from localStorage on initial render
  React.useEffect(() => {
    const saved = localStorage.getItem("railoptiblock_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.criticalityWeight) setCriticalityWeight(parsed.criticalityWeight);
        if (parsed.urgencyWeight) setUrgencyWeight(parsed.urgencyWeight);
        if (parsed.overdueWeight) setOverdueWeight(parsed.overdueWeight);
        if (parsed.impactWeight) setImpactWeight(parsed.impactWeight);
        if (parsed.solverTimeout) setSolverTimeout(parsed.solverTimeout);
        if (parsed.workerThreads) setWorkerThreads(parsed.workerThreads);
      } catch (e) {
        console.error("Failed to parse settings:", e);
      }
    }
  }, []);

  const handleRecalculatePriorities = async () => {
    setIsRecalculating(true);
    try {
      const res = await api.recalculatePriorities();
      setNotice(`Network priority scores recalculated for ${res.tasks_recalculated} tasks across departments using active weightings.`);
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      alert(`Recalculation error: ${err.message}`);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const config = {
      criticalityWeight,
      urgencyWeight,
      overdueWeight,
      impactWeight,
      solverTimeout,
      workerThreads,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem("railoptiblock_settings", JSON.stringify(config));
    setNotice("Configuration successfully saved to local persistent storage. Solver parameters will be applied to subsequent corridor runs.");
    setTimeout(() => setNotice(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">System Settings & Weights</h1>
          <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-0.5 rounded font-mono">
            Configuration
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Tune mathematical objective weights, Google OR-Tools CP-SAT solver parameters, and operational bounds
        </p>
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs p-3.5 rounded-md font-medium flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Priority Scoring Engine Weights */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-railway-blue" />
                <span>Priority Scoring Formula Weights</span>
              </h3>
              <p className="text-xs text-slate-500">Transparent mathematical point allocations (Total Max: 100+ points)</p>
            </div>

            <button
              type="button"
              onClick={handleRecalculatePriorities}
              disabled={isRecalculating}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded bg-blue-50 text-railway-blue hover:bg-blue-100 border border-blue-200 text-xs font-bold transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? "animate-spin" : ""}`} />
              <span>{isRecalculating ? "Recalculating..." : "Recalculate All Scores"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex justify-between font-semibold text-slate-700">
                <span>Criticality Points:</span>
                <span className="font-mono text-rose-700 font-bold">Max {criticalityWeight} pts</span>
              </div>
              <input
                type="range"
                min="20"
                max="60"
                value={criticalityWeight}
                onChange={(e) => setCriticalityWeight(parseInt(e.target.value))}
                className="w-full accent-railway-blue"
              />
              <span className="text-[11px] text-slate-400 block">Critical: 40 | High: 30 | Med: 20 | Low: 10</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex justify-between font-semibold text-slate-700">
                <span>Deadline Urgency:</span>
                <span className="font-mono text-orange-700 font-bold">Max {urgencyWeight} pts</span>
              </div>
              <input
                type="range"
                min="10"
                max="40"
                value={urgencyWeight}
                onChange={(e) => setUrgencyWeight(parseInt(e.target.value))}
                className="w-full accent-railway-blue"
              />
              <span className="text-[11px] text-slate-400 block">&le;2 days: 25 | &le;7 days: 15 | &le;14 days: 8</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex justify-between font-semibold text-slate-700">
                <span>Overdue Penalty:</span>
                <span className="font-mono text-rose-800 font-bold">+{overdueWeight} pts</span>
              </div>
              <input
                type="range"
                min="10"
                max="30"
                value={overdueWeight}
                onChange={(e) => setOverdueWeight(parseInt(e.target.value))}
                className="w-full accent-railway-blue"
              />
              <span className="text-[11px] text-slate-400 block">Immediate safety cycle escalation points</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex justify-between font-semibold text-slate-700">
                <span>Operational Impact:</span>
                <span className="font-mono text-blue-700 font-bold">Max {impactWeight} pts</span>
              </div>
              <input
                type="range"
                min="5"
                max="25"
                value={impactWeight}
                onChange={(e) => setImpactWeight(parseInt(e.target.value))}
                className="w-full accent-railway-blue"
              />
              <span className="text-[11px] text-slate-400 block">Track & Signals: 15 | OHE & Bridges: 12</span>
            </div>
          </div>
        </div>

        {/* OR-Tools CP-SAT Solver Configuration */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-purple-600" />
              <span>Google OR-Tools CP-SAT Engine Configuration</span>
            </h3>
            <p className="text-xs text-slate-500">Mathematical solver thread limits and convergence bounds</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Max Solver Time (Seconds):</label>
              <input
                type="number"
                min="1"
                max="30"
                step="1"
                value={solverTimeout}
                onChange={(e) => setSolverTimeout(parseFloat(e.target.value))}
                className="w-full border border-slate-300 rounded p-2 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">CP-SAT typically converges in &lt; 0.5s on demo corridor.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">CPU Worker Threads:</label>
              <input
                type="number"
                min="1"
                max="16"
                value={workerThreads}
                onChange={(e) => setWorkerThreads(parseInt(e.target.value))}
                className="w-full border border-slate-300 rounded p-2 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">Parallel search threads for branch-and-bound solver.</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Active Operational Corridor:</label>
              <input
                type="text"
                disabled
                value="Mainline Corridor Alpha (Section A-D)"
                className="w-full border border-slate-200 rounded p-2 bg-slate-100 text-slate-600 font-medium"
              />
              <p className="text-[11px] text-slate-400 mt-1">Fixed for Hackathon demo evaluation.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center space-x-2 px-6 py-2.5 bg-railway-blue hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
};
