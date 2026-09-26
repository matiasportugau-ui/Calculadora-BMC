/**
 * IsoRoof Colonial profile lookup.
 * Run: node tests/colonialProfileSkuGates.test.js
 *
 * Colonial panels share IsoRoof flashings, except the colonial cumbrera
 * (CUMROOFCOL, 2.20 m). Dropping the remap underquotes the roof: goteros
 * resolve to null while panel tests still pass.
 */
import assert from "node:assert/strict";
import {
  resolveSKU_techo,
  resolveSKU_techoByRange,
} from "../src/utils/calculations.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("colonialProfileSkuGates");

{
  const colonial = resolveSKU_techo("gotero_frontal", "ISOROOF_COLONIAL", 50);
  const roof = resolveSKU_techo("gotero_frontal", "ISOROOF", 50);
  assert.equal(colonial?.sku, "GFS50");
  assert.equal(colonial?.sku, roof?.sku);
  assert.equal(colonial?.venta, 17.78);
  assert.equal(colonial?.largo, 3.03);
  assert.notEqual(colonial, roof);

  colonial.sku = "MUTATED";
  colonial.venta = 0;
  assert.equal(resolveSKU_techo("gotero_frontal", "ISOROOF_COLONIAL", 50)?.sku, "GFS50");
  assert.equal(resolveSKU_techo("gotero_frontal", "ISOROOF", 50)?.venta, 17.78);
  ok("colonial gotero 50 mm borrows GFS50 and the result is a copy");
}

{
  assert.equal(resolveSKU_techo("gotero_frontal", "ISOROOF_COLONIAL", "50")?.sku, "GFS50");
  assert.equal(resolveSKU_techo("gotero_frontal", "ISOROOF_COLONIAL", 60), null);
  assert.equal(resolveSKU_techoByRange("gotero_frontal", "ISOROOF_COLONIAL", 60)?.sku, "GFS50");
  assert.equal(resolveSKU_techoByRange("gotero_frontal", "ISOROOF_COLONIAL", 20)?.sku, "GFS30");
  assert.equal(resolveSKU_techoByRange("gotero_frontal", "ISOROOF_COLONIAL", 100)?.sku, "GFS100");
  ok("colonial thickness ladder follows IsoRoof, including the 60 mm step-down");
}

{
  const cumbrera = resolveSKU_techo("cumbrera", "ISOROOF_COLONIAL", 40);
  assert.equal(cumbrera?.sku, "CUMROOFCOL");
  assert.equal(cumbrera?.largo, 2.2);
  assert.equal(cumbrera?.venta, 98.68);
  assert.equal(resolveSKU_techo("cumbrera", "ISOROOF", 40)?.sku, "CUMROOF3M");
  assert.equal(resolveSKU_techo("cumbrera", "ISOROOF", 40)?.largo, 3.03);
  assert.equal(resolveSKU_techoByRange("cumbrera", "ISOROOF_COLONIAL", 999)?.sku, "CUMROOFCOL");
  ok("colonial cumbrera stays CUMROOFCOL 2.20 m, not the 3 m IsoRoof ridge");
}

{
  assert.equal(resolveSKU_techo("babeta_adosar", "ISOROOF_COLONIAL", 40)?.sku, "BBAS3G");
  assert.equal(resolveSKU_techo("babeta_empotrar", "ISOROOF_COLONIAL", 40)?.sku, "BBESUP");
  assert.equal(resolveSKU_techo("canalon", "ISOROOF_COLONIAL", 50)?.sku, "CD50");
  assert.equal(resolveSKU_techo("no_such_profile", "ISOROOF_COLONIAL", 50), null);
  assert.equal(resolveSKU_techo("Cumbrera", "ISOROOF_COLONIAL", 40), null);
  assert.equal(resolveSKU_techo("gotero_frontal", "ISOROOF_COLONIAL ", 50), null);
  assert.equal(resolveSKU_techo("gotero_frontal", "isoroof_colonial", 50), null);
  assert.equal(resolveSKU_techo("gotero_frontal", null, 50), null);
  ok("other colonial flashings borrow IsoRoof; unknown or mistyped keys stay null");
}

console.log(`colonialProfileSkuGates: ${passed} passed`);
