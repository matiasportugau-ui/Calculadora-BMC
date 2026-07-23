import { Link } from "react-router-dom";
import { getRunwayMonths } from "../../../../lib/cashflow/project.js";
import { getCurrentCashDisplay, getMonthlyBurnDisplay, isUnifiedModeAvailable } from "../../../../lib/cashflow/currency.js";
import { fmtMoney } from "../finanzasUi.js";
import { useCashflowStore } from "./cashflowStore.js";

const MODES = [
  { id: "uyu", label: "UYU" },
  { id: "usd", label: "USD" },
  { id: "unified_uyu", label: "Unificado UYU" },
  { id: "unified_usd", label: "Unificado USD" },
];

export default function KpiHeader({ baselineRunway }) {
  const state = useCashflowStore((s) => s.state);
  const setCurrencyMode = useCashflowStore((s) => s.setCurrencyMode);
  if (!state) return null;

  const cash = getCurrentCashDisplay(state);
  const burn = getMonthlyBurnDisplay(state);
  const runway = getRunwayMonths(state);
  const delta = baselineRunway != null && runway != null ? runway - baselineRunway : null;

  return (
    <>
      <div className="fp-kpi-row">
        <div className="fp-kpi">
          <div className="fp-kpi-value">{fmtMoney(cash, state.currencyMode)}</div>
          <div className="fp-kpi-label">Cash actual</div>
        </div>
        <div className="fp-kpi">
          <div className="fp-kpi-value">{runway == null ? "—" : `${runway.toFixed(1).replace(".", ",")} m`}</div>
          <div className="fp-kpi-label">Runway</div>
          {delta != null && Math.abs(delta) > 0.05 ? (
            <div className="fp-kpi-delta" style={{ color: delta >= 0 ? "#15803d" : "#b91c1c" }}>
              {delta >= 0 ? "+" : ""}{delta.toFixed(1).replace(".", ",")} m vs base
            </div>
          ) : null}
        </div>
        <div className="fp-kpi">
          <div className="fp-kpi-value">{fmtMoney(burn, state.currencyMode)}</div>
          <div className="fp-kpi-label">Burn mensual</div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div className="fp-seg" role="group" aria-label="Moneda">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={state.currencyMode === m.id ? "active" : ""}
              disabled={!isUnifiedModeAvailable(m.id, state.fx)}
              title={!isUnifiedModeAvailable(m.id, state.fx) ? "FX pendiente" : undefined}
              onClick={() => setCurrencyMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <Link to="/hub/finanzas/cash-flow" className="fp-chip">↗ Cash Flow actual</Link>
      </div>
    </>
  );
}
