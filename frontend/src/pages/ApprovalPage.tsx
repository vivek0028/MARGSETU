import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Wrench,
  Layers,
  ArrowRight,
  History,
  Check,
  MessageSquare,
  X,
  Printer,
  FileText
} from "lucide-react";
import { api } from "../services/api";
import { SchedulePlan } from "../types";
import { StatusBadge, DepartmentBadge } from "../components/Badges";
import { usePlanning } from "../context/PlanningContext";

export const ApprovalPage: React.FC = () => {
  const navigate = useNavigate();
  const { role, departmentRole, activeRoleDetail } = usePlanning();
  const [plans, setPlans] = useState<SchedulePlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("PLAN-A-CRIT");
  const [plannerComments, setPlannerComments] = useState("All hard safety constraints verified against Section A-B timetable. Coordinated multi-departmental block approved for execution.");
  const [authorizerName, setAuthorizerName] = useState("Sr. DOM Rajesh Sharma (Division Operations)");
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync authorizer with active perspective role
  useEffect(() => {
    switch (departmentRole) {
      case "OPERATING":
        setAuthorizerName("CTNL Rajesh Sharma (Operating / Chief Train Controller)");
        break;
      case "ENGINEERING":
        setAuthorizerName("Sr. DEN S. Mukherjee (Civil Engineering Track Co-Ord)");
        break;
      case "ST":
        setAuthorizerName("Sr. DSTE V. Narayanan (Signal & Telecom)");
        break;
      case "TRACTION":
        setAuthorizerName("Sr. DEE A. Verma (Traction Distribution TRD)");
        break;
      default:
        setAuthorizerName("Sr. DOM Rajesh Sharma (Division Operations)");
    }
  }, [departmentRole]);

  // Modals state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectCategory, setRejectCategory] = useState("VIP Train Movement / High Priority Express");
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [approvedPermit, setApprovedPermit] = useState<{
    permitNumber: string;
    planId: string;
    corridor: string;
    authorizer: string;
    timestamp: string;
    status: string;
    blocksApproved: number;
    comments: string;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getOptimizationPlans();
      setPlans(data);
      if (data.length > 0) {
        setSelectedPlanId(data[0].plan_id);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentPlan = plans.find(p => p.plan_id === selectedPlanId);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await api.approvePlan(selectedPlanId, {
        user_name: authorizerName,
        user_role: role || "Railway Planner",
        comments: plannerComments
      });
      setActionSuccess(`Plan ${selectedPlanId} officially approved and committed to the Append-Only Audit Trail.`);
      setApprovedPermit({
        permitNumber: `IR-POSS-${Date.now().toString().slice(-6)}`,
        planId: selectedPlanId,
        corridor: "Mainline Corridor Alpha",
        authorizer: authorizerName,
        timestamp: new Date().toLocaleString(),
        status: "SANCTIONED & AUDIT COMMITTED",
        blocksApproved: currentPlan?.scheduled_assignments?.length || 4,
        comments: plannerComments
      });
      await loadData();
      setTimeout(() => setActionSuccess(null), 6000);
    } catch (err: any) {
      alert("Approval error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectRemarks.trim()) {
      alert("Please provide specific operational remarks explaining this rejection.");
      return;
    }

    setIsProcessing(true);
    try {
      const fullReason = `[${rejectCategory}] ${rejectRemarks.trim()}`;
      await api.rejectPlan(selectedPlanId, {
        user_name: authorizerName,
        user_role: role || "Railway Planner",
        reason: fullReason
      });
      setShowRejectModal(false);
      setRejectRemarks("");
      setActionSuccess(`Plan ${selectedPlanId} marked as Rejected in the audit record.`);
      await loadData();
      setTimeout(() => setActionSuccess(null), 6000);
    } catch (err: any) {
      alert("Rejection error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestModification = () => {
    setActionSuccess(`Plan ${selectedPlanId} flagged for planner adjustments in Block Planning Workspace.`);
    setTimeout(() => {
      navigate("/workspace");
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Plan Review & Approval</h1>
            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              Human-in-the-Loop
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Human-controlled sign-off and power block sanction for Indian Railways operations.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            to="/audit"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>View Audit History</span>
          </Link>
        </div>
      </div>

      {/* Mandatory Non-Autonomous Regulatory Guardrail Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3 text-xs text-amber-900">
        <ShieldCheck className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="block font-bold">HUMAN CONTROL MANDATE (Non-Autonomous Decision Support):</strong>
          MARGSETU generates constraint-optimized recommendations only. Operational block approval, traction power disconnection permits, and line possession sanctions remain strictly under human planner authorization.
        </div>
      </div>

      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs px-4 py-2.5 rounded-lg font-medium flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Approval Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Plan Summary (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                TARGET PLAN RECOMMENDATION
              </span>
              <div className="flex items-center space-x-2 mt-0.5">
                <h2 className="text-base font-black text-slate-900">
                  {currentPlan ? currentPlan.plan_name : "Loading Plan..."}
                </h2>
                {currentPlan && <StatusBadge status={currentPlan.status} />}
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className="font-semibold text-slate-600">Select Plan:</span>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="border border-slate-300 rounded-lg px-2.5 py-1 bg-white font-mono font-semibold text-slate-900 focus:ring-2 focus:ring-railway-blue"
              >
                {plans.map((p) => (
                  <option key={p.plan_id} value={p.plan_id}>
                    {p.plan_name} ({p.plan_id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Plan Summary Specs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Affected Section</span>
              <strong className="text-slate-900 font-bold text-sm block mt-0.5">Section A–B</strong>
              <span className="text-[10px] text-slate-400">Mainline Track Alpha</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Departments</span>
              <strong className="text-slate-900 font-bold text-sm block mt-0.5">3 Coordinated</strong>
              <span className="text-[10px] text-slate-400">Engineering, S&T, Traction</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Block Duration</span>
              <strong className="text-railway-blue font-mono font-bold text-sm block mt-0.5">3.0 Hours</strong>
              <span className="text-[10px] text-slate-400">Tuesday 09:00 – 12:00</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Unresolved Conflicts</span>
              <strong className="text-emerald-700 font-mono font-bold text-sm block mt-0.5">0 Hard Conflicts</strong>
              <span className="text-[10px] text-slate-400">100% Feasible</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Resource Allocation</span>
              <strong className="text-slate-900 font-bold text-sm block mt-0.5">3 Crews & 2 Machines</strong>
              <span className="text-[10px] text-slate-400">Depot verified</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Critical Task Coverage</span>
              <strong className="text-emerald-700 font-mono font-bold text-sm block mt-0.5">
                {currentPlan?.critical_coverage || 100}%
              </strong>
              <span className="text-[10px] text-slate-400">All high-priority met</span>
            </div>
          </div>

          {/* Maintenance Activities in this Block */}
          <div className="space-y-2 text-xs">
            <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">
              Coordinated Maintenance Activities in this Block:
            </span>
            <div className="space-y-2">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DepartmentBadge department="Engineering" />
                  <span className="font-semibold text-slate-900">Track Ultrasonic Flaw Testing (REQ-001)</span>
                </div>
                <span className="font-mono text-slate-600">2.0 hrs &bull; Crew 1</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DepartmentBadge department="S&T" />
                  <span className="font-semibold text-slate-900">Point Machine & Signal Interlocking (REQ-002)</span>
                </div>
                <span className="font-mono text-slate-600">2.5 hrs &bull; S&T Team</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DepartmentBadge department="Traction" />
                  <span className="font-semibold text-slate-900">OHE Section Insulator Wash & Power Isol (REQ-004)</span>
                </div>
                <span className="font-mono text-slate-600">2.0 hrs &bull; Tower Wagon</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pre-Checks & Decision Options (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="font-black text-xs uppercase tracking-wider text-slate-900">
              Pre-Approval Verification
            </h3>
            <span className="text-[11px] text-slate-500">
              Mandatory safety check gates prior to sign-off
            </span>
          </div>

          {/* Three Key Status Gates */}
          <div className="space-y-2.5 text-xs">
            {/* Hard Constraints */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <div>
                <strong className="text-emerald-950 block">Hard Constraints</strong>
                <span className="text-[11px] text-emerald-800">Zero timetable & location clash</span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600 text-white flex items-center space-x-1">
                <Check className="w-3 h-3" />
                <span>✓ Passed</span>
              </span>
            </div>

            {/* Soft Preferences */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div>
                <strong className="text-blue-950 block">Soft Preferences</strong>
                <span className="text-[11px] text-blue-800">Joint bundling & utilization</span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-railway-blue text-white flex items-center space-x-1">
                <Check className="w-3 h-3" />
                <span>✓ Optimized</span>
              </span>
            </div>

            {/* Human Review */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div>
                <strong className="text-amber-950 block">Human Review</strong>
                <span className="text-[11px] text-amber-800">Pending planner sanction</span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500 text-white flex items-center space-x-1">
                <span>● Pending</span>
              </span>
            </div>
          </div>

          {/* Authorizing Official & Comments */}
          <div className="space-y-3 pt-2 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Authorizing Official:</label>
              <input
                type="text"
                value={authorizerName}
                onChange={(e) => setAuthorizerName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Planner Comments & Justification:</label>
              <textarea
                rows={3}
                value={plannerComments}
                onChange={(e) => setPlannerComments(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-railway-blue text-slate-800"
              />
            </div>
          </div>

          {/* Decision Buttons */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <button
              onClick={handleApprove}
              disabled={isProcessing}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center justify-center space-x-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isProcessing ? "Committing..." : "Approve Block Plan"}</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleRequestModification}
                className="py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Request Modification
              </button>
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                className="py-2 border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Reject Plan
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* GovTech Formal Plan Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Official Plan Rejection Notice</h3>
                  <span className="text-[10px] font-mono text-slate-500 font-semibold uppercase">
                    Mandatory Operational Rationale Record
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowRejectModal(false)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-4 text-xs">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 text-[11px] leading-relaxed">
                <strong>Regulatory Compliance Note:</strong> Rejections are permanently logged to the Indian Railways immutable audit trail. Please select the primary operational constraint and state detailed justification.
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                  Rejection Reason Category:
                </label>
                <select
                  value={rejectCategory}
                  onChange={(e) => setRejectCategory(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 bg-white text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-rose-500"
                >
                  <option value="VIP Train Movement / High Priority Express">VIP Train Movement / High Priority Express</option>
                  <option value="Severe Weather / Track Inundation / Safety Hazard">Severe Weather / Track Inundation / Safety Hazard</option>
                  <option value="Crew / Track Machine Resource Shortage">Crew / Track Machine Resource Shortage</option>
                  <option value="Traction 25kV OHE Disconnection Refused">Traction 25kV OHE Disconnection Refused</option>
                  <option value="Alternative Corridor Traffic Window Required">Alternative Corridor Traffic Window Required</option>
                  <option value="Section Operational Congestion Backlog">Section Operational Congestion Backlog</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                  Detailed Operational Remarks & Directives:
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="E.g., Train 12423 Rajdhani Express diverted onto Up Line requiring track clearance. Reschedule possession to midnight corridor slot."
                  value={rejectRemarks}
                  onChange={(e) => setRejectRemarks(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-rose-500 text-slate-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>{isProcessing ? "Committing..." : "Commit Rejection to Audit Trail"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Line Possession Sanction Order Permit Certificate */}
      {approvedPermit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border-2 border-emerald-500 space-y-4 animate-in fade-in zoom-in duration-150">
            {/* Certificate Header */}
            <div className="text-center pb-3 border-b-2 border-slate-900 space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                INDIAN RAILWAYS &bull; OPERATING & SAFETY DEPARTMENT
              </div>
              <h2 className="text-base font-black text-slate-950 tracking-tight">
                OFFICIAL LINE POSSESSION & POWER BLOCK SANCTION ORDER
              </h2>
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-mono text-[10px] font-black border border-emerald-300">
                PERMIT NO: {approvedPermit.permitNumber}
              </div>
            </div>

            {/* Certificate Body */}
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans font-bold">PLAN IDENTIFIER:</span>
                  <strong className="text-slate-900">{approvedPermit.planId}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans font-bold">CORRIDOR:</span>
                  <strong className="text-slate-900">{approvedPermit.corridor}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans font-bold">SANCTIONING OFFICER:</span>
                  <strong className="text-slate-900">{approvedPermit.authorizer}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans font-bold">TIMESTAMP:</span>
                  <strong className="text-slate-900">{approvedPermit.timestamp}</strong>
                </div>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-emerald-950 space-y-1">
                <span className="font-bold text-[10px] uppercase tracking-wider block">
                  SANCTION DECLARATION:
                </span>
                <p className="text-[11px] leading-relaxed">
                  Line possession and coordinated electrical traction permit are hereby granted for all {approvedPermit.blocksApproved} scheduled departmental maintenance blocks. All Section controllers are instructed to issue requisite cautions and secure train paths.
                </p>
              </div>

              <div className="text-slate-600 italic text-[10px] border-l-2 border-slate-300 pl-2">
                Planner Remarks: "{approvedPermit.comments}"
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[10px] font-mono text-emerald-800 font-bold flex items-center space-x-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>COMMITTED TO IMMUTABLE AUDIT LOG</span>
              </span>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 rounded-xl text-slate-700 text-xs font-semibold flex items-center space-x-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Sanction Permit</span>
                </button>
                <Link
                  to="/audit"
                  className="px-3.5 py-1.5 bg-railway-blue hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                >
                  <span>View in Audit Trail &rarr;</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setApprovedPermit(null)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
