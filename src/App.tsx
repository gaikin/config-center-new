import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { HintsPage } from "./pages/HintsPage";
import { InterfacesPage } from "./pages/InterfacesPage";
import { MenuScopesPage } from "./pages/MenuScopesPage";
import { OrchestrationsPage } from "./pages/OrchestrationsPage";
import { PluginSdkPage } from "./pages/PluginSdkPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/scopes" element={<MenuScopesPage />} />
        <Route path="/interfaces" element={<InterfacesPage />} />
        <Route path="/hints" element={<HintsPage />} />
        <Route path="/orchestrations" element={<OrchestrationsPage />} />
        <Route path="/plugin-sdk" element={<PluginSdkPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
