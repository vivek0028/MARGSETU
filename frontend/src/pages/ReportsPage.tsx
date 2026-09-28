import React, { useState } from "react";
import {
  FileText,
  Download,
  FileSpreadsheet,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight
} from "lucide-react";
import { api, API_BASE_URL } from "../services/api";

export const ReportsPage: React.FC = () => {
  const [downloading, setDownloading] = useState<string | null>(null);

  const downloadFile = (url: string, filename: string) => {
    setDownloading(filename);
    const token = localStorage.getItem("rail_access_token");
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then((res) => {
        if (!res.ok) throw new Error("Download failed");
        return res.blob();
      })
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((err) => {
        alert(err.message || "Failed to download report.");
      })
      .finally(() => {
        setDownloading(null);
      });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-2">
          <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
            <FileText className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">
              Reports & Operational Data Export Hub
            </h1>
            <p className="text-xs text-slate-500">
              Download official Indian Railways maintenance logs, CP-SAT schedules, and audit records in CSV and JSON.
            </p>
          </div>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Execution Log CSV */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Live Execution Log (CSV)</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Complete plan-vs-actual execution records, crew lead signatures, actual durations, and schedule variance minutes.
            </p>
          </div>

          <button
            onClick={() =>
              downloadFile(`${API_BASE_URL}/api/reports/execution/csv`, `rail_execution_report_${Date.now()}.csv`)
            }
            disabled={downloading !== null}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            <span>{downloading?.includes("execution") ? "Generating..." : "Download Execution CSV"}</span>
          </button>
        </div>

        {/* Optimized Plan JSON */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <FileCode className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Optimization Schedule (JSON)</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Complete CP-SAT solver candidate plan including bundled assignments, deferred tasks, and mathematical objective values.
            </p>
          </div>

          <button
            onClick={() =>
              downloadFile(`${API_BASE_URL}/api/reports/plan/current/json`, `railoptiblock_plan_${Date.now()}.json`)
            }
            disabled={downloading !== null}
            className="w-full py-2.5 px-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            <span>{downloading?.includes("plan") ? "Generating..." : "Download Plan JSON"}</span>
          </button>
        </div>

        {/* Audit Trail Export */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Sanction & Audit Trail</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Immutable log of all human approvals, override justifications, solver executions, and conflict resolutions.
            </p>
          </div>

          <button
            onClick={() =>
              downloadFile(`${API_BASE_URL}/api/audit-logs?limit=500`, `railoptiblock_audit_${Date.now()}.json`)
            }
            disabled={downloading !== null}
            className="w-full py-2.5 px-3 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            <span>{downloading?.includes("audit") ? "Generating..." : "Download Audit Logs"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
