/**
 * WhatsApp Cloud API webhook helpers (Meta direct route).
 *
 * Shared by the inline handler in server/index.js (mounted at both
 * /webhooks/whatsapp and /whatsapp/webhook) and by the offline tests:
 *   - createVerifyHandler(config)            GET  hub.mode / hub.verify_token / hub.challenge
 *   - createSignatureGuard(config, logger)   POST X-Hub-Signature-256 → 403 on missing/invalid
 *   - flattenWebhook(body)                   every entry[] × changes[] (field === "messages")
 *   - logWebhookEvents(log, flat)            one structured pino line per message / status
 *   - createAutoReplier(deps)                ack | agent reply inside the 24h service window
 */
import { verifyWhatsAppSignature } from "../whatsappSignature.js";

const TEXT_PREVIEW_LEN = 120;
const DEFAULT_ACK_COOLDOWN_MS = 60 * 60 * 1000;
const MAX_TEXT_LEN = 4096;

function digits(v) {
  return String(v || "").replace(/\D/g, "");
}

function tsIso(unixSeconds) {
  const n = Number(unixSeconds);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

export function createVerifyHandler(config) {
  return (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    const expected = config.whatsappVerifyToken;
    if (mode === "subscribe" && expected && token === expected) {
      res.set("Content-Type", "text/plain");
      return res.status(200).send(String(challenge ?? ""));
    }
    return res.status(403).send("Forbidden");
  };
}

/**
 * Express middleware for the raw-body POST. Rejects with 403 when the signature is
 * missing/invalid, and also 403 (+ error log) when no app secret is configured outside
 * test mode — an unsigned webhook is never accepted in prod. On success the parsed
 * JSON is exposed as `req.waBody`. Unparseable JSON is acked with 200 (Meta retries
 * otherwise) and `req.waBody` is null.
 */
export function createSignatureGuard(config, logger = console) {
  return (req, res, next) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const verified = verifyWhatsAppSignature({
      appSecret: config.whatsappAppSecret,
      rawBodyBuffer: raw,
      signatureHeader: req.headers["x-hub-signature-256"],
    });
    if (verified.reason === "secret_not_configured") {
      logger.error?.("[WA] WHATSAPP_APP_SECRET / META_APP_SECRET not configured — rejecting webhook (403)");
      return res.status(403).json({ ok: false, error: "webhook_secret_not_configured" });
    }
    if (!verified.ok) {
      logger.warn?.(
        { reason: verified.reason || "mismatch", path: req.path, has_header: Boolean(req.headers["x-hub-signature-256"]) },
        "[WA] webhook signature rejected",
      );
      return res.status(403).json({ ok: false, error: "invalid_signature" });
    }
    if (verified.skipped) logger.warn?.("[WA] webhook signature check skipped (test mode, no secret)");
    let body = null;
    try {
      body = raw.length ? JSON.parse(raw.toString("utf8")) : {};
    } catch {
      req.waBody = null;
      return res.status(200).json({ ok: true });
    }
    req.waBody = body;
    return next();
  };
}

/**
 * @returns {Array<{ wabaId: string|null, phoneNumberId: string|null, displayPhone: string|null,
 *   contacts: object[], messages: object[], statuses: object[], value: object }>}
 */
export function flattenWebhook(body) {
  const out = [];
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      if (change?.field && change.field !== "messages") continue;
      const value = change?.value;
      if (!value || typeof value !== "object") continue;
      out.push({
        wabaId: entry?.id != null ? String(entry.id) : null,
        phoneNumberId: value.metadata?.phone_number_id != null ? String(value.metadata.phone_number_id) : null,
        displayPhone: value.metadata?.display_phone_number != null ? String(value.metadata.display_phone_number) : null,
        contacts: Array.isArray(value.contacts) ? value.contacts : [],
        messages: Array.isArray(value.messages) ? value.messages : [],
        statuses: Array.isArray(value.statuses) ? value.statuses : [],
        value,
      });
    }
  }
  return out;
}

/** Contact profile name matched by wa_id (falls back to contacts[0], then the number). */
export function contactNameFor(value, msg) {
  const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
  const from = msg?.from != null ? String(msg.from) : "";
  const match = contacts.find((c) => c?.wa_id != null && String(c.wa_id) === from) || contacts[0];
  return match?.profile?.name || from || "";
}

/** Text body for text messages, caption for media, title for button/list replies. */
export function messageText(msg) {
  if (!msg || typeof msg !== "object") return "";
  return (
    msg.text?.body ||
    msg.caption ||
    msg.image?.caption ||
    msg.video?.caption ||
    msg.document?.caption ||
    msg.button?.text ||
    msg.interactive?.button_reply?.title ||
    msg.interactive?.list_reply?.title ||
    ""
  );
}

function preview(text) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length > TEXT_PREVIEW_LEN ? `${s.slice(0, TEXT_PREVIEW_LEN)}…` : s;
}

/**
 * Structured logging of every inbound message and status. Never logs the raw body;
 * message text is truncated to a short preview.
 * @returns {{ messages: number, statuses: number }}
 */
export function logWebhookEvents(log, flat, extra = {}) {
  let messages = 0;
  let statuses = 0;
  for (const v of flat) {
    for (const m of v.messages) {
      messages += 1;
      log.info?.(
        {
          event: "wa_inbound_message",
          wamid: m?.id ?? null,
          from: m?.from ?? null,
          contact: contactNameFor(v.value, m),
          type: m?.type ?? null,
          ts: tsIso(m?.timestamp),
          phone_number_id: v.phoneNumberId,
          in_reply_to: m?.context?.id ?? null,
          text_preview: preview(messageText(m)),
          ...extra,
        },
        "[WA] inbound message",
      );
    }
    for (const s of v.statuses) {
      statuses += 1;
      log.info?.(
        {
          event: "wa_status",
          wamid: s?.id ?? null,
          status: s?.status ?? null,
          recipient_id: s?.recipient_id ?? null,
          ts: tsIso(s?.timestamp),
          phone_number_id: v.phoneNumberId,
          conversation_id: s?.conversation?.id ?? null,
          pricing: s?.pricing ?? null,
          errors: Array.isArray(s?.errors) ? s.errors : null,
          ...extra,
        },
        "[WA] status update",
      );
    }
  }
  log.info?.({ event: "wa_webhook", entries: flat.length, messages, statuses, ...extra }, "[WA] webhook received");
  return { messages, statuses };
}

/**
 * Auto-reply inside the 24h customer-service window (the inbound message opens it).
 *
 * @param {object} deps
 * @param {object} deps.config          whatsappAutoReplyEnabled / Mode / Text / CooldownMs / AgentTimeoutMs
 * @param {object} [deps.logger]
 * @param {(o:{to:string,text:string,contextMessageId:string})=>Promise<object>} deps.sendText
 * @param {(o:{messageId:string})=>Promise<object>} [deps.markRead]
 * @param {Function} [deps.callAgentOnce]  agentCore.callAgentOnce (mode=agent)
 * @param {() => number} [deps.now]
 * @param {number} [deps.maxSeen]          size of the in-memory wamid dedupe set
 * @returns {(msg:object, value:object, opts?:{isDuplicate?:boolean}) => Promise<object>}
 */
export function createAutoReplier({ config, logger = console, sendText, markRead, callAgentOnce, now = Date.now, maxSeen = 2000 } = {}) {
  const seen = new Set();
  const seenOrder = [];
  const lastReplyBySender = new Map();

  const mode = () => (config?.whatsappAutoReplyMode === "agent" ? "agent" : "ack");
  const cooldownMs = () => {
    const c = config?.whatsappAutoReplyCooldownMs;
    if (c !== null && c !== undefined && c !== "" && Number.isFinite(Number(c))) return Math.max(0, Number(c));
    return mode() === "agent" ? 0 : DEFAULT_ACK_COOLDOWN_MS;
  };
  const remember = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    seenOrder.push(id);
    while (seenOrder.length > maxSeen) seen.delete(seenOrder.shift());
  };

  async function runAgent(text) {
    if (typeof callAgentOnce !== "function") return null;
    const timeoutMs = Math.max(1000, Number(config?.whatsappAutoReplyAgentTimeoutMs) || 20000);
    let timer = null;
    try {
      const result = await Promise.race([
        callAgentOnce([{ role: "user", content: text }], { channel: "wa" }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("agent_timeout")), timeoutMs);
        }),
      ]);
      const out = typeof result === "string" ? result : result?.text ?? result?.reply ?? result?.content ?? result?.message ?? "";
      const s = String(out || "").trim();
      return s || null;
    } catch (e) {
      logger.warn?.({ err: e?.message }, "[WA] agent auto-reply failed — falling back to ack text");
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return async function autoReply(msg, value, { isDuplicate = false } = {}) {
    const m = mode();
    const skip = (reason, extra = {}) => ({ sent: false, skipped_reason: reason, wamid: null, in_reply_to: msg?.id ?? null, mode: m, ...extra });
    if (!config?.whatsappAutoReplyEnabled) return skip("disabled");
    if (!msg || !msg.id || !msg.from) return skip("malformed");
    const text = messageText(msg);
    if (msg.type !== "text" || !text) return skip("not_text");
    const from = digits(msg.from);
    const own = digits(value?.metadata?.display_phone_number);
    if (!from) return skip("malformed");
    if (own && own === from) return skip("own_number");
    if (isDuplicate || seen.has(msg.id)) return skip("duplicate");
    remember(msg.id);
    const cd = cooldownMs();
    if (cd > 0 && now() - (lastReplyBySender.get(from) || 0) < cd) return skip("cooldown");
    if (typeof sendText !== "function") return skip("no_sender");

    if (typeof markRead === "function") {
      try {
        await markRead({ messageId: msg.id });
      } catch (e) {
        logger.warn?.({ err: e?.message, wamid: msg.id }, "[WA] mark-as-read failed (continuing with reply)");
      }
    }

    let reply = String(config.whatsappAutoReplyText || "").trim();
    let fallback = null;
    if (m === "agent") {
      const agentText = await runAgent(text);
      if (agentText) reply = agentText;
      else fallback = "ack";
    }
    if (!reply) return skip("empty_reply", { fallback });
    reply = reply.slice(0, MAX_TEXT_LEN);

    try {
      const data = await sendText({ to: from, text: reply, contextMessageId: msg.id });
      lastReplyBySender.set(from, now());
      const wamid = data?.messages?.[0]?.id ?? null;
      logger.info?.(
        { event: "wa_auto_reply", to: from, in_reply_to: msg.id, wamid, mode: m, fallback, chars: reply.length },
        "[WA] auto-reply sent",
      );
      return { sent: true, wamid, in_reply_to: msg.id, mode: m, fallback };
    } catch (e) {
      logger.error?.(
        { err: e?.message, kind: e?.kind ?? null, code: e?.code ?? null, to: from, in_reply_to: msg.id, mode: m },
        "[WA] auto-reply failed",
      );
      return skip("send_failed", { error: e?.message || "send failed", kind: e?.kind ?? null, code: e?.code ?? null, fallback });
    }
  };
}
