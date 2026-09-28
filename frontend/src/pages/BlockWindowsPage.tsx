import React, { useState, useEffect } from "react";
import {
  CalendarDays,
  Plus,
  Clock,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  X,
  Filter,
  Layers,
  ArrowRight
} from "lucide-react";
import { BlockWindow } from "../types";
import { api } from "../services/api";

export const BlockWindowsPage: React.FC = () => {
  const [blockWindows, setBlockWindows] = useState<BlockWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [corridorFilter, setCorridorFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showAddModal, setShowAddModal] = useState(false);

  // New Block Window Form
  const [newWindow, setNewWindow] = useState({
    corridor_name: "NDLS-CNB-DDU",
    section: "NDLS-ALJN",
    direction: "BOTH",
    date: new Date().toISOString().split("T")[0],
    start_time: "01:00",
    end_time: "04:30",
    max_duration_hours: 3.5,
    status: "AVAILABLE"
  });

  const fetchBlocks = async () => {
    setLoading(true);
    try {
      const data = await api.getBlockWindows({
        corridor_name: corridorFilter !== "ALL" ? corridorFilter : undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined
      });
      setBlockWindows(data);
    } catch (err) {
      console.error("Failed to load block windows", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlocks();
  }, [corridorFilter, statusFilter]);

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createBlockWindow(newWindow);
      setShowAddModal(false);
      fetchBlocks();
    } catch (err: any) {
      alert(err.message || "Failed to create block window");
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm(`Are you sure you want to remove block window ${blockId}?`)) return;
    try {
      await api.deleteBlockWindow(blockId);
      fetchBlocks();
    } catch (err: any) {
      alert(err.message || "Failed to delete block window");
    }
  };

  // Group blocks by corridor
  const corridors = Array.from(new Set(blockWindows.map((b) => b.corridor_name || "General Section")));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "BOOKED":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "IN_PROGRESS":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "COMPLETED":
        return "bg-slate-50 text-slate-700 border-slate-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <CalendarDays className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">
                Corridor Maintenance Block Windows
              </h1>
              <p className="text-xs text-slate-500">
                Time-space capacity slots for track occupations, collision prevention checks, and TRD power isolation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchBlocks()}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Block Window</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center space-x-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500 font-bold text-[11px] uppercase">Corridor:</span>
          <select
            value={corridorFilter}
            onChange={(e) => setCorridorFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white text-slate-700"
          >
            <option value="ALL">All Corridors</option>
            <option value="NDLS-CNB-DDU">NDLS-CNB-DDU (Northern Mainline)</option>
            <option value="CSMT-PUNE">CSMT-PUNE (Central Ghats)</option>
            <option value="HWH-KGP">HWH-KGP (Eastern Trunk)</option>
            <option value="MAS-JTJ">MAS-JTJ (Southern Corridor)</option>
          </select>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-500 font-bold text-[11px] uppercase">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="BOOKED">BOOKED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
        </div>
      </div>

      {/* Corridor Lanes View (Section 4A: Corridor Timeline Layout) */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
          Loading corridor block schedule...
        </div>
      ) : blockWindows.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
          No block windows match the selected filters.
        </div>
      ) : (
        <div className="space-y-4">
          {corridors.map((corridor) => {
            const corridorBlocks = blockWindows.filter(
              (b) => (b.corridor_name || "General Section") === corridor
            );
            if (corridorBlocks.length === 0) return null;

            return (
              <div
                key={corridor}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden"
              >
                {/* Corridor Title Strip */}
                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span className="font-black text-xs text-slate-900 uppercase tracking-wider">
                      {corridor}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {corridorBlocks.length} Windows Sanctioned
                    </span>
                  </div>
                </div>

                {/* Horizontal Block Timeline Cards */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {corridorBlocks.map((block) => (
                    <div
                      key={block.block_id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-xs transition space-y-2.5 relative group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-black text-slate-900">
                            {block.block_id}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {block.direction}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${getStatusBadge(
                            block.status
                          )}`}
                        >
                          {block.status}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex items-center space-x-1.5 text-slate-700 font-bold">
                          <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Section: {block.section}</span>
                        </div>

                        <div className="flex items-center space-x-1.5 text-slate-500 text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {block.start_time} - {block.end_time} ({block.max_duration_hours}h max)
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400">
                          Date: <span className="font-mono font-semibold text-slate-700">{block.date}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">
                          {block.assigned_tasks_count ? `${block.assigned_tasks_count} tasks assigned` : "No tasks booked"}
                        </span>
                        <button
                          onClick={() => handleDeleteBlock(block.block_id)}
                          className="text-slate-400 hover:text-rose-600 font-semibold cursor-pointer"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Block Window Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-100 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">Sanction New Corridor Block Window</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBlock} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Corridor Trunk</label>
                <select
                  value={newWindow.corridor_name}
                  onChange={(e) => setNewWindow({ ...newWindow, corridor_name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="NDLS-CNB-DDU">NDLS-CNB-DDU</option>
                  <option value="CSMT-PUNE">CSMT-PUNE</option>
                  <option value="HWH-KGP">HWH-KGP</option>
                  <option value="MAS-JTJ">MAS-JTJ</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Section</label>
                  <input
                    type="text"
                    required
                    value={newWindow.section}
                    onChange={(e) => setNewWindow({ ...newWindow, section: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Direction</label>
                  <select
                    value={newWindow.direction}
                    onChange={(e) => setNewWindow({ ...newWindow, direction: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="BOTH">BOTH (Full Block)</option>
                    <option value="UP">UP Line</option>
                    <option value="DOWN">DOWN Line</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Scheduled Date</label>
                <input
                  type="date"
                  required
                  value={newWindow.date}
                  onChange={(e) => setNewWindow({ ...newWindow, date: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={newWindow.start_time}
                    onChange={(e) => setNewWindow({ ...newWindow, start_time: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-xl text-center font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={newWindow.end_time}
                    onChange={(e) => setNewWindow({ ...newWindow, end_time: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-xl text-center font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Max Duration (h)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="12"
                    required
                    value={newWindow.max_duration_hours}
                    onChange={(e) => setNewWindow({ ...newWindow, max_duration_hours: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-xl text-center font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold"
                >
                  Sanction Window in DB
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
