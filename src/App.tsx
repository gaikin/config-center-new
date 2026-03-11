import { Suspense, lazy } from "react";
import { Spin } from "antd";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";

const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const RuleWizardPage = lazy(() => import("./pages/RuleWizardPage").then((m) => ({ default: m.RuleWizardPage })));
const TemplateCenterPage = lazy(() =>
  import("./pages/TemplateCenterPage").then((m) => ({ default: m.TemplateCenterPage }))
);
const MenuScopesPage = lazy(() => import("./pages/MenuScopesPage").then((m) => ({ default: m.MenuScopesPage })));
const InterfacesPage = lazy(() => import("./pages/InterfacesPage").then((m) => ({ default: m.InterfacesPage })));
const HintsPage = lazy(() => import("./pages/HintsPage").then((m) => ({ default: m.HintsPage })));
const OrchestrationsPage = lazy(() =>
  import("./pages/OrchestrationsPage").then((m) => ({ default: m.OrchestrationsPage }))
);
const PluginSdkPage = lazy(() => import("./pages/PluginSdkPage").then((m) => ({ default: m.PluginSdkPage })));

export default function App() {
  return (
    <AppShell>
      <Suspense fallback={<Spin style={{ margin: "24px 0" }} />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/wizard" element={<RuleWizardPage />} />
          <Route path="/templates" element={<TemplateCenterPage />} />
          <Route path="/scopes" element={<MenuScopesPage />} />
          <Route path="/interfaces" element={<InterfacesPage />} />
          <Route path="/hints" element={<HintsPage />} />
          <Route path="/orchestrations" element={<OrchestrationsPage />} />
          <Route path="/plugin-sdk" element={<PluginSdkPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
