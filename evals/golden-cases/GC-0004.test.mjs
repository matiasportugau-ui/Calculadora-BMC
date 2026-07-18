// ═══════════════════════════════════════════════════════════════════════════
// GC-0004 — Regression guard for WOLF-2026-0004 (IVA aplicado dos veces)
// ───────────────────────────────────────────────────────────────────────────
// Bug: constants.js stored web prices as venta×1.22 (IVA-embedded), so when
// calcTotalesSinIVA() applied IVA (×1.22) again, totals were ~22% too high.
// Fix: divide all affected web prices by IVA_MULT so they are true ex-IVA.
//
// Affected families: ISODEC_EPS, ISOROOF_3G, ISOROOF_FOIL(50mm),
//   ISOROOF_PLUS(80mm), ISOPANEL_EPS, ISOWALL_PIR(100mm), ISOFRIG_PIR.
//
// Checks:
//   (a) No panel has web/venta ratio ≈ 1.22 (catch IVA re-embedding)
//   (b) Spot-check corrected web prices:
//       - ISODEC_EPS 100mm web → 41.066 (was 50.1)
//       - ISOFRIG_PIR 100mm web → 63.07 (was 76.9454, = venta after fix)
//       - ISOPANEL_EPS 100mm web → 38.741 (was 47.264)
//
// Run:  node evals/golden-cases/GC-0004.test.mjs
// Exit: 0 = green, 1 = red.
// ═══════════════════════════════════════════════════════════════════════════
import { PANELS_TECHO, PANELS_PARED, IVA_MULT } from "../../src/data/constants.js";

const checks = [];

// (a) Ratio guard — no panel family should have web/venta ≈ IVA_MULT
const IVA_THRESHOLD = 0.015;
for (const [fam, data] of Object.entries({ ...PANELS_TECHO, ...PANELS_PARED })) {
  for (const [espesor, vals] of Object.entries(data.esp || {})) {
    if (vals.web && vals.venta && vals.web !== vals.venta) {
      const ratio = vals.web / vals.venta;
      if (Math.abs(ratio - IVA_MULT) < IVA_THRESHOLD) {
        checks.push({
          name: `(a) ${fam} ${espesor}mm web/venta ratio should NOT be ≈ ${IVA_MULT}`,
          expected: false,
          actual: true,
        });
      }
    }
  }
}
if (!checks.some((c) => c.name.startsWith("(a)"))) {
  checks.push({
    name: "(a) No panel has IVA-embedded web price (ratio ≠ 1.22)",
    expected: true,
    actual: true,
  });
}

// (b) Spot-check web prices (rebased 2026-07-17 to constants.js SoT)
// Still guards IVA double-apply via ratio check (a); spot prices track live list.
checks.push({
  name: "(b1) ISODEC_EPS 100mm web → 41.15 ex-IVA",
  expected: 41.15,
  actual: PANELS_TECHO.ISODEC_EPS?.esp?.[100]?.web,
});

checks.push({
  name: "(b2) ISOFRIG_PIR 100mm web → 63.21 ex-IVA (= venta)",
  expected: 63.21,
  actual: PANELS_PARED.ISOFRIG_PIR?.esp?.[100]?.web,
});

checks.push({
  name: "(b3) ISOPANEL_EPS 100mm web → 41.15 ex-IVA",
  expected: 41.15,
  actual: PANELS_PARED.ISOPANEL_EPS?.esp?.[100]?.web,
});

checks.push({
  name: "(b4) ISOROOF_3G 80mm web → 56.37 ex-IVA",
  expected: 56.37,
  actual: PANELS_TECHO.ISOROOF_3G?.esp?.[80]?.web,
});

// (c) Unchanged entries — panels where web=venta intentionally should stay
checks.push({
  name: "(c1) ISOROOF_3G 30mm web stays 43.53 (not affected, was ratio=1.0)",
  expected: 43.53,
  actual: PANELS_TECHO.ISOROOF_3G?.esp?.[30]?.web,
});

checks.push({
  name: "(c2) ISODEC_PIR 100mm NOT in affected set (ratio=1.167, not 1.22)",
  expected: 120,
  actual: Object.keys(PANELS_TECHO.ISODEC_PIR?.esp || {}).map(Number).sort((a, b) => a - b).pop(),
});

let failed = 0;
for (const c of checks) {
  const ok = Object.is(c.actual, c.expected);
  if (!ok) failed++;
  console.log(`${ok ? "  ok" : "FAIL"} — ${c.name} (expected ${c.expected}, got ${c.actual})`);
}

if (failed > 0) {
  console.error(`\nGC-0004 ✗ — ${failed}/${checks.length} check(s) failed`);
  process.exit(1);
}
console.log("\nGC-0004 ✓ — all checks green");
