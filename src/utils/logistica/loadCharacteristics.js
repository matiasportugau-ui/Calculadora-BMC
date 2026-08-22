/**
 * Estimación operativa de m², volumen y peso para solicitudes a transportistas.
 * Heurística: no sustituye pesada real ni certificación de carga.
 *
 * Material m² uses catalog ancho útil (ISODEC 1.12, …) — not truck ROW_W 1.2.
 * Bed cuboid occupancy stays L×ROW_W×H_pack in packageDims / remitoPackageMetrics.
 */

import { panelMaterialMetrics } from "./panelAnchoUtil.js";

export const ROW_W = 1.2; // truck row occupancy (half of 2.4 m bed) — not covering AU

/** kg/m² aproximado según espesor (panel sandwich metálico EPS/PIR — orden de magnitud). */
export function kgPerM2ForEspesor(espMm) {
  const e = Number(espMm) || 0;
  if (e <= 0) return 10;
  return 5.5 + (e / 1000) * 38;
}

/**
 * Covering m² + foam m³ (AU × L × qty × thickness). Not bed cuboid.
 * @param {{ tipo?: string, espesor?: number, longitud?: number, cantidad?: number }} p
 */
export function estimatePanelLinePhysical(p) {
  const mat = panelMaterialMetrics(p);
  const estWeightKg = mat.m2 * kgPerM2ForEspesor(mat.espesorMm);
  return {
    m2: mat.m2,
    volumeM3: mat.volumeM3,
    estWeightKg,
    au: mat.au,
    label: `${p.tipo || "PANEL"} ${mat.espesorMm}mm × ${mat.longitud}m × ${mat.cantidad}`,
  };
}

/**
 * @param {any} stop
 */
export function estimateStopLoadPhysical(stop) {
  const lines = [];
  let m2 = 0;
  let volumeM3 = 0;
  let estWeightKg = 0;
  for (const p of stop.paneles || []) {
    const e = estimatePanelLinePhysical(p);
    m2 += e.m2;
    volumeM3 += e.volumeM3;
    estWeightKg += e.estWeightKg;
    lines.push(e);
  }
  for (const a of stop.accesorios || []) {
    const c = Math.max(0, Math.floor(Number(a.cantidad) || 0));
    const descr = String(a.descr || "Accesorio").trim() || "Accesorio";
    const accVol = c * 0.015;
    const accKg = c * 3;
    volumeM3 += accVol;
    estWeightKg += accKg;
    lines.push({
      m2: 0,
      volumeM3: accVol,
      estWeightKg: accKg,
      label: `${descr} × ${c}`,
    });
  }
  return { m2, volumeM3, estWeightKg, lines };
}

/**
 * @param {any[]} stops
 */
export function estimateRouteLoadPhysical(stops) {
  const byStop = [];
  let m2 = 0;
  let volumeM3 = 0;
  let estWeightKg = 0;
  for (const s of stops || []) {
    const e = estimateStopLoadPhysical(s);
    m2 += e.m2;
    volumeM3 += e.volumeM3;
    estWeightKg += e.estWeightKg;
    byStop.push({
      id: s.id,
      orden: s.orden,
      cliente: s.cliente,
      ...e,
    });
  }
  return { m2, volumeM3, estWeightKg, byStop };
}
