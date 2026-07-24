import { fmtMoney } from "../finanzasUi.js";
import { useCashflowStore } from "./cashflowStore.js";

export default function VariablesSidebar() {
  const state = useCashflowStore((s) => s.state);
  const setMonthlyBurn = useCashflowStore((s) => s.setMonthlyBurn);
  const toggleScenario = useCashflowStore((s) => s.toggleScenario);
  if (!state) return null;

  return (
    <aside className="fp-sidebar">
      <h3>Variables</h3>
      <label style={{ fontSize: 13, fontWeight: 600 }}>Burn mensual</label>
      <div style={{ display: "flex", justifyContent: "space-between", margin: "8px 0 6px", fontFamily: "SF Mono, Menlo, monospace", fontSize: 14, color: "#0071e3", fontWeight: 600 }}>
        {fmtMoney(state.monthlyBurn, state.currencyMode)}
      </div>
      <input className="fp-range" type="range" min={200000} max={800000} step={10000} value={state.monthlyBurn} onChange={(e) => setMonthlyBurn(e.target.value)} />

      <h3 style={{ marginTop: 20 }}>Escenarios <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 11 }}>(ejemplo)</span></h3>
      {state.scenarios.map((sc) => (
        <div key={sc.id} className={`fp-scenario${sc.isActive ? " on" : ""}`} role="button" tabIndex={0} onClick={() => toggleScenario(sc.id)} onKeyDown={(e) => e.key === "Enter" && toggleScenario(sc.id)}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{sc.label}</span>
          <div className="fp-switch" aria-hidden />
        </div>
      ))}

      <p style={{ fontSize: 11, color: "var(--fp-muted)", marginTop: 16, lineHeight: 1.45 }}>
        Proyección gerencial — no asesoramiento fiscal. API mock hasta conectar calendario Sheets.
      </p>
    </aside>
  );
}
