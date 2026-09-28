import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Train, ShieldCheck, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@railoptiblock.local");
  const [password, setPassword] = useState("RailOpti@2026");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to log in. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const setDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("RailOpti@2026");
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-6 px-4">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-sky-500 text-white shadow-lg shadow-blue-500/25">
            <Train className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">
            Sign In to MARGSETU
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Ministry of Railways &bull; Maintenance Block Decision Support System
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-2.5 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Official Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@railoptiblock.local"
                  className="w-full pl-9 pr-3 py-2 text-xs font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Access Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center space-x-2 text-slate-600 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span>Keep session active</span>
              </label>
              <span className="text-blue-600 hover:underline cursor-pointer">
                Forgot password?
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white font-bold text-xs shadow-md shadow-blue-700/20 flex items-center justify-center space-x-2 transition disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to Station Workstation</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="pt-3 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Select Demo Role Profile
            </p>
            <div className="grid grid-cols-2 gap-2 text-left">
              <button
                type="button"
                onClick={() => setDemoAccount("admin@railoptiblock.local")}
                className={`p-2 rounded-lg border text-[11px] transition text-left cursor-pointer ${
                  email === "admin@railoptiblock.local"
                    ? "border-blue-500 bg-blue-50/70 text-blue-900 font-bold"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>System Admin</span>
                  {email === "admin@railoptiblock.local" && <CheckCircle2 className="w-3 h-3 text-blue-600" />}
                </div>
                <div className="text-[10px] text-slate-500">HQ / Superuser</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount("planner@railoptiblock.local")}
                className={`p-2 rounded-lg border text-[11px] transition text-left cursor-pointer ${
                  email === "planner@railoptiblock.local"
                    ? "border-blue-500 bg-blue-50/70 text-blue-900 font-bold"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>Chief Planner</span>
                  {email === "planner@railoptiblock.local" && <CheckCircle2 className="w-3 h-3 text-blue-600" />}
                </div>
                <div className="text-[10px] text-slate-500">CP-SAT Workstation</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount("control@railoptiblock.local")}
                className={`p-2 rounded-lg border text-[11px] transition text-left cursor-pointer ${
                  email === "control@railoptiblock.local"
                    ? "border-blue-500 bg-blue-50/70 text-blue-900 font-bold"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>Control Officer</span>
                  {email === "control@railoptiblock.local" && <CheckCircle2 className="w-3 h-3 text-blue-600" />}
                </div>
                <div className="text-[10px] text-slate-500">Sanction / Traffic</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount("engineering@railoptiblock.local")}
                className={`p-2 rounded-lg border text-[11px] transition text-left cursor-pointer ${
                  email === "engineering@railoptiblock.local"
                    ? "border-blue-500 bg-blue-50/70 text-blue-900 font-bold"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>Sr. DEN Track</span>
                  {email === "engineering@railoptiblock.local" && <CheckCircle2 className="w-3 h-3 text-blue-600" />}
                </div>
                <div className="text-[10px] text-slate-500">Civil Engineering</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500 flex items-center justify-center space-x-1">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>PostgreSQL 18 &bull; Role-Based Access Control (RBAC)</span>
        </div>
      </div>
    </div>
  );
};
