// ═══════════════════════════════════════════════════════════════════════════
// Unit tests for polygonFloorPlan.js — polygon → rectilinear zonas decomposition
// used by the free-draw floor plan editor (Techo + Fachada).
// Run: node tests/polygonFloorPlan.test.js
// Offline (pure functions, no server, no network).
// ═══════════════════════════════════════════════════════════════════════════
import {
  polygonArea,
  polygonPerimeter,
  isRectilinear,
  isSimplePolygon,
  snapPointToGrid,
  snapToAxisAligned,
  decomposeRectilinearPolygon,
  polygonToFloorPlan,
} from "../src/utils/polygonFloorPlan.js";

let passed = 0;
let failed = 0;
function assert(name, cond, actual, expected) {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed += 1;
    return;
  }
  console.log(`  ❌ ${name} — got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
  failed += 1;
}

console.log("\n═══ polygonFloorPlan: geometry + rectilinear decomposition ═══");

// ── Rectangle (matches the existing single-zona FloorPlanEditor case) ──────
const rect = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }];
assert("rect: area = 80", polygonArea(rect) === 80, polygonArea(rect), 80);
assert("rect: perimeter = 36", polygonPerimeter(rect) === 36, polygonPerimeter(rect), 36);
assert("rect: isRectilinear", isRectilinear(rect) === true, isRectilinear(rect), true);
assert("rect: isSimplePolygon", isSimplePolygon(rect) === true, isSimplePolygon(rect), true);

const rectPlan = polygonToFloorPlan(rect);
assert("rect: 1 zona", rectPlan.zonas.length === 1, rectPlan.zonas.length, 1);
assert(
  "rect: zona = {largo:8, ancho:10}",
  rectPlan.zonas[0].largo === 8 && rectPlan.zonas[0].ancho === 10,
  rectPlan.zonas[0],
  { largo: 8, ancho: 10 },
);
assert("rect: perimetro = 36", rectPlan.perimetro === 36, rectPlan.perimetro, 36);
assert("rect: area = 80", rectPlan.area === 80, rectPlan.area, 80);
assert("rect: valid", rectPlan.valid === true, rectPlan.valid, true);

// ── L-shape (rectilinear hexagon, 2 reflex-free rectangles) ────────────────
const lShape = [
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 },
  { x: 6, y: 5 }, { x: 6, y: 8 }, { x: 0, y: 8 },
];
assert("L: area = 68", polygonArea(lShape) === 68, polygonArea(lShape), 68);
assert("L: perimeter = 36", polygonPerimeter(lShape) === 36, polygonPerimeter(lShape), 36);

const lPlan = polygonToFloorPlan(lShape);
assert("L: decomposes into 2 zonas", lPlan.zonas.length === 2, lPlan.zonas.length, 2);
const lAreaFromZonas = lPlan.zonas.reduce((s, z) => s + z.largo * z.ancho, 0);
assert("L: zonas area sum = polygon area", lAreaFromZonas === 68, lAreaFromZonas, 68);
assert(
  "L: zonas match expected rects",
  JSON.stringify(lPlan.zonas.sort((a, b) => a.ancho - b.ancho)) ===
    JSON.stringify([{ largo: 3, ancho: 6 }, { largo: 5, ancho: 10 }]),
  lPlan.zonas,
  [{ largo: 3, ancho: 6 }, { largo: 5, ancho: 10 }],
);

// ── Non-rectilinear (diagonal edge) is rejected, not silently patched ──────
const diagonal = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 8 }];
assert("diagonal triangle: isRectilinear = false", isRectilinear(diagonal) === false, isRectilinear(diagonal), false);
assert("diagonal triangle: decomposition empty", decomposeRectilinearPolygon(diagonal).length === 0, decomposeRectilinearPolygon(diagonal).length, 0);

// ── Self-intersecting (bowtie) rectilinear polygon is rejected ─────────────
const bowtie = [
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 4, y: 10 },
  { x: 4, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 6 }, { x: 0, y: 6 },
  { x: 0, y: 3 }, { x: 8, y: 3 }, { x: 8, y: 8 }, { x: 0, y: 8 },
];
// (constructed to overlap itself across the y=3..8 band on purpose)
assert("bowtie: isSimplePolygon = false", isSimplePolygon(bowtie) === false, isSimplePolygon(bowtie), false);
assert("bowtie: polygonToFloorPlan invalid", polygonToFloorPlan(bowtie).valid === false, polygonToFloorPlan(bowtie).valid, false);

// ── Grid snapping ───────────────────────────────────────────────────────────
assert(
  "snapPointToGrid: rounds to nearest 1.12m (panel ancho útil)",
  JSON.stringify(snapPointToGrid({ x: 5.4, y: 2.7 }, 1.12)) === JSON.stringify({ x: 5.6, y: 2.24 }),
  snapPointToGrid({ x: 5.4, y: 2.7 }, 1.12),
  { x: 5.6, y: 2.24 },
);

assert(
  "snapToAxisAligned: larger |dx| forces horizontal edge",
  JSON.stringify(snapToAxisAligned({ x: 0, y: 0 }, { x: 5.1, y: 0.4 }, 1)) === JSON.stringify({ x: 5, y: 0 }),
  snapToAxisAligned({ x: 0, y: 0 }, { x: 5.1, y: 0.4 }, 1),
  { x: 5, y: 0 },
);
assert(
  "snapToAxisAligned: larger |dy| forces vertical edge",
  JSON.stringify(snapToAxisAligned({ x: 0, y: 0 }, { x: 0.4, y: 5.1 }, 1)) === JSON.stringify({ x: 0, y: 5 }),
  snapToAxisAligned({ x: 0, y: 0 }, { x: 0.4, y: 5.1 }, 1),
  { x: 0, y: 5 },
);

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
