/**
 * resolveRealtimeModel — pure map chat selection → OpenAI Realtime model (SDD §4.2).
 *
 * Shared client + server (identical algorithm). No secrets.
 */

/** @type {readonly string[]} */
export const REALTIME_MODEL_FALLBACKS = Object.freeze([
  "gpt-4o-realtime-preview",
  "gpt-4o-mini-realtime-preview",
]);

/**
 * @param {string} [defaultModel]
 * @returns {string[]}
 */
export function buildRealtimeAllowlist(defaultModel) {
  const d = String(defaultModel || "").trim() || REALTIME_MODEL_FALLBACKS[0];
  const set = new Set([d, ...REALTIME_MODEL_FALLBACKS]);
  return [...set];
}

/**
 * Deterministic map (SDD order):
 * 1. defaultModel from allowlist[0] / env default
 * 2. auto / empty provider → default
 * 3. non-openai → default (voice engine is always OpenAI Realtime)
 * 4. openai + allowlisted aiModel → that model
 * 5. openai + other → default
 *
 * @param {string|null|undefined} aiProvider
 * @param {string|null|undefined} aiModel
 * @param {string} [defaultModel]
 * @param {string[]|null} [allowlist]
 * @returns {string}
 */
export function resolveRealtimeModel(aiProvider, aiModel, defaultModel, allowlist) {
  const list =
    Array.isArray(allowlist) && allowlist.length > 0
      ? allowlist
      : buildRealtimeAllowlist(defaultModel);
  const def = String(defaultModel || list[0] || REALTIME_MODEL_FALLBACKS[0]).trim();
  const prov = String(aiProvider || "auto").trim().toLowerCase();
  const model = String(aiModel || "").trim();

  if (!prov || prov === "auto") return def;
  if (prov !== "openai") return def;
  if (model && list.includes(model)) return model;
  return def;
}

/**
 * @param {string} candidate
 * @param {string[]} allowlist
 */
export function isAllowedRealtimeModel(candidate, allowlist) {
  const m = String(candidate || "").trim();
  if (!m) return false;
  return Array.isArray(allowlist) && allowlist.includes(m);
}
