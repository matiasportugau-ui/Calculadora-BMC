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

export function isGrokCreditsError(err) {
  const status = Number(err?.status) || 0;
  const blob = `${status} ${err?.body || ""} ${err?.message || ""} ${err?.code || ""}`.toLowerCase();
  if (status === 402) return true;
  return /used all available credits|monthly spending limit|insufficient credits|credit.?limit|out of credits|quota exceeded|spending_limit/.test(
    blob,
  );
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
