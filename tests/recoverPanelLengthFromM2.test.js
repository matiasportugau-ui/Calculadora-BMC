/**
 * Run: node tests/recoverPanelLengthFromM2.test.js
 */
import assert from "node:assert/strict";
import { anchoUtilForTipo, panelMaterialMetrics } from "../src/utils/logistica/panelAnchoUtil.js";
import {
  extractCoveringM2,
  recoverPanelLengthFromM2,
  lengthSourceWarnings,
} from "../src/utils/logistica/recoverPanelLengthFromM2.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("recoverPanelLengthFromM2");

assert.equal(anchoUtilForTipo("ISODEC"), 1.12);
assert.equal(anchoUtilForTipo("ISOPANEL EPS"), 1.14);
assert.equal(anchoUtilForTipo("ISOROOF 3G"), 1.0);
ok("anchoUtilForTipo families");

{
  const m2 = extractCoveringM2("ISODEC EPS 100mm · 10 paneles 113.68 m² 41.15");
  assert.equal(m2, 113.68);
  const L = recoverPanelLengthFromM2({ m2, cantidad: 10, tipo: "ISODEC" });
  assert.equal(L, 10.15);
  ok("Alvaro 113.68 m² → 10.15 m");
}

{
  assert.equal(recoverPanelLengthFromM2({ m2: 72, cantidad: 10, tipo: "ISODEC" }), 6.43);
  assert.equal(recoverPanelLengthFromM2({ m2: 0, cantidad: 10, tipo: "ISODEC" }), null);
  ok("recover range / reject empty area");
}

{
  const mat = panelMaterialMetrics({ tipo: "ISODEC", espesor: 100, longitud: 10.15, cantidad: 10 });
  assert.ok(Math.abs(mat.m2 - 113.68) < 0.001, mat.m2);
  assert.ok(Math.abs(mat.volumeM3 - 11.368) < 0.001, mat.volumeM3);
  ok("material m² matches quote covering");
}

{
  const w = lengthSourceWarnings(
    [{ tipo: "ISODEC", espesor: 100, cantidad: 10, longitud: 10.15, lengthInferredFromM2: true }],
    "Alcance: Techo · 2 Zonas",
  );
  assert.ok(w.some((line) => /inferido desde m²/i.test(line) && /2 largos/i.test(line)));
  ok("2 zonas warning on inferred L");
}

console.log(`\n${passed} passed`);
