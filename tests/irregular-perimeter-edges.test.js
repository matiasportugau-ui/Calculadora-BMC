import assert from "node:assert/strict";
import {
  buildIrregularPerimeterEdges,
  classifyCutRole,
  remainingToPlantIntervals,
} from "../src/utils/irregularPerimeterEdges.js";

let passed = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  passed += 1;
  console.log(`  ✓ ${msg}`);
}

console.log("irregular-perimeter-edges.test.js");

ok(classifyCutRole({ x: 0, y: 4 }, { x: 5, y: 12.75 }) === "frente", "diagonal span → frente");
ok(classifyCutRole({ x: 2, y: 0 }, { x: 2, y: 12 }) === "lateral", "vertical run → lateral");
ok(classifyCutRole({ x: 0, y: 6 }, { x: 10, y: 6 }) === "frente", "horizontal cap → frente");

{
  const p = buildIrregularPerimeterEdges({ ancho: 10.08, largo: 12.75 });
  ok(p.cutEdges.length === 0, "rectangle has no cut edges");
  ok(Math.abs(p.remaining.frente.ml - 10.08) < 1e-3, "rectangle frente ml");
  ok(Math.abs(p.remaining.latIzq.ml - 12.75) < 1e-3, "rectangle latIzq ml");
}

{
  const p = buildIrregularPerimeterEdges({
    ancho: 10.08,
    largo: 12.75,
    cut: { p0: { x: 0, y: 4 }, p1: { x: 5, y: 12.75 } },
  });
  ok(p.cutEdges.length === 1, "one new cut edge");
  ok(p.cutEdges[0].id === "cut_0", "cut id cut_0");
  ok(p.cutEdges[0].role === "frente", "diagonal cut role frente");
  ok(p.cutEdges[0].lengthM > 8, `cut length > 8 (got ${p.cutEdges[0].lengthM})`);
  ok(p.remaining.latIzq.ml < 12.75 - 0.5, `latIzq shortened (got ${p.remaining.latIzq.ml})`);
  ok(Math.abs(p.remaining.latDer.ml - 12.75) < 0.05, "latDer intact");
  ok(p.remaining.frente.ml < 10.08 && p.remaining.frente.ml > 4, `frente remaining (got ${p.remaining.frente.ml})`);
}

{
  const p = buildIrregularPerimeterEdges({
    ancho: 4,
    largo: 6,
    cut: { p0: { x: 0, y: 3 }, p1: { x: 2, y: 6 } },
  });
  const iv = remainingToPlantIntervals(p.remaining, { x: 10, y: 20 });
  ok(iv.left.length > 0, "plant left intervals");
  ok(iv.left[0][0] >= 20, "plant y offset applied");
}

console.log(`irregular-perimeter-edges: ${passed} passed`);
