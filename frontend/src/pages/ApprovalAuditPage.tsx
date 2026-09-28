import React, { useEffect, useState } from "react";
import {
  CheckSquare,
  ShieldCheck,
  History,
  FileCheck,
  XCircle,
  AlertTriangle,
  UserCheck,
  Clock,
  RefreshCw
} from "lucide-react";
import { api } from "../services/api";
import { SchedulePlan } from "../types";
import { StatusBadge } from "../components/Badges";

export const ApprovalAuditPage: React.FC = () => {
  const [plans, setPlans] = useState<SchedulePlan[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState("PLAN-A-CRIT");
  const [plannerName, setPlannerName] = useState("Sr. DOM Rajesh Sharma");
  const [role, setRole] = useState("Reviewer");
  const [comments, setComments] = useState("Verified against Section B-C timetable corridor. Approved for execution.");
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansData, logsData] = await Promise.all([
        api.getOptimizationPlans(),
        api.getAuditLogs(50)
      ]);
      setPlans(plansData);
      setAuditLogs(logsData);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async () => {
    try {
      await api.approvePlan(selectedPlanId, {
        user_name: plannerName,
        user_role: role,
        comments
      });
      setActionSuccess(`Plan ${selectedPlanId} successfully approved and logged to Append-Only Audit Trail.`);
      loadData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReject = async () => {
    const reason = prompt("Enter mandatory technical reason for plan rejection:");
    if (reason && reason.trim()) {
      try {
        await api.rejectPlan(selectedPlanId, {
          user_name: plannerName,
          user_role: role,
          reason
        });
        setActionSuccess(`Plan ${selectedPlanId} marked as Rejected.`);
        loadData();
        setTimeout(() => setActionSuccess(null), 4000);
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Human Approval & Append-Only Audit Trail</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded uppercase">
              Human-in-the-Loop
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Formal decision review, override authorizations, and Append-Only Audit Trail. The audit trail records approval and workflow events for the prototype.
          </p>
        </div>

        <button
          onClick={loadData}
          className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Mandatory Regulatory Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center space-x-3 text-xs text-amber-900 font-medium">
        <ShieldCheck className="w-5 h-5 text-amber-700 flex-shrink-0" />
        <span>
          <strong>Operational Directive:</strong> MARGSETU recommendations are non-autonomous decision support proposals.
          Final operational block sanction and power disconnection authorization strictly remain with authorized railway personnel.
        </span>
      </div>

      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs p-3 rounded-md font-medium">
          {actionSuccess}
        </div>
      )}

      {/* Human Approval Action Box */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide flex items-center space-x-2">
          <FileCheck className="w-4 h-4 text-railway-blue" />
          <span>Plan Decision Review & Sign-Off</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Target Plan Recommendation:</label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full border border-slate-300 rounded p-2 bg-white font-mono font-semibold"
            >
              {plans.map((p) => (
                <option key={p.plan_id} value={p.plan_id}>
                  {p.plan_name} ({p.plan_id}) &bull; {p.status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Authorizing Official Name:</label>
            <input
              type="text"
              value={plannerName}
              onChange={(e) => setPlannerName(e.target.value)}
              className="w-full border border-slate-300 rounded p-2"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Designated Role:</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full border border-slate-300 rounded p-2 bg-white"
            >
              <option value="Planner">Planner (Divisional Operations)</option>
              <option value="Reviewer">Reviewer (Sr. DOM / Dy. COM)</option>
              <option value="Administrator">Administrator (Zonal HQ / Railway Board)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 text-xs mb-1">Planner Review Notes & Justification:</label>
          <textarea
            rows={2}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-2 focus:ring-railway-blue"
          />
        </div>

        <div className="pt-2 flex items-center justify-end space-x-3">
          <button
            onClick={handleReject}
            className="px-4 py-2 border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition flex items-center space-x-1.5"
          >
            <XCircle className="w-4 h-4" />
            <span>Reject Plan</span>
          </button>
          <button
            onClick={handleApprove}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center space-x-1.5"
          >
            <CheckSquare className="w-4 h-4" />
            <span>Approve & Authorize Block</span>
          </button>
        </div>
      </div>

      {/* Append-Only Audit Trail Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-2">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-slate-700" />
            <h3 className="font-bold text-slate-900 text-sm">System & Operational Append-Only Audit Trail Logs</h3>
          </div>
          <span className="text-xs font-mono text-slate-500">Showing last {auditLogs.length} events</span>
        </div>

        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Authorizing User / Role</th>
                <th>Action Type</th>
                <th>Target ID</th>
                <th>Details / Rationale</th>
                <th>Status Transition</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-400 text-xs">
                    No audit records logged yet.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.log_id} className="hover:bg-slate-50 transition">
                    <td className="font-mono text-xs text-slate-600 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {new Date(log.timestamp).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs font-bold text-slate-800">{log.user_role}</span>
                    </td>
                    <td>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="font-mono text-xs font-bold text-slate-700">{log.target_id}</td>
                    <td className="text-xs text-slate-800 max-w-md">{log.details}</td>
                    <td>
                      {log.status_change ? (
                        <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {log.status_change}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
