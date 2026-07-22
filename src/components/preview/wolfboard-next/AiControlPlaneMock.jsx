// Módulo IA · Control Plane (mock) — 3 tabs: Estado / Claves & APIs / Consumo.
// Estado refleja la shape real de /api/assistants/status (+providerCooldowns);
// Claves y Consumo reflejan los endpoints propuestos /api/ai/keys y /api/ai/usage.
import { useState } from "react";
import { ASSISTANTS, PROVIDER_COOLDOWNS, AI_KEYS, AI_USAGE } from "./mockData.js";
import { ui, Badge, KpiCard, TabBar, SectionDivider } from "./ui.jsx";

const STATUS_TONE = { live: "green", degraded: "yellow", disabled: "gray", down: "red" };

function EstadoTab() {
  return (
    <div>
      <div style={{ ...ui.card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={ui.th}>Asistente</th>
              <th style={ui.th}>Estado</th>
              <th style={ui.th}>Proveedor sirviendo</th>
              <th style={ui.th}>Proveedores disp.</th>
              <th style={ui.th}>Fallback</th>
              <th style={ui.th}>Dependencias</th>
            </tr>
          </thead>
          <tbody>
            {ASSISTANTS.map((a) => (
              <tr key={a.key}>
                <td style={{ ...ui.td, fontWeight: 600 }}>{a.label}</td>
                <td style={ui.td}><Badge tone={STATUS_TONE[a.status]}>{a.status.toUpperCase()}</Badge></td>
                <td style={ui.td}>{a.activeProvider || "—"}</td>
                <td style={ui.td}>{a.providersAvailable.length ? a.providersAvailable.join(" → ") : "ninguno"}</td>
                <td style={ui.td}>{a.fallbackTo || "terminal"}</td>
                <td style={{ ...ui.td, color: "#6e6e73" }}>{a.deps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SectionDivider label="Cooldowns de proveedor (últimos 60 s)" />
      {PROVIDER_COOLDOWNS.length === 0 ? (
        <p style={{ fontSize: 13, color: "#6e6e73" }}>Sin cooldowns activos.</p>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {PROVIDER_COOLDOWNS.map((c) => (
            <div key={c.provider} style={{ ...ui.card, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
              <Badge tone="yellow">DEPRIORIZADO</Badge>
              <span style={{ fontSize: 13 }}>
                <strong>{c.provider}</strong> — {c.reason} · entró {c.cooldownUntil}
              </span>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 11, color: "#aeb3bb", marginTop: 14 }}>
        Fuente real: <code>GET /api/assistants/status</code> (poll 15 s) — misma data que /hub/admin/assistants, que redirigiría acá.
      </p>
    </div>
  );
}

function ClavesTab() {
  const [rotating, setRotating] = useState(null);
  const [value, setValue] = useState("");
  return (
    <div>
      <div style={{ ...ui.card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={ui.th}>Clave</th>
              <th style={ui.th}>Proveedor</th>
              <th style={ui.th}>Estado</th>
              <th style={ui.th}>Últimos 4</th>
              <th style={ui.th}>Último uso</th>
              <th style={ui.th}>Fuente</th>
              <th style={ui.th}></th>
            </tr>
          </thead>
          <tbody>
            {AI_KEYS.map((k) => (
              <tr key={k.name}>
                <td style={{ ...ui.td, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>{k.name}</td>
                <td style={ui.td}>{k.provider}</td>
                <td style={ui.td}><Badge tone={k.present ? "green" : "red"}>{k.present ? "PRESENTE" : "FALTA"}</Badge></td>
                <td style={{ ...ui.td, fontFamily: "ui-monospace, Menlo, monospace" }}>····{k.last4}</td>
                <td style={ui.td}>{k.lastUsed}</td>
                <td style={{ ...ui.td, color: "#6e6e73", fontSize: 12 }}>{k.source}</td>
                <td style={ui.td}>
                  <button
                    onClick={() => { setRotating(rotating === k.name ? null : k.name); setValue(""); }}
                    style={{ padding: "5px 11px", borderRadius: 7, border: "1px solid #d2d2d7", background: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                  >
                    Rotar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rotating ? (
        <div style={{ ...ui.card, marginTop: 14, border: "1.5px solid #7c3aed" }}>
          <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Rotar <code>{rotating}</code></h4>
          <p style={{ fontSize: 12, color: "#6e6e73", margin: "0 0 10px" }}>
            El valor actual <strong>nunca se muestra</strong>. Pegá la clave nueva (write-only): se valida el formato,
            se escribe una versión nueva en GCP Secret Manager y queda auditado (quién, cuándo, qué clave — jamás el valor).
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Nueva clave (write-only, enmascarada)"
              style={{ flex: 1, minWidth: 260, padding: "8px 12px", borderRadius: 8, border: "1px solid #d2d2d7", fontSize: 13, fontFamily: "ui-monospace, Menlo, monospace" }}
            />
            <button disabled={!value} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: value ? "#7c3aed" : "#d2d2d7", color: "#fff", fontWeight: 700, fontSize: 13, cursor: value ? "pointer" : "default" }}>
              Escribir a GSM
            </button>
          </div>
          <p style={{ fontSize: 11, color: "#9a6700", background: "#fff8c5", borderRadius: 8, padding: "8px 10px", marginTop: 10 }}>
            ⚠ Cloud Run resuelve <code>:latest</code> al arrancar cada instancia: la clave nueva rige tras el
            churn de instancias o un redeploy. Botón post-rotación: <strong>Redeploy ahora</strong> (dispatch del workflow).
          </p>
        </div>
      ) : null}
      <p style={{ fontSize: 11, color: "#aeb3bb", marginTop: 14 }}>
        Fuente real propuesta: <code>GET /api/ai/keys</code> + <code>POST /api/ai/keys/:name/rotate</code> — superadmin-only, rate-limited, audit log.
      </p>
    </div>
  );
}

function barMax(rows, key) {
  return Math.max(...rows.map((r) => r[key]), 1);
}

function ConsumoTab() {
  const u = AI_USAGE;
  const pct = Math.min(100, Math.round((u.today.costUsd / u.budgetUsd) * 100));
  const maxDaily = barMax(u.daily, "costUsd");
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <KpiCard label="Gasto hoy" value={`U$S ${u.today.costUsd.toFixed(2)}`} hint={`${u.today.calls} llamadas`} />
        <KpiCard label="Últimos 7 días" value={`U$S ${u.week.costUsd.toFixed(2)}`} hint={`${u.week.calls} llamadas`} />
        <KpiCard label="Últimos 30 días" value={`U$S ${u.month.costUsd.toFixed(2)}`} hint={`${u.month.calls} llamadas`} />
        <KpiCard label="Tokens hoy (in/out)" value={`${Math.round(u.today.inputTokens / 1000)}k / ${Math.round(u.today.outputTokens / 1000)}k`} />
      </div>

      <SectionDivider label={`Budget diario omni (OMNI_AI_DAILY_BUDGET_USD = ${u.budgetUsd})`} />
      <div style={{ ...ui.card }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
          <span>U$S {u.today.costUsd.toFixed(2)} usados</span>
          <span style={{ color: "#6e6e73" }}>{pct}% — scope: jobs `suggest` (wa_crm_sync exento)</span>
        </div>
        <div style={{ height: 10, borderRadius: 6, background: "#f0f0f2", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: pct > 80 ? "#c0392b" : pct > 50 ? "#e6a700" : "#0b8043" }} />
        </div>
      </div>

      <SectionDivider label="Gasto por día (7 días)" />
      <div style={{ ...ui.card }}>
        <svg viewBox={`0 0 ${u.daily.length * 64} 120`} style={{ width: "100%", maxWidth: 560, height: 120, display: "block" }}>
          {u.daily.map((d, i) => {
            const h = Math.max(4, Math.round((d.costUsd / maxDaily) * 84));
            return (
              <g key={d.day} transform={`translate(${i * 64 + 8}, 0)`}>
                <rect x={0} y={100 - h} width={40} height={h} rx={5} fill={i === u.daily.length - 1 ? "#7c3aed" : "#1a3a5c"} opacity={0.9} />
                <text x={20} y={112} textAnchor="middle" fontSize="10" fill="#6e6e73">{d.day}</text>
                <text x={20} y={95 - h} textAnchor="middle" fontSize="9" fill="#1d1d1f">{d.costUsd.toFixed(1)}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <SectionDivider label="Hoy por asistente × proveedor" />
      <div style={{ ...ui.card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={ui.th}>Asistente</th>
              <th style={ui.th}>Proveedor</th>
              <th style={ui.th}>Llamadas</th>
              <th style={ui.th}>Tokens in</th>
              <th style={ui.th}>Tokens out</th>
              <th style={ui.th}>Costo</th>
            </tr>
          </thead>
          <tbody>
            {u.rows.map((r, i) => (
              <tr key={i}>
                <td style={{ ...ui.td, fontWeight: 600 }}>{r.assistant}</td>
                <td style={ui.td}>{r.provider}</td>
                <td style={ui.td}>{r.calls}</td>
                <td style={ui.td}>{r.inputTokens.toLocaleString("es-UY")}</td>
                <td style={ui.td}>{r.outputTokens.toLocaleString("es-UY")}</td>
                <td style={{ ...ui.td, fontWeight: 700 }}>U$S {r.costUsd.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: "#aeb3bb", marginTop: 14 }}>
        Fuente real propuesta: tabla unificada <code>ai_usage_events</code> (hook en el seam) + <code>GET /api/ai/usage</code>.
        Hoy esta data está fragmentada en logs pino, <code>omni_ai_jobs.cost_usd</code> y ai-analytics.
      </p>
    </div>
  );
}

export default function AiControlPlaneMock() {
  const [tab, setTab] = useState("estado");
  return (
    <div>
      <p style={{ ...ui.sub, marginBottom: 12 }}>
        Módulo nuevo <strong>/hub/ia</strong>: un solo lugar para ver estado, gestionar claves y controlar el gasto de IA.
        Absorbe /hub/admin/assistants (redirect reversible).
      </p>
      <TabBar
        tabs={[
          { id: "estado", label: "Estado" },
          { id: "claves", label: "Claves & APIs" },
          { id: "consumo", label: "Consumo & Budget" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "estado" ? <EstadoTab /> : tab === "claves" ? <ClavesTab /> : <ConsumoTab />}
    </div>
  );
}
