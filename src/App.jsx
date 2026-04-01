// Versión completa: Google Drive, historial de presupuestos, responsive (v3.0 modular)
// Canonical Calculadora component: PanelinCalculadoraV3_backup (see docs/bmc-dashboard-modernization/IA.md)
import PanelinCalculadora from "./components/PanelinCalculadoraV3_backup";
import BmcLogisticaApp from "./components/BmcLogisticaApp";

function isLogisticaRoute() {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  const appParam = url.searchParams.get("app");
  if (appParam === "logistica") return true;
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  // /logistica (Vercel raíz) o /calculadora/logistica (Cloud Run con VITE_BASE=/calculadora/)
  return path === "/logistica" || path.endsWith("/logistica");
}

export default function App() {
  return isLogisticaRoute() ? <BmcLogisticaApp /> : <PanelinCalculadora />;
}
