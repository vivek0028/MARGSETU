import React from "react";

export const DepartmentBadge: React.FC<{ department: string }> = ({ department }) => {
  const styles: Record<string, string> = {
    Engineering: "bg-blue-50 text-blue-700 border-blue-200/80",
    "S&T": "bg-purple-50 text-purple-700 border-purple-200/80",
    Traction: "bg-amber-50 text-amber-800 border-amber-200/80",
  };
  const dots: Record<string, string> = {
    Engineering: "bg-blue-500",
    "S&T": "bg-purple-500",
    Traction: "bg-amber-500",
  };
  const cls = styles[department] || "bg-slate-50 text-slate-700 border-slate-200";
  const dotCls = dots[department] || "bg-slate-400";
  return (
    <span className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
      <span>{department}</span>
    </span>
  );
};

export const PriorityBadge: React.FC<{ criticality: string; score?: number }> = ({ criticality, score }) => {
  const styles: Record<string, string> = {
    Critical: "bg-rose-50 text-rose-800 border-rose-200",
    High: "bg-orange-50 text-orange-800 border-orange-200",
    Medium: "bg-amber-50 text-amber-800 border-amber-200",
    Low: "bg-slate-50 text-slate-700 border-slate-200",
  };
  const cls = styles[criticality] || "bg-slate-50 text-slate-700 border-slate-200";
  return (
    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-black border ${cls}`}>
      <span>{criticality}</span>
      {score !== undefined && <span className="text-[10px] font-mono opacity-75 font-semibold">({score.toFixed(0)})</span>}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    Scheduled: "bg-blue-50 text-blue-800 border-blue-200",
    Approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
    Pending: "bg-slate-50 text-slate-700 border-slate-200",
    Deferred: "bg-amber-50 text-amber-800 border-amber-200",
    In_Progress: "bg-sky-50 text-sky-800 border-sky-200",
    Rejected: "bg-rose-50 text-rose-800 border-rose-200",
    Completed: "bg-teal-50 text-teal-800 border-teal-200",
  };
  const dots: Record<string, string> = {
    Scheduled: "bg-blue-500",
    Approved: "bg-emerald-500",
    Pending: "bg-slate-400",
    Deferred: "bg-amber-500",
    In_Progress: "bg-sky-500 animate-pulse",
    Rejected: "bg-rose-500",
    Completed: "bg-teal-500",
  };
  const cls = styles[status] || "bg-slate-50 text-slate-700 border-slate-200";
  const dotCls = dots[status] || "bg-slate-400";
  return (
    <span className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
      <span>{status}</span>
    </span>
  );
};
