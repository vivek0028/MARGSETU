import React, { useState, useEffect } from "react";
import {
  Train,
  Plus,
  Upload,
  Search,
  Filter,
  RefreshCw,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { TrainMovement } from "../types";
import { api } from "../services/api";

export const TimetablePage: React.FC = () => {
  const [trains, setTrains] = useState<TrainMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Add Train Form
  const [newTrain, setNewTrain] = useState({
    train_no: "",
    train_name: "",
    train_type: "PREMIUM_EXPRESS",
    section: "NDLS-ALJN",
    direction: "DOWN",
    scheduled_departure: "06:00",
    scheduled_arrival: "07:30",
    priority_rank: 1,
    speed_kmph: 130
  });

  const fetchTrains = async () => {
    setLoading(true);
    try {
      const data = await api.getTrainMovements({
        direction: directionFilter !== "ALL" ? directionFilter : undefined
      });
      setTrains(data);
    } catch (err) {
      console.error("Failed to load timetable", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrains();
  }, [directionFilter]);

  const handleCreateTrain = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createTrainMovement(newTrain);
      setShowAddModal(false);
      setNewTrain({
        train_no: "",
        train_name: "",
        train_type: "PREMIUM_EXPRESS",
        section: "NDLS-ALJN",
        direction: "DOWN",
        scheduled_departure: "06:00",
        scheduled_arrival: "07:30",
        priority_rank: 1,
        speed_kmph: 130
      });
      fetchTrains();
    } catch (err: any) {
      alert(err.message || "Failed to add train path");
    }
  };

  const handleCSVUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploadLoading(true);
    setUploadMsg(null);
    try {
      const res = await api.uploadTimetableCSV(uploadFile);
      setUploadMsg({ success: true, text: `Successfully imported ${res.records_imported} train paths into PostgreSQL.` });
      setUploadFile(null);
      fetchTrains();
    } catch (err: any) {
      setUploadMsg({ success: false, text: err.message || "Failed to import CSV" });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDeleteTrain = async (trainNo: string) => {
    if (!confirm(`Are you sure you want to remove train path ${trainNo}?`)) return;
    try {
      await api.deleteTrainMovement(trainNo);
      fetchTrains();
    } catch (err: any) {
      alert(err.message || "Failed to delete train movement");
    }
  };

  const filteredTrains = trains.filter(
    (t) =>
      t.train_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.train_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.section.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPriorityBadge = (rank: number) => {
    if (rank === 1) return "bg-rose-100 text-rose-800 border-rose-300 font-black";
    if (rank === 2) return "bg-amber-100 text-amber-800 border-amber-300 font-bold";
    if (rank === 3) return "bg-blue-100 text-blue-800 border-blue-300 font-bold";
    return "bg-slate-100 text-slate-700 border-slate-300";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-sky-50 text-sky-700">
              <Train className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">
                Timetable & Train Movement Paths
              </h1>
              <p className="text-xs text-slate-500">
                Operating schedule, train priority ranks (Rajdhani/Shatabdi/Freight), and timetable conflict constraints.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchTrains()}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition cursor-pointer border border-slate-200"
          >
            <Upload className="w-4 h-4" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Train Path</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by train no, name (e.g. 12002 Bhopal Shatabdi)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 transition"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500 font-bold text-[11px] uppercase">Direction:</span>
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white text-slate-700"
          >
            <option value="ALL">All Directions</option>
            <option value="UP">UP Line</option>
            <option value="DOWN">DOWN Line</option>
          </select>
        </div>
      </div>

      {/* Train Timetable Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="text-xs font-black uppercase tracking-wider text-slate-600">
            Sanctioned Train Movements ({filteredTrains.length})
          </span>
          <span className="text-[11px] text-slate-500">Live PostgreSQL Timetable</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading train paths...</div>
        ) : filteredTrains.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No trains match your search.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Train No & Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Section</th>
                  <th className="py-2.5 px-3">Direction</th>
                  <th className="py-2.5 px-3">Scheduled Slot</th>
                  <th className="py-2.5 px-3">Speed</th>
                  <th className="py-2.5 px-3">Priority Rank</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTrains.map((train) => (
                  <tr key={train.train_no} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-slate-900">{train.train_name}</div>
                      <div className="text-[11px] font-mono text-slate-500">{train.train_no}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-semibold">{train.train_type}</td>
                    <td className="py-2.5 px-3 text-slate-700 font-mono">{train.section}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {train.direction}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-800">
                      {train.scheduled_departure} - {train.scheduled_arrival}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{train.speed_kmph} km/h</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] border ${getPriorityBadge(
                          train.priority_rank
                        )}`}
                      >
                        Rank {train.priority_rank}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleDeleteTrain(train.train_no)}
                        className="text-slate-400 hover:text-rose-600 text-xs font-semibold cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CSV Bulk Import Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-100 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">Bulk Import Timetable CSV</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadMsg && (
              <div
                className={`p-3 rounded-xl flex items-center space-x-2 text-xs ${
                  uploadMsg.success
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {uploadMsg.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{uploadMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleCSVUpload} className="space-y-4 text-xs">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center space-y-2">
                <FileSpreadsheet className="w-8 h-8 text-sky-600 mx-auto" />
                <p className="text-xs text-slate-700 font-semibold">Select Timetable CSV file</p>
                <p className="text-[11px] text-slate-400">
                  Headers required: train_no, train_name, section, direction, scheduled_departure, scheduled_arrival, priority_rank
                </p>
                <input
                  type="file"
                  accept=".csv"
                  required
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="text-xs text-slate-500 mx-auto block pt-2"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={uploadLoading || !uploadFile}
                  className="px-4 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold disabled:opacity-50"
                >
                  {uploadLoading ? "Importing..." : "Upload & Parse CSV"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Train Path Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-100 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">Add Train Movement Path</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTrain} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Train No</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 12004"
                    value={newTrain.train_no}
                    onChange={(e) => setNewTrain({ ...newTrain, train_no: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Train Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lucknow Shatabdi"
                    value={newTrain.train_name}
                    onChange={(e) => setNewTrain({ ...newTrain, train_name: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Train Type</label>
                  <select
                    value={newTrain.train_type}
                    onChange={(e) => setNewTrain({ ...newTrain, train_type: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="PREMIUM_EXPRESS">Premium Express (Vande Bharat / Rajdhani)</option>
                    <option value="MAIL_EXPRESS">Mail / Express</option>
                    <option value="PASSENGER">Passenger / Local</option>
                    <option value="FREIGHT">Freight / Goods</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Direction</label>
                  <select
                    value={newTrain.direction}
                    onChange={(e) => setNewTrain({ ...newTrain, direction: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="UP">UP Line</option>
                    <option value="DOWN">DOWN Line</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Section</label>
                  <input
                    type="text"
                    required
                    value={newTrain.section}
                    onChange={(e) => setNewTrain({ ...newTrain, section: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Priority Rank (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    required
                    value={newTrain.priority_rank}
                    onChange={(e) => setNewTrain({ ...newTrain, priority_rank: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Departure</label>
                  <input
                    type="time"
                    required
                    value={newTrain.scheduled_departure}
                    onChange={(e) => setNewTrain({ ...newTrain, scheduled_departure: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Arrival</label>
                  <input
                    type="time"
                    required
                    value={newTrain.scheduled_arrival}
                    onChange={(e) => setNewTrain({ ...newTrain, scheduled_arrival: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl font-mono text-center"
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
                  className="px-4 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold"
                >
                  Save Train Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
