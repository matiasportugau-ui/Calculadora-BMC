/**
 * Estimación operativa de m², volumen y peso para solicitudes a transportistas.
 * Heurística: no sustituye pesada real ni certificación de carga.
 */

import { ROW_W } from "./cargoEngine.js";

/** kg/m² aproximado según espesor (panel sandwich metálico EPS/PIR — orden de magnitud). */
export function kgPerM2ForEspesor(espMm) {
  const e = Number(espMm) || 0;
  if (e <= 0) return 10;
  return 5.5 + (e / 1000) * 38;
}

/**
 * @param {{ tipo?: string, espesor?: number, longitud?: number, cantidad?: number }} p
 */
export function estimatePanelLinePhysical(p) {
  const cant = Math.max(0, Math.floor(Number(p.cantidad) || 0));
  const L = Math.max(0, Number(p.longitud) || 0);
  const espMm = Math.max(0, Number(p.espesor) || 0);
  const m2 = cant * L * ROW_W;
  const volumeM3 = m2 * (espMm / 1000);
  const estWeightKg = m2 * kgPerM2ForEspesor(espMm);
  return {
    m2,
    volumeM3,
    estWeightKg,
    label: `${p.tipo || "PANEL"} ${espMm}mm × ${L}m × ${cant}`,
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
