import React, { useState, useEffect } from "react";
import {
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  RefreshCw,
  Wrench,
  Train,
  CheckCircle2
} from "lucide-react";
import { BlockWindow, MaintenanceTask } from "../types";
import { api } from "../services/api";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const WeeklyPlanPage: React.FC = () => {
  const [corridor, setCorridor] = useState("NDLS-CNB-DDU");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    // Monday of current week
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split("T")[0];
  });
  const [weeklyData, setWeeklyData] = useState<Record<string, { blocks: BlockWindow[]; tasks: MaintenanceTask[] }>>({});
  const [loading, setLoading] = useState(true);

  const fetchWeeklyPlan = async () => {
    setLoading(true);
    try {
      const res = await api.getWeeklyPlan({ corridor, start_date: startDate });
      setWeeklyData(res.days || {});
    } catch (err) {
      console.error("Failed to load weekly plan", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeeklyPlan();
  }, [corridor, startDate]);

  const changeWeek = (deltaWeeks: number) => {
    const current = new Date(startDate);
    current.setDate(current.getDate() + deltaWeeks * 7);
    setStartDate(current.toISOString().split("T")[0]);
  };

  const getDeptColor = (dept: string) => {
    switch (dept) {
      case "Engineering":
        return "bg-sky-100 text-sky-800 border-sky-200";
      case "Traction":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "S&T":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-violet-50 text-violet-700">
              <Calendar className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">
                Weekly Corridor Maintenance Planning Board
              </h1>
              <p className="text-xs text-slate-500">
                7-day rolling schedule (Mon &ndash; Sun) of synchronized track and OHE blocks across sections.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Week Navigation */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
            <button
              onClick={() => changeWeek(-1)}
              className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-mono font-bold text-slate-800">
              Week of {startDate}
            </span>
            <button
              onClick={() => changeWeek(1)}
              className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => fetchWeeklyPlan()}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Corridor Selector */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3 text-xs">
        <Layers className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-500 font-bold text-[11px] uppercase">Corridor Line:</span>
        <select
          value={corridor}
          onChange={(e) => setCorridor(e.target.value)}
          className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white text-slate-700"
        >
          <option value="NDLS-CNB-DDU">NDLS-CNB-DDU (Northern Mainline)</option>
          <option value="CSMT-PUNE">CSMT-PUNE (Central Ghats)</option>
          <option value="HWH-KGP">HWH-KGP (Eastern Trunk)</option>
          <option value="MAS-JTJ">MAS-JTJ (Southern Corridor)</option>
        </select>
      </div>

      {/* 7-Day Planning Board Layout (Prompt Section 4A) */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
          Loading 7-day schedule grid...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          {DAYS_OF_WEEK.map((dayName, idx) => {
            const dayInfo = weeklyData[dayName] || { blocks: [], tasks: [] };
            const isToday = new Date().getDay() === (idx === 6 ? 0 : idx + 1);

            return (
              <div
                key={dayName}
                className={`bg-white rounded-2xl border flex flex-col min-h-[500px] overflow-hidden ${
                  isToday ? "border-violet-400 ring-2 ring-violet-500/20 shadow-md" : "border-slate-200 shadow-xs"
                }`}
              >
                {/* Day Header */}
                <div
                  className={`p-3 border-b text-center ${
                    isToday ? "bg-violet-50 border-violet-200" : "bg-slate-50/80 border-slate-200/80"
                  }`}
                >
                  <div className="font-black text-xs text-slate-900 uppercase tracking-wider">{dayName}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {dayInfo.blocks.length} Blocks &bull; {dayInfo.tasks.length} Tasks
                  </div>
                </div>

                {/* Day Content Area */}
                <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                  {dayInfo.blocks.length === 0 ? (
                    <div className="text-center py-10 text-[11px] text-slate-300 font-medium">
                      No block windows
                    </div>
                  ) : (
                    dayInfo.blocks.map((block, bIdx) => (
                      <div
                        key={`${block.block_id}-${bIdx}`}
                        className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 space-y-1.5 transition text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-[11px] text-violet-900">{block.block_id}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                            {block.direction}
                          </span>
                        </div>

                        <div className="text-[11px] font-semibold text-slate-800 flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>
                            {block.start_time} - {block.end_time} ({block.max_duration_hours}h)
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-500 font-mono">{block.section}</div>

                        {/* Tasks assigned to this day/block */}
                        <div className="pt-1.5 border-t border-slate-200/70 space-y-1">
                          {dayInfo.tasks
                            .filter((t) => t.assigned_block_id === block.block_id || !t.assigned_block_id)
                            .slice(0, 3)
                            .map((task, tIdx) => (
                              <div
                                key={`${block.block_id}-${task.task_id}-${tIdx}`}
                                className={`p-1.5 rounded-lg border text-[10px] space-y-0.5 ${getDeptColor(
                                  task.department
                                )}`}
                              >
                                <div className="font-bold truncate">{task.description}</div>
                                <div className="flex justify-between text-[9px] opacity-80">
                                  <span>{task.department}</span>
                                  <span>{task.duration_hours}h</span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
