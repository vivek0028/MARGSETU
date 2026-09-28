import React, { useState, useEffect } from "react";
import {
  PlayCircle,
  CheckCircle,
  AlertCircle,
  Clock,
  UserCheck,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Search,
  Filter,
  X,
  FileText,
  Activity
} from "lucide-react";
import { ExecutionRecord } from "../types";
import { api } from "../services/api";

export const ExecutionPage: React.FC = () => {
  const [records, setRecords] = useState<ExecutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedRecord, setSelectedRecord] = useState<ExecutionRecord | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Update Form
  const [updateForm, setUpdateForm] = useState({
    status: "IN_PROGRESS",
    actual_start_time: "",
    actual_end_time: "",
    crew_lead: "",
    work_summary: ""
  });

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await api.getExecutionRecords({
        status: statusFilter !== "ALL" ? statusFilter : undefined
      });
      setRecords(data);
    } catch (err) {
      console.error("Failed to load execution records", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [statusFilter]);

  const handleOpenUpdate = (rec: ExecutionRecord) => {
    setSelectedRecord(rec);
    const now = new Date().toISOString().slice(0, 16);
    setUpdateForm({
      status: rec.status === "READY" ? "IN_PROGRESS" : rec.status === "IN_PROGRESS" ? "COMPLETED" : rec.status,
      actual_start_time: rec.actual_start_time ? rec.actual_start_time.slice(0, 16) : now,
      actual_end_time: rec.actual_end_time ? rec.actual_end_time.slice(0, 16) : now,
      crew_lead: rec.crew_lead || "JE (P-Way)",
      work_summary: rec.work_summary || "Work executed according to safety standards."
    });
    setShowUpdateModal(true);
  };

  const handleSaveUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    try {
      await api.updateExecutionRecord(selectedRecord.execution_id, {
        status: updateForm.status,
        actual_start_time: updateForm.actual_start_time || undefined,
        actual_end_time: updateForm.status === "COMPLETED" ? updateForm.actual_end_time : undefined,
        crew_lead: updateForm.crew_lead,
        work_summary: updateForm.work_summary
      });
      setShowUpdateModal(false);
      fetchRecords();
    } catch (err: any) {
      alert(err.message || "Failed to update execution record");
    }
  };

  // KPIs
  const total = records.length;
  const inProgress = records.filter((r) => r.status === "IN_PROGRESS").length;
  const completed = records.filter((r) => r.status === "COMPLETED").length;
  const delayed = records.filter((r) => (r.variance_minutes || 0) > 15).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <PlayCircle className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">
                Live Execution Monitoring & Plan-vs-Actual
              </h1>
              <p className="text-xs text-slate-500">
                Track track occupations in the field, record actual completion times, and measure overrun variance.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchRecords()}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Work Orders</span>
          <div className="text-xl font-black text-slate-900">{total}</div>
          <span className="text-[10px] text-slate-400">Under execution control</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Active In Field</span>
          <div className="text-xl font-black text-amber-600 flex items-center space-x-1.5">
            <Activity className="w-4 h-4 animate-pulse" />
            <span>{inProgress}</span>
          </div>
          <span className="text-[10px] text-slate-400">Currently occupying block</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Completed</span>
          <div className="text-xl font-black text-emerald-600">{completed}</div>
          <span className="text-[10px] text-slate-400">Cleared & track safe</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Duration Variance</span>
          <div className="text-xl font-black text-rose-600">{delayed} overruns</div>
          <span className="text-[10px] text-slate-400">&gt; 15 min schedule variance</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3 text-xs">
        <Filter className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-500 font-bold text-[11px] uppercase">Filter Status:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white text-slate-700"
        >
          <option value="ALL">All Statuses</option>
          <option value="READY">READY (Pending Start)</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="DELAYED">DELAYED</option>
        </select>
      </div>

      {/* Execution Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="text-xs font-black uppercase tracking-wider text-slate-600">
            Work Order Execution Log ({records.length})
          </span>
          <span className="text-[11px] text-slate-500">Live Telemetry & Field Reports</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading live execution records...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No execution records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Task & Block ID</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Planned Duration</th>
                  <th className="py-2.5 px-3">Actual Duration</th>
                  <th className="py-2.5 px-3">Variance</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Crew Lead</th>
                  <th className="py-2.5 px-3 text-right">Field Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((rec, idx) => {
                  const variance = rec.variance_minutes || 0;
                  const isDelayed = variance > 15;
                  return (
                    <tr key={rec.execution_id ? `${rec.execution_id}-${idx}` : `rec-${idx}`} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-4">
                        <div className="font-mono font-bold text-slate-900">{rec.task_id}</div>
                        <div className="text-[11px] font-mono text-slate-500">Block: {rec.block_id}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800 line-clamp-1 max-w-xs">
                          {rec.task?.description || "Maintenance track occupation"}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {rec.task?.department} &bull; {rec.task?.location}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{rec.duration_hours} hrs</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {rec.actual_duration_hours ? `${rec.actual_duration_hours.toFixed(1)} hrs` : "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        {rec.actual_duration_hours ? (
                          <span
                            className={`inline-flex items-center space-x-1 font-mono font-bold text-[11px] ${
                              isDelayed ? "text-rose-600" : "text-emerald-600"
                            }`}
                          >
                            {isDelayed ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            <span>{variance > 0 ? `+${variance} min` : `${variance} min`}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Pending End</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            rec.status === "IN_PROGRESS"
                              ? "bg-amber-50 text-amber-800 border-amber-200 animate-pulse"
                              : rec.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-slate-50 text-slate-700 border-slate-200"
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{rec.crew_lead || "Unassigned"}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleOpenUpdate(rec)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition cursor-pointer"
                        >
                          {rec.status === "READY"
                            ? "Start Work"
                            : rec.status === "IN_PROGRESS"
                            ? "Complete"
                            : "Update"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Field Status Update Modal */}
      {showUpdateModal && selectedRecord && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-100 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Update Work Order: {selectedRecord.task_id}
                </h3>
                <p className="text-[11px] text-slate-500">Block ID: {selectedRecord.block_id}</p>
              </div>
              <button onClick={() => setShowUpdateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUpdate} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Execution Status</label>
                <select
                  value={updateForm.status}
                  onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl bg-white font-bold"
                >
                  <option value="READY">READY (Sanctioned, Waiting Clearance)</option>
                  <option value="IN_PROGRESS">IN_PROGRESS (Track Occupied)</option>
                  <option value="COMPLETED">COMPLETED (Track Fit For Traffic)</option>
                  <option value="DELAYED">DELAYED (Overrun Expected)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Actual Start Time</label>
                  <input
                    type="datetime-local"
                    value={updateForm.actual_start_time}
                    onChange={(e) => setUpdateForm({ ...updateForm, actual_start_time: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-xl font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Actual End Time</label>
                  <input
                    type="datetime-local"
                    value={updateForm.actual_end_time}
                    onChange={(e) => setUpdateForm({ ...updateForm, actual_end_time: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-xl font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Crew Lead / Section In-Charge</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. JE (P-Way) R.K. Sharma"
                  value={updateForm.crew_lead}
                  onChange={(e) => setUpdateForm({ ...updateForm, crew_lead: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Work Completion Summary / Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Tamping completed for 1.2km, track fit given at 22:30..."
                  value={updateForm.work_summary}
                  onChange={(e) => setUpdateForm({ ...updateForm, work_summary: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpdateModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                >
                  Save Execution Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
