import { useEffect, useState } from "react";
import { normalizePhoneForWaQuery } from "../../utils/waPhoneNormalize.js";

/**
 * Inline read-only WhatsApp message timeline.
 *
 * Embedded inside `DetailDrawer` when the cotización's origen is WA. Lets the
 * operator (Sandra in particular) see the recent message exchange with the
 * client without opening WA Web on the side.
 *
 * Two sequential fetches:
 *   1. GET /api/wa/conversations?q=<normalizedPhone>&limit=1 → first chat_id match
 *   2. GET /api/wa/messages?chat_id=<chatId>&limit=N           → last N messages
 *
 * Phone normalization (delegated to `src/utils/waPhoneNormalize.js`) is
 * critical: the backend uses `phone ilike '%q%'`, so a raw "99 162 401" from
 * Admin 2.0 won't match the stored "59899162401" without stripping spaces.
 */

const FETCH_TIMEOUT_MS = 12000;
const DEFAULT_LIMIT = 30;

async function fetchJson(url, { token, signal }) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers, signal });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function fmtTs(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) return d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit" }) +
      " " + d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const styles = {
  container: { display: "flex", flexDirection: "column", gap: 6, padding: "8px 4px", maxHeight: 360, overflowY: "auto" },
  msgIn: {
    alignSelf: "flex-start",
    background: "#fff",
    borderRadius: 12,
    padding: "8px 12px",
    margin: "2px 0",
    maxWidth: "82%",
    fontSize: 13,
    lineHeight: 1.4,
    border: "1px solid var(--ac-border, #ececef)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  msgOut: {
    alignSelf: "flex-end",
    background: "#dcf8c6",
    borderRadius: 12,
    padding: "8px 12px",
    margin: "2px 0",
    maxWidth: "82%",
    fontSize: 13,
    lineHeight: 1.4,
    border: "1px solid #cfe9b8",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  ts: { fontSize: 10, color: "var(--ac-text-2, #6e6e73)", marginTop: 2 },
  meta: { fontSize: 11, color: "var(--ac-text-2, #6e6e73)", padding: "6px 4px" },
  empty: { fontSize: 12, color: "var(--ac-text-2, #6e6e73)", padding: "12px 4px", textAlign: "center" },
  error: { fontSize: 12, color: "var(--ac-error, #c33)", padding: "8px 4px" },
};

export default function WaTimelineInline({
  phone,
  token,
  apiBase,
  limit = DEFAULT_LIMIT,
}) {
  const [state, setState] = useState({ status: "idle", error: "", chatId: "", messages: [], contact: null });

  useEffect(() => {
    if (!phone) { setState({ status: "idle", error: "", chatId: "", messages: [], contact: null }); return; }
    if (!token) { setState({ status: "error", error: "Falta el token (cockpit) para leer WA.", chatId: "", messages: [], contact: null }); return; }
    const base = String(apiBase || "").replace(/\/+$/, "");
    if (!base) { setState({ status: "error", error: "API base no configurada.", chatId: "", messages: [], contact: null }); return; }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let cancelled = false;

    (async () => {
      setState((s) => ({ ...s, status: "loading", error: "" }));
      const q = normalizePhoneForWaQuery(phone);
      if (!q) {
        if (!cancelled) setState({ status: "error", error: "Teléfono inválido o vacío.", chatId: "", messages: [], contact: null });
        return;
      }
      try {
        // 1) find the chat
        const convRes = await fetchJson(`${base}/api/wa/conversations?q=${encodeURIComponent(q)}&limit=1`, { token, signal: controller.signal });
        if (!convRes.ok) {
          const err = convRes.status === 503
            ? "WA cockpit no disponible (DATABASE_URL no configurado en el server)."
            : (convRes.data?.error || `HTTP ${convRes.status}`);
          if (!cancelled) setState({ status: "error", error: err, chatId: "", messages: [], contact: null });
          return;
        }
        const item = Array.isArray(convRes.data?.items) ? convRes.data.items[0] : null;
        if (!item?.chat_id) {
          if (!cancelled) setState({ status: "empty", error: "", chatId: "", messages: [], contact: null });
          return;
        }
        // 2) fetch messages
        const msgRes = await fetchJson(
          `${base}/api/wa/messages?chat_id=${encodeURIComponent(item.chat_id)}&limit=${limit}`,
          { token, signal: controller.signal },
        );
        if (!msgRes.ok) {
          const err = msgRes.data?.error || `HTTP ${msgRes.status}`;
          if (!cancelled) setState({ status: "error", error: err, chatId: item.chat_id, messages: [], contact: item });
          return;
        }
        const messages = Array.isArray(msgRes.data?.items) ? msgRes.data.items : [];
        if (!cancelled) setState({ status: "ok", error: "", chatId: item.chat_id, messages, contact: item });
      } catch (e) {
        if (cancelled) return;
        const err = e.name === "AbortError"
          ? `Tiempo de espera (${Math.round(FETCH_TIMEOUT_MS / 1000)}s) — reintentá.`
          : (e.message || "Error de red.");
        setState({ status: "error", error: err, chatId: "", messages: [], contact: null });
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [phone, token, apiBase, limit]);

  if (state.status === "idle") return null;
  if (state.status === "loading") return <div style={styles.meta}>Cargando historial WA…</div>;
  if (state.status === "error")   return <div style={styles.error}>⚠ {state.error}</div>;
  if (state.status === "empty")   return <div style={styles.empty}>Sin historial WA para este número.</div>;

  // status === "ok"
  return (
    <div>
      {state.contact && (
        <div style={styles.meta}>
          {state.contact.contact_name || "—"} · {state.contact.phone || ""} · {state.messages.length} mensaje{state.messages.length === 1 ? "" : "s"}
        </div>
      )}
      <div style={styles.container}>
        {state.messages.map((m) => (
          <div key={m.msg_id} style={m.direction === "out" ? styles.msgOut : styles.msgIn}>
            <div>{m.text || (m.type ? `[${m.type}]` : "")}</div>
            <div style={styles.ts}>{fmtTs(m.ts)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
