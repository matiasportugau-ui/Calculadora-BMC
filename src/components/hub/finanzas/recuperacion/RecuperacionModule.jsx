import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useBmcAuth } from "../../../../hooks/useBmcAuth.js";
import { useFinanzasUnlock } from "../FinanzasUnlockGate.jsx";
import "./recuperacion.css";

const ApiBase = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/+$/, "");
  }
  return "";
})();

function fmtMoney(n, cur) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "SIN_DATO";
  const s = new Intl.NumberFormat("es-UY", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Number(n));
  return cur ? `${cur} ${s}` : s;
}

function daysSince(iso) {
  if (!iso) return null;
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

const tooltipStyle = {
  background: "#0c1220",
  border: "1px solid #334155",
  borderRadius: 10,
  color: "#f1f5f9",
  fontSize: 12,
  boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
  padding: "8px 12px",
};

const CFO_ACTIONS = [
  { id: "brief", icon: "📊", title: "Brief de liquidez 30d", desc: "Resumen ejecutivo del gap, caja y presión de obligaciones" },
  { id: "risks", icon: "⚠️", title: "Riesgos y alertas", desc: "Meses rojos, deuda crítica y pipeline en riesgo" },
  { id: "actions", icon: "✅", title: "Plan de acciones prioritarias", desc: "Qué hacer esta semana para mejorar el bridge" },
  { id: "report", icon: "📄", title: "Generar reporte (export)", desc: "Texto listo para copiar / pegar a WhatsApp o email" },
  { id: "export-csv", icon: "⬇️", title: "Export CSV del snapshot", desc: "KPIs + waterfall + pipeline para Excel" },
];

const QUICK_PROMPTS = [
  "¿Cuánto runway tenemos en USD?",
  "Priorizá cobros del pipeline",
  "¿Qué deuda atacar primero?",
  "Escenario si cobramos 50% del pipeline",
];

function buildLocalAnalysis(actionId, snap, meta) {
  const k = snap?.kpi || {};
  const asOf = snap?.as_of || meta?.as_of || "—";
  const lines = [];
  if (actionId === "brief") {
    lines.push(`📋 BRIEF LIQUIDEZ · as-of ${asOf}`, "");
    lines.push(`• Caja USD: ${fmtMoney(k.cash_usd, "USD")}`);
    lines.push(`• Caja UYU: ${fmtMoney(k.cash_uyu, "UYU")}`);
    lines.push(`• Gap 30d proxy: ${fmtMoney(k.gap_30d_usd_proxy, "USD")}`);
    lines.push(`• Pipeline firmes: ${fmtMoney(k.pipeline_usd, "USD")}`);
    lines.push(`• Deuda bancos (capital): ${k.debt_bank_capital == null ? "SIN_DATO" : fmtMoney(k.debt_bank_capital, "USD")}`);
    lines.push(`• Deuda proveedores: ${k.debt_ap == null ? "SIN_DATO" : fmtMoney(k.debt_ap)}`, "");
    if (k.gap_30d_usd_proxy != null && k.gap_30d_usd_proxy < 0) {
      lines.push("🔴 Gap negativo → priorizar cobros y postergar no-esenciales.");
    } else {
      lines.push("🟢 Gap 30d no negativo en el proxy actual. Mantener disciplina de cobro.");
    }
  } else if (actionId === "risks") {
    lines.push(`⚠️ RIESGOS · ${asOf}`, "");
    if (k.cash_usd != null && k.cash_usd < 1000) lines.push("• Caja USD baja (<1k) — stress inmediato.");
    if (k.gap_30d_usd_proxy != null && k.gap_30d_usd_proxy < 0) lines.push("• Gap 30d negativo — riesgo de iliquidez.");
    if (k.debt_bank_capital == null) lines.push("• Deuda bancaria SIN_DATO — completar snapshot.");
    if (k.debt_ap == null) lines.push("• AP proveedores SIN_DATO.");
    const pipe = snap?.pipeline || [];
    const draft = pipe.filter((p) => p.estado === "borrador").length;
    if (draft) lines.push(`• ${draft} cotización(es) en borrador en pipeline — no son caja.`);
    if (lines.length === 2) lines.push("• Sin alertas críticas en el snapshot actual.");
  } else if (actionId === "actions") {
    lines.push(`✅ ACCIONES PRIORITARIAS · ${asOf}`, "");
    lines.push("1. Cobrar pipeline listo_hitl esta semana (máximo impacto caja).");
    lines.push("2. Confirmar montos de cuotas bancarias y AP overdue.");
    lines.push("3. Publicar snapshot fresco si >7 días de antigüedad.");
    lines.push("4. Revisar fijos / capex no esencial si gap < 0.");
    lines.push("5. Coordinar con ventas para acelerar SEND-PACKs firmes.");
  } else if (actionId === "report") {
    lines.push(`── BMC RECUPERACIÓN · REPORTE ──`);
    lines.push(`Fecha snapshot: ${asOf}`);
    lines.push(`Entidad: ${snap?.entity || "METALOG SAS"}`, "");
    lines.push("KPIs");
    lines.push(`  Bancos UYU: ${fmtMoney(k.cash_uyu, "UYU")}`);
    lines.push(`  Bancos USD: ${fmtMoney(k.cash_usd, "USD")}`);
    lines.push(`  Pipeline firmes: ${fmtMoney(k.pipeline_usd, "USD")}`);
    lines.push(`  Gap 30d: ${fmtMoney(k.gap_30d_usd_proxy, "USD")}`, "");
    lines.push("Notas: vista gerencial, no declaración fiscal.");
    lines.push("Generado por Panelin CFO · Calculadora BMC");
  } else {
    lines.push("Acción no reconocida.");
  }
  return lines.join("\n");
}

function exportSnapshotCsv(snap, meta) {
  const k = snap?.kpi || {};
  const rows = [
    ["section", "key", "value", "currency", "note"],
    ["kpi", "cash_uyu", k.cash_uyu ?? "", "UYU", ""],
    ["kpi", "cash_usd", k.cash_usd ?? "", "USD", ""],
    ["kpi", "debt_bank_capital", k.debt_bank_capital ?? "", "USD", k.debt_bank_capital_note || ""],
    ["kpi", "debt_ap", k.debt_ap ?? "", "", k.debt_ap_note || ""],
    ["kpi", "pipeline_usd", k.pipeline_usd ?? "", "USD", ""],
    ["kpi", "gap_30d_usd_proxy", k.gap_30d_usd_proxy ?? "", "USD", ""],
    ["meta", "as_of", snap?.as_of || meta?.as_of || "", "", ""],
    ["meta", "entity", snap?.entity || "", "", ""],
  ];
  (snap?.waterfall_usd || []).forEach((s, i) => {
    rows.push(["waterfall", s.name || `step_${i}`, s.value ?? "", "USD", ""]);
  });
  (snap?.pipeline || []).forEach((p) => {
    rows.push(["pipeline", p.cliente || "", p.amount_usd ?? "", "USD", p.estado || ""]);
  });
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `BMC_Recuperacion_${(snap?.as_of || "snapshot").slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function RecuperacionModule() {
  const auth = useBmcAuth();
  const finanzasUnlock = useFinanzasUnlock();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState(null);
  const [snap, setSnap] = useState(null);
  const [cfoOpen, setCfoOpen] = useState(false);
  const [cfoBusy, setCfoBusy] = useState(false);
  const [cfoResult, setCfoResult] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${ApiBase}/api/banco/recovery-snapshot`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
        },
      });
      const body = await r.json().catch(() => null);
      if (r.status === 403 && body?.error === "finanzas_locked") {
        finanzasUnlock?.lockSession?.();
        setError("finanzas_locked");
        setSnap(null);
        return;
      }
      if (r.status === 404) {
        setError("no_snapshot");
        setSnap(null);
        return;
      }
      if (!r.ok) {
        setError(body?.error || `http_${r.status}`);
        setSnap(null);
        return;
      }
      setMeta({
        id: body.id,
        as_of: body.as_of,
        created_at: body.created_at,
        created_by: body.created_by,
      });
      setSnap(body.snapshot || null);
    } catch (e) {
      setError(e?.message || "network_error");
      setSnap(null);
    } finally {
      setLoading(false);
    }
  }, [auth.accessToken, finanzasUnlock]);

  useEffect(() => {
    load();
  }, [load]);

  const ageDays = daysSince(snap?.as_of || meta?.as_of);
  const stale = ageDays != null && ageDays > 7;

  const waterfallData = useMemo(() => {
    const steps = snap?.waterfall_usd || [];
    return steps.map((s) => ({
      name: s.name,
      value: Number(s.value) || 0,
      fill: (Number(s.value) || 0) >= 0 ? "#22c55e" : "#ef4444",
    }));
  }, [snap]);

  const pipelineData = useMemo(() => {
    const items = [...(snap?.pipeline || [])].sort(
      (a, b) => (Number(a.amount_usd) || 0) - (Number(b.amount_usd) || 0),
    );
    return items.map((p) => ({
      name: p.cliente,
      amount: Number(p.amount_usd) || 0,
      estado: p.estado,
      fill:
        p.estado === "listo_hitl"
          ? "#3b82f6"
          : p.estado === "borrador"
            ? "#f59e0b"
            : "#06b6d4",
    }));
  }, [snap]);

  const salesData = useMemo(
    () =>
      (snap?.sales_monthly || []).map((m) => ({
        month: m.month,
        usd: Number(m.usd) || 0,
        uyu: Number(m.uyu) || 0,
      })),
    [snap],
  );

  const obligationsData = useMemo(() => {
    const rows = [];
    for (const o of snap?.obligations || []) {
      if (o.amount == null) {
        rows.push({ name: `${o.bucket} (SIN_DATO)`, amount: 0, fill: "#3f3f46" });
      } else {
        rows.push({
          name: `${o.bucket} (${o.currency || ""})`,
          amount: Math.abs(Number(o.amount) || 0),
          fill: o.currency === "USD" ? "#f59e0b" : "#ef4444",
        });
      }
    }
    if (snap?.kpi?.pipeline_usd != null) {
      rows.push({
        name: "pipeline_firmes (USD)",
        amount: Number(snap.kpi.pipeline_usd) || 0,
        fill: "#22c55e",
      });
    }
    return rows;
  }, [snap]);

  const runCfo = useCallback(
    (actionId) => {
      if (actionId === "export-csv") {
        if (!snap) return;
        exportSnapshotCsv(snap, meta);
        setCfoResult("✓ CSV descargado.");
        return;
      }
      setCfoBusy(true);
      setCfoResult("");
      window.setTimeout(() => {
        setCfoResult(buildLocalAnalysis(actionId, snap, meta));
        setCfoBusy(false);
      }, 420);
    },
    [snap, meta],
  );

  if (loading) {
    return (
      <div className="fr-root">
        <div className="fr-empty">Cargando snapshot de recuperación…</div>
      </div>
    );
  }

  if (error === "no_snapshot") {
    return (
      <div className="fr-root">
        <div className="fr-empty">
          No hay snapshot publicado todavía.
          <br />
          Publicá con <code>node scripts/publish-recovery-snapshot.mjs</code> desde el pack IAlfred.
        </div>
      </div>
    );
  }

  if (error || !snap) {
    return (
      <div className="fr-root">
        <div className="fr-error">
          No se pudo cargar el snapshot ({error || "empty"}).
          <button type="button" className="fr-chip" style={{ marginLeft: 8 }} onClick={load}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const k = snap.kpi || {};
  const kpis = [
    { label: "Bancos UYU", value: fmtMoney(k.cash_uyu, "UYU"), hint: `bank as-of ${snap.bank_period_end || "—"} · hover para más`, cls: "" },
    { label: "Bancos USD", value: fmtMoney(k.cash_usd, "USD"), hint: `bank as-of ${snap.bank_period_end || "—"} · buffer crítico si <1k`, cls: k.cash_usd != null && k.cash_usd < 1000 ? "warn" : "" },
    { label: "Deuda bancos (capital)", value: k.debt_bank_capital == null ? "SIN_DATO" : fmtMoney(k.debt_bank_capital, "USD"), hint: k.debt_bank_capital_note || "Capital pendiente préstamos", cls: "warn" },
    { label: "Deuda proveedores", value: k.debt_ap == null ? "SIN_DATO" : fmtMoney(k.debt_ap), hint: k.debt_ap_note || "AP / facturas vencidas", cls: "warn" },
    { label: "Pipeline firmes", value: fmtMoney(k.pipeline_usd, "USD"), hint: "SEND-PACKs · no es caja aún", cls: "good" },
    { label: "Gap 30d USD proxy", value: fmtMoney(k.gap_30d_usd_proxy, "USD"), hint: "caja USD − cuotas conocidas · hover = detalle", cls: k.gap_30d_usd_proxy != null && k.gap_30d_usd_proxy < 0 ? "bad" : "good" },
  ];

  return (
    <div className="fr-root">
      <div className="fr-meta">
        <div>
          <h2>Plan de Recuperación · Visual</h2>
          <div className={`sub${stale ? " stale" : ""}`}>
            Snapshot as-of {snap.as_of || meta?.as_of || "—"}
            {ageDays != null ? ` · ${ageDays}d` : ""}
            {stale ? " · actualizar publish" : ""}
            {snap.entity ? ` · ${snap.entity}` : ""}
          </div>
        </div>
        <div className="sub">
          Publicado {meta?.created_at ? new Date(meta.created_at).toLocaleString("es-UY") : "—"}
        </div>
      </div>

      <div className="fr-chips">
        <span className="fr-chip active">Recuperación</span>
        <Link to="/hub/finanzas/banco" className="fr-chip">Banco</Link>
        <Link to="/hub/finanzas/cash-flow" className="fr-chip">Cash Flow</Link>
        <Link to="/hub/finanzas/proyeccion" className="fr-chip">Proyección</Link>
        <button type="button" className="fr-chip" onClick={load}>Refrescar</button>
        <button type="button" className="fr-chip" onClick={() => setCfoOpen(true)} title="Abrir Panelin CFO">🤖 Panelin CFO</button>
      </div>

      <section className="fr-kpis" aria-label="KPIs de recuperación">
        {kpis.map((c) => (
          <div key={c.label} className={`fr-kpi ${c.cls}`} tabIndex={0} title={c.hint}>
            <div className="label">{c.label}</div>
            <div className="value">{c.value}</div>
            {c.hint ? <div className="hint">{c.hint}</div> : null}
          </div>
        ))}
      </section>

      <section className="fr-grid">
        <div className="fr-card">
          <h3><span className="dot" aria-hidden /> Bridge 30 días (USD)</h3>
          <div className="sub">Disponible → cuotas · AP/cobros SIN_DATO = 0 · hover barras = valor</div>
          <div className="fr-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfallData} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={50} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(v, "USD")} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {waterfallData.map((e, i) => (
                    <Cell key={i} fill={e.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="fr-card">
          <h3><span className="dot" aria-hidden /> Pipeline cotizaciones</h3>
          <div className="sub">Solo montos firmes en SEND-PACK · azul = listo_hitl</div>
          <div className="fr-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(v, "USD")} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {pipelineData.map((e, i) => (
                    <Cell key={i} fill={e.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="fr-card">
          <h3><span className="dot" aria-hidden /> Cobros ingreso_venta (6 meses)</h3>
          <div className="sub">Proxy bancario · no es facturación DGI · ejes USD / UYU</div>
          <div className="fr-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={salesData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis yAxisId="usd" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis yAxisId="uyu" orientation="right" tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                <Bar yAxisId="usd" dataKey="usd" name="USD cobros" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Line yAxisId="uyu" type="monotone" dataKey="uyu" name="UYU cobros" stroke="#22d3ee" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="fr-card">
          <h3><span className="dot" aria-hidden /> Presión de obligaciones</h3>
          <div className="sub">Capital préstamos + fijos overdue · pipeline no es deuda</div>
          <div className="fr-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={obligationsData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fill: "#cbd5e1", fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {obligationsData.map((e, i) => (
                    <Cell key={i} fill={e.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <footer className="fr-footer">
        <strong>Disclaimers</strong>
        <br />
        {(snap.disclaimers || []).map((d) => (
          <span key={d}>
            • {d}
            <br />
          </span>
        ))}
        <br />
        <strong>Sources</strong>
        <br />
        {(snap.sources || []).slice(0, 8).join(" · ") || "—"}
        <br />
        <br />
        Single SoT: API snapshot · publish: <code>scripts/publish-recovery-snapshot.mjs</code>
        {" · "}
        <button type="button" className="fr-chip" style={{ marginLeft: 4 }} onClick={() => setCfoOpen(true)}>
          Abrir Panelin CFO AI
        </button>
      </footer>

      <button
        type="button"
        className={`fr-cfo-fab${cfoOpen ? " open" : ""}`}
        aria-label="Abrir Panelin CFO AI"
        title="Panelin CFO — análisis y reportes"
        onClick={() => setCfoOpen((v) => !v)}
      >
        {!cfoOpen && <span className="pulse" />}
        🤖
      </button>

      <div
        className={`fr-cfo-backdrop${cfoOpen ? " open" : ""}`}
        onClick={() => setCfoOpen(false)}
        aria-hidden={!cfoOpen}
      />

      <aside className={`fr-cfo-drawer${cfoOpen ? " open" : ""}`} aria-label="Panelin CFO AI" role="dialog" aria-modal={cfoOpen}>
        <div className="fr-cfo-header">
          <div className="fr-cfo-avatar" aria-hidden>🤖</div>
          <div>
            <h3>Panelin CFO</h3>
            <div className="role">Agente IA · Finanzas / Recuperación</div>
          </div>
          <button type="button" className="fr-cfo-close" onClick={() => setCfoOpen(false)} aria-label="Cerrar">×</button>
        </div>

        <div className="fr-cfo-body">
          <div className="fr-cfo-intro">
            Hola — soy el agente CFO de Panelin. Puedo armarte un brief de liquidez, listar riesgos, proponer acciones y exportar reportes a partir del snapshot actual de recuperación.
          </div>

          <div className="fr-cfo-prompts">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                className="fr-cfo-prompt"
                onClick={() => {
                  setCfoBusy(true);
                  setCfoResult("");
                  window.setTimeout(() => {
                    setCfoResult(
                      `Pregunta: "${p}"\n\n` +
                        buildLocalAnalysis("brief", snap, meta) +
                        "\n\n(Respuesta local basada en snapshot. Para análisis LLM más profundo, conectar endpoint /cfo-fi.)",
                    );
                    setCfoBusy(false);
                  }, 380);
                }}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="fr-cfo-actions">
            {CFO_ACTIONS.map((a) => (
              <button key={a.id} type="button" className="fr-cfo-btn" onClick={() => runCfo(a.id)} disabled={cfoBusy}>
                <span className="icon">{a.icon}</span>
                <span>
                  <div className="title">{a.title}</div>
                  <div className="desc">{a.desc}</div>
                </span>
              </button>
            ))}
          </div>

          {cfoBusy && (
            <div className="fr-cfo-status">
              <span className="spin" /> Analizando snapshot…
            </div>
          )}

          <div className={`fr-cfo-result${cfoResult ? "" : " empty"}`}>
            {cfoResult || "Elegí una acción o prompt para generar análisis / export."}
          </div>

          {cfoResult && !cfoBusy && (
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <button type="button" className="fr-chip" onClick={() => navigator.clipboard?.writeText(cfoResult)}>
                Copiar
              </button>
              <button type="button" className="fr-chip" onClick={() => runCfo("export-csv")}>
                CSV
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
