/**
 * server/lib/omni/urgency.js — pure, dependency-free urgency scoring for the
 * Omni unified inbox "reply-zero" action queue.
 *
 * The admin cockpit already reports COUNTS (how many conversations are overdue /
 * unassigned). What operators lack is a ranked, per-conversation "act on THIS
 * now" list across all channels. This module is the single source of that policy
 * so it stays testable in isolation (no DB, no network) and the route stays thin.
 *
 * Nothing here sends or mutates — it only scores rows the caller already read.
 */

/**
 * First-response SLA targets, in hours, per channel. Customers expect a faster
 * turnaround on synchronous channels (WhatsApp) than on email. Override per call
 * if business policy changes — kept here (not in config) so the policy is one
 * obvious, testable place until there's a reason to make it tunable at runtime.
 */
export const DEFAULT_SLA_HOURS = Object.freeze({
  wa: 0.5,
  ml: 4,
  email: 2,
  default: 4,
});

function hoursBetween(now, then) {
  if (!then) return 0;
  const a = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const b = then instanceof Date ? then.getTime() : new Date(then).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, (a - b) / 3_600_000);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function fmtHours(h) {
  if (h < 1) return "<1h";
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

/**
 * Score a single conversation's urgency. Higher = more urgent. Pure + deterministic
 * given `now`. Unknown/missing fields degrade gracefully to 0 contributions.
 *
 * @param {object} conv - row with at least: channel, status, created_at,
 *   first_agent_reply_at, assigned_to_user_id, priority, unread_count, last_message_at
 * @param {{ now?: Date|string|number, slaHours?: Record<string,number> }} [opts]
 * @returns {{ score:number, reasons:string[], age_hours:number, awaiting_hours:number,
 *   sla_hours:number, sla_breached:boolean }}
 */
export function scoreConversationUrgency(conv = {}, opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date();
  const slaHours = opts.slaHours || DEFAULT_SLA_HOURS;
  const reasons = [];
  let score = 0;

  const ageHours = hoursBetween(now, conv.created_at);

  // "Awaiting first reply" is the core driver — no agent has replied yet.
  const awaiting = conv.first_agent_reply_at == null;
  const awaitingSince = awaiting ? conv.last_message_at || conv.created_at : null;
  const awaitingHours = awaiting ? hoursBetween(now, awaitingSince) : 0;
  const sla = slaHours[conv.channel] ?? slaHours.default;
  let slaBreached = false;

  if (awaiting) {
    score += 50; // base weight: someone is waiting for a first answer
    score += Math.min(awaitingHours, 72); // older waits rank higher, capped at 3d
    reasons.push(`esperando 1ª respuesta ${fmtHours(awaitingHours)}`);
    if (awaitingHours > sla) {
      slaBreached = true;
      score += 100; // SLA breach dominates the ranking
      reasons.push(`SLA vencido (${conv.channel || "?"} > ${sla}h)`);
    }
  }

  const unread = Number(conv.unread_count) || 0;
  if (unread > 0) {
    score += 10 + Math.min(unread, 10);
    reasons.push(`${unread} sin leer`);
  }

  if (conv.assigned_to_user_id == null) {
    score += 15;
    reasons.push("sin asignar");
  }

  // omni_conversations.priority is an INTEGER (default 0; raised only via the
  // automation engine's set_priority action — there's no "high"/"urgent" string
  // enum anywhere in the schema), so this compares against the actual stored type.
  const priority = Number(conv.priority) || 0;
  if (priority > 0) {
    score += 30;
    reasons.push(`prioridad ${priority}`);
  }

  return {
    score: Math.round(score),
    reasons,
    age_hours: round1(ageHours),
    awaiting_hours: round1(awaitingHours),
    sla_hours: sla,
    sla_breached: slaBreached,
  };
}

/**
 * Rank a set of conversations by urgency and return the top `limit`, each
 * enriched with its urgency fields. Snoozed/closed rows should be excluded by the
 * caller's query, but a defensive `status === 'open'` guard is applied too.
 *
 * @param {object[]} conversations
 * @param {{ now?: Date|string|number, slaHours?: Record<string,number>, limit?: number }} [opts]
 * @returns {object[]} ranked, sliced; ties broken by oldest-first (created_at asc)
 */
export function rankUrgentConversations(conversations = [], opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 20, 1), 100);
  const scored = [];
  for (const conv of conversations) {
    if (conv.status && conv.status !== "open") continue;
    const urgency = scoreConversationUrgency(conv, opts);
    scored.push({ ...conv, urgency });
  }
  scored.sort((a, b) => {
    if (b.urgency.score !== a.urgency.score) return b.urgency.score - a.urgency.score;
    // tie-break: oldest conversation first (more aging risk)
    const ta = a.created_at ? new Date(a.created_at).getTime() : Infinity;
    const tb = b.created_at ? new Date(b.created_at).getTime() : Infinity;
    return ta - tb;
  });
  return scored.slice(0, limit);
}
