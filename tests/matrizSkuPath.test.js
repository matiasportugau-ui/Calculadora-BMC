/**
 * MATRIZ col D SKU → calculator path (#1038 PA5852, #1054 bake).
 * Wrong alias → wrong constants path → silent money miss on bake / live sync.
 * Run: node tests/matrizSkuPath.test.js
 */
import assert from "node:assert/strict";
import {
  normalizeSku,
  getPathForMatrizSku,
} from "../src/data/matrizPreciosMapping.js";

let passed = 0;
function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

console.log("matrizSkuPath");

{
  assert.equal(normalizeSku(" pa-5852 "), "PA5852");
  assert.equal(normalizeSku("C.But."), "C.BUT.");
  assert.equal(normalizeSku("Cab. Roj"), "CAB.ROJ");
  assert.equal(normalizeSku("CAN.ISDC120"), "CAN.ISDC120");
  assert.equal(normalizeSku(6838), "6838");
  assert.equal(normalizeSku(""), "");
  assert.equal(normalizeSku(null), "");
  ok("normalizeSku: case / spaces / hyphen / keep dots / numeric");
}

{
  assert.equal(getPathForMatrizSku("PA5852"), "PERFIL_PARED.perfil_5852._all");
  assert.equal(getPathForMatrizSku("pa-5852"), "PERFIL_PARED.perfil_5852._all");
  assert.equal(getPathForMatrizSku(" PA 5852 "), "PERFIL_PARED.perfil_5852._all");
  ok("PA5852 hyphen/space variants resolve to perfil_5852 (not PLECHU98)");
}

{
  assert.equal(getPathForMatrizSku("ISOCOL40"), "PANELS_TECHO.ISOROOF_COLONIAL.esp.40");
  assert.equal(getPathForMatrizSku("IAGRO40COL"), "PANELS_TECHO.ISOROOF_COLONIAL.esp.40");
  assert.equal(getPathForMatrizSku("IAGCOL40"), "PANELS_TECHO.ISOROOF_COLONIAL.esp.40");
  assert.equal(getPathForMatrizSku("ICR040"), "PANELS_TECHO.ISOROOF_COLONIAL.esp.40");
  assert.notEqual(getPathForMatrizSku("ISOCOL40"), getPathForMatrizSku("IAGRO30"));
  assert.notEqual(String(getPathForMatrizSku("ISOCOL40")), "PANELS_TECHO.ISOROOF_FOIL.esp.40");
  ok("Colonial 40 aliases stay Colonial, never FOIL");
}

{
  assert.equal(getPathForMatrizSku("CUMROOFCOL"), "PERFIL_TECHO.cumbrera.ISOROOF_COLONIAL._all");
  assert.equal(getPathForMatrizSku("CUMCOL22"), "PERFIL_TECHO.cumbrera.ISOROOF_COLONIAL._all");
  assert.equal(getPathForMatrizSku("CUMROOF3M"), "PERFIL_TECHO.cumbrera.ISOROOF._all");
  assert.notEqual(getPathForMatrizSku("CUMROOFCOL"), getPathForMatrizSku("CUMROOF3M"));
  ok("colonial cumbrera SKUs do not collide with CUMROOF3M");
}

{
  assert.equal(getPathForMatrizSku("C.But."), "SELLADORES.cinta_butilo");
  assert.equal(getPathForMatrizSku("C.BUT."), "SELLADORES.cinta_butilo");
  assert.equal(getPathForMatrizSku("Cab. Roj"), "FIJACIONES.caballete");
  assert.equal(getPathForMatrizSku("CAN.ISDC120"), "PERFIL_TECHO.canalon.ISODEC.120");
  assert.equal(getPathForMatrizSku("CANISDC120"), "PERFIL_TECHO.canalon.ISODEC.120");
  ok("dotted MATRIZ SKUs (C.But. / Cab. Roj / CAN.ISDC120) resolve");
}

{
  assert.equal(getPathForMatrizSku("PU250MM"), "PERFIL_PARED.perfil_u.ISOPANEL.250");
  assert.equal(getPathForMatrizSku("PGLC250"), "PERFIL_TECHO.gotero_lateral_camara.ISODEC.250");
  assert.equal(getPathForMatrizSku("AC38G"), "FIJACIONES.arandela_carrocero");
  assert.equal(getPathForMatrizSku("APHG38"), "FIJACIONES.arandela_plana");
  assert.equal(getPathForMatrizSku("SN300B"), "SELLADORES.silicona_300_neutra");
  assert.equal(getPathForMatrizSku(6838), "PERFIL_TECHO.gotero_frontal.ISODEC.100");
  assert.equal(getPathForMatrizSku("6838"), "PERFIL_TECHO.gotero_frontal.ISODEC.100");
  ok("#1054 bake SKUs + numeric col D keep their calculator paths");
}

{
  assert.equal(getPathForMatrizSku("NO-SUCH-SKU"), undefined);
  assert.equal(getPathForMatrizSku(""), undefined);
  assert.equal(getPathForMatrizSku(null), undefined);
  ok("unknown / empty SKU → undefined (do not invent a path)");
}

console.log(`\nmatrizSkuPath: ${passed} passed`);
