/**
 * Dimensioning override gates — au / spacing / formula text that change panel counts.
 * Run: node tests/dimensioningOverrideGates.test.js
 *
 * Pins current behavior. Do not "fix" these in a coverage PR:
 * - corrupt JSON becomes {}
 * - numeric NaN and blank delete (unlike pricing overrides, which store NaN)
 * - numbers round to 4 decimals
 * - reset clears numeric and formula caches even if removeItem throws
 */
import assert from "node:assert/strict";

const KEY = "bmc-dimensioning-overrides";
const FORMULA_KEY = "bmc-dimensioning-formula-overrides";

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

installMemoryStorage({ [KEY]: "{" });

const {
  getDimensioningOverrides,
  setDimensioningOverride,
  setDimensioningOverridesBulk,
  getDimensioningFormulaOverrides,
  setDimensioningFormulaOverride,
  setDimensioningFormulaOverridesBulk,
  resetDimensioningOverrides,
} = await import("../src/utils/dimensioningFormulasOverrides.js");

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("dimensioningOverrideGates");

{
  assert.deepEqual(getDimensioningOverrides(), {});
  assert.deepEqual(getDimensioningFormulaOverrides(), {});
  ok("corrupt numeric JSON is an empty override map and does not throw");
}

{
  assert.equal(setDimensioningOverride("PANELS_TECHO.ISODEC_EPS.au", 1.23456)["PANELS_TECHO.ISODEC_EPS.au"], 1.2346);
  assert.equal(setDimensioningOverride("FIJACIONES_VARILLA.espaciado_perimetro", 0)["FIJACIONES_VARILLA.espaciado_perimetro"], 0);
  assert.equal(setDimensioningOverride("NOTE", "1.25")["NOTE"], "1.25");
  const dropped = setDimensioningOverride("PANELS_TECHO.ISODEC_EPS.au", NaN);
  assert.equal(Object.prototype.hasOwnProperty.call(dropped, "PANELS_TECHO.ISODEC_EPS.au"), false);
  assert.equal(setDimensioningOverride("FIJACIONES_VARILLA.espaciado_perimetro", "")["FIJACIONES_VARILLA.espaciado_perimetro"], undefined);
  assert.equal(getDimensioningOverrides().NOTE, "1.25");
  ok("4-decimal numbers; 0 kept; NaN and blank delete; strings stay strings");
}

{
  const bulk = setDimensioningOverridesBulk({
    "A.au": 1.2,
    "B.au": NaN,
    "C.au": "",
    "D.au": "keep",
  });
  assert.equal(bulk["A.au"], 1.2);
  assert.equal(Object.prototype.hasOwnProperty.call(bulk, "B.au"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(bulk, "C.au"), false);
  assert.equal(bulk["D.au"], "keep");
  assert.equal(bulk.NOTE, "1.25");
  ok("bulk drops NaN and blank keys and keeps a sibling string");
}

{
  const formula = setDimensioningFormulaOverride("cantP", "  ceil(ancho / au)  ");
  assert.equal(formula.cantP, "ceil(ancho / au)");
  assert.equal(getDimensioningOverrides().NOTE, "1.25");
  const cleared = setDimensioningFormulaOverride("cantP", "   ");
  assert.equal(Object.prototype.hasOwnProperty.call(cleared, "cantP"), false);
  const both = setDimensioningFormulaOverridesBulk({
    apoyos: " ceil(largo / ap) + 1 ",
    drop: "",
    also: null,
  });
  assert.equal(both.apoyos, "ceil(largo / ap) + 1");
  assert.equal(Object.prototype.hasOwnProperty.call(both, "drop"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(both, "also"), false);
  assert.equal(getDimensioningOverrides()["A.au"], 1.2);
  ok("formula text is trimmed on its own key; numeric overrides stay put");
}

{
  localStorage.setItem = () => {
    throw new Error("quota");
  };
  assert.equal(setDimensioningOverride("QUOTA.au", 2.5)["QUOTA.au"], 2.5);
  assert.equal(getDimensioningOverrides()["QUOTA.au"], 2.5);
  assert.equal(setDimensioningFormulaOverride("QUOTA.f", "ancho")["QUOTA.f"], "ancho");
  ok("storage write failure still keeps numeric and formula overrides in memory");
}

{
  localStorage.removeItem = () => {
    throw new Error("locked");
  };
  assert.deepEqual(resetDimensioningOverrides(), {});
  assert.deepEqual(getDimensioningOverrides(), {});
  assert.deepEqual(getDimensioningFormulaOverrides(), {});
  ok("reset clears both caches even when removeItem throws");
}

console.log(`\ndimensioningOverrideGates: ${passed} passed`);
