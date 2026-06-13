// ═══════════════════════════════════════════════════════════════════════════
// tests/apiKeyUtils.test.js — placeholder API keys must be treated as absent
//
// Regression: voice mode returned a confusing "Whisper API 401" because the
// env held the .env.example placeholder `sk-your-openai-api-key-here`, which a
// naive `if (!key)` check accepts. isUsableApiKey rejects placeholders.
//
// Run: node tests/apiKeyUtils.test.js
// ═══════════════════════════════════════════════════════════════════════════

import { isUsableApiKey } from "../server/lib/apiKeyUtils.js";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ ${label}`); }
}

// ── placeholders / empties → NOT usable ─────────────────────────────────────
assert(!isUsableApiKey(""), "empty → not usable");
assert(!isUsableApiKey(null), "null → not usable");
assert(!isUsableApiKey("   "), "whitespace → not usable");
assert(!isUsableApiKey("..."), "dots → not usable");
assert(!isUsableApiKey("sk-your-openai-api-key-here"), "sk-your-... placeholder → not usable");
assert(!isUsableApiKey("sk-your-openai-api-key-here-1234"), "sk-your-...-1234 (len 34) → not usable");
assert(!isUsableApiKey("your-key-here"), "your-key-here → not usable");
assert(!isUsableApiKey("REPLACE_ME"), "REPLACE_ME → not usable");
assert(!isUsableApiKey("changeme"), "changeme → not usable");
assert(!isUsableApiKey("sk-123"), "too short → not usable");

// ── real-looking keys → usable ──────────────────────────────────────────────
assert(isUsableApiKey("long-secret-key-" + "a1B2c3D4e5".repeat(5)), "long-secret-key-<50 random> → usable");
assert(isUsableApiKey("api-key-" + "Xy9".repeat(16)), "api-key-<48 random> → usable");
assert(isUsableApiKey("secret-prefix-" + "B".repeat(33)), "secret-prefix- key → usable");

console.log(`\n${failed === 0 ? "✅" : "❌"} apiKeyUtils: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
