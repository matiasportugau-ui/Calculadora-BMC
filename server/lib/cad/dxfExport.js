// ═══════════════════════════════════════════════════════════════════════════
// server/lib/cad/dxfExport.js
// Modelo canónico de geometría → string DXF (editable en AutoCAD/QCAD/FreeCAD/LibreCAD).
//
// Decisiones (ver docs/cad/README.md · research log del plan):
//  - Unidades METROS ($INSUNITS=6). Coordenadas Y-up directas (sin flip).
//  - Capas estándar AIA/NCS: A-WALL, A-ANNO-DIMS, A-ANNO-TEXT, A-AREA-IDEN, A-ANNO-TTLB.
//  - COTAS = primitivas explotadas (LINE + ticks + TEXT). NO entidades DIMENSION:
//    AutoCAD no las renderiza sin el anonymous content block, y las primitivas
//    se ven idénticas en todos los CAD.
//  - Salida UTF-8 (R2007+) → acentos español OK. Nombres de capa en ASCII.
// ═══════════════════════════════════════════════════════════════════════════

import { DxfWriter, point3d, Units, Colors } from "@tarikjabiri/dxf";

const LAYERS = {
  WALL: "A-WALL",
  DIMS: "A-ANNO-DIMS",
  TEXT: "A-ANNO-TEXT",
  AREA: "A-AREA-IDEN",
  TITLE: "A-ANNO-TTLB",
};

const TICK = 0.08;      // largo del tick de cota (m)
const DIM_TXT = 0.28;   // altura texto de cota (m)
const LBL_TXT = 0.32;   // altura texto de etiquetas

function addClosedPath(dxf, pts) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    dxf.addLine(point3d(a[0], a[1]), point3d(b[0], b[1]));
  }
}

/** Dibuja una cota explotada: línea + 2 ticks + texto (rotado si es vertical). */
function addDim(dxf, dim) {
  dxf.addLine(point3d(dim.x1, dim.y1), point3d(dim.x2, dim.y2));
  // ticks perpendiculares en cada extremo
  const dx = dim.x2 - dim.x1, dy = dim.y2 - dim.y1;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * TICK, py = (dx / len) * TICK;
  for (const [x, y] of [[dim.x1, dim.y1], [dim.x2, dim.y2]]) {
    dxf.addLine(point3d(x - px, y - py), point3d(x + px, y + py));
  }
  const rotation = dim.orient === "V" ? 90 : 0;
  dxf.addText(point3d(dim.tx, dim.ty), DIM_TXT, dim.label, { rotation });
}

/**
 * @param {object} geom  modelo de buildPlanGeometry()
 * @param {object} [opts]
 * @param {boolean} [opts.doubleWall=true]  dibujar línea interior de muro
 * @returns {string} contenido DXF
 */
export function geometryToDxf(geom, opts = {}) {
  const doubleWall = opts.doubleWall !== false;
  const dxf = new DxfWriter();
  dxf.setUnits(Units.Meters);
  dxf.setVariable("$INSUNITS", { 70: Units.Meters });
  dxf.setVariable("$MEASUREMENT", { 70: 1 }); // sistema métrico

  dxf.addLayer(LAYERS.WALL, Colors.White, "CONTINUOUS");
  dxf.addLayer(LAYERS.DIMS, Colors.Red, "CONTINUOUS");
  dxf.addLayer(LAYERS.TEXT, Colors.Green, "CONTINUOUS");
  dxf.addLayer(LAYERS.AREA, Colors.Cyan, "CONTINUOUS");
  dxf.addLayer(LAYERS.TITLE, Colors.Yellow, "CONTINUOUS");

  // ── Muros ──────────────────────────────────────────────────────────────
  dxf.setCurrentLayerName(LAYERS.WALL);
  addClosedPath(dxf, geom.footprint);
  if (doubleWall && Array.isArray(geom.innerWall)) addClosedPath(dxf, geom.innerWall);

  // ── Cotas (explotadas) ──────────────────────────────────────────────────
  dxf.setCurrentLayerName(LAYERS.DIMS);
  for (const dim of geom.dims) addDim(dxf, dim);

  // ── Superficie ──────────────────────────────────────────────────────────
  dxf.setCurrentLayerName(LAYERS.AREA);
  const cx = (geom.bbox.minX + geom.bbox.maxX) / 2;
  const cy = (geom.bbox.minY + geom.bbox.maxY) / 2;
  dxf.addText(point3d(cx, cy, 0), LBL_TXT, `SUP. ${geom.areaM2} m²`, {
    horizontalAlignment: 1, // Center
  });

  // ── Cajetín / rótulo (texto simple bajo el dibujo) ──────────────────────
  dxf.setCurrentLayerName(LAYERS.TITLE);
  const ty = geom.bbox.minY - 2.6;
  dxf.addText(point3d(geom.bbox.minX, ty, 0), 0.45, geom.title.titulo);
  dxf.addText(point3d(geom.bbox.minX, ty - 0.7, 0), 0.28, geom.title.subtitulo);
  dxf.addText(point3d(geom.bbox.minX, ty - 1.3, 0), 0.22, geom.title.pie);
  dxf.addText(point3d(geom.bbox.maxX, ty, 0), 0.28, geom.title.lamina, {
    horizontalAlignment: 2, // Right
  });

  return dxf.stringify();
}

export { LAYERS };
