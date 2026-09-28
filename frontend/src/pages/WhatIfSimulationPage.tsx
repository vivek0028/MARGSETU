import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Sliders,
  Play,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  Clock,
  Layers,
  Info,
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import { api } from "../services/api";

export const WhatIfSimulationPage: React.FC = () => {
  const [durationBonus, setDurationBonus] = useState<number>(0.5);
  const [extraCrews, setExtraCrews] = useState<number>(1);
  const [allowBundling, setAllowBundling] = useState<boolean>(true);
  const [strategy, setStrategy] = useState<string>("PLAN_A_CRITICAL");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunSimulation = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.runSimulation({
        block_duration_bonus_hours: durationBonus,
        additional_crew_count: extraCrews,
        allow_bundling: allowBundling,
        strategy_type: strategy
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Simulation execution failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setDurationBonus(0.0);
    setExtraCrews(0);
    setAllowBundling(true);
    setStrategy("PLAN_A_CRITICAL");
    setResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">What-If Operational Simulation</h1>
            <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-0.5 rounded uppercase">
              Scenario Modeling
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Evaluate how modifying block duration windows, adding maintenance gangs, or adjusting bundling rules impacts network throughput
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleReset}
            className="inline-flex items-center space-x-1 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={handleRunSimulation}
            disabled={loading}
            className="inline-flex items-center space-x-2 px-5 py-2 rounded-lg bg-railway-blue hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition"
          >
            <Play className={`w-3.5 h-3.5 ${loading ? "animate-pulse" : ""}`} />
            <span>{loading ? "Simulating with CP-SAT..." : "Run Simulation"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-300 text-rose-800 text-xs p-4 rounded-md">
          {error}
        </div>
      )}

      {/* Control Panel Grid */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-railway-blue" />
          <span>Operational Parameter Controls</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
          {/* Slider 1: Block Duration Delta */}
          <div className="space-y-2">
            <div className="flex justify-between font-semibold text-slate-700">
              <label>Block Window Adjustment:</label>
              <span className="font-mono text-railway-blue font-bold">
                {durationBonus > 0 ? `+${durationBonus}` : durationBonus} hrs
              </span>
            </div>
            <input
              type="range"
              min="-1.5"
              max="2.5"
              step="0.5"
              value={durationBonus}
              onChange={(e) => setDurationBonus(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-railway-blue"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>-1.5h (Tight)</span>
              <span>0h (Standard)</span>
              <span>+2.5h (Extended)</span>
            </div>
          </div>

          {/* Dropdown 2: Additional Crews */}
          <div className="space-y-2">
            <label className="block font-semibold text-slate-700">Deploy Additional Gangs:</label>
            <select
              value={extraCrews}
              onChange={(e) => setExtraCrews(parseInt(e.target.value))}
              className="w-full border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-railway-blue"
            >
              <option value="0">Standard Depot Deployment (0 Extra)</option>
              <option value="1">+1 Extra Track & Signal Gang</option>
              <option value="2">+2 Multi-Skilled Flying Squads</option>
            </select>
            <p className="text-[11px] text-slate-400">Relaxes resource double-booking bottlenecks across sections.</p>
          </div>

          {/* Dropdown 3: Base Strategy */}
          <div className="space-y-2">
            <label className="block font-semibold text-slate-700">Optimization Priority:</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-railway-blue"
            >
              <option value="PLAN_A_CRITICAL">Plan A — Critical & Overdue Priority</option>
              <option value="PLAN_B_TRAIN_IMPACT">Plan B — Minimum Train Timetable Clash</option>
              <option value="PLAN_C_BUNDLING">Plan C — Multi-Department Joint Bundling</option>
            </select>
            <p className="text-[11px] text-slate-400">Select underlying mathematical objective formulation.</p>
          </div>

          {/* Toggle 4: Bundling Toggle */}
          <div className="space-y-2">
            <label className="block font-semibold text-slate-700">Multi-Department Bundling:</label>
            <div className="flex items-center space-x-3 pt-1">
              <button
                type="button"
                onClick={() => setAllowBundling(!allowBundling)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  allowBundling ? "bg-railway-blue" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    allowBundling ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="font-semibold text-slate-800">
                {allowBundling ? "Enabled (Parallel blocks)" : "Disabled (Pure sequential)"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Allow joint Civil, S&T, and OHE parallel occupancy.</p>
          </div>
        </div>
      </div>

      {/* Simulation Results (Before vs After) */}
      {result && (
        <div className="space-y-5 animate-fadeIn">
          {/* Narrative Impact Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-start space-x-3">
            <TrendingUp className="w-5 h-5 text-railway-blue flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-railway-blue">Simulated Operational Impact</h4>
              <p className="text-xs text-slate-800 mt-1 leading-relaxed">
                {result.impact_summary}
              </p>
              <span className="text-[11px] text-slate-500 font-mono mt-2 block">
                Calculated deterministically via Google OR-Tools CP-SAT integer optimization.
              </span>
            </div>
          </div>

          {/* Comparative Metrics Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Before vs. After Delta Comparison</h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              {/* Metric 1 */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 block">Scheduled Tasks</span>
                <div className="flex items-baseline space-x-2">
                  <strong className="text-xl font-mono text-slate-900">{result.simulated_kpis.scheduled_count}</strong>
                  <span className="text-slate-400 text-xs">from {result.baseline_kpis.scheduled_count}</span>
                </div>
                <div className={`text-xs font-bold font-mono ${result.delta.scheduled_tasks_delta >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                  {result.delta.scheduled_tasks_delta >= 0 ? `+${result.delta.scheduled_tasks_delta}` : result.delta.scheduled_tasks_delta} tasks
                </div>
              </div>

              {/* Metric 2 */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 block">Deferred Tasks</span>
                <div className="flex items-baseline space-x-2">
                  <strong className="text-xl font-mono text-slate-900">{result.simulated_kpis.deferred_count}</strong>
                  <span className="text-slate-400 text-xs">from {result.baseline_kpis.deferred_count}</span>
                </div>
                <div className={`text-xs font-bold font-mono ${result.delta.deferred_tasks_delta <= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                  {result.delta.deferred_tasks_delta <= 0 ? `${result.delta.deferred_tasks_delta}` : `+${result.delta.deferred_tasks_delta}`} deferred
                </div>
              </div>

              {/* Metric 3 */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 block">Block Utilisation</span>
                <div className="flex items-baseline space-x-2">
                  <strong className="text-xl font-mono text-railway-blue">{result.simulated_kpis.utilization_rate}%</strong>
                  <span className="text-slate-400 text-xs">from {result.baseline_kpis.utilization_rate}%</span>
                </div>
                <div className="text-xs font-bold font-mono text-slate-700">
                  {result.delta.utilization_rate_delta >= 0 ? `+${result.delta.utilization_rate_delta}` : result.delta.utilization_rate_delta}% delta
                </div>
              </div>

              {/* Metric 4 */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 block">Critical Coverage</span>
                <div className="flex items-baseline space-x-2">
                  <strong className="text-xl font-mono text-emerald-700">{result.simulated_kpis.critical_coverage}%</strong>
                  <span className="text-slate-400 text-xs">from {result.baseline_kpis.critical_coverage}%</span>
                </div>
                <div className={`text-xs font-bold font-mono ${result.delta.critical_coverage_delta >= 0 ? "text-emerald-700" : "text-slate-600"}`}>
                  {result.delta.critical_coverage_delta >= 0 ? `+${result.delta.critical_coverage_delta}` : result.delta.critical_coverage_delta}% coverage
                </div>
              </div>
            </div>

            {/* Action link to Approval workflow */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Link
                to="/approval"
                className="inline-flex items-center space-x-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
              >
                <span>Submit / Approve Plan in Review Workflow</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
