// ═══════════════════════════════════════════════════════════════════════════
// roofEncounterModel.js — Taxonomía de encuentros entre zonas (accesorios / BOM)
// Ver docs/team/ux-feedback/ROOF-ENCOUNTER-LOGIC-SPEC.md
// ═══════════════════════════════════════════════════════════════════════════

import { findEncounters, ROOF_PLAN_EPS } from "./roofPlanGeometry.js";

/** @typedef {'continuo' | 'pretil' | 'cumbrera' | 'desnivel'} EncounterModo */

/**
 * Normaliza objeto guardado en preview.encounters[side] (retrocompatible).
 * @param {object|null|undefined} raw
 * @returns {{ tipo: 'continuo'|'perfil', modo: EncounterModo, perfil: string|null, perfilVecino: string|null, desnivel?: object }}
 */
export function normalizeEncounter(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const tipo = r.tipo === "perfil" ? "perfil" : "continuo";
  let modo = r.modo;
  if (!modo) {
    if (tipo === "continuo") modo = "continuo";
    else if (r.cumbreraUnida) modo = "cumbrera";
    else if (r.desnivel) modo = "desnivel";
    else modo = "pretil";
  }
  if (!["continuo", "pretil", "cumbrera", "desnivel"].includes(modo)) modo = tipo === "continuo" ? "continuo" : "pretil";
  return {
    tipo: modo === "continuo" ? "continuo" : "perfil",
    modo,
    perfil: r.perfil ?? null,
    perfilVecino: r.perfilVecino ?? null,
    cumbreraUnida: Boolean(r.cumbreraUnida),
    desnivel: r.desnivel && typeof r.desnivel === "object" ? r.desnivel : undefined,
  };
}

/** Para BOM: sin accesorio en el tramo compartido. */
export function encounterEsContinuo(raw) {
  const n = normalizeEncounter(raw);
  return n.modo === "continuo";
}

/**
 * Un solo id de accesorio para la capa de cotización en un lado compartido (MVP).
 * Pretil/cumbrera: `perfil`. Desnivel: prioriza `desnivel.perfilBajo`, luego `perfilAlto`, luego `perfil`.
 * @param {object|null|undefined} raw
 * @returns {string}
 */
export function encounterBorderPerfil(raw) {
  const n = normalizeEncounter(raw);
  if (n.modo === "continuo") return "none";
  if (n.modo === "desnivel" && n.desnivel) {
    const d = n.desnivel;
    const a = d.perfilBajo ?? d.perfilAlto ?? n.perfil;
    return a && a !== "none" ? a : "none";
  }
  const p = n.perfil;
  return p && p !== "none" ? p : "none";
}

/** Claves de encuentro que puede pisar un tramo (`segments[]`). */
const ENCOUNTER_SEGMENT_OVERLAY_KEYS = ["tipo", "modo", "perfil", "perfilVecino", "cumbreraUnida", "desnivel"];

/**
 * Objeto encuentro por par **sin** `segments` (base para herencia por tramo).
 * @param {object|null|undefined} raw
 */
export function pairEncounterBaseRaw(raw) {
  if (!raw || typeof raw !== "object") return {};
  const { segments: _s, ...rest } = raw;
  return rest;
}

/**
 * Fusiona base del par + overlay opcional del tramo → objeto bruto para `normalizeEncounter`.
 * @param {object|null|undefined} baseRaw
 * @param {object|null|undefined} overlay
 */
export function mergePairEncounterOverlay(baseRaw, overlay) {
  const base = pairEncounterBaseRaw(baseRaw);
  const o = overlay && typeof overlay === "object" ? overlay : {};
  const out = { ...base };
  for (const k of ENCOUNTER_SEGMENT_OVERLAY_KEYS) {
    if (o[k] !== undefined) out[k] = o[k];
  }
  return out;
}

function clampUnitT(t) {
  const n = Number(t);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Normaliza lista `segments` guardada en `preview.encounterByPair[pk]`.
 * Cada tramo: `{ id, t0, t1, includeInBom?, encounter? }` con `t0<t1` en [0,1] a lo largo del segmento geométrico.
 * @param {object|null|undefined} raw
 * @returns {Array<{ id: string, t0: number, t1: number, includeInBom: boolean, encounter: object }>}
 */
export function normalizeEncounterPairSegments(raw) {
  const base = raw && typeof raw === "object" ? raw : {};
  const segsIn = Array.isArray(base.segments) ? base.segments : null;
  if (!segsIn?.length) {
    return [{
      id: "full",
      t0: 0,
      t1: 1,
      includeInBom: base.includeInBom !== false,
      encounter: {},
    }];
  }
  const out = [];
  for (let i = 0; i < segsIn.length; i++) {
    const s = segsIn[i] && typeof segsIn[i] === "object" ? segsIn[i] : {};
    const t0 = clampUnitT(s.t0);
    const t1 = clampUnitT(s.t1);
    if (!(t1 > t0 + 1e-9)) continue;
    const id = String(s.id || `s${out.length}`);
    const enc = s.encounter && typeof s.encounter === "object" ? s.encounter : {};
    out.push({
      id,
      t0,
      t1,
      includeInBom: s.includeInBom !== false,
      encounter: { ...enc },
    });
  }
  if (!out.length) {
    return [{
      id: "full",
      t0: 0,
      t1: 1,
      includeInBom: base.includeInBom !== false,
      encounter: {},
    }];
  }
  out.sort((a, b) => a.t0 - b.t0);
  return out;
}

/**
 * Runs listos para BOM / UI: intervalo en t + `effectiveRaw` normalizado por tramo.
 * @param {object|null|undefined} pairRaw
 */
export function listEncounterPairSegmentRuns(pairRaw) {
  const base = pairRaw && typeof pairRaw === "object" ? pairRaw : {};
  const segs = normalizeEncounterPairSegments(base);
  return segs.map((s) => {
    const effectiveRaw = mergePairEncounterOverlay(base, s.encounter);
    return {
      id: s.id,
      t0: s.t0,
      t1: s.t1,
      includeInBom: s.includeInBom,
      effectiveRaw,
      normalized: normalizeEncounter(effectiveRaw),
    };
  });
}

/**
 * Parte un tramo en dos a la mitad (mismo overlay en ambos mitades; el usuario puede editar después).
 * @param {object|null|undefined} pairRaw
 * @param {string} segmentId
 * @returns {object|null} nuevo objeto para `encounterByPair[pk]` o null si no aplica
 */
export function splitEncounterPairSegmentMid(pairRaw, segmentId) {
  if (!pairRaw || typeof pairRaw !== "object") return null;
  const segs = normalizeEncounterPairSegments(pairRaw);
  const idx = segs.findIndex((s) => s.id === segmentId);
  if (idx < 0) return null;
  const s = segs[idx];
  const mid = (s.t0 + s.t1) / 2;
  if (!(mid > s.t0 + 1e-6 && s.t1 > mid + 1e-6)) return null;
  const next = [...segs];
  next.splice(idx, 1,
    { ...s, id: `${s.id}-a`, t0: s.t0, t1: mid, encounter: { ...s.encounter } },
    { ...s, id: `${s.id}-b`, t0: mid, t1: s.t1, encounter: { ...s.encounter } },
  );
  return { ...pairEncounterBaseRaw(pairRaw), segments: next };
}

/**
 * Actualiza un tramo (overlay parcial, includeInBom, o reemplazo de `encounter`).
 * @param {object|null|undefined} pairRaw
 * @param {string} segmentId
 * @param {{ includeInBom?: boolean, encounter?: object|null }} patch
 */
export function patchEncounterPairSegment(pairRaw, segmentId, patch) {
  const base = pairRaw && typeof pairRaw === "object" ? pairRaw : {};
  const segs = normalizeEncounterPairSegments(base);
  const idx = segs.findIndex((s) => s.id === segmentId);
  if (idx < 0) return base;
  const cur = segs[idx];
  const nextSegs = segs.map((s, i) => {
    if (i !== idx) return s;
    const includeInBom = patch?.includeInBom !== undefined ? Boolean(patch.includeInBom) : cur.includeInBom;
    let enc = cur.encounter;
    if (patch && Object.prototype.hasOwnProperty.call(patch, "encounter")) {
      enc = patch.encounter == null ? {} : { ...patch.encounter };
    }
    return { ...cur, includeInBom, encounter: enc && typeof enc === "object" ? enc : {} };
  });
  return { ...pairEncounterBaseRaw(base), segments: nextSegs };
}

/**
 * Resuelve el índice de zona vecina y el lado opuesto en un encuentro de planta.
 * @param {number} gi
 * @param {"latIzq"|"latDer"|"frente"|"fondo"} side
 * @param {Array<{ gi: number, x: number, y: number, w: number, h: number }>} plantRects retorno de layoutZonasEnPlanta
 * @returns {{ neighborGi: number|null, neighborSide: string|null }}
 */
export function resolveNeighborSharedSide(gi, side, plantRects) {
  if (!plantRects?.length) return { neighborGi: null, neighborSide: null };
  const rects = plantRects;
  const byGi = (g) => rects.find((r) => r.gi === g);
  const R = byGi(gi);
  if (!R) return { neighborGi: null, neighborSide: null };

  let encs;
  try {
    encs = findEncounters(rects);
  } catch {
    return { neighborGi: null, neighborSide: null };
  }

  for (const e of encs) {
    if (!e.zoneIndices?.includes(gi)) continue;
    const [ga, gb] = e.zoneIndices;
    const other = ga === gi ? gb : ga;
    const Ro = byGi(other);
    if (!Ro) continue;

    if (e.orientation === "vertical" && (side === "latDer" || side === "latIzq")) {
      const xLine = e.x1;
      if (side === "latDer" && Math.abs(R.x + R.w - xLine) <= ROOF_PLAN_EPS && Math.abs(Ro.x - xLine) <= ROOF_PLAN_EPS) {
        return { neighborGi: other, neighborSide: "latIzq" };
      }
      if (side === "latIzq" && Math.abs(R.x - xLine) <= ROOF_PLAN_EPS && Math.abs(Ro.x + Ro.w - xLine) <= ROOF_PLAN_EPS) {
        return { neighborGi: other, neighborSide: "latDer" };
      }
    }

    if (e.orientation === "horizontal" && (side === "frente" || side === "fondo")) {
      const yLine = e.y1;
      if (side === "frente" && Math.abs(R.y + R.h - yLine) <= ROOF_PLAN_EPS && Math.abs(Ro.y - yLine) <= ROOF_PLAN_EPS) {
        return { neighborGi: other, neighborSide: "fondo" };
      }
      if (side === "fondo" && Math.abs(R.y - yLine) <= ROOF_PLAN_EPS && Math.abs(Ro.y + Ro.h - yLine) <= ROOF_PLAN_EPS) {
        return { neighborGi: other, neighborSide: "frente" };
      }
    }
  }

  return { neighborGi: null, neighborSide: null };
}
