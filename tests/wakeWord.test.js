// ═══════════════════════════════════════════════════════════════════════════
// tests/wakeWord.test.js — Panelín hands-free wake-word matcher
//
// The wake word is a coined brand word ("Panelín"). Spanish ASR transcribes it
// WITH an accent ("panelín") and/or SPLIT into two words ("panel in"), so a raw
// substring test for "panelin" silently never matched — the panel looked live
// but never woke. hasWake() must tolerate accents, spacing and casing.
//
// Run: node tests/wakeWord.test.js
// ═══════════════════════════════════════════════════════════════════════════

import { hasWake, wakeRestartDelayMs } from "../src/hooks/useHandsFreeVoice.js";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ ${label}`); }
}

// ── Should MATCH (the real-world ASR variants that used to fail) ─────────────
assert(hasWake("panelin"), "plain 'panelin'");
assert(hasWake("Panelín"), "accented 'Panelín' (the core bug)");
assert(hasWake("panelín"), "lowercase accented 'panelín'");
assert(hasWake("panel in"), "split 'panel in'");
assert(hasWake("Panel ín"), "split + accent 'Panel ín'");
assert(hasWake("hola panelín cómo estás"), "embedded in a sentence");
assert(hasWake("oye, Panelin."), "trailing punctuation");
assert(hasWake("panelina"), "common mishear 'panelina'");
assert(hasWake("panecillo"), "common mishear 'panecillo'");

// ── Should NOT match (avoid spurious wakes) ─────────────────────────────────
assert(!hasWake(""), "empty string");
assert(!hasWake(null), "null is safe");
assert(!hasWake(undefined), "undefined is safe");
assert(!hasWake("hola buenos días"), "unrelated speech");
assert(!hasWake("el panel está roto"), "the word 'panel' alone does not wake");

// ── Wake onend backoff (B-02) ───────────────────────────────────────────────
assert(wakeRestartDelayMs(0) === 150, "attempt 0 → 150ms");
assert(wakeRestartDelayMs(1) === 300, "attempt 1 → 300ms");
assert(wakeRestartDelayMs(2) === 600, "attempt 2 → 600ms");
assert(wakeRestartDelayMs(5) === 4000, "attempt 5 → 4000ms cap");
assert(wakeRestartDelayMs(99) === 4000, "high attempt still capped");

console.log(`\n${failed === 0 ? "✅" : "❌"} wakeWord: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
