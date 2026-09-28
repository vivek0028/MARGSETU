import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Cpu,
  AlertTriangle,
  Layers,
  RotateCcw,
  Save,
  CheckCircle2,
  Clock,
  ArrowRight,
  Search,
  Filter,
  CheckSquare
} from "lucide-react";
import { api } from "../services/api";
import { MaintenanceTask, BlockWindow, SchedulePlan } from "../types";
import { DepartmentBadge, PriorityBadge, StatusBadge } from "../components/Badges";

export const BlockPlanningWorkspacePage: React.FC = () => {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [blocks, setBlocks] = useState<BlockWindow[]>([]);
  const [activePlan, setActivePlan] = useState<SchedulePlan | null>(null);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<BlockWindow | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [notification, setNotification] = useState<string | null>(null);

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const [tasksData, blocksData, plansData] = await Promise.all([
        api.getTasks(),
        api.getBlockWindows(),
        api.getOptimizationPlans()
      ]);
      setTasks(tasksData);
      setBlocks(blocksData);
      if (plansData.length > 0) {
        const fullPlan = await api.getOptimizationPlanById(plansData[0].plan_id);
        setActivePlan(fullPlan);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, []);

  const handleGeneratePlan = async () => {
    try {
      const res = await api.generateOptimizationPlans({ strategy_type: "ALL" });
      setNotification("Generated fresh CP-SAT block plan.");
      loadWorkspace();
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleGroupCompatible = async () => {
    try {
      const res = await api.getCompatibilityBundles();
      setNotification(`Identified ${res.bundles_identified_count} joint multi-department bundling candidates.`);
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredTasks = tasks.filter(t =>
    t.task_id.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase()) ||
    t.location.toLowerCase().includes(search.toLowerCase())
  );

  // Group scheduled assignments by block_id
  const assignmentsByBlock: Record<string, any[]> = {};
  if (activePlan?.scheduled_assignments) {
    for (const asgn of activePlan.scheduled_assignments) {
      if (!assignmentsByBlock[asgn.block_id]) {
        assignmentsByBlock[asgn.block_id] = [];
      }
      assignmentsByBlock[asgn.block_id].push(asgn);
    }
  }

  return (
    <div className="space-y-4">
      {/* Workspace Header & Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Block Planning Workspace</h1>
            <span className="bg-railway-blue text-white text-xs font-bold px-2 py-0.5 rounded font-mono">
              Gantt View
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Coordinate corridor blocks, assign departmental maintenance gangs, and bundle cross-departmental operations
          </p>
        </div>

        {/* Workspace Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleGroupCompatible}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-xs font-bold transition"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Group Compatible Tasks</span>
          </button>

          <button
            onClick={handleGeneratePlan}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-railway-blue hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Generate Optimised Plan</span>
          </button>

          <Link
            to="/approval"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Submit for Approval</span>
          </Link>
        </div>
      </div>

      {notification && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs px-3.5 py-2 rounded-md font-medium">
          {notification}
        </div>
      )}

      {/* 3-Column Planning Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Maintenance Task Pool (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[700px] overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-slate-50/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Requisitions Pool ({filteredTasks.length})
              </span>
              <span className="text-[11px] text-slate-500 font-mono">BDMS Queue</span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Filter tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-railway-blue"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredTasks.map((t) => {
              const isSelected = selectedTask?.task_id === t.task_id;
              return (
                <div
                  key={t.task_id}
                  onClick={() => {
                    setSelectedTask(t);
                    setSelectedBlock(null);
                  }}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                    isSelected
                      ? "border-railway-blue bg-blue-50/60 ring-1 ring-blue-500/20"
                      : "border-slate-200 hover:bg-slate-50 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-slate-900">{t.task_id}</span>
                    <PriorityBadge criticality={t.criticality} score={t.priority_score} />
                  </div>
                  <div className="flex items-center space-x-1.5 mb-1.5">
                    <DepartmentBadge department={t.department} />
                    <span className="text-[11px] text-slate-500">{t.asset_type} &bull; {t.location}</span>
                  </div>
                  <p className="text-slate-700 line-clamp-2">{t.description}</p>
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Dur: {t.duration_hours}h</span>
                    <span>Dead: {t.deadline}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Middle Column: Corridor Block Windows & Timeline (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[700px] overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Available Corridor Block Windows ({blocks.length})
              </span>
              <p className="text-[11px] text-slate-500">Mainline Corridor Alpha &bull; Daily Scheduled Windows</p>
            </div>
            <span className="text-xs font-bold text-railway-blue font-mono">
              {activePlan?.scheduled_count ?? (activePlan as any)?.kpis?.scheduled_count ?? 0} Scheduled
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {blocks.map((b) => {
              const assigned = assignmentsByBlock[b.block_id] || [];
              const isSelected = selectedBlock?.block_id === b.block_id;
              const hasBundle = assigned.length > 1;

              return (
                <div
                  key={b.block_id}
                  onClick={() => {
                    setSelectedBlock(b);
                    setSelectedTask(null);
                  }}
                  className={`rounded-lg border p-3 text-xs cursor-pointer transition ${
                    isSelected
                      ? "border-railway-blue bg-blue-50/40 ring-1 ring-blue-500/20"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center space-x-2">
                      <CalendarDays className="w-4 h-4 text-railway-blue" />
                      <span className="font-mono font-bold text-slate-900">{b.block_id}</span>
                      <span className="text-slate-400">|</span>
                      <span className="font-semibold text-slate-700">{b.section} ({b.direction})</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      Max: {b.max_duration_hours}h
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-slate-600 font-mono text-[11px]">
                    <span>Date: {b.date}</span>
                    <span className="text-railway-blue font-bold">{b.start_time} - {b.end_time}</span>
                  </div>

                  {/* Tasks scheduled inside this block window */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                    {assigned.length === 0 ? (
                      <div className="text-[11px] text-slate-400 italic py-1">
                        No maintenance task allocated in this window.
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-600">
                            Allocated Tasks ({assigned.length}):
                          </span>
                          {hasBundle && (
                            <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">
                              Joint Multi-Dept Bundle
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          {assigned.map((a: any) => (
                            <div
                              key={a.assignment_id}
                              className="p-1.5 rounded bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px]"
                            >
                              <div className="flex items-center space-x-1.5">
                                <span className="font-mono font-bold text-slate-800">{a.task.task_id}</span>
                                <DepartmentBadge department={a.task.department} />
                              </div>
                              <span className="font-mono text-slate-600">{a.task.duration_hours}h</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Inspection Details (3 Cols) */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-4 h-[700px] overflow-y-auto space-y-4">
          <div className="pb-3 border-b border-slate-200">
            <h3 className="font-extrabold text-sm text-slate-900">Inspection & Allocation</h3>
            <p className="text-[11px] text-slate-500">Select any task or block to inspect constraints</p>
          </div>

          {selectedTask ? (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm text-slate-900">{selectedTask.task_id}</span>
                <StatusBadge status={selectedTask.status} />
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Department:</span>
                <DepartmentBadge department={selectedTask.department} />
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Asset Type & Location:</span>
                <strong className="text-slate-800">{selectedTask.asset_type} &bull; {selectedTask.location}</strong>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Work Description:</span>
                <p className="text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-100 leading-relaxed">
                  {selectedTask.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Duration:</span>
                  <strong className="font-mono">{selectedTask.duration_hours} hrs</strong>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Deadline:</span>
                  <strong className="font-mono">{selectedTask.deadline}</strong>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Required Equipment / Gangs:</span>
                <p className="font-mono text-slate-800 bg-slate-50 p-2 rounded border border-slate-100">
                  {(selectedTask.required_resources || []).join(", ") || "General Crew"}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <Link
                  to="/optimizer"
                  className="w-full text-center block py-2 rounded bg-railway-blue hover:bg-blue-700 text-white font-bold transition text-xs shadow-sm"
                >
                  View in Solver Plan
                </Link>
              </div>
            </div>
          ) : selectedBlock ? (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm text-slate-900">{selectedBlock.block_id}</span>
                <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px]">
                  Available Window
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Section & Direction:</span>
                <strong className="text-slate-800">{selectedBlock.section} ({selectedBlock.direction})</strong>
              </div>

              <div className="bg-slate-50 p-2.5 rounded border border-slate-100 space-y-1 font-mono">
                <div>Date: <strong>{selectedBlock.date}</strong></div>
                <div>Timing: <strong>{selectedBlock.start_time} - {selectedBlock.end_time}</strong></div>
                <div>Max Window: <strong>{selectedBlock.max_duration_hours} hours</strong></div>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] mb-1">Allocated Maintenance:</span>
                {assignmentsByBlock[selectedBlock.block_id]?.length ? (
                  <div className="space-y-1.5">
                    {assignmentsByBlock[selectedBlock.block_id].map((asgn: any) => (
                      <div key={asgn.assignment_id} className="p-2 rounded bg-blue-50/60 border border-blue-200">
                        <div className="font-bold text-slate-900">{asgn.task.task_id}</div>
                        <div className="text-[11px] text-slate-600 truncate">{asgn.task.description}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">No tasks currently allocated.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <CalendarDays className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs">Click on any task from the pool or block window from the timeline to inspect.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
