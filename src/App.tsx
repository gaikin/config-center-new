import { Suspense, lazy } from "react";
import { Spin } from "antd";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";

const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const PageResourcesPage = lazy(() =>
  import("./pages/PageResourcesPage").then((m) => ({ default: m.PageResourcesPage }))
);
const RulesPage = lazy(() => import("./pages/RulesPage").then((m) => ({ default: m.RulesPage })));
const JobScenesPage = lazy(() => import("./pages/JobScenesPage").then((m) => ({ default: m.JobScenesPage })));
const InterfacesPage = lazy(() => import("./pages/InterfacesPage").then((m) => ({ default: m.InterfacesPage })));
const PreprocessorsPage = lazy(() =>
  import("./pages/PreprocessorsPage").then((m) => ({ default: m.PreprocessorsPage }))
);
const GovernancePage = lazy(() => import("./pages/GovernancePage").then((m) => ({ default: m.GovernancePage })));
const AuditMetricsPage = lazy(() =>
  import("./pages/AuditMetricsPage").then((m) => ({ default: m.AuditMetricsPage }))
);
const RolesPage = lazy(() => import("./pages/RolesPage").then((m) => ({ default: m.RolesPage })));

export default function App() {
  return (
    <AppShell>
      <Suspense fallback={<Spin style={{ margin: "24px 0" }} />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/page-resources" element={<PageResourcesPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/job-scenes" element={<JobScenesPage />} />
          <Route path="/interfaces" element={<InterfacesPage />} />
          <Route path="/preprocessors" element={<PreprocessorsPage />} />
          <Route path="/governance" element={<GovernancePage />} />
          <Route path="/audit-metrics" element={<AuditMetricsPage />} />
          <Route path="/roles" element={<RolesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
