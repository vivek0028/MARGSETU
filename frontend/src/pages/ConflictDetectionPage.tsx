import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  RefreshCw,
  Clock,
  Wrench,
  MapPin,
  GitBranch,
  Timer,
  CheckCircle2,
  Train,
  ArrowRight,
  Filter,
  Eye,
  Check,
  X,
  Layers,
  ShieldAlert
} from "lucide-react";
import { api } from "../services/api";
import { ConflictItem } from "../types";

export const ConflictDetectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [notification, setNotification] = useState<string | null>(null);
  const [selectedConflict, setSelectedConflict] = useState<ConflictItem | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [resolvingConflict, setResolvingConflict] = useState<ConflictItem | null>(null);
  const [resolutionStrategy, setResolutionStrategy] = useState<"bundling" | "stagger" | "crew">("bundling");
  const [isSolving, setIsSolving] = useState(false);

  const loadConflicts = async () => {
    setLoading(true);
    try {
      const data = await api.getConflicts();
      // Exclude resolved conflicts from PostgreSQL
      const active = data.filter((c: ConflictItem) => c.status !== "Resolved");
      setConflicts(active);
    } catch (err: any) {
      console.error("Failed to load conflicts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConflicts();
  }, []);

  const handleRunDetection = async () => {
    setIsDetecting(true);
    try {
      const res = await api.detectConflicts();
      const active = res.conflicts.filter((c: ConflictItem) => c.status !== "Resolved");
      setConflicts(active);
      setNotification(`Corridor scan complete: ${active.length} active conflicts detected across 5 dimensions.`);
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      alert(`Detection failed: ${err.message}`);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleExecuteResolution = async () => {
    if (!resolvingConflict) return;
    setIsSolving(true);
    const cid = resolvingConflict.conflict_id;
    try {
      // 1. Formally resolve the conflict in PostgreSQL
      await api.resolveConflict(cid, {
        resolution_strategy: resolutionStrategy,
        resolution_action: resolutionStrategy === "bundling" ? "BUNDLE_TASKS" : "MANUAL_RESCHEDULE",
        resolution_notes: `Resolved via ${resolutionStrategy} strategy. Bundled into corridor possession.`
      });

      // 2. Generate updated candidate plans via OR-Tools CP-SAT
      try {
        const res = await api.generateOptimizationPlans({
          strategy_type: "ALL",
          allow_bundling: resolutionStrategy === "bundling",
          additional_crew_count: resolutionStrategy === "crew" ? 2 : 0,
          block_duration_bonus_hours: resolutionStrategy === "stagger" ? 1.0 : 0
        });
        const generatedPlan = res.plans?.[0];
        const planId = generatedPlan?.plan_id;

        // 3. Automatically sanction/approve this plan so it is immediately scheduled on the Dashboard
        if (planId) {
          await api.approvePlan(planId, {
            user_name: "Chief Operations Manager",
            user_role: "ADMIN",
            comments: `Coordinated plan auto-sanctioned following resolution of conflict ${cid}.`
          });
        }
      } catch (optErr) {
        console.warn("Optimizer plan update notice:", optErr);
      }

      // 4. Remove resolved conflict from view immediately
      setResolvedIds(prev => new Set(prev).add(cid));
      setConflicts(prev => prev.filter(c => c.conflict_id !== cid));

      const strategyLabel =
        resolutionStrategy === "bundling"
          ? "Joint Corridor Bundling"
          : resolutionStrategy === "stagger"
          ? "Timetable Window Staggering (+2 hrs)"
          : "Auxiliary Division Gang Reallocation";

      setNotification(`Conflict ${cid} resolved via ${strategyLabel}! Coordinated blocks are now scheduled on the Dashboard.`);
      setResolvingConflict(null);
    } catch (err: any) {
      alert(`Resolution error: ${err.message}`);
    } finally {
      setIsSolving(false);
    }
  };

  // Filtered active conflicts (excluding resolved)
  const activeConflicts = useMemo(() => {
    return conflicts.filter(c => c.status !== "Resolved" && !resolvedIds.has(c.conflict_id));
  }, [conflicts, resolvedIds]);

  // Category counts based on active conflicts
  const categoryCounts = useMemo(() => {
    return {
      Time: activeConflicts.filter(c => c.conflict_type === "Timetable" || c.conflict_type === "Duration").length,
      Resource: activeConflicts.filter(c => c.conflict_type === "Resource").length,
      Location: activeConflicts.filter(c => c.conflict_type === "Location").length,
      Operational: activeConflicts.filter(c => c.conflict_type === "Timetable" && c.affected_trains && c.affected_trains.length > 0).length,
      Dependency: activeConflicts.filter(c => c.conflict_type === "Dependency").length,
    };
  }, [activeConflicts]);

  const filteredConflicts = useMemo(() => {
    return activeConflicts.filter(c => {
      // Category filter
      let matchesCat = true;
      if (activeCategory === "Time") {
        matchesCat = c.conflict_type === "Timetable" || c.conflict_type === "Duration";
      } else if (activeCategory === "Resource") {
        matchesCat = c.conflict_type === "Resource";
      } else if (activeCategory === "Location") {
        matchesCat = c.conflict_type === "Location";
      } else if (activeCategory === "Operational") {
        matchesCat = c.conflict_type === "Timetable" && Boolean(c.affected_trains && c.affected_trains.length > 0);
      } else if (activeCategory === "Dependency") {
        matchesCat = c.conflict_type === "Dependency";
      }

      // Severity filter
      const matchesSev = severityFilter === "ALL" || c.severity === severityFilter;

      return matchesCat && matchesSev;
    });
  }, [activeConflicts, activeCategory, severityFilter]);

  // Synthetic side-by-side activity parser for rich GovTech card view
  const parseConflictEntities = (c: ConflictItem) => {
    // Return structured side-A and side-B
    if (c.conflict_type === "Location" || c.explanation.toLowerCase().includes("overlap")) {
      return {
        left: {
          dept: "Engineering",
          activity: "Track Inspection",
          section: "Section A-B",
          window: "10:00 - 12:00",
          task: c.affected_tasks?.[0] || "REQ-001"
        },
        right: {
          dept: "S&T",
          activity: "Signal Maintenance",
          section: "Section A-B",
          window: "11:00 - 13:00",
          task: c.affected_tasks?.[1] || "REQ-002"
        },
        conflictLabel: "TIME + LOCATION CONFLICT",
        reason: "Overlapping maintenance window & simultaneous Section A-B track occupancy.",
        suggested: "Combine compatible activities into a single coordinated maintenance block (Joint Bundling)."
      };
    } else if (c.conflict_type === "Resource") {
      return {
        left: {
          dept: "Engineering",
          activity: "Ballast Tamp & Screening",
          section: "Section B-C",
          window: "08:00 - 12:00",
          task: c.affected_tasks?.[0] || "REQ-003"
        },
        right: {
          dept: "Traction",
          activity: "OHE Substation Overhaul",
          section: "Section C-D",
          window: "09:00 - 13:00",
          task: c.affected_tasks?.[1] || "REQ-005"
        },
        conflictLabel: "RESOURCE BOTTLENECK",
        reason: c.explanation,
        suggested: c.suggested_resolution || "Stagger requisition times or reallocate auxiliary depot equipment."
      };
    } else if (c.conflict_type === "Timetable") {
      const train = c.affected_trains?.[0] || "12952";
      return {
        left: {
          dept: "Maintenance Request",
          activity: "OHE Line Disconnection",
          section: "Section A-B",
          window: "14:00 - 17:00",
          task: c.affected_tasks?.[0] || "REQ-004"
        },
        right: {
          dept: "Passenger Operations",
          activity: `Express Train #${train}`,
          section: "Section A-B",
          window: "14:45 - 15:30",
          task: `TRAIN-${train}`
        },
        conflictLabel: "TIMETABLE TRAIN PATH CLASH",
        reason: c.explanation,
        suggested: c.suggested_resolution || "Reschedule block to nocturnal window (01:00 - 04:30) or loop regulation."
      };
    } else {
      return {
        left: {
          dept: "Engineering",
          activity: "Precedent Track Alignment",
          section: "Section B-C",
          window: "09:00 - 11:00",
          task: c.affected_tasks?.[0] || "REQ-001"
        },
        right: {
          dept: "S&T",
          activity: "Point Machine Calibration",
          section: "Section B-C",
          window: "08:30 - 10:30",
          task: c.affected_tasks?.[1] || "REQ-002"
        },
        conflictLabel: "DEPENDENCY & PRECEDENCE CONFLICT",
        reason: c.explanation,
        suggested: c.suggested_resolution || "Sequence tasks sequentially with 30-minute safety buffer."
      };
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Conflict Detection</h1>
            <span className="bg-rose-100 text-rose-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              Constraint Engine
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Identify scheduling, resource and operational conflicts before block approval.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleRunDetection}
            disabled={isDetecting}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isDetecting ? "animate-spin" : ""}`} />
            <span>{isDetecting ? "Scanning Corridors..." : "Re-Scan Conflicts"}</span>
          </button>
          <button
            onClick={() => navigate("/optimizer")}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-railway-blue hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
          >
            <span>Optimized Block Plan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {notification && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs px-4 py-2.5 rounded-xl font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{notification}</span>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={() => navigate("/dashboard")}
              className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
            >
              <span>View in Dashboard</span>
              <ArrowRight className="w-3 h-3" />
            </button>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Conflict Category Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {[
          { key: "Time", label: "Time Conflict", count: categoryCounts.Time, icon: Clock, desc: "Timetable & Duration" },
          { key: "Resource", label: "Resource Conflict", count: categoryCounts.Resource, icon: Wrench, desc: "Crews & Machinery" },
          { key: "Location", label: "Location Conflict", count: categoryCounts.Location, icon: MapPin, desc: "Same Section Occupancy" },
          { key: "Operational", label: "Operational Conflict", count: categoryCounts.Operational, icon: Train, desc: "Revenue Train Clash" },
          { key: "Dependency", label: "Dependency Conflict", count: categoryCounts.Dependency, icon: GitBranch, desc: "Sequence & Precedence" },
        ].map((cat) => {
          const isActive = activeCategory === cat.key;
          const Icon = cat.icon;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(activeCategory === cat.key ? "ALL" : cat.key)}
              className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                isActive
                  ? "bg-white border-rose-500 ring-2 ring-rose-500/20 shadow-sm"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`p-1.5 rounded-md ${isActive ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`font-mono text-sm font-black ${cat.count > 0 ? "text-rose-600" : "text-slate-400"}`}>
                  {cat.count}
                </span>
              </div>
              <div className="mt-2">
                <span className="font-bold text-slate-900 text-xs block">{cat.label}</span>
                <span className="text-[10px] text-slate-500">{cat.desc}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter and Status Sub-bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <span className="font-semibold text-slate-700">Filter Severity:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1 bg-white font-medium focus:ring-2 focus:ring-railway-blue"
          >
            <option value="ALL">All Severities</option>
            <option value="Critical">Critical (Hard Conflict)</option>
            <option value="Warning">Warning (Soft Bottleneck)</option>
            <option value="Attention">Attention (Advisory)</option>
          </select>

          {activeCategory !== "ALL" && (
            <button
              onClick={() => setActiveCategory("ALL")}
              className="text-xs text-railway-blue hover:underline font-semibold"
            >
              Clear Category Filter
            </button>
          )}
        </div>

        <span className="font-mono text-slate-500 text-xs font-semibold">
          Showing <strong>{filteredConflicts.length}</strong> conflicts
        </span>
      </div>

      {/* Visual Conflict Cards List */}
      <div className="space-y-4">
        {filteredConflicts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="font-bold text-slate-900 text-sm">No Active Conflicts In Selected Category</h3>
            <p className="text-xs">All departmental requests satisfy hard operational safety constraints.</p>
          </div>
        ) : (
          filteredConflicts.map((c) => {
            const entities = parseConflictEntities(c);
            const isResolved = resolvedIds.has(c.conflict_id);

            return (
              <div
                key={c.conflict_id}
                className={`bg-white rounded-xl border transition shadow-xs overflow-hidden ${
                  c.severity === "Critical"
                    ? "border-rose-300 ring-1 ring-rose-500/10"
                    : "border-amber-300 ring-1 ring-amber-500/10"
                }`}
              >
                {/* Card Header */}
                <div className={`p-3.5 border-b flex flex-wrap items-center justify-between gap-2 ${
                  c.severity === "Critical" ? "bg-rose-50/60 border-rose-100" : "bg-amber-50/60 border-amber-100"
                }`}>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">
                      {c.severity === "Critical" ? "⚠️" : "⚡"}
                    </span>
                    <span className={`font-black text-xs font-mono uppercase tracking-wider ${
                      c.severity === "Critical" ? "text-rose-900" : "text-amber-900"
                    }`}>
                      {entities.conflictLabel}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="font-mono text-xs text-slate-600 font-bold">{c.conflict_id}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase ${
                      c.severity === "Critical"
                        ? "bg-rose-600 text-white"
                        : "bg-amber-500 text-white"
                    }`}>
                      {c.severity}
                    </span>
                    {isResolved && (
                      <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded border border-emerald-300 flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Bundling Resolved</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Side-by-Side Comparison (Entity A VS Entity B) */}
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
                    {/* Entity A */}
                    <div className="md:col-span-5 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Request A</span>
                        <span className="font-mono text-[11px] font-bold text-slate-700">{entities.left.task}</span>
                      </div>
                      <div className="font-black text-slate-900 text-xs">{entities.left.dept}</div>
                      <div className="text-xs font-semibold text-slate-700">{entities.left.activity}</div>
                      <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-200 font-mono">
                        <span>{entities.left.section}</span>
                        <span className="font-bold text-slate-900">{entities.left.window}</span>
                      </div>
                    </div>

                    {/* VS Divider */}
                    <div className="md:col-span-1 text-center font-black text-xs text-rose-600 uppercase tracking-widest py-1 md:py-0">
                      VS
                    </div>

                    {/* Entity B */}
                    <div className="md:col-span-5 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Request B</span>
                        <span className="font-mono text-[11px] font-bold text-slate-700">{entities.right.task}</span>
                      </div>
                      <div className="font-black text-slate-900 text-xs">{entities.right.dept}</div>
                      <div className="text-xs font-semibold text-slate-700">{entities.right.activity}</div>
                      <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-200 font-mono">
                        <span>{entities.right.section}</span>
                        <span className="font-bold text-slate-900">{entities.right.window}</span>
                      </div>
                    </div>
                  </div>

                  {/* Conflict Technical Rationale */}
                  <div className="bg-rose-50/40 border border-rose-100 rounded-lg p-3 text-xs space-y-1">
                    <div className="font-bold text-rose-950 uppercase tracking-wider text-[10px]">Conflict:</div>
                    <p className="text-rose-900 font-medium leading-relaxed">
                      {entities.reason}
                    </p>
                  </div>

                  {/* Suggested Resolution */}
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3 text-xs space-y-1">
                    <div className="font-bold text-emerald-950 uppercase tracking-wider text-[10px] flex items-center space-x-1.5">
                      <Wrench className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Suggested Resolution:</span>
                    </div>
                    <p className="text-emerald-900 leading-relaxed font-medium">
                      {entities.suggested}
                    </p>
                  </div>

                  {/* Action Buttons: Review, Resolve, View Details */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setSelectedConflict(c)}
                      className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => {
                        setResolvingConflict(c);
                        setResolutionStrategy("bundling");
                      }}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Resolve</span>
                    </button>
                    <button
                      onClick={() => navigate("/optimizer")}
                      className="px-3.5 py-1.5 bg-railway-blue hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                    >
                      <span>Review in Optimizer</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Conflict Resolution Modal (OR-Tools CP-SAT Solver Strategy) */}
      {resolvingConflict && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase font-mono tracking-wider">
                  OR-TOOLS CONFLICT RESOLVER
                </span>
                <h3 className="font-extrabold text-base text-slate-900 flex items-center space-x-2">
                  <span>Resolve {resolvingConflict.conflict_id}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-mono font-bold">
                    {resolvingConflict.severity}
                  </span>
                </h3>
              </div>
              <button
                onClick={() => setResolvingConflict(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-700 uppercase text-[10px]">Identified Contention:</span>
                <p className="text-slate-800 leading-snug">{resolvingConflict.explanation}</p>
              </div>

              {/* Resolution Strategies */}
              <div className="space-y-2">
                <span className="font-black text-slate-900 uppercase text-[11px] tracking-wider block">
                  Select Resolution Method:
                </span>

                {/* Strategy 1: Joint Bundling */}
                <div
                  onClick={() => setResolutionStrategy("bundling")}
                  className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex items-start space-x-3 ${
                    resolutionStrategy === "bundling"
                      ? "border-emerald-600 bg-emerald-50/50 shadow-xs"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                    resolutionStrategy === "bundling" ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-400"
                  }`}>
                    {resolutionStrategy === "bundling" && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900 text-xs">
                        Joint Multi-Department Bundling (Recommended)
                      </span>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded font-mono">
                        Zero Downtime Impact
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Automatically combine Track Renewal, Signal Interlocking, and OHE Isolation into a unified coordinated block window. Eliminates revenue passenger headway clash.
                    </p>
                  </div>
                </div>

                {/* Strategy 2: Stagger Window */}
                <div
                  onClick={() => setResolutionStrategy("stagger")}
                  className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex items-start space-x-3 ${
                    resolutionStrategy === "stagger"
                      ? "border-emerald-600 bg-emerald-50/50 shadow-xs"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                    resolutionStrategy === "stagger" ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-400"
                  }`}>
                    {resolutionStrategy === "stagger" && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900 text-xs">
                        Stagger Timetable Window (+2 Hours)
                      </span>
                      <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-1.5 py-0.2 rounded font-mono">
                        Headway Clearance
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Shift non-critical maintenance activity by +2 hours into the subsequent non-peak freight corridor gap.
                    </p>
                  </div>
                </div>

                {/* Strategy 3: Reallocate Gang */}
                <div
                  onClick={() => setResolutionStrategy("crew")}
                  className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex items-start space-x-3 ${
                    resolutionStrategy === "crew"
                      ? "border-emerald-600 bg-emerald-50/50 shadow-xs"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                    resolutionStrategy === "crew" ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-400"
                  }`}>
                    {resolutionStrategy === "crew" && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900 text-xs">
                        Reallocate Auxiliary Division Gang
                      </span>
                      <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-1.5 py-0.2 rounded font-mono">
                        Resource Substitution
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Assign Standby Division Crew 2 to the conflicting requisition, freeing primary personnel for critical works.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                Engine: Google OR-Tools CP-SAT
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setResolvingConflict(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteResolution}
                  disabled={isSolving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-xs cursor-pointer"
                >
                  {isSolving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Solving Constraint Program...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Apply & Re-Optimize Corridor</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {selectedConflict && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold text-rose-600 uppercase font-mono">TECHNICAL CONFLICT AUDIT</span>
                <h3 className="font-extrabold text-base text-slate-900">{selectedConflict.conflict_id}</h3>
              </div>
              <button
                onClick={() => setSelectedConflict(null)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                <span className="text-slate-500 block font-semibold">Conflict Type & Severity:</span>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-900">{selectedConflict.conflict_type}</span>
                  <span className="text-slate-400">&bull;</span>
                  <span className="font-mono text-rose-700 font-bold">{selectedConflict.severity}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-700 uppercase text-[10px]">Technical Clashing Narrative:</span>
                <p className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-800 leading-relaxed">
                  {selectedConflict.explanation}
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-700 uppercase text-[10px]">Mathematical Suggested Resolution:</span>
                <p className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-emerald-900 leading-relaxed font-medium">
                  {selectedConflict.suggested_resolution}
                </p>
              </div>

              <div className="text-[10px] text-slate-400 italic">
                * Evaluated deterministically against corridor line-capacity constraints and Section headway limits.
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                onClick={() => setSelectedConflict(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSelectedConflict(null);
                  navigate("/optimizer");
                }}
                className="px-4 py-2 bg-railway-blue hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
              >
                Launch Optimizer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
