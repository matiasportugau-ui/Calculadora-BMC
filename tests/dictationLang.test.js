// ═══════════════════════════════════════════════════════════════════════════
// tests/dictationLang.test.js — useDictation language mapping + SR detection
//
// Voice dictation now prefers the browser Web Speech API (free, no OpenAI key)
// and falls back to Whisper. These pure helpers drive that path.
//
// Run: node tests/dictationLang.test.js
// ═══════════════════════════════════════════════════════════════════════════

import { toBrowserLang, getSpeechRecognition } from "../src/hooks/useDictation.js";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ ${label}`); }
}

// ── toBrowserLang: ISO-639-1 → BCP-47 ───────────────────────────────────────
assert(toBrowserLang("es") === "es-419", "es → es-419 (Latin American Spanish)");
assert(toBrowserLang("es-ES") === "es-ES", "es-ES passes through");
assert(toBrowserLang("es-UY") === "es-UY", "es-UY passes through");
assert(toBrowserLang("en") === "en", "non-es passes through");
assert(toBrowserLang(undefined) === "es-419", "undefined defaults to es-419");

// ── getSpeechRecognition: no window (Node) → null, never throws ──────────────
assert(getSpeechRecognition() === null, "no window → null (does not throw)");

console.log(`\n${failed === 0 ? "✅" : "❌"} dictationLang: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
