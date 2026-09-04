/**
 * In-process cache: hide the shop orb after xAI credits/spend-limit failures.
 * TTL avoids a mint storm while the team is dry. Process-local (Cloud Run instance).
 */
const DEFAULT_TTL_MS = 30 * 60 * 1000;

let deadUntil = 0;

export function grokCreditsTtlMs() {
  const n = Number(process.env.STOREFRONT_VOICE_CREDITS_TTL_MS);
  return Number.isFinite(n) && n >= 1000 ? n : DEFAULT_TTL_MS;
}

export function normalizeLlmError(err) {
  const status = Number(err?.status || err?.statusCode || 0);
  const message = String(err?.error?.message || err?.body || err?.message || "");
  return { status, body: message, message, code: err?.code };
}

export function isGrokCreditsError(err) {
  const info = normalizeLlmError(err);
  const blob = `${info.status} ${info.body} ${info.message} ${info.code || ""}`.toLowerCase();
  if (info.status === 402) return true;
  return /used all available credits|monthly spending limit|insufficient credits|credit.?limit|out of credits|quota exceeded|spending_limit/.test(
    blob,
  );
}

/** Quota/credits/rate-limit on any text provider — skip to the next backend. */
export function isStorefrontTextQuotaError(err) {
  if (isGrokCreditsError(err)) return true;
  const info = normalizeLlmError(err);
  const blob = `${info.status} ${info.body} ${info.message}`.toLowerCase();
  if (info.status === 429 || /\b429\b/.test(blob)) return true;
  return /credit|quota|billing|rate limit|too many requests|no body/.test(blob);
}

/**
 * Transient upstream failure — try the next chat backend (Gemini/OpenAI).
 * 4xx (except quota/credits) stay hard fails so bad payloads are not masked.
 */
export function isStorefrontBackendFailoverError(err) {
  if (isStorefrontTextQuotaError(err)) return true;
  const info = normalizeLlmError(err);
  if (info.status >= 500 && info.status < 600) return true;
  const blob = `${info.message} ${info.body} ${info.code || ""}`.toLowerCase();
  return /econnreset|econnrefused|enotfound|etimedout|fetch failed|network|socket|timeout|overloaded|unavailable/i.test(
    blob,
  );
}

/** Never leak SDK strings like "429 status code (no body)" to the shopper. */
export function shopperSafeChatError(err) {
  const info = normalizeLlmError(err);
  if (info.status === 429 || /\b429\b/.test(`${info.message} ${info.body}`)) {
    const e = new Error("El asistente está ocupado. Esperá unos segundos y mandá de nuevo.");
    e.status = 429;
    return e;
  }
  if (isGrokCreditsError(err)) {
    const e = new Error("No se pudo responder ahora. Probá de nuevo en un momento.");
    e.status = 403;
    return e;
  }
  if (/no body|status code|ECONNRESET|fetch failed|network/i.test(info.message)) {
    const e = new Error("No se pudo responder. Probá de nuevo.");
    e.status = info.status >= 400 && info.status < 600 ? info.status : 502;
    return e;
  }
  const e = new Error("No se pudo responder. Probá de nuevo.");
  e.status = info.status >= 400 && info.status < 600 ? info.status : 502;
  return e;
}

export function markStorefrontCreditsDead(err) {
  if (!isGrokCreditsError(err)) return false;
  deadUntil = Date.now() + grokCreditsTtlMs();
  return true;
}

export function markStorefrontCreditsLive() {
  deadUntil = 0;
}

export function storefrontVoiceBubbleOn() {
  return Date.now() >= deadUntil;
}

export function storefrontVoiceStatus() {
  return { ok: true, bubble: storefrontVoiceBubbleOn() };
}

export function storefrontCreditsDenyBody() {
  return {
    ok: false,
    bubble: false,
    code: "credits",
    error: "No se pudo iniciar la voz.",
  };
}

/** Tests only. */
export function __resetStorefrontVoiceCredits() {
  deadUntil = 0;
}

export function __setStorefrontCreditsDeadUntil(ts) {
  deadUntil = Number(ts) || 0;
}
