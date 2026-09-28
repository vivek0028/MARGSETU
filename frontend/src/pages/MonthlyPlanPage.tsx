import React, { useState, useEffect } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Flame,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { MonthlyPlanDay } from "../types";
import { api } from "../services/api";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const MonthlyPlanPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  const [days, setDays] = useState<MonthlyPlanDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<MonthlyPlanDay | null>(null);

  const fetchMonthlyPlan = async () => {
    setLoading(true);
    try {
      const res = await api.getMonthlyPlan(month, year);
      setDays(res.days || []);
    } catch (err) {
      console.error("Failed to load monthly plan", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyPlan();
  }, [month, year]);

  const changeMonth = (delta: number) => {
    setCurrentDate(new Date(year, month - 1 + delta, 1));
  };

  const getDensityClass = (density: string) => {
    switch (density) {
      case "PEAK":
        return "bg-rose-500 text-white font-bold";
      case "HIGH":
        return "bg-amber-500 text-white font-bold";
      case "MEDIUM":
        return "bg-blue-500 text-white font-bold";
      case "LOW":
        return "bg-emerald-500 text-white font-bold";
      default:
        return "bg-slate-100 text-slate-400";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-700">
              <CalendarDays className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">
                Monthly Strategic Maintenance Density Calendar
              </h1>
              <p className="text-xs text-slate-500">
                Macro-level block allocation density and major track possession clusters across division.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Month Selector */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
            <button
              onClick={() => changeMonth(-1)}
              className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-mono font-bold text-slate-800">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button
              onClick={() => changeMonth(1)}
              className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => fetchMonthlyPlan()}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-4 text-xs">
        <span className="font-bold text-slate-500 uppercase text-[11px]">Density Legend:</span>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200" />
          <span className="text-slate-600">No Blocks</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-sm bg-emerald-500" />
          <span className="text-slate-600">Low (1-2)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-sm bg-blue-500" />
          <span className="text-slate-600">Medium (3-5)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-500" />
          <span className="text-slate-600">High (6-8)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-sm bg-rose-500" />
          <span className="text-slate-600">Peak Cluster (&gt;8)</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Generating monthly plan view...</div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center font-black text-xs text-slate-400 py-1 uppercase">
                {d}
              </div>
            ))}

            {days.map((day) => {
              const isSelected = selectedDay?.date === day.date;
              return (
                <div
                  key={day.date}
                  onClick={() => setSelectedDay(day)}
                  className={`min-h-[90px] p-2 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "border-purple-600 ring-2 ring-purple-500/20 bg-purple-50/30"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-slate-800">{day.day_of_month}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full ${getDensityClass(day.density_level)}`}
                    >
                      {day.density_level}
                    </span>
                  </div>

                  <div className="space-y-0.5 text-[10px]">
                    <div className="font-semibold text-slate-700">
                      {day.total_blocks > 0 ? `${day.total_blocks} Windows` : "—"}
                    </div>
                    <div className="text-slate-500">
                      {day.total_tasks > 0 ? `${day.total_tasks} Work orders` : "Clear"}
                    </div>
                    {day.high_priority_tasks > 0 && (
                      <div className="text-rose-600 font-bold flex items-center space-x-1">
                        <Flame className="w-2.5 h-2.5" />
                        <span>{day.high_priority_tasks} Critical</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Day Inspector */}
      {selectedDay && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between animate-fadeIn">
          <div>
            <h3 className="font-black text-sm text-slate-900">
              Operations Summary for {selectedDay.date} ({selectedDay.day_of_week})
            </h3>
            <p className="text-xs text-slate-500">
              {selectedDay.total_blocks} block windows sanctioned &bull; {selectedDay.total_tasks} maintenance tasks
              scheduled &bull; {selectedDay.high_priority_tasks} high priority
            </p>
          </div>
          <button
            onClick={() => setSelectedDay(null)}
            className="text-xs font-bold text-slate-500 hover:text-slate-800"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
