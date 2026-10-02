/**
 * Pins IVA / lista / flete defaults stored for the calculator.
 * Run: node tests/calculatorConfigGates.test.js
 */
import assert from "node:assert/strict";

function createMemoryStorage() {
  const data = new Map();
  const throwKeys = new Set();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      if (throwKeys.has(key)) throw new Error("quota");
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    throwOn(key) {
      throwKeys.add(key);
    },
  };
}

const KEY = "bmc-calculator-config";
const storage = createMemoryStorage();
globalThis.localStorage = storage;

const {
  getConfig,
  setConfig,
  getIVA,
  getListaDefault,
  getFleteDefault,
  resetConfig,
} = await import("../src/utils/calculatorConfig.js");

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function loadRaw(obj) {
  resetConfig();
  storage.setItem(KEY, JSON.stringify(obj));
}

console.log("calculatorConfigGates");

resetConfig();
assert.deepEqual(getConfig(), { iva: 0.22, listaDefault: "venta", fleteDefault: 280 });
assert.equal(getIVA(), 0.22);
assert.equal(getListaDefault(), "venta");
assert.equal(getFleteDefault(), 280);
ok("empty storage uses venta, 22% IVA, and flete 280");

loadRaw({ iva: 0, fleteDefault: 0, listaDefault: "" });
assert.equal(getConfig().iva, 0);
assert.equal(getIVA(), 0);
assert.equal(getFleteDefault(), 0);
assert.equal(getListaDefault(), "");
ok("numeric 0 and an empty lista are kept");

loadRaw({ iva: null, fleteDefault: null, listaDefault: null, extra: 7 });
assert.equal(getConfig().iva, null);
assert.equal(getConfig().extra, 7);
assert.equal(getIVA(), 0.22);
assert.equal(getFleteDefault(), 280);
assert.equal(getListaDefault(), "venta");
ok("null fields fall back on the getters and extra keys stay");

loadRaw({ iva: "0.22", fleteDefault: "280" });
assert.equal(typeof getIVA(), "string");
assert.equal(getIVA(), "0.22");
assert.equal(typeof getFleteDefault(), "string");
assert.equal(getFleteDefault(), "280");
ok("string amounts are not coerced to numbers");

resetConfig();
storage.setItem(KEY, "{");
assert.deepEqual(getConfig(), { iva: 0.22, listaDefault: "venta", fleteDefault: 280 });
ok("corrupt JSON falls back to defaults");

resetConfig();
const returned = setConfig({ iva: 0.1 });
returned.iva = 9;
const copy = getConfig();
copy.iva = 1;
copy.fleteDefault = 1;
assert.equal(getIVA(), 0.1);
assert.equal(getFleteDefault(), 280);
setConfig({ fleteDefault: 0, listaDefault: "" });
assert.deepEqual(getConfig(), { iva: 0.1, listaDefault: "", fleteDefault: 0 });
ok("returned objects are copies and a partial write keeps the other fields");

storage.setItem(KEY, JSON.stringify({ iva: 0.05, listaDefault: "web", fleteDefault: 10 }));
assert.equal(getIVA(), 0.1);
assert.equal(getListaDefault(), "");
resetConfig();
storage.setItem(KEY, JSON.stringify({ iva: 0.05, listaDefault: "web", fleteDefault: 10 }));
assert.equal(getIVA(), 0.05);
assert.equal(getListaDefault(), "web");
assert.equal(getFleteDefault(), 10);
ok("storage written under the cache is ignored until reset");

resetConfig();
storage.throwOn(KEY);
assert.equal(setConfig({ iva: 0.11 }).iva, 0.11);
assert.equal(getIVA(), 0.11);
assert.equal(storage.getItem(KEY), null);
ok("a storage quota failure still keeps the in-memory IVA");

console.log(`calculatorConfigGates: ${passed} passed`);
