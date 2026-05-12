// ═══════════════════════════════════════════════════════════════════════════
// MySpacePage — /mi-espacio
// ───────────────────────────────────────────────────────────────────────────
// Tabs: cotizaciones | bandeja | solicitudes | preferencias
// Master plan §Phase F. Minimal first-pass styling, no Tailwind dependency.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import { useBmcAuth } from "../hooks/useBmcAuth.js";
import { requestAuthGate } from "./auth/AuthGateModal.jsx";

const ApiBase = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/+$/, "");
  }
  return "";
})();

function useTab() {
  const initial = (() => {
    if (typeof window === "undefined") return "cotizaciones";
    const u = new URL(window.location.href);
    return u.searchParams.get("tab") || "cotizaciones";
  })();
  const [tab, setTab] = useState(initial);
  const change = useCallback((next) => {
    setTab(next);
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      u.searchParams.set("tab", next);
      window.history.replaceState({}, "", u.toString());
    }
  }, []);
  return [tab, change];
}

async function api(path, { token, method = "GET", body } = {}) {
  const r = await fetch(`${ApiBase}${path}`, {
    method,
    credentials: "include",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return r.json();
}

export default function MySpacePage() {
  const auth = useBmcAuth();
  const [tab, setTab] = useTab();

  if (auth.status === "loading") return <FullPageMessage>Cargando…</FullPageMessage>;
  if (!auth.isAuthenticated) {
    return (
      <FullPageMessage>
        <div style={{ marginBottom: 12 }}>Iniciá sesión para acceder a tu espacio.</div>
        <button
          type="button"
          onClick={() => requestAuthGate("mi-espacio")}
          style={btnPrimary()}
        >
          Iniciar sesión
        </button>
      </FullPageMessage>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, color: "#0f172a" }}>Mi espacio</h1>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          {auth.user?.email} · plan {auth.plan_tier} · rol {auth.role}
        </div>
      </header>
      <nav style={{ display: "flex", gap: 6, borderBottom: "1px solid #e2e8f0", marginBottom: 16 }}>
        {[
          ["cotizaciones", "Mis cotizaciones"],
          ["bandeja", "Bandeja"],
          ["solicitudes", "Solicitudes"],
          ["preferencias", "Preferencias"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={tabBtn(tab === id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "cotizaciones" ? <QuotesTab token={auth.accessToken} /> : null}
      {tab === "bandeja" ? <InboxTab token={auth.accessToken} /> : null}
      {tab === "solicitudes" ? <RequestsTab token={auth.accessToken} /> : null}
      {tab === "preferencias" ? <PrefsTab user={auth.user} /> : null}
    </div>
  );
}

function QuotesTab({ token }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api("/api/me/quotes", { token }).then((j) => setItems(j.items)).catch((e) => setError(e.message));
  }, [token]);
  if (error) return <Empty>Error: {error}</Empty>;
  if (!items) return <Empty>Cargando…</Empty>;
  if (!items.length) return (
    // Top-20 run 2026-05-11 (#L6): empty state con call-to-action al cotizador.
    <Empty>
      Aún no tenés cotizaciones guardadas.
      <div style={{ marginTop: 12 }}>
        <a
          href="/"
          style={{ display: "inline-block", padding: "8px 16px", borderRadius: 8, background: "#0071e3", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600 }}
        >
          Crear nueva cotización →
        </a>
      </div>
    </Empty>
  );
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((q) => (
        <div key={q.quote_id} style={cardStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                Cotización {q.quote_id.slice(0, 8)}
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                {new Date(q.created_at).toLocaleString("es-UY")} · {q.status}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                {q.total_usd ? `USD ${Number(q.total_usd).toFixed(2)}` : "—"}
              </div>
              {Number(q.total_usd) > 8500 ? <SpecialQuoteCta token={token} quoteId={q.quote_id} totalUsd={q.total_usd} /> : null}
            </div>
          </div>
          {q.pdf_url ? (
            <a
              href={q.pdf_url}
              target="_blank"
              rel="noreferrer"
              style={{ marginTop: 6, fontSize: 12, color: "#2563eb", textDecoration: "none" }}
            >
              Ver PDF →
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function SpecialQuoteCta({ token, quoteId, totalUsd }) {
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState(null);
  const submit = useCallback(async () => {
    try {
      await api("/api/me/special-quote-requests", {
        token, method: "POST", body: { quoteId, notes: `Total USD ${totalUsd}` },
      });
      setSubmitted(true);
    } catch (e) {
      setErr(e.message);
    }
  }, [token, quoteId, totalUsd]);
  if (submitted) return <div style={{ fontSize: 11, color: "#16a34a", marginTop: 4 }}>Solicitud enviada</div>;
  return (
    <button
      type="button"
      onClick={submit}
      style={{
        marginTop: 4,
        fontSize: 11,
        padding: "4px 8px",
        borderRadius: 6,
        border: "1px solid #f59e0b",
        background: "#fef3c7",
        color: "#92400e",
        cursor: "pointer",
      }}
    >
      {err ? `Error: ${err}` : "Solicitar presupuesto especial"}
    </button>
  );
}

function InboxTab({ token }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const refresh = useCallback(() => {
    api("/api/me/notifications", { token }).then((j) => setItems(j.items)).catch((e) => setError(e.message));
  }, [token]);
  useEffect(() => { refresh(); }, [refresh]);
  const markRead = useCallback(async (id) => {
    await api(`/api/me/notifications/${id}`, { token, method: "PATCH" });
    refresh();
  }, [token, refresh]);
  if (error) return <Empty>Error: {error}</Empty>;
  if (!items) return <Empty>Cargando…</Empty>;
  if (!items.length) return <Empty>Sin notificaciones.</Empty>;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {items.map((n) => (
        <div key={n.notification_id} style={{ ...cardStyle(), opacity: n.read_at ? 0.6 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
              {n.body ? <div style={{ fontSize: 12, color: "#64748b" }}>{n.body}</div> : null}
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
                {new Date(n.created_at).toLocaleString("es-UY")}
              </div>
            </div>
            {!n.read_at ? (
              <button
                type="button"
                onClick={() => markRead(n.notification_id)}
                style={{ fontSize: 11, padding: "2px 8px", border: "1px solid #e2e8f0", borderRadius: 4, background: "#fff", cursor: "pointer" }}
              >
                Marcar leída
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function RequestsTab({ token }) {
  const [accessReq, setAccessReq] = useState(null);
  const [specialReq, setSpecialReq] = useState(null);
  useEffect(() => {
    Promise.all([
      api("/api/me/access-requests", { token }),
      api("/api/me/special-quote-requests", { token }),
    ])
      .then(([a, s]) => { setAccessReq(a.items); setSpecialReq(s.items); })
      .catch(() => {});
  }, [token]);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section>
        <h3 style={{ margin: "0 0 6px", fontSize: 14 }}>Acceso a módulos</h3>
        {accessReq?.length ? (
          accessReq.map((r) => (
            <div key={r.request_id} style={cardStyle()}>
              <div style={{ fontSize: 13 }}>
                <strong>{r.module}</strong> · {r.status}
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                {new Date(r.created_at).toLocaleString("es-UY")}
              </div>
            </div>
          ))
        ) : (
          <Empty>Sin solicitudes.</Empty>
        )}
      </section>
      <section>
        <h3 style={{ margin: "0 0 6px", fontSize: 14 }}>Presupuestos especiales</h3>
        {specialReq?.length ? (
          specialReq.map((r) => (
            <div key={r.request_id} style={cardStyle()}>
              <div style={{ fontSize: 13 }}>
                Cotización {String(r.quote_id).slice(0, 8)} · USD {Number(r.total_usd || 0).toFixed(2)}
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                {r.status} · {new Date(r.created_at).toLocaleString("es-UY")}
              </div>
            </div>
          ))
        ) : (
          <Empty>Sin pedidos.</Empty>
        )}
      </section>
    </div>
  );
}

function PrefsTab({ user }) {
  return (
    <div style={cardStyle()}>
      <h3 style={{ margin: "0 0 6px", fontSize: 14 }}>Perfil</h3>
      <dl style={{ margin: 0, fontSize: 13 }}>
        <dt style={dtStyle()}>Nombre</dt>
        <dd style={ddStyle()}>{user?.name || "—"}</dd>
        <dt style={dtStyle()}>Email</dt>
        <dd style={ddStyle()}>{user?.email}</dd>
        <dt style={dtStyle()}>Avatar</dt>
        <dd style={ddStyle()}>{user?.picture ? "Google profile picture" : user?.avatar_preset || "default"}</dd>
      </dl>
      <p style={{ marginTop: 12, fontSize: 11, color: "#94a3b8" }}>
        (Edición de avatar y consentimientos: pendiente — Phase J)
      </p>
    </div>
  );
}

// ─── Style helpers ─────────────────────────────────────────────────────

function tabBtn(active) {
  return {
    padding: "8px 12px",
    background: "transparent",
    border: "none",
    borderBottom: active ? "2px solid #0f172a" : "2px solid transparent",
    color: active ? "#0f172a" : "#64748b",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
  };
}
function cardStyle() {
  return {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "10px 12px",
    background: "#fff",
  };
}
function btnPrimary() {
  return {
    padding: "8px 14px",
    borderRadius: 8,
    background: "#0f172a",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
  };
}
function dtStyle() {
  return { color: "#64748b", fontSize: 11, marginTop: 6 };
}
function ddStyle() {
  return { margin: "2px 0 0", color: "#0f172a", fontSize: 13 };
}
function FullPageMessage({ children }) {
  return (
    <div style={{ minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center", padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center" }}>{children}</div>
    </div>
  );
}
function Empty({ children }) {
  return <div style={{ ...cardStyle(), color: "#94a3b8", textAlign: "center" }}>{children}</div>;
}
