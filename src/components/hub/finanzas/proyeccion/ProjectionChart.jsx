import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { getProjectedSeries } from "../../../../lib/cashflow/project.js";
import { fmtMoney } from "../finanzasUi.js";
import { useCashflowStore } from "./cashflowStore.js";

function ChartTooltip({ active, payload, label, currencyMode }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e5ea", borderRadius: 10, padding: "10px 12px", fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {row?.actual != null && <div style={{ color: "#0071e3" }}>Actuales: {fmtMoney(row.actual, currencyMode)}</div>}
      {row?.projection != null && <div style={{ color: "#6e6e73" }}>Proyección: {fmtMoney(row.projection, currencyMode)}</div>}
      {row?.scenarioMax != null && <div style={{ color: "#34c759" }}>Escenario: {fmtMoney(row.scenarioMax, currencyMode)}</div>}
    </div>
  );
}

export default function ProjectionChart({ compact = false }) {
  const state = useCashflowStore((s) => s.state);
  const seriesVis = useCashflowStore((s) => s.chartSeries);
  const toggle = useCashflowStore((s) => s.toggleChartSeries);
  if (!state) return null;

  const data = getProjectedSeries(state);
  const anySc = state.scenarios.some((s) => s.isActive);

  return (
    <div className="fp-chart-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <h4 style={{ margin: 0, fontSize: compact ? 13 : 15, fontWeight: 700 }}>Proyección de caja — 6 meses</h4>
        <div className="fp-legend">
          <button type="button" className={seriesVis.actual ? "" : "off"} onClick={() => toggle("actual")}>
            <span style={{ width: 16, height: 3, background: "#0071e3", borderRadius: 2, display: "inline-block" }} /> Actuales
          </button>
          <button type="button" className={seriesVis.projection ? "" : "off"} onClick={() => toggle("projection")}>
            <span style={{ width: 16, height: 0, borderTop: "2px dashed #6e6e73", display: "inline-block" }} /> Proyección
          </button>
          {anySc ? (
            <button type="button" className={seriesVis.band ? "" : "off"} onClick={() => toggle("band")}>
              <span style={{ width: 16, height: 10, background: "#e8f0fe", border: "1px solid #0071e3", borderRadius: 2, display: "inline-block" }} /> Escenarios
            </button>
          ) : null}
        </div>
      </div>
      <div style={{ width: "100%", height: compact ? 220 : 300 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0071e3" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#0071e3" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#e5e5ea" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6e6e73" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => fmtMoney(v, state.currencyMode)} tick={{ fontSize: 10, fill: "#6e6e73" }} width={72} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip currencyMode={state.currencyMode} />} />
            {seriesVis.band && anySc ? (
              <Area type="monotone" dataKey="scenarioMax" stroke="none" fill="url(#fpGrad)" connectNulls />
            ) : null}
            {seriesVis.actual ? (
              <Area type="monotone" dataKey="actual" stroke="#0071e3" strokeWidth={2.5} fill="url(#fpGrad)" dot={{ r: 3, fill: "#0071e3" }} activeDot={{ r: 6 }} />
            ) : null}
            {seriesVis.projection ? (
              <Line type="monotone" dataKey="projection" stroke="#6e6e73" strokeWidth={2} strokeDasharray="6 4" dot={false} />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
