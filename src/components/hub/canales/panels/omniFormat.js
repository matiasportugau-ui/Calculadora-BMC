// omniFormat.js — small presentational helpers for the Omni inbox (Chatwoot-style UX).
// Pure, dependency-free. Defensive against missing fields (the API shapes vary by channel).

/** Channel → display label, short code, and a token-driven accent color. */
const CHANNEL_META = {
  wa: { label: "WhatsApp", short: "WA", color: "#25d366" },
  ml: { label: "MercadoLibre", short: "ML", color: "#ffe600", fg: "#111827" },
  email: { label: "Email", short: "EM", color: "#6b7280" },
  facebook: { label: "Facebook", short: "FB", color: "#1877f2" },
  instagram: { label: "Instagram", short: "IG", color: "#c13584" },
  omnicrm: { label: "OmniCRM", short: "CRM", color: "#5e5ce6" },
};

export function channelMeta(channel) {
  const key = String(channel || "").toLowerCase();
  return CHANNEL_META[key] || { label: channel || "—", short: (channel || "?").slice(0, 2).toUpperCase(), color: "#6b7280" };
}

/** Best available display name for a conversation. */
export function conversationTitle(c) {
  if (!c) return "Conversación";
  return c.contact_name || c.subject || c.channel_conversation_id || "Conversación";
}

/** Up-to-2-char initials from a name (falls back to "?"). */
export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic avatar background from a string (stable across renders, no Math.random). */
export function avatarColor(seed) {
  const s = String(seed || "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 45%)`;
}

/** First timestamp-like field present on a record, as a Date — or null. */
function pickDate(...candidates) {
  for (const v of candidates) {
    if (!v) continue;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export function messageDate(m) {
  return pickDate(m?.created_at, m?.ts, m?.timestamp, m?.inserted_at);
}

export function conversationDate(c) {
  return pickDate(c?.last_message_at, c?.updated_at, c?.created_at);
}

/** Compact relative time, es-UY ("ahora", "5m", "3h", "2d", or a short date). `now` injectable for tests. */
export function timeAgo(date, now = new Date()) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const secs = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (secs < 45) return "ahora";
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  if (secs < 7 * 86400) return `${Math.floor(secs / 86400)}d`;
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit" });
}

/** Clock time for a message bubble ("14:05", or "23/06 14:05" if not today). */
export function clockTime(date, now = new Date()) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const sameDay = d.toDateString() === now.toDateString();
  const hm = d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", hour12: false });
  return sameDay ? hm : `${d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit" })} ${hm}`;
}

/** Conversation status → label + token color family. Matches ALLOWED_CONVERSATION_STATUSES. */
export const STATUS_META = {
  open: { label: "Abierta", tone: "accent" },
  pending: { label: "Pendiente", tone: "warn" },
  snoozed: { label: "Pospuesta", tone: "yellow" },
  closed: { label: "Resuelta", tone: "success" },
};

export function statusMeta(status) {
  return STATUS_META[String(status || "open").toLowerCase()] || STATUS_META.open;
}
