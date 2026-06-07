// ═══════════════════════════════════════════════════════════════════════════
// GC-0002 — Golden case for WOLF-2026-0002 (price realignment to Matriz, D1)
// ───────────────────────────────────────────────────────────────────────────
// Asserts the two anchor values that proved the column/row shift in the
// extraction that populated constants.js. All prices are ex-IVA (D1: IVA 22%
// applied once at the quote total).
//
//   (a) anclaje_isoroof_gris  web list, 100 units  → 215.00 ex IVA  (2.15 c/u)
//   (b) gotero_superior cámara 80 mm (ISODEC_PIR)  web unit → 37.07 ex IVA
//
// Run:  node evals/golden-cases/GC-0002.test.mjs
// Exit: 0 = green, 1 = red (fields drifted off the Matriz).
// ═══════════════════════════════════════════════════════════════════════════
import { FIJACIONES, PERFIL_TECHO } from "../../src/data/constants.js";

// round half up to 2 decimals (Matriz convention)
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const checks = [];

// (a) anclaje_isoroof_gris web list price × 100 units → 215.00 ex IVA
const grisWeb = FIJACIONES.anclaje_isoroof_gris.web;
checks.push({
  name: "(a) anclaje_isoroof_gris web ×100 → 215.00 ex IVA",
  expected: 215.0,
  actual: r2(grisWeb * 100),
});

// (b) gotero_superior cámara 80 mm (ISODEC_PIR) web unit price → 37.07 ex IVA
const gsdecam80Web = PERFIL_TECHO.gotero_superior.ISODEC_PIR[80].web;
checks.push({
  name: "(b) gotero_superior cámara 80 mm web unit → 37.07 ex IVA",
  expected: 37.07,
  actual: r2(gsdecam80Web),
});

let failed = 0;
for (const c of checks) {
  const ok = c.actual === c.expected;
  if (!ok) failed++;
  console.log(`${ok ? "  ok" : "FAIL"} — ${c.name} (expected ${c.expected}, got ${c.actual})`);
}

if (failed > 0) {
  console.error(`\nGC-0002 ✗ — ${failed}/${checks.length} check(s) failed`);
  process.exit(1);
}
console.log("\nGC-0002 ✓ — all checks green");
