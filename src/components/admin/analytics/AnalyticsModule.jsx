// ═══════════════════════════════════════════════════════════════════════════
// src/components/admin/analytics/AnalyticsModule.jsx — /hub/admin/analytics.
// ───────────────────────────────────────────────────────────────────────────
// Reads from /api/admin/analytics/* (5 endpoints, all gated role=admin).
// Mirrors the admin-cotizaciones design system: SkinProvider, .adminCot
// namespace, --ac-* tokens. No new dependencies; inline SVG bars for charts.
// ═══════════════════════════════════════════════════════════════════════════

import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { SkinProvider } from "../../admin-cotizaciones/SkinProvider.jsx";
import { useSkin } from "../../admin-cotizaciones/useSkin.js";
import "../../admin-cotizaciones/styles.css";
import { useBmcAuth } from "../../../hooks/useBmcAuth.js";

const ApiBase = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/+$/, "");
  }
  return "";
})();

const DEFAULT_LOOKBACK_DAYS = 7;

async function jget(token, path) {
  const r = await fetch(`${ApiBase}${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return r.json();
}

function ModuleInner() {
  const { skin } = useSkin();
  const auth = useBmcAuth();
  const token = auth?.accessToken;
  const [lookbackDays, setLookbackDays] = useState(DEFAULT_LOOKBACK_DAYS);
  const [data, setData] = useState({
    dau: null, wau: null, mau: null,
    moduleUsage: [], errorRate: null, timeline: [], topActions: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const to = new Date();
    const from = new Date(to.getTime() - lookbackDays * 86_400_000);
    const range = `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
    try {
      const [dau, wau, mau, mu, er, tl, ta] = await Promise.all([
        jget(token, `/api/admin/analytics/active-users?window=day`),
        jget(token, `/api/admin/analytics/active-users?window=week`),
        jget(token, `/api/admin/analytics/active-users?window=month`),
        jget(token, `/api/admin/analytics/module-usage?${range}`),
        jget(token, `/api/admin/analytics/error-rate?${range}`),
        jget(token, `/api/admin/analytics/timeline?${range}&interval=day`),
        jget(token, `/api/admin/analytics/top-actions?${range}&limit=15`),
      ]);
      setData({
        dau: dau.active, wau: wau.active, mau: mau.active,
        moduleUsage: mu.items || [],
        errorRate: er,
        timeline: tl.items || [],
        topActions: ta.items || [],
      });
    } catch (e) {
      setError(e.message || "fetch_failed");
    } finally {
      setLoading(false);
    }
  }, [token, lookbackDays]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="adminCot" data-skin={skin}>
      <header className="adminCot__topbar" role="banner">
        <nav className="adminCot__crumb" aria-label="Breadcrumb">
          <span>BMC</span>
          <span className="adminCot__crumb-sep">›</span>
          <Link to="/hub">hub</Link>
          <span className="adminCot__crumb-sep">›</span>
          <Link to="/hub/admin">admin</Link>
          <span className="adminCot__crumb-sep">›</span>
          <span style={{ color: "var(--ac-text)" }}>analytics</span>
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="adminCot__live" aria-live="polite">
            <span className="adminCot__live-dot" data-state={loading ? "busy" : error ? "error" : "ok"} />
            {loading ? "Cargando…" : error ? "Error" : "En vivo"}
          </span>
        </div>
      </header>

      <main style={{ padding: 16, maxWidth: 1280, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--ac-text)", flex: 1 }}>Analytics</h1>
          <label style={{ fontSize: 12, color: "var(--ac-text-2)" }}>Rango:</label>
          <select
            value={String(lookbackDays)}
            onChange={(e) => setLookbackDays(Number(e.target.value))}
            style={{
              padding: "6px 10px", fontSize: 13, borderRadius: "var(--ac-radius-sm)",
              border: "1px solid var(--ac-border)", background: "var(--ac-surface)",
              color: "var(--ac-text)", fontFamily: "var(--ac-font)",
            }}
          >
            <option value="1">1 día</option>
            <option value="7">7 días</option>
            <option value="30">30 días</option>
            <option value="90">90 días</option>
          </select>
        </div>

        {error ? (
          <div style={{
            padding: 16, marginBottom: 14,
            background: "var(--ac-surface)", border: "1px solid var(--ac-error)",
            borderRadius: "var(--ac-radius)", color: "var(--ac-error)", fontSize: 13,
          }}>
            Error cargando analytics: {error}
          </div>
        ) : null}

        {/* Active users — DAU/WAU/MAU */}
        <section className="adminCot__stats" aria-label="Usuarios activos" style={{ marginBottom: 14 }}>
          <div className="adminCot__stat">
            <span className="adminCot__stat-label">DAU (24h)</span>
            <span className="adminCot__stat-value">{data.dau ?? "—"}</span>
          </div>
          <div className="adminCot__stat adminCot__stat--success">
            <span className="adminCot__stat-label">WAU (7d)</span>
            <span className="adminCot__stat-value">{data.wau ?? "—"}</span>
          </div>
          <div className="adminCot__stat">
            <span className="adminCot__stat-label">MAU (30d)</span>
            <span className="adminCot__stat-value">{data.mau ?? "—"}</span>
          </div>
          <div className="adminCot__stat" style={{ background: data.errorRate?.rate > 0.05 ? "var(--ac-error)" : undefined, color: data.errorRate?.rate > 0.05 ? "#fff" : undefined }}>
            <span className="adminCot__stat-label">Error rate</span>
            <span className="adminCot__stat-value">
              {data.errorRate ? `${(data.errorRate.rate * 100).toFixed(1)}%` : "—"}
            </span>
          </div>
        </section>

        {/* Timeline bar chart */}
        <Section title={`Eventos por día (últimos ${lookbackDays} días)`}>
          {data.timeline.length === 0 ? (
            <p style={{ color: "var(--ac-text-2)" }}>Sin datos.</p>
          ) : (
            <BarChart
              data={data.timeline.map((p) => ({ label: new Date(p.bucket).toLocaleDateString("es-UY", { day: "numeric", month: "short" }), value: p.event_count, secondary: p.distinct_users }))}
              primaryLabel="eventos"
              secondaryLabel="usuarios distintos"
            />
          )}
        </Section>

        {/* Module usage */}
        <Section title={`Uso por módulo (últimos ${lookbackDays} días)`}>
          {data.moduleUsage.length === 0 ? (
            <p style={{ color: "var(--ac-text-2)" }}>Sin datos.</p>
          ) : (
            <Table
              columns={[
                { header: "Módulo", key: "module" },
                { header: "Eventos", key: "event_count" },
                { header: "Usuarios distintos", key: "distinct_users" },
              ]}
              rows={data.moduleUsage}
            />
          )}
        </Section>

        {/* Top actions */}
        <Section title={`Acciones top (últimos ${lookbackDays} días)`}>
          {data.topActions.length === 0 ? (
            <p style={{ color: "var(--ac-text-2)" }}>Sin datos.</p>
          ) : (
            <Table
              columns={[
                { header: "Acción", key: "action" },
                { header: "Eventos", key: "event_count" },
                { header: "Usuarios", key: "distinct_users" },
                { header: "Fallas", key: "failures", className: "warn" },
              ]}
              rows={data.topActions}
            />
          )}
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{
      background: "var(--ac-surface)",
      border: "1px solid var(--ac-border)",
      borderRadius: "var(--ac-radius)",
      padding: 14,
      marginBottom: 14,
    }}>
      <h2 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "var(--ac-text-2)", textTransform: "uppercase", letterSpacing: 0.6 }}>{title}</h2>
      {children}
    </section>
  );
}

function Table({ columns, rows }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600, color: "var(--ac-text-2)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid var(--ac-border)" }}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} style={{
                  padding: "6px 8px",
                  borderBottom: "1px solid var(--ac-border-2)",
                  color: c.className === "warn" && r[c.key] > 0 ? "var(--ac-error)" : "var(--ac-text)",
                }}>
                  {r[c.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BarChart({ data, primaryLabel, secondaryLabel }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 140 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }} title={`${d.label}: ${d.value} ${primaryLabel} · ${d.secondary} ${secondaryLabel}`}>
            <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
              <div style={{
                width: "100%", background: "var(--ac-accent)",
                height: `${(d.value / max) * 100}%`,
                borderRadius: "var(--ac-radius-sm) var(--ac-radius-sm) 0 0",
                minHeight: 2,
              }} />
            </div>
            <span style={{ fontSize: 10, color: "var(--ac-text-2)", textAlign: "center", whiteSpace: "nowrap" }}>{d.label}</span>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 8, fontSize: 11, color: "var(--ac-text-2)", textAlign: "center" }}>
        Barra = {primaryLabel} · hover para ver {secondaryLabel}
      </p>
    </div>
  );
}

export default function AnalyticsModule() {
  return (
    <SkinProvider>
      <ModuleInner />
    </SkinProvider>
  );
}
