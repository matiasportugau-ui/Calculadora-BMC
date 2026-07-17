// Versión completa: Google Drive, historial de presupuestos, responsive (v3.0 modular)
// Canonical Calculadora component: PanelinCalculadoraV3_backup (see docs/bmc-dashboard-modernization/IA.md)
import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { getRouterBasename } from "./utils/routerBasename.js";
import LegacyAppQueryRedirect from "./components/LegacyAppQueryRedirect.jsx";
// BmcModuleNav stays eager — it renders inside <Shell> on every non-calc route,
// so lazy-loading would just add an extra waterfall step with zero saved bytes.
import BmcModuleNav from "./components/BmcModuleNav.jsx";
import { onLCP, onINP, onCLS } from "web-vitals";
import { BmcAuthProvider } from "./contexts/BmcAuthProvider.jsx";
import AuthGateModal from "./components/auth/AuthGateModal.jsx";
import AuthHeader from "./components/auth/AuthHeader.jsx";
import RequireGrant from "./components/auth/RequireGrant.jsx";
import ActivityTracker from "./components/activity/ActivityTracker.jsx";
import RouteErrorBoundary from "./components/RouteErrorBoundary.jsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Tutorial interactivo (nuevo sistema) — gated for safety
const TUTORIAL_ENABLED = import.meta.env.VITE_FEATURE_TUTORIAL_MODE !== "false";

import { TutorialProvider } from "./components/tutorial/TutorialProvider.jsx";
import TutorialOverlay from "./components/tutorial/TutorialOverlay.jsx";
import FloatingTutorialButton from "./components/tutorial/FloatingTutorialButton.jsx";
import BmcChatPanel from "./components/BmcChatPanel.jsx";
import DesignPreviewGate from "./components/preview/DesignPreviewGate.jsx";

const DesignMockupsPage = lazy(() => import("./components/preview/DesignMockupsPage.jsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
    mutations: { retry: 0 },
  },
});

// Code-split per route. Users landing on / (calculator, the main entry) don't
// pay for the /hub/* module bundles until they navigate there.
const PanelinCalculadora = lazy(() => import("./components/PanelinCalculadoraV3_backup.jsx"));
const PanelinLivePage = lazy(() => import("./components/PanelinLivePage.jsx"));
const LandingPage = lazy(() => import("./components/LandingPage.jsx"));
const BmcLogisticaApp = lazy(() => import("./components/BmcLogisticaApp.jsx"));
const DriverTransportistaApp = lazy(() => import("./components/DriverTransportistaApp.jsx"));
const SpecManagementSandbox = lazy(() => import("./components/SpecManagementSandbox.jsx"));
const BidPresentation = lazy(() => import("./components/BidPresentation.jsx"));
const CalcLogicInspector = lazy(() => import("./components/CalcLogicInspector.jsx"));
const FichasPreview = lazy(() => import("./components/FichasPreview.jsx"));
const PdfPreview = lazy(() => import("./components/PdfPreview.jsx"));
const BmcWolfboardHub = lazy(() => import("./components/BmcWolfboardHub.jsx"));
const BmcMlOperativoModule = lazy(() => import("./components/BmcMlOperativoModule.jsx"));
const BmcWaModuleWithTabs = lazy(() => import("./components/BmcWaModuleWithTabs.jsx"));
const BmcCanalesUnificadosModule = lazy(() => import("./components/hub/canales/CanalesModule.jsx"));
const BmcAdminCotizacionesModule = lazy(() => import("./components/BmcAdminCotizacionesModule.jsx"));
const AdminCotizacionesModule = lazy(() => import("./components/AdminCotizacionesModule.jsx"));
const AdminIngresoModule = lazy(() => import("./components/AdminIngresoModule.jsx"));
const BugReportsList = lazy(() => import("./components/BugReportsList.jsx"));
const BmcPlanosModule = lazy(() => import("./components/BmcPlanosModule.jsx"));
const AgentAdminModule = lazy(() => import("./components/AgentAdminModule.jsx"));
const MySpacePage = lazy(() => import("./components/MySpacePage.jsx"));
const TraKtiMeModule = lazy(() => import("./components/traktime/TraKtiMeModule.jsx"));
const FinanzasModule = lazy(() => import("./components/hub/finanzas/FinanzasModule.jsx"));
const MarketingHubModule = lazy(() => import("./components/MarketingHubModule.jsx"));
const TasksModule = lazy(() => import("./components/hub/tasks/TasksModule.jsx"));
const ClientesMVP = lazy(() => import("./components/hub/clientes/ClientesMVP.jsx"));
const ProyectoStatusModule = lazy(() => import("./components/hub/proyecto/ProyectoStatusModule.jsx"));
const UserAdminModule = lazy(() => import("./components/admin/users/UserAdminModule.jsx"));
const AnalyticsModule = lazy(() => import("./components/admin/analytics/AnalyticsModule.jsx"));
const AssistantsStatusPanel = lazy(() => import("./components/hub/admin/AssistantsStatusPanel.jsx"));
const MlManagerModule = lazy(() => import("./components/hub/ml/MlManagerModule.jsx"));

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
      className="bmc-app-shell"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--g-bg-page, var(--bmc-bg, #F5F5F7))",
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
      {TUTORIAL_ENABLED && <FloatingTutorialButton />}
      <BmcChatPanel />
    </div>
  );
}

function sendVitals(metric) {
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/vitals", JSON.stringify({ name: metric.name, value: metric.value, rating: metric.rating, id: metric.id }));
  }
}

// `?legacy=1` bypasses the redirect so operators can still reach the old
// module while the flag is on (transitional escape hatch wired from the
// new module's topbar / palette).
function AdminRoute() {
  const [params] = useSearchParams();
  const flagOn = import.meta.env.VITE_FEATURE_ADMIN_COT_V2 === "true";
  if (flagOn && params.get("legacy") !== "1") {
    return <Navigate to="/hub/cotizaciones" replace />;
  }
  return (
    <Shell>
      <Suspense fallback={suspenseFallback}>
        <BmcAdminCotizacionesModule />
      </Suspense>
    </Shell>
  );
}

function CotizacionesRoute() {
  if (import.meta.env.VITE_FEATURE_ADMIN_COT_V2 !== "true") {
    return <Navigate to="/hub/admin" replace />;
  }
  return (
    <Shell>
      <Suspense fallback={suspenseFallback}>
        <AdminCotizacionesModule />
      </Suspense>
    </Shell>
  );
}

// Lives inside <BrowserRouter> so it can read the active pathname and feed it
// to the boundary as a reset key: a render error in one module shows a
// recoverable fallback, and navigating elsewhere clears it without a reload.
function RoutedErrorBoundary({ children }) {
  const location = useLocation();
  return (
    <RouteErrorBoundary resetKey={location.pathname}>
      {children}
    </RouteErrorBoundary>
  );
}

export default function App() {
  const basename = getRouterBasename();

  useEffect(() => {
    onLCP(sendVitals);
    onINP(sendVitals);
    onCLS(sendVitals);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
    <BrowserRouter basename={basename} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DesignPreviewGate>
      <BmcAuthProvider>
      <TutorialProvider>
      <ActivityTracker />
      <LegacyAppQueryRedirect />
      <AuthGateModal />
      <TutorialOverlay />
      <RoutedErrorBoundary>
      <Routes>
        <Route
          path="/hub"
          element={
            <RequireGrant>
              <Suspense fallback={suspenseFallback}>
                <BmcWolfboardHub />
              </Suspense>
            </RequireGrant>
          }
        />
        <Route
          path="/hub/ml"
          element={
            <Shell>
              <RequireGrant module="canales" minLevel="read">
                <Suspense fallback={suspenseFallback}>
                  <BmcMlOperativoModule />
                </Suspense>
              </RequireGrant>
            </Shell>
          }
        />
        <Route
          path="/hub/ml-manager"
          element={
            <Shell>
              <RequireGrant module="canales" minLevel="read">
                <Suspense fallback={suspenseFallback}>
                  <MlManagerModule />
                </Suspense>
              </RequireGrant>
            </Shell>
          }
        />
        <Route
          path="/hub/wa"
          element={
            <Shell>
              <RequireGrant module="wa" minLevel="read">
                <Suspense fallback={suspenseFallback}>
                  <BmcWaModuleWithTabs />
                </Suspense>
              </RequireGrant>
            </Shell>
          }
        />
        <Route
          path="/hub/canales"
          element={
            <Shell>
              <RequireGrant module="canales" minLevel="read">
                <Suspense fallback={suspenseFallback}>
                  <BmcCanalesUnificadosModule />
                </Suspense>
              </RequireGrant>
            </Shell>
          }
        />
        <Route
          path="/hub/tareas"
          element={
            <Shell>
              <RequireGrant module="tareas" minLevel="read">
                <Suspense fallback={suspenseFallback}>
                  <TasksModule />
                </Suspense>
              </RequireGrant>
            </Shell>
          }
        />
        <Route
          path="/hub/clientes"
          element={
            <Shell>
              <RequireGrant module="clientes" minLevel="read">
                <Suspense fallback={suspenseFallback}>
                  <ClientesMVP />
                </Suspense>
              </RequireGrant>
            </Shell>
          }
        />
        <Route
          path="/hub/proyecto"
          element={
            <Shell>
              <RequireGrant module="proyecto" minLevel="read">
                <Suspense fallback={suspenseFallback}>
                  <ProyectoStatusModule />
                </Suspense>
              </RequireGrant>
            </Shell>
          }
        />
        <Route
          path="/hub/admin"
          element={
            <RequireGrant role="admin">
              <AdminRoute />
            </RequireGrant>
          }
        />
        <Route
          path="/hub/admin/users"
          element={
            <RequireGrant role="admin">
              <Suspense fallback={suspenseFallback}>
                <UserAdminModule />
              </Suspense>
            </RequireGrant>
          }
        />
        <Route
          path="/hub/admin/analytics"
          element={
            <RequireGrant role="admin">
              <Suspense fallback={suspenseFallback}>
                <AnalyticsModule />
              </Suspense>
            </RequireGrant>
          }
        />
        <Route
          path="/hub/admin/assistants"
          element={
            <RequireGrant role="admin">
              <Suspense fallback={suspenseFallback}>
                <AssistantsStatusPanel />
              </Suspense>
            </RequireGrant>
          }
        />
        <Route
          path="/hub/cotizaciones"
          element={
            <RequireGrant role="admin">
              <CotizacionesRoute />
            </RequireGrant>
          }
        />
        <Route
          path="/hub/admin-ingreso"
          element={
            <RequireGrant role="admin">
              <Shell>
                <Suspense fallback={suspenseFallback}>
                  <AdminIngresoModule />
                </Suspense>
              </Shell>
            </RequireGrant>
          }
        />
        <Route
          path="/hub/bugs"
          element={
            <RequireGrant role="admin">
              <BugReportsList />
            </RequireGrant>
          }
        />
        <Route
          path="/hub/planos"
          element={
            <RequireGrant module="plan-import" minLevel="read">
              <Suspense fallback={suspenseFallback}>
                <BmcPlanosModule />
              </Suspense>
            </RequireGrant>
          }
        />
        {/* Rutas antiguas → módulo unificado «Planos» */}
        <Route path="/hub/plan-import" element={<Navigate to="/hub/planos" replace />} />
        <Route path="/hub/crear-plano" element={<Navigate to="/hub/planos" replace />} />
        <Route
          path="/mi-espacio"
          element={
            <Shell>
              <RequireGrant>
                <Suspense fallback={suspenseFallback}>
                  <MySpacePage />
                </Suspense>
              </RequireGrant>
            </Shell>
          }
        />
        <Route
          path="/hub/traktime/*"
          element={
            <Shell>
              <RequireGrant>
                <Suspense fallback={suspenseFallback}>
                  <TraKtiMeModule />
                </Suspense>
              </RequireGrant>
            </Shell>
          }
        />
        <Route
          path="/hub/finanzas/*"
          element={
            <Shell>
              <RequireGrant module="banco" minLevel="read">
                <Suspense fallback={suspenseFallback}>
                  <FinanzasModule />
                </Suspense>
              </RequireGrant>
            </Shell>
          }
        />
        <Route path="/hub/banco" element={<Navigate to="/hub/finanzas/banco" replace />} />
        <Route path="/hub/banco/*" element={<Navigate to="/hub/finanzas/banco" replace />} />
        <Route
          path="/hub/agent-admin"
          element={
            <RequireGrant role="admin">
              <Suspense fallback={suspenseFallback}>
                <AgentAdminModule />
              </Suspense>
            </RequireGrant>
          }
        />
        <Route
          path="/hub/marketing"
          element={
            <Shell>
              <RequireGrant role="admin">
                <Suspense fallback={suspenseFallback}>
                  <MarketingHubModule />
                </Suspense>
              </RequireGrant>
            </Shell>
          }
        />
        <Route
          path="/"
          element={
            <>
              <Suspense fallback={null}>
                <LandingPage />
              </Suspense>
              <Shell>
                <Suspense fallback={suspenseFallback}>
                  <PanelinCalculadora />
                </Suspense>
              </Shell>
            </>
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
          path="/preview/pdf"
          element={
            <Suspense fallback={suspenseFallback}>
              <PdfPreview />
            </Suspense>
          }
        />
        <Route
          path="/panelin/live"
          element={
            <RequireGrant module="calc" minLevel="write">
              <Suspense fallback={suspenseFallback}>
                <PanelinLivePage />
              </Suspense>
            </RequireGrant>
          }
        />
        <Route
          path="/preview/design-mockups"
          element={
            <Shell>
              <Suspense fallback={suspenseFallback}>
                <DesignMockupsPage />
              </Suspense>
            </Shell>
          }
        />
        <Route path="/wa" element={<Navigate to="/hub/wa" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </RoutedErrorBoundary>
      </TutorialProvider>
      </BmcAuthProvider>
      </DesignPreviewGate>
    </BrowserRouter>
    </QueryClientProvider>
  );
}
