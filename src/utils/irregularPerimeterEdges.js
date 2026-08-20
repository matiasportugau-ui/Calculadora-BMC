import {
  EPS,
  resolveRoofPolygon,
  normalizeRing,
} from "./irregularRoofLayout.js";

const SIDES = ["frente", "fondo", "latIzq", "latDer"];

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function emptyPerimeter() {
  const remaining = {};
  for (const side of SIDES) remaining[side] = { segments: [], ml: 0 };
  return { remaining, cutEdges: [], polygon: [] };
}

/**
 * Classify a polygon edge that lies on the original rectangle.
 * Local coords: x = ancho (0..w), y = largo (0..h). frente = y=h, fondo = y=0.
 */
export function classifyRectSide(a, b, w, h, eps = EPS) {
  const onLeft = a.x <= eps && b.x <= eps;
  const onRight = a.x >= w - eps && b.x >= w - eps;
  const onTop = a.y <= eps && b.y <= eps;
  const onBottom = a.y >= h - eps && b.y >= h - eps;
  if (onLeft) return "latIzq";
  if (onRight) return "latDer";
  if (onTop) return "fondo";
  if (onBottom) return "frente";
  return null;
}

/**
 * Cut that spans across the panel width exposes panel fronts → frente.
 * Cut almost parallel to the run (little across-span) → lateral.
 */
export function classifyCutRole(a, b, panelRun = "along_largo") {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  const across = panelRun === "along_ancho" ? dy : dx;
  const along = panelRun === "along_ancho" ? dx : dy;
  return across >= along * 0.2 || across > 0.25 ? "frente" : "lateral";
}

/**
 * After an irregular half-plane cut, remaining original sides + new cut edges.
 *
 * @param {{ ancho: number, largo: number, cut?: { p0, p1, keep? }, panelRun?: string }} input
 */
export function buildIrregularPerimeterEdges(input = {}) {
  const w = +input.ancho;
  const h = +input.largo;
  const panelRun = input.panelRun || "along_largo";
  if (!(w > 0) || !(h > 0)) return emptyPerimeter();

  const hasCut = Boolean(input.cut?.p0 && input.cut?.p1);
  const { poly } = resolveRoofPolygon({
    mode: hasCut ? "diagonal_halfplane" : "rectangle",
    ancho: w,
    largo: h,
    cut: input.cut,
  });
  const ring = normalizeRing(poly);
  return edgesFromPolygon(ring, w, h, panelRun);
}

/** Classify a kept roof ring (local 0..w × 0..h) into remaining sides + new cut edges. */
export function edgesFromPolygon(poly, w, h, panelRun = "along_largo") {
  const ring = normalizeRing(poly);
  if (ring.length < 3 || !(w > 0) || !(h > 0)) return emptyPerimeter();

  const buckets = { frente: [], fondo: [], latIzq: [], latDer: [] };
  const cutEdges = [];

  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const lengthM = dist(a, b);
    if (lengthM < EPS) continue;
    const side = classifyRectSide(a, b, w, h);
    const seg = {
      p0: { x: +a.x.toFixed(6), y: +a.y.toFixed(6) },
      p1: { x: +b.x.toFixed(6), y: +b.y.toFixed(6) },
      lengthM: +lengthM.toFixed(4),
    };
    if (side) {
      buckets[side].push(seg);
    } else {
      cutEdges.push({
        id: `cut_${cutEdges.length}`,
        role: classifyCutRole(a, b, panelRun),
        ...seg,
      });
    }
  }

  const remaining = {};
  for (const side of SIDES) {
    const segments = buckets[side];
    remaining[side] = {
      segments,
      ml: +segments.reduce((s, e) => s + e.lengthM, 0).toFixed(4),
    };
  }

  return { remaining, cutEdges, polygon: ring };
}

/** Plant-space intervals for PlantaBordesEdgeStrips (left/right = y, top/bottom = x). */
export function remainingToPlantIntervals(remaining, origin = { x: 0, y: 0 }) {
  const ox = +origin.x || 0;
  const oy = +origin.y || 0;
  const iv = { left: [], right: [], top: [], bottom: [] };
  const pushY = (list, segs) => {
    for (const s of segs || []) {
      const a = Math.min(s.p0.y, s.p1.y) + oy;
      const b = Math.max(s.p0.y, s.p1.y) + oy;
      if (b - a > EPS) list.push([a, b]);
    }
  };
  const pushX = (list, segs) => {
    for (const s of segs || []) {
      const a = Math.min(s.p0.x, s.p1.x) + ox;
      const b = Math.max(s.p0.x, s.p1.x) + ox;
      if (b - a > EPS) list.push([a, b]);
    }
  };
  pushY(iv.left, remaining?.latIzq?.segments);
  pushY(iv.right, remaining?.latDer?.segments);
  pushX(iv.top, remaining?.fondo?.segments);
  pushX(iv.bottom, remaining?.frente?.segments);
  return iv;
}

export function intersectIntervalMaps(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = {};
  for (const k of keys) {
    const A = a[k] || [];
    const B = b[k] || [];
    if (!A.length || !B.length) {
      out[k] = [];
      continue;
    }
    const hits = [];
    for (const [a0, a1] of A) {
      for (const [b0, b1] of B) {
        const lo = Math.max(a0, b0);
        const hi = Math.min(a1, b1);
        if (hi - lo > EPS) hits.push([lo, hi]);
      }
    }
    out[k] = hits;
  }
  return out;
}

export function catalogSideForCutRole(role) {
  return role === "lateral" ? "latIzq" : "frente";
}
