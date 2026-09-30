/**
 * Quote restore coercion. Run: node tests/applyQuoteSnapshotGates.test.js
 *
 * Pins applyQuoteSnapshot: freight 0 is applied, a missing freight is not,
 * comma decimals become 0, and explicit null keys still overwrite previous state.
 */
import assert from "node:assert/strict";
import { applyQuoteSnapshot } from "../src/utils/applyQuoteSnapshot.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function harness(seed = {}) {
  const calls = [];
  const state = {
    scenario: "old",
    lp: "web",
    proyecto: { ciudad: "Salto", cliente: "Old" },
    techo: { familia: "KEEP", color: "Rojo", pendiente: 12, zonas: [{ largo: 1, ancho: 1 }] },
    pared: { alto: 9, numEsqExt: 4, numEsqInt: 2, color: "Gris" },
    camara: { alto_int: 9, largo_int: 4 },
    flete: 440,
    ...seed,
  };
  const setters = {
    setScenario: (v) => { calls.push("scenario"); state.scenario = v; },
    setLP: (v) => { calls.push("lp"); state.lp = v; },
    setProyecto: (fn) => { calls.push("proyecto"); state.proyecto = fn(state.proyecto); },
    setTecho: (fn) => { calls.push("techo"); state.techo = fn(state.techo); },
    setPared: (fn) => { calls.push("pared"); state.pared = fn(state.pared); },
    setCamara: (fn) => { calls.push("camara"); state.camara = fn(state.camara); },
    setFlete: (v) => { calls.push("flete"); state.flete = v; },
  };
  return { calls, state, setters };
}

console.log("applyQuoteSnapshot gates");

{
  const h = harness();
  applyQuoteSnapshot({}, h.setters);
  assert.deepEqual(h.calls, []);
  assert.equal(h.state.flete, 440);
  assert.equal(h.state.techo.pendiente, 12);
  ok("empty payload does not touch setters or freight");
}

{
  const h = harness();
  assert.throws(() => applyQuoteSnapshot(null, h.setters), TypeError);
  assert.throws(() => applyQuoteSnapshot(undefined, h.setters), TypeError);
  assert.deepEqual(h.calls, []);
  ok("null payload throws and does not apply");
}

{
  const h = harness();
  applyQuoteSnapshot({ flete: 0 }, h.setters);
  assert.deepEqual(h.calls, ["flete"]);
  assert.equal(h.state.flete, 0);
  ok("flete 0 is applied");
}

{
  for (const flete of [null, undefined]) {
    const h = harness();
    applyQuoteSnapshot({ flete }, h.setters);
    assert.deepEqual(h.calls, []);
    assert.equal(h.state.flete, 440);
  }
  ok("missing flete is not zeroed");
}

{
  const h = harness();
  applyQuoteSnapshot({ flete: "" }, h.setters);
  assert.equal(h.state.flete, 0);
  const comma = harness();
  applyQuoteSnapshot({ flete: "12,5" }, comma.setters);
  assert.equal(comma.state.flete, 0);
  const spaced = harness();
  applyQuoteSnapshot({ flete: " 12 " }, spaced.setters);
  assert.equal(spaced.state.flete, 12);
  const half = harness();
  applyQuoteSnapshot({ flete: "0.5" }, half.setters);
  assert.equal(half.state.flete, 0.5);
  const flagged = harness();
  applyQuoteSnapshot({ flete: false }, flagged.setters);
  assert.equal(flagged.state.flete, 0);
  ok("freight strings: comma is 0, spaced number parses, 0.5 stays");
}

{
  const h = harness();
  applyQuoteSnapshot({ scenario: "", listaPrecios: "", proyecto: null }, h.setters);
  assert.deepEqual(h.calls, []);
  assert.equal(h.state.scenario, "old");
  assert.equal(h.state.lp, "web");
  ok("blank scenario, blank list, and null proyecto are skipped");
}

{
  const zonas = [{ largo: "6", ancho: "x" }];
  const payload = {
    scenario: "solo_techo",
    listaPrecios: "venta",
    proyecto: { cliente: "Ana" },
    techo: { familia: "ISODEC_EPS", espesor: 50, pendiente: "8.5", zonas },
    pared: { alto: "3,5", espesor: 80, numEsqExt: 0, numEsqInt: "0" },
    camara: { alto_int: "2.5", largo_int: 0 },
    flete: "440",
  };
  const h = harness();
  applyQuoteSnapshot(payload, h.setters);
  assert.deepEqual(h.calls, ["scenario", "lp", "proyecto", "techo", "pared", "camara", "flete"]);
  assert.equal(h.state.scenario, "solo_techo");
  assert.equal(h.state.lp, "venta");
  assert.deepEqual(h.state.proyecto, { ciudad: "Salto", cliente: "Ana" });
  assert.equal(h.state.techo.color, "Rojo");
  assert.equal(h.state.techo.familia, "ISODEC_EPS");
  assert.equal(h.state.techo.espesor, "50");
  assert.equal(h.state.techo.pendiente, 8.5);
  assert.deepEqual(h.state.techo.zonas, [{ largo: 6, ancho: 0 }]);
  assert.equal(zonas[0].largo, "6");
  assert.equal(payload.techo.pendiente, "8.5");
  assert.equal(h.state.pared.color, "Gris");
  assert.equal(h.state.pared.alto, 0);
  assert.equal(h.state.pared.espesor, "80");
  assert.equal(h.state.pared.numEsqExt, 0);
  assert.equal(h.state.pared.numEsqInt, 0);
  assert.equal(h.state.camara.alto_int, 2.5);
  assert.equal(h.state.camara.largo_int, 0);
  assert.equal(h.state.flete, 440);
  ok("full snapshot coerces numbers, keeps sibling fields, does not mutate input");
}

{
  const h = harness();
  applyQuoteSnapshot({ techo: { pendiente: null, zonas: "nope" } }, h.setters);
  assert.equal(h.state.techo.pendiente, null);
  assert.equal(h.state.techo.zonas, "nope");
  assert.equal(h.state.techo.familia, "KEEP");
  ok("explicit null pendiente and a non-array zonas overwrite previous techo");
}

{
  const h = harness();
  applyQuoteSnapshot({
    techo: { pendiente: "" },
    pared: { numEsqExt: -1, alto: 0 },
    camara: { ancho_int: "" },
  }, h.setters);
  assert.equal(h.state.techo.pendiente, 0);
  assert.equal(h.state.pared.numEsqExt, -1);
  assert.equal(h.state.pared.alto, 0);
  assert.equal(h.state.pared.numEsqInt, 2);
  assert.equal(h.state.camara.ancho_int, 0);
  assert.equal(h.state.camara.largo_int, 4);
  ok("empty pendiente is 0, negative corners stay, omitted pared fields stay");
}

console.log(`applyQuoteSnapshot gates: ${passed} passed`);
