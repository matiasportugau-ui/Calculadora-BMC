// Versión completa: Google Drive, historial de presupuestos, responsive (v3.0 modular)
// Canonical Calculadora component: PanelinCalculadoraV3_backup (see docs/bmc-dashboard-modernization/IA.md)
import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getRouterBasename } from "./utils/routerBasename.js";
import LegacyAppQueryRedirect from "./components/LegacyAppQueryRedirect.jsx";
import BmcModuleNav from "./components/BmcModuleNav.jsx";
import BmcWolfboardHub from "./components/BmcWolfboardHub.jsx";

const PanelinCalculadora = lazy(() => import("./components/PanelinCalculadoraV3_backup.jsx"));
const BmcLogisticaApp = lazy(() => import("./components/BmcLogisticaApp.jsx"));
const DriverTransportistaApp = lazy(() => import("./components/DriverTransportistaApp.jsx"));

const suspenseFallback = (
  <div
    style={{
      padding: 24,
      fontFamily: "system-ui, sans-serif",
      textAlign: "center",
      color: "#555",
    }}
  >
    Cargando…
  </div>
);

function Shell({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#F5F5F7",
      }}
    >
      <BmcModuleNav />
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

export default function App() {
  const basename = getRouterBasename();

  return (
    <BrowserRouter basename={basename}>
      <LegacyAppQueryRedirect />
      <Routes>
        <Route path="/hub" element={<BmcWolfboardHub />} />
        <Route
          path="/"
          element={
            <Shell>
              <Suspense fallback={suspenseFallback}>
                <PanelinCalculadora />
              </Suspense>
            </Shell>
          }
        />
        <Route
          path="/calculadora"
          element={
            <Shell>
              <Suspense fallback={suspenseFallback}>
                <PanelinCalculadora />
              </Suspense>
            </Shell>
          }
        />
        <Route
          path="/logistica"
          element={
            <Shell>
              <Suspense fallback={suspenseFallback}>
                <BmcLogisticaApp />
              </Suspense>
            </Shell>
          }
        />
        <Route
          path="/conductor"
          element={
            <Shell>
              <Suspense fallback={suspenseFallback}>
                <DriverTransportistaApp />
              </Suspense>
            </Shell>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
