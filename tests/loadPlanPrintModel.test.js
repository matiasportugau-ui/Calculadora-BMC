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
import { placeCargo } from "../src/utils/logistica/cargoPacking.js";
import { bedViewExtents } from "../src/utils/bmcLogisticaBedView.js";

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
          xEnd: 6,
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
  // Engine door-side (xStart=0) must mirror to cabin-left view (higher X toward cola)
  assert.equal(model.packages[0].xStart, 2);
  assert.equal(model.packages[0].xEnd, 8);
  assert.equal(model.orientation?.cabin, "left");
  ok("buildLoadPlanPrintModel mirrors bed X");
}

{
  const stops = [
    {
      id: "s1",
      orden: 1,
      cliente: "Entrega1-DOOR",
      orderId: "P1",
      color: "#111111",
      paneles: [{ id: "p", tipo: "ISODEC", espesor: 100, longitud: 5, cantidad: 8 }],
    },
    {
      id: "s2",
      orden: 2,
      cliente: "Entrega2",
      orderId: "P2",
      color: "#222222",
      paneles: [{ id: "p", tipo: "ISODEC", espesor: 100, longitud: 5, cantidad: 8 }],
    },
    {
      id: "s3",
      orden: 3,
      cliente: "Entrega3-CABIN",
      orderId: "P3",
      color: "#333333",
      paneles: [{ id: "p", tipo: "ISODEC", espesor: 100, longitud: 5, cantidad: 8 }],
    },
  ];
  const truckL = 12;
  const cargo = placeCargo(stops, truckL, "balanced");
  const { placedView } = bedViewExtents(cargo.placed, truckL);
  const model = buildLoadPlanPrintModel({ info: {}, stops, cargo, truckL });

  const doorView = placedView.find((p) => p.sCli.includes("DOOR"));
  const cabinView = placedView.find((p) => p.sCli.includes("CABIN"));
  const doorPrint = model.packages.find((p) => p.sCli.includes("DOOR"));
  const cabinPrint = model.packages.find((p) => p.sCli.includes("CABIN"));

  assert.ok(doorView && cabinView && doorPrint && cabinPrint, "packages present");
  assert.ok(doorView.xStart > cabinView.xStart, "SVG/3D: door package farther right than cabin");
  assert.equal(doorPrint.xStart, doorView.xStart);
  assert.equal(cabinPrint.xStart, cabinView.xStart);
  assert.ok(
    doorPrint.xStart > cabinPrint.xStart,
    "print plan must match SVG/3D cabin-left orientation (not engine-raw flip)",
  );
  ok("print X matches bedViewExtents (no left-right flip vs SVG/3D)");
}

console.log(`\n${passed} assertions ok`);
