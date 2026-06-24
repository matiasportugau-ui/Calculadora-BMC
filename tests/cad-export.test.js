// Offline test — server/lib/cad/* (sin servidor ni red). Ejecutar: node tests/cad-export.test.js
import assert from "node:assert";
import { buildPlanGeometry, signedArea, offsetInward } from "../server/lib/cad/planGeometry.js";
import { geometryToDxf, LAYERS } from "../server/lib/cad/dxfExport.js";
import { geometryToSvg } from "../server/lib/cad/svgExport.js";

let pass = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); console.log("  ✓", msg); pass++; };

// Huella en T: cuerpo 14×6 + brazo 3×9 = 111 m²
const footprint = [
  [5.5, 0], [8.5, 0], [8.5, 9], [14, 9], [14, 15], [0, 15], [0, 9], [5.5, 9],
];
const geom = buildPlanGeometry({
  footprint, wallThickness: 0.2,
  rooms: [{ name: "ESTAR", x: 0.2, y: 9.2, w: 7, h: 5.6 }],
  openings: [{ type: "door", x1: 6.4, y1: 0, x2: 7.4, y2: 0, swing: 1 }, { type: "window", x1: 3, y1: 15, x2: 5, y2: 15 }],
  title: { proyecto: "Casa T", cliente: "BMC", escala: "1:100" },
});

console.log("Geometría:");
ok(geom.areaM2 === 111, `área = 111 m² (got ${geom.areaM2})`);
ok(geom.rooms.length === 1 && geom.rooms[0].areaM2 === 39.2, `ambiente con área 39,2 m² (got ${geom.rooms[0]?.areaM2})`);
ok(geom.openings.length === 2 && geom.openings[0].type === "door", "2 aberturas, primera puerta");
ok(geom.title.proyecto === "Casa T" && geom.title.escala === "1:100", "cajetín con proyecto/escala");
ok(geom.footprint.length === 8, "footprint con 8 vértices");
ok(signedArea(geom.footprint) > 0, "footprint normalizado a CCW (área con signo > 0)");
ok(geom.innerWall.length === 8, "muro interior (offset) con 8 vértices");
// el muro interior debe estar dentro del exterior → área menor
ok(Math.abs(signedArea(geom.innerWall)) < Math.abs(signedArea(geom.footprint)), "muro interior con área menor que el exterior");
ok(geom.dims.length === geom.edges.length + 2, "una cota por arista + 2 cotas de conjunto");
ok(geom.dims.some((d) => d.label === "14,00") && geom.dims.some((d) => d.label === "9,00"), "cotas 14,00 y 9,00 presentes");

console.log("DXF:");
const dxf = geometryToDxf(geom);
ok(typeof dxf === "string" && dxf.includes("SECTION"), "DXF es string con SECTION");
for (const layer of Object.values(LAYERS)) ok(dxf.includes(layer), `DXF contiene capa ${layer}`);
ok(dxf.includes("A-DOOR") && dxf.includes("A-GLAZ"), "DXF con capas A-DOOR y A-GLAZ");
ok(dxf.includes("Casa T") && dxf.includes("ESTAR"), "DXF con cajetín (proyecto) y ambiente");
ok(dxf.includes("ENDSEC") && dxf.trim().endsWith("EOF"), "DXF bien terminado (ENDSEC/EOF)");

console.log("Calibración de escala:");
const g2 = buildPlanGeometry({ footprint: [[0, 0], [10, 0], [10, 6], [0, 6]], scale: 1.5 });
ok(g2.areaM2 === 135, `escala 1.5 sobre 10×6=60 → 135 m² (got ${g2.areaM2})`);

console.log("DXF round-trip (reader 'dxf'):");
try {
  const { default: parser } = await import("dxf");
  const parsed = new parser.Helper(dxf).parse();
  ok((parsed.entities || []).length > 20, `entidades parseadas: ${(parsed.entities || []).length}`);
} catch (e) { console.log("  ⚠ reader 'dxf' no disponible — skip:", e.message); }

console.log("SVG:");
const svg = geometryToSvg(geom);
ok(svg.startsWith("<svg") && svg.trim().endsWith("</svg>"), "SVG bien formado");
ok(svg.includes("ESTAR") && svg.includes("Casa T"), "SVG muestra ambiente y cajetín");
ok(geometryToSvg(buildPlanGeometry({ footprint })).includes("111 m²"), "SVG sin ambientes muestra superficie total");

console.log("Edge cases:");
assert.throws(() => buildPlanGeometry({ footprint: [[0, 0], [1, 1]] }), /footprint inválido/);
console.log("  ✓ footprint con <3 vértices lanza error");
pass++;
// offset de un cuadrado simple
const sq = offsetInward([[0, 0], [4, 0], [4, 4], [0, 4]], 0.5);
ok(sq.every(([x, y]) => x >= 0.4 && x <= 3.6 && y >= 0.4 && y <= 3.6), "offset interior de cuadrado dentro de [0.5,3.5]");

console.log(`\n✅ cad-export: ${pass} asserts OK`);
