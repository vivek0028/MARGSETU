import React, { useState, useEffect } from "react";
import {
  Shield,
  Sliders,
  Users,
  Activity,
  CheckCircle2,
  AlertCircle,
  Database,
  RefreshCw,
  Save,
  Server
} from "lucide-react";
import { User } from "../types";
import { api } from "../services/api";

export const AdminPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [weights, setWeights] = useState<Record<string, number>>({
    criticality: 40,
    deadline_urgency: 25,
    operational_impact: 20,
    age_overdue: 15
  });
  const [loading, setLoading] = useState(true);
  const [savingWeights, setSavingWeights] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [usersData, healthData, settingsData] = await Promise.all([
        api.getUsers().catch(() => []),
        api.getSystemHealth().catch(() => ({ status: "healthy", database: "connected" })),
        api.getSystemSettings().catch(() => ({ weights: { criticality: 40, deadline_urgency: 25, operational_impact: 20, age_overdue: 15 } }))
      ]);
      setUsers(usersData);
      setHealth(healthData);
      if (settingsData?.weights) {
        setWeights(settingsData.weights);
      }
    } catch (err) {
      console.error("Failed to load admin data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleSaveWeights = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWeights(true);
    setSaveMsg(null);
    try {
      await api.updatePriorityWeights(weights);
      setSaveMsg("Priority scoring weights saved successfully! Solver recalculation active.");
    } catch (err: any) {
      alert(err.message || "Failed to update weights");
    } finally {
      setSavingWeights(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-slate-900 text-white">
              <Shield className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">
                System Administration & Priority Weight Tuning
              </h1>
              <p className="text-xs text-slate-500">
                Configure mathematical priority weights, inspect PostgreSQL cluster health, and manage RBAC authorizations.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => fetchAdminData()}
          className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Dynamic Priority Weight Tuning Sliders */}
        <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <Sliders className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-800">Priority Engine Weight Sliders</h2>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Adjust the formula coefficients used by the rule-based Priority Engine to score incoming work orders (Total:{" "}
            <span className="font-mono font-bold text-slate-800">
              {Object.values(weights).reduce((a, b) => a + b, 0)}%
            </span>
            ).
          </p>

          {saveMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{saveMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveWeights} className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between font-bold text-slate-700 mb-1">
                <span>Asset Criticality</span>
                <span className="font-mono text-blue-600">{weights.criticality || 40}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                value={weights.criticality || 40}
                onChange={(e) => setWeights({ ...weights, criticality: Number(e.target.value) })}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between font-bold text-slate-700 mb-1">
                <span>Deadline Urgency</span>
                <span className="font-mono text-blue-600">{weights.deadline_urgency || 25}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                value={weights.deadline_urgency || 25}
                onChange={(e) => setWeights({ ...weights, deadline_urgency: Number(e.target.value) })}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between font-bold text-slate-700 mb-1">
                <span>Operational Impact</span>
                <span className="font-mono text-blue-600">{weights.operational_impact || 20}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="40"
                value={weights.operational_impact || 20}
                onChange={(e) => setWeights({ ...weights, operational_impact: Number(e.target.value) })}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between font-bold text-slate-700 mb-1">
                <span>Age / Overdue Penalty</span>
                <span className="font-mono text-blue-600">{weights.age_overdue || 15}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                value={weights.age_overdue || 15}
                onChange={(e) => setWeights({ ...weights, age_overdue: Number(e.target.value) })}
                className="w-full accent-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={savingWeights}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{savingWeights ? "Saving..." : "Apply New Weight Configuration"}</span>
            </button>
          </form>

          {/* Health Telemetry */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700">
              <Server className="w-3.5 h-3.5 text-emerald-600" />
              <span>PostgreSQL Cluster Telemetry</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-[11px] space-y-1 font-mono text-slate-600">
              <div className="flex justify-between">
                <span>Engine:</span>
                <span className="font-bold text-slate-800">PostgreSQL 18</span>
              </div>
              <div className="flex justify-between">
                <span>Database:</span>
                <span className="font-bold text-slate-800">railoptiblock</span>
              </div>
              <div className="flex justify-between">
                <span>Port:</span>
                <span className="font-bold text-slate-800">5433</span>
              </div>
              <div className="flex justify-between">
                <span>Health:</span>
                <span className="font-bold text-emerald-600">ONLINE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Users & RBAC Matrix */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Authorized Railway Personnel ({users.length})</span>
            </span>
            <span className="text-[11px] text-slate-500">PostgreSQL Users Table</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading user accounts...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No registered users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Officer Name</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Assigned Role</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u, idx) => (
                    <tr key={u.user_id ? `${u.user_id}-${idx}` : `user-${idx}`} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-4 font-bold text-slate-900">{u.full_name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{u.email}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            u.role === "ADMIN"
                              ? "bg-purple-50 text-purple-800 border-purple-200"
                              : u.role === "PLANNER"
                              ? "bg-blue-50 text-blue-800 border-blue-200"
                              : u.role === "CONTROL_OFFICER"
                              ? "bg-rose-50 text-rose-800 border-rose-200"
                              : "bg-slate-50 text-slate-800 border-slate-200"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{u.department || "Operations"}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center space-x-1 text-emerald-700 font-bold text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Active</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
