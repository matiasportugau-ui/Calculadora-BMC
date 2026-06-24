// ═══════════════════════════════════════════════════════════════════════════
// server/lib/cad/planGeometry.js
// Modelo canónico de geometría de planta para exportación CAD.
//
// Convención CANÓNICA (ver docs/cad/README.md):
//   - Unidades: METROS.
//   - Ejes: Y-UP (origen abajo-izquierda), convención CAD/DXF.
//   - El DXF usa estas coordenadas directo; el SVG invierte Y (Y-down).
//
// Entrada principal: un polígono de huella (footprint) rectilíneo, lista de
// vértices [x, y] en metros, en cualquier orientación (se normaliza a CCW).
// Salida: { footprint, innerWall, edges, dims, bbox, areaM2, title }.
// ═══════════════════════════════════════════════════════════════════════════

const EPS = 0.002; // tolerancia de igualdad de coordenadas (m) — alineado a roofPlanGeometry

/** Área con fórmula del cordón (shoelace). Signo + = CCW en Y-up. */
export function signedArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/** Garantiza orientación CCW (interior a la izquierda de cada arista dirigida). */
export function ensureCCW(poly) {
  return signedArea(poly) < 0 ? [...poly].reverse() : [...poly];
}

function bboxOf(poly) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** Intersección de dos rectas (punto + dirección). Devuelve null si paralelas. */
function lineIntersect(p, d1, q, d2) {
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((q[0] - p[0]) * d2[1] - (q[1] - p[1]) * d2[0]) / den;
  return [p[0] + t * d1[0], p[1] + t * d1[1]];
}

/**
 * Offset de un polígono simple CCW hacia ADENTRO una distancia `dist`.
 * Desplaza cada arista por su normal interior y corta aristas consecutivas
 * (juntas miter). Robusto para polígonos rectilíneos (incluye vértices reflex).
 */
export function offsetInward(polyCCW, dist) {
  const n = polyCCW.length;
  const movedEdges = [];
  for (let i = 0; i < n; i++) {
    const a = polyCCW[i];
    const b = polyCCW[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const dir = [dx / len, dy / len];
    const inwardNormal = [-dir[1], dir[0]]; // CCW: izquierda = interior
    const off = [a[0] + inwardNormal[0] * dist, a[1] + inwardNormal[1] * dist];
    movedEdges.push({ p: off, dir });
  }
  const inner = [];
  for (let i = 0; i < n; i++) {
    const prev = movedEdges[(i - 1 + n) % n];
    const cur = movedEdges[i];
    const x = lineIntersect(prev.p, prev.dir, cur.p, cur.dir);
    inner.push(x || cur.p);
  }
  return inner;
}

/** Aristas con normal exterior, largo y orientación (H/V). */
function buildEdges(polyCCW) {
  const n = polyCCW.length;
  const edges = [];
  for (let i = 0; i < n; i++) {
    const a = polyCCW[i];
    const b = polyCCW[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < EPS) continue;
    const dir = [dx / len, dy / len];
    const outward = [dir[1], -dir[0]]; // CCW: exterior = derecha
    const orient = Math.abs(dx) > Math.abs(dy) ? "H" : "V";
    edges.push({
      a, b, len: +len.toFixed(3), dir, outward, orient,
      mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    });
  }
  return edges;
}

/**
 * Cotas automáticas: una cota por arista (offset hacia afuera) + cotas de
 * conjunto (ancho/alto del bounding box). Cada cota se representa luego como
 * primitivas (LINE + ticks + TEXT) — NO entidades DIMENSION (ver README).
 */
function buildDims(edges, bbox, gapEdge = 0.55, gapOverall = 1.4) {
  const dims = [];
  for (const e of edges) {
    const off = gapEdge;
    dims.push({
      kind: "edge",
      orient: e.orient,
      x1: e.a[0] + e.outward[0] * off, y1: e.a[1] + e.outward[1] * off,
      x2: e.b[0] + e.outward[0] * off, y2: e.b[1] + e.outward[1] * off,
      tx: e.mid[0] + e.outward[0] * (off + 0.18),
      ty: e.mid[1] + e.outward[1] * (off + 0.18),
      value: e.len,
      label: fmtM(e.len),
    });
  }
  // Conjunto: ancho (abajo) y alto (izquierda)
  dims.push({
    kind: "overall", orient: "H",
    x1: bbox.minX, y1: bbox.minY - gapOverall, x2: bbox.maxX, y2: bbox.minY - gapOverall,
    tx: (bbox.minX + bbox.maxX) / 2, ty: bbox.minY - gapOverall - 0.2,
    value: +(bbox.maxX - bbox.minX).toFixed(3), label: fmtM(bbox.maxX - bbox.minX),
  });
  dims.push({
    kind: "overall", orient: "V",
    x1: bbox.minX - gapOverall, y1: bbox.minY, x2: bbox.minX - gapOverall, y2: bbox.maxY,
    tx: bbox.minX - gapOverall - 0.2, ty: (bbox.minY + bbox.maxY) / 2,
    value: +(bbox.maxY - bbox.minY).toFixed(3), label: fmtM(bbox.maxY - bbox.minY),
  });
  return dims;
}

/** Formato arquitectónico: coma decimal, 2 decimales, sin ceros sobrantes innecesarios. */
export function fmtM(m) {
  const v = Number(m);
  if (!Number.isFinite(v)) return "";
  return v.toFixed(2).replace(".", ",");
}

/**
 * Construye el modelo canónico desde un footprint.
 * @param {object} input
 * @param {number[][]} input.footprint  vértices [x,y] en metros (Y-up)
 * @param {number} [input.wallThickness=0.20]
 * @param {Array}  [input.rooms]     ambientes [{name, x, y, w, h}] (m, Y-up)
 * @param {Array}  [input.openings]  aberturas [{type:'door'|'window', x1,y1,x2,y2, swing?}]
 * @param {object} [input.title]     { titulo, subtitulo, proyecto, cliente, lamina, escala, fecha, dibujo, pie }
 * @param {number} [input.scale=1]   factor de calibración aplicado a footprint/rooms/openings
 */
export function buildPlanGeometry(input = {}) {
  const raw = input.footprint;
  if (!Array.isArray(raw) || raw.length < 3) {
    throw Object.assign(new Error("footprint inválido: se requieren ≥3 vértices [x,y]"), { status: 400 });
  }
  const k = input.scale > 0 ? input.scale : 1;
  const footprint = ensureCCW(raw.map((p) => [Number(p[0]) * k, Number(p[1]) * k]));
  const wallThickness = input.wallThickness > 0 ? input.wallThickness : 0.20;
  const innerWall = offsetInward(footprint, wallThickness);
  const edges = buildEdges(footprint);
  const bbox = bboxOf(footprint);
  const dims = buildDims(edges, bbox);
  const areaM2 = +Math.abs(signedArea(footprint)).toFixed(2);

  // Ambientes (rectángulos con nombre): partición + etiqueta + área.
  const rooms = (Array.isArray(input.rooms) ? input.rooms : [])
    .map((r) => {
      const x = Number(r.x) * k, y = Number(r.y) * k, w = Number(r.w) * k, h = Number(r.h) * k;
      if (!(w > 0) || !(h > 0)) return null;
      return { name: String(r.name || "AMBIENTE"), x, y, w, h, areaM2: +(w * h).toFixed(2), cx: x + w / 2, cy: y + h / 2 };
    })
    .filter(Boolean);

  // Aberturas: segmentos sobre muro con tipo (puerta con barrido / ventana).
  const openings = (Array.isArray(input.openings) ? input.openings : [])
    .map((o) => {
      const x1 = Number(o.x1) * k, y1 = Number(o.y1) * k, x2 = Number(o.x2) * k, y2 = Number(o.y2) * k;
      if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 0.05) return null;
      return {
        type: o.type === "window" ? "window" : "door",
        x1, y1, x2, y2, len: +len.toFixed(3),
        mid: [(x1 + x2) / 2, (y1 + y2) / 2],
        dir: [(x2 - x1) / len, (y2 - y1) / len],
        swing: o.swing === -1 ? -1 : 1,
      };
    })
    .filter(Boolean);

  const t = input.title || {};
  return {
    units: "m",
    convention: "Y-up",
    footprint,
    innerWall,
    wallThickness,
    edges,
    dims,
    bbox,
    areaM2,
    rooms,
    openings,
    title: {
      titulo: t.titulo || "PLANTA ARQUITECTÓNICA",
      subtitulo: t.subtitulo || "Planta de perímetro · Esc. 1:100",
      proyecto: t.proyecto || t.titulo || "—",
      cliente: t.cliente || "—",
      lamina: t.lamina || "Lám. 01",
      escala: t.escala || "1:100",
      fecha: t.fecha || "",
      dibujo: t.dibujo || "BMC · METALOG SAS",
      pie: t.pie || "BMC · METALOG SAS — PROPUESTA (borrador para revisión)",
    },
  };
}
