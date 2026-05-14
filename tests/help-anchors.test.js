// ═══════════════════════════════════════════════════════════════════════════
// HELP_ANCHORS contract — frozen const + isKnownAnchor() helper
//
// Run: node tests/help-anchors.test.js
// ═══════════════════════════════════════════════════════════════════════════

import { HELP_ANCHORS, isKnownAnchor } from "../src/components/help/anchors.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

console.log("\n— HELP_ANCHORS");

// Frozen const — can't be mutated at runtime
assert(Object.isFrozen(HELP_ANCHORS), "HELP_ANCHORS is frozen");
const before = HELP_ANCHORS.KPI_PENDIENTES;
try {
  HELP_ANCHORS.KPI_PENDIENTES = "mutated";
} catch {
  /* strict mode throws; that's also fine */
}
assert(HELP_ANCHORS.KPI_PENDIENTES === before, "mutation attempt is a no-op");

// All values are strings (anchor ids)
for (const [key, value] of Object.entries(HELP_ANCHORS)) {
  assert(
    typeof value === "string" && value.length > 0,
    `HELP_ANCHORS.${key} is a non-empty string ("${value}")`,
  );
}

// Phase 3 placements (per drafts/04-phase3-anchor-placements.md) — verify the 15 expected ids exist
const expected = [
  "topbar-live", "topbar-cmdk", "topbar-skin-picker",
  "kpi-pendientes", "kpi-aprobadas", "kpi-error", "kpi-stale",
  "toolbar-scope", "batch-modal", "toolbar-sync-crm", "bulk-mark-enviadas",
  "drawer-regenerate-hint", "drawer-save-response", "drawer-aprobar", "drawer-marcar-enviada",
];
const values = new Set(Object.values(HELP_ANCHORS));
for (const id of expected) {
  assert(values.has(id), `HELP_ANCHORS contains "${id}"`);
}
assert(values.size === expected.length, `HELP_ANCHORS has exactly ${expected.length} ids (got ${values.size})`);

// isKnownAnchor()
assert(isKnownAnchor("kpi-pendientes") === true, "isKnownAnchor('kpi-pendientes') = true");
assert(isKnownAnchor("topbar-live") === true, "isKnownAnchor('topbar-live') = true");
assert(isKnownAnchor("not-a-real-anchor") === false, "isKnownAnchor('not-a-real-anchor') = false");
assert(isKnownAnchor("") === false, "isKnownAnchor('') = false");
assert(isKnownAnchor("kpi-pendinetes") === false, "isKnownAnchor('kpi-pendinetes' typo) = false");

console.log(`\n  ✓ ${passed} assertions passed${failed ? `, ✗ ${failed} failed` : ""}`);
process.exit(failed > 0 ? 1 : 0);
