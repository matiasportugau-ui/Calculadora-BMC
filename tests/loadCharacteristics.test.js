/**
 * Run: node tests/loadCharacteristics.test.js
 */
import assert from "node:assert/strict";
import { estimatePanelLinePhysical, ROW_W } from "../src/utils/logistica/loadCharacteristics.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("loadCharacteristics AU vs ROW_W");

assert.equal(ROW_W, 1.2);
{
  const e = estimatePanelLinePhysical({ tipo: "ISODEC", espesor: 100, longitud: 10.15, cantidad: 10 });
  assert.ok(Math.abs(e.m2 - 113.68) < 0.001, `expected 113.68 covering m², got ${e.m2}`);
  assert.ok(Math.abs(e.au - 1.12) < 1e-9);
  assert.ok(Math.abs(e.m2 - 10 * 10.15 * 1.2) > 1, "must not use truck ROW_W for covering m²");
  ok("ISODEC covering uses AU 1.12 not 1.2");
}

console.log(`\n${passed} passed`);
