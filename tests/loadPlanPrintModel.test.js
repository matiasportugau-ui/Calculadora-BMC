/**
 * Ops UX F6 — load plan print model
 * Run: node tests/loadPlanPrintModel.test.js
 */
import assert from "node:assert/strict";
import {
  packageIdentityLabel,
  packageIdentityLabelFlat,
  buildUnloadSteps,
  buildLoadPlanPrintModel,
} from "../src/utils/logistica/loadPlanPrintModel.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("loadPlanPrintModel");

assert.ok(packageIdentityLabel({ sCli: "Acme SA", sPed: "BMC-1" }).includes("Acme"));
assert.ok(packageIdentityLabelFlat({ sCli: "Acme", sPed: "X" }).includes("#X"));
ok("identity labels");

{
  const steps = buildUnloadSteps({
    stops: [
      { id: "s1", orden: 1, cliente: "A" },
      { id: "s2", orden: 2, cliente: "B" },
    ],
    cargo: {},
  });
  assert.equal(steps[0].cliente, "B");
  assert.equal(steps[1].cliente, "A");
  ok("unload fallback reverse orden");
}

{
  const model = buildLoadPlanPrintModel({
    info: { numero: "ENV-9", fecha: "2026-08-05" },
    truckL: 8,
    stops: [{ id: "s1", orden: 1, cliente: "Acme", orderId: "P1" }],
    cargo: {
      placed: [
        {
          id: "p1",
          sId: "s1",
          sCli: "Acme",
          sPed: "P1",
          sOrd: 1,
          row: 0,
          xStart: 0,
          len: 6,
          h: 0.96,
          sCol: "#0071e3",
        },
      ],
      rowH: [0.96, 0],
    },
  });
  assert.equal(model.header.numero, "ENV-9");
  assert.equal(model.packages.length, 1);
  assert.ok(model.packages[0].label.includes("Acme"));
  assert.ok(model.unloadSteps.length >= 1);
  ok("buildLoadPlanPrintModel");
}

console.log(`\n${passed} assertions ok`);
