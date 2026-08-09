/**
 * PEA gap fingerprint (offline).
 * Run: node tests/peaGapFingerprint.test.js
 */
import {
  buildFingerprintInputsFromSignal,
  computeFingerprint,
  normalizeFingerprintInputs,
} from "../server/lib/pea/gapFingerprint.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

const base = buildFingerprintInputsFromSignal({
  source: "panelin_fast",
  signal_type: "tool_fail",
  tool_id: "calcular_cotizacion",
  message_template: "calcular_cotizacion:validation",
});

const fp1 = computeFingerprint(base);
const fp2 = computeFingerprint(base);
assert(fp1 === fp2, "stable fingerprint for same inputs");
assert(fp1.length === 64, "sha256 hex length");

const withSession = buildFingerprintInputsFromSignal({
  ...base,
  session_id: "sess-abc",
  conversation_id: "conv-xyz",
});
assert(computeFingerprint(withSession) === fp1, "session ids stripped from fingerprint");

const normalized = normalizeFingerprintInputs({
  signal_type: " Tool Fail ",
  tool_id: "Calc@1",
  error_code: " err_x ",
});
assert(normalized.signal_type === "tool_fail", "signal_type normalized");
assert(normalized.tool_id === "calc", "tool_id stripped suffix");
assert(normalized.error_code === "ERR_X", "error_code uppercased");

console.log(`\npeaGapFingerprint: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
