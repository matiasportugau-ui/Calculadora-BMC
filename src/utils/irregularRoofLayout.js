// ═══════════════════════════════════════════════════════════════════════════
// irregularRoofLayout.js — Stepped panel lengths for irregular roof plans
// Factory: square ends only. Site diagonal = calculation only (corte en obra).
// ═══════════════════════════════════════════════════════════════════════════

import { buildAnchoStripsPlanta } from "./roofPanelStripsPlanta.js";

export const SCHEMA = "bmc-irregular-layout-v1";
export const CORTE_EN_OBRA_NOTE =
  "Cortes oblicuos en obra — no fabricados por BMC. Paneles con extremos rectos (largos escalonados).";
export const EPS = 1e-9;
export const DEFAULT_ORDER_LENGTH_STEP_M = 0.01;

/** Default shared irregular session (left factory + right final_plane). */
export const EMPTY_IRREGULAR_SESSION = Object.freeze({
  enabled: false,
  tool: "select",
  cut: null,
  cutDraft: null,
  selectedStripId: null,
  layoutOverride: null,
});

/**
 * Merge a partial irregular-session patch onto previous state.
 * Must be used with a functional React setState updater so sequential
 * patches in one event (cut draft → cut complete → tool) do not clobber
 * each other when dual RoofPreview mounts share one session.
 *
 * @param {object|null|undefined} prev
 * @param {object} patch
 * @returns {typeof EMPTY_IRREGULAR_SESSION}
 */
export function mergeIrregularSessionPatch(prev, patch = {}) {
  const base = prev && typeof prev === "object" ? prev : EMPTY_IRREGULAR_SESSION;
  return {
    enabled: Boolean(base.enabled),
    tool: base.tool || "select",
    cut: base.cut ?? null,
    cutDraft: base.cutDraft ?? null,
    selectedStripId: base.selectedStripId ?? null,
    layoutOverride: base.layoutOverride ?? null,
    ...patch,
  };
}

export function stepCeil(v, step) {
  if (!(step > 0)) return v;
  if (!(v > 0)) return 0;
  const n = Math.ceil(v / step - EPS);
  const decimals = Math.min(10, Math.max(0, Math.round(-Math.log10(step)) + 1));
  return +((n * step).toFixed(decimals));
}

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** >0 left of directed p0→p1 */
export function sideCross(p0, p1, q) {
  return (p1.x - p0.x) * (q.y - p0.y) - (p1.y - p0.y) * (q.x - p0.x);
}

export function polygonArea(ring) {
  if (!ring || ring.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    a += ring[i].x * ring[j].y - ring[j].x * ring[i].y;
  }
  return Math.abs(a) / 2;
}

export function ringBoundsY(ring) {
  if (!ring?.length) return { minY: 0, maxY: 0 };
  let minY = ring[0].y;
  let maxY = ring[0].y;
  for (const p of ring) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minY, maxY };
}

export function normalizeRing(pts) {
  if (!pts?.length) return [];
  const out = pts.map((p) => ({ x: +p.x, y: +p.y }));
  if (out.length >= 2) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS) out.pop();
  }
  return out;
}

export function rectRing(x0, y0, x1, y1) {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

export function clipHalfPlane(subject, p0, p1, keep = "left") {
  const ring = normalizeRing(subject);
  if (ring.length < 3) return [];

  const inside = (q) => {
    const c = sideCross(p0, p1, q);
    return keep === "left" ? c >= -EPS : c <= EPS;
  };

  const intersect = (a, b) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lx = p1.x - p0.x;
    const ly = p1.y - p0.y;
    const den = dx * ly - dy * lx;
    if (Math.abs(den) < EPS) return { x: a.x, y: a.y };
    const t = ((p0.x - a.x) * ly - (p0.y - a.y) * lx) / den;
    return { x: a.x + t * dx, y: a.y + t * dy };
  };

  const output = [];
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i];
    const prev = ring[(i + ring.length - 1) % ring.length];
    const curIn = inside(cur);
    const prevIn = inside(prev);
    if (curIn) {
      if (!prevIn) output.push(intersect(prev, cur));
      output.push(cur);
    } else if (prevIn) {
      output.push(intersect(prev, cur));
    }
  }
  return output;
}

export function clipAabb(subject, box) {
  const { x0, y0, x1, y1 } = box;
  let poly = normalizeRing(subject);
  poly = clipHalfPlane(poly, { x: x0, y: y0 }, { x: x1, y: y0 }, "left");
  poly = clipHalfPlane(poly, { x: x1, y: y0 }, { x: x1, y: y1 }, "left");
  poly = clipHalfPlane(poly, { x: x1, y: y1 }, { x: x0, y: y1 }, "left");
  poly = clipHalfPlane(poly, { x: x0, y: y1 }, { x: x0, y: y0 }, "left");
  return poly;
}

export function resolveRoofPolygon(input) {
  const warnings = [];
  const mode = input.mode || "rectangle";
  const ancho = +input.ancho;
  const largo = +input.largo;

  if (!(ancho > 0) || !(largo > 0)) {
    return { poly: [], warnings: ["IRR_EMPTY_POLYGON"] };
  }

  let poly = rectRing(0, 0, ancho, largo);

  if (mode === "rectangle") return { poly, warnings };

  if (mode === "diagonal_halfplane") {
    const cut = input.cut;
    if (!cut?.p0 || !cut?.p1) return { poly: [], warnings: ["IRR_EMPTY_POLYGON"] };
    const keep = cut.keep === "right" ? "right" : "left";
    poly = clipHalfPlane(poly, cut.p0, cut.p1, keep);
    if (polygonArea(poly) < EPS) return { poly: [], warnings: ["IRR_EMPTY_POLYGON"] };
    return { poly, warnings };
  }

  if (mode === "polygon") {
    poly = normalizeRing(input.polygon || []);
    if (polygonArea(poly) < EPS) return { poly: [], warnings: ["IRR_EMPTY_POLYGON"] };
    if (input.clipToBounds !== false) {
      poly = clipAabb(poly, { x0: 0, y0: 0, x1: ancho, y1: largo });
    }
    if (polygonArea(poly) < EPS) return { poly: [], warnings: ["IRR_EMPTY_POLYGON"] };
    return { poly, warnings };
  }

  return { poly: [], warnings: ["IRR_EMPTY_POLYGON"] };
}

export function buildIrregularSchedule(input) {
  const zoneId = input.zoneId || "z1";
  const ancho = +input.ancho;
  const largo = +input.largo;
  const au = +input.au;
  const lmin = input.lmin != null ? +input.lmin : 0;
  const lmax = input.lmax != null ? +input.lmax : Infinity;
  const orderLengthStepM =
    input.orderLengthStepM != null ? +input.orderLengthStepM : DEFAULT_ORDER_LENGTH_STEP_M;
  const mode = input.mode || "rectangle";
  const notes = [CORTE_EN_OBRA_NOTE];
  const warnings = [];

  if (input.panelRun === "along_ancho") {
    warnings.push("IRR_PANEL_RUN_ALONG_ANCHO_UNSUPPORTED");
  }

  const { poly: roofPoly, warnings: resolveWarn } = resolveRoofPolygon(input);
  warnings.push(...resolveWarn);

  if (!roofPoly.length || polygonArea(roofPoly) < EPS) {
    return emptyLayout({ zoneId, mode, au, orderLengthStepM, lmin, lmax, warnings, notes, polygon: [] });
  }

  const stripDefs = buildAnchoStripsPlanta(ancho, au);
  const strips = [];
  let areaOrdered = 0;
  let areaUsable = 0;
  let areaWasteSite = 0;

  for (const s of stripDefs) {
    const box = { x0: s.x0, y0: 0, x1: s.x0 + s.width, y1: largo };
    const inter = clipAabb(roofPoly, box);
    const aUse = polygonArea(inter);
    if (aUse < EPS) continue;

    const { minY, maxY } = ringBoundsY(inter);
    let L_cover = maxY - minY;
    if (L_cover < EPS) L_cover = 0;
    const y0Cover = minY;

    let L_order = stepCeil(L_cover, orderLengthStepM);
    const codes = [];

    if (L_cover > lmax + EPS) {
      codes.push("IRR_LENGTH_EXCEEDS_LMAX");
      warnings.push("IRR_LENGTH_EXCEEDS_LMAX");
    }
    if (L_cover > EPS && L_cover < lmin - EPS) {
      codes.push("IRR_BELOW_LMIN");
      warnings.push("IRR_BELOW_LMIN");
    }

    L_order = clamp(L_order, lmin > 0 ? lmin : 0, Number.isFinite(lmax) ? lmax : L_order);

    const aOrd = L_order * s.width;
    const waste = Math.max(0, aOrd - aUse);
    const id = `T-${String(s.idx + 1).padStart(2, "0")}`;

    strips.push({
      id,
      idx: s.idx,
      x0: +s.x0.toFixed(10),
      width: +s.width.toFixed(10),
      y0Cover: +y0Cover.toFixed(6),
      L_cover: +L_cover.toFixed(6),
      L_order: +L_order.toFixed(6),
      source: "auto",
      areaOrdered: +aOrd.toFixed(6),
      areaUsable: +aUse.toFixed(6),
      wasteM2_site: +waste.toFixed(6),
      codes,
    });

    areaOrdered += aOrd;
    areaUsable += aUse;
    areaWasteSite += waste;
  }

  if (!strips.length) warnings.push("IRR_NO_STRIPS");
  const wastePct = areaOrdered > EPS ? (areaWasteSite / areaOrdered) * 100 : 0;

  return {
    schema: SCHEMA,
    zoneId,
    polygon: roofPoly,
    cutMode: mode,
    panelRun: "along_largo",
    au,
    orderLengthStepM,
    lmin,
    lmax: Number.isFinite(lmax) ? lmax : null,
    strips,
    totals: {
      areaOrdered: +areaOrdered.toFixed(6),
      areaUsable: +areaUsable.toFixed(6),
      areaWasteSite: +areaWasteSite.toFixed(6),
      areaWasteWidth: 0,
      wastePct: +wastePct.toFixed(4),
    },
    notes,
    warnings: [...new Set(warnings)],
  };
}

export function applyManualOrderLength(layout, stripId, L_order) {
  const strips = layout.strips.map((s) => {
    if (s.id !== stripId) return { ...s };
    const L = Math.max(0, +L_order);
    const aOrd = L * s.width;
    const waste = Math.max(0, aOrd - s.areaUsable);
    return {
      ...s,
      L_order: +L.toFixed(6),
      source: "manual",
      areaOrdered: +aOrd.toFixed(6),
      wasteM2_site: +waste.toFixed(6),
    };
  });
  return recomputeTotals({ ...layout, strips });
}

export function resetStripToAuto(layout, stripId) {
  const lmin = layout.lmin ?? 0;
  const lmax = layout.lmax != null && Number.isFinite(layout.lmax) ? layout.lmax : Infinity;
  const step = layout.orderLengthStepM ?? DEFAULT_ORDER_LENGTH_STEP_M;
  const strips = layout.strips.map((s) => {
    if (s.id !== stripId) return { ...s };
    let L = stepCeil(s.L_cover, step);
    L = clamp(L, lmin > 0 ? lmin : 0, Number.isFinite(lmax) ? lmax : L);
    const aOrd = L * s.width;
    const waste = Math.max(0, aOrd - s.areaUsable);
    return {
      ...s,
      L_order: +L.toFixed(6),
      source: "auto",
      areaOrdered: +aOrd.toFixed(6),
      wasteM2_site: +waste.toFixed(6),
    };
  });
  return recomputeTotals({ ...layout, strips });
}

function recomputeTotals(layout) {
  let areaOrdered = 0;
  let areaUsable = 0;
  let areaWasteSite = 0;
  for (const s of layout.strips) {
    areaOrdered += s.areaOrdered;
    areaUsable += s.areaUsable;
    areaWasteSite += s.wasteM2_site;
  }
  const wastePct = areaOrdered > EPS ? (areaWasteSite / areaOrdered) * 100 : 0;
  return {
    ...layout,
    totals: {
      ...layout.totals,
      areaOrdered: +areaOrdered.toFixed(6),
      areaUsable: +areaUsable.toFixed(6),
      areaWasteSite: +areaWasteSite.toFixed(6),
      wastePct: +wastePct.toFixed(4),
    },
  };
}

function emptyLayout({ zoneId, mode, au, orderLengthStepM, lmin, lmax, warnings, notes, polygon }) {
  return {
    schema: SCHEMA,
    zoneId,
    polygon: polygon || [],
    cutMode: mode,
    panelRun: "along_largo",
    au,
    orderLengthStepM,
    lmin,
    lmax: Number.isFinite(lmax) ? lmax : null,
    strips: [],
    totals: {
      areaOrdered: 0,
      areaUsable: 0,
      areaWasteSite: 0,
      areaWasteWidth: 0,
      wastePct: 0,
    },
    notes,
    warnings: [...new Set(warnings)],
  };
}

export function bomFromIrregularSchedule(layout, precioM2) {
  const area = layout?.totals?.areaOrdered ?? 0;
  const pu = +precioM2 || 0;
  return {
    cantPaneles: layout?.strips?.length ?? 0,
    areaTotal: +area.toFixed(2),
    areaOrdered: +area.toFixed(2),
    areaUsable: +(layout?.totals?.areaUsable ?? 0).toFixed(2),
    areaWasteSite: +(layout?.totals?.areaWasteSite ?? 0).toFixed(2),
    wastePct: layout?.totals?.wastePct ?? 0,
    costoPaneles: +(area * pu).toFixed(2),
    precioM2: pu,
    strips: layout?.strips ?? [],
    notes: layout?.notes ?? [],
    warnings: layout?.warnings ?? [],
    descarte: {
      siteM2: +(layout?.totals?.areaWasteSite ?? 0).toFixed(2),
      porcentaje: +(layout?.totals?.wastePct ?? 0).toFixed(1),
    },
  };
}

/**
 * Factory order list for UI / PDF: each panel + N×L summary (min waste = per-strip stepCeil).
 * @param {object|null} layout
 * @param {Record<string|number, object>|null} byGi
 * @returns {{
 *   rows: Array<{ id: string, zoneGi?: number, L_order: number, L_cover: number, source: string, wasteM2: number }>,
 *   summaryByLength: Array<{ L_order: number, count: number, ids: string[] }>,
 *   totals: { areaOrdered: number, areaUsable: number, areaWasteSite: number, wastePct: number, cantPaneles: number },
 *   note: string,
 * }|null}
 */
export function buildFactoryOrderList(layout = null, byGi = null) {
  const rows = [];
  let areaOrdered = 0;
  let areaUsable = 0;
  let areaWasteSite = 0;

  const pushLayout = (lay, gi) => {
    if (!lay?.strips?.length) return;
    const z =
      gi != null && Number.isFinite(Number(gi))
        ? Number(gi)
        : lay.zoneId != null
          ? Number(String(lay.zoneId).replace(/^z/i, ""))
          : undefined;
    for (const s of lay.strips) {
      rows.push({
        id: s.id,
        zoneGi: Number.isFinite(z) ? z : undefined,
        L_order: Number(s.L_order) || 0,
        L_cover: Number(s.L_cover) || 0,
        source: s.source || "auto",
        wasteM2: Number(s.wasteM2_site) || 0,
      });
    }
    areaOrdered += Number(lay.totals?.areaOrdered) || 0;
    areaUsable += Number(lay.totals?.areaUsable) || 0;
    areaWasteSite += Number(lay.totals?.areaWasteSite) || 0;
  };

  if (byGi && typeof byGi === "object") {
    const keys = Object.keys(byGi).sort((a, b) => Number(a) - Number(b));
    for (const k of keys) pushLayout(byGi[k], k);
  } else if (layout?.strips?.length) {
    pushLayout(layout, layout.zoneId?.replace?.(/^z/i, "") ?? 0);
  }

  if (!rows.length) return null;

  const byLen = new Map();
  for (const r of rows) {
    const key = r.L_order.toFixed(2);
    if (!byLen.has(key)) byLen.set(key, { L_order: r.L_order, count: 0, ids: [] });
    const g = byLen.get(key);
    g.count += 1;
    g.ids.push(r.id);
  }
  const summaryByLength = [...byLen.values()].sort((a, b) => b.L_order - a.L_order);
  const wastePct = areaOrdered > EPS ? (areaWasteSite / areaOrdered) * 100 : 0;

  return {
    rows,
    summaryByLength,
    totals: {
      areaOrdered: +areaOrdered.toFixed(2),
      areaUsable: +areaUsable.toFixed(2),
      areaWasteSite: +areaWasteSite.toFixed(2),
      wastePct: +wastePct.toFixed(2),
      cantPaneles: rows.length,
    },
    note: CORTE_EN_OBRA_NOTE,
  };
}

/**
 * Flatten one or more irregular schedules for PDF quotation model.
 * @param {object|null} layout - single IrregularLayoutV1
 * @param {Record<string|number, object>|null} byGi - map gi → layout
 * @returns {{ strips: Array<{ id: string, L_order: number, L_cover: number, zoneGi?: number }>, note: string, areaOrdered: number, areaWasteSite: number, factorySummary?: string }|null}
 */
export function irregularSchedulesForPdf(layout = null, byGi = null) {
  const factory = buildFactoryOrderList(layout, byGi);
  if (!factory) return null;
  const factorySummary = factory.summaryByLength
    .map((g) => `${g.count}×${g.L_order.toFixed(2)} m`)
    .join(" · ");
  return {
    strips: factory.rows.map((r) => ({
      id: r.id,
      L_order: r.L_order,
      L_cover: r.L_cover,
      zoneGi: r.zoneGi,
      source: r.source,
    })),
    note: factory.note,
    areaOrdered: factory.totals.areaOrdered,
    areaWasteSite: factory.totals.areaWasteSite,
    factorySummary,
    summaryByLength: factory.summaryByLength,
  };
}
