/**
 * Pricing override gates — operator localStorage prices flow into getPricing().
 * Run: node tests/pricingOverrideGates.test.js
 *
 * Pins current behavior. Do not "fix" these in a coverage PR:
 * - numeric NaN is stored (not deleted)
 * - non-numeric values are not parsed
 * - reset() sticks an in-memory {} and does not re-read localStorage
 * - applyBulkPercentByPrefix uses String.replace once, so a path with two
 *   ".web" segments is left unchanged
 */
import assert from "node:assert/strict";

const KEY = "bmc-pricing-overrides";

function installMemoryStorage(initial = {}) {
  const data = { ...initial };
  const api = {
    getItem(k) {
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
    },
    setItem(k, v) {
      data[k] = String(v);
    },
    removeItem(k) {
      delete data[k];
    },
  };
  globalThis.localStorage = api;
  return { data, api };
}

const bag = installMemoryStorage({
  [KEY]: JSON.stringify({ "PANELS_TECHO.ISODEC_EPS.esp.100.venta": 12.5 }),
});

const {
  getPricingOverrides,
  setPricingOverride,
  setPricingOverridesBulk,
  applyBulkPercent,
  applyBulkPercentByPrefix,
  resetPricingOverrides,
  applyOverridesToObject,
} = await import("../src/utils/pricingOverrides.js");

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("pricingOverrideGates");

{
  const first = getPricingOverrides();
  assert.equal(first["PANELS_TECHO.ISODEC_EPS.esp.100.venta"], 12.5);
  first["PANELS_TECHO.ISODEC_EPS.esp.100.venta"] = 1;
  assert.equal(getPricingOverrides()["PANELS_TECHO.ISODEC_EPS.esp.100.venta"], 12.5);
  ok("cold start reads storage; returned copy is not the cache");
}

{
  const saved = setPricingOverride("PANELS_TECHO.ISODEC_EPS.esp.100.venta", 10.129);
  assert.equal(saved["PANELS_TECHO.ISODEC_EPS.esp.100.venta"], 10.13);
  saved["PANELS_TECHO.ISODEC_EPS.esp.100.venta"] = 1;
  assert.equal(getPricingOverrides()["PANELS_TECHO.ISODEC_EPS.esp.100.venta"], 10.13);
  assert.equal(setPricingOverride("FIJACIONES.varilla.venta", 0)["FIJACIONES.varilla.venta"], 0);
  assert.equal(setPricingOverride("FIJACIONES.varilla.web", -1.239)["FIJACIONES.varilla.web"], -1.24);
  assert.equal(setPricingOverride("FIJACIONES.varilla.label", "10.129")["FIJACIONES.varilla.label"], "10.129");
  assert.equal(setPricingOverride("FIJACIONES.varilla.flag", true)["FIJACIONES.varilla.flag"], true);
  assert.equal(Number.isNaN(setPricingOverride("FIJACIONES.varilla.nan", NaN)["FIJACIONES.varilla.nan"]), true);
  const afterDelete = setPricingOverride("FIJACIONES.varilla.venta", null);
  assert.equal(Object.prototype.hasOwnProperty.call(afterDelete, "FIJACIONES.varilla.venta"), false);
  assert.equal(setPricingOverride("FIJACIONES.varilla.web", "")["FIJACIONES.varilla.web"], undefined);
  assert.equal(getPricingOverrides()["PANELS_TECHO.ISODEC_EPS.esp.100.venta"], 10.13);
  ok("2-decimal numbers; 0 and negatives kept; strings/bools/NaN not coerced; null and blank delete");
}

{
  const bulk = setPricingOverridesBulk({
    "A.venta": 2.345,
    "A.web": "",
    "A.note": "web",
    "B.venta": null,
  });
  assert.equal(bulk["A.venta"], 2.35);
  assert.equal(Object.prototype.hasOwnProperty.call(bulk, "A.web"), false);
  assert.equal(bulk["A.note"], "web");
  assert.equal(Object.prototype.hasOwnProperty.call(bulk, "B.venta"), false);
  ok("bulk rounds numbers and deletes blank or null without touching other keys");
}

{
  setPricingOverride("A.web", 10);
  const bumped = applyBulkPercent(["A"], "web", 10, () => {
    throw new Error("base must not be read when an override exists");
  });
  assert.equal(bumped["A.web"], 11);
  resetPricingOverrides();
  const fromBase = applyBulkPercent(["A"], "web", 10, (fullPath) => (fullPath === "A.web" ? 40 : "40"));
  assert.equal(fromBase["A.web"], 44);
  assert.equal(Object.prototype.hasOwnProperty.call(fromBase, "A.venta"), false);
  const zeroed = applyBulkPercent(["Z"], "venta", 10, () => 0);
  assert.equal(zeroed["Z.venta"], 0);
  const negative = applyBulkPercent(["NEG"], "venta", -150, () => 100);
  assert.equal(negative["NEG.venta"], -50);
  const skipped = applyBulkPercent(["Q"], "web", 10, () => "10");
  assert.equal(Object.prototype.hasOwnProperty.call(skipped, "Q.web"), false);
  ok("percent uses the override first; strings are skipped; 0 and negative prices are not clamped");
}

{
  resetPricingOverrides();
  setPricingOverride("A.web", 100);
  setPricingOverride("A.web.tail.web", 100);
  setPricingOverride("A.venta", 50);
  setPricingOverride("XA.web", 80);
  const next = applyBulkPercentByPrefix("A", "web", 10);
  assert.equal(next["A.web"], 110);
  assert.equal(next["A.web.tail.web"], 100);
  assert.equal(next["A.venta"], 50);
  assert.equal(next["XA.web"], 80);
  assert.equal(Object.prototype.hasOwnProperty.call(next, "A.tail.web.web"), false);
  ok("prefix percent hits one .web suffix; a second .web is a no-op; XA.web is outside the prefix");
}

{
  resetPricingOverrides();
  localStorage.setItem(KEY, JSON.stringify({ "Sneaky.venta": 99 }));
  assert.deepEqual(getPricingOverrides(), {});
  setPricingOverride("A.venta", 1);
  const saved = JSON.parse(localStorage.getItem(KEY));
  assert.equal(saved["Sneaky.venta"], undefined);
  assert.equal(saved["A.venta"], 1);
  ok("after reset, storage written behind the cache is ignored and then overwritten");
}

{
  const base = {
    PANELS_TECHO: { ISO: { esp: { 100: { venta: 10, web: 12 } } } },
    extra: { kept: true },
  };
  const out = applyOverridesToObject(base, {
    "PANELS_TECHO.ISO.esp.100.venta": 15.5,
    "NEW.0.venta": 3,
  });
  assert.equal(base.PANELS_TECHO.ISO.esp[100].venta, 10);
  assert.equal(out.PANELS_TECHO.ISO.esp[100].venta, 15.5);
  assert.equal(out.PANELS_TECHO.ISO.esp[100].web, 12);
  assert.equal(out.extra.kept, true);
  assert.ok(Array.isArray(out.NEW));
  assert.equal(out.NEW[0].venta, 3);
  assert.notEqual(out, base);
  assert.notEqual(out.PANELS_TECHO, base.PANELS_TECHO);
  ok("apply clones; existing espesor object stays an object; a missing numeric segment becomes an array");
}

{
  bag.api.setItem = () => {
    throw new Error("quota");
  };
  const kept = setPricingOverride("QUOTA.venta", 7.5);
  assert.equal(kept["QUOTA.venta"], 7.5);
  assert.equal(getPricingOverrides()["QUOTA.venta"], 7.5);
  ok("storage write failure still keeps the in-memory override");
}

console.log(`\npricingOverrideGates: ${passed} passed`);
