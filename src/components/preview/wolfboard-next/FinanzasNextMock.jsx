// Módulo Finanzas (mock) — best practices de dashboard financiero:
// KPIs → aging AR → flujo de caja → breakdown filtrable → calendario + metas.
// Los duplicados del /finanzas estático se resuelven con LINKS a los módulos
// oficiales (Logística, Canales, Analytics) — nada se re-implementa.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FINANZAS } from "./mockData.js";
import { ui, Badge, KpiCard, SectionDivider, fmtUsd } from "./ui.jsx";

const AGING_COLOR = { ok: "#0b8043", warn: "#e6a700", bad: "#c0392b" };
const FILTROS = ["Todos", "Esta semana", "Vencidos"];

export default function FinanzasNextMock() {
  const f = FINANZAS;
  const [filtro, setFiltro] = useState("Todos");
  const rows = useMemo(() => {
    if (filtro === "Vencidos") return f.breakdown.filter((r) => r.estado === "Vencido");
    if (filtro === "Esta semana") return f.breakdown.filter((r) => r.estado === "Esta semana");
    return f.breakdown;
  }, [filtro, f.breakdown]);

  const maxAging = Math.max(...f.aging.map((a) => a.amountUsd), 1);
  const maxFlow = Math.max(...f.cashflow.map((c) => c.amountUsd), 1);
  const metaPct = Math.min(100, Math.round((f.metas.realUsd / f.metas.objetivoUsd) * 100));

  return (
    <div>
      <p style={{ ...ui.sub, marginBottom: 12 }}>
        Módulo nuevo <strong>/hub/finanzas</strong>: evaluación económico-financiera con auth de identidad,
        dentro de la SPA. El /finanzas estático queda intacto.
      </p>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <KpiCard label="Total por cobrar" value={fmtUsd(f.byPeriod.total)} hint="27 pagos pendientes" />
        <KpiCard label="Vencido" value={fmtUsd(f.byCurrency.UES.vencido + 0)} tone="bad" hint="23 pagos — 90+ días concentra el mayor monto" />
        <KpiCard label="Esta semana" value={fmtUsd(f.byPeriod.estaSemana)} />
        <KpiCard label="Próxima semana" value={fmtUsd(f.byPeriod.proximaSemana)} />
        <KpiCard label="Este mes" value={fmtUsd(f.byPeriod.esteMes)} />
      </div>

      {/* Split por moneda */}
      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        {Object.entries(f.byCurrency).map(([k, c]) => (
          <div key={k} style={{ ...ui.card, padding: "10px 16px", display: "flex", gap: 12, alignItems: "center" }}>
            <Badge tone="blue">{c.label}</Badge>
            <span style={{ fontSize: 13 }}>total <strong>{c.total.toLocaleString("es-UY")}</strong></span>
            <span style={{ fontSize: 13, color: "#c0392b" }}>vencido <strong>{c.vencido.toLocaleString("es-UY")}</strong></span>
          </div>
        ))}
      </div>

      {/* Aging buckets */}
      <SectionDivider label="Aging de cuentas por cobrar" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {f.aging.map((a) => (
          <div key={a.bucket} style={{ ...ui.card }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{a.bucket}</span>
              <span style={{ fontSize: 11, color: "#6e6e73" }}>{a.count} pagos</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: AGING_COLOR[a.tone], marginBottom: 8 }}>{fmtUsd(a.amountUsd)}</div>
            <div style={{ height: 7, borderRadius: 5, background: "#f0f0f2", overflow: "hidden" }}>
              <div style={{ width: `${Math.round((a.amountUsd / maxAging) * 100)}%`, height: "100%", background: AGING_COLOR[a.tone] }} />
            </div>
          </div>
        ))}
      </div>

      {/* Cashflow timeline */}
      <SectionDivider label="Flujo de caja próximo (vencimientos por período)" />
      <div style={{ ...ui.card }}>
        <svg viewBox={`0 0 ${f.cashflow.length * 88} 140`} style={{ width: "100%", maxWidth: 640, height: 140, display: "block" }}>
          {f.cashflow.map((c, i) => {
            const h = Math.max(5, Math.round((c.amountUsd / maxFlow) * 92));
            return (
              <g key={c.label} transform={`translate(${i * 88 + 10}, 0)`}>
                <rect x={0} y={110 - h} width={58} height={h} rx={6} fill="#0b8043" opacity={i < 2 ? 0.95 : 0.55} />
                <text x={29} y={124} textAnchor="middle" fontSize="10" fill="#6e6e73">{c.label}</text>
                <text x={29} y={104 - h} textAnchor="middle" fontSize="10" fontWeight="700" fill="#1d1d1f">
                  {Math.round(c.amountUsd / 100) / 10}k
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Breakdown */}
      <SectionDivider label="Pagos pendientes (breakdown)" />
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {FILTROS.map((fl) => (
          <button
            key={fl}
            onClick={() => setFiltro(fl)}
            style={{
              padding: "6px 13px", borderRadius: 8, fontSize: 12, cursor: "pointer",
              border: filtro === fl ? "1.5px solid #1a3a5c" : "1px solid #d2d2d7",
              background: filtro === fl ? "#1a3a5c" : "#fff", color: filtro === fl ? "#fff" : "#1d1d1f",
              fontWeight: filtro === fl ? 700 : 500,
            }}
          >
            {fl}
          </button>
        ))}
        <span style={{ alignSelf: "center", fontSize: 12, color: "#6e6e73", marginLeft: 6 }}>{rows.length} filas</span>
      </div>
      <div style={{ ...ui.card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={ui.th}>Cliente</th>
              <th style={ui.th}>Pedido</th>
              <th style={ui.th}>Monto</th>
              <th style={ui.th}>Vencimiento</th>
              <th style={ui.th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={{ ...ui.td, fontWeight: 600 }}>{r.cliente}</td>
                <td style={ui.td}>{r.pedido}</td>
                <td style={{ ...ui.td, fontWeight: 700 }}>{fmtUsd(r.montoUsd)}</td>
                <td style={ui.td}>{r.vence}</td>
                <td style={ui.td}>
                  <Badge tone={r.estado === "Vencido" ? "red" : r.estado === "Esta semana" ? "yellow" : "gray"}>
                    {r.estado}{r.estado === "Vencido" ? ` · ${r.dias}d` : ""}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Calendario + Metas side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginTop: 22 }}>
        <div>
          <SectionDivider label="Calendario de vencimientos (gastos fijos)" />
          <div style={{ ...ui.card, padding: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {FINANZAS.calendario.map((c) => (
                  <tr key={c.concepto}>
                    <td style={{ ...ui.td, fontWeight: 600 }}>{c.concepto}</td>
                    <td style={ui.td}>{c.importe}</td>
                    <td style={{ ...ui.td, color: "#6e6e73" }}>{c.vence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <SectionDivider label={`Meta de ventas · ${FINANZAS.metas.mes}`} />
          <div style={{ ...ui.card }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
              <span><strong>{fmtUsd(FINANZAS.metas.realUsd)}</strong> real</span>
              <span style={{ color: "#6e6e73" }}>objetivo {fmtUsd(FINANZAS.metas.objetivoUsd)}</span>
            </div>
            <div style={{ height: 10, borderRadius: 6, background: "#f0f0f2", overflow: "hidden" }}>
              <div style={{ width: `${metaPct}%`, height: "100%", background: metaPct > 66 ? "#0b8043" : metaPct > 33 ? "#e6a700" : "#c0392b" }} />
            </div>
            <span style={{ fontSize: 12, color: "#6e6e73", marginTop: 6, display: "inline-block" }}>{metaPct}% del mes</span>
          </div>
        </div>
      </div>

      {/* De-dup por links */}
      <SectionDivider label="Operación relacionada (módulos oficiales — sin duplicar)" />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link to="/logistica" style={{ ...ui.card, textDecoration: "none", color: "#1d1d1f", padding: "10px 16px", fontSize: 13 }}>
          🚚 <strong>Entregas y logística</strong> → /logistica
        </Link>
        <Link to="/hub/canales" style={{ ...ui.card, textDecoration: "none", color: "#1d1d1f", padding: "10px 16px", fontSize: 13 }}>
          💬 <strong>Consultas pendientes</strong> → /hub/canales
        </Link>
        <Link to="/hub/admin/analytics" style={{ ...ui.card, textDecoration: "none", color: "#1d1d1f", padding: "10px 16px", fontSize: 13 }}>
          📈 <strong>Audit & analytics</strong> → /hub/admin/analytics
        </Link>
      </div>
      <p style={{ fontSize: 11, color: "#aeb3bb", marginTop: 14 }}>
        Fuentes reales: <code>/api/kpi-financiero</code>, <code>/api/pagos-pendientes</code>, <code>/api/calendario-vencimientos</code>,
        <code>/api/metas-ventas</code> — números ya confiables tras el fix de parsing locale (#565).
      </p>
    </div>
  );
}
