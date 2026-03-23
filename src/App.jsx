// Versión completa: Google Drive, historial de presupuestos, responsive (v3.0 modular)
// Canonical Calculadora component: PanelinCalculadoraV3_backup (see docs/bmc-dashboard-modernization/IA.md)
import { useState, useEffect } from "react";
import PanelinCalculadora from "./components/PanelinCalculadoraV3_backup";
import SpecManagementSandbox from "./components/SpecManagementSandbox.jsx";

function initialAppMode() {
  if (typeof window === "undefined") return "calc";
  return window.location.hash === "#spec-sandbox" ? "sandbox" : "calc";
}

export default function App() {
  const [mode, setMode] = useState(initialAppMode);

  useEffect(() => {
    const sync = () => setMode(window.location.hash === "#spec-sandbox" ? "sandbox" : "calc");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  if (mode === "sandbox") {
    return (
      <SpecManagementSandbox
        onBack={() => {
          window.location.hash = "";
          setMode("calc");
        }}
      />
    );
  }

  return <PanelinCalculadora />;
}
