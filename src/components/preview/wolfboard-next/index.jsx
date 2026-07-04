// /preview/wolfboard-next — prototipo navegable de la evolución del Wolfboard.
// TODO ES MOCK: datos ficticios con la shape real de los endpoints. Aditivo puro:
// ningún módulo oficial se modifica. Ver docs/team/ARCHITECTURE-AUDIT-2026-07-04.md §9.
import { useState } from "react";
import { Link } from "react-router-dom";
import HubNextMock from "./HubNextMock.jsx";
import AiControlPlaneMock from "./AiControlPlaneMock.jsx";
import FinanzasNextMock from "./FinanzasNextMock.jsx";
import { ui, TabBar } from "./ui.jsx";

const VIEWS = [
  { id: "hub", label: "🏠 Hub rediseñado" },
  { id: "ia", label: "🤖 IA · Control Plane" },
  { id: "finanzas", label: "💰 Finanzas" },
];

export default function WolfboardNextPreview() {
  const [view, setView] = useState("hub");
  return (
    <div style={ui.page}>
      <div style={{ background: "#1a3a5c", color: "#fff", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>PROTOTIPO · Wolfboard Next</strong>
        <span style={{ fontSize: 12, opacity: 0.85 }}>
          datos mock — nada de esto toca los módulos oficiales
        </span>
        <Link to="/hub" style={{ marginLeft: "auto", color: "#fff", fontSize: 12, opacity: 0.9 }}>
          ← volver al hub actual
        </Link>
      </div>
      <div style={ui.main}>
        <h1 style={ui.h1}>
          {view === "hub" ? "Wolfboard" : view === "ia" ? "IA · Control Plane" : "Finanzas"}
        </h1>
        <p style={ui.sub}>
          Propuesta visual de la Etapa {view === "hub" ? "1 (hub completo por secciones)" : view === "ia" ? "2 (/hub/ia)" : "3 (/hub/finanzas)"} —
          auditoría 2026-07-04 §9.
        </p>
        <TabBar tabs={VIEWS} active={view} onChange={setView} />
        {view === "hub" ? <HubNextMock /> : view === "ia" ? <AiControlPlaneMock /> : <FinanzasNextMock />}
      </div>
    </div>
  );
}
