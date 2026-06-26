/**
 * chatwootClient.js — thin REST client for a self-hosted Chatwoot CE instance.
 *
 * BMC integration: Chatwoot is the shared operator inbox (off-stack, Rails). We
 * never share code with it — we drive it via its REST API and receive its
 * webhooks. This client is used by:
 *   - server/routes/chatwoot.js          (webhook → CRM extraction; post notes/labels)
 *   - server/routes/emailAgentChat.js    (in-app Email Agent tools: list/read/send/assign/...)
 *
 * All methods are no-ops-with-throw when unconfigured; callers must check
 * `isChatwootConfigured()` first so the feature degrades gracefully (the app
 * must boot fine with CHATWOOT_* unset).
 *
 * Docs: https://www.chatwoot.com/developers/api/
 */

function cfg() {
  return {
    base: (process.env.CHATWOOT_API_BASE || "").replace(/\/+$/, ""),
    token: process.env.CHATWOOT_API_TOKEN || "",
    accountId: process.env.CHATWOOT_ACCOUNT_ID || "",
    inboxId: process.env.CHATWOOT_INBOX_ID || "",
  };
}

export function isChatwootConfigured() {
  const c = cfg();
  return Boolean(c.base && c.token && c.accountId);
}

const TIMEOUT_MS = Number(process.env.CHATWOOT_HTTP_TIMEOUT_MS || 12000);

async function cwFetch(pathname, { method = "GET", body } = {}) {
  const c = cfg();
  if (!isChatwootConfigured()) {
    const err = new Error("chatwoot_not_configured");
    err.code = "CHATWOOT_NOT_CONFIGURED";
    throw err;
  }
  const url = `${c.base}/api/v1/accounts/${c.accountId}${pathname}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        api_access_token: c.token,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      const err = new Error(`chatwoot_http_${res.status}`);
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(t);
  }
}

/** List conversations. opts: { status, assigneeType, labels, page, inboxId } */
export async function listConversations(opts = {}) {
  const c = cfg();
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status); // open | resolved | pending | snoozed | all
  if (opts.assigneeType) params.set("assignee_type", opts.assigneeType); // me | unassigned | assigned | all
  if (opts.page) params.set("page", String(opts.page));
  const inbox = opts.inboxId || c.inboxId;
  if (inbox) params.set("inbox_id", String(inbox));
  const qs = params.toString();
  return cwFetch(`/conversations${qs ? `?${qs}` : ""}`);
}

/** Full conversation incl. messages. */
export async function getConversation(conversationId) {
  return cwFetch(`/conversations/${conversationId}`);
}

/** List messages of a conversation. */
export async function getMessages(conversationId) {
  return cwFetch(`/conversations/${conversationId}/messages`);
}

/**
 * Create a message in a conversation.
 *  - private:true  → internal note (operators only; NEVER sent to customer)
 *  - private:false → outgoing reply (DELIVERED to customer via the inbox SMTP)
 */
export async function createMessage(conversationId, content, { private: isPrivate = true } = {}) {
  return cwFetch(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: { content, message_type: isPrivate ? "outgoing" : "outgoing", private: Boolean(isPrivate) },
  });
}

/** Internal note helper (safe — never customer-facing). */
export function postPrivateNote(conversationId, markdown) {
  return createMessage(conversationId, markdown, { private: true });
}

/** Customer-facing reply. Callers MUST gate this behind user_confirmed. */
export function sendReply(conversationId, content) {
  return createMessage(conversationId, content, { private: false });
}

/** Replace the label set on a conversation. */
export async function setLabels(conversationId, labels = []) {
  return cwFetch(`/conversations/${conversationId}/labels`, {
    method: "POST",
    body: { labels },
  });
}

/** Assign a conversation to an agent (Chatwoot agent id). */
export async function assignConversation(conversationId, assigneeId) {
  return cwFetch(`/conversations/${conversationId}/assignments`, {
    method: "POST",
    body: { assignee_id: assigneeId },
  });
}

/** Change conversation status: open | resolved | pending | snoozed */
export async function setStatus(conversationId, status) {
  return cwFetch(`/conversations/${conversationId}/toggle_status`, {
    method: "POST",
    body: { status },
  });
}

/** Canned responses (reusable templates). */
export async function listCannedResponses() {
  return cwFetch(`/canned_responses`);
}

/** Conversation meta counts for reporting. */
export async function conversationMeta(opts = {}) {
  const c = cfg();
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  const inbox = opts.inboxId || c.inboxId;
  if (inbox) params.set("inbox_id", String(inbox));
  const qs = params.toString();
  return cwFetch(`/conversations/meta${qs ? `?${qs}` : ""}`);
}

export default {
  isChatwootConfigured,
  listConversations,
  getConversation,
  getMessages,
  createMessage,
  postPrivateNote,
  sendReply,
  setLabels,
  assignConversation,
  setStatus,
  listCannedResponses,
  conversationMeta,
};
