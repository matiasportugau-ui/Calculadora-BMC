// ═══════════════════════════════════════════════════════════════════════════
// src/components/me/HistorialTab.jsx — per-user activity history.
// ───────────────────────────────────────────────────────────────────────────
// Reads from GET /api/me/activity (rate-limited 60/min). Backend enforces
// per-user isolation; this tab only filters/displays.
//
// UX:
//   - Grouped by relative date: Hoy / Ayer / Esta semana / Anterior
//   - Filter chips for module + outcome
//   - Search box queries action + resource_id + payload
//   - Infinite-scroll via keyset cursor
//   - Each row: module icon, Spanish-language verb, resource link if possible
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBmcAuth } from "../../hooks/useBmcAuth.js";

const ApiBase = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/+$/, "");
  }
  return "";
})();

// ── Display dictionaries ──────────────────────────────────────────────
// Spanish-language labels for action strings. Falls back to the raw action
// if not mapped. Keeps the per-user view friendly without forcing every
// new action to add a label (display defaults are fine for analytics).
const ACTION_LABELS = {
  "auth.session.start": "Inicio de sesión",
  "auth.session.end": "Cierre de sesión",
  "auth.login": "Inicio de sesión",
  "auth.logout": "Cierre de sesión",
  "auth.refresh": "Token renovado",
  "auth.mfa_required": "MFA requerido",
  "admin.role_grant.add": "Rol agregado",
  "admin.role_grant.remove": "Rol quitado",
  "admin.module_grant.set": "Permiso de módulo modificado",
  "admin.user.suspend": "Usuario suspendido",
  "admin.user.reactivate": "Usuario reactivado",
  "admin.user.revoke_sessions": "Sesiones revocadas",
  "quote.draft.create": "Borrador de cotización creado",
  "quote.draft.update": "Cotización actualizada",
  "quote.complete": "Cotización finalizada",
  "quote.export.pdf": "PDF exportado",
  "quote.export.csv": "CSV exportado",
  "quote.send.whatsapp": "Cotización enviada por WhatsApp",
  "wa.message.send": "Mensaje WhatsApp enviado",
  "ml.respuesta.approve": "Respuesta ML aprobada",
  "canales.export": "Canales exportado",
  "tareas.connect.start": "Inicio de conexión Google Tasks",
  "tareas.connect.complete": "Google Tasks conectado",
  "tareas.list.sync": "Lista de tareas sincronizada",
  "tareas.task.create": "Tarea creada",
  "message.thread.create": "Hilo de mensajes creado",
  "message.reply": "Respuesta enviada",
  "message.read": "Hilo marcado como leído",
  "traktime.timer.start": "Timer iniciado",
  "traktime.timer.stop": "Timer detenido",
  "traktime.invoice.draft": "Factura en borrador",
  "traktime.invoice.issue": "Factura emitida",
  "nav.route.change": "Navegación",
  "ui.drawer.open": "Panel abierto",
  "ui.search.submit": "Búsqueda",
};

const MODULE_LABELS = {
  auth: "Auth",
  admin: "Admin",
  calc: "Calculadora",
  wa: "WhatsApp",
  ml: "Mercado Libre",
  canales: "Canales",
  tareas: "Tareas",
  me: "Mi espacio",
  traktime: "TraKtiMe",
  nav: "Navegación",
  ui: "UI",
};

const MODULE_COLORS = {
  auth: ["#e0e7ff", "#3730a3"],
  admin: ["#fef3c7", "#92400e"],
  calc: ["#dbeafe", "#1d4ed8"],
  wa: ["#dcfce7", "#16a34a"],
  ml: ["#fef9c3", "#854d0e"],
  canales: ["#f3e8ff", "#7c3aed"],
  tareas: ["#d1fae5", "#065f46"],
  me: ["#e0f2fe", "#0369a1"],
  traktime: ["#fce7f3", "#9f1239"],
  nav: ["#f1f5f9", "#475569"],
  ui: ["#f1f5f9", "#475569"],
};

function moduleLabel(m) {
  return MODULE_LABELS[m] || m || "—";
}
function modulePillColors(m) {
  return MODULE_COLORS[m] || ["#f0f0f2", "#6e6e73"];
}
function actionLabel(action) {
  return ACTION_LABELS[action] || action;
}

// ── Date grouping helpers ─────────────────────────────────────────────
function groupKey(iso) {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
  const startOfWeek = new Date(startOfToday.getTime() - 6 * 86_400_000);
  if (d >= startOfToday) return "Hoy";
  if (d >= startOfYesterday) return "Ayer";
  if (d >= startOfWeek) return "Esta semana";
  return "Anterior";
}

function relativeTime(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "ahora";
  if (ms < 3600_000) return `hace ${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `hace ${Math.floor(ms / 3600_000)}h`;
  if (ms < 7 * 86_400_000) return `hace ${Math.floor(ms / 86_400_000)}d`;
  return new Date(iso).toLocaleDateString("es-UY");
}

// ── Component ─────────────────────────────────────────────────────────
export default function HistorialTab() {
  const auth = useBmcAuth();
  const token = auth?.accessToken;

  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [moduleFilter, setModuleFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const searchDebounceRef = useRef(null);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearchDebounced(search), 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [search]);

  const fetchPage = useCallback(async (append) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (moduleFilter) params.set("module", moduleFilter);
    if (outcomeFilter) params.set("outcome", outcomeFilter);
    if (searchDebounced) params.set("q", searchDebounced);
    params.set("limit", "50");
    if (append && nextCursor) {
      params.set("cursor_ts", nextCursor.ts);
      params.set("cursor_id", String(nextCursor.id));
    }
    try {
      const r = await fetch(`${ApiBase}/api/me/activity?${params}`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (!r.ok) { setError(data?.error || `http_${r.status}`); setLoading(false); return; }
      setItems((prev) => append ? [...prev, ...(data.items || [])] : (data.items || []));
      setNextCursor(data.next_cursor || null);
    } catch (e) {
      setError(e.message || "network_error");
    } finally {
      setLoading(false);
    }
  }, [token, moduleFilter, outcomeFilter, searchDebounced, nextCursor]);

  useEffect(() => {
    fetchPage(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, moduleFilter, outcomeFilter, searchDebounced]);

  const groups = useMemo(() => {
    const out = { Hoy: [], Ayer: [], "Esta semana": [], Anterior: [] };
    for (const it of items) {
      const k = groupKey(it.at);
      out[k].push(it);
    }
    return out;
  }, [items]);

  const moduleOptions = useMemo(() => Object.keys(MODULE_LABELS), []);

  return (
    <div>
      <div style={toolbar}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar (acción, recurso, contenido)…"
          style={{ ...inputStyle, flex: "1 1 240px", minWidth: 200 }}
          aria-label="Buscar en historial"
        />
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} style={selectStyle} aria-label="Filtrar por módulo">
          <option value="">Todos los módulos</option>
          {moduleOptions.map((m) => <option key={m} value={m}>{moduleLabel(m)}</option>)}
        </select>
        <select value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value)} style={selectStyle} aria-label="Filtrar por resultado">
          <option value="">Todos los resultados</option>
          <option value="success">Éxito</option>
          <option value="failure">Falla</option>
          <option value="pending">Pendiente</option>
          <option value="orphan">Sesión cerrada por inactividad</option>
        </select>
      </div>

      {error ? <div style={errorBox}>Error: {error}</div> : null}

      {loading && items.length === 0 ? (
        <div style={emptyBox}>Cargando historial…</div>
      ) : items.length === 0 ? (
        <div style={emptyBox}>Sin actividad registrada para los filtros actuales.</div>
      ) : (
        <>
          {["Hoy", "Ayer", "Esta semana", "Anterior"].map((g) => {
            const list = groups[g];
            if (!list.length) return null;
            return (
              <section key={g} style={{ marginBottom: 18 }}>
                <h3 style={dateHeader}>{g} <span style={dateCount}>· {list.length} evento{list.length === 1 ? "" : "s"}</span></h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {list.map((ev) => <ActivityRow key={ev.event_id} ev={ev} />)}
                </ul>
              </section>
            );
          })}
          {nextCursor ? (
            <div style={{ textAlign: "center", padding: "8px 0 24px" }}>
              <button type="button" onClick={() => fetchPage(true)} disabled={loading} style={loadMoreBtn}>
                {loading ? "Cargando…" : "Cargar más"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function ActivityRow({ ev }) {
  const [bg, fg] = modulePillColors(ev.module);
  return (
    <li style={rowStyle}>
      <span style={{ ...modulePill, background: bg, color: fg }}>{moduleLabel(ev.module)}</span>
      <span style={actionText}>{actionLabel(ev.action)}</span>
      {ev.resource_id ? (
        <span style={resourceMeta} title={`${ev.resource_type || "resource"}:${ev.resource_id}`}>
          {ev.resource_type || "ref"}:{ev.resource_id.slice(0, 8)}…
        </span>
      ) : null}
      {ev.outcome !== "success" ? (
        <span style={{ ...outcomeBadge, background: ev.outcome === "failure" ? "#fee2e2" : "#fef9c3", color: ev.outcome === "failure" ? "#991b1b" : "#854d0e" }}>
          {ev.outcome}
        </span>
      ) : null}
      <span style={timeMeta}>{relativeTime(ev.at)}</span>
    </li>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const toolbar = { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 };
const inputStyle = { padding: "8px 12px", fontSize: 13, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#0f172a" };
const selectStyle = { padding: "8px 10px", fontSize: 13, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#0f172a", fontFamily: "inherit" };
const dateHeader = { margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 };
const dateCount = { fontWeight: 400, color: "#94a3b8", textTransform: "none", letterSpacing: 0 };
const rowStyle = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "8px 12px", marginBottom: 4,
  border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff",
  fontSize: 13,
};
const modulePill = { padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600, flexShrink: 0 };
const actionText = { color: "#0f172a", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const resourceMeta = { fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#64748b", flexShrink: 0 };
const outcomeBadge = { padding: "2px 6px", borderRadius: 6, fontSize: 10, fontWeight: 600, flexShrink: 0 };
const timeMeta = { color: "#94a3b8", fontSize: 11, flexShrink: 0, marginLeft: "auto" };
const errorBox = { padding: 12, border: "1px solid #fecaca", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13, marginBottom: 12 };
const emptyBox = { padding: 24, color: "#94a3b8", textAlign: "center", border: "1px dashed #e2e8f0", borderRadius: 8, background: "#fafafa", fontSize: 13 };
const loadMoreBtn = { padding: "8px 16px", fontSize: 13, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#0f172a", cursor: "pointer", fontFamily: "inherit" };
