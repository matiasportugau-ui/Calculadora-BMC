// Demo + verificación local de la cadena croquis→CAD.
// Genera DXF + SVG (+ PNG si @resvg está instalado) para la huella en T de Dolores,
// y re-parsea el DXF (round-trip) para validar capas y entidades.
import { writeFileSync } from "node:fs";
import { buildPlanGeometry } from "../server/lib/cad/planGeometry.js";
import { geometryToDxf } from "../server/lib/cad/dxfExport.js";
import { geometryToSvg } from "../server/lib/cad/svgExport.js";

// Huella en T (Y-up, metros): cuerpo 14×6 arriba + brazo 3×9 que baja, centrado.
const footprint = [
  [5.5, 0], [8.5, 0], [8.5, 9], [14, 9], [14, 15], [0, 15], [0, 9], [5.5, 9],
];

const geom = buildPlanGeometry({
  footprint,
  wallThickness: 0.2,
  rooms: [
    { name: "COCINA · COMEDOR · LIVING", x: 0.2, y: 9.2, w: 7.3, h: 5.6 },
    { name: "DORMITORIO", x: 7.5, y: 9.2, w: 6.3, h: 5.6 },
    { name: "ACCESO · ESCALERA", x: 5.7, y: 0.2, w: 2.6, h: 8.6 },
  ],
  openings: [
    { type: "door", x1: 6.4, y1: 0, x2: 7.4, y2: 0, swing: 1 },
    { type: "window", x1: 3, y1: 15, x2: 5, y2: 15 },
    { type: "window", x1: 14, y1: 11, x2: 14, y2: 13 },
  ],
  title: {
    titulo: "VIVIENDA UNIFAMILIAR — RECONSTRUCCIÓN",
    proyecto: "Vivienda unifamiliar — Reconstrucción",
    cliente: "Dolores, Uruguay",
    escala: "1:100",
    fecha: "2026-06-24",
    dibujo: "BMC · METALOG SAS",
    lamina: "Lám. 01",
  },
});

const OUT = "docs/cad/demo-plano";
const dxf = geometryToDxf(geom);
const svg = geometryToSvg(geom);
writeFileSync(`${OUT}.dxf`, dxf);
writeFileSync(`${OUT}.svg`, svg);
console.log(`Área: ${geom.areaM2} m² (esperado 111)`);
console.log(`DXF: ${dxf.length} bytes · SVG: ${svg.length} bytes`);

// PNG opcional (si @resvg/resvg-js está disponible)
try {
  const { Resvg } = await import("@resvg/resvg-js");
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 2200 }, font: { loadSystemFonts: true } }).render().asPng();
  writeFileSync(`${OUT}.png`, png);
  console.log(`PNG: ${png.length} bytes`);
} catch { console.log("PNG: (omitido — @resvg/resvg-js no instalado)"); }

// Round-trip: re-parsear el DXF
try {
  const { default: parser } = await import("dxf");
  const parsed = parser.parseString ? parser.parseString(dxf) : new parser.Helper(dxf).parse();
  const layers = Object.keys(parsed.tables?.layers || parsed.tables?.layer || {});
  console.log("Round-trip capas:", layers.join(", ") || "(reader sin tabla de capas)");
  console.log("Round-trip entidades:", (parsed.entities || []).length);
} catch (e) { console.log("Round-trip: reader 'dxf' no disponible —", e.message); }

console.log("OK → docs/cad/demo-plano.{dxf,svg,png}");
