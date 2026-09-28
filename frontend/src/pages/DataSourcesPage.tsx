import React, { useEffect, useState } from "react";
import {
  Server,
  Database,
  CheckCircle2,
  RefreshCw,
  FileCode,
  ShieldAlert,
  X,
  Layers,
  ArrowRight
} from "lucide-react";
import { api } from "../services/api";
import { DataSourceItem } from "../types";

export const DataSourcesPage: React.FC = () => {
  const [sources, setSources] = useState<DataSourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sampleModalData, setSampleModalData] = useState<{ name: string; content: any } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadSources = async () => {
    setLoading(true);
    try {
      const data = await api.getDataSources();
      setSources(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleViewSample = async (name: string) => {
    try {
      if (name === "BDMS" || name === "TMS" || name === "SMMS" || name === "TDMS") {
        const tasks = await api.getTasks({ department: name === "TMS" ? "Engineering" : name === "SMMS" ? "S&T" : name === "TDMS" ? "Traction" : undefined });
        setSampleModalData({ name, content: tasks.slice(0, 3) });
      } else if (name === "COA") {
        const trains = await api.getTrainMovements();
        const blocks = await api.getBlockWindows();
        setSampleModalData({ name, content: { train_movements: trains.slice(0, 2), block_windows: blocks.slice(0, 2) } });
      } else {
        setSampleModalData({
          name,
          content: { forecast: "Freight coal & container traffic density predictions (Simulated)" }
        });
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Data Sources & BDMS Adapters</h1>
            <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2 py-0.5 rounded uppercase">
              Mock Adapters
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Canonical data ingestion interfaces simulating railway operational and infrastructure databases
          </p>
        </div>

        <button
          onClick={loadSources}
          className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Adapter Status</span>
        </button>
      </div>

      {/* Mandatory Disclaimer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center space-x-3 text-xs text-blue-950">
        <ShieldAlert className="w-5 h-5 text-railway-blue flex-shrink-0" />
        <span>
          <strong>Data Ingestion Architecture:</strong> In compliance with Hackathon Problem Statement 26027, all adapters
          operate in <strong>DEMO MODE</strong> with synthetic railway feeds. The architecture provides plug-and-play adapter hooks
          ready to interface with authorized APIs upon official deployment.
        </span>
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sources.map((src) => (
          <div
            key={src.source_id}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-extrabold text-base text-slate-900 font-mono">{src.name}</span>
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {src.status}
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-700 mt-2">{src.full_name}</h4>
              <p className="text-xs text-slate-500 mt-1">{src.description}</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5 font-mono border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-400">System Type:</span>
                <span className="text-slate-800 font-semibold">{src.system_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Records Ingested:</span>
                <strong className="text-railway-blue">{src.record_count}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last Synchronized:</span>
                <span className="text-slate-600">{src.last_sync}</span>
              </div>
            </div>

            <div>
              <button
                onClick={() => handleViewSample(src.name)}
                className="w-full text-center py-2 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition flex items-center justify-center space-x-1.5"
              >
                <FileCode className="w-3.5 h-3.5 text-railway-blue" />
                <span>View Sample Canonical Payload</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Sample Payload Modal */}
      {sampleModalData && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-xs font-bold text-slate-400 font-mono">CANONICAL ADAPTER SCHEMA</span>
                <h3 className="font-extrabold text-base text-slate-900">{sampleModalData.name} Data Stream</h3>
              </div>
              <button onClick={() => setSampleModalData(null)} className="p-1 rounded-md hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 text-emerald-400 p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-96">
              <pre>{JSON.stringify(sampleModalData.content, null, 2)}</pre>
            </div>

            <button
              onClick={() => setSampleModalData(null)}
              className="w-full py-2 bg-slate-900 text-white rounded-md text-xs font-semibold hover:bg-slate-800"
            >
              Close Sample Viewer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
