import React, { createContext, useContext, useState } from "react";

export type DepartmentRole = "UNIFIED" | "OPERATING" | "ENGINEERING" | "ST" | "TRACTION";

export interface RoleDetail {
  id: DepartmentRole;
  title: string;
  shortTitle: string;
  designation: string;
  department: string | null;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  focusMetrics: string;
}

export const ROLE_CONFIGS: Record<DepartmentRole, RoleDetail> = {
  UNIFIED: {
    id: "UNIFIED",
    title: "Unified Division Planner",
    shortTitle: "Unified Planner",
    designation: "CPTM / JGM (Planning)",
    department: null,
    badgeBg: "bg-blue-500/20",
    badgeText: "text-blue-300",
    badgeBorder: "border-blue-500/30",
    focusMetrics: "Cross-departmental schedule & multi-objective CP-SAT balance"
  },
  OPERATING: {
    id: "OPERATING",
    title: "Operating & Traffic Control",
    shortTitle: "Operating (CTNL)",
    designation: "Chief Train Controller (CTNL)",
    department: null,
    badgeBg: "bg-rose-500/20",
    badgeText: "text-rose-300",
    badgeBorder: "border-rose-500/30",
    focusMetrics: "Train punctuality, Shatabdi/Rajdhani headway & block sanctions"
  },
  ENGINEERING: {
    id: "ENGINEERING",
    title: "Civil Track Engineering",
    shortTitle: "Engineering (Track)",
    designation: "Sr. DEN (Track / P-Way)",
    department: "Engineering",
    badgeBg: "bg-sky-500/20",
    badgeText: "text-sky-300",
    badgeBorder: "border-sky-500/30",
    focusMetrics: "Tamping machines, USFD rail flaw tests & deep screening"
  },
  ST: {
    id: "ST",
    title: "Signal & Telecommunication",
    shortTitle: "S&T (Signals)",
    designation: "Sr. DSTE (Signals)",
    department: "S&T",
    badgeBg: "bg-purple-500/20",
    badgeText: "text-purple-300",
    badgeBorder: "border-purple-500/30",
    focusMetrics: "Point machines, electronic interlocking & axle counters"
  },
  TRACTION: {
    id: "TRACTION",
    title: "Traction Distribution (TRD)",
    shortTitle: "Traction (TRD)",
    designation: "Sr. DEE (TRD / Power)",
    department: "Traction",
    badgeBg: "bg-amber-500/20",
    badgeText: "text-amber-300",
    badgeBorder: "border-amber-500/30",
    focusMetrics: "25kV OHE catenary wire tension, power blocks & isolator testing"
  }
};

interface PlanningContextType {
  role: string;
  setRole: (role: string) => void;
  departmentRole: DepartmentRole;
  setDepartmentRole: (role: DepartmentRole) => void;
  activeRoleDetail: RoleDetail;
  period: string;
  setPeriod: (period: string) => void;
  corridor: string;
  setCorridor: (corridor: string) => void;
  syncNotice: string | null;
  setSyncNotice: (notice: string | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
}

const PlanningContext = createContext<PlanningContextType | undefined>(undefined);

export const PlanningProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [departmentRole, setDepartmentRoleState] = useState<DepartmentRole>(() => {
    const saved = localStorage.getItem("railoptiblock_department_role");
    return (saved as DepartmentRole) || "UNIFIED";
  });

  const [role, setRole] = useState(ROLE_CONFIGS[departmentRole].designation);
  const [period, setPeriod] = useState("Week 38 (18 - 24 Sep 2026)");
  const [corridor, setCorridor] = useState("Mainline Corridor Alpha (Sec A-D)");
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const setDepartmentRole = (newRole: DepartmentRole) => {
    setDepartmentRoleState(newRole);
    setRole(ROLE_CONFIGS[newRole].designation);
    localStorage.setItem("railoptiblock_department_role", newRole);
    setSyncNotice(`Switched perspective to: ${ROLE_CONFIGS[newRole].title} (${ROLE_CONFIGS[newRole].designation})`);
    setTimeout(() => setSyncNotice(null), 3500);
  };

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  const activeRoleDetail = ROLE_CONFIGS[departmentRole];

  return (
    <PlanningContext.Provider
      value={{
        role,
        setRole,
        departmentRole,
        setDepartmentRole,
        activeRoleDetail,
        period,
        setPeriod,
        corridor,
        setCorridor,
        syncNotice,
        setSyncNotice,
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar,
      }}
    >
      {children}
    </PlanningContext.Provider>
  );
};

export const usePlanning = () => {
  const context = useContext(PlanningContext);
  if (!context) {
    throw new Error("usePlanning must be used within a PlanningProvider");
  }
  return context;
};
