// /hub/admin/tenant/:slug — Control, manage, and monitor one tenant silo.
import { Link, useParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { SkinProvider, useSkin } from "../../admin-cotizaciones/SkinProvider.jsx";
import "../../admin-cotizaciones/styles.css";
import { useBmcAuth } from "../../../hooks/useBmcAuth.js";
import { downloadBlob, lightColor, moneyUsd, moneyUsdEstimate, tenantAdminFetch, whenUy } from "./tenantAdminApi.js";
import { AnalyticsPanel, LivePanel } from "./TenantTowerPanels.jsx";
import TenantAgentEvalPanel from "./TenantAgentEvalPanel.jsx";
import { memberInviteView } from "../../../utils/tenantInviteView.js";

const TABS = [
  { id: "live", label: "Live" },
  { id: "analytics", label: "Analytics" },
  { id: "ia", label: "IA (eval)" },
  { id: "manage", label: "Cuentas y ventas" },
  { id: "monitor", label: "Monitor" },
  { id: "control", label: "Control" },
];

function PageInner() {
  const { skin } = useSkin();
  const { slug: slugParam } = useParams();
  const slug = slugParam || "bc";
  const auth = useBmcAuth();
  const token = auth?.accessToken;
  const [tab, setTab] = useState("live");
  const [data, setData] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [activity, setActivity] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("owner");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const t = await tenantAdminFetch(`/api/admin/tenants/${slug}`, { token });
    const q = await tenantAdminFetch(`/api/admin/tenants/${slug}/quotes?limit=80`, { token });
    const a = await tenantAdminFetch(`/api/admin/tenants/${slug}/activity?limit=120`, { token });
    setData(t);
    setQuotes(q.items || []);
    setActivity(a.items || []);
  }, [slug, token]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function invite(ev) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await tenantAdminFetch(`/api/admin/tenants/${slug}/members`, {
        token, method: "POST", body: { email, role },
      });
      setEmail("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(invitedEmail) {
    if (!window.confirm(`Revocar ${invitedEmail} de ${slug}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await tenantAdminFetch(
        `/api/admin/tenants/${slug}/members?email=${encodeURIComponent(invitedEmail)}`,
        { token, method: "DELETE" },
      );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status) {
    setBusy(true);
    setError(null);
    try {
      await tenantAdminFetch(`/api/admin/tenants/${slug}`, {
        token, method: "PATCH", body: { status },
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function exportBundle(format) {
    setBusy(true);
    setError(null);
    try {
      if (format === "csv") {
        const r = await fetch(`/api/admin/tenants/${slug}/export?format=csv`, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!r.ok) throw new Error(`http_${r.status}`);
        downloadBlob(`${slug}-quotes.csv`, await r.text(), "text/csv");
      } else {
        const j = await tenantAdminFetch(`/api/admin/tenants/${slug}/export?limit=200`, { token });
        downloadBlob(`${slug}-tenant.json`, JSON.stringify(j, null, 2), "application/json");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const tenant = data?.tenant;
  const paused = tenant?.status === "paused";
  const stats = data?.stats || {};

  return (
    <div className="adminCot" data-skin={skin}>
      <header className="adminCot__topbar" role="banner">
        <nav className="adminCot__crumb" aria-label="Breadcrumb">
          <span>BMC</span>
          <span className="adminCot__crumb-sep">›</span>
          <Link to="/hub">hub</Link>
          <span className="adminCot__crumb-sep">›</span>
          <Link to="/hub/admin/tenants">tenants</Link>
          <span className="adminCot__crumb-sep">›</span>
          <span style={{ color: "var(--ac-text)" }}>{slug}</span>
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="adminCot__live" aria-live="polite">
            <span className="adminCot__live-dot" data-state={busy ? "busy" : error ? "error" : "ok"} />
            {busy ? "Trabajando…" : error ? "Error" : "En vivo"}
          </span>
        </div>
      </header>

      <main style={{ padding: 16, maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        {!data && !error ? <p>Cargando tenant…</p> : null}
        {error ? <p style={{ color: "var(--ac-error)" }}>{error}</p> : null}
        {tenant ? (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h1 style={{ margin: "4px 0 4px", fontSize: 22 }}>{tenant.display_name}</h1>
                <p style={{ margin: 0, color: "var(--ac-text-2)", fontSize: 13 }}>
                  {tenant.legal_name} · silo <code>{slug}</code> · venta only · comisión off
                </p>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 700, textTransform: "uppercase",
                color: lightColor(paused ? "paused" : "online"),
              }}>
                {paused ? "pausado" : "activo"}
              </span>
            </div>

            <section className="adminCot__stats" aria-label="Indicadores del tenant">
              <div className="adminCot__stat">
                <span className="adminCot__stat-label">Cuentas</span>
                <span className="adminCot__stat-value">{stats.members_claimed ?? 0}/{stats.members ?? tenant.member_count}</span>
              </div>
              <div className="adminCot__stat">
                <span className="adminCot__stat-label">Presupuestos</span>
                <span className="adminCot__stat-value">{stats.quotes ?? quotes.length}</span>
              </div>
              <div className="adminCot__stat adminCot__stat--success">
                <span className="adminCot__stat-label">Venta USD</span>
                <span className="adminCot__stat-value">{moneyUsd(stats.quote_usd)}</span>
              </div>
              <div className="adminCot__stat">
                <span className="adminCot__stat-label">Eventos 30d</span>
                <span className="adminCot__stat-value">{stats.activity_30d ?? activity.length}</span>
              </div>
              <div className="adminCot__stat">
                <span className="adminCot__stat-label">{stats.agent_name || "IA"} tok 30d</span>
                <span className="adminCot__stat-value">{stats.ai_tokens_30d ?? 0}</span>
              </div>
              <div className="adminCot__stat">
                <span className="adminCot__stat-label">IA USD est.</span>
                <span className="adminCot__stat-value">{moneyUsdEstimate(stats.ai_estimated_cost_usd_30d)}</span>
              </div>
            </section>

            <div className="adminCot__toolbar" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    padding: "8px 12px",
                    border: 0,
                    borderBottom: tab === t.id ? "2px solid var(--ac-accent)" : "2px solid transparent",
                    background: "transparent",
                    color: tab === t.id ? "var(--ac-text)" : "var(--ac-text-2)",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "live" ? <LivePanel slug={slug} token={token} /> : null}
            {tab === "analytics" ? <AnalyticsPanel slug={slug} token={token} /> : null}
            {tab === "ia" ? <TenantAgentEvalPanel slug={slug} token={token} /> : null}

            {tab === "control" ? (
              <section className="adminCot__card">
                <h2 style={{ marginTop: 0, fontSize: 16 }}>Control</h2>
                <p style={{ color: "var(--ac-text-2)", fontSize: 13 }}>
                  Pausar no borra datos. Corta invitaciones del owner y el autosave
                  público de este tenant. El monitor sigue recibiendo eventos.
                </p>
                <dl style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  <div>App {tenant.site ? <a href={tenant.site} target="_blank" rel="noreferrer">{tenant.site}</a> : "—"}</div>
                  <div>Marca {tenant.branding?.marca || tenant.display_name}</div>
                  <div>RUT {tenant.branding?.rut || "—"}</div>
                  <div>PDF {tenant.branding?.pdf_layout || tenant.branding?.layout || "bc"}</div>
                  <div>Agente IA {stats.agent_name || tenant.branding?.agent?.name || "—"}</div>
                </dl>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {paused ? (
                    <button type="button" disabled={busy} onClick={() => setStatus("active")}
                      style={{ padding: "8px 14px", border: 0, borderRadius: 8, background: "var(--ac-success)", color: "#fff", fontWeight: 600 }}>
                      Reanudar
                    </button>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => setStatus("paused")}
                      style={{ padding: "8px 14px", border: 0, borderRadius: 8, background: "var(--ac-warn)", color: "#fff", fontWeight: 600 }}>
                      Pausar tenant
                    </button>
                  )}
                  <button type="button" disabled={busy} onClick={() => exportBundle("json")}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--ac-border)", background: "var(--ac-surface)", fontWeight: 600 }}>
                    Extraer JSON
                  </button>
                  <button type="button" disabled={busy} onClick={() => exportBundle("csv")}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--ac-border)", background: "var(--ac-surface)", fontWeight: 600 }}>
                    Extraer CSV ventas
                  </button>
                </div>
              </section>
            ) : null}

            {tab === "manage" ? (
              <section>
                <form onSubmit={invite} className="adminCot__toolbar">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email Google"
                    style={{ flex: 1, minWidth: 200, padding: "8px 10px", border: "1px solid var(--ac-border)", borderRadius: 8 }}
                  />
                  <select value={role} onChange={(e) => setRole(e.target.value)}
                    style={{ padding: "8px 10px", border: "1px solid var(--ac-border)", borderRadius: 8 }}>
                    <option value="owner">owner</option>
                    <option value="user">user</option>
                  </select>
                  <button type="submit" disabled={busy}
                    style={{ padding: "8px 14px", border: 0, borderRadius: 8, background: "var(--ac-accent)", color: "#fff", fontWeight: 600 }}>
                    Alta
                  </button>
                </form>
                <h2 style={{ fontSize: 16 }}>Cuentas</h2>
                <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                  {(data.members || []).map((m) => {
                    const inv = memberInviteView(m);
                    return (
                    <div key={m.invited_email} className="adminCot__card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div>
                        <strong>{inv.name ? `${inv.name} · ${inv.email}` : inv.email}</strong>
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          <span style={{
                            fontWeight: 700,
                            color: inv.accepted ? "var(--ac-success)" : "var(--ac-warn)",
                          }}>
                            {inv.label}
                          </span>
                          {" · "}{inv.role}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--ac-text-2)", marginTop: 2 }}>
                          Enviada: {whenUy(inv.sent_at)}
                          {inv.accepted
                            ? ` · Aceptó: ${whenUy(inv.accepted_at)}`
                            : " · Todavía no inició sesión con Google en la app del tenant"}
                        </div>
                      </div>
                      <button type="button" disabled={busy} onClick={() => revoke(m.invited_email)}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--ac-border)", background: "transparent", cursor: "pointer" }}>
                        Revocar
                      </button>
                    </div>
                    );
                  })}
                </div>
                <h2 style={{ fontSize: 16 }}>Presupuestos (venta)</h2>
                <div style={{ display: "grid", gap: 8 }}>
                  {quotes.map((q) => (
                    <div key={q.quote_id} className="adminCot__card">
                      <div style={{ fontWeight: 600 }}>
                        {q.code || q.quote_id} · {q.user_email || "anónimo"} · {moneyUsd(q.total_usd)}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ac-text-2)" }}>
                        {q.status} · {whenUy(q.created_at)}
                        {q.usage?.area_m2 ? ` · ${q.usage.area_m2} m²` : ""}
                        {q.cliente ? ` · ${q.cliente}` : ""}
                      </div>
                    </div>
                  ))}
                  {!quotes.length ? <p style={{ color: "var(--ac-text-2)" }}>Todavía no hay copias de venta.</p> : null}
                </div>
              </section>
            ) : null}

            {tab === "monitor" ? (
              <section>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <button type="button" onClick={() => exportBundle("json")}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--ac-border)", background: "var(--ac-surface)", fontWeight: 600 }}>
                    Extraer JSON
                  </button>
                  <button type="button" onClick={() => exportBundle("csv")}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--ac-border)", background: "var(--ac-surface)", fontWeight: 600 }}>
                    Extraer CSV
                  </button>
                </div>
                <h2 style={{ fontSize: 16 }}>Actividad (solo {slug})</h2>
                <div style={{ display: "grid", gap: 6, maxHeight: 520, overflow: "auto" }}>
                  {activity.map((ev) => (
                    <div key={ev.event_id} className="adminCot__card" style={{ padding: "8px 12px", fontSize: 13 }}>
                      <strong>{String(ev.action || "").replace("tenant.", "")}</strong>
                      {" · "}
                      {ev.actor_email || ev.payload?.email || "anónimo"}
                      <div style={{ fontSize: 12, color: "var(--ac-text-2)" }}>
                        {whenUy(ev.at)}
                        {ev.payload?.label ? ` · ${ev.payload.label}` : ""}
                        {ev.payload?.step_id ? ` · paso ${ev.payload.step_id}` : ""}
                        {ev.payload?.path ? ` · ${ev.payload.path}` : ""}
                        {ev.payload?.bc_code ? ` · ${ev.payload.bc_code}` : ""}
                      </div>
                    </div>
                  ))}
                  {!activity.length ? <p style={{ color: "var(--ac-text-2)" }}>Todavía no hay eventos de este tenant.</p> : null}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}

export default function TenantDetailPage() {
  return (
    <SkinProvider>
      <PageInner />
    </SkinProvider>
  );
}
