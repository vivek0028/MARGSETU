import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Cpu,
  RefreshCw,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ArrowRight,
  Info,
  Calendar,
  X,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { api } from "../services/api";
import { SchedulePlan, ScheduleAssignment, DeferredTaskItem, MaintenanceTask } from "../types";
import { DepartmentBadge, PriorityBadge, StatusBadge } from "../components/Badges";
import { usePlanning } from "../context/PlanningContext";

export const OptimisationResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { period, setPeriod, corridor, setCorridor } = usePlanning();

  const [plans, setPlans] = useState<SchedulePlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string>("PLAN-A-CRIT");
  const [planDetail, setPlanDetail] = useState<SchedulePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Selected assignment for Explainability Modal
  const [selectedAssignment, setSelectedAssignment] = useState<ScheduleAssignment | null>(null);
  const [selectedDeferred, setSelectedDeferred] = useState<DeferredTaskItem | null>(null);

  // Manual Override State
  const [overrideTask, setOverrideTask] = useState<MaintenanceTask | null>(null);
  const [availableBlocks, setAvailableBlocks] = useState<any[]>([]);
  const [targetBlockId, setTargetBlockId] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const loadPlans = async (targetId?: string) => {
    setLoading(true);
    try {
      const data = await api.getOptimizationPlans();
      setPlans(data);
      const chosenId = targetId || searchParams.get("plan") || (data.length > 0 ? data[0].plan_id : "PLAN-A-CRIT");
      setActivePlanId(chosenId);
      loadPlanDetail(chosenId);
    } catch (err: any) {
      console.error("Error loading plans:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadPlanDetail = async (planId: string) => {
    try {
      const detail = await api.getOptimizationPlanById(planId);
      setPlanDetail(detail);
    } catch (err: any) {
      console.error("Error loading plan detail:", err);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleSelectPlan = (planId: string) => {
    setActivePlanId(planId);
    setSearchParams({ plan: planId });
    loadPlanDetail(planId);
  };

  const handleGeneratePlans = async () => {
    setIsGenerating(true);
    setActionNotice(null);
    try {
      await api.generateOptimizationPlans({ strategy_type: "ALL" });
      setActionNotice("Constraint Optimization complete: Schedule synthesized across Engineering, S&T, and Traction.");
      await loadPlans(activePlanId);
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err: any) {
      alert(`Optimization failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await api.generateOptimizationPlans({ strategy_type: "ALL" });
      setActionNotice("Planner schedule reset to baseline constraint model.");
      await loadPlans("PLAN-A-CRIT");
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openOverrideModal = async (task: MaintenanceTask) => {
    setOverrideTask(task);
    setOverrideReason("Operational track inspection prioritized by Divisional Controller.");
    setOverrideError(null);
    try {
      const blocks = await api.getBlockWindows();
      setAvailableBlocks(blocks);
      if (blocks.length > 0) setTargetBlockId(blocks[0].block_id);
    } catch {
      setAvailableBlocks([]);
    }
  };

  const handleApplyOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideTask || !targetBlockId) return;
    setOverrideLoading(true);
    setOverrideError(null);
    try {
      await api.overridePlanAssignment(activePlanId, {
        task_id: overrideTask.task_id,
        target_block_id: targetBlockId,
        reason: overrideReason
      });
      setOverrideTask(null);
      setActionNotice(`Manual override applied: ${overrideTask.task_id} assigned to ${targetBlockId}.`);
      loadPlanDetail(activePlanId);
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err: any) {
      setOverrideError(err.message || "Override failed due to railway safety constraints.");
    } finally {
      setOverrideLoading(false);
    }
  };

  const activePlan = plans.find(p => p.plan_id === activePlanId) || planDetail;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Optimized Block Plan</h1>
            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              Constraint-Aware
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Constraint-aware maintenance schedule generated for planner review.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate("/explainability")}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
          >
            <Info className="w-3.5 h-3.5 text-railway-blue" />
            <span>Explainability Inspector</span>
          </button>
          <button
            onClick={() => navigate("/approval")}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
          >
            <span>Proceed to Approval</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs px-4 py-2.5 rounded-lg font-medium flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Top Controls: Planning Period, Corridor / Section, Generate Plan, Reset */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center space-x-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-bold text-slate-700">Planning Period:</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium focus:ring-2 focus:ring-railway-blue"
            >
              <option value="Week 38 (18 - 24 Sep 2026)">Week 38 (18 - 24 Sep 2026)</option>
              <option value="Week 39 (25 Sep - 01 Oct 2026)">Week 39 (25 Sep - 01 Oct 2026)</option>
              <option value="Monthly Cycle (Sep - Oct 2026)">Monthly Cycle (Sep - Oct 2026)</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-slate-700">Corridor / Section:</span>
            <select
              value={corridor}
              onChange={(e) => setCorridor(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium focus:ring-2 focus:ring-railway-blue"
            >
              <option value="Mainline Corridor Alpha (Sec A-D)">Mainline Corridor Alpha (Sec A-D)</option>
              <option value="Section A-B (Highheadway Track)">Section A-B (High-headway Track)</option>
              <option value="Section B-C (Junction Corridor)">Section B-C (Junction Corridor)</option>
              <option value="Section C-D (Express Bypass)">Section C-D (Express Bypass)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleReset}
            disabled={isGenerating}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset</span>
          </button>
          <button
            onClick={handleGeneratePlans}
            disabled={isGenerating}
            className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-lg bg-railway-blue hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
            <span>{isGenerating ? "Optimizing..." : "Generate Plan"}</span>
          </button>
        </div>
      </div>

      {/* Plan Strategy Selection Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {plans.map((p) => {
          const isSelected = p.plan_id === activePlanId;
          return (
            <button
              key={p.plan_id}
              onClick={() => handleSelectPlan(p.plan_id)}
              className={`p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "bg-white border-railway-blue ring-2 ring-blue-500/20 shadow-sm"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-slate-500">{p.plan_id}</span>
                  <StatusBadge status={p.status} />
                </div>
                <h3 className="text-sm font-black text-slate-900 mt-1">{p.plan_name}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.notes}</p>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Scheduled</span>
                  <strong className="text-slate-900 font-mono text-sm">{p.scheduled_count}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Utilisation</span>
                  <strong className="text-railway-blue font-mono text-sm">{p.utilization_rate}%</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Coverage</span>
                  <strong className="text-emerald-700 font-mono text-sm">{p.critical_coverage}%</strong>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* MAIN HERO VISUAL: MULTI-DEPARTMENT CO-ORDINATED BLOCK TIMELINE */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                Coordinated Maintenance Block Schedule (Hero View)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Simultaneous corridor possession bundling Engineering, S&T, and Traction into synchronized windows
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono font-bold text-xs px-2.5 py-1 rounded-lg flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>✓ FEASIBLE</span>
            </span>
          </div>
        </div>

        {/* The Coordinated Window Visual Timeline */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between text-xs pb-2 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                Tuesday
              </span>
              <span className="font-bold text-slate-700">Section A–B</span>
              <span className="text-slate-400">&bull;</span>
              <span className="font-mono font-bold text-railway-blue">09:00 – 12:00</span>
              <span className="text-slate-500">(3.0 hrs total window)</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              Corridor Capacity: <strong>100% Conflict-Free</strong>
            </span>
          </div>

          {/* Department Stacked Gantt Bars */}
          <div className="space-y-2.5 pt-1">
            {/* Engineering Row */}
            <div className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-3 sm:col-span-2 text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                <span>Engineering</span>
              </div>
              <div className="col-span-9 sm:col-span-10">
                <div className="relative w-full bg-slate-200 h-8 rounded-lg overflow-hidden flex items-center">
                  <div
                    className="h-full bg-blue-600 text-white text-xs font-bold px-3 flex items-center justify-between rounded-lg shadow-xs"
                    style={{ width: "100%" }}
                  >
                    <span className="truncate">Track Inspection & Ultrasonic Testing (REQ-001)</span>
                    <span className="font-mono text-[11px] whitespace-nowrap ml-2">09:00 - 12:00 (3h)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* S&T Row */}
            <div className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-3 sm:col-span-2 text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>S&T</span>
              </div>
              <div className="col-span-9 sm:col-span-10">
                <div className="relative w-full bg-slate-200 h-8 rounded-lg overflow-hidden flex items-center">
                  <div
                    className="h-full bg-amber-500 text-white text-xs font-bold px-3 flex items-center justify-between rounded-lg shadow-xs"
                    style={{ width: "100%" }}
                  >
                    <span className="truncate">Signal Maintenance & Interlocking Check (REQ-002)</span>
                    <span className="font-mono text-[11px] whitespace-nowrap ml-2">09:00 - 12:00 (3h)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Traction Row */}
            <div className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-3 sm:col-span-2 text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                <span>Traction</span>
              </div>
              <div className="col-span-9 sm:col-span-10">
                <div className="relative w-full bg-slate-200 h-8 rounded-lg overflow-hidden flex items-center">
                  <div
                    className="h-full bg-emerald-600 text-white text-xs font-bold px-3 flex items-center justify-between rounded-lg shadow-xs"
                    style={{ width: "67%" }}
                  >
                    <span className="truncate">OHE Line Inspection & Insulator Wash (REQ-004)</span>
                    <span className="font-mono text-[11px] whitespace-nowrap ml-2">09:00 - 11:00 (2h)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs text-slate-500">
            <span className="italic text-[11px]">
              * 3 separate departmental demands bundled into 1 joint traffic block. Zero additional train delays.
            </span>
            <button
              onClick={() => navigate("/explainability")}
              className="text-railway-blue hover:underline font-bold flex items-center space-x-1"
            >
              <span>Explain Why This Block Was Selected</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* OPTIMIZATION SUMMARY: BEFORE VS AFTER */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-100 p-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-railway-blue" />
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-900">
                Optimization Summary
              </h3>
            </div>
            <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono">
              SIMULATED / DEMO METRICS
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 text-xs">
            {/* Before Optimization */}
            <div className="p-4 space-y-3 bg-rose-50/20">
              <div className="flex items-center justify-between">
                <span className="font-black text-rose-900 uppercase tracking-wide text-[11px]">
                  Before Optimization
                </span>
                <span className="text-[10px] font-mono text-rose-700 font-bold">Uncoordinated Demands</span>
              </div>
              <ul className="space-y-2 text-slate-700">
                <li className="flex items-center justify-between">
                  <span>Maintenance Requests:</span>
                  <strong className="font-mono font-bold text-slate-900">6 maintenance requests</strong>
                </li>
                <li className="flex items-center justify-between">
                  <span>Potential Conflicts:</span>
                  <strong className="font-mono font-bold text-rose-700">4 potential conflicts</strong>
                </li>
                <li className="flex items-center justify-between">
                  <span>Corridor Traffic Windows:</span>
                  <strong className="font-mono font-bold text-slate-900">6 separate windows</strong>
                </li>
              </ul>
            </div>

            {/* After Optimization */}
            <div className="p-4 space-y-3 bg-emerald-50/20">
              <div className="flex items-center justify-between">
                <span className="font-black text-emerald-900 uppercase tracking-wide text-[11px]">
                  After Optimization
                </span>
                <span className="text-[10px] font-mono text-emerald-700 font-bold">Constraint-Aware Bundling</span>
              </div>
              <ul className="space-y-2 text-slate-700">
                <li className="flex items-center justify-between">
                  <span>Synthesized Block Plans:</span>
                  <strong className="font-mono font-bold text-emerald-700">3 coordinated blocks</strong>
                </li>
                <li className="flex items-center justify-between">
                  <span>Unresolved Hard Conflicts:</span>
                  <strong className="font-mono font-bold text-emerald-700">0 unresolved hard conflicts</strong>
                </li>
                <li className="flex items-center justify-between">
                  <span>Departmental Synergy:</span>
                  <strong className="font-mono font-bold text-slate-900">Compatible activities grouped</strong>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Details & Scheduled Tasks Table */}
      {planDetail && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Scheduled Assignments ({planDetail.scheduled_assignments?.length || 0} Tasks)
              </h3>
              <p className="text-[11px] text-slate-500">
                Active plan allocation under {planDetail.plan_name}
              </p>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Click "Explain Decision" for rule breakdown
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Task ID</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Activity</th>
                  <th className="py-2.5 px-3">Section</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Assigned Block</th>
                  <th className="py-2.5 px-3">Slot Date & Time</th>
                  <th className="py-2.5 px-3">Joint Bundling</th>
                  <th className="py-2.5 px-3 text-right">Explain Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(planDetail.scheduled_assignments || []).map((asgn) => (
                  <tr key={asgn.assignment_id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{asgn.task.task_id}</td>
                    <td className="py-2.5 px-3"><DepartmentBadge department={asgn.task.department} /></td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{asgn.task.asset_type}</td>
                    <td className="py-2.5 px-3 text-slate-600">{asgn.task.location}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{asgn.task.duration_hours}h</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-mono font-bold text-[11px]">
                        {asgn.block.block_id}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                      {asgn.block.date} | {asgn.block.start_time.slice(0, 5)} - {asgn.block.end_time.slice(0, 5)}
                    </td>
                    <td className="py-2.5 px-3">
                      {asgn.bundled_with && asgn.bundled_with.length > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-semibold">
                          Grouped with {asgn.bundled_with.join(", ")}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">Solo Block</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedAssignment(asgn)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition"
                      >
                        <Info className="w-3.5 h-3.5 text-railway-blue" />
                        <span>Explain Decision</span>
                      </button>
                      <button
                        onClick={() => openOverrideModal(asgn.task)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200 transition ml-1.5 cursor-pointer"
                        title="Manually move task to another block window"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                        <span>Override</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Explainability Modal for Selected Assignment */}
      {selectedAssignment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase font-mono">WHY WAS THIS BLOCK SELECTED?</span>
                <h3 className="font-extrabold text-base text-slate-900">
                  {selectedAssignment.task.task_id} &rarr; {selectedAssignment.block.block_id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAssignment(null)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3 text-xs">
              <p className="font-semibold text-slate-900">
                {selectedAssignment.explanation.summary}
              </p>

              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <div className="font-bold text-slate-600 uppercase text-[10px]">Constraint Proof Points:</div>
                <ul className="space-y-1.5 text-slate-700">
                  {(selectedAssignment.explanation.rule_based_reasons || selectedAssignment.explanation.reasons || []).map((r, i) => (
                    <li key={i} className="flex items-start space-x-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 italic">
              * Verified deterministically via Google OR-Tools CP-SAT solver constraint bounds.
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setSelectedAssignment(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const taskId = selectedAssignment.task.task_id;
                  setSelectedAssignment(null);
                  navigate(`/explainability?taskId=${encodeURIComponent(taskId)}`, {
                    state: {
                      taskId,
                      planId: activePlan?.plan_id,
                      assignment: selectedAssignment
                    }
                  });
                }}
                className="px-4 py-2 bg-railway-blue hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Open Full Explainability Matrix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Override Dialog with Train Collision Validation */}
      {overrideTask && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-amber-600 uppercase font-mono tracking-wider">
                  Human-in-the-Loop Override
                </span>
                <h3 className="font-black text-base text-slate-900">
                  Reassign Task: {overrideTask.task_id}
                </h3>
              </div>
              <button
                onClick={() => setOverrideTask(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Task Info Pill */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-900">{overrideTask.description}</div>
              <div className="flex items-center space-x-3 text-slate-500 text-[11px]">
                <span>Dept: {overrideTask.department}</span>
                <span>&bull;</span>
                <span>Section: {overrideTask.location}</span>
                <span>&bull;</span>
                <span>Duration: {overrideTask.duration_hours}h</span>
              </div>
            </div>

            {/* Train Collision / Constraint Error Banner */}
            {overrideError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs space-y-1 animate-fadeIn">
                <div className="font-bold flex items-center space-x-1.5 text-rose-900">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                  <span>Collision / Safety Constraint Violation</span>
                </div>
                <p className="leading-relaxed">{overrideError}</p>
                <p className="text-[10px] text-rose-600 italic">
                  * Safe operating rules strictly prevent human override if it collides with passenger train headways.
                </p>
              </div>
            )}

            <form onSubmit={handleApplyOverride} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Select Target Corridor Block Window
                </label>
                <select
                  value={targetBlockId}
                  onChange={(e) => setTargetBlockId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-mono text-xs focus:ring-2 focus:ring-amber-500"
                >
                  {availableBlocks.map((b) => (
                    <option key={b.block_id} value={b.block_id}>
                      {b.block_id} &mdash; {b.section} ({b.date} {b.start_time}-{b.end_time}, {b.max_duration_hours}h)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Operational Justification (Mandatory for Audit Trail)
                </label>
                <textarea
                  required
                  minLength={10}
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Detail technical reason for overriding optimizer recommendation..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOverrideTask(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideLoading}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-60 flex items-center space-x-1.5"
                >
                  {overrideLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Validate &amp; Apply Override</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
