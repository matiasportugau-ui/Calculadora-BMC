/**
 * Phase 2b — WA cockpit read-model convergence (behind OMNI_WA_READS flag).
 *
 * The /hub/wa cockpit reads wa_conversations / wa_messages / wa_suggestions. To
 * retire the dual-write, these helpers let the same endpoints read from the omni_*
 * tables and map each row back to the EXACT shape the cockpit already consumes — so
 * no frontend change is needed. Pure mappers (unit-tested) + SQL builders.
 *
 * ⚠️ Lossy fields (owner-decision before flipping ON — see runbook):
 *  - status: omni (open/pending/snoozed/resolved) ↔ wa (new/pending/quoted/closed).
 *    "quoted" has no omni equivalent, so it cannot round-trip; mapped open→new.
 *  - owner_op / lead_sheet_row / intent_last: omni core has no first-class column;
 *    read best-effort from omni_conversations.properties, else null.
 */

// omni status → the wa cockpit status enum (display).
export const OMNI_TO_WA_STATUS = {
  open: "new",
  pending: "pending",
  snoozed: "pending",
  resolved: "closed",
};

// wa cockpit status filter → omni statuses to match (filtering). "quoted" maps to
// open (no distinct omni state); "stale_24h" is computed separately, not here.
export const WA_TO_OMNI_STATUS = {
  new: ["open"],
  pending: ["pending", "snoozed"],
  quoted: ["open"],
  closed: ["resolved"],
};

/** @param {object} r omni conversation row (aliased) → wa_conversations item shape */
export function mapOmniConversation(r) {
  const props = r.properties || {};
  return {
    chat_id: r.chat_id,
    phone: r.phone || null,
    contact_name: r.contact_name || null,
    last_msg_at: r.last_msg_at,
    last_msg_in_at: r.last_msg_in_at || null,
    last_msg_out_at: r.last_msg_out_at || null,
    status: OMNI_TO_WA_STATUS[r.omni_status] || "new",
    intent_last: props.intent_last ?? props.intent ?? null,
    owner_op: props.owner_op ?? null,
    lead_sheet_row: props.lead_sheet_row ?? props.crm_row_id ?? null,
    unread_count: Number(r.unread_count || 0),
    meta: props,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/** @param {object} r omni message row → wa_messages item shape */
export function mapOmniMessage(r) {
  const meta = r.metadata || {};
  return {
    msg_id: meta.wa_msg_id || r.id,
    chat_id: r.chat_id,
    ts: r.created_at,
    direction: r.sender === "customer" ? "in" : "out",
    type: meta.type || "text",
    text: r.body,
    reply_to: meta.reply_to || null,
    source: meta.source || "omni",
    status: r.read_at ? "read" : (meta.status || "sent"),
    meta,
  };
}

/** @param {object} r omni_suggestions row → wa_suggestions item shape (single option) */
export function mapOmniSuggestion(r) {
  const meta = r.metadata || {};
  return {
    id: r.id,
    chat_id: r.chat_id,
    trigger_msg_id: meta.wa_msg_id || r.message_id || null,
    generated_at: r.created_at,
    intent: r.body_ai_category || meta.intent || null,
    // wa cockpit renders options[] with {text,tone}; omni stores one body + tone in meta.
    options: [{ text: r.body, tone: meta.tone || "sugerida" }],
    chosen_idx: r.approval_state === "accepted" ? 0 : null,
    // resolved_at is stamped by resolveSuggestion() on accept/reject (migration 015).
    chosen_at: r.approval_state === "accepted" ? r.resolved_at || null : null,
    sent_msg_id: null,
    provider: meta.provider || null,
    latency_ms: meta.latency_ms ?? null,
    error: null,
    meta,
  };
}

/**
 * Build the omni conversation-list query mirroring /wa/conversations filters.
 * @returns {{ text: string, params: any[] }}
 */
export function buildOmniConversationsSql({ status, q, cursor, limit }) {
  const where = ["c.channel = 'wa'"];
  const params = [];
  let i = 1;
  if (status === "stale_24h") {
    where.push(`c.id IN (
      SELECT m.conversation_id FROM omni_messages m GROUP BY m.conversation_id
      HAVING max(m.created_at) FILTER (WHERE m.sender='customer')
             > coalesce(max(m.created_at) FILTER (WHERE m.sender<>'customer'), '1970-01-01')
         AND max(m.created_at) FILTER (WHERE m.sender='customer') < now() - interval '24 hours')`);
  } else if (status && WA_TO_OMNI_STATUS[status]) {
    where.push(`c.status = ANY($${i++})`);
    params.push(WA_TO_OMNI_STATUS[status]);
  }
  if (q) {
    where.push(`(ct.name ilike $${i} OR ct.wa_phone ilike $${i} OR c.channel_conversation_id ilike $${i})`);
    params.push(`%${q}%`);
    i += 1;
  }
  if (cursor) {
    where.push(`c.updated_at < $${i++}`);
    params.push(cursor);
  }
  const text = `
    SELECT c.channel_conversation_id AS chat_id, ct.wa_phone AS phone, ct.name AS contact_name,
           c.updated_at AS last_msg_at, c.status AS omni_status, c.properties AS properties,
           c.created_at AS created_at, c.updated_at AS updated_at,
           (SELECT max(created_at) FROM omni_messages m WHERE m.conversation_id=c.id AND m.sender='customer') AS last_msg_in_at,
           (SELECT max(created_at) FROM omni_messages m WHERE m.conversation_id=c.id AND m.sender<>'customer') AS last_msg_out_at,
           (SELECT count(*) FROM omni_messages m WHERE m.conversation_id=c.id AND m.read_at IS NULL AND m.sender='customer') AS unread_count
      FROM omni_conversations c
      JOIN omni_contacts ct ON ct.id = c.contact_id
     WHERE ${where.join(" AND ")}
     ORDER BY c.updated_at DESC NULLS LAST
     LIMIT ${limit + 1}`;
  return { text, params };
}

/** Build the omni thread query for a wa chat_id (mirrors /wa/messages). */
export function buildOmniMessagesSql({ chatId, before, limit }) {
  const params = [chatId];
  let i = 2;
  let beforeClause = "";
  if (before) { beforeClause = `AND m.created_at < $${i++}`; params.push(before); }
  const text = `
    SELECT m.id, c.channel_conversation_id AS chat_id, m.sender, m.body, m.metadata, m.read_at, m.created_at
      FROM omni_messages m
      JOIN omni_conversations c ON c.id = m.conversation_id
     WHERE c.channel='wa' AND c.channel_conversation_id = $1 ${beforeClause}
     ORDER BY m.created_at DESC
     LIMIT ${limit + 1}`;
  return { text, params };
}

/** Build the omni suggestions query for a wa chat_id (mirrors /wa/suggestions). */
export function buildOmniSuggestionsSql({ chatId, onlyPending, limit }) {
  const where = ["c.channel='wa'", "c.channel_conversation_id = $1"];
  if (onlyPending) where.push("s.approval_state = 'pending'");
  const text = `
    SELECT s.id, c.channel_conversation_id AS chat_id, s.message_id, s.body, s.metadata,
           s.approval_state, s.resolved_at, s.created_at, m.body_ai_category
      FROM omni_suggestions s
      JOIN omni_conversations c ON c.id = s.conversation_id
      LEFT JOIN omni_messages m ON m.id = s.message_id
     WHERE ${where.join(" AND ")}
     ORDER BY s.created_at DESC
     LIMIT ${limit}`;
  return { text, params: [chatId] };
}
