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
  background: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: 8,
  color: "#fafafa",
  fontSize: 12,
};

export default function RecuperacionModule() {
  const auth = useBmcAuth();
  const finanzasUnlock = useFinanzasUnlock();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState(null);
  const [snap, setSnap] = useState(null);

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
        rows.push({
          name: `${o.bucket} (SIN_DATO)`,
          amount: 0,
          fill: "#3f3f46",
        });
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
    {
      label: "Bancos UYU",
      value: fmtMoney(k.cash_uyu, "UYU"),
      hint: `bank as-of ${snap.bank_period_end || "—"}`,
      cls: "",
    },
    {
      label: "Bancos USD",
      value: fmtMoney(k.cash_usd, "USD"),
      hint: `bank as-of ${snap.bank_period_end || "—"}`,
      cls: k.cash_usd != null && k.cash_usd < 1000 ? "warn" : "",
    },
    {
      label: "Deuda bancos (capital)",
      value: k.debt_bank_capital == null ? "SIN_DATO" : fmtMoney(k.debt_bank_capital, "USD"),
      hint: k.debt_bank_capital_note || "",
      cls: "warn",
    },
    {
      label: "Deuda proveedores",
      value: k.debt_ap == null ? "SIN_DATO" : fmtMoney(k.debt_ap),
      hint: k.debt_ap_note || "",
      cls: "warn",
    },
    {
      label: "Pipeline firmes",
      value: fmtMoney(k.pipeline_usd, "USD"),
      hint: "SEND-PACKs · no es caja",
      cls: "good",
    },
    {
      label: "Gap 30d USD proxy",
      value: fmtMoney(k.gap_30d_usd_proxy, "USD"),
      hint: "caja USD − cuotas conocidas",
      cls: k.gap_30d_usd_proxy != null && k.gap_30d_usd_proxy < 0 ? "bad" : "good",
    },
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
        <Link to="/hub/finanzas/banco" className="fr-chip">
          Banco
        </Link>
        <Link to="/hub/finanzas/cash-flow" className="fr-chip">
          Cash Flow
        </Link>
        <Link to="/hub/finanzas/proyeccion" className="fr-chip">
          Proyección
        </Link>
        <button type="button" className="fr-chip" onClick={load}>
          Refrescar
        </button>
      </div>

      <section className="fr-kpis">
        {kpis.map((c) => (
          <div key={c.label} className={`fr-kpi ${c.cls}`}>
            <div className="label">{c.label}</div>
            <div className="value">{c.value}</div>
            {c.hint ? <div className="hint">{c.hint}</div> : null}
          </div>
        ))}
      </section>

      <section className="fr-grid">
        <div className="fr-card">
          <h3>Bridge 30 días (USD)</h3>
          <div className="sub">Disponible → cuotas · AP/cobros SIN_DATO = 0 en snapshot</div>
          <div className="fr-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfallData} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
                <CartesianGrid stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={50} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
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
          <h3>Pipeline cotizaciones</h3>
          <div className="sub">Solo montos firmes en SEND-PACK</div>
          <div className="fr-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#27272a" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#d4d4d8", fontSize: 11 }} />
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
          <h3>Cobros ingreso_venta (6 meses)</h3>
          <div className="sub">Proxy bancario · no es facturación DGI · ejes USD / UYU</div>
          <div className="fr-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={salesData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#27272a" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
                <YAxis yAxisId="usd" tick={{ fill: "#71717a", fontSize: 11 }} />
                <YAxis yAxisId="uyu" orientation="right" tick={{ fill: "#71717a", fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ color: "#a1a1aa", fontSize: 12 }} />
                <Bar yAxisId="usd" dataKey="usd" name="USD cobros" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Line yAxisId="uyu" type="monotone" dataKey="uyu" name="UYU cobros" stroke="#06b6d4" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="fr-card">
          <h3>Presión de obligaciones</h3>
          <div className="sub">Capital préstamos + fijos overdue · pipeline no es deuda</div>
          <div className="fr-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={obligationsData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#27272a" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fill: "#d4d4d8", fontSize: 10 }} />
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
      </footer>
    </div>
  );
}
