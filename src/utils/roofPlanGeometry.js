// ═══════════════════════════════════════════════════════════════════════════
// roofPlanGeometry.js — Planta techo multizona: layout coherente con RoofPreview
// y aristas exteriores / encuentros entre zonas (sin acoplarse al BOM).
// ═══════════════════════════════════════════════════════════════════════════

/** Misma separación que RoofPreview.jsx entre zonas en layout automático. */
export const ROOF_PLAN_GAP_M = 0.25;

/** Tolerancia posición (m) para considerar que dos aristas coinciden. */
export const ROOF_PLAN_EPS = 0.002;

/** Solape mínimo (m) para contar un encuentro. */
export const ROOF_PLAN_MIN_OVERLAP = 0.02;

/**
 * Ancho en planta por zona (dos aguas = mitad de ancho por faldón en UI).
 * @param {{ ancho: number }} z
 * @param {boolean} is2A
 */
export function effAnchoPlanta(z, is2A) {
  return is2A ? z.ancho / 2 : z.ancho;
}

/**
 * @param {Array<{ largo: number, ancho: number, preview?: { x?: number, y?: number } }>} zonas
 * @param {"una_agua"|"dos_aguas"} [tipoAguas]
 * @returns {Array<{ gi: number, z: object, x: number, y: number, w: number, h: number }>}
 */
export function layoutZonasEnPlanta(zonas, tipoAguas = "una_agua", gapM = ROOF_PLAN_GAP_M) {
  const is2A = tipoAguas === "dos_aguas";
  const raw = zonas.map((z, gi) => ({ z, gi })).filter(({ z }) => z?.largo > 0 && z?.ancho > 0);
  let ax = 0;
  const autoPos = {};
  for (const { z, gi } of raw) {
    const w = effAnchoPlanta(z, is2A);
    autoPos[gi] = { x: ax, y: 0 };
    ax += w + gapM;
  }
  return raw.map(({ z, gi }) => {
    const w = effAnchoPlanta(z, is2A);
    const h = z.largo;
    const p = z.preview;
    const pos =
      p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : autoPos[gi];
    return { gi, z, x: pos.x, y: pos.y, w, h };
  });
}

function nearlyEq(a, b, eps = ROOF_PLAN_EPS) {
  return Math.abs(a - b) <= eps;
}

/** @param {[number, number][]} intervals sorted, non-overlapping after merge */
function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  const s = [...intervals].sort((a, b) => a[0] - b[0]);
  const out = [s[0]];
  for (let i = 1; i < s.length; i++) {
    const cur = s[i];
    const last = out[out.length - 1];
    if (cur[0] <= last[1] + ROOF_PLAN_EPS) last[1] = Math.max(last[1], cur[1]);
    else out.push([cur[0], cur[1]]);
  }
  return out;
}

/** Resta unión de `remove` (merged) de [a,b] → lista de intervalos */
function subtractFromInterval(a, b, remove) {
  let cur = [[a, b]];
  for (const [r0, r1] of remove) {
    const next = [];
    for (const [c0, c1] of cur) {
      if (r1 <= c0 + ROOF_PLAN_EPS || r0 >= c1 - ROOF_PLAN_EPS) {
        next.push([c0, c1]);
        continue;
      }
      if (r0 > c0 + ROOF_PLAN_EPS) next.push([c0, Math.min(r0, c1)]);
      if (r1 < c1 - ROOF_PLAN_EPS) next.push([Math.max(r1, c0), c1]);
    }
    cur = next.filter(([u, v]) => v - u > ROOF_PLAN_MIN_OVERLAP);
  }
  return cur;
}

/**
 * Encuentros: segmentos compartidos entre pares de rectángulos (eje alineado).
 * @param {ReturnType<typeof layoutZonasEnPlanta>} rects
 */
export function findEncounters(rects) {
  const enc = [];
  let eid = 0;
  const n = rects.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const A = rects[i];
      const B = rects[j];
      const ax1 = A.x;
      const ay1 = A.y;
      const ax2 = A.x + A.w;
      const ay2 = A.y + A.h;
      const bx1 = B.x;
      const by1 = B.y;
      const bx2 = B.x + B.w;
      const by2 = B.y + B.h;

      // A.right touches B.left
      if (nearlyEq(ax2, bx1)) {
        const y0 = Math.max(ay1, by1);
        const y1 = Math.min(ay2, by2);
        if (y1 - y0 >= ROOF_PLAN_MIN_OVERLAP) {
          enc.push({
            id: `enc-${eid++}`,
            zoneIndices: [A.gi, B.gi],
            orientation: "vertical",
            x1: ax2,
            y1: y0,
            x2: ax2,
            y2: y1,
            length: +(y1 - y0).toFixed(4),
          });
        }
      }
      // A.left touches B.right
      if (nearlyEq(ax1, bx2)) {
        const y0 = Math.max(ay1, by1);
        const y1 = Math.min(ay2, by2);
        if (y1 - y0 >= ROOF_PLAN_MIN_OVERLAP) {
          enc.push({
            id: `enc-${eid++}`,
            zoneIndices: [A.gi, B.gi],
            orientation: "vertical",
            x1: ax1,
            y1: y0,
            x2: ax1,
            y2: y1,
            length: +(y1 - y0).toFixed(4),
          });
        }
      }
      // A.bottom touches B.top
      if (nearlyEq(ay2, by1)) {
        const x0 = Math.max(ax1, bx1);
        const x1 = Math.min(ax2, bx2);
        if (x1 - x0 >= ROOF_PLAN_MIN_OVERLAP) {
          enc.push({
            id: `enc-${eid++}`,
            zoneIndices: [A.gi, B.gi],
            orientation: "horizontal",
            x1: x0,
            y1: ay2,
            x2: x1,
            y2: ay2,
            length: +(x1 - x0).toFixed(4),
          });
        }
      }
      // A.top touches B.bottom
      if (nearlyEq(ay1, by2)) {
        const x0 = Math.max(ax1, bx1);
        const x1 = Math.min(ax2, bx2);
        if (x1 - x0 >= ROOF_PLAN_MIN_OVERLAP) {
          enc.push({
            id: `enc-${eid++}`,
            zoneIndices: [A.gi, B.gi],
            orientation: "horizontal",
            x1: x0,
            y1: ay1,
            x2: x1,
            y2: ay1,
            length: +(x1 - x0).toFixed(4),
          });
        }
      }
    }
  }
  return enc;
}

/**
 * Intervalos de encuentro que cubren un borde de rect (1D).
 * @param {"top"|"bottom"|"left"|"right"} side
 */
function encounterIntervalsOnSide(r, side, encounters) {
  const rx1 = r.x;
  const ry1 = r.y;
  const rx2 = r.x + r.w;
  const ry2 = r.y + r.h;
  const iv = [];
  for (const e of encounters) {
    if (!e.zoneIndices.includes(r.gi)) continue;
    if (side === "top" && e.orientation === "horizontal" && nearlyEq(e.y1, ry1)) {
      const xa = Math.min(e.x1, e.x2);
      const xb = Math.max(e.x1, e.x2);
      if (xb > rx1 + ROOF_PLAN_EPS && xa < rx2 - ROOF_PLAN_EPS) {
        iv.push([Math.max(xa, rx1), Math.min(xb, rx2)]);
      }
    } else if (side === "bottom" && e.orientation === "horizontal" && nearlyEq(e.y1, ry2)) {
      const xa = Math.min(e.x1, e.x2);
      const xb = Math.max(e.x1, e.x2);
      if (xb > rx1 + ROOF_PLAN_EPS && xa < rx2 - ROOF_PLAN_EPS) {
        iv.push([Math.max(xa, rx1), Math.min(xb, rx2)]);
      }
    } else if (side === "left" && e.orientation === "vertical" && nearlyEq(e.x1, rx1)) {
      const ya = Math.min(e.y1, e.y2);
      const yb = Math.max(e.y1, e.y2);
      if (yb > ry1 + ROOF_PLAN_EPS && ya < ry2 - ROOF_PLAN_EPS) {
        iv.push([Math.max(ya, ry1), Math.min(yb, ry2)]);
      }
    } else if (side === "right" && e.orientation === "vertical" && nearlyEq(e.x1, rx2)) {
      const ya = Math.min(e.y1, e.y2);
      const yb = Math.max(e.y1, e.y2);
      if (yb > ry1 + ROOF_PLAN_EPS && ya < ry2 - ROOF_PLAN_EPS) {
        iv.push([Math.max(ya, ry1), Math.min(yb, ry2)]);
      }
    }
  }
  return mergeIntervals(iv);
}

/**
 * Aristas exteriores como segmentos (después de restar encuentros en ese borde).
 */
function buildExteriorSegments(rects, encounters) {
  const exterior = [];
  let xid = 0;
  for (const r of rects) {
    const rx1 = r.x;
    const ry1 = r.y;
    const rx2 = r.x + r.w;
    const ry2 = r.y + r.h;

    const topIv = mergeIntervals(encounterIntervalsOnSide(r, "top", encounters));
    const topFree = subtractFromInterval(rx1, rx2, topIv);
    for (const [xa, xb] of topFree) {
      const len = xb - xa;
      if (len >= ROOF_PLAN_MIN_OVERLAP) {
        exterior.push({
          id: `ext-${xid++}`,
          zoneIndex: r.gi,
          side: "top",
          x1: xa,
          y1: ry1,
          x2: xb,
          y2: ry1,
          length: +len.toFixed(4),
        });
      }
    }

    const botIv = mergeIntervals(encounterIntervalsOnSide(r, "bottom", encounters));
    const botFree = subtractFromInterval(rx1, rx2, botIv);
    for (const [xa, xb] of botFree) {
      const len = xb - xa;
      if (len >= ROOF_PLAN_MIN_OVERLAP) {
        exterior.push({
          id: `ext-${xid++}`,
          zoneIndex: r.gi,
          side: "bottom",
          x1: xa,
          y1: ry2,
          x2: xb,
          y2: ry2,
          length: +len.toFixed(4),
        });
      }
    }

    const leftIv = mergeIntervals(encounterIntervalsOnSide(r, "left", encounters));
    const leftFree = subtractFromInterval(ry1, ry2, leftIv);
    for (const [ya, yb] of leftFree) {
      const len = yb - ya;
      if (len >= ROOF_PLAN_MIN_OVERLAP) {
        exterior.push({
          id: `ext-${xid++}`,
          zoneIndex: r.gi,
          side: "left",
          x1: rx1,
          y1: ya,
          x2: rx1,
          y2: yb,
          length: +len.toFixed(4),
        });
      }
    }

    const rightIv = mergeIntervals(encounterIntervalsOnSide(r, "right", encounters));
    const rightFree = subtractFromInterval(ry1, ry2, rightIv);
    for (const [ya, yb] of rightFree) {
      const len = yb - ya;
      if (len >= ROOF_PLAN_MIN_OVERLAP) {
        exterior.push({
          id: `ext-${xid++}`,
          zoneIndex: r.gi,
          side: "right",
          x1: rx2,
          y1: ya,
          x2: rx2,
          y2: yb,
          length: +len.toFixed(4),
        });
      }
    }
  }
  return exterior;
}

/**
 * @param {Array<{ largo: number, ancho: number, preview?: { x?: number, y?: number } }>} zonas
 * @param {"una_agua"|"dos_aguas"} [tipoAguas]
 * @returns {{
 *   rects: ReturnType<typeof layoutZonasEnPlanta>,
 *   encounters: object[],
 *   exterior: object[],
 *   totals: { exteriorLength: number, encounterLength: number, perimeterIndependent: number }
 * }}
 */
export function buildRoofPlanEdges(zonas, tipoAguas = "una_agua") {
  const rects = layoutZonasEnPlanta(zonas, tipoAguas);
  const encounters = findEncounters(rects);
  const exterior = buildExteriorSegments(rects, encounters);

  const exteriorLength = exterior.reduce((s, e) => s + e.length, 0);
  const encounterLength = encounters.reduce((s, e) => s + e.length, 0);
  const perimeterIndependent = rects.reduce((s, r) => s + 2 * (r.w + r.h), 0);

  return {
    rects,
    encounters,
    exterior,
    meta: {
      tipoAguas,
      gapM: ROOF_PLAN_GAP_M,
      eps: ROOF_PLAN_EPS,
    },
    totals: {
      exteriorLength: +exteriorLength.toFixed(4),
      encounterLength: +encounterLength.toFixed(4),
      perimeterIndependent: +perimeterIndependent.toFixed(4),
    },
  };
}

/**
 * Layout for BOM encounter detection: zones placed adjacent (no visual gap).
 * Use this for BOM calculations, not for visual display.
 */
export function layoutZonasLogico(zonas, tipoAguas = "una_agua") {
  return layoutZonasEnPlanta(zonas, tipoAguas, 0);
}

/**
 * For each zona (by gi), returns the set of sides shared with another zone.
 * Those sides should have their border suppressed in the BOM (no profile item for internal joints).
 * @param {Array<{ largo: number, ancho: number, preview?: object }>} zonas
 * @param {"una_agua"|"dos_aguas"} [tipoAguas]
 * @returns {Map<number, Map<"frente"|"fondo"|"latIzq"|"latDer", {intervals: Array<{startM:number,endM:number}>, fullySide: boolean}>>}
 */
export function getSharedSidesPerZona(zonas, tipoAguas = "una_agua") {
  const rects = layoutZonasLogico(zonas, tipoAguas);
  const encounters = findEncounters(rects);
  const result = new Map();

  const addSharedInterval = (gi, side, sideLen, startM, endM) => {
    if (!result.has(gi)) result.set(gi, new Map());
    const sideMap = result.get(gi);
    if (!sideMap.has(side)) sideMap.set(side, { intervals: [], fullySide: false });
    const entry = sideMap.get(side);
    const s0 = +Math.max(0, startM).toFixed(4);
    const s1 = +Math.min(sideLen, endM).toFixed(4);
    entry.intervals.push({ startM: s0, endM: s1 });
    if (s0 <= ROOF_PLAN_EPS && s1 >= sideLen - ROOF_PLAN_EPS) entry.fullySide = true;
  };

  for (const enc of encounters) {
    for (const gi of enc.zoneIndices) {
      const rect = rects.find(r => r.gi === gi);
      if (!rect) continue;
      if (enc.orientation === "vertical") {
        // latIzq / latDer — shared segment runs along the h (largo) axis
        if (Math.abs(enc.x1 - rect.x) <= ROOF_PLAN_EPS)
          addSharedInterval(gi, "latIzq", rect.h, enc.y1 - rect.y, enc.y2 - rect.y);
        if (Math.abs(enc.x1 - (rect.x + rect.w)) <= ROOF_PLAN_EPS)
          addSharedInterval(gi, "latDer", rect.h, enc.y1 - rect.y, enc.y2 - rect.y);
      } else {
        // frente / fondo — shared segment runs along the w (ancho) axis
        if (Math.abs(enc.y1 - rect.y) <= ROOF_PLAN_EPS)
          addSharedInterval(gi, "fondo", rect.w, enc.x1 - rect.x, enc.x2 - rect.x);
        if (Math.abs(enc.y1 - (rect.y + rect.h)) <= ROOF_PLAN_EPS)
          addSharedInterval(gi, "frente", rect.w, enc.x1 - rect.x, enc.x2 - rect.x);
      }
    }
  }
  return result;
}
