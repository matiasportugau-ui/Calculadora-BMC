/**
 * Server re-export of pure resolver (same algorithm as src/utils).
 * Keep logic duplicated-free via re-export from shared path if build allows;
 * for ESM server simplicity we implement by importing from a relative path
 * that works under Node (duplicate thin wrapper calling shared copy).
 *
 * Actually Node cannot import from src/ without path alias — copy pure functions here
 * matching src/utils/resolveRealtimeModel.js (tests cover both via server path).
 */

export const REALTIME_MODEL_FALLBACKS = Object.freeze([
  "gpt-4o-realtime-preview",
  "gpt-4o-mini-realtime-preview",
]);

export function buildRealtimeAllowlist(defaultModel) {
  const d = String(defaultModel || "").trim() || REALTIME_MODEL_FALLBACKS[0];
  const set = new Set([d, ...REALTIME_MODEL_FALLBACKS]);
  return [...set];
}

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

export function isAllowedRealtimeModel(candidate, allowlist) {
  const m = String(candidate || "").trim();
  if (!m) return false;
  return Array.isArray(allowlist) && allowlist.includes(m);
}
