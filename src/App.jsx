// Versión completa: Google Drive, historial de presupuestos, responsive (v3.0 modular)
// Canonical Calculadora component: PanelinCalculadoraV3_backup (see docs/bmc-dashboard-modernization/IA.md)
import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { getRouterBasename } from "./utils/routerBasename.js";
import LegacyAppQueryRedirect from "./components/LegacyAppQueryRedirect.jsx";
// BmcModuleNav stays eager — it renders inside <Shell> on every non-calc route,
// so lazy-loading would just add an extra waterfall step with zero saved bytes.
import BmcModuleNav from "./components/BmcModuleNav.jsx";
import { onLCP, onINP, onCLS } from "web-vitals";
import { BmcAuthProvider } from "./contexts/BmcAuthProvider.jsx";
import AuthGateModal from "./components/auth/AuthGateModal.jsx";
import AuthHeader from "./components/auth/AuthHeader.jsx";

// Code-split per route. Users landing on / (calculator, the main entry) don't
// pay for the /hub/* module bundles until they navigate there.
const PanelinCalculadora = lazy(() => import("./components/PanelinCalculadoraV3_backup.jsx"));
const BmcLogisticaApp = lazy(() => import("./components/BmcLogisticaApp.jsx"));
const DriverTransportistaApp = lazy(() => import("./components/DriverTransportistaApp.jsx"));
const SpecManagementSandbox = lazy(() => import("./components/SpecManagementSandbox.jsx"));
const BidPresentation = lazy(() => import("./components/BidPresentation.jsx"));
const CalcLogicInspector = lazy(() => import("./components/CalcLogicInspector.jsx"));
const FichasPreview = lazy(() => import("./components/FichasPreview.jsx"));
const BmcWolfboardHub = lazy(() => import("./components/BmcWolfboardHub.jsx"));
const BmcMlOperativoModule = lazy(() => import("./components/BmcMlOperativoModule.jsx"));
const BmcWaModuleWithTabs = lazy(() => import("./components/BmcWaModuleWithTabs.jsx"));
const BmcCanalesUnificadosModule = lazy(() => import("./components/BmcCanalesUnificadosModule.jsx"));
const BmcAdminCotizacionesModule = lazy(() => import("./components/BmcAdminCotizacionesModule.jsx"));
const BmcPlanImportModule = lazy(() => import("./components/BmcPlanImportModule.jsx"));
const AgentAdminModule = lazy(() => import("./components/AgentAdminModule.jsx"));
const MySpacePage = lazy(() => import("./components/MySpacePage.jsx"));
const DashboardShell = lazy(() => import("./features/dashboard/DashboardShell.jsx"));

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
  const { pathname } = useLocation();
  const isCalc = pathname === "/" || pathname === "/calculadora";
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#F5F5F7",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 16,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <AuthHeader />
      </div>
      {!isCalc && <BmcModuleNav />}
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

function sendVitals(metric) {
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/vitals", JSON.stringify({ name: metric.name, value: metric.value, rating: metric.rating, id: metric.id }));
  }
}

export default function App() {
  const basename = getRouterBasename();

  useEffect(() => {
    onLCP(sendVitals);
    onINP(sendVitals);
    onCLS(sendVitals);
  }, []);

  return (
    <BrowserRouter basename={basename} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <BmcAuthProvider>
      <LegacyAppQueryRedirect />
      <AuthGateModal />
      <Routes>
        <Route path="/hub" element={<Suspense fallback={suspenseFallback}><BmcWolfboardHub /></Suspense>} />
        <Route
          path="/hub/ml"
          element={
            <Shell>
              <Suspense fallback={suspenseFallback}>
                <BmcMlOperativoModule />
              </Suspense>
            </Shell>
          }
        />
        <Route
          path="/hub/wa"
          element={
            <Shell>
              <Suspense fallback={suspenseFallback}>
                <BmcWaModuleWithTabs />
              </Suspense>
            </Shell>
          }
        />
        <Route
          path="/hub/canales"
          element={
            <Shell>
              <Suspense fallback={suspenseFallback}>
                <BmcCanalesUnificadosModule />
              </Suspense>
            </Shell>
          }
        />
        <Route
          path="/hub/admin"
          element={
            <Shell>
              <Suspense fallback={suspenseFallback}>
                <BmcAdminCotizacionesModule />
              </Suspense>
            </Shell>
          }
        />
        <Route path="/hub/plan-import" element={<Suspense fallback={suspenseFallback}><BmcPlanImportModule /></Suspense>} />
        <Route path="/mi-espacio" element={<Shell><Suspense fallback={suspenseFallback}><MySpacePage /></Suspense></Shell>} />
        <Route path="/hub/agent-admin" element={<Suspense fallback={suspenseFallback}><AgentAdminModule /></Suspense>} />
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
        <Route
          path="/inspector"
          element={
            <Shell>
              <Suspense fallback={suspenseFallback}>
                <CalcLogicInspector />
              </Suspense>
            </Shell>
          }
        />
        <Route
          path="/especificaciones"
          element={
            <Shell>
              <Suspense fallback={suspenseFallback}>
                <SpecManagementSandbox />
              </Suspense>
            </Shell>
          }
        />
        <Route
          path="/presentacion-licitacion"
          element={
            <Shell>
              <Suspense fallback={suspenseFallback}>
                <BidPresentation />
              </Suspense>
            </Shell>
          }
        />
        <Route
          path="/fichas"
          element={
            <Suspense fallback={suspenseFallback}>
              <FichasPreview />
            </Suspense>
          }
        />
        <Route
          path="/dashboard/*"
          element={
            <Suspense fallback={suspenseFallback}>
              <DashboardShell />
            </Suspense>
          }
        />
        <Route path="/wa" element={<Navigate to="/hub/wa" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </BmcAuthProvider>
    </BrowserRouter>
  );
}
