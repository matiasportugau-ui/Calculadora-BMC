/**
 * Restoring a saved quote into calculator setters.
 * Run: node tests/quoteSnapshotCoercionGates.test.js
 *
 * String dimensions from JSON/Sheets must become numbers. A missing flete
 * must leave the previous freight alone; an explicit 0 must clear it.
 * Comma decimals are not parsed (they become 0) — pin that, do not widen it here.
 */
import assert from "node:assert/strict";
import { applyQuoteSnapshot } from "../src/utils/applyQuoteSnapshot.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("quoteSnapshotCoercionGates");

function harness(seed = {}) {
  const calls = [];
  const state = {
    proyecto: { nombre: "prev", ...(seed.proyecto || {}) },
    techo: { color: "Blanco", pendiente: 99, ...(seed.techo || {}) },
    pared: { alto: 9, ...(seed.pared || {}) },
    camara: { ...(seed.camara || {}) },
  };
  const setters = {
    setScenario: (v) => calls.push(["scenario", v]),
    setLP: (v) => calls.push(["lp", v]),
    setProyecto: (fn) => {
      state.proyecto = fn(state.proyecto);
      calls.push("proyecto");
    },
    setTecho: (fn) => {
      state.techo = fn(state.techo);
      calls.push("techo");
    },
    setPared: (fn) => {
      state.pared = fn(state.pared);
      calls.push("pared");
    },
    setCamara: (fn) => {
      state.camara = fn(state.camara);
      calls.push("camara");
    },
    setFlete: (v) => calls.push(["flete", v]),
  };
  return { calls, state, setters };
}

{
  const payload = {
    scenario: "solo_techo",
    listaPrecios: "venta",
    proyecto: { ciudad: "Canelones" },
    techo: {
      pendiente: "15",
      espesor: 50,
      zonas: [
        { largo: "6.5", ancho: "4" },
        { largo: "x", ancho: null },
      ],
    },
    pared: { espesor: 100, alto: "3.5", perimetro: "12", numEsqExt: "4.9", numEsqInt: 0 },
    camara: { largo_int: "4.2", ancho_int: "", alto_int: "no" },
    flete: "280",
  };
  const snapshot = structuredClone(payload);
  const h = harness();
  applyQuoteSnapshot(payload, h.setters);

  assert.deepEqual(payload, snapshot);
  assert.deepEqual(h.calls.map((c) => (Array.isArray(c) ? c[0] : c)), [
    "scenario", "lp", "proyecto", "techo", "pared", "camara", "flete",
  ]);
  assert.deepEqual(h.calls[0], ["scenario", "solo_techo"]);
  assert.deepEqual(h.calls[1], ["lp", "venta"]);
  assert.equal(h.state.proyecto.nombre, "prev");
  assert.equal(h.state.proyecto.ciudad, "Canelones");
  assert.equal(h.state.techo.color, "Blanco");
  assert.equal(h.state.techo.pendiente, 15);
  assert.equal(h.state.techo.espesor, "50");
  assert.deepEqual(h.state.techo.zonas, [
    { largo: 6.5, ancho: 4 },
    { largo: 0, ancho: 0 },
  ]);
  assert.equal(h.state.pared.alto, 3.5);
  assert.equal(h.state.pared.perimetro, 12);
  assert.equal(h.state.pared.espesor, "100");
  assert.equal(h.state.pared.numEsqExt, 4.9);
  assert.equal(h.state.pared.numEsqInt, 0);
  assert.equal(h.state.camara.largo_int, 4.2);
  assert.equal(h.state.camara.ancho_int, 0);
  assert.equal(h.state.camara.alto_int, 0);
  assert.deepEqual(h.calls.at(-1), ["flete", 280]);
  ok("string snapshot coerces dimensions and does not mutate the payload");
}

{
  const omitted = harness();
  applyQuoteSnapshot({}, omitted.setters);
  assert.deepEqual(omitted.calls, []);

  const blank = harness();
  applyQuoteSnapshot({ scenario: "", listaPrecios: "", techo: null, flete: null }, blank.setters);
  assert.deepEqual(blank.calls, []);

  const zeroFreight = harness();
  applyQuoteSnapshot({ flete: 0 }, zeroFreight.setters);
  assert.deepEqual(zeroFreight.calls, [["flete", 0]]);

  const negative = harness();
  applyQuoteSnapshot({ flete: -5 }, negative.setters);
  assert.deepEqual(negative.calls, [["flete", -5]]);

  const blankFreight = harness();
  applyQuoteSnapshot({ flete: "" }, blankFreight.setters);
  assert.deepEqual(blankFreight.calls, [["flete", 0]]);

  const junkFreight = harness();
  applyQuoteSnapshot({ flete: "abc" }, junkFreight.setters);
  assert.deepEqual(junkFreight.calls, [["flete", 0]]);
  ok("missing flete is a no-op; explicit 0 clears; negative freight is kept");
}

{
  const h = harness();
  applyQuoteSnapshot({
    techo: { pendiente: "", espesor: "40" },
    pared: { alto: "3,5", perimetro: "12m", numEsqExt: "" },
  }, h.setters);
  assert.equal(h.state.techo.pendiente, 0);
  assert.equal(h.state.techo.color, "Blanco");
  assert.equal(h.state.pared.alto, 0);
  assert.equal(h.state.pared.perimetro, 0);
  assert.equal(h.state.pared.numEsqExt, 0);

  const slope = harness();
  applyQuoteSnapshot({ techo: { pendiente: -8 } }, slope.setters);
  assert.equal(slope.state.techo.pendiente, -8);

  const suffix = harness();
  applyQuoteSnapshot({ techo: { pendiente: "15°" } }, suffix.setters);
  assert.equal(suffix.state.techo.pendiente, 0);
  ok("comma decimals and unit suffixes become 0; a negative slope is kept");
}

console.log(`quoteSnapshotCoercionGates: ${passed} passed`);
