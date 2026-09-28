import React from "react";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor?: "blue" | "red" | "emerald" | "amber" | "purple";
  badge?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  accentColor = "blue",
  badge
}) => {
  const borderStyles: Record<string, string> = {
    blue: "border-l-4 border-l-railway-blue",
    red: "border-l-4 border-l-rose-500",
    emerald: "border-l-4 border-l-emerald-600",
    amber: "border-l-4 border-l-amber-500",
    purple: "border-l-4 border-l-purple-600"
  };

  const iconStyles: Record<string, string> = {
    blue: "bg-blue-50 text-railway-blue",
    red: "bg-rose-50 text-rose-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600"
  };

  return (
    <div className={`bg-white rounded-lg p-4 shadow-sm border border-slate-200 ${borderStyles[accentColor]} flex flex-col justify-between hover:shadow transition`}>
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{value}</div>
        </div>
        <div className={`p-2.5 rounded-lg ${iconStyles[accentColor]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {(subtitle || badge) && (
        <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
          <span>{subtitle}</span>
          {badge && (
            <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
              {badge}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
