import { Suspense, lazy } from "react";
import { Spin } from "antd";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";

const DashboardPage = lazy(() =>
  import("./pages/DashboardPage/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const PageResourcesPage = lazy(() =>
  import("./pages/PageResourcesPage/PageResourcesPage").then((m) => ({ default: m.PageResourcesPage }))
);
const RulesPage = lazy(() => import("./pages/RulesPage/RulesPage").then((m) => ({ default: m.RulesPage })));
const JobScenesPage = lazy(() =>
  import("./pages/JobScenesPage/JobScenesPage").then((m) => ({ default: m.JobScenesPage }))
);
const InterfacesPage = lazy(() =>
  import("./pages/InterfacesPage/InterfacesPage").then((m) => ({ default: m.InterfacesPage }))
);
const PreprocessorsPage = lazy(() =>
  import("./pages/PreprocessorsPage/PreprocessorsPage").then((m) => ({ default: m.PreprocessorsPage }))
);
const GovernancePage = lazy(() =>
  import("./pages/GovernancePage/GovernancePage").then((m) => ({ default: m.GovernancePage }))
);
const AuditMetricsPage = lazy(() =>
  import("./pages/AuditMetricsPage/AuditMetricsPage").then((m) => ({ default: m.AuditMetricsPage }))
);
const RolesPage = lazy(() => import("./pages/RolesPage/RolesPage").then((m) => ({ default: m.RolesPage })));

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
