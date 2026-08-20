import { useCallback, useEffect, useState } from "react";
import { formatDurationMs, lightColor, tenantAdminFetch, whenUy } from "./tenantAdminApi.js";

function Section({ title, children, hint }) {
  return (
    <section className="adminCot__card" style={{ marginBottom: 14 }}>
      <h2 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "var(--ac-text-2)", textTransform: "uppercase", letterSpacing: 0.6 }}>{title}</h2>
      {hint ? <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--ac-text-3)" }}>{hint}</p> : null}
      {children}
    </section>
  );
}

function BarChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value || 0));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 140 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }} title={`${d.label}: ${d.value}`}>
          <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
            <div style={{
              width: "100%",
              background: "var(--ac-accent)",
              height: `${((d.value || 0) / max) * 100}%`,
              borderRadius: "var(--ac-radius-sm) var(--ac-radius-sm) 0 0",
              minHeight: 2,
            }} />
          </div>
          <span style={{ fontSize: 10, color: "var(--ac-text-2)", whiteSpace: "nowrap" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function Funnel({ steps, pdf }) {
  const max = Math.max(1, ...steps.map((s) => s.users || 0), Number(pdf?.users || 0));
  const items = [
    ...steps.map((s) => ({
      key: s.step,
      label: s.label || `paso ${s.step}`,
      users: Number(s.users || 0),
    })),
    { key: "pdf", label: "PDF", users: Number(pdf?.users || 0) },
  ];
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((s) => (
        <div key={s.key}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
            <span>{s.label}</span>
            <strong>{s.users}</strong>
          </div>
          <div style={{ height: 8, background: "var(--ac-surface-2)", borderRadius: 99 }}>
            <div style={{
              height: 8,
              width: `${(s.users / max) * 100}%`,
              background: s.key === "pdf" ? "var(--ac-success)" : "var(--ac-accent)",
              borderRadius: 99,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LivePanel({ slug, token }) {
  const [live, setLive] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [j, s] = await Promise.all([
        tenantAdminFetch(`/api/admin/tenants/${slug}/live`, { token }),
        tenantAdminFetch(`/api/admin/tenants/${slug}/sessions`, { token }),
      ]);
      setLive(j);
      setSessions(s);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [slug, token]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  if (error && !live) return <p style={{ color: "var(--ac-error)" }}>{error}</p>;
  const items = live?.items || [];
  const ledger = sessions?.sessions || [];
  return (
    <>
      <p style={{ fontSize: 13, color: "var(--ac-text-2)" }}>
        En línea ahora (último evento &lt; 5 min): <strong>{live?.online ?? 0}</strong>
        {" · "}refresco 15s. Personas en el producto, no IPs ni acciones de admin BMC.
      </p>
      <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
        {items.map((s) => (
          <div key={`${s.who}-${s.last_at}`} className="adminCot__card" style={{ padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
              <div>
                <strong>{s.title || s.who}</strong>
                {s.subtitle ? (
                  <div style={{ fontSize: 12, color: "var(--ac-text-2)", fontWeight: 400 }}>{s.subtitle}</div>
                ) : null}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: lightColor(s.light), textTransform: "uppercase" }}>
                {s.label}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--ac-text-2)", marginTop: 4 }}>
              {whenUy(s.last_at)}
              {s.step ? ` · ${s.step}` : ""}
              {s.path ? ` · ${s.path}` : ""}
              {s.last_click ? ` · click: ${s.last_click}` : ""}
              {s.quote_code ? ` · ${s.quote_code}` : ""}
              {s.last_action ? ` · ${String(s.last_action).replace("tenant.", "")}` : ""}
            </div>
          </div>
        ))}
        {!items.length ? <p style={{ color: "var(--ac-text-2)" }}>Nadie usó la calculadora en las últimas 24 h.</p> : null}
      </div>

      <h2 style={{ fontSize: 16, margin: "8px 0 8px" }}>Ingresos y egresos</h2>
      <p style={{ fontSize: 12, color: "var(--ac-text-2)", marginTop: 0 }}>
        Últimos 30 días. Ingreso = session.start · Egreso = session.end · Tiempo = diferencia. Identificado por usuario (o visitante si no hay login).
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["Usuario", "Día", "Ingreso", "Egreso", "Tiempo"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontSize: 11, color: "var(--ac-text-2)", borderBottom: "1px solid var(--ac-border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ledger.map((s, i) => (
              <tr key={`${s.who}-${s.ingreso || s.egreso}-${i}`}>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--ac-border-2)" }}>
                  <strong>{s.title}</strong>
                  {s.subtitle ? <div style={{ fontSize: 11, color: "var(--ac-text-2)" }}>{s.subtitle}</div> : null}
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--ac-border-2)" }}>{s.day || "—"}</td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--ac-border-2)" }}>{whenUy(s.ingreso)}</td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--ac-border-2)" }}>
                  {s.egreso ? whenUy(s.egreso) : (s.open ? "abierta" : "—")}
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--ac-border-2)" }}>{formatDurationMs(s.duration_ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!ledger.length ? <p style={{ color: "var(--ac-text-2)" }}>Todavía no hay ingresos/egresos de este tenant.</p> : null}
    </>
  );
}

export function AnalyticsPanel({ slug, token }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    const q = `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
    try {
      const [a, f] = await Promise.all([
        tenantAdminFetch(`/api/admin/tenants/${slug}/analytics?${q}`, { token }),
        tenantAdminFetch(`/api/admin/tenants/${slug}/funnel?${q}`, { token }),
      ]);
      setData(a);
      setFunnel(f);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [slug, token, days]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="adminCot__toolbar">
        <label style={{ fontSize: 12, color: "var(--ac-text-2)" }}>Rango</label>
        <select value={String(days)} onChange={(e) => setDays(Number(e.target.value))}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--ac-border)" }}>
          <option value="1">1 día</option>
          <option value="7">7 días</option>
          <option value="30">30 días</option>
        </select>
      </div>
      {error ? <p style={{ color: "var(--ac-error)" }}>{error}</p> : null}
      {data ? (
        <>
          <section className="adminCot__stats" aria-label="Analytics del tenant">
            <div className="adminCot__stat">
              <span className="adminCot__stat-label">Usuarios (distintos)</span>
              <span className="adminCot__stat-value">{data.users}</span>
            </div>
            <div className="adminCot__stat">
              <span className="adminCot__stat-label">Eventos</span>
              <span className="adminCot__stat-value">{data.events}</span>
            </div>
            <div className="adminCot__stat">
              <span className="adminCot__stat-label">Tiempo en app (est.)</span>
              <span className="adminCot__stat-value">{formatDurationMs(data.time_in_app?.median_ms)}</span>
            </div>
            <div className={`adminCot__stat${data.errors?.failures ? " adminCot__stat--error" : ""}`}>
              <span className="adminCot__stat-label">Fallos</span>
              <span className="adminCot__stat-value">
                {data.errors?.failures ?? 0}
                {data.errors?.total ? ` · ${(data.errors.rate * 100).toFixed(1)}%` : ""}
              </span>
            </div>
          </section>
          <Section title="Eventos por día" hint="Solo este silo. Hover: usuarios distintos.">
            {data.timeline?.length ? (
              <BarChart data={data.timeline.map((p) => ({
                label: new Date(p.bucket).toLocaleDateString("es-UY", { day: "numeric", month: "short" }),
                value: p.event_count,
              }))} />
            ) : <p style={{ color: "var(--ac-text-2)" }}>Sin datos.</p>}
          </Section>
          <Section title="Workflow · wizard → PDF" hint="Cuántos usuarios distintos llegaron a cada paso. PDF es el cierre.">
            {funnel?.steps?.length ? (
              <>
                <p style={{ fontSize: 12, color: "var(--ac-text-2)" }}>
                  Sesiones start: {funnel.sessions} · PDF: {funnel.pdf?.users || 0}
                </p>
                <Funnel steps={funnel.steps} pdf={funnel.pdf} />
              </>
            ) : <p style={{ color: "var(--ac-text-2)" }}>Todavía no hay pasos de wizard en este rango.</p>}
          </Section>
          <Section title="Acciones top">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Acción", "Eventos", "Usuarios", "Fallas"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontSize: 11, color: "var(--ac-text-2)", borderBottom: "1px solid var(--ac-border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.top_actions || []).map((r) => (
                    <tr key={r.action}>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--ac-border-2)" }}>{r.action}</td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--ac-border-2)" }}>{r.event_count}</td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--ac-border-2)" }}>{r.distinct_users}</td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--ac-border-2)", color: r.failures > 0 ? "var(--ac-error)" : undefined }}>{r.failures}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      ) : !error ? <p>Cargando analytics…</p> : null}
    </>
  );
}
