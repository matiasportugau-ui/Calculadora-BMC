// ═══════════════════════════════════════════════════════════════════════════
// MySpacePage — /mi-espacio
// ───────────────────────────────────────────────────────────────────────────
// Tabs: cotizaciones | bandeja | mensajes | tareas | solicitudes | preferencias
// Plus KPI strip with quote/inbox/messages/pending counters.
// Inline styles only (no Tailwind dependency — matches repo convention).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import { useBmcAuth } from "../hooks/useBmcAuth.js";
import { requestAuthGate } from "./auth/AuthGateModal.jsx";
import HistorialTab from "./me/HistorialTab.jsx";

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
      <KpiStrip token={auth.accessToken} onClickTab={setTab} />
      <nav style={{ display: "flex", gap: 6, borderBottom: "1px solid #e2e8f0", marginBottom: 16, flexWrap: "wrap" }}>
        {[
          ["cotizaciones", "Mis cotizaciones"],
          ["bandeja", "Bandeja"],
          ["mensajes", "Mensajes"],
          ["historial", "Historial"],
          ["tareas", "Tareas"],
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
      {tab === "mensajes" ? <MessagesTab token={auth.accessToken} userId={auth.user?.id} /> : null}
      {tab === "historial" ? <HistorialTab /> : null}
      {tab === "tareas" ? <TareasSummaryTab token={auth.accessToken} /> : null}
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
        {/* Frontend run 2026-05-12 (#FE4): hover state — opacidad reducida + transition para feedback visual. */}
        <a
          href="/"
          style={{ display: "inline-block", padding: "8px 16px", borderRadius: 8, background: "#0071e3", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600, transition: "opacity 150ms" }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
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

// ─── KPI Strip ────────────────────────────────────────────────────────

function KpiStrip({ token, onClickTab }) {
  const [counts, setCounts] = useState({ quotes: null, unread: null, messages: null, pending: null, eventsToday: null });
  useEffect(() => {
    let cancelled = false;
    const startOfDayIso = (() => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
    })();
    Promise.all([
      api("/api/me/quotes?limit=1", { token }).catch(() => null),
      api("/api/me/notifications?unread=true&limit=200", { token }).catch(() => null),
      api("/api/me/threads", { token }).catch(() => null),
      api("/api/me/access-requests", { token }).catch(() => null),
      api(`/api/me/activity?from=${encodeURIComponent(startOfDayIso)}&limit=200`, { token }).catch(() => null),
    ]).then(([q, n, t, ar, act]) => {
      if (cancelled) return;
      setCounts({
        quotes: q?.items?.length ?? null,
        unread: n?.items?.length ?? null,
        messages: (t?.items || []).reduce((sum, it) => sum + (Number(it.unread_count) || 0), 0),
        pending: (ar?.items || []).filter((r) => r.status === "pending").length,
        eventsToday: act?.items?.length ?? null,
      });
    });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      gap: 10,
      marginBottom: 16,
    }}>
      <KpiCard label="Cotizaciones" value={counts.quotes ?? "—"} onClick={() => onClickTab("cotizaciones")} />
      <KpiCard label="Inbox sin leer" value={counts.unread ?? "—"} variant={counts.unread > 0 ? "warn" : ""} onClick={() => onClickTab("bandeja")} />
      <KpiCard label="Mensajes sin leer" value={counts.messages ?? "—"} variant={counts.messages > 0 ? "accent" : ""} onClick={() => onClickTab("mensajes")} />
      <KpiCard label="Eventos hoy" value={counts.eventsToday ?? "—"} variant={counts.eventsToday > 0 ? "accent" : ""} onClick={() => onClickTab("historial")} />
      <KpiCard label="Solicitudes pendientes" value={counts.pending ?? "—"} onClick={() => onClickTab("solicitudes")} />
    </div>
  );
}

function KpiCard({ label, value, variant, onClick }) {
  const accent = variant === "warn" ? "#c86000" : variant === "accent" ? "#1d4ed8" : "#0f172a";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        background: "#fff",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: accent, marginTop: 4 }}>{value}</div>
    </button>
  );
}

// ─── Messages Tab ─────────────────────────────────────────────────────

function MessagesTab({ token, userId }) {
  const [threads, setThreads] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    api("/api/me/threads", { token }).then((j) => setThreads(j.items)).catch((e) => setError(e.message));
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  if (error) return <Empty>Error: {error}</Empty>;
  if (threads === null) return <Empty>Cargando…</Empty>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 280px) 1fr", gap: 12 }}>
      <aside style={{ borderRight: "1px solid #e2e8f0", paddingRight: 8 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <strong style={{ fontSize: 13, flex: 1 }}>Hilos</strong>
          <NewThreadButton token={token} onCreated={(t) => { refresh(); setSelected(t.thread_id); }} />
        </div>
        {threads.length === 0 ? (
          <Empty>Sin hilos. Creá uno con +.</Empty>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {threads.map((t) => (
              <li key={t.thread_id}>
                <button
                  type="button"
                  onClick={() => setSelected(t.thread_id)}
                  style={{
                    width: "100%", textAlign: "left", padding: "8px 10px",
                    borderRadius: 6, border: "none",
                    background: selected === t.thread_id ? "#eff6ff" : "transparent",
                    cursor: "pointer", marginBottom: 4,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{t.subject}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    {Number(t.unread_count) > 0 ? `🔵 ${t.unread_count} sin leer · ` : ""}
                    {t.last_message?.body?.slice(0, 50) || "(sin mensajes)"}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <section>
        {selected ? (
          <ThreadView threadId={selected} token={token} userId={userId} onReplied={refresh} />
        ) : (
          <Empty>Seleccioná un hilo o creá uno nuevo.</Empty>
        )}
      </section>
    </div>
  );
}

function ThreadView({ threadId, token, userId, onReplied }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const refresh = useCallback(() => {
    api(`/api/me/threads/${threadId}/messages`, { token })
      .then((j) => setData(j))
      .catch((e) => setError(e.message));
  }, [threadId, token]);

  useEffect(() => {
    refresh();
    // mark read on open
    api(`/api/me/threads/${threadId}/read`, { token, method: "PATCH" }).catch(() => { /* ignore */ });
  }, [refresh, threadId, token]);

  const send = useCallback(async () => {
    const body = reply.trim();
    if (!body) return;
    setSending(true);
    try {
      await api(`/api/me/threads/${threadId}/messages`, { token, method: "POST", body: { body } });
      setReply("");
      refresh();
      onReplied?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }, [reply, threadId, token, refresh, onReplied]);

  if (error) return <Empty>Error: {error}</Empty>;
  if (!data) return <Empty>Cargando hilo…</Empty>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 320 }}>
      <header style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{data.thread?.subject}</h3>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
          {data.members?.length || 0} participante(s): {(data.members || []).map((m) => m.name || m.email).join(", ")}
        </div>
      </header>
      <div style={{ flex: 1, overflowY: "auto", marginBottom: 12 }}>
        {data.messages?.length === 0 ? (
          <Empty>Sin mensajes todavía.</Empty>
        ) : (
          (data.messages || []).map((m) => {
            const mine = m.from_user_id === userId;
            return (
              <div
                key={m.message_id}
                style={{
                  display: "flex",
                  justifyContent: mine ? "flex-end" : "flex-start",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    maxWidth: "70%",
                    padding: "8px 12px",
                    borderRadius: 12,
                    background: mine ? "#0f172a" : "#f1f5f9",
                    color: mine ? "#fff" : "#0f172a",
                    fontSize: 13,
                  }}
                >
                  {!mine ? (
                    <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 4, opacity: 0.7 }}>
                      {m.from_name || m.from_email}
                    </div>
                  ) : null}
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
                  <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>
                    {new Date(m.created_at).toLocaleString("es-UY")}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Escribí tu respuesta…"
          rows={2}
          style={{
            flex: 1, padding: 8, fontSize: 13, borderRadius: 6,
            border: "1px solid #e2e8f0", fontFamily: "inherit", resize: "vertical",
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !reply.trim()}
          style={{ ...btnPrimary(), opacity: !reply.trim() || sending ? 0.5 : 1 }}
        >
          {sending ? "…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}

function NewThreadButton({ token, onCreated }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [members, setMembers] = useState([]); // [{user_id, email, name}]
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: "4px 10px", fontSize: 18, border: "1px solid #e2e8f0",
          borderRadius: 6, background: "#fff", cursor: "pointer",
        }}
        title="Nuevo hilo"
      >+</button>
    );
  }

  const submit = async () => {
    if (!members.length) { setErr("missing_members"); return; }
    setBusy(true); setErr(null);
    try {
      const j = await api("/api/me/threads", {
        token, method: "POST",
        body: { subject, body, member_user_ids: members.map((m) => m.user_id) },
      });
      onCreated?.(j.thread);
      setOpen(false); setSubject(""); setBody(""); setMembers([]);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: "absolute", marginTop: 30, marginLeft: -120, zIndex: 10,
      width: 340, background: "#fff", border: "1px solid #e2e8f0",
      borderRadius: 8, padding: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
    }}>
      <input
        placeholder="Asunto"
        value={subject} onChange={(e) => setSubject(e.target.value)}
        style={{ width: "100%", padding: 6, marginBottom: 6, border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 13 }}
      />
      <UserPicker
        token={token}
        selected={members}
        onAdd={(u) => setMembers((prev) => prev.find((x) => x.user_id === u.user_id) ? prev : [...prev, u])}
        onRemove={(uid) => setMembers((prev) => prev.filter((x) => x.user_id !== uid))}
      />
      <textarea
        placeholder="Mensaje inicial"
        value={body} onChange={(e) => setBody(e.target.value)}
        rows={3}
        style={{ width: "100%", padding: 6, marginBottom: 6, border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 13, fontFamily: "inherit" }}
      />
      {err ? <div style={{ color: "#b91c1c", fontSize: 11, marginBottom: 6 }}>Error: {err}</div> : null}
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" onClick={submit} disabled={busy || !subject || !body || !members.length} style={btnPrimary()}>
          {busy ? "…" : "Crear hilo"}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ ...btnPrimary(), background: "#fff", color: "#0f172a", border: "1px solid #e2e8f0" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// Lightweight user picker — searches /api/me/users/search (open to any
// authenticated user; returns only id/email/name/picture). Used inside
// MySpacePage's NewThreadButton so compradores can find each other
// without depending on the admin-only /api/admin/users endpoint.
function UserPicker({ token, selected, onAdd, onRemove }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = React.useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api(`/api/me/users/search?q=${encodeURIComponent(q)}`, { token });
        setResults(r.items || []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, token]);

  return (
    <div style={{ marginBottom: 6 }}>
      {selected.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
          {selected.map((u) => (
            <span key={u.user_id} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 6px 2px 8px", fontSize: 11, background: "#eff6ff",
              color: "#1d4ed8", borderRadius: 12,
            }}>
              {u.email}
              <button
                type="button"
                onClick={() => onRemove(u.user_id)}
                style={{ background: "none", border: "none", color: "#1d4ed8", cursor: "pointer", padding: 0, lineHeight: 1 }}
                aria-label={`Quitar ${u.email}`}
              >×</button>
            </span>
          ))}
        </div>
      ) : null}
      <input
        placeholder="Buscar destinatarios por email o nombre…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: "100%", padding: 6, border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 12 }}
      />
      {loading && q.length >= 2 ? <div style={{ fontSize: 11, color: "#94a3b8", padding: "4px 0" }}>Buscando…</div> : null}
      {results.length > 0 ? (
        <ul style={{
          listStyle: "none", padding: 4, margin: "4px 0 0",
          border: "1px solid #e2e8f0", borderRadius: 4, maxHeight: 140, overflowY: "auto",
          background: "#fff",
        }}>
          {results.map((u) => (
            <li
              key={u.user_id}
              onClick={() => { onAdd(u); setQ(""); setResults([]); }}
              style={{ padding: "6px 8px", cursor: "pointer", fontSize: 12, borderRadius: 4 }}
            >
              <div style={{ fontWeight: 600, color: "#0f172a" }}>{u.email}</div>
              {u.name ? <div style={{ fontSize: 11, color: "#64748b" }}>{u.name}</div> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ─── Tareas Summary Tab ───────────────────────────────────────────────

function TareasSummaryTab({ token }) {
  const [lists, setLists] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${ApiBase}/api/tasks/lists`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (r) => {
        if (r.status === 503) { setLists([]); return; }
        if (!r.ok) throw new Error(`http_${r.status}`);
        const j = await r.json();
        setLists(j.lists || []);
      })
      .catch((e) => setError(e.message));
  }, [token]);

  if (error) return <Empty>Error: {error}</Empty>;
  if (lists === null) return <Empty>Cargando…</Empty>;

  return (
    <div style={cardStyle()}>
      <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Resumen de Tareas</h3>
      {lists.length === 0 ? (
        <>
          <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 13 }}>
            Aún no conectaste Google Tasks. Conectalo desde el módulo Tareas para sincronizar tus listas.
          </p>
          <a href="/hub/tareas" style={btnPrimary()}>Abrir Tareas</a>
        </>
      ) : (
        <>
          <p style={{ margin: "0 0 12px", color: "#0f172a", fontSize: 13 }}>
            {lists.length} lista{lists.length === 1 ? "" : "s"} sincronizada{lists.length === 1 ? "" : "s"}.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px" }}>
            {lists.slice(0, 5).map((l) => (
              <li key={l.id} style={{ padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                <strong style={{ color: "#0f172a" }}>{l.title}</strong>
                {l.synced_at ? (
                  <span style={{ marginLeft: 8, fontSize: 11, color: "#64748b" }}>
                    · sync {new Date(l.synced_at).toLocaleString("es-UY")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <a href="/hub/tareas" style={btnPrimary()}>Abrir Tareas</a>
        </>
      )}
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
