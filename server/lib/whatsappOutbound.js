/**
 * Envío saliente WhatsApp Business Cloud API (Meta Graph API, ruta directa sin BSP).
 * Requiere WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID en config.
 *
 * `postWhatsAppPayload` is the SINGLE place that talks to the Graph API. Everything
 * else is a thin adapter over it:
 *   - postWhatsAppMessage — text payload, returns {ok,status,data,error?} (never throws
 *     on HTTP error; used by omni/outbound/waReply.sendWaReply).
 *   - sendWhatsAppText — throws WhatsAppApiError on HTTP error, returns raw data.
 *     Optional `fallbackTemplate` sends an approved template when Meta answers
 *     131047 (outside the 24h customer-service window).
 *   - sendWhatsAppTemplate — template payload, throws on HTTP error.
 *   - markWhatsAppRead — `status:"read"` payload, returns {ok,status,data}.
 *
 * Retry: up to `retry.attempts` (default 3) on HTTP 429 / 5xx or Meta codes that mean
 * "try again" (130429, 131056, 4, 80007, 131000, 131057). Delays 500 → 1500 → 4500 ms
 * with ±20% jitter; the sleep honors the caller's AbortSignal. Codes 131030 (recipient
 * not in test allow-list), 131047 (24h window) and 190 (token invalid) are never retried.
 * Caveat: a 5xx after Meta actually accepted a send can produce a duplicate message.
 */
import { config } from "../config.js";

export const DEFAULT_GRAPH_API_VERSION = "v24.0";
export const DEFAULT_RETRY_DELAYS_MS = [500, 1500, 4500];
const ATTEMPT_TIMEOUT_MS = 15000;
const MAX_TEXT_LEN = 4096;

/** Meta error → {kind, retryable}. Kinds are stable identifiers used by routes/tests. */
export const ERROR_KINDS = Object.freeze({
  recipient_not_allowed: "recipient_not_allowed", // 131030
  outside_24h_window: "outside_24h_window", // 131047
  token_invalid: "token_invalid", // 190
  undeliverable: "undeliverable", // 131026
  rate_limited: "rate_limited", // HTTP 429 / 130429 / 131056 / 4 / 80007
  server_error: "server_error", // HTTP 5xx / 131000 / 131057
  unknown: "unknown",
});

export class WhatsAppApiError extends Error {
  /**
   * NOTE: the HTTP status Meta returned lives in `graphStatus`, NOT `status` — the
   * global Express error handler maps `error.status` to the client response and a
   * Graph 401 (code 190) must not surface as a client 401.
   */
  constructor(message, { graphStatus, code, kind, fbtraceId, details, retryable, data } = {}) {
    super(message);
    this.name = "WhatsAppApiError";
    this.graphStatus = Number(graphStatus) || 0;
    this.code = code ?? null;
    this.kind = kind || ERROR_KINDS.unknown;
    this.fbtraceId = fbtraceId || null;
    this.details = details || null;
    this.retryable = Boolean(retryable);
    this.data = data;
  }
}

/**
 * @param {{ status: number, data: object }} res
 * @returns {{ code: number|null, kind: string, retryable: boolean, fbtraceId: string|null, details: string|null, message: string }}
 */
export function classifyGraphError({ status, data }) {
  const err = data?.error || {};
  const rawCode = Number(err.code);
  const code = Number.isFinite(rawCode) ? rawCode : null;
  let kind = ERROR_KINDS.unknown;
  let retryable = false;
  if (code === 131030) kind = ERROR_KINDS.recipient_not_allowed;
  else if (code === 131047) kind = ERROR_KINDS.outside_24h_window;
  else if (code === 190) kind = ERROR_KINDS.token_invalid;
  else if (code === 131026) kind = ERROR_KINDS.undeliverable;
  else if (status === 429 || code === 130429 || code === 131056 || code === 4 || code === 80007) {
    kind = ERROR_KINDS.rate_limited;
    retryable = true;
  } else if (status >= 500 || code === 131000 || code === 131057) {
    kind = ERROR_KINDS.server_error;
    retryable = true;
  }
  return {
    code,
    kind,
    retryable,
    fbtraceId: err.fbtrace_id || null,
    details: err.error_data?.details || null,
    message: err.message || "",
  };
}

function toDigits(v) {
  return String(v || "").replace(/\D/g, "");
}

export function buildTextPayload({ to, text, contextMessageId, previewUrl = false }) {
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toDigits(to),
    type: "text",
    text: { body: String(text || "").slice(0, MAX_TEXT_LEN) },
  };
  if (previewUrl) body.text.preview_url = true;
  if (contextMessageId) body.context = { message_id: String(contextMessageId) };
  return body;
}

export function buildTemplatePayload({ to, name, lang = "en_US", components }) {
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toDigits(to),
    type: "template",
    template: { name: String(name), language: { code: String(lang || "en_US") } },
  };
  if (Array.isArray(components) && components.length) body.template.components = components;
  return body;
}

export function buildMarkReadPayload({ messageId }) {
  return { messaging_product: "whatsapp", status: "read", message_id: String(messageId) };
}

function abortError(signal) {
  const e = new Error("WhatsApp send aborted");
  e.name = "AbortError";
  e.cause = signal?.reason;
  return e;
}

/** Abort-aware sleep (the worker's SIGTERM must win over a pending backoff). */
export function defaultSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError(signal));
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError(signal));
    };
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function delayFor(attempt, delays, jitter) {
  const base = Number(delays[Math.min(attempt - 1, delays.length - 1)] ?? 0);
  if (!base || !jitter) return base;
  const factor = 1 + (Math.random() * 2 - 1) * jitter;
  return Math.max(0, Math.round(base * factor));
}

/**
 * Low-level Graph API send with retry. Does NOT throw on HTTP error — returns
 * {ok:false,status,data,error} so each adapter maps it. Throws only on missing
 * config/payload, network failure or abort.
 *
 * @param {object} opts
 * @param {object} opts.payload         full Graph `/messages` body (see build* helpers)
 * @param {string} opts.accessToken
 * @param {string} opts.phoneNumberId
 * @param {AbortSignal} [opts.signal]   cancelable from the worker on SIGTERM
 * @param {string} [opts.version]       Graph API version override (default config.whatsappGraphApiVersion)
 * @param {{attempts?:number, delaysMs?:number[], sleep?:Function, jitter?:number}} [opts.retry]
 * @param {object} [opts.logger]        pino-like logger (optional)
 * @returns {Promise<{ ok: boolean, status: number, data: object, error?: object, attempts: number }>}
 */
export async function postWhatsAppPayload({ payload, accessToken, phoneNumberId, signal, version, retry, logger } = {}) {
  if (!payload || typeof payload !== "object") throw new Error("Missing payload");
  if ("to" in payload && !payload.to) throw new Error("Missing destination phone");
  if (!accessToken || !phoneNumberId) throw new Error("WhatsApp not configured");

  const graphVersion = version || config.whatsappGraphApiVersion || DEFAULT_GRAPH_API_VERSION;
  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
  const attempts = Math.max(1, Number(retry?.attempts ?? 3) || 1);
  const delays = Array.isArray(retry?.delaysMs) && retry.delaysMs.length ? retry.delaysMs : DEFAULT_RETRY_DELAYS_MS;
  const sleep = typeof retry?.sleep === "function" ? retry.sleep : defaultSleep;
  const jitter = retry?.jitter ?? 0.2;

  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    // Combina el timeout interno con la señal del caller (shutdown). Cualquiera
    // de los dos aborta el fetch. AbortSignal.any disponible en Node 20+.
    const fetchSignal = signal
      ? AbortSignal.any([AbortSignal.timeout(ATTEMPT_TIMEOUT_MS), signal])
      : AbortSignal.timeout(ATTEMPT_TIMEOUT_MS);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: fetchSignal,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, status: res.status, data, attempts: attempt };

    const error = classifyGraphError({ status: res.status, data });
    last = { ok: false, status: res.status, data, error, attempts: attempt };
    if (error.kind === ERROR_KINDS.token_invalid) {
      logger?.error?.(
        { code: error.code, fbtrace_id: error.fbtraceId, graph_status: res.status },
        "[WA] access token invalid/expired (190) — rotate WHATSAPP_ACCESS_TOKEN (scripts/wa-refresh-access-token.sh)",
      );
    }
    if (!error.retryable || attempt >= attempts) return last;
    const wait = delayFor(attempt, delays, jitter);
    logger?.warn?.(
      { attempt, next_attempt: attempt + 1, wait_ms: wait, graph_status: res.status, code: error.code, kind: error.kind },
      "[WA] Graph send failed, retrying",
    );
    await sleep(wait, signal);
  }
  return last;
}

/** Build a WhatsAppApiError from a failed {status,data,error} result. */
export function toWhatsAppApiError(result) {
  const error = result?.error || classifyGraphError({ status: result?.status, data: result?.data });
  const data = result?.data;
  const msg = data?.error?.message || (data && Object.keys(data).length ? JSON.stringify(data) : "") || "send failed";
  return new WhatsAppApiError(`WhatsApp API: ${msg}`, { graphStatus: result?.status, ...error, data });
}

/**
 * Text send — keeps the historical {ok,status,data} contract (used by sendWaReply).
 * @param {object} opts
 * @param {string} opts.to            destination phone (any format; normalized to digits)
 * @param {string} opts.text
 * @param {string} opts.accessToken
 * @param {string} opts.phoneNumberId
 * @param {AbortSignal} [opts.signal]
 * @param {string} [opts.contextMessageId]  quote/reply to this inbound wamid
 */
export async function postWhatsAppMessage({ to, text, accessToken, phoneNumberId, signal, contextMessageId, retry, version, logger }) {
  const digits = toDigits(to);
  if (!digits) throw new Error("Missing destination phone");
  if (!accessToken || !phoneNumberId) throw new Error("WhatsApp not configured");
  return postWhatsAppPayload({
    payload: buildTextPayload({ to: digits, text, contextMessageId }),
    accessToken,
    phoneNumberId,
    signal,
    retry,
    version,
    logger,
  });
}

/**
 * @param {object} opts
 * @param {string} opts.to - E.164 sin + o solo dígitos
 * @param {string} opts.text
 * @param {string} opts.accessToken
 * @param {string} opts.phoneNumberId
 * @param {AbortSignal} [opts.signal] - cancelable desde el worker en SIGTERM
 * @param {string} [opts.contextMessageId]
 * @param {{name:string, lang?:string, components?:object[]}|null} [opts.fallbackTemplate]
 *        sent instead when Meta answers 131047 (outside the 24h window)
 * @returns {Promise<object>} Graph API response data (throws WhatsAppApiError on HTTP error)
 */
export async function sendWhatsAppText({ to, text, accessToken, phoneNumberId, signal, contextMessageId, fallbackTemplate, retry, version, logger }) {
  const result = await postWhatsAppMessage({ to, text, accessToken, phoneNumberId, signal, contextMessageId, retry, version, logger });
  if (result.ok) return result.data;
  const err = toWhatsAppApiError(result);
  if (err.kind === ERROR_KINDS.outside_24h_window && fallbackTemplate?.name) {
    logger?.info?.(
      { to: toDigits(to), template: fallbackTemplate.name, code: err.code },
      "[WA] outside 24h window (131047) — sending fallback template",
    );
    const tpl = await postWhatsAppPayload({
      payload: buildTemplatePayload({ to, name: fallbackTemplate.name, lang: fallbackTemplate.lang, components: fallbackTemplate.components }),
      accessToken,
      phoneNumberId,
      signal,
      retry,
      version,
      logger,
    });
    if (tpl.ok) return { ...tpl.data, fallback: "template", fallback_template: fallbackTemplate.name };
    throw toWhatsAppApiError(tpl);
  }
  throw err;
}

/**
 * Approved-template send (works outside the 24h window; billable per message).
 * @returns {Promise<object>} Graph API response data (throws WhatsAppApiError on HTTP error)
 */
export async function sendWhatsAppTemplate({ to, name, lang, components, accessToken, phoneNumberId, signal, retry, version, logger }) {
  if (!name) throw new Error("Missing template name");
  const digits = toDigits(to);
  if (!digits) throw new Error("Missing destination phone");
  const result = await postWhatsAppPayload({
    payload: buildTemplatePayload({ to: digits, name, lang, components }),
    accessToken,
    phoneNumberId,
    signal,
    retry,
    version,
    logger,
  });
  if (result.ok) return result.data;
  throw toWhatsAppApiError(result);
}

/**
 * Mark an inbound message as read (blue ticks). Single attempt; never throws on
 * HTTP error — returns {ok,status,data,error?}.
 */
export async function markWhatsAppRead({ messageId, accessToken, phoneNumberId, signal, version, logger }) {
  if (!messageId) throw new Error("Missing messageId");
  return postWhatsAppPayload({
    payload: buildMarkReadPayload({ messageId }),
    accessToken,
    phoneNumberId,
    signal,
    version,
    logger,
    retry: { attempts: 1 },
  });
}
