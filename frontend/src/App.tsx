import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import { PlanningProvider } from "./context/PlanningContext";
import { Layout } from "./layouts/Layout";

// Pages
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ProfilePage } from "./pages/ProfilePage";
import { DashboardPage } from "./pages/DashboardPage";
import { MaintenanceRequestsPage } from "./pages/MaintenanceRequestsPage";
import { AssetsPage } from "./pages/AssetsPage";
import { BlockWindowsPage } from "./pages/BlockWindowsPage";
import { TimetablePage } from "./pages/TimetablePage";
import { ConflictDetectionPage } from "./pages/ConflictDetectionPage";
import { OptimisationResultsPage } from "./pages/OptimisationResultsPage";
import { WeeklyPlanPage } from "./pages/WeeklyPlanPage";
import { MonthlyPlanPage } from "./pages/MonthlyPlanPage";
import { ExecutionPage } from "./pages/ExecutionPage";
import { ExplainabilityPage } from "./pages/ExplainabilityPage";
import { ApprovalPage } from "./pages/ApprovalPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AuditHistoryPage } from "./pages/AuditHistoryPage";
import { BlockPlanningWorkspacePage } from "./pages/BlockPlanningWorkspacePage";
import { WhatIfSimulationPage } from "./pages/WhatIfSimulationPage";
import { DataSourcesPage } from "./pages/DataSourcesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AdminPage } from "./pages/AdminPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30, // 30 seconds
      retry: 1
    }
  }
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PlanningProvider>
          <BrowserRouter>
            <Routes>
              {/* Standalone Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Main Application Layout */}
              <Route path="/" element={<Layout />}>
                <Route index element={<LandingPage />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="profile" element={<ProfilePage />} />

                {/* Core Operations */}
                <Route path="requests" element={<MaintenanceRequestsPage />} />
                <Route path="maintenance" element={<MaintenanceRequestsPage />} />
                <Route path="assets" element={<AssetsPage />} />
                <Route path="block-windows" element={<BlockWindowsPage />} />
                <Route path="timetable" element={<TimetablePage />} />

                {/* Optimization & Decision Suite */}
                <Route path="conflicts" element={<ConflictDetectionPage />} />
                <Route path="optimizer" element={<OptimisationResultsPage />} />
                <Route path="optimisation" element={<OptimisationResultsPage />} />
                <Route path="optimization" element={<OptimisationResultsPage />} />
                <Route path="plans" element={<OptimisationResultsPage />} />
                <Route path="plans/weekly" element={<WeeklyPlanPage />} />
                <Route path="plans/monthly" element={<MonthlyPlanPage />} />
                <Route path="approval" element={<ApprovalPage />} />
                <Route path="explainability" element={<ExplainabilityPage />} />

                {/* Live Monitoring & Analytics */}
                <Route path="execution" element={<ExecutionPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="simulation" element={<WhatIfSimulationPage />} />
                <Route path="workspace" element={<BlockPlanningWorkspacePage />} />
                <Route path="audit" element={<AuditHistoryPage />} />
                <Route path="audit-history" element={<AuditHistoryPage />} />
                <Route path="data-sources" element={<DataSourcesPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="admin" element={<AdminPage />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </PlanningProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
