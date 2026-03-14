import { Spin } from "antd";
import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";

const DashboardPage = lazy(() =>
  import("./pages/DashboardPage/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const PageManagementPage = lazy(() =>
  import("./pages/PageManagementPage/PageManagementPage").then((m) => ({ default: m.PageManagementPage }))
);
const PromptsPage = lazy(() =>
  import("./pages/PromptsPage/PromptsPage").then((m) => ({ default: m.PromptsPage }))
);
const JobScenesPage = lazy(() =>
  import("./pages/JobScenesPage/JobScenesPage").then((m) => ({ default: m.JobScenesPage }))
);
const InterfacesPage = lazy(() =>
  import("./pages/InterfacesPage/InterfacesPage").then((m) => ({ default: m.InterfacesPage }))
);
const GovernancePage = lazy(() =>
  import("./pages/GovernancePage/GovernancePage").then((m) => ({ default: m.GovernancePage }))
);
const AuditMetricsPage = lazy(() =>
  import("./pages/AuditMetricsPage/AuditMetricsPage").then((m) => ({ default: m.AuditMetricsPage }))
);
const AdvancedConfigPage = lazy(() =>
  import("./pages/AdvancedConfigPage/AdvancedConfigPage").then((m) => ({ default: m.AdvancedConfigPage }))
);

export default function App() {
  return (
    <AppShell>
      <Suspense fallback={<Spin style={{ margin: "24px 0" }} />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/page-management" element={<PageManagementPage />} />
          <Route path="/prompts" element={<PromptsPage />} />
          <Route path="/jobs" element={<JobScenesPage />} />
          <Route path="/interfaces" element={<InterfacesPage />} />
          <Route path="/publish" element={<GovernancePage />} />
          <Route path="/stats" element={<AuditMetricsPage />} />
          <Route path="/advanced" element={<AdvancedConfigPage />} />

          <Route path="/page-resources" element={<Navigate to="/page-management" replace />} />
          <Route path="/page-activation" element={<Navigate to="/page-management" replace />} />
          <Route path="/rules" element={<Navigate to="/prompts" replace />} />
          <Route path="/rule-templates" element={<Navigate to="/prompts" replace />} />
          <Route path="/job-scenes" element={<Navigate to="/jobs" replace />} />
          <Route path="/sdk-version-center" element={<Navigate to="/publish" replace />} />
          <Route path="/governance" element={<Navigate to="/publish" replace />} />
          <Route path="/audit-metrics" element={<Navigate to="/stats" replace />} />
          <Route path="/preprocessors" element={<Navigate to="/advanced" replace />} />
          <Route path="/roles" element={<Navigate to="/advanced" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
