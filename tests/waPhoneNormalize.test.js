/**
 * Contract tests for normalizePhoneForWaQuery
 * (used by src/components/admin-cotizaciones/WaTimelineInline.jsx).
 *
 * Backend uses `phone ilike '%q%'` on the `wa_conversations` table — so the
 * normalized query string must be a digit-only substring that's guaranteed
 * to match the canonical stored format ("598" + national number).
 *
 * Run: node tests/waPhoneNormalize.test.js
 */

import { normalizePhoneForWaQuery } from "../src/utils/waPhoneNormalize.js";

let passed = 0;
let failed = 0;

function eq(actual, expected, label) {
  if (actual === expected) { passed += 1; }
  else { failed += 1; console.error(`  ✗ ${label}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`); }
}
function group(name, fn) { console.log(`\n— ${name}`); fn(); }

group("UY mobile — 9 digits without country code", () => {
  eq(normalizePhoneForWaQuery("099162401"), "598099162401", "099162401 → prepend 598");
  eq(normalizePhoneForWaQuery("99162401"),  "59899162401",  "99162401 (8 digits) → prepend 598");
  eq(normalizePhoneForWaQuery("99 162 401"), "59899162401", "spaces stripped");
  eq(normalizePhoneForWaQuery("99-162-401"), "59899162401", "dashes stripped");
  eq(normalizePhoneForWaQuery("(099) 162 401"), "598099162401", "parens stripped");
});

group("UY mobile — already with country code", () => {
  eq(normalizePhoneForWaQuery("+598 99 162 401"), "59899162401", "+598 prefix + spaces stripped");
  eq(normalizePhoneForWaQuery("59899162401"), "59899162401", "59899162401 → unchanged");
  eq(normalizePhoneForWaQuery("598 99 162 401"), "59899162401", "598 prefix preserved");
});

group("UY fixed line — 8 digits", () => {
  eq(normalizePhoneForWaQuery("42224031"), "59842224031", "fixed line prepend 598");
  eq(normalizePhoneForWaQuery("4222 4031"), "59842224031", "fixed line spaces");
  eq(normalizePhoneForWaQuery("4222-4031"), "59842224031", "fixed line dashes");
});

group("Foreign numbers — no UY prefix added", () => {
  eq(normalizePhoneForWaQuery("(55) 41 9799-0617"), "554197990617", "Brasil 12 digits — kept as-is");
  eq(normalizePhoneForWaQuery("+1 415 555 1234"), "14155551234", "US 11 digits — kept");
  eq(normalizePhoneForWaQuery("541234567890"), "541234567890", "Argentina 12 digits — kept");
});

group("Edge cases", () => {
  eq(normalizePhoneForWaQuery(""), "", "empty → empty");
  eq(normalizePhoneForWaQuery(null), "", "null → empty");
  eq(normalizePhoneForWaQuery(undefined), "", "undefined → empty");
  eq(normalizePhoneForWaQuery("ML"), "", "literal 'ML' → empty (no digits)");
  eq(normalizePhoneForWaQuery("desc"), "", "literal 'desc' → empty (no digits)");
  eq(normalizePhoneForWaQuery("abc 123 def"), "123", "below-threshold digits preserved (no prefix added)");
});

console.log(`\n${failed === 0 ? "✓" : "✗"} waPhoneNormalize: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
