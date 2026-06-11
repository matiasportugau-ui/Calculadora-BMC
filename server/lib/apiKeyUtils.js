// ═══════════════════════════════════════════════════════════════════════════
// server/lib/apiKeyUtils.js — recognise real provider API keys vs placeholders.
//
// Many environments seed `.env` from `.env.example` (or inject a placeholder
// env var like `OPENAI_API_KEY=sk-your-openai-api-key-here`). A non-empty
// placeholder passes a naive `if (!key)` check, then the provider returns 401,
// surfacing a confusing "Whisper API 401" / auth error to the user instead of a
// clear "not configured". `isUsableApiKey` treats placeholders as absent.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {string|undefined|null} key
 * @returns {boolean} true only if `key` looks like a real key (not empty,
 *   not an obvious .env.example placeholder).
 */
export function isUsableApiKey(key) {
  const k = String(key || "").trim();
  if (!k) return false;
  if (k.length < 20) return false; // real provider keys are long
  if (/^[.\s]+$/.test(k)) return false; // just dots / whitespace
  if (/^sk-your/i.test(k)) return false; // sk-your-openai-api-key-here
  // placeholder tokens delimited by start/end or - _ (avoids matching random
  // long keys that happen to contain the substring mid-token)
  if (/(^|[-_])(your|placeholder|replace|changeme|example|dummy|sample|redacted|todo|test)([-_]|$)/i.test(k)) {
    return false;
  }
  if (/key[-_]?here|paste[-_]?your|tu[-_]?api[-_]?key/i.test(k)) return false;
  return true;
}
