/**
 * Plano 2D vs BOM. Run: node tests/panelLayoutVerifyGates.test.js
 *
 * Pins verifyPanelLayout: count is strict equality, area tolerance is 0.01
 * (a 0.01 delta still passes because of binary float), ancho tolerance is 1e-6,
 * and a negative largo is not absolute-valued.
 */
import assert from "node:assert/strict";
import { verifyPanelLayout } from "../src/utils/panelLayoutVerification.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const layout = { totalPanels: 4, au: 1.12, anchoTotal: 4.48 };
const bom = { cantPaneles: 4, areaTotal: 44.8, anchoTotal: 4.48 };

console.log("panelLayoutVerify gates");

{
  assert.deepEqual(verifyPanelLayout(null, bom, 10), { ok: false, error: "missing layout or bomResult" });
  assert.deepEqual(verifyPanelLayout(layout, 0, 10), { ok: false, error: "missing layout or bomResult" });
  assert.equal(verifyPanelLayout(undefined, undefined, 10).ok, false);
  const empty = verifyPanelLayout({}, {}, 10);
  assert.equal(empty.ok, false);
  assert.equal(empty.error, undefined);
  assert.ok(Number.isNaN(empty.layoutArea));
  assert.ok(Number.isNaN(empty.bomArea));
  ok("only falsy inputs use the missing-error branch");
}

{
  const hit = verifyPanelLayout(layout, bom, 10);
  assert.equal(hit.ok, true);
  assert.equal(hit.layoutArea, 44.8);
  assert.equal(hit.panelCountMatch, true);
  assert.equal(hit.areaMatch, true);
  assert.equal(hit.anchoTotalMatch, true);
  assert.deepEqual(hit.delta, { panels: 0, area: 0, anchoM: 0 });
  assert.equal(verifyPanelLayout(layout, { ...bom, areaTotal: "44.80" }, 10).ok, true);
  ok("exact layout matches BOM, including a string area");
}

{
  const inside = verifyPanelLayout(layout, { ...bom, areaTotal: 44.8 + 0.009 }, 10);
  const cent = verifyPanelLayout(layout, { ...bom, areaTotal: 44.8 + 0.01 }, 10);
  const outside = verifyPanelLayout(layout, { ...bom, areaTotal: 44.8 + 0.0101 }, 10);
  assert.equal(inside.ok, true);
  assert.equal(inside.delta.area, -0.009);
  assert.equal(cent.areaMatch, true);
  assert.equal(cent.ok, true);
  assert.equal(outside.areaMatch, false);
  assert.equal(outside.ok, false);
  assert.equal(outside.panelCountMatch, true);
  assert.equal(outside.anchoTotalMatch, true);
  ok("area delta 0.01 still matches; 0.0101 does not");
}

{
  const tight = verifyPanelLayout(layout, { ...bom, anchoTotal: 4.48 + 1e-7 }, 10);
  const edge = verifyPanelLayout(layout, { ...bom, anchoTotal: 4.48 + 1e-6 }, 10);
  assert.equal(tight.anchoTotalMatch, true);
  assert.equal(tight.ok, true);
  assert.equal(edge.anchoTotalMatch, false);
  assert.equal(edge.ok, false);
  assert.equal(edge.areaMatch, true);
  ok("ancho delta 1e-7 matches and 1e-6 does not");
}

{
  const count = verifyPanelLayout(layout, { ...bom, cantPaneles: 5 }, 10);
  assert.equal(count.ok, false);
  assert.equal(count.panelCountMatch, false);
  assert.equal(count.areaMatch, true);
  assert.equal(count.anchoTotalMatch, true);
  assert.equal(count.delta.panels, -1);
  const stringCount = verifyPanelLayout({ ...layout, totalPanels: "4" }, bom, 10);
  assert.equal(stringCount.panelCountMatch, false);
  assert.equal(stringCount.ok, false);
  const comma = verifyPanelLayout(layout, { ...bom, areaTotal: "44,80" }, 10);
  assert.equal(comma.areaMatch, false);
  assert.ok(Number.isNaN(comma.bomArea));
  ok("count uses ===, a comma area is NaN, and one extra panel fails");
}

{
  const neg = verifyPanelLayout(layout, { cantPaneles: 4, areaTotal: -44.8, anchoTotal: 4.48 }, -10);
  assert.equal(neg.ok, true);
  assert.equal(neg.layoutArea, -44.8);
  const missingLargo = verifyPanelLayout(layout, bom, undefined);
  assert.equal(missingLargo.ok, false);
  assert.ok(Number.isNaN(missingLargo.layoutArea));
  assert.equal(missingLargo.error, undefined);
  ok("negative largo stays signed; a missing largo is NaN, not thrown");
}

console.log(`panelLayoutVerify gates: ${passed} passed`);
