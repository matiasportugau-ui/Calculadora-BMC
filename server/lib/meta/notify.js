/**
 * Owner WhatsApp notify for Meta inbox (IG/FB DMs + later comments).
 * In-process job queue with 60s burst batching. No LLM work.
 *
 * #n is a per-process sequence until Run 3 binds it to a durable audit row.
 */
import { config as appConfig } from "../../config.js";
import { sendWhatsAppText } from "../whatsappOutbound.js";

export const NOTIFY_WINDOW_MS = 60_000;
export const NOTIFY_BURST_LIMIT = 5;

let seq = 0;

export function nextNotifySeq() {
  seq += 1;
  return seq;
}

export function resetNotifySeqForTests() {
  seq = 0;
}

export function channelLabel(channel) {
  if (channel === "ig" || channel === "instagram") return "IG";
  if (channel === "fb" || channel === "facebook") return "FB";
  return String(channel || "?").toUpperCase();
}

export function kindLabel(event) {
  const kind = event?.kind || event?.message?.metadata?.kind || event?.message?.metadata?.type;
  if (kind === "comment" || kind === "comments") return "comentario";
  return "DM";
}

function authorOf(event) {
  return (
    event?.contact_hint?.name ||
    event?.message?.sender_id ||
    event?.contact_hint?.igsid ||
    event?.contact_hint?.psid ||
    "desconocido"
  );
}

function clip(text, max) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * @param {{ event: object, draft?: { text?: string }, n: number, postTitle?: string }} args
 */
export function formatOwnerNotification({ event, draft, n, postTitle } = {}) {
  const ch = channelLabel(event?.channel);
  const kind = kindLabel(event);
  const author = authorOf(event);
  const text = clip(event?.message?.body, 280);
  const title = postTitle || event?.post_title || event?.message?.metadata?.post_title;
  const titleBit = kind === "comentario" && title ? ` · post: "${clip(title, 80)}"` : "";
  let line = `📩 ${ch} ${kind} #${n} · ${author}: "${text}"${titleBit}`;
  if (draft?.text) {
    line += `\n💬 Borrador: ${clip(draft.text, 800)}`;
    line += `\n→ OK ${n} / EDITAR ${n} <texto> / NO ${n} / OCULTAR ${n}`;
  }
  return line;
}

/** @param {Array<{ event: object, draft?: object, n: number, postTitle?: string }>} items */
export function formatOwnerDigest(items) {
  const lines = items.map((it) => formatOwnerNotification(it));
  return `📩 Meta inbox · ${items.length} eventos (60s)\n${lines.join("\n")}`;
}

function defaultSend(text, cfg) {
  return sendWhatsAppText({
    to: cfg.ownerWhatsapp,
    text,
    accessToken: cfg.whatsappAccessToken,
    phoneNumberId: cfg.whatsappPhoneNumberId,
  });
}

/**
 * @param {{
 *   windowMs?: number,
 *   burstLimit?: number,
 *   now?: () => number,
 *   send?: (text: string) => Promise<unknown>,
 *   getOwnerWhatsapp?: () => string,
 *   setTimeoutFn?: typeof setTimeout,
 *   clearTimeoutFn?: typeof clearTimeout,
 *   config?: object,
 *   logger?: { warn?: Function },
 * }} [opts]
 */
export function createNotifyQueue(opts = {}) {
  const windowMs = opts.windowMs ?? NOTIFY_WINDOW_MS;
  const burstLimit = opts.burstLimit ?? NOTIFY_BURST_LIMIT;
  const now = opts.now || Date.now;
  const cfg = opts.config || appConfig;
  const getOwner = opts.getOwnerWhatsapp || (() => cfg.ownerWhatsapp || "");
  const send = opts.send || ((text) => defaultSend(text, cfg));
  const setTimeoutFn = opts.setTimeoutFn || setTimeout;
  const clearTimeoutFn = opts.clearTimeoutFn || clearTimeout;
  const logger = opts.logger;

  let windowStart = 0;
  let sentImmediate = 0;
  let overflow = [];
  let timer = null;

  async function flushOverflow() {
    if (timer) {
      clearTimeoutFn(timer);
      timer = null;
    }
    if (!overflow.length) return { flushed: 0 };
    const items = overflow.splice(0);
    const text = items.length === 1 ? formatOwnerNotification(items[0]) : formatOwnerDigest(items);
    await send(text);
    return { flushed: items.length, digest: items.length > 1 };
  }

  function scheduleFlush(delayMs) {
    if (timer) return;
    timer = setTimeoutFn(() => {
      timer = null;
      flushOverflow().catch((err) => {
        logger?.warn?.({ err: err?.message }, "meta owner notify digest flush failed");
      });
    }, Math.max(0, delayMs));
  }

  /**
   * Enqueue a notify_owner job. Fire-and-forget safe: never throws to caller
   * when used via enqueueNotifyOwner (wrapped). This method may throw if send does.
   */
  async function notifyOwner(payload = {}) {
    const owner = String(getOwner() || "").trim();
    if (!owner) return { skipped: "owner_whatsapp_empty" };
    if (opts.send == null && (!cfg.whatsappAccessToken || !cfg.whatsappPhoneNumberId)) {
      return { skipped: "whatsapp_not_configured" };
    }

    const event = payload.event;
    if (event?.message?.metadata?.is_echo) return { skipped: "echo" };

    const n = payload.n ?? nextNotifySeq();
    const item = {
      event,
      draft: payload.draft,
      n,
      postTitle: payload.postTitle,
    };

    const t = now();
    if (!windowStart || t - windowStart >= windowMs) {
      await flushOverflow();
      windowStart = t;
      sentImmediate = 0;
    }

    if (sentImmediate < burstLimit && overflow.length === 0) {
      sentImmediate += 1;
      await send(formatOwnerNotification(item));
      return { sent: "immediate", n };
    }

    overflow.push(item);
    sentImmediate += 1;
    scheduleFlush(windowMs - (t - windowStart));
    return { queued: true, n };
  }

  function reset() {
    if (timer) {
      clearTimeoutFn(timer);
      timer = null;
    }
    overflow = [];
    windowStart = 0;
    sentImmediate = 0;
  }

  return { notifyOwner, flush: flushOverflow, reset };
}

let defaultQueue = null;

export function resetNotifyQueueForTests() {
  defaultQueue?.reset?.();
  defaultQueue = null;
  resetNotifySeqForTests();
}

/**
 * Enqueue a notify_owner job after a persisted ig|fb OmniInboundEvent.
 * Best-effort: never throws.
 */
export async function enqueueNotifyOwner(payload = {}) {
  try {
    const cfg = payload.config || appConfig;
    if (!String(cfg.ownerWhatsapp || "").trim()) {
      return { skipped: "owner_whatsapp_empty" };
    }
    if (!defaultQueue) {
      defaultQueue = createNotifyQueue({
        config: cfg,
        logger: payload.logger,
        send: payload.send,
        now: payload.now,
        setTimeoutFn: payload.setTimeoutFn,
        clearTimeoutFn: payload.clearTimeoutFn,
      });
    }
    return await defaultQueue.notifyOwner(payload);
  } catch (err) {
    payload.logger?.warn?.({ err: err?.message }, "meta owner notify failed");
    return { skipped: "error", error: err?.message };
  }
}

/** @param {{ event: object, draft?: object }} args */
export async function notifyOwner(args) {
  return enqueueNotifyOwner(args);
}
