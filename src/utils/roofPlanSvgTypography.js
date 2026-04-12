// ═══════════════════════════════════════════════════════════════════════════
// roofPlanSvgTypography.js — Escala tipográfica y formato numérico del plano 2D (SVG, metros).
// ═══════════════════════════════════════════════════════════════════════════

import { ROOF_PLAN_DIM_FONT_BASE } from "./roofPlanDrawingTheme.js";

/**
 * Escala tipografía y grosores de cotas al **span del viewBox** para que sigan legibles en pantalla.
 * @param {{ vbW: number, vbH: number }|null|undefined} viewMetrics
 */
export function buildRoofPlanSvgTypography(viewMetrics) {
  const base = ROOF_PLAN_DIM_FONT_BASE;
  if (!viewMetrics || !(viewMetrics.vbW > 0) || !(viewMetrics.vbH > 0)) {
    const m = 1;
    return {
      dimFont: base,
      m,
      tickLen: 0.075 * m,
      extGap: 0.03 * m,
      extOvershoot: 0.04 * m,
      strokeExt: 0.022 * m,
      strokeMain: 0.032 * m,
      strokeTick: 0.035 * m,
      encFont: 0.11 * m,
      encStroke: 0.028 * m,
      dimStackBottom: 0.24 * m,
      dimStackTop: 0.24 * m,
      dimStackStep: 0.14 * m,
      sideOffset: 0.42 * m,
      sideStep: 0.14 * m,
      encOffX: 0.22 * m,
      encOffY: 0.2 * m,
    };
  }
  const span = Math.max(viewMetrics.vbW, viewMetrics.vbH, 2.5);
  let dimFont = span * 0.024;
  dimFont = Math.min(0.5, Math.max(0.19, dimFont));
  const m = dimFont / base;
  return {
    dimFont,
    m,
    tickLen: 0.075 * m,
    extGap: 0.03 * m,
    extOvershoot: 0.04 * m,
    strokeExt: 0.022 * m,
    strokeMain: 0.032 * m,
    strokeTick: 0.035 * m,
    encFont: Math.min(0.42, Math.max(0.15, dimFont * 0.9)),
    encStroke: 0.028 * m,
    dimStackBottom: 0.24 * m,
    dimStackTop: 0.24 * m,
    dimStackStep: 0.14 * m,
    sideOffset: 0.42 * m,
    sideStep: 0.14 * m,
    encOffX: 0.22 * m,
    encOffY: 0.2 * m,
  };
}

export function fmtArchMeters(m) {
  if (!Number.isFinite(m)) return "—";
  if (Math.abs(m - Math.round(m)) < 1e-6) return `${Math.round(m)}`;
  const s = `${+m.toFixed(2)}`;
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/** Formatea metros como entero en mm. 1.12 → "1120", 0.52 → "520" */
export function fmtDimMm(m) {
  return String(Math.round(m * 1000));
}

/** Formatea metros para etiqueta de cota general. 1.12 → "1,12 m" */
export function fmtDimOverall(m) {
  return `${fmtArchMeters(m)} m`;
}
