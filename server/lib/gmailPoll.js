// ═══════════════════════════════════════════════════════════════════════════
// server/lib/gmailPoll.js — server-side Gmail → CRM/Omni ingest poller.
// ───────────────────────────────────────────────────────────────────────────
// Reads the Gmail inbox that Cloudflare Email Routing forwards the BMC business
// boxes to, filters to an exact recipient allowlist (Gmail's `to:` search is
// fuzzy), and loopback-POSTs each message to /api/crm/ingest-email (which AI-
// extracts the lead, writes CRM_Operativo, and — with OMNI_EMAIL_SHADOW_WRITE —
// threads it into the Omni inbox). Processed mail is labelled `bmc-ingested`.
//
// This is the backend twin of the sibling pipeline's gmail-ingest.mjs, runnable
// without a separate Cloud Run Job: the Gmail user-OAuth secrets are already
// mounted on the service. Triggered by POST /api/email/poll-gmail (cron).
//
// Pure helpers + an injectable gmail client / poster make it unit-testable.
// ═══════════════════════════════════════════════════════════════════════════
import { config } from "../config.js";

const b64 = (s) => Buffer.from(String(s || "").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
const stripHtml = (h) =>
  String(h || "").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export function extractBody(payload) {
  if (!payload) return "";
  const walk = (p, want) => {
    if (!p) return "";
    if (p.mimeType === want && p.body?.data) return b64(p.body.data);
    for (const part of p.parts || []) { const r = walk(part, want); if (r) return r; }
    return "";
  };
  return walk(payload, "text/plain") || stripHtml(walk(payload, "text/html"));
}

export const header = (payload, name) =>
  (payload?.headers || []).find((h) => h.name.toLowerCase() === name)?.value || "";

/** Parse the comma/space-separated allowlist into a lowercased array. */
export function parseAllowlist(raw) {
  return String(raw || "").split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** Concatenate every recipient-bearing header, lowercased — Cloudflare scatters the original recipient. */
export function recipientsBlob(payload) {
  return ["to", "cc", "bcc", "delivered-to", "x-forwarded-to", "x-original-to", "x-forwarded-for"]
    .map((h) => header(payload, h)).join(" ").toLowerCase();
}

/** Matched allowlist address for a message, "*" if no allowlist, or "" to skip. */
export function matchedRecipient(payload, allowlist) {
  if (!allowlist || !allowlist.length) return "*";
  const blob = recipientsBlob(payload);
  return allowlist.find((addr) => blob.includes(addr)) || "";
}

export function isGmailPollConfigured(env = process.env) {
  return Boolean(env.GMAIL_INGEST_REFRESH_TOKEN && env.GMAIL_OAUTH_CLIENT_ID && env.GMAIL_OAUTH_CLIENT_SECRET);
}

async function defaultGmailClient(env = process.env) {
  // Dedicated Gmail OAuth client (NOT the Drive client). The refresh token is bound to
  // this exact client; sharing the Drive client caused mutual token revocation.
  const { google } = await import("googleapis");
  const oauth = new google.auth.OAuth2(env.GMAIL_OAUTH_CLIENT_ID, env.GMAIL_OAUTH_CLIENT_SECRET);
  oauth.setCredentials({ refresh_token: env.GMAIL_INGEST_REFRESH_TOKEN });
  return google.gmail({ version: "v1", auth: oauth });
}

async function ensureLabelId(gmail, name) {
  const { data } = await gmail.users.labels.list({ userId: "me" });
  const found = (data.labels || []).find((l) => l.name === name);
  if (found) return found.id;
  const { data: made } = await gmail.users.labels.create({
    userId: "me",
    requestBody: { name, labelListVisibility: "labelShow", messageListVisibility: "show" },
  });
  return made.id;
}

/** Default poster: loopback HTTP to our own ingest route (reuses the AI extractor + dedupe). */
async function defaultPostIngest(payload, { fetchImpl = fetch } = {}) {
  const base = (config.selfBaseUrl || `http://127.0.0.1:${config.port}`).replace(/\/$/, "");
  const token = config.emailIngestToken || config.apiAuthToken || "";
  const r = await fetchImpl(`${base}/api/crm/ingest-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, deduped: Boolean(j?.deduped), body: j };
}

/**
 * Poll Gmail once. Returns a summary; never throws on per-message errors.
 * @param {{ dryRun?:boolean, limit?:number, query?:string, doneLabel?:string,
 *           allowlist?:string[], env?:object, logger?:object,
 *           gmail?:object, postIngest?:Function, fetchImpl?:Function }} opts
 */
export async function pollGmailOnce(opts = {}) {
  const env = opts.env || process.env;
  const logger = opts.logger || console;
  if (!opts.gmail && !isGmailPollConfigured(env)) {
    return { ok: false, error: "gmail_poll_not_configured", scanned: 0, sent: 0, deduped: 0, skipped: 0, failed: 0 };
  }
  const limit = Math.max(1, Math.min(Number(opts.limit || 50), 100));
  const query = opts.query || "in:inbox newer_than:7d -label:bmc-ingested";
  const doneLabel = opts.doneLabel || "bmc-ingested";
  const allowlist = opts.allowlist || parseAllowlist(config.gmailIngestAddresses);
  const postIngest = opts.postIngest || ((p) => defaultPostIngest(p, { fetchImpl: opts.fetchImpl }));
  const gmail = opts.gmail || (await defaultGmailClient(env));

  const labelId = opts.dryRun ? null : await ensureLabelId(gmail, doneLabel);
  const { data: list } = await gmail.users.messages.list({ userId: "me", q: query, maxResults: limit });
  const msgs = list.messages || [];

  let sent = 0, deduped = 0, skipped = 0, failed = 0;
  for (const { id } of msgs) {
    let m;
    try {
      ({ data: m } = await gmail.users.messages.get({ userId: "me", id, format: "full" }));
    } catch (e) { failed++; logger.warn?.(`gmailPoll get ${id} failed: ${e?.message}`); continue; }

    const matched = matchedRecipient(m.payload, allowlist);
    if (!matched) { skipped++; continue; }
    const account = matched === "*" ? header(m.payload, "to") : matched;
    const rfcId = header(m.payload, "message-id") || id;
    const payload = {
      asunto: String(header(m.payload, "subject")).slice(0, 500),
      cuerpo: String(extractBody(m.payload) || m.snippet || "").slice(0, 12000),
      remitente: header(m.payload, "from"),
      messageId: rfcId,
      threadId: m.threadId || null,
      account,
    };
    if (opts.dryRun) { continue; }

    let ok = false, info = "";
    for (let attempt = 0; attempt < 2 && !ok; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 1000));
      try {
        const r = await postIngest(payload);
        if (r.ok) { ok = true; if (r.deduped) deduped++; else sent++; }
        else info = `${r.status} ${JSON.stringify(r.body).slice(0, 120)}`;
      } catch (e) { info = e?.message || String(e); }
    }
    if (ok) {
      try { await gmail.users.messages.modify({ userId: "me", id, requestBody: { addLabelIds: [labelId] } }); }
      catch { /* best effort */ }
    } else { failed++; logger.warn?.(`gmailPoll ingest ${rfcId} failed: ${info}`); }
  }
  return { ok: true, scanned: msgs.length, sent, deduped, skipped, failed };
}

export default { pollGmailOnce, isGmailPollConfigured, parseAllowlist, matchedRecipient, recipientsBlob, extractBody, header };
