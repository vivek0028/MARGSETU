import React, { useState, useEffect } from "react";
import {
  Wrench,
  ShieldAlert,
  Plus,
  Activity,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Building,
  RefreshCw,
  X
} from "lucide-react";
import { Asset, AssetDefect } from "../types";
import { api } from "../services/api";

export const AssetsPage: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [defects, setDefects] = useState<AssetDefect[]>([]);
  const [defectsLoading, setDefectsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // New Asset Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAsset, setNewAsset] = useState({
    asset_name: "",
    asset_type: "TRACK",
    department: "Engineering",
    corridor_name: "NDLS-CNB-DDU",
    section: "NDLS-ALJN",
    condition_score: 85
  });

  // Log Defect Modal
  const [showDefectModal, setShowDefectModal] = useState(false);
  const [newDefect, setNewDefect] = useState({
    description: "",
    severity: "MEDIUM"
  });

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const data = await api.getAssets({
        department: departmentFilter !== "ALL" ? departmentFilter : undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined
      });
      setAssets(data);
      if (data.length > 0 && !selectedAsset) {
        setSelectedAsset(data[0]);
      }
    } catch (err) {
      console.error("Failed to load assets", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [departmentFilter, statusFilter]);

  useEffect(() => {
    if (selectedAsset) {
      setDefectsLoading(true);
      api
        .getAssetDefects(selectedAsset.asset_id)
        .then(setDefects)
        .catch(() => setDefects([]))
        .finally(() => setDefectsLoading(false));
    }
  }, [selectedAsset]);

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAsset(newAsset);
      setShowAddModal(false);
      setNewAsset({
        asset_name: "",
        asset_type: "TRACK",
        department: "Engineering",
        corridor_name: "NDLS-CNB-DDU",
        section: "NDLS-ALJN",
        condition_score: 85
      });
      fetchAssets();
    } catch (err: any) {
      alert(err.message || "Failed to create asset");
    }
  };

  const handleLogDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    try {
      await api.logAssetDefect(selectedAsset.asset_id, newDefect);
      setShowDefectModal(false);
      setNewDefect({ description: "", severity: "MEDIUM" });
      const updatedDefects = await api.getAssetDefects(selectedAsset.asset_id);
      setDefects(updatedDefects);
      fetchAssets();
    } catch (err: any) {
      alert(err.message || "Failed to log defect");
    }
  };

  const filteredAssets = assets.filter((a) => {
    const matchesSearch =
      a.asset_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.section.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.asset_id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getConditionColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (score >= 60) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-rose-600 bg-rose-50 border-rose-200";
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <Wrench className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">
                Railway Infrastructure & Asset Lifecycle
              </h1>
              <p className="text-xs text-slate-500">
                Track assets, health index condition scores, defect logs, and lifecycle inspection registry.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchAssets()}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
            title="Refresh assets from database"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register Asset</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by asset name, section, code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500 font-bold text-[11px] uppercase">Department:</span>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white text-slate-700"
          >
            <option value="ALL">All Departments</option>
            <option value="Engineering">Engineering (Civil)</option>
            <option value="Traction">Traction (TRD)</option>
            <option value="S&T">Signal & Telecom</option>
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
            <option value="OPERATIONAL">Operational</option>
            <option value="NEEDS_INSPECTION">Needs Inspection</option>
            <option value="DEFECT_REPORTED">Defect Reported</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Assets Master List + Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Assets List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs font-black uppercase tracking-wider text-slate-600">
              Railway Assets ({filteredAssets.length})
            </span>
            <span className="text-[11px] text-slate-500">PostgreSQL Persisted</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading infrastructure assets...</div>
          ) : filteredAssets.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No assets match your criteria.</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {filteredAssets.map((asset, idx) => {
                const isSelected = selectedAsset?.asset_id === asset.asset_id;
                return (
                  <div
                    key={asset.asset_id ? `${asset.asset_id}-${idx}` : `asset-${idx}`}
                    onClick={() => setSelectedAsset(asset)}
                    className={`p-3.5 transition cursor-pointer flex items-center justify-between ${
                      isSelected ? "bg-blue-50/70 border-l-4 border-l-blue-600" : "hover:bg-slate-50/80"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-slate-900">{asset.asset_name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {asset.asset_id}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                        <span className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{asset.section}</span>
                        </span>
                        <span>&bull;</span>
                        <span className="flex items-center space-x-1">
                          <Building className="w-3 h-3 text-slate-400" />
                          <span>{asset.department}</span>
                        </span>
                        <span>&bull;</span>
                        <span>Type: {asset.asset_type}</span>
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <div
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-black border ${getConditionColor(
                          asset.condition_score
                        )}`}
                      >
                        <Activity className="w-3 h-3" />
                        <span>{asset.condition_score} / 100</span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-500">{asset.status}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Asset Lifecycle Detail Drawer */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-4">
          {selectedAsset ? (
            <>
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">
                    {selectedAsset.department} Infrastructure
                  </span>
                  <h3 className="font-black text-sm text-slate-900">{selectedAsset.asset_name}</h3>
                  <p className="text-[11px] text-slate-500">Corridor: {selectedAsset.corridor_name}</p>
                </div>
                <button
                  onClick={() => setShowDefectModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Log Defect</span>
                </button>
              </div>

              {/* Condition Score Gauge */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Health Index Condition Score</span>
                  <span className="font-mono font-black text-slate-900">{selectedAsset.condition_score}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      selectedAsset.condition_score >= 80
                        ? "bg-emerald-500"
                        : selectedAsset.condition_score >= 60
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                    style={{ width: `${selectedAsset.condition_score}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                  <span>0 Critical</span>
                  <span>60 Caution</span>
                  <span>100 Pristine</span>
                </div>
              </div>

              {/* Asset Metadata List */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Asset Code</span>
                  <span className="font-mono font-bold text-slate-800">{selectedAsset.asset_id}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Section Location</span>
                  <span className="font-bold text-slate-800">{selectedAsset.section}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Asset Type</span>
                  <span className="font-bold text-slate-800">{selectedAsset.asset_type}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Operating Status</span>
                  <span className="font-bold text-blue-700">{selectedAsset.status}</span>
                </div>
              </div>

              {/* Defect Logs Section */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Defect History ({defects.length})</span>
                  </span>
                </div>

                {defectsLoading ? (
                  <div className="text-center py-4 text-xs text-slate-400">Loading defects...</div>
                ) : defects.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                    No open defects logged for this asset.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {defects.map((def, idx) => (
                      <div
                        key={def.defect_id ? `${def.defect_id}-${idx}` : `def-${idx}`}
                        className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                              def.severity === "CRITICAL"
                                ? "bg-rose-100 text-rose-800"
                                : def.severity === "HIGH"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {def.severity}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(def.reported_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-slate-700 text-[11px] font-medium">{def.description}</p>
                        <div className="text-[10px] text-slate-500 flex justify-between">
                          <span>Status: {def.status}</span>
                          {def.reported_by && <span>By: {def.reported_by}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              Select an asset from the list to inspect its lifecycle parameters.
            </div>
          )}
        </div>
      </div>

      {/* Register Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-100 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">Register New Infrastructure Asset</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Asset Name / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Point Machine No. 104B"
                  value={newAsset.asset_name}
                  onChange={(e) => setNewAsset({ ...newAsset, asset_name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Asset Type</label>
                  <select
                    value={newAsset.asset_type}
                    onChange={(e) => setNewAsset({ ...newAsset, asset_type: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="TRACK">TRACK</option>
                    <option value="OHE">OHE (CATENARY)</option>
                    <option value="SIGNAL">SIGNAL</option>
                    <option value="POINT_MACHINE">POINT MACHINE</option>
                    <option value="BRIDGE">BRIDGE</option>
                    <option value="SUBSTATION">SUBSTATION</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department</label>
                  <select
                    value={newAsset.department}
                    onChange={(e) => setNewAsset({ ...newAsset, department: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Traction">Traction (TRD)</option>
                    <option value="S&T">Signal & Telecom</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Corridor</label>
                  <input
                    type="text"
                    required
                    value={newAsset.corridor_name}
                    onChange={(e) => setNewAsset({ ...newAsset, corridor_name: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Section Code</label>
                  <input
                    type="text"
                    required
                    value={newAsset.section}
                    onChange={(e) => setNewAsset({ ...newAsset, section: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Condition Score: {newAsset.condition_score}%
                </label>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={newAsset.condition_score}
                  onChange={(e) => setNewAsset({ ...newAsset, condition_score: Number(e.target.value) })}
                  className="w-full accent-blue-600"
                />
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
                  className="px-4 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold"
                >
                  Register in DB
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Defect Modal */}
      {showDefectModal && selectedAsset && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-100 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">
                Log Defect for {selectedAsset.asset_name}
              </h3>
              <button onClick={() => setShowDefectModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLogDefect} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Defect Description</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe flaw, ultrasonic test result, tension drop..."
                  value={newDefect.description}
                  onChange={(e) => setNewDefect({ ...newDefect, description: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Severity Level</label>
                <select
                  value={newDefect.severity}
                  onChange={(e) => setNewDefect({ ...newDefect, severity: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="LOW">LOW - Observational</option>
                  <option value="MEDIUM">MEDIUM - Schedule Inspection</option>
                  <option value="HIGH">HIGH - Urgent Rectification</option>
                  <option value="CRITICAL">CRITICAL - Immediate Speed Restriction / Block</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDefectModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold"
                >
                  Submit Defect Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
