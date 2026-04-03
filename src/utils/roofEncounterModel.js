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
