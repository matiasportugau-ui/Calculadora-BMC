// ═══════════════════════════════════════════════════════════════════════════
// wolfboard col-L outcome mapper — deriveOutcome(estadoRaw)
//
// Verifies the Alt-B projection of Admin 2.0 col L ("Estado", free-form
// Spanish) to a stable {won|lost|awaiting_reply|null} enum.
//
// Run: node tests/wolfboard-derive-outcome.test.js
// ═══════════════════════════════════════════════════════════════════════════

import { deriveOutcome, OUTCOME_MAP } from "../server/lib/wolfboardOutcome.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

console.log("\n— deriveOutcome");

// Happy path — exact strings (lowercase)
assert(deriveOutcome("ok") === "won", 'deriveOutcome("ok") = won');
assert(deriveOutcome("cerrado") === "won", 'deriveOutcome("cerrado") = won');
assert(deriveOutcome("cerrado ok") === "won", 'deriveOutcome("cerrado ok") = won');
assert(deriveOutcome("ganado") === "won", 'deriveOutcome("ganado") = won');
assert(deriveOutcome("perdido") === "lost", 'deriveOutcome("perdido") = lost');
assert(deriveOutcome("abandonado") === "lost", 'deriveOutcome("abandonado") = lost');
assert(deriveOutcome("rechazado") === "lost", 'deriveOutcome("rechazado") = lost');
assert(deriveOutcome("enviado") === "awaiting_reply", 'deriveOutcome("enviado") = awaiting_reply');
assert(deriveOutcome("en espera") === "awaiting_reply", 'deriveOutcome("en espera") = awaiting_reply');
assert(deriveOutcome("aprobado") === "awaiting_reply", 'deriveOutcome("aprobado") = awaiting_reply');

// Case-insensitive
assert(deriveOutcome("OK") === "won", "case-insensitive: OK");
assert(deriveOutcome("Cerrado OK") === "won", "case-insensitive: Cerrado OK");
assert(deriveOutcome("ENVIADO") === "awaiting_reply", "case-insensitive: ENVIADO");

// Whitespace tolerant
assert(deriveOutcome("  ok  ") === "won", "trims leading/trailing whitespace");
assert(deriveOutcome(" perdido ") === "lost", "trims around 'perdido'");

// Empty / nullish → null
assert(deriveOutcome("") === null, "empty string → null");
assert(deriveOutcome(null) === null, "null → null");
assert(deriveOutcome(undefined) === null, "undefined → null");
assert(deriveOutcome(0) === null, "0 (coerces to '0') → null");
assert(deriveOutcome("   ") === null, "whitespace-only → null");

// Unknown strings → null (no false positives)
assert(deriveOutcome("Listo!") === null, "'Listo!' (free-form, not in map) → null");
assert(deriveOutcome("ok 100%") === null, "'ok 100%' (has suffix) → null");
assert(deriveOutcome("OK ") === "won", "trailing space tolerated");
assert(deriveOutcome("won") === null, "English 'won' is NOT mapped (Spanish only)");

// OUTCOME_MAP export contract
assert(typeof OUTCOME_MAP === "object" && OUTCOME_MAP !== null, "OUTCOME_MAP exported");
assert(OUTCOME_MAP[""] === null, "OUTCOME_MAP[''] = null sentinel");

console.log(`\n  ✓ ${passed} assertions passed${failed ? `, ✗ ${failed} failed` : ""}`);
process.exit(failed > 0 ? 1 : 0);
