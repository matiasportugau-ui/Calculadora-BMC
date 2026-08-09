import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useBmcAuth } from "../../../../hooks/useBmcAuth.js";
import { getRunwayMonths } from "../../../../lib/cashflow/project.js";
import { finUi } from "../finanzasUi.js";
import { useCashflowStore } from "./cashflowStore.js";
import VariablesSidebar from "./VariablesSidebar.jsx";
import KpiHeader from "./KpiHeader.jsx";
import ProjectionChart from "./ProjectionChart.jsx";
import PaymentTimelineView from "./PaymentTimelineView.jsx";
import "./finanzas-proyeccion.css";

export default function ProyeccionModule() {
  const auth = useBmcAuth();
  const state = useCashflowStore((s) => s.state);
  const loading = useCashflowStore((s) => s.loading);
  const error = useCashflowStore((s) => s.error);
  const view = useCashflowStore((s) => s.view);
  const toast = useCashflowStore((s) => s.toast);
  const hydrate = useCashflowStore((s) => s.hydrate);
  const setView = useCashflowStore((s) => s.setView);
  const clearToast = useCashflowStore((s) => s.clearToast);

  const baselineRunway = useMemo(() => {
    if (!state) return null;
    const sim = { ...state, scenarios: state.scenarios.map((s) => ({ ...s, isActive: false })) };
    return getRunwayMonths(sim);
  }, [state]);

  useEffect(() => { hydrate(auth.accessToken); }, [hydrate, auth.accessToken]);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(clearToast, 6000);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  if (loading && !state) {
    return <div className="fp-root" style={finUi.hint}>Cargando proyección…</div>;
  }

  return (
    <div className="fp-root">
      <p style={finUi.hint}>
        Liquidez proyectada a 6 meses — integrado con Cash Flow y Banco. Vista gerencial, no fiscal.
      </p>

      <div className="fp-command">
        <div className="fp-command-links">
          <Link to="/hub/finanzas/banco" className="fp-chip">Banco</Link>
          <Link to="/hub/finanzas/cash-flow" className="fp-chip">Cash Flow</Link>
          <span className="fp-chip" style={{ borderColor: "#0071e3", color: "#0071e3", background: "#e8f0fe" }}>Proyección</span>
        </div>
        <div className="fp-view-tabs" style={{ margin: 0, border: "none" }}>
          <button type="button" className={`fp-view-tab${view === "chart" ? " active" : ""}`} onClick={() => setView("chart")}>Gráfico + resumen</button>
          <button type="button" className={`fp-view-tab${view === "timeline" ? " active" : ""}`} onClick={() => setView("timeline")}>Timeline DnD</button>
        </div>
      </div>

      {error && <div style={{ ...finUi.card, color: "#b91c1c", fontSize: 13 }}>API: {error} — datos mock.</div>}

      <div className="fp-grid">
        <VariablesSidebar />
        <main>
          <KpiHeader baselineRunway={baselineRunway} />

          <div className={`fp-panel${view === "chart" ? " active" : ""}`}>
            <div className="fp-split chart-mode">
              <ProjectionChart />
              <div className="fp-mini-timeline">
                <PaymentTimelineView compact />
              </div>
            </div>
          </div>

          <div className={`fp-panel${view === "timeline" ? " active" : ""}`}>
            <PaymentTimelineView />
          </div>
        </main>
      </div>

      {toast && (
        <div className={`fp-toast${toast.type === "err" ? " err" : ""}`} role="alert" onClick={clearToast}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
