// ═══════════════════════════════════════════════════════════════════════════
// panelLayout.js — Posición de paneles en planta para el plano 2D SVG.
// Fuente de verdad para posiciones; usa countPanels (misma fórmula que calcPanelesTecho).
// ═══════════════════════════════════════════════════════════════════════════

import { buildAnchoStripsPlanta } from './roofPanelStripsPlanta.js';

const PANEL_LAYOUT_EPS = 1e-9;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const roundM = (v) => +Number(v).toFixed(9);

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
    const width = roundM(Math.max(0, Math.min(au, s.width)));
    const isCut = width < au - PANEL_LAYOUT_EPS;
    return {
      id: `T-${String(s.idx + 1).padStart(2, '0')}`,
      idx: s.idx,
      x0: roundM(s.x0),
      width,
      isCut,
      cutRatio: clamp01(roundM(width / au)),
    };
  });

  const totalPanels = panels.length;
  const fullPanels = panels.filter((p) => !p.isCut).length;
  const cutPanels = totalPanels - fullPanels;
  const anchoTotal = totalPanels * au;
  const wasteRaw = +(anchoTotal - ancho).toFixed(6);
  const wasteM = Math.max(0, wasteRaw);

  return { panels, totalPanels, fullPanels, cutPanels, anchoTotal, wasteM, au };
}
