// ═══════════════════════════════════════════════════════════════════════════
// server/lib/cad/dxfExport.js
// Modelo canónico de geometría → string DXF (editable en AutoCAD/QCAD/FreeCAD/LibreCAD).
//
// Decisiones (ver docs/cad/README.md · research log del plan):
//  - Unidades METROS ($INSUNITS=6). Coordenadas Y-up directas (sin flip).
//  - Capas estándar AIA/NCS: A-WALL, A-DOOR, A-GLAZ, A-ANNO-DIMS, A-ANNO-TEXT,
//    A-AREA-IDEN, A-ANNO-TTLB, A-GRID.
//  - COTAS = primitivas explotadas (LINE + ticks + TEXT). NO entidades DIMENSION:
//    AutoCAD no las renderiza sin el anonymous content block.
//  - Puertas: hoja + arco de barrido (A-DOOR). Ventanas: doble línea (A-GLAZ).
//  - Cajetín ISO formal con campos (A-ANNO-TTLB).
//  - Salida UTF-8 (R2007+) → acentos español OK. Nombres de capa en ASCII.
// ═══════════════════════════════════════════════════════════════════════════

import { DxfWriter, point3d, Units, Colors } from "@tarikjabiri/dxf";

const LAYERS = {
  WALL: "A-WALL",
  DOOR: "A-DOOR",
  GLAZ: "A-GLAZ",
  DIMS: "A-ANNO-DIMS",
  TEXT: "A-ANNO-TEXT",
  AREA: "A-AREA-IDEN",
  TITLE: "A-ANNO-TTLB",
  GRID: "A-GRID",
};

const TICK = 0.08;      // largo del tick de cota (m)
const DIM_TXT = 0.28;   // altura texto de cota (m)
const LBL_TXT = 0.32;   // altura texto de etiquetas
const ROOM_TXT = 0.26;

function addClosedPath(dxf, pts) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    dxf.addLine(point3d(a[0], a[1]), point3d(b[0], b[1]));
  }
}

function addDim(dxf, dim) {
  dxf.addLine(point3d(dim.x1, dim.y1), point3d(dim.x2, dim.y2));
  const dx = dim.x2 - dim.x1, dy = dim.y2 - dim.y1;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * TICK, py = (dx / len) * TICK;
  for (const [x, y] of [[dim.x1, dim.y1], [dim.x2, dim.y2]]) {
    dxf.addLine(point3d(x - px, y - py), point3d(x + px, y + py));
  }
  dxf.addText(point3d(dim.tx, dim.ty), DIM_TXT, dim.label, { rotation: dim.orient === "V" ? 90 : 0 });
}

function addRoom(dxf, room) {
  dxf.setCurrentLayerName(LAYERS.WALL);
  dxf.addLWPolyline(
    [[room.x, room.y], [room.x + room.w, room.y], [room.x + room.w, room.y + room.h], [room.x, room.y + room.h]]
      .map(([x, y]) => ({ point: point3d(x, y) })),
    { flags: 1 },
  );
  dxf.setCurrentLayerName(LAYERS.TEXT);
  dxf.addText(point3d(room.cx, room.cy + 0.1, 0), ROOM_TXT, room.name, { horizontalAlignment: 1 });
  dxf.setCurrentLayerName(LAYERS.AREA);
  dxf.addText(point3d(room.cx, room.cy - 0.3, 0), ROOM_TXT * 0.8, `${room.areaM2} m²`, { horizontalAlignment: 1 });
}

function addOpening(dxf, op) {
  if (op.type === "window") {
    dxf.setCurrentLayerName(LAYERS.GLAZ);
    const px = -op.dir[1] * 0.04, py = op.dir[0] * 0.04;
    dxf.addLine(point3d(op.x1 + px, op.y1 + py), point3d(op.x2 + px, op.y2 + py));
    dxf.addLine(point3d(op.x1 - px, op.y1 - py), point3d(op.x2 - px, op.y2 - py));
    return;
  }
  // Puerta: hoja (perpendicular) + arco de barrido a 90°
  dxf.setCurrentLayerName(LAYERS.DOOR);
  const perp = [-op.dir[1] * op.swing, op.dir[0] * op.swing];
  const openTip = [op.x1 + perp[0] * op.len, op.y1 + perp[1] * op.len];
  dxf.addLine(point3d(op.x1, op.y1), point3d(openTip[0], openTip[1]));
  const aClosed = Math.atan2(op.dir[1], op.dir[0]) * 180 / Math.PI;
  const [start, end] = op.swing === 1 ? [aClosed, aClosed + 90] : [aClosed - 90, aClosed];
  dxf.addArc(point3d(op.x1, op.y1), op.len, start, end);
}

function addTitleBlockISO(dxf, geom) {
  dxf.setCurrentLayerName(LAYERS.TITLE);
  const x0 = geom.bbox.minX, x1 = geom.bbox.maxX;
  const w = x1 - x0;
  const top = geom.bbox.minY - 1.6;      // por debajo del dibujo
  const h = 2.4;
  const bot = top - h;
  // marco
  dxf.addLWPolyline([[x0, bot], [x1, bot], [x1, top], [x0, top]].map(([x, y]) => ({ point: point3d(x, y) })), { flags: 1 });
  // divisores
  const rowY = top - h / 2;
  dxf.addLine(point3d(x0, rowY), point3d(x1, rowY));
  const cx = x0 + w * 0.62;
  dxf.addLine(point3d(cx, top), point3d(cx, bot));
  const T = geom.title;
  const field = (x, y, k, v, big = false) => {
    dxf.addText(point3d(x + 0.12, y - 0.32, 0), 0.16, k);
    dxf.addText(point3d(x + 0.12, y - 0.78, 0), big ? 0.34 : 0.26, v || "—");
  };
  field(x0, top, "PROYECTO", T.proyecto, true);
  field(x0, rowY, "CLIENTE", T.cliente);
  field(cx, top, "LÁMINA", T.lamina, true);
  field(cx, rowY, "ESCALA / FECHA", `${T.escala}${T.fecha ? "  ·  " + T.fecha : ""}`);
  dxf.addText(point3d(x1 - 0.12, bot + 0.12, 0), 0.14, T.dibujo, { horizontalAlignment: 2 });
}

/**
 * @param {object} geom  modelo de buildPlanGeometry()
 * @param {object} [opts]
 * @param {boolean} [opts.doubleWall=true]
 * @returns {string} contenido DXF
 */
export function geometryToDxf(geom, opts = {}) {
  const doubleWall = opts.doubleWall !== false;
  const dxf = new DxfWriter();
  dxf.setUnits(Units.Meters);
  dxf.setVariable("$INSUNITS", { 70: Units.Meters });
  dxf.setVariable("$MEASUREMENT", { 70: 1 });

  dxf.addLayer(LAYERS.WALL, Colors.White, "CONTINUOUS");
  dxf.addLayer(LAYERS.DOOR, Colors.Yellow, "CONTINUOUS");
  dxf.addLayer(LAYERS.GLAZ, Colors.Cyan, "CONTINUOUS");
  dxf.addLayer(LAYERS.DIMS, Colors.Red, "CONTINUOUS");
  dxf.addLayer(LAYERS.TEXT, Colors.Green, "CONTINUOUS");
  dxf.addLayer(LAYERS.AREA, Colors.Cyan, "CONTINUOUS");
  dxf.addLayer(LAYERS.TITLE, Colors.Yellow, "CONTINUOUS");
  dxf.addLayer(LAYERS.GRID, Colors.Gray, "CONTINUOUS");

  // Muros
  dxf.setCurrentLayerName(LAYERS.WALL);
  addClosedPath(dxf, geom.footprint);
  if (doubleWall && Array.isArray(geom.innerWall)) addClosedPath(dxf, geom.innerWall);

  // Ambientes
  for (const room of geom.rooms || []) addRoom(dxf, room);
  // Aberturas
  for (const op of geom.openings || []) addOpening(dxf, op);

  // Cotas
  dxf.setCurrentLayerName(LAYERS.DIMS);
  for (const dim of geom.dims) addDim(dxf, dim);

  // Superficie total
  dxf.setCurrentLayerName(LAYERS.AREA);
  const cx = (geom.bbox.minX + geom.bbox.maxX) / 2;
  const cy = (geom.bbox.minY + geom.bbox.maxY) / 2;
  dxf.addText(point3d(cx, cy, 0), LBL_TXT, `SUP. ${geom.areaM2} m²`, { horizontalAlignment: 1 });

  // Cajetín ISO
  addTitleBlockISO(dxf, geom);

  return dxf.stringify();
}

export { LAYERS };
