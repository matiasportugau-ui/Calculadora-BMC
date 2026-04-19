// ═══════════════════════════════════════════════════════════════════════════
// roofPlanCotaObstacles.js — AABB de cotas globales + etiquetas de encuentro (colisión chips).
// Debe mantenerse alineado con `EstructuraGlobalExteriorOverlay` en RoofPlanDimensions.jsx.
// ═══════════════════════════════════════════════════════════════════════════

import { fmtArchMeters } from "./roofPlanSvgTypography.js";
import { makeBumpCounter } from "./roofPlanDrawingTheme.js";

/** Rectángulos aproximados de cotas globales + textos de encuentro (mismas reglas que el overlay SVG). */
export function buildEstructuraCotaObstacleRects(exterior, encounters, svgTy) {
  if (!exterior?.length && !(encounters?.length > 0)) return [];
  const pad = Math.max(svgTy.dimFont * 0.32, svgTy.tickLen * 0.45);
  const nextBottom = makeBumpCounter();
  const nextTop = makeBumpCounter();
  const nextLeft = makeBumpCounter();
  const nextRight = makeBumpCounter();

  const out = [];

  const bottoms = exterior.filter((s) => s.side === "bottom").sort((a, b) => a.x1 - b.x1 || a.y1 - b.y1);
  for (const s of bottoms) {
    const idx = nextBottom(+s.y1.toFixed(2));
    const yDimLine = s.y1 + svgTy.dimStackBottom + idx * svgTy.dimStackStep;
    const x0 = s.x1;
    const w = s.length;
    const yText = yDimLine + svgTy.dimFont * 1.05;
    out.push({
      minX: Math.min(x0, x0 + w) - pad,
      maxX: Math.max(x0, x0 + w) + pad,
      minY: Math.min(s.y1, yDimLine) - svgTy.tickLen - pad,
      maxY: yText + svgTy.dimFont * 0.8 + pad,
    });
  }

  const tops = exterior.filter((s) => s.side === "top").sort((a, b) => a.x1 - b.x1 || a.y1 - b.y1);
  for (const s of tops) {
    const idx = nextTop(+s.y1.toFixed(2));
    const yDimLine = s.y1 - svgTy.dimStackTop - idx * svgTy.dimStackStep;
    const yText = yDimLine - svgTy.dimFont * 0.35;
    const x0 = s.x1;
    const w = s.length;
    out.push({
      minX: Math.min(x0, x0 + w) - pad,
      maxX: Math.max(x0, x0 + w) + pad,
      minY: yText - svgTy.dimFont * 0.95 - pad,
      maxY: Math.max(s.y1, yDimLine) + svgTy.tickLen + pad,
    });
  }

  const lefts = exterior.filter((s) => s.side === "left").sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);
  for (const s of lefts) {
    const idx = nextLeft(+s.x1.toFixed(2));
    const xDim = s.x1 - svgTy.sideOffset - idx * svgTy.sideStep;
    const tx = xDim - svgTy.dimFont * 0.85;
    const y1 = Math.min(s.y1, s.y2);
    const y2 = Math.max(s.y1, s.y2);
    out.push({
      minX: Math.min(tx, xDim, s.x1) - svgTy.dimFont * 1.35,
      maxX: s.x1 + svgTy.tickLen * 2 + pad,
      minY: y1 - svgTy.dimFont * 1.4,
      maxY: y2 + svgTy.dimFont * 1.4,
    });
  }

  const rights = exterior.filter((s) => s.side === "right").sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);
  for (const s of rights) {
    const idx = nextRight(+s.x1.toFixed(2));
    const xDim = s.x1 + svgTy.sideOffset + idx * svgTy.sideStep;
    const tx = xDim + svgTy.dimFont * 0.85;
    const y1 = Math.min(s.y1, s.y2);
    const y2 = Math.max(s.y1, s.y2);
    out.push({
      minX: s.x1 - svgTy.tickLen * 2 - pad,
      maxX: Math.max(tx, xDim, s.x1) + svgTy.dimFont * 1.35,
      minY: y1 - svgTy.dimFont * 1.4,
      maxY: y2 + svgTy.dimFont * 1.4,
    });
  }

  // Mirror the sign-flip logic from EstructuraGlobalExteriorOverlay so AABBs match real positions.
  const rightExtXSet = new Set(rights.map((s) => +s.x1.toFixed(2)));
  const leftExtXSet  = new Set(lefts.map((s)  => +s.x1.toFixed(2)));
  const topExtYSet   = new Set(tops.map((s)   => +s.y1.toFixed(2)));

  const encList = encounters ?? [];
  for (let i = 0; i < encList.length; i++) {
    const enc = encList[i];
    const mx = (enc.x1 + enc.x2) / 2;
    const my = (enc.y1 + enc.y2) / 2;
    const isVert = enc.orientation === "vertical";

    let tx, ty;
    if (isVert) {
      const encX = +enc.x1.toFixed(2);
      const nearRight = rightExtXSet.has(encX);
      const nearLeft  = leftExtXSet.has(encX);
      const xSign = nearRight ? -1 : nearLeft ? 1 : 1;
      tx = mx + xSign * svgTy.encOffX;
      ty = my;
    } else {
      const encY = +enc.y1.toFixed(2);
      const nearTop = topExtYSet.has(encY);
      tx = mx;
      ty = nearTop ? my + svgTy.encOffY : my - svgTy.encOffY;
    }
    const label = `${fmtArchMeters(enc.length)} m`;
    const ew = Math.max(svgTy.encFont * 1.15, label.length * svgTy.encFont * 0.52);
    const eh = svgTy.encFont * 1.4;
    out.push({
      minX: tx - ew / 2 - pad * 0.45,
      maxX: tx + ew / 2 + pad * 0.45,
      minY: ty - eh,
      maxY: ty + pad,
    });
  }

  return out;
}
