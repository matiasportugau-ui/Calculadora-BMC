// Versión completa: Google Drive, historial de presupuestos, responsive (v3.0 modular)
// Canonical Calculadora component: PanelinCalculadoraV3_backup (see docs/bmc-dashboard-modernization/IA.md)
import { useState, useEffect } from "react";
import PanelinCalculadora from "./components/PanelinCalculadoraV3_backup";
import SpecManagementSandbox from "./components/SpecManagementSandbox.jsx";
import BidPresentation from "./components/BidPresentation.jsx";

function hashToMode(hash) {
  if (hash === "#spec-sandbox") return "sandbox";
  if (hash === "#presentacion-licitacion") return "presentation";
  return "calc";
}

function initialAppMode() {
  if (typeof window === "undefined") return "calc";
  return hashToMode(window.location.hash);
}

export default function App() {
  const [mode, setMode] = useState(initialAppMode);

  useEffect(() => {
    const sync = () => setMode(hashToMode(window.location.hash));
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

  if (mode === "presentation") {
    return (
      <BidPresentation
        onBack={() => {
          window.location.hash = "";
          setMode("calc");
        }}
      />
    );
  }

  return <PanelinCalculadora />;
}
