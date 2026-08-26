/**
 * IVA / totals: dirty BOM lines, default 22%, 2-decimal rounding.
 * Run: node tests/calcTotalesIva.test.js
 *
 * Uses the engine export (calculations.js → getIVA). Does not pin live catalog USD.
 */
import { calcTotalesSinIVA } from "../src/utils/calculations.js";
import { getIVA, resetConfig } from "../src/utils/calculatorConfig.js";

let passed = 0;
let failed = 0;
function assert(cond, label, got, exp) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`, { got, exp });
  }
}

resetConfig();

console.log("calcTotalesIva — default rate");
assert(getIVA() === 0.22, "getIVA default is 0.22 without localStorage", getIVA(), 0.22);

console.log("calcTotalesIva — empty / dirty lines");
{
  const empty = calcTotalesSinIVA([]);
  assert(empty.subtotalSinIVA === 0 && empty.iva === 0 && empty.totalFinal === 0, "empty BOM → zeros");
}

{
  let threw = false;
  try {
    calcTotalesSinIVA([{ total: 100 }, null]);
  } catch (e) {
    threw = e instanceof TypeError;
  }
  assert(threw, "null line throws (does not skip)", threw, true);
}

{
  const dirty = calcTotalesSinIVA([
    { total: 100 },
    {},
    { total: Number.NaN },
    { total: undefined },
    { label: "no money" },
  ]);
  assert(dirty.subtotalSinIVA === 100, "NaN/missing total count as 0", dirty.subtotalSinIVA, 100);
  assert(dirty.iva === 22, "IVA 22% of 100", dirty.iva, 22);
  assert(dirty.totalFinal === 122, "totalFinal 122", dirty.totalFinal, 122);
}

console.log("calcTotalesIva — rounding");
{
  // 10.004 + 10.004 = 20.008 → 20.01; 20.01 × 0.22 = 4.4022 → 4.40; 24.41
  const r = calcTotalesSinIVA([{ total: 10.004 }, { total: 10.004 }]);
  assert(r.subtotalSinIVA === 20.01, "subtotal rounds half-up to 2 dp", r.subtotalSinIVA, 20.01);
  assert(r.iva === 4.4, "IVA from rounded subtotal", r.iva, 4.4);
  assert(r.totalFinal === 24.41, "totalFinal = rounded subtotal + IVA", r.totalFinal, 24.41);
}

{
  const items = [{ total: 10.1 }, { total: 0.2 }];
  const r = calcTotalesSinIVA(items);
  assert(r.subtotalSinIVA === 10.3, "10.10 + 0.20 = 10.30", r.subtotalSinIVA, 10.3);
  assert(r.iva === 2.27, "10.30 × 0.22 = 2.266 → 2.27", r.iva, 2.27);
  assert(r.totalFinal === 12.57, "10.30 + 2.27 = 12.57", r.totalFinal, 12.57);
  assert(items[0].total === 10.1, "does not mutate input totals", items[0].total, 10.1);
}

console.log(`\ncalcTotalesIva: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
