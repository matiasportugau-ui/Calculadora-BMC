// /hub/admin/tenants — BMC fleet: control, manage, monitor each tenant.
import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { SkinProvider, useSkin } from "../../admin-cotizaciones/SkinProvider.jsx";
import "../../admin-cotizaciones/styles.css";
import { useBmcAuth } from "../../../hooks/useBmcAuth.js";
import { lightColor, moneyUsd, moneyUsdEstimate, tenantAdminFetch, whenUy } from "./tenantAdminApi.js";

function Stat({ label, value, variant }) {
  const cls = `adminCot__stat${variant ? ` adminCot__stat--${variant}` : ""}`;
  return (
    <div className={cls}>
      <span className="adminCot__stat-label">{label}</span>
      <span className="adminCot__stat-value">{value}</span>
    </div>
  );
}

function ModuleInner() {
  const { skin } = useSkin();
  const auth = useBmcAuth();
  const token = auth?.accessToken;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const j = await tenantAdminFetch("/api/admin/tenants", { token });
      setData(j);
    } catch (e) {
      setError(e.message || "fetch_failed");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  const items = data?.items || [];
  const summary = data?.summary || { tenants: 0, active: 0, paused: 0, quotes: 0, quote_usd: 0 };
  const onlineNow = items.filter((t) => t.light === "online").length;

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
          <span style={{ color: "var(--ac-text)" }}>tenants</span>
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={refresh}
            style={{
              padding: "6px 12px", borderRadius: "var(--ac-radius-sm)",
              border: "1px solid var(--ac-border)", background: "var(--ac-surface)",
              color: "var(--ac-text)", fontWeight: 600, cursor: "pointer",
            }}
          >
            Actualizar
          </button>
          <span className="adminCot__live" aria-live="polite">
            <span className="adminCot__live-dot" data-state={loading ? "busy" : error ? "error" : "ok"} />
            {loading ? "Cargando…" : error ? "Error" : "En vivo"}
          </span>
        </div>
      </header>

      <main style={{ padding: 16, maxWidth: 1280, margin: "0 auto", width: "100%" }}>
        <h1 style={{ margin: "8px 0 6px", fontSize: 22, fontWeight: 700, color: "var(--ac-text)" }}>
          Control de tenants
        </h1>
        <p style={{ margin: "0 0 12px", color: "var(--ac-text-2)", fontSize: 13, maxWidth: 720 }}>
          Cada socio (BC, LAM, SmartBuilding) es un silo: cuentas, presupuestos y
          actividad no se mezclan. Pausar corta altas y autosave de ese tenant solamente.
        </p>

        {error ? (
          <div className="adminCot__card" style={{ borderColor: "var(--ac-error)", color: "var(--ac-error)", marginBottom: 14 }}>
            {error}
          </div>
        ) : null}

        <section className="adminCot__stats" aria-label="Resumen de tenants">
          <Stat label="Tenants" value={summary.tenants} />
          <Stat label="En línea" value={onlineNow} variant="success" />
          <Stat label="Pausados" value={summary.paused} variant={summary.paused ? "warn" : undefined} />
          <Stat label="Presupuestos" value={summary.quotes} />
          <Stat label="Venta USD" value={moneyUsd(summary.quote_usd)} />
        </section>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 12,
        }}>
          {items.map((t) => {
            const light = t.light || (t.status === "paused" ? "paused" : "silent");
            return (
              <article
                key={t.slug}
                className="adminCot__card"
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 16 }}>{t.display_name}</h2>
                    <div style={{ fontSize: 12, color: "var(--ac-text-2)" }}>{t.legal_name || t.slug}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: lightColor(light),
                  }}>
                    {t.label || (t.status === "paused" ? "pausado" : "activo")}
                  </span>
                </div>
                <dl style={{
                  margin: 0, display: "grid", gridTemplateColumns: "1fr 1fr",
                  gap: "6px 12px", fontSize: 13, color: "var(--ac-text-2)",
                }}>
                  <div>Cuentas <strong style={{ color: "var(--ac-text)" }}>{t.claimed_count}/{t.member_count}</strong></div>
                  <div>Cotis <strong style={{ color: "var(--ac-text)" }}>{t.quote_count}</strong></div>
                  <div>Venta <strong style={{ color: "var(--ac-text)" }}>{moneyUsd(t.quote_usd)}</strong></div>
                  <div>Eventos 30d <strong style={{ color: "var(--ac-text)" }}>{t.activity_30d}</strong></div>
                  <div>Agente <strong style={{ color: "var(--ac-text)" }}>{t.agent_name || "—"}</strong></div>
                  <div>IA 30d <strong style={{ color: "var(--ac-text)" }}>{t.tokens_30d || 0} tok · {moneyUsdEstimate(t.estimated_cost_usd_30d)}</strong></div>
                </dl>
                <div style={{ fontSize: 12, color: "var(--ac-text-3)" }}>
                  Última actividad: {whenUy(t.last_activity_at || t.last_quote_at)}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                  <Link
                    to={`/hub/admin/tenant/${t.slug}`}
                    style={{
                      padding: "8px 12px", borderRadius: "var(--ac-radius-sm)",
                      background: "var(--ac-accent)", color: "var(--ac-accent-fg)",
                      textDecoration: "none", fontWeight: 600, fontSize: 13,
                    }}
                  >
                    Controlar
                  </Link>
                  {t.site ? (
                    <a
                      href={t.site}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: "8px 12px", borderRadius: "var(--ac-radius-sm)",
                        border: "1px solid var(--ac-border)", color: "var(--ac-text)",
                        textDecoration: "none", fontWeight: 600, fontSize: 13,
                      }}
                    >
                      Abrir app
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
        {!loading && !items.length && !error ? (
          <p style={{ color: "var(--ac-text-2)" }}>No hay tenants en identity.tenants.</p>
        ) : null}
      </main>
    </div>
  );
}

export default function TenantControlModule() {
  return (
    <SkinProvider>
      <ModuleInner />
    </SkinProvider>
  );
}
