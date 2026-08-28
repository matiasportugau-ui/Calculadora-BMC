/**
 * In-process cache: hide the storefront voice orb when xAI mint fails for
 * credits/billing/auth. GET /status → { bubble }. Fail-soft across instances
 * (each process learns on its own mint).
 */
const COOLDOWN_MS = 5 * 60 * 1000;

let _deadUntil = 0;

export function storefrontVoiceBubbleOn() {
  return Date.now() >= _deadUntil;
}

export function storefrontVoiceStatus() {
  return { ok: true, bubble: storefrontVoiceBubbleOn() };
}

/** Shopper-facing deny — never mention credits/billing (PANELIN-WEB-NEXT). */
export function storefrontCreditsDenyBody() {
  return {
    ok: false,
    code: "credits",
    error: "La voz no está disponible ahora. Podés seguir por texto o WhatsApp.",
  };
}

export function isStorefrontCreditsError(err) {
  const status = Number(err?.status || err?.response?.status) || 0;
  if ([401, 402, 403].includes(status)) return true;
  const hay = `${err?.message || ""} ${err?.body || ""}`;
  return /credit|quota|billing|insufficient|payment|plan and billing|spending limit/i.test(hay);
}

/**
 * @param {Error & { status?: number, body?: string }} err
 * @returns {boolean} true when this error should hide the orb (caller returns 403)
 */
export function markStorefrontCreditsDead(err) {
  if (!isStorefrontCreditsError(err)) return false;
  _deadUntil = Date.now() + COOLDOWN_MS;
  return true;
}

export function markStorefrontCreditsLive() {
  _deadUntil = 0;
}

/** Test helper. */
export function clearStorefrontCreditsDeadMark() {
  _deadUntil = 0;
}
