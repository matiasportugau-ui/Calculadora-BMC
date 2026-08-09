/**
 * Gap fingerprint — PEA_GAP_FINGERPRINT_V1
 * @see docs/sdd/panelin-evolution-architect/contracts/fingerprint.md
 */
import crypto from "crypto";

export const FINGERPRINT_VERSION = 1;

const STRIP_KEYS = new Set([
  "session_id",
  "request_id",
  "trace_id",
  "occurred_at",
  "user_id",
  "conversation_id",
  "message_id",
  "stack",
  "stack_trace",
  "phone",
  "email",
]);

/**
 * @param {object} inputs
 * @param {number} [version]
 */
export function normalizeFingerprintInputs(inputs, version = FINGERPRINT_VERSION) {
  const src = inputs && typeof inputs === "object" ? inputs : {};
  const out = {};
  for (const key of Object.keys(src).sort()) {
    if (STRIP_KEYS.has(key)) continue;
    let val = src[key];
    if (val == null || val === "") continue;
    if (key === "signal_type" && typeof val === "string") {
      out.signal_type = val.toLowerCase().trim().replace(/\s+/g, "_");
      continue;
    }
    if (key === "source" && typeof val === "string") {
      out.source = val.toLowerCase();
      continue;
    }
    if (key === "tool_id" && typeof val === "string") {
      out.tool_id = val.toLowerCase().split("@")[0];
      continue;
    }
    if (key === "error_code" && typeof val === "string") {
      out.error_code = val.toUpperCase().trim();
      continue;
    }
    if (key === "message_template" && typeof val === "string") {
      out.message_template = val.replace(/\s+/g, " ").trim().slice(0, 512);
      continue;
    }
    if (typeof val === "object" && !Array.isArray(val)) {
      out[key] = normalizeFingerprintInputs(val, version);
    } else {
      out[key] = val;
    }
  }
  out.fingerprint_version = version;
  return out;
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      out[k] = sortKeysDeep(value[k]);
    }
    return out;
  }
  return value;
}

/**
 * @param {object} inputs
 * @param {number} [version]
 */
export function computeFingerprint(inputs, version = FINGERPRINT_VERSION) {
  const normalized = normalizeFingerprintInputs(inputs, version);
  const canonical = JSON.stringify(sortKeysDeep(normalized));
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Build fingerprint_inputs from a gap signal envelope.
 */
export function buildFingerprintInputsFromSignal(signal) {
  return normalizeFingerprintInputs({
    source: signal.source || "panelin_fast",
    signal_type: signal.signal_type || "unknown",
    tool_id: signal.tool_id || null,
    error_code: signal.error_code || signal.errorClass || null,
    calc_surface: signal.calc_surface || null,
    message_template: signal.message_template || signal.summary || null,
  });
}
