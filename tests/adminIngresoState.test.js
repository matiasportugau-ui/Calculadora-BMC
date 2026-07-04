import { ensureAdminIngresoSuccess } from "../src/utils/adminIngresoState.js";

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

function assertThrows(fn, expectedMessage, label) {
  try {
    fn();
    failed += 1;
    console.error(`  ✗ ${label}`);
  } catch (error) {
    assert(error.message === expectedMessage, `${label} (${error.message})`);
  }
}

console.log("\n— adminIngresoState");

const okData = ensureAdminIngresoSuccess(
  { ok: true, data: { success: true, persisted: true } },
  "fallback",
);
assert(okData.persisted === true, "returns data on success");

assertThrows(
  () => ensureAdminIngresoSuccess({ ok: false, data: { error: "network down" } }, "fallback"),
  "network down",
  "throws server error message on request failure",
);

assertThrows(
  () => ensureAdminIngresoSuccess({ ok: true, data: { success: false } }, "fallback"),
  "fallback",
  "throws fallback when response marks save as failed",
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
