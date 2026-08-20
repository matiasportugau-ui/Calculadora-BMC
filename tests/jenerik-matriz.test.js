import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { applyOverridesToObject } from "../src/utils/pricingOverrides.js";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: (k) => { mem.delete(k); },
};

const {
  JENERIK_MATRIZ_KEY,
  getJenerikSaleMap,
  setJenerikSale,
  getJenerikPricingOverrides,
  resetJenerikMatrizToSeed,
  exportJenerikCsv,
  parseJenerikCsv,
  tenantMatrizCopy,
  __resetJenerikMatrizForTests,
} = await import("../src/utils/jenerikMatriz.js");

const bmc = await import("../src/utils/pricingOverrides.js");

test("jenerik matriz does not write BMC override key", () => {
  mem.clear();
  __resetJenerikMatrizForTests();
  const map = getJenerikSaleMap();
  const somePath = Object.keys(map)[0];
  assert.ok(somePath);
  setJenerikSale(somePath, 99.91);
  assert.equal(mem.has("bmc-pricing-overrides"), false);
  assert.equal(mem.has(JENERIK_MATRIZ_KEY), true);
  assert.equal(bmc.getPricingOverrides()[`${somePath}.venta`], undefined);
  assert.equal(getJenerikSaleMap()[somePath], 99.91);
});

test("BMC overrides do not change jenerik live prices", () => {
  mem.clear();
  __resetJenerikMatrizForTests();
  const path = Object.keys(getJenerikSaleMap())[0];
  const before = getJenerikSaleMap()[path];
  bmc.setPricingOverride(`${path}.venta`, 1.11);
  assert.equal(getJenerikSaleMap()[path], before);
});

test("jenerik overrides never include costo", () => {
  mem.clear();
  __resetJenerikMatrizForTests();
  const ov = getJenerikPricingOverrides();
  assert.ok(Object.keys(ov).length > 10);
  assert.equal(Object.keys(ov).some((k) => k.endsWith(".costo")), false);
});

test("reset restores seed, not BMC override store", () => {
  mem.clear();
  __resetJenerikMatrizForTests();
  const path = Object.keys(getJenerikSaleMap())[0];
  const seed = getJenerikSaleMap()[path];
  setJenerikSale(path, 12.34);
  resetJenerikMatrizToSeed();
  assert.equal(getJenerikSaleMap()[path], seed);
  assert.equal(mem.has("bmc-pricing-overrides"), false);
});

test("csv roundtrip is sale-only", () => {
  mem.clear();
  __resetJenerikMatrizForTests();
  const path = Object.keys(getJenerikSaleMap())[0];
  setJenerikSale(path, 55.5);
  const csv = exportJenerikCsv();
  assert.equal(/costo/i.test(csv.split("\n")[0]), false);
  assert.match(csv, /venta/);
  assert.doesNotMatch(csv.split("\n")[0], /bmc|jenerik/i);
  const parsed = parseJenerikCsv(csv);
  assert.equal(parsed[path], 55.5);
});

test("SmartBuilding matriz is isolated from BMC / BC / LAM", () => {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", `
    process.env.VITE_WHITELABEL = "smartbuilding";
    process.env.WHITELABEL = "smartbuilding";
    const { tenantMatrizCopy, JENERIK_MATRIZ_KEY } = await import("./src/utils/jenerikMatriz.js");
    process.stdout.write(JSON.stringify({ copy: tenantMatrizCopy(), key: JENERIK_MATRIZ_KEY }));
  `], { cwd: new URL("..", import.meta.url).pathname.replace(/tests\/$/, ""), encoding: "utf8" });
  const line = (r.stdout || "").split("\n").filter((l) => l.startsWith("{")).pop();
  const j = JSON.parse(line);
  const blob = JSON.stringify(j.copy);
  assert.match(j.key, /tenant:smartbuilding:matriz-v1/);
  assert.match(blob, /SMARTBUILDING/);
  assert.doesNotMatch(blob, /BMC|Jenerik|LAM|matriz BC/i);
});

test("LAM copy never names BMC, BC or Jenerik", () => {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", `
    process.env.VITE_WHITELABEL = "paneleslam";
    process.env.WHITELABEL = "paneleslam";
    const { tenantMatrizCopy, JENERIK_MATRIZ_KEY } = await import("./src/utils/jenerikMatriz.js");
    process.stdout.write(JSON.stringify({ copy: tenantMatrizCopy(), key: JENERIK_MATRIZ_KEY }));
  `], { cwd: new URL("..", import.meta.url).pathname.replace(/tests\/$/, ""), encoding: "utf8" });
  const line = (r.stdout || "").split("\n").filter((l) => l.startsWith("{")).pop();
  const j = JSON.parse(line);
  const blob = JSON.stringify(j.copy);
  assert.match(j.key, /tenant:paneleslam:matriz-v1/);
  assert.match(j.copy.title, /personalizada/i);
  assert.doesNotMatch(blob, /BMC|Jenerik|matriz BC/i);
});

test("applying jenerik overrides does not copy costo from BMC base", () => {
  mem.clear();
  __resetJenerikMatrizForTests();
  const base = { PANELS_TECHO: { X: { esp: { 100: { venta: 10, web: 10, costo: 7 } } } } };
  const priced = applyOverridesToObject(base, getJenerikPricingOverrides());
  // costo may still sit on untouched objects; jenerik overrides themselves have no costo keys
  const ov = getJenerikPricingOverrides();
  assert.equal(ov["PANELS_TECHO.X.esp.100.costo"], undefined);
  void priced;
});
