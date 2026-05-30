// Iframe wrapper around the standalone /finanzas dashboard
// (docs/bmc-dashboard-modernization/dashboard/). The dashboard runs as a
// static SPA served by the Express API; everything it fetches is relative
// to its own origin so loading it in an iframe whose src points at the API
// origin keeps the API calls same-origin and avoids CORS work.
//
// Future: when this gets ported to React, replace this wrapper with a
// real module that calls /api/kpi-financiero etc. directly via React Query.

import { ExternalLink } from "lucide-react";
import { getCalcApiBase } from "../../utils/calcApiBase.js";

export default function FinanzasModule() {
  const apiBase = getCalcApiBase();
  const devSuffix =
    typeof import.meta !== "undefined" && import.meta.env?.DEV ? "?dev=1" : "";
  const finanzasUrl = `${apiBase}/finanzas${devSuffix}`;

  return (
    <div style={{ position: "relative", height: "calc(100vh - 52px)", background: "#f5f5f7" }}>
      <a
        href={finanzasUrl}
        target="_blank"
        rel="noreferrer"
        title="Abrir en pestaña nueva"
        style={{
          position: "absolute",
          top: 8,
          right: 12,
          zIndex: 10,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 8px",
          borderRadius: 6,
          background: "rgba(255,255,255,0.92)",
          border: "1px solid #e5e5ea",
          color: "#1d1d1f",
          fontSize: 11,
          textDecoration: "none",
        }}
      >
        <ExternalLink size={12} /> Pestaña nueva
      </a>
      <iframe
        src={finanzasUrl}
        title="Dashboard Finanzas BMC"
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
      />
    </div>
  );
}
