// ═══════════════════════════════════════════════════════════════════════════
// panelLayout.js — Posición de paneles en planta para el plano 2D SVG.
// Fuente de verdad para posiciones; usa countPanels (misma fórmula que calcPanelesTecho).
// ═══════════════════════════════════════════════════════════════════════════

import { buildAnchoStripsPlanta } from './roofPanelStripsPlanta.js';

/**
 * Layout de paneles en planta para una zona de techo.
 * Usa la misma lógica que calcPanelesTecho para garantizar consistencia BOM↔plano.
 *
 * @param {{ au: number }} panel  — objeto panel de PANELS_TECHO/PANELS_PARED (campo .au)
 * @param {number} largo          — largo de zona en metros (largoReal tras pendiente)
 * @param {number} ancho          — ancho EN PLANTA (el caller debe dividir /2 para dos_aguas)
 *
 * Casos de validación:
 *   {au:1.12, largo:6, ancho:5.6}  → 5 paneles enteros, wasteM≈0
 *   {au:1.12, largo:6, ancho:3.36} → 3 paneles enteros, wasteM≈0  ← fix IEEE-754
 *   {au:1.12, largo:6, ancho:8.36} → 8 paneles, último 0.52 m ✂, wasteM=0.60
 *   {au:1.0,  largo:4, ancho:3.5}  → 4 paneles, último 0.5 m ✂
 */
export function buildPanelLayout({ panel, largo, ancho }) {
  const au = panel?.au;
  if (!(au > 0) || !(ancho > 0) || !(largo > 0)) {
    return {
      panels: [], totalPanels: 0, fullPanels: 0, cutPanels: 0,
      anchoTotal: 0, wasteM: 0, au: au ?? 0,
    };
  }

  const strips = buildAnchoStripsPlanta(ancho, au);
  const panels = strips.map((s) => {
    const isCut = s.width < au - 1e-9;
    return {
      id: `T-${String(s.idx + 1).padStart(2, '0')}`,
      idx: s.idx,
      x0: s.x0,
      width: s.width,
      isCut,
      cutRatio: s.width / au,
    };
  });

  const totalPanels = panels.length;
  const fullPanels = panels.filter((p) => !p.isCut).length;
  const cutPanels = totalPanels - fullPanels;
  // Round to avoid IEEE-754 dust on exact multiples (e.g. 5 * 1.12 = 5.6000000000000005).
  // Uses same precision as calcPanelesTecho which passes anchoTotal to BOM comparisons.
  const anchoTotal = +( totalPanels * au ).toFixed(10);
  const wasteM = +(anchoTotal - ancho).toFixed(6);

  return { panels, totalPanels, fullPanels, cutPanels, anchoTotal, wasteM, au };
}
