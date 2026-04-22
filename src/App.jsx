// Versión completa: Google Drive, historial de presupuestos, responsive (v3.0 modular)
// Canonical Calculadora component: PanelinCalculadoraV3_backup (see docs/bmc-dashboard-modernization/IA.md)
import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getRouterBasename } from "./utils/routerBasename.js";
import LegacyAppQueryRedirect from "./components/LegacyAppQueryRedirect.jsx";
import BmcModuleNav from "./components/BmcModuleNav.jsx";
import BmcWolfboardHub from "./components/BmcWolfboardHub.jsx";
import BmcMlOperativoModule from "./components/BmcMlOperativoModule.jsx";
import BmcWaOperativoModule from "./components/BmcWaOperativoModule.jsx";
import { onLCP, onINP, onCLS } from "web-vitals";

const PanelinCalculadora = lazy(() => import("./components/PanelinCalculadoraV3_backup.jsx"));
const BmcLogisticaApp = lazy(() => import("./components/BmcLogisticaApp.jsx"));
const DriverTransportistaApp = lazy(() => import("./components/DriverTransportistaApp.jsx"));
const SpecManagementSandbox = lazy(() => import("./components/SpecManagementSandbox.jsx"));
const BidPresentation = lazy(() => import("./components/BidPresentation.jsx"));
const CalcLogicInspector = lazy(() => import("./components/CalcLogicInspector.jsx"));
const FichasPreview = lazy(() => import("./components/FichasPreview.jsx"));

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
    <BrowserRouter basename={basename}>
      <LegacyAppQueryRedirect />
      <Routes>
        <Route path="/hub" element={<BmcWolfboardHub />} />
        <Route
          path="/hub/ml"
          element={
            <Shell>
              <BmcMlOperativoModule />
            </Shell>
          }
        />
        <Route
          path="/hub/wa"
          element={
            <Shell>
              <BmcWaOperativoModule />
            </Shell>
          }
        />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
