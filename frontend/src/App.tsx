import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AdminRoute } from "./components/auth/AdminRoute";
import { AppShell } from "./components/layout/AppShell";

// Auth pages
import { Login } from "./pages/Login";
import { GoogleCallback } from "./pages/auth/GoogleCallback";

// Operator pages
import { Dashboard } from "./pages/operator/Dashboard";
import { NewProject } from "./pages/operator/NewProject";
import { ProjectDetail } from "./pages/operator/ProjectDetail";
import { JobStatus } from "./pages/operator/JobStatus";
import { PageIndex } from "./pages/operator/PageIndex";
import { ReviewEdit } from "./pages/operator/ReviewEdit";
import { MeasurementTool } from "./pages/operator/MeasurementTool";
import { PricingReview } from "./pages/operator/PricingReview";
import { Results } from "./pages/operator/Results";

// Admin pages
import { AdminOverview } from "./pages/admin/AdminOverview";
import { PricebookList } from "./pages/admin/PricebookList";
import { RulesEditor } from "./pages/admin/RulesEditor";
import { TemplateConfig } from "./pages/admin/TemplateConfig";
import { SystemHealth } from "./pages/admin/SystemHealth";
import { AuditLog } from "./pages/admin/AuditLog";
import { UserManagement } from "./pages/admin/UserManagement";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes (no sidebar) */}
            <Route path="/login" element={<Login />} />
            <Route path="/auth/google/callback" element={<GoogleCallback />} />

            {/* Protected routes (require login) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                {/* Operator */}
                <Route path="/" element={<Dashboard />} />
                <Route path="/projects" element={<Navigate to="/" replace />} />
                <Route path="/projects/new" element={<NewProject />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/jobs" element={<Navigate to="/" replace />} />
                <Route path="/jobs/:id" element={<JobStatus />} />
                <Route path="/jobs/:id/pages" element={<PageIndex />} />
                <Route path="/jobs/:id/review" element={<ReviewEdit />} />
                <Route path="/jobs/:id/measure" element={<Navigate to="1" replace />} />
                <Route path="/jobs/:id/measure/:pageNum" element={<MeasurementTool />} />
                <Route path="/jobs/:id/pricing" element={<PricingReview />} />
                <Route path="/jobs/:id/results" element={<Results />} />

                {/* Admin (requires ADMIN role) */}
                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<AdminOverview />} />
                  <Route path="/admin/pricebook" element={<PricebookList />} />
                  <Route path="/admin/pricebook/:id" element={<RulesEditor />} />
                  <Route path="/admin/templates" element={<TemplateConfig />} />
                  <Route path="/admin/system" element={<SystemHealth />} />
                  <Route path="/admin/audit" element={<AuditLog />} />
                  <Route path="/admin/users" element={<UserManagement />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
