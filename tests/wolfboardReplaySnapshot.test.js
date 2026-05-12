// ═══════════════════════════════════════════════════════════════════════════
// Wolfboard replay snapshot — schema matches server/lib/wolfboardQuoteSnapshot.js
//
// Run: node tests/wolfboardReplaySnapshot.test.js
// ═══════════════════════════════════════════════════════════════════════════

import { buildWolfboardQuoteReplaySnapshot } from "../server/lib/wolfboardQuoteSnapshot.js";
import { validateWolfboardReplaySnapshot } from "../scripts/fetch-wolfboard-replay.mjs";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

console.log("\n— wolfboard replay snapshot");

const snap = buildWolfboardQuoteReplaySnapshot({
  adminRow: 99,
  cliente: "Test",
  consulta: "Cotización techo 10x8 ISODEC EPS 100mm",
  extracted: { escenario: "solo_techo", techo: { largo: 10, ancho: 8 } },
  usedDefaults: ["espesor 100mm"],
  calcRaw: {
    paneles: { cantPaneles: 5, areaTotal: 50 },
    allItems: [{ label: "Panel", sku: "X", cant: 1, unidad: "m²", pu: 1, total: 1 }],
    totales: { subtotalSinIVA: 1, iva: 0.22, totalFinal: 1.22 },
    _escenario: "solo_techo",
  },
  listaPrecios: "web",
});

const errs = validateWolfboardReplaySnapshot(snap);
assert(errs.length === 0, `validator accepts builder output (${errs.join("; ")})`);
assert(snap.schemaVersion === 1, "schemaVersion 1");
assert(snap.kind === "wolfboard-quote-batch", "kind");
assert(typeof snap.generatedAt === "string", "generatedAt");
assert(snap.adminRow === 99, "adminRow");
assert(snap.extracted?.escenario === "solo_techo", "extracted preserved");
assert(Array.isArray(snap.calcRaw?.allItems), "calcRaw.allItems");

assert(validateWolfboardReplaySnapshot({}).length > 0, "reject empty object");
assert(validateWolfboardReplaySnapshot({ schemaVersion: 2, kind: "wolfboard-quote-batch" }).length > 0, "reject wrong version");

console.log(`\nRESULTADOS: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
