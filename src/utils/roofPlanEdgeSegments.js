// ═══════════════════════════════════════════════════════════════════════════
// roofPlanEdgeSegments.js — Segmentación de bordes en planta (Fase 1)
//
// Calcula qué tramos del perímetro de cada rect son **exterior** vs **junta
// interna mismo cuerpo** (mismo `getLateralAnnexRootBodyGi`), para dibujar sin
// línea en contactos internos parciales o totales (alineado a findEncounters).
//
// No altera BOM ni precios; solo geometría pura para RoofPreview y futuros
// encuentros por subtramo.
// ═══════════════════════════════════════════════════════════════════════════

import { ROOF_PLAN_EPS, ROOF_PLAN_MIN_OVERLAP } from "./roofPlanGeometry.js";
import { getLateralAnnexRootBodyGi } from "./roofLateralAnnexLayout.js";

/** @param {[number, number][]} intervals */
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

/**
 * Resta unión de intervalos merged de [lo, hi] → lista de intervalos libres.
 * @param {number} lo
 * @param {number} hi
 * @param {[number, number][]} removeMerged
 * @returns {[number, number][]}
 */
function subtractIntervals1D(lo, hi, removeMerged) {
  let cur = [[lo, hi]];
  for (const [r0, r1] of removeMerged) {
    const next = [];
    for (const [c0, c1] of cur) {
      if (r1 <= c0 + ROOF_PLAN_EPS || r0 >= c1 - ROOF_PLAN_EPS) {
        next.push([c0, c1]);
        continue;
      }
      if (r0 > c0 + ROOF_PLAN_EPS) next.push([c0, Math.min(r0, c1)]);
      if (r1 < c1 - ROOF_PLAN_EPS) next.push([Math.max(r1, c0), c1]);
    }
    cur = next.filter(([u, v]) => v - u > ROOF_PLAN_EPS);
  }
  return cur;
}

function nearlyEq(a, b, eps = ROOF_PLAN_EPS) {
  return Math.abs(a - b) <= eps;
}

function sameBodyRoot(zonas, giA, giB) {
  return getLateralAnnexRootBodyGi(zonas, giA) === getLateralAnnexRootBodyGi(zonas, giB);
}

/**
 * Intervalos [y0,y1] sobre el borde derecho (x = r.x+r.w) cubiertos por vecino
 * mismo cuerpo a la derecha (arista vertical compartida).
 */
function collectInternalYOnRight(r, rects, zonas) {
  const intervals = [];
  const xLine = r.x + r.w;
  for (const e of rects) {
    if (e.gi === r.gi) continue;
    if (!sameBodyRoot(zonas, r.gi, e.gi)) continue;
    if (!nearlyEq(e.x, xLine)) continue;
    const y0 = Math.max(r.y, e.y);
    const y1 = Math.min(r.y + r.h, e.y + e.h);
    if (y1 - y0 >= ROOF_PLAN_MIN_OVERLAP) intervals.push([y0, y1]);
  }
  return mergeIntervals(intervals);
}

function collectInternalYOnLeft(r, rects, zonas) {
  const intervals = [];
  const xLine = r.x;
  for (const e of rects) {
    if (e.gi === r.gi) continue;
    if (!sameBodyRoot(zonas, r.gi, e.gi)) continue;
    if (!nearlyEq(e.x + e.w, xLine)) continue;
    const y0 = Math.max(r.y, e.y);
    const y1 = Math.min(r.y + r.h, e.y + e.h);
    if (y1 - y0 >= ROOF_PLAN_MIN_OVERLAP) intervals.push([y0, y1]);
  }
  return mergeIntervals(intervals);
}

function collectInternalXOnTop(r, rects, zonas) {
  const intervals = [];
  const yLine = r.y;
  for (const e of rects) {
    if (e.gi === r.gi) continue;
    if (!sameBodyRoot(zonas, r.gi, e.gi)) continue;
    if (!nearlyEq(e.y + e.h, yLine)) continue;
    const x0 = Math.max(r.x, e.x);
    const x1 = Math.min(r.x + r.w, e.x + e.w);
    if (x1 - x0 >= ROOF_PLAN_MIN_OVERLAP) intervals.push([x0, x1]);
  }
  return mergeIntervals(intervals);
}

function collectInternalXOnBottom(r, rects, zonas) {
  const intervals = [];
  const yLine = r.y + r.h;
  for (const e of rects) {
    if (e.gi === r.gi) continue;
    if (!sameBodyRoot(zonas, r.gi, e.gi)) continue;
    if (!nearlyEq(e.y, yLine)) continue;
    const x0 = Math.max(r.x, e.x);
    const x1 = Math.min(r.x + r.w, e.x + e.w);
    if (x1 - x0 >= ROOF_PLAN_MIN_OVERLAP) intervals.push([x0, x1]);
  }
  return mergeIntervals(intervals);
}

/**
 * Trazos de perímetro **exterior** por zona (solo tramos que deben verse en planta).
 * Junta interna mismo cuerpo: no se devuelve segmento (sin línea).
 *
 * @param {Array<{ gi: number, x: number, y: number, w: number, h: number, z?: object }>} entries - rects en planta (p. ej. planEdges.rects / layout.entries)
 * @param {object[]} zonas - mismo array que RoofPreview (índices = gi)
 * @returns {Record<number, Array<{ x1: number, y1: number, x2: number, y2: number }>>}
 */
export function buildZoneBorderExteriorLines(entries, zonas) {
  const rects = Array.isArray(entries) ? entries : [];
  const z = Array.isArray(zonas) ? zonas : [];
  /** @type {Record<number, Array<{ x1: number, y1: number, x2: number, y2: number }>>} */
  const out = {};
  for (const r of rects) {
    const lines = [];
    const topExterior = subtractIntervals1D(r.x, r.x + r.w, collectInternalXOnTop(r, rects, z));
    for (const [xa, xb] of topExterior) {
      if (xb - xa > ROOF_PLAN_EPS) lines.push({ x1: xa, y1: r.y, x2: xb, y2: r.y });
    }
    const botExterior = subtractIntervals1D(r.x, r.x + r.w, collectInternalXOnBottom(r, rects, z));
    for (const [xa, xb] of botExterior) {
      if (xb - xa > ROOF_PLAN_EPS) lines.push({ x1: xa, y1: r.y + r.h, x2: xb, y2: r.y + r.h });
    }
    const leftExterior = subtractIntervals1D(r.y, r.y + r.h, collectInternalYOnLeft(r, rects, z));
    for (const [ya, yb] of leftExterior) {
      if (yb - ya > ROOF_PLAN_EPS) lines.push({ x1: r.x, y1: ya, x2: r.x, y2: yb });
    }
    const rightExterior = subtractIntervals1D(r.y, r.y + r.h, collectInternalYOnRight(r, rects, z));
    for (const [ya, yb] of rightExterior) {
      if (yb - ya > ROOF_PLAN_EPS) lines.push({ x1: r.x + r.w, y1: ya, x2: r.x + r.w, y2: yb });
    }
    out[r.gi] = lines;
  }
  return out;
}
