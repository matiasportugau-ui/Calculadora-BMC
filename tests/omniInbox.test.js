// tests/omniInbox.test.js — standalone (no deps, no server) unit test for the
// Omni inbox Chatwoot-style UX helpers. Run: `node tests/omniInbox.test.js`.
import assert from "node:assert/strict";
import {
  channelMeta,
  conversationTitle,
  conversationDate,
  initials,
  avatarColor,
  timeAgo,
  timeAgoOrDash,
  clockTime,
  statusMeta,
  messageDate,
  groundingLabel,
} from "../src/components/hub/canales/panels/omniFormat.js";
import {
  getCannedReplies,
  matchSlashQuery,
  applyReply,
  SEED_REPLIES,
} from "../src/components/hub/canales/panels/cannedReplies.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

// ── omniFormat: channelMeta ─────────────────────────────────────────────
check("channelMeta known channels", () => {
  assert.equal(channelMeta("wa").short, "WA");
  assert.equal(channelMeta("ML").short, "ML"); // case-insensitive
  assert.equal(channelMeta("email").label, "Email");
});
check("channelMeta unknown channel falls back", () => {
  const m = channelMeta("telegram");
  assert.equal(m.short, "TE");
  assert.ok(m.color);
});

// ── omniFormat: conversationTitle ───────────────────────────────────────
check("conversationTitle prefers contact_name then subject then id", () => {
  assert.equal(conversationTitle({ contact_name: "Ana", subject: "x" }), "Ana");
  assert.equal(conversationTitle({ subject: "Consulta panel" }), "Consulta panel");
  assert.equal(conversationTitle({ channel_conversation_id: "wamid.1" }), "wamid.1");
  assert.equal(conversationTitle(null), "Conversación");
});

// ── omniFormat: initials + avatarColor ──────────────────────────────────
check("initials handles 0/1/2+ words", () => {
  assert.equal(initials(""), "?");
  assert.equal(initials("Ana"), "AN");
  assert.equal(initials("Ana María Pérez"), "AP");
});
check("avatarColor is deterministic hsl", () => {
  assert.equal(avatarColor("Ana"), avatarColor("Ana"));
  assert.match(avatarColor("Ana"), /^hsl\(\d+, 55%, 45%\)$/);
});

// ── omniFormat: time helpers (injected `now` for determinism) ───────────
check("timeAgo buckets", () => {
  const now = new Date("2026-06-25T12:00:00Z");
  assert.equal(timeAgo(new Date("2026-06-25T11:59:40Z"), now), "ahora");
  assert.equal(timeAgo(new Date("2026-06-25T11:55:00Z"), now), "5m");
  assert.equal(timeAgo(new Date("2026-06-25T09:00:00Z"), now), "3h");
  assert.equal(timeAgo(new Date("2026-06-23T12:00:00Z"), now), "2d");
  // >7d => short date (locale-dependent string, just assert non-empty + not a bucket)
  const old = timeAgo(new Date("2026-05-01T12:00:00Z"), now);
  assert.ok(old && !/^(ahora|\d+[mhd])$/.test(old));
  assert.equal(timeAgo(null, now), "");
});
check("timeAgoOrDash uses em dash for missing timestamps", () => {
  const now = new Date("2026-06-25T12:00:00Z");
  assert.equal(timeAgoOrDash(null, now), "—");
  assert.equal(timeAgoOrDash(new Date("2026-06-25T11:55:00Z"), now), "5m");
});
check("clockTime same-day vs other-day", () => {
  const now = new Date("2026-06-25T12:00:00Z");
  // Output uses the operator's local timezone + es-UY locale (day/month may be 1–2 digits).
  assert.match(clockTime(new Date("2026-06-25T08:05:00Z"), now), /^\d{2}:\d{2}$/);
  assert.match(clockTime(new Date("2026-06-23T08:05:00Z"), now), /^\d{1,2}\/\d{1,2} \d{2}:\d{2}$/);
});

// ── omniFormat: date pickers + statusMeta ───────────────────────────────
check("conversationDate prefers last_message_at", () => {
  const d = conversationDate({ last_message_at: "2026-06-25T10:00:00Z", created_at: "2026-01-01T00:00:00Z" });
  assert.equal(d.toISOString(), "2026-06-25T10:00:00.000Z");
  assert.equal(conversationDate({}), null);
});
check("messageDate falls back across field names", () => {
  assert.ok(messageDate({ ts: "2026-06-25T10:00:00Z" }) instanceof Date);
  assert.equal(messageDate({}), null);
});
check("statusMeta maps the four statuses", () => {
  assert.equal(statusMeta("open").tone, "accent");
  assert.equal(statusMeta("pending").tone, "warn");
  assert.equal(statusMeta("snoozed").tone, "yellow");
  assert.equal(statusMeta("closed").label, "Resuelta");
  assert.equal(statusMeta("garbage").tone, "accent"); // safe default
});

// ── cannedReplies (localStorage is undefined under node → seeds only) ────
check("getCannedReplies returns seeds when no storage", () => {
  const all = getCannedReplies();
  assert.ok(all.length >= SEED_REPLIES.length);
  assert.ok(all.some((r) => r.shortcut === "medidas"));
});
check("matchSlashQuery activates only on a trailing /token", () => {
  assert.equal(matchSlashQuery("hola", 4).active, false);
  const m = matchSlashQuery("/med", 4);
  assert.equal(m.active, true);
  assert.ok(m.matches.some((r) => r.shortcut === "medidas"));
  // slash mid-word (e.g. a URL) should NOT trigger
  assert.equal(matchSlashQuery("http://x", 8).active, false);
});
check("matchSlashQuery bare slash lists all", () => {
  const m = matchSlashQuery("hola /", 6);
  assert.equal(m.active, true);
  assert.equal(m.matches.length, getCannedReplies().length);
});
check("applyReply replaces the /token with the body", () => {
  const text = "hola /med";
  const m = matchSlashQuery(text, text.length);
  const out = applyReply(text, text.length, m.tokenStart, "MEDIDAS_BODY");
  assert.equal(out, "hola MEDIDAS_BODY");
});

check("groundingLabel shows count only when grounded", () => {
  assert.equal(
    groundingLabel({ grounding: { grounded: true, rag_count: 2 } }),
    "Basado en 2 cotizaciones similares",
  );
  assert.equal(
    groundingLabel({ grounding: { grounded: true, rag_count: 1 } }),
    "Basado en 1 cotización similar",
  );
  // not grounded / RAG off / missing → no badge
  assert.equal(groundingLabel({ grounding: { grounded: false, rag_count: 0 } }), null);
  assert.equal(groundingLabel({ grounding: { grounded: true, rag_count: 0 } }), null);
  assert.equal(groundingLabel({}), null);
  assert.equal(groundingLabel(undefined), null);
});

console.log(`\nomniInbox helpers: ${passed} checks passed`);
