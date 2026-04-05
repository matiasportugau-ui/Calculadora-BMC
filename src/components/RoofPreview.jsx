// ═══════════════════════════════════════════════════════════════════════════
// RoofPreview.jsx — Vista previa del techo (rejilla de paneles, drag, pendiente)
// Coordenadas del SVG en metros (planta). preview.x/y alimenta encuentros y (con geometría) el BOM;
// buildRoofPlanEdges muestra perímetro/encuentros. Rejilla en planta: largo del panel = largo del techo (h en SVG);
// cantidad de paneles reparte el ancho en planta (w) cada au → columnas verticales / juntas verticales (alineado a calcPanelesTecho).
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useMemo, useRef, useState } from "react";
import { C, FONT } from "../data/constants.js";
import CollapsibleHint from "./CollapsibleHint.jsx";
import { calcFactorPendiente } from "../utils/calculations.js";
import { useRoofPreviewPlanLayout } from "../hooks/useRoofPreviewPlanLayout.js";
import { encounterPairKey, findEncounters } from "../utils/roofPlanGeometry.js";
import { normalizeEncounter } from "../utils/roofEncounterModel.js";
import {
  formatZonaDisplayTitle,
  getLateralAnnexRootBodyGi,
  isLateralAnnexZona,
} from "../utils/roofLateralAnnexLayout.js";
import { nextRoofSlopeMark } from "../utils/roofSlopeMark.js";
import { buildAnchoStripsPlanta, panelCountAcrossAnchoPlanta } from "../utils/roofPanelStripsPlanta.js";

/** ViewBox slack: `useRoofPreviewPlanLayout.js` (mismo valor que al calcular `layout.viewBox`). */
/** Menos de 1 = el rectángulo se mueve más lento que el puntero (mejor precisión). */
const DRAG_SENSITIVITY = 0.52;
/** Distancia máx (m) para que el borde de una zona se enganche al borde de otra al soltar. */
const SNAP_ZONE_M = 0.35;

/** Etiqueta largo×ancho coherente con el rectángulo dibujado (ancho efectivo en planta). */
function zonaLabelPlanta(r) {
  const L = Number(r.z.largo);
  const W = Number(r.w);
  if (!Number.isFinite(L) || !Number.isFinite(W)) return "—";
  const fmt = (x) => (Math.abs(x - Math.round(x)) < 1e-6 ? String(Math.round(x)) : x.toFixed(2).replace(/\.?0+$/, ""));
  return `${fmt(L)}×${fmt(W)}m`;
}

function clientToSvg(svgEl, cx, cy) {
  if (!svgEl) return { x: 0, y: 0 };
  const pt = svgEl.createSVGPoint();
  pt.x = cx;
  pt.y = cy;
  const m = svgEl.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = pt.matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}

/** Evita doble trazo entre rectángulos del mismo cuerpo (misma fila, mismo root en planta). */
function suppressSharedVerticalStroke(r, entries, zonas) {
  const eps = 0.006;
  const root = getLateralAnnexRootBodyGi(zonas, r.gi);
  let left = false;
  let right = false;
  for (const e of entries) {
    if (e.gi === r.gi) continue;
    if (getLateralAnnexRootBodyGi(zonas, e.gi) !== root) continue;
    if (Math.abs(e.y - r.y) > eps || Math.abs(e.h - r.h) > eps) continue;
    if (Math.abs(e.x + e.w - r.x) < eps) left = true;
    if (Math.abs(r.x + r.w - e.x) < eps) right = true;
  }
  return { left, right };
}

function clampZonaTopLeft(x, y, w, h, vm) {
  if (!vm) return { x, y };
  const { vbX, vbY, vbW, vbH, margin } = vm;
  const x1 = vbX + margin;
  const y1 = vbY + margin;
  const x2 = vbX + vbW - margin - w;
  const y2 = vbY + vbH - margin - h;
  if (x2 < x1) return { x: vbX + (vbW - w) / 2, y: vbY + (vbH - h) / 2 };
  if (y2 < y1) return { x: vbX + (vbW - w) / 2, y: vbY + (vbH - h) / 2 };
  return {
    x: Math.min(Math.max(x, x1), x2),
    y: Math.min(Math.max(y, y1), y2),
  };
}

/** Imán a aristas de otras zonas (8 candidatos por eje). */
function snapDragRect(rawX, rawY, w, h, gi, entries, snapM) {
  let fx = rawX;
  let fy = rawY;
  let bestX = snapM;
  let bestY = snapM;
  const L = rawX;
  const R = rawX + w;
  const T = rawY;
  const B = rawY + h;
  for (const r of entries) {
    if (r.gi === gi) continue;
    const rL = r.x;
    const rR = r.x + r.w;
    const rT = r.y;
    const rB = r.y + r.h;
    const tryX = (nx, d) => {
      if (d < bestX) {
        bestX = d;
        fx = nx;
      }
    };
    const tryY = (ny, d) => {
      if (d < bestY) {
        bestY = d;
        fy = ny;
      }
    };
    tryX(rL, Math.abs(L - rL));
    tryX(rR, Math.abs(L - rR));
    tryX(rL - w, Math.abs(R - rL));
    tryX(rR - w, Math.abs(R - rR));
    tryY(rT, Math.abs(T - rT));
    tryY(rB, Math.abs(T - rB));
    tryY(rT - h, Math.abs(B - rT));
    tryY(rB - h, Math.abs(B - rB));
  }
  return { x: fx, y: fy, snappedX: bestX < snapM, snappedY: bestY < snapM };
}

/** Guías de alineación (extensiones al viewBox). */
function alignmentGuidesForRect(x, y, w, h, gi, entries, snapM) {
  const vx = new Set();
  const hy = new Set();
  const candX = [x, x + w, x + w / 2];
  const candY = [y, y + h, y + h / 2];
  const tol = snapM * 1.15;
  for (const r of entries) {
    if (r.gi === gi) continue;
    const ox = [r.x, r.x + r.w, r.x + r.w / 2];
    const oy = [r.y, r.y + r.h, r.y + r.h / 2];
    for (const cx of candX) {
      for (const oxv of ox) {
        if (Math.abs(cx - oxv) < tol) vx.add(+(cx).toFixed(4));
      }
    }
    for (const cy of candY) {
      for (const oyv of oy) {
        if (Math.abs(cy - oyv) < tol) hy.add(+(cy).toFixed(4));
      }
    }
  }
  return { vx: [...vx], hy: [...hy] };
}

function encounterStrokeForModo(modo) {
  if (modo === "continuo") return "#22c55e";
  if (modo === "pretil") return "#f97316";
  if (modo === "cumbrera") return "#3b82f6";
  if (modo === "desnivel") return "#ef4444";
  return "#f59e0b";
}

const ARCH_DIM_STROKE = "#dc2626";
/** Tamaño base (m en coords SVG) usado como referencia para escalar cotas respecto al span del plano. */
const ARCH_DIM_FONT = 0.13;
const ARCH_EXT_OPACITY = 0.75;

/**
 * Escala tipografía y grosores de cotas al **span del viewBox** para que sigan legibles en pantalla
 * (planos grandes: antes ~0.13 m quedaba ~pocos px; móvil: más altura útil en el contenedor).
 * @param {{ vbW: number, vbH: number }|null|undefined} viewMetrics
 */
function buildRoofPlanSvgTypography(viewMetrics) {
  const base = ARCH_DIM_FONT;
  if (!viewMetrics || !(viewMetrics.vbW > 0) || !(viewMetrics.vbH > 0)) {
    const m = 1;
    return {
      dimFont: base,
      m,
      tickLen: 0.075 * m,
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
  // ~2.4% del span del diagrama → proporción estable en px al hacer meet del SVG
  let dimFont = span * 0.024;
  dimFont = Math.min(0.5, Math.max(0.19, dimFont));
  const m = dimFont / base;
  return {
    dimFont,
    m,
    tickLen: 0.075 * m,
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

function fmtArchMeters(m) {
  if (!Number.isFinite(m)) return "—";
  if (Math.abs(m - Math.round(m)) < 1e-6) return `${Math.round(m)}`;
  const s = `${+m.toFixed(2)}`;
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/** Cota horizontal (estilo arquitectura): debajo del borde inferior del rectángulo. */
function ArchDimHorizontal({ x0, yBottom, widthM, yDimLine, svgTy }) {
  const w = widthM;
  const tick = svgTy.tickLen;
  const label = `${fmtArchMeters(w)} m`;
  return (
    <g pointerEvents="none" stroke={ARCH_DIM_STROKE} fill={ARCH_DIM_STROKE}>
      <line
        x1={x0}
        y1={yBottom}
        x2={x0}
        y2={yDimLine}
        strokeWidth={svgTy.strokeExt}
        opacity={ARCH_EXT_OPACITY}
      />
      <line
        x1={x0 + w}
        y1={yBottom}
        x2={x0 + w}
        y2={yDimLine}
        strokeWidth={svgTy.strokeExt}
        opacity={ARCH_EXT_OPACITY}
      />
      <line x1={x0} y1={yDimLine} x2={x0 + w} y2={yDimLine} strokeWidth={svgTy.strokeMain} />
      <line x1={x0} y1={yDimLine - tick / 2} x2={x0} y2={yDimLine + tick / 2} strokeWidth={svgTy.strokeTick} />
      <line
        x1={x0 + w}
        y1={yDimLine - tick / 2}
        x2={x0 + w}
        y2={yDimLine + tick / 2}
        strokeWidth={svgTy.strokeTick}
      />
      <text
        x={x0 + w / 2}
        y={yDimLine + svgTy.dimFont * 1.05}
        textAnchor="middle"
        fontSize={svgTy.dimFont}
        fontWeight={700}
        fontFamily={FONT}
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}

/** Cota horizontal sobre el borde superior (yEdge = arista del techo; yDimLine más arriba). */
function ArchDimHorizontalTop({ x0, yEdge, widthM, yDimLine, svgTy }) {
  const w = widthM;
  const tick = svgTy.tickLen;
  const label = `${fmtArchMeters(w)} m`;
  return (
    <g pointerEvents="none" stroke={ARCH_DIM_STROKE} fill={ARCH_DIM_STROKE}>
      <line x1={x0} y1={yEdge} x2={x0} y2={yDimLine} strokeWidth={svgTy.strokeExt} opacity={ARCH_EXT_OPACITY} />
      <line x1={x0 + w} y1={yEdge} x2={x0 + w} y2={yDimLine} strokeWidth={svgTy.strokeExt} opacity={ARCH_EXT_OPACITY} />
      <line x1={x0} y1={yDimLine} x2={x0 + w} y2={yDimLine} strokeWidth={svgTy.strokeMain} />
      <line x1={x0} y1={yDimLine - tick / 2} x2={x0} y2={yDimLine + tick / 2} strokeWidth={svgTy.strokeTick} />
      <line x1={x0 + w} y1={yDimLine - tick / 2} x2={x0 + w} y2={yDimLine + tick / 2} strokeWidth={svgTy.strokeTick} />
      <text
        x={x0 + w / 2}
        y={yDimLine - svgTy.dimFont * 0.35}
        textAnchor="middle"
        fontSize={svgTy.dimFont}
        fontWeight={700}
        fontFamily={FONT}
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}

/** Cota vertical a la derecha del borde (xRef = arista exterior; xDim más afuera). */
function ArchDimVerticalSegmentRight({ xRef, xDim, y1, y2, spanM, svgTy }) {
  const tick = svgTy.tickLen;
  const ym = (y1 + y2) / 2;
  const label = `${fmtArchMeters(spanM)} m`;
  const tx = xDim + svgTy.dimFont * 0.85;
  return (
    <g pointerEvents="none" stroke={ARCH_DIM_STROKE} fill={ARCH_DIM_STROKE}>
      <line x1={xRef} y1={y1} x2={xDim} y2={y1} strokeWidth={svgTy.strokeExt} opacity={ARCH_EXT_OPACITY} />
      <line x1={xRef} y1={y2} x2={xDim} y2={y2} strokeWidth={svgTy.strokeExt} opacity={ARCH_EXT_OPACITY} />
      <line x1={xDim} y1={y1} x2={xDim} y2={y2} strokeWidth={svgTy.strokeMain} />
      <line x1={xDim - tick / 2} y1={y1} x2={xDim + tick / 2} y2={y1} strokeWidth={svgTy.strokeTick} />
      <line x1={xDim - tick / 2} y1={y2} x2={xDim + tick / 2} y2={y2} strokeWidth={svgTy.strokeTick} />
      <text
        x={tx}
        y={ym}
        textAnchor="middle"
        fontSize={svgTy.dimFont * 0.95}
        fontWeight={700}
        fontFamily={FONT}
        stroke="none"
        transform={`rotate(-90 ${tx} ${ym})`}
      >
        {label}
      </text>
    </g>
  );
}

/** Cota vertical entre y1 e y2 (y1 < y2), línea de cota a la izquierda de xRef. */
function ArchDimVerticalSegment({ xRef, xDim, y1, y2, spanM, svgTy }) {
  const tick = svgTy.tickLen;
  const ym = (y1 + y2) / 2;
  const label = `${fmtArchMeters(spanM)} m`;
  const tx = xDim - svgTy.dimFont * 0.85;
  return (
    <g pointerEvents="none" stroke={ARCH_DIM_STROKE} fill={ARCH_DIM_STROKE}>
      <line x1={xRef} y1={y1} x2={xDim} y2={y1} strokeWidth={svgTy.strokeExt} opacity={ARCH_EXT_OPACITY} />
      <line x1={xRef} y1={y2} x2={xDim} y2={y2} strokeWidth={svgTy.strokeExt} opacity={ARCH_EXT_OPACITY} />
      <line x1={xDim} y1={y1} x2={xDim} y2={y2} strokeWidth={svgTy.strokeMain} />
      <line x1={xDim - tick / 2} y1={y1} x2={xDim + tick / 2} y2={y1} strokeWidth={svgTy.strokeTick} />
      <line x1={xDim - tick / 2} y1={y2} x2={xDim + tick / 2} y2={y2} strokeWidth={svgTy.strokeTick} />
      <text
        x={tx}
        y={ym}
        textAnchor="middle"
        fontSize={svgTy.dimFont * 0.95}
        fontWeight={700}
        fontFamily={FONT}
        stroke="none"
        transform={`rotate(-90 ${tx} ${ym})`}
      >
        {label}
      </text>
    </g>
  );
}

/** Reparto de puntos de fijación por filas alineadas a ejes de apoyo. */
function fijacionDotsLayout(r, hints) {
  const P = Math.round(Number(hints.puntosFijacion));
  if (!(P > 0) || !(r.w > 0) || !(r.h > 0)) return [];
  const nAp = Number(hints.apoyos);
  const rows =
    Number.isFinite(nAp) && nAp >= 2 ? Math.min(24, Math.max(2, Math.round(nAp))) : 2;
  const counts = [];
  const base = Math.floor(P / rows);
  let extra = P - base * rows;
  for (let i = 0; i < rows; i++) {
    counts.push(base + (extra > 0 ? 1 : 0));
    if (extra > 0) extra -= 1;
  }
  const yForRow = (ri) => {
    if (rows <= 1) return r.y + r.h / 2;
    return r.y + (ri / (rows - 1)) * r.h;
  };
  const mx = Math.min(r.w, Math.max(0.12, r.w * 0.06));
  const x0 = r.x + mx;
  const x1 = r.x + r.w - mx;
  const usableW = Math.max(1e-6, x1 - x0);
  const out = [];
  let key = 0;
  for (let ri = 0; ri < rows; ri++) {
    const nInRow = counts[ri] || 0;
    const yy = yForRow(ri);
    for (let j = 0; j < nInRow; j++) {
      const t = nInRow === 1 ? 0.5 : (j + 1) / (nInRow + 1);
      const cx = x0 + t * usableW;
      out.push({ cx, cy: yy, key: key++ });
    }
  }
  return out;
}

/**
 * Cotas en **aristas exteriores expuestas** (tras restar encuentros) + longitud registrada en cada encuentro.
 * Las líneas quedan **afuera** del rectángulo de techo (sin solapar el relleno del panel).
 */
function EstructuraGlobalExteriorOverlay({ exterior = [], encounters = [], svgTy }) {
  const bump = () => {
    const m = new Map();
    return (k) => {
      const n = m.get(k) || 0;
      m.set(k, n + 1);
      return n;
    };
  };
  const nextBottom = bump();
  const nextTop = bump();
  const nextLeft = bump();
  const nextRight = bump();

  const bottoms = exterior.filter((s) => s.side === "bottom").sort((a, b) => a.x1 - b.x1 || a.y1 - b.y1);
  const tops = exterior.filter((s) => s.side === "top").sort((a, b) => a.x1 - b.x1 || a.y1 - b.y1);
  const lefts = exterior.filter((s) => s.side === "left").sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);
  const rights = exterior.filter((s) => s.side === "right").sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);

  const encLabels = encounters.map((enc, i) => {
    const mx = (enc.x1 + enc.x2) / 2;
    const my = (enc.y1 + enc.y2) / 2;
    const len = enc.length;
    const isVert = enc.orientation === "vertical";
    const tx = isVert ? mx + svgTy.encOffX : mx;
    const tyPos = isVert ? my : my - svgTy.encOffY;
    return (
      <g key={`enc-len-${enc.id || i}`} pointerEvents="none">
        <text
          x={tx}
          y={tyPos}
          textAnchor="middle"
          fontSize={svgTy.encFont}
          fontWeight={800}
          fontFamily={FONT}
          fill="#0f172a"
          stroke="#ffffff"
          strokeWidth={svgTy.encStroke}
          paintOrder="stroke"
        >
          {`${fmtArchMeters(len)} m`}
        </text>
      </g>
    );
  });

  return (
    <g data-bmc-layer="estructura-global-cotas">
      {bottoms.map((s) => {
        const idx = nextBottom(+s.y1.toFixed(3));
        return (
          <ArchDimHorizontal
            key={s.id}
            x0={s.x1}
            yBottom={s.y1}
            widthM={s.length}
            yDimLine={s.y1 + svgTy.dimStackBottom + idx * svgTy.dimStackStep}
            svgTy={svgTy}
          />
        );
      })}
      {tops.map((s) => {
        const idx = nextTop(+s.y1.toFixed(3));
        return (
          <ArchDimHorizontalTop
            key={s.id}
            x0={s.x1}
            yEdge={s.y1}
            widthM={s.length}
            yDimLine={s.y1 - svgTy.dimStackTop - idx * svgTy.dimStackStep}
            svgTy={svgTy}
          />
        );
      })}
      {lefts.map((s) => {
        const idx = nextLeft(+s.x1.toFixed(3));
        const xDim = s.x1 - svgTy.sideOffset - idx * svgTy.sideStep;
        return (
          <ArchDimVerticalSegment
            key={s.id}
            xRef={s.x1}
            xDim={xDim}
            y1={s.y1}
            y2={s.y2}
            spanM={s.length}
            svgTy={svgTy}
          />
        );
      })}
      {rights.map((s) => {
        const idx = nextRight(+s.x1.toFixed(3));
        const xDim = s.x1 + svgTy.sideOffset + idx * svgTy.sideStep;
        return (
          <ArchDimVerticalSegmentRight
            key={s.id}
            xRef={s.x1}
            xDim={xDim}
            y1={s.y1}
            y2={s.y2}
            spanM={s.length}
            svgTy={svgTy}
          />
        );
      })}
      {encLabels}
    </g>
  );
}

/**
 * Paso Estructura: apoyos (líneas violetas), chip fuera del techo, puntos de fijación (tooltip BOM).
 * Las cotas rojas globales van en `EstructuraGlobalExteriorOverlay` (perímetro libre + encuentros).
 */
function EstructuraZonaOverlay({ r, hints, svgTy }) {
  if (!hints) return null;
  const nAp = hints.apoyos;
  const zm = svgTy?.m ?? 1;
  const supportLines = [];
  if (Number.isFinite(nAp) && nAp >= 2 && r.h > 1e-6) {
    const n = Math.min(32, Math.round(nAp));
    for (let i = 0; i < n; i++) {
      const yy = r.y + (i / (n - 1)) * r.h;
      supportLines.push(
        <line
          key={`est-ap-${r.gi}-${i}`}
          x1={r.x}
          y1={yy}
          x2={r.x + r.w}
          y2={yy}
          stroke="#7c3aed"
          strokeWidth={0.048 * zm}
          strokeDasharray={`${0.16 * zm} ${0.1 * zm}`}
          opacity={0.88}
          pointerEvents="none"
        />,
      );
    }
  }

  const apTxt =
    Number.isFinite(nAp) && nAp >= 1
      ? `${Math.round(nAp)} apoyo${Math.round(nAp) === 1 ? "" : "s"}`
      : "Apoyos N/D";
  const fijTxt =
    Number.isFinite(hints.puntosFijacion) && hints.puntosFijacion >= 0
      ? `${Math.round(hints.puntosFijacion)} pts fij.`
      : "";

  const chipW = Math.min(Math.max(r.w * 0.88, 1.1), 2.4);
  const chipH = (fijTxt ? 0.4 : 0.28) * zm;
  const chipX = r.x + (r.w - chipW) / 2;
  const chipY = r.y - chipH - 0.14 * zm;
  const chipFs = Math.max(0.11 * zm, Math.min(0.16 * zm, chipW * 0.072 * zm));

  const sysLabel =
    hints.fijacionSistema === "caballete"
      ? "Sistema caballete / tornillo aguja (presupuesto)"
      : "Sistema varilla/tuerca (presupuesto)";
  const lines = hints.fijacionProductLines?.length
    ? hints.fijacionProductLines.join("\n")
    : "Sin líneas de fijación en el BOM para esta zona.";
  const dotTitle = `${sysLabel}\nCada punto ≈ 1 punto de fijación del cómputo (${Math.round(Number(hints.puntosFijacion) || 0)} total).\n\n${lines}`;

  const dotPts = fijacionDotsLayout(r, hints);

  return (
    <g data-bmc-layer="estructura-overlay">
      <g pointerEvents="none">{supportLines}</g>
      <g pointerEvents="none">
        <rect
          x={chipX}
          y={chipY}
          width={chipW}
          height={chipH}
          rx={0.07 * zm}
          fill="rgba(255,255,255,0.96)"
          stroke="#7c3aed"
          strokeWidth={0.03 * zm}
        />
        <text
          x={chipX + chipW / 2}
          y={chipY + chipFs * 1.25}
          textAnchor="middle"
          fontSize={chipFs}
          fill="#5b21b6"
          fontWeight={700}
          fontFamily={FONT}
        >
          {apTxt}
        </text>
        {fijTxt ? (
          <text
            x={chipX + chipW / 2}
            y={chipY + chipFs * 2.45}
            textAnchor="middle"
            fontSize={chipFs * 0.9}
            fill={C.tp}
            fontWeight={600}
            fontFamily={FONT}
          >
            {fijTxt}
          </text>
        ) : null}
      </g>
      <g pointerEvents="auto">
        {dotPts.map((d) => (
          <g key={`fij-dot-${r.gi}-${d.key}`}>
            <circle
              cx={d.cx}
              cy={d.cy}
              r={0.052 * zm}
              fill="#0f172a"
              stroke="#ffffff"
              strokeWidth={0.024 * zm}
              opacity={0.92}
              style={{ cursor: "help" }}
            >
              <title>{dotTitle}</title>
            </circle>
          </g>
        ))}
      </g>
    </g>
  );
}

function getEncounterConfigFromZonas(zonas, ga, gb) {
  const pk = encounterPairKey(ga, gb);
  const low = Math.min(ga, gb);
  const raw = zonas[low]?.preview?.encounterByPair?.[pk];
  return normalizeEncounter(raw);
}

/**
 * Vista en planta alineada al motor de cálculo: el **largo** del panel sigue el **largo** del techo
 * (arista lateral del rectángulo = `h` en SVG); el **ancho útil au** se repite a lo largo del **ancho** en planta (`w`),
 * es decir la dirección frente↔fondo en convención “paneles en fila”. Franjas alternadas = columnas de ancho au;
 * juntas = líneas verticales.
 */
function PanelRoofVisualization({ x0, y0, w, h, au, stroke, strokeW, gradKey = "0" }) {
  if (!(au > 0) || !(w > 0) || !(h > 0)) return null;
  const strips = buildAnchoStripsPlanta(w, au);
  const bands = strips.map((s) => (
    <rect
      key={`band-${s.idx}`}
      x={x0 + s.x0}
      y={y0}
      width={s.width}
      height={h}
      fill={stroke}
      fillOpacity={s.idx % 2 === 0 ? 0.1 : 0.18}
      stroke="none"
      pointerEvents="none"
    />
  ));
  const lines = [];
  let jointX = x0;
  for (let i = 0; i < strips.length - 1; i++) {
    jointX += strips[i].width;
    lines.push(
      <line
        key={`vj-${i}`}
        x1={jointX}
        y1={y0}
        x2={jointX}
        y2={y0 + h}
        stroke={stroke}
        strokeWidth={strokeW}
        opacity={0.55}
        pointerEvents="none"
      />,
    );
  }
  const gradId = `roofGrad-${String(gradKey).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.06" />
          <stop offset="50%" stopColor={C.primary} stopOpacity="0.04" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <rect x={x0} y={y0} width={w} height={h} fill={`url(#${gradId})`} rx={0.08} />
      {bands}
      {lines}
    </g>
  );
}

function SlopeArrow({ cx, cy, h, dir, scaleM = 1 }) {
  const half = Math.min(h * 0.22, 0.9);
  const yTip = dir === "along_largo_pos" ? cy + half : cy - half;
  const yTail = dir === "along_largo_pos" ? cy - half : cy + half;
  const tipW = Math.min(h * 0.12, 0.35);
  const col = C.danger;
  const sw = 0.05 * scaleM;
  return (
    <g pointerEvents="none" stroke={col} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill={col}>
      <line x1={cx} y1={yTail} x2={cx} y2={yTip - (dir === "along_largo_pos" ? tipW : -tipW)} />
      <polygon
        points={
          dir === "along_largo_pos"
            ? `${cx},${yTip} ${cx - tipW * 0.55},${yTip - tipW} ${cx + tipW * 0.55},${yTip - tipW}`
            : `${cx},${yTip} ${cx - tipW * 0.55},${yTip + tipW} ${cx + tipW * 0.55},${yTip + tipW}`
        }
        opacity={0.95}
      />
    </g>
  );
}

/**
 * Bloque de métricas (m², L/A zona, desglose, planta/encuentros) reutilizable en columna del wizard o junto al SVG.
 */
export function RoofPreviewMetricsSidebar({
  zonas = [],
  tipoAguas = "una_agua",
  pendiente = 0,
  selectedGi = null,
  onZonaDimensionPatch,
  /** Métricas bajo el wizard (columna izquierda): ancho completo y tipografía un poco mayor */
  compact = false,
  /** Cuando va junto a `RoofPreview` en fila y el padre ya define `flex` */
  noRootFlex = false,
  /** Paso Estructura / overlay: resalta cifras como en la fila embebida previa */
  emphasize = false,
}) {
  const { planEdges, layout } = useRoofPreviewPlanLayout(zonas, tipoAguas);
  const fp = calcFactorPendiente(pendiente);
  const headFs = compact ? 16 : emphasize ? 14 : 13;
  const headStrong = compact ? 18 : emphasize ? 17 : 15;
  const rootFs = compact ? 13 : emphasize ? 12.5 : undefined;
  return (
    <div
      data-bmc-view="roof-preview-metrics-sidebar"
      style={{
        minWidth: 0,
        flex: noRootFlex || compact ? undefined : "1 1 200px",
        width: compact || noRootFlex ? "100%" : undefined,
        fontSize: rootFs,
        marginTop: compact ? 12 : 0,
      }}
    >
      <div style={{ fontSize: headFs, fontWeight: 600, color: C.tp }}>
        <strong style={{ fontSize: headStrong }}>{layout.totalArea.toFixed(1)} m²</strong>
        <span style={{ fontWeight: 500, color: C.ts }}> total</span>
      </div>
      {typeof onZonaDimensionPatch === "function" && selectedGi != null && zonas[selectedGi] && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.surface,
            fontSize: 11,
            color: C.ts,
          }}
        >
          <div style={{ fontWeight: 700, color: C.tp, marginBottom: 8 }}>
            Zona {formatZonaDisplayTitle(zonas, selectedGi)}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 72 }}>Largo (m)</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={zonas[selectedGi].largo ?? 0}
              onChange={(ev) => {
                const v = Number(ev.target.value);
                if (!Number.isFinite(v)) return;
                onZonaDimensionPatch(selectedGi, { largo: v });
              }}
              style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 72 }}>Ancho (m)</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={zonas[selectedGi].ancho ?? 0}
              onChange={(ev) => {
                const v = Number(ev.target.value);
                if (!Number.isFinite(v)) return;
                onZonaDimensionPatch(selectedGi, { ancho: v });
              }}
              style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }}
            />
          </label>
        </div>
      )}
      {layout.entries.length > 0 && (
        <div
          style={{
            fontSize: 11,
            color: C.ts,
            marginTop: 8,
            lineHeight: 1.45,
            padding: "8px 10px",
            background: C.surface,
            borderRadius: 8,
            border: `1px solid ${C.border}`,
          }}
          aria-label="Desglose de superficie por zona"
        >
          <div
            style={{
              fontWeight: 600,
              color: C.tp,
              marginBottom: 4,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Por superficie / extensión
          </div>
          {layout.entries.map((r) => {
            const a = r.z.largo * r.z.ancho;
            const label = formatZonaDisplayTitle(zonas, r.gi);
            return (
              <div key={r.gi} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                <span style={{ color: C.ts }}>
                  {label}
                  <span style={{ fontSize: 10, display: "block", fontWeight: 500, marginTop: 2 }}>{zonaLabelPlanta(r)} en planta</span>
                </span>
                <strong style={{ color: C.tp, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{a.toFixed(1)} m²</strong>
              </div>
            );
          })}
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: `1px dashed ${C.border}`,
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              fontWeight: 700,
              color: C.tp,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span>Suma tramos</span>
            <span>{layout.entries.reduce((s, r) => s + r.z.largo * r.z.ancho, 0).toFixed(1)} m²</span>
          </div>
          {planEdges && planEdges.rects.length > 0 && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: `1px dashed ${C.border}`,
                fontSize: 10,
                color: C.ts,
                lineHeight: 1.45,
              }}
              aria-label="Perímetro en planta y encuentros entre zonas"
            >
              <div
                style={{
                  fontWeight: 600,
                  color: C.tp,
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Planta (encuentros)
              </div>
              <div>
                Perímetro exterior (estim.):{" "}
                <strong style={{ color: C.tp, fontVariantNumeric: "tabular-nums" }}>{planEdges.totals.exteriorLength} m</strong>
              </div>
              <div style={{ marginTop: 2 }}>
                Encuentros: <strong style={{ color: C.tp }}>{planEdges.encounters.length}</strong> tramo
                {planEdges.encounters.length === 1 ? "" : "s"} ·{" "}
                <strong style={{ color: C.tp, fontVariantNumeric: "tabular-nums" }}>{planEdges.totals.encounterLength} m</strong>{" "}
                compartido
              </div>
              <div style={{ marginTop: 6, fontSize: 9, opacity: 0.92 }}>
                Perímetro y encuentros alimentan accesorios (una agua, multizona) vía geometría de planta y tipo de encuentro.
              </div>
            </div>
          )}
        </div>
      )}
      {pendiente > 0 && (
        <div style={{ fontSize: 11, color: C.ts, marginTop: 8 }}>Largo real (pendiente): ×{fp.toFixed(2)}</div>
      )}
    </div>
  );
}

/**
 * Vista previa 2D del techo en planta (rejilla, arrastre, encuentros).
 * @param {Record<number, object>|null} [props.estructuraHintsByGi] - overlay Estructura (cotas, apoyos, fijaciones)
 * @param {boolean} [props.embedMetricsSidebar] - false = sin columna de métricas (mostrar `RoofPreviewMetricsSidebar` en el wizard)
 * @param {number|null} [props.selectedZonaGi] - zona seleccionada si `embedMetricsSidebar` es false
 * @param {(gi: number|null) => void} [props.onSelectedZonaGiChange] - al elegir zona en el SVG (con métricas externas)
 */
export default function RoofPreview({
  zonas = [],
  tipoAguas = "una_agua",
  pendiente = 0,
  panelAu = 1.12,
  onZonaPreviewChange,
  onResetLayout,
  onAnnexRankSwap,
  onAddZona,
  onEncounterPairChange,
  onZonaDimensionPatch,
  estructuraHintsByGi = null,
  embedMetricsSidebar = true,
  selectedZonaGi: selectedZonaGiProp,
  onSelectedZonaGiChange,
}) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const tapRef = useRef(null);
  const [dragOverlay, setDragOverlay] = useState(null);
  const [encounterPrompt, setEncounterPrompt] = useState(null);
  const [internalSelectedGi, setInternalSelectedGi] = useState(null);
  const [undoStack, setUndoStack] = useState([]);

  const metricsExternal = embedMetricsSidebar === false && typeof onSelectedZonaGiChange === "function";
  const selectedGi = metricsExternal ? (selectedZonaGiProp ?? null) : internalSelectedGi;
  const setSelectedGi = useCallback(
    (gi) => {
      if (metricsExternal) onSelectedZonaGiChange(gi);
      else setInternalSelectedGi(gi);
    },
    [metricsExternal, onSelectedZonaGiChange],
  );

  const { planEdges, layout } = useRoofPreviewPlanLayout(zonas, tipoAguas);

  const svgTy = useMemo(() => buildRoofPlanSvgTypography(layout.viewMetrics), [layout.viewMetrics]);

  /** Espacio extra para cotas exteriores + chip (solo paso Estructura). */
  const svgViewBox = useMemo(() => {
    if (!layout.viewMetrics) return layout.viewBox;
    if (estructuraHintsByGi == null || layout.entries.length === 0) return layout.viewBox;
    const { vbX, vbY, vbW, vbH } = layout.viewMetrics;
    const ext = planEdges?.exterior ?? [];
    const nSide = (side) => Math.min(8, ext.filter((s) => s.side === side).length);
    const m = svgTy.m;
    const padL = (1.05 + nSide("left") * 0.14) * m;
    const padT = (0.55 + nSide("top") * 0.14) * m;
    const padB = (0.68 + nSide("bottom") * 0.14) * m;
    const padR = (0.45 + nSide("right") * 0.14) * m;
    return `${vbX - padL} ${vbY - padT} ${vbW + padL + padR} ${vbH + padT + padB}`;
  }, [layout.viewBox, layout.viewMetrics, layout.entries.length, estructuraHintsByGi, planEdges?.exterior, svgTy.m]);

  const encounters = planEdges?.encounters ?? [];

  const cycleSlope = useCallback(
    (gi) => {
      const z = zonas[gi];
      if (!z) return;
      const next = nextRoofSlopeMark(z.preview?.slopeMark);
      onZonaPreviewChange?.(gi, { slopeMark: next });
    },
    [onZonaPreviewChange, zonas],
  );

  const applyUndo = useCallback(() => {
    setUndoStack((s) => {
      if (!s.length) return s;
      const prev = s[s.length - 1];
      for (const k of Object.keys(prev)) {
        const gi = Number(k);
        const pos = prev[k];
        if (Number.isFinite(pos?.x) && Number.isFinite(pos?.y)) {
          onZonaPreviewChange?.(gi, { x: pos.x, y: pos.y });
        }
      }
      return s.slice(0, -1);
    });
  }, [onZonaPreviewChange]);

  const annexHitStop = useCallback((e) => {
    e.stopPropagation();
  }, []);

  const handlePointerDown = useCallback(
    (e, gi, rect) => {
      if (!onZonaPreviewChange) return;
      if (e.button != null && e.button !== 0) return;
      const svg = svgRef.current;
      if (!svg) return;
      svg.setPointerCapture(e.pointerId);
      const p = clientToSvg(svg, e.clientX, e.clientY);
      setSelectedGi(gi);
      const snap = {};
      for (let i = 0; i < zonas.length; i++) {
        const px = zonas[i]?.preview?.x;
        const py = zonas[i]?.preview?.y;
        if (Number.isFinite(px) && Number.isFinite(py)) snap[i] = { x: px, y: py };
      }
      dragRef.current = {
        gi,
        pointerId: e.pointerId,
        pointerStartX: p.x,
        pointerStartY: p.y,
        rectStartX: rect.x,
        rectStartY: rect.y,
        rectW: rect.w,
        rectH: rect.h,
        clientSX: e.clientX,
        clientSY: e.clientY,
        moved: false,
        lastX: rect.x,
        lastY: rect.y,
        startSnapshot: snap,
        snapshotSaved: false,
      };
    },
    [onZonaPreviewChange, zonas, setSelectedGi],
  );

  const handlePointerMove = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = e.clientX - d.clientSX;
      const dy = e.clientY - d.clientSY;
      if (dx * dx + dy * dy > 64) d.moved = true;
      const svg = svgRef.current;
      if (!svg) return;
      if (d.moved && !d.snapshotSaved && d.startSnapshot && Object.keys(d.startSnapshot).length) {
        d.snapshotSaved = true;
        setUndoStack((s) => [...s.slice(-4), d.startSnapshot]);
      }
      const p = clientToSvg(svg, e.clientX, e.clientY);
      const zDrag = zonas[d.gi];

      const rawX = d.rectStartX + (p.x - d.pointerStartX) * DRAG_SENSITIVITY;
      const rawY = d.rectStartY + (p.y - d.pointerStartY) * DRAG_SENSITIVITY;
      const sn = snapDragRect(rawX, rawY, d.rectW, d.rectH, d.gi, layout.entries, SNAP_ZONE_M);
      const vm = layout.viewMetrics;
      const { x, y } = clampZonaTopLeft(sn.x, sn.y, d.rectW, d.rectH, vm);

      const patch = { x, y };
      if (isLateralAnnexZona(zDrag)) {
        const parentGi = Number(zDrag?.preview?.attachParentGi);
        const parentR = layout.entries.find((er) => er.gi === parentGi);
        if (parentR) {
          const mid = parentR.x + parentR.w / 2;
          patch.lateralSide = x + d.rectW / 2 < mid ? "izq" : "der";
          patch.lateralManual = true;
        }
      }

      d.lastX = x;
      d.lastY = y;
      setDragOverlay({
        gi: d.gi,
        snappedX: sn.snappedX,
        snappedY: sn.snappedY,
        guides: alignmentGuidesForRect(x, y, d.rectW, d.rectH, d.gi, layout.entries, SNAP_ZONE_M),
      });
      onZonaPreviewChange?.(d.gi, patch);
    },
    [onZonaPreviewChange, layout.entries, layout.viewMetrics, zonas],
  );

  const handlePointerUp = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const svg = svgRef.current;
      try {
        svg?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      setDragOverlay(null);
      // Doble toque (touch) o doble clic (mouse/lápiz) sin arrastre: mismo criterio que vista 3D.
      if (!d.moved && (e.pointerType === "touch" || e.pointerType === "mouse" || e.pointerType === "pen")) {
        const now = Date.now();
        const prev = tapRef.current;
        const winMs = e.pointerType === "touch" ? 320 : 450;
        const thresh = e.pointerType === "touch" ? 28 : 14;
        if (prev && prev.gi === d.gi && now - prev.t < winMs) {
          const pdx = e.clientX - prev.x;
          const pdy = e.clientY - prev.y;
          if (pdx * pdx + pdy * pdy < thresh * thresh) {
            cycleSlope(d.gi);
            tapRef.current = null;
          } else {
            tapRef.current = { t: now, gi: d.gi, x: e.clientX, y: e.clientY };
          }
        } else {
          tapRef.current = { t: now, gi: d.gi, x: e.clientX, y: e.clientY };
        }
      }
      if (d.moved && onEncounterPairChange && layout.entries.length > 1) {
        try {
          const encs = findEncounters(layout.entries);
          const missing = encs.filter((enc) => {
            const [a, b] = enc.zoneIndices;
            const pk = encounterPairKey(a, b);
            const low = Math.min(a, b);
            return zonas[low]?.preview?.encounterByPair?.[pk] == null;
          });
          if (missing.length) {
            const [a, b] = missing[0].zoneIndices;
            setEncounterPrompt({ pairKey: encounterPairKey(a, b), ga: a, gb: b });
          }
        } catch {
          /* ignore */
        }
      }
      dragRef.current = null;
    },
    [cycleSlope, onEncounterPairChange, zonas, layout.entries],
  );

  const handleLostCapture = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div
      data-bmc-view="roof-preview-2d"
      data-bmc-component="RoofPreview"
      title="Vista previa 2D techo (planta, rejilla au)"
      style={{
        padding: 16,
        background: C.surfaceAlt,
        borderRadius: 12,
        marginBottom: 12,
        border: `1px solid ${C.border}`,
        userSelect: "none",
        touchAction: "none",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: C.tp,
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span>Vista previa del techo</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {onAddZona && (
            <button
              type="button"
              onClick={onAddZona}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: C.tp,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              Otro cuerpo de techo
            </button>
          )}
          {onResetLayout && layout.entries.length > 0 && (
            <button
              type="button"
              onClick={onResetLayout}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: C.primary,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              Alinear zonas
            </button>
          )}
          {undoStack.length > 0 && onZonaPreviewChange && (
            <button
              type="button"
              onClick={applyUndo}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: C.tp,
                background: C.surfaceAlt,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              Deshacer
            </button>
          )}
        </div>
      </div>
      {estructuraHintsByGi != null && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: C.ts,
            marginTop: -4,
            marginBottom: 8,
            lineHeight: 1.35,
          }}
        >
          <strong style={{ color: C.tp }}>Estructura:</strong> líneas violetas = ejes de apoyo (cantidad según autoportancia);
          cotas rojas = solo perímetro libre y longitud en cada encuentro; chip = puntos de fijación (mismo criterio que el presupuesto).
        </div>
      )}
      {encounterPrompt && onEncounterPairChange && (
        <div
          style={{
            marginBottom: 10,
            padding: 12,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.surface,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: C.tp, marginRight: 4 }}>
            Encuentro zonas {encounterPrompt.pairKey}
          </span>
          <button
            type="button"
            onClick={() => {
              onEncounterPairChange(encounterPrompt.pairKey, { tipo: "continuo", modo: "continuo" });
              setEncounterPrompt(null);
            }}
            style={{ fontSize: 11, fontWeight: 600, padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#ecfdf5", color: "#166534", cursor: "pointer" }}
          >
            Continuo
          </button>
          <button
            type="button"
            onClick={() => {
              onEncounterPairChange(encounterPrompt.pairKey, { tipo: "perfil", modo: "pretil", perfil: "pretil" });
              setEncounterPrompt(null);
            }}
            style={{ fontSize: 11, fontWeight: 600, padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff7ed", color: "#9a3412", cursor: "pointer" }}
          >
            Pretil
          </button>
          <button
            type="button"
            onClick={() => {
              onEncounterPairChange(encounterPrompt.pairKey, { tipo: "perfil", modo: "cumbrera", perfil: "cumbrera", cumbreraUnida: true });
              setEncounterPrompt(null);
            }}
            style={{ fontSize: 11, fontWeight: 600, padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#eff6ff", color: "#1d4ed8", cursor: "pointer" }}
          >
            Cumbrera
          </button>
          <button
            type="button"
            onClick={() => {
              onEncounterPairChange(encounterPrompt.pairKey, { tipo: "perfil", modo: "desnivel", perfil: "pretil", desnivel: { perfilBajo: "pretil", perfilAlto: "cumbrera" } });
              setEncounterPrompt(null);
            }}
            style={{ fontSize: 11, fontWeight: 600, padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fef2f2", color: "#b91c1c", cursor: "pointer" }}
          >
            Desnivel
          </button>
          <button
            type="button"
            onClick={() => {
              onEncounterPairChange(encounterPrompt.pairKey, null);
              setEncounterPrompt(null);
            }}
            style={{ fontSize: 11, fontWeight: 600, padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surfaceAlt, color: C.ts, cursor: "pointer" }}
          >
            Desconectar (exterior)
          </button>
          <button
            type="button"
            onClick={() => setEncounterPrompt(null)}
            style={{ fontSize: 11, fontWeight: 600, padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.tp, cursor: "pointer", marginLeft: "auto" }}
          >
            Cerrar
          </button>
        </div>
      )}
      <CollapsibleHint title="Zonas del techo" style={{ marginBottom: 10 }}>
        Cada rectángulo es una zona: arrastrá con libertad en planta; se imantan aristas (L / T / U) y aparecen guías punteadas.
        Al tocar un encuentro nuevo, elegí tipo (continuo, pretil, cumbrera, desnivel); tocá la línea del encuentro para reabrir.
        Doble clic en la superficie: pendiente visual. <strong style={{ color: C.tp }}>+ Otra medida</strong> en cada tarjeta
        suma tramo lateral (mismo cuerpo). <strong style={{ color: C.tp }}>Otro cuerpo de techo</strong> aquí arriba suma una zona
        independiente en planta.
      </CollapsibleHint>
      <div style={{ display: "flex", alignItems: "stretch", gap: 20, flexWrap: "wrap" }}>
        {layout.entries.length === 0 ? (
          <div
            style={{
              flex: 1,
              minWidth: 180,
              minHeight: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: C.surface,
              borderRadius: 10,
              color: C.ts,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Ingrese dimensiones
          </div>
        ) : (
          <div
            style={{
              flex: embedMetricsSidebar
                ? estructuraHintsByGi != null
                  ? "2 1 300px"
                  : "1 1 280px"
                : "1 1 100%",
              width: "100%",
              minWidth: 200,
              maxWidth: "100%",
              height:
                estructuraHintsByGi != null
                  ? "clamp(min(360px, 72vw), min(62vh, 820px), 920px)"
                  : "clamp(240px, min(48vh, 520px), 560px)",
              minHeight: estructuraHintsByGi != null ? 300 : 240,
              flexShrink: 0,
              order: embedMetricsSidebar ? 1 : undefined,
            }}
          >
            <svg
              ref={svgRef}
              viewBox={svgViewBox}
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid meet"
              style={{
                display: "block",
                cursor: onZonaPreviewChange ? "default" : undefined,
              }}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handleLostCapture}
              onLostPointerCapture={handleLostCapture}
            >
            {layout.viewMetrics && dragOverlay?.guides && (
              <g pointerEvents="none" opacity={0.55}>
                {dragOverlay.guides.vx.map((xv) => (
                  <line
                    key={`vg-${xv}`}
                    x1={xv}
                    x2={xv}
                    y1={layout.viewMetrics.vbY}
                    y2={layout.viewMetrics.vbY + layout.viewMetrics.vbH}
                    stroke="#64748b"
                    strokeWidth={0.035 * svgTy.m}
                    strokeDasharray={`${0.12 * svgTy.m} ${0.08 * svgTy.m}`}
                  />
                ))}
                {dragOverlay.guides.hy.map((yv) => (
                  <line
                    key={`hg-${yv}`}
                    x1={layout.viewMetrics.vbX}
                    x2={layout.viewMetrics.vbX + layout.viewMetrics.vbW}
                    y1={yv}
                    y2={yv}
                    stroke="#64748b"
                    strokeWidth={0.035 * svgTy.m}
                    strokeDasharray={`${0.12 * svgTy.m} ${0.08 * svgTy.m}`}
                  />
                ))}
              </g>
            )}
            {encounters.map((enc) => {
              const [ga, gb] = enc.zoneIndices;
              const cfg = getEncounterConfigFromZonas(zonas, ga, gb);
              const stroke = encounterStrokeForModo(cfg.modo);
              return (
                <line
                  key={enc.id}
                  x1={enc.x1}
                  y1={enc.y1}
                  x2={enc.x2}
                  y2={enc.y2}
                  stroke={stroke}
                  strokeWidth={0.09 * svgTy.m}
                  strokeDasharray={`${0.16 * svgTy.m} ${0.1 * svgTy.m}`}
                  pointerEvents="stroke"
                  opacity={0.95}
                  style={{ cursor: onEncounterPairChange ? "pointer" : undefined }}
                  onPointerDown={(ev) => {
                    if (!onEncounterPairChange) return;
                    ev.stopPropagation();
                    setEncounterPrompt({ pairKey: encounterPairKey(ga, gb), ga, gb });
                  }}
                />
              );
            })}
            {layout.entries.map((r) => {
              const sm = r.z.preview?.slopeMark;
              const showSlope = sm === "along_largo_pos" || sm === "along_largo_neg";
              const zm = svgTy.m;
              const fs = Math.max(0.2 * zm, Math.min(0.38 * zm, r.w * 0.125 * Math.min(zm, 1.2)));
              const annex = isLateralAnnexZona(r.z);
              const canDrag = Boolean(onZonaPreviewChange);
              const supV = suppressSharedVerticalStroke(r, layout.entries, zonas);
              const showAnnexCtl = annex && onAnnexRankSwap;
              return (
                <g key={r.gi}>
                  <rect
                    x={r.x}
                    y={r.y}
                    width={r.w}
                    height={r.h}
                    rx={0.12}
                    fill={C.primary}
                    fillOpacity={selectedGi === r.gi ? 0.12 : 0.08}
                    stroke="none"
                    style={{ cursor: canDrag ? "grab" : "default" }}
                    onPointerDown={(e) => handlePointerDown(e, r.gi, r)}
                  />
                  {dragOverlay?.gi === r.gi && (dragOverlay.snappedX || dragOverlay.snappedY) && (
                    <rect
                      x={r.x}
                      y={r.y}
                      width={r.w}
                      height={r.h}
                      rx={0.14}
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth={0.09 * svgTy.m}
                      opacity={0.9}
                      pointerEvents="none"
                    />
                  )}
                  <PanelRoofVisualization
                    x0={r.x}
                    y0={r.y}
                    w={r.w}
                    h={r.h}
                    au={panelAu}
                    stroke={C.brand}
                    strokeW={0.032 * svgTy.m}
                    gradKey={`z-${r.gi}`}
                  />
                  <g
                    pointerEvents="none"
                    stroke={C.primary}
                    strokeWidth={0.072 * svgTy.m}
                    fill="none"
                    strokeLinecap="square"
                    opacity={0.92}
                  >
                    <line x1={r.x} y1={r.y} x2={r.x + r.w} y2={r.y} />
                    <line x1={r.x} y1={r.y + r.h} x2={r.x + r.w} y2={r.y + r.h} />
                    {!supV.left && <line x1={r.x} y1={r.y} x2={r.x} y2={r.y + r.h} />}
                    {!supV.right && <line x1={r.x + r.w} y1={r.y} x2={r.x + r.w} y2={r.y + r.h} />}
                  </g>
                  {estructuraHintsByGi != null && estructuraHintsByGi[r.gi] ? (
                    <EstructuraZonaOverlay r={r} hints={estructuraHintsByGi[r.gi]} svgTy={svgTy} />
                  ) : null}
                  {!(estructuraHintsByGi != null && estructuraHintsByGi[r.gi]) ? (
                    <g pointerEvents="none">
                      <text
                        x={r.x + r.w / 2}
                        y={r.y + r.h / 2 - fs * 0.35}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={fs}
                        fill={C.primary}
                        fontWeight={600}
                        fontFamily={FONT}
                      >
                        {zonaLabelPlanta(r)}
                      </text>
                      <text
                        x={r.x + r.w / 2}
                        y={r.y + r.h / 2 + fs * 0.55}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={Math.max(0.13 * zm, fs * 0.44)}
                        fill={C.ts}
                        fontWeight={600}
                        fontFamily={FONT}
                      >
                        {panelCountAcrossAnchoPlanta(r.w, panelAu)}{" "}
                        {panelCountAcrossAnchoPlanta(r.w, panelAu) === 1 ? "panel" : "paneles"}
                      </text>
                    </g>
                  ) : null}
                  {showSlope && (
                    <SlopeArrow
                      cx={r.x + r.w * 0.82}
                      cy={r.y + r.h / 2}
                      h={r.h}
                      dir={sm}
                      scaleM={svgTy.m}
                    />
                  )}
                  {showAnnexCtl && (
                    <g pointerEvents="auto">
                      <rect
                        x={r.x + r.w * 0.2}
                        y={r.y + r.h + 0.06}
                        width={r.w * 0.22}
                        height={0.22}
                        rx={0.05}
                        fill="rgba(255,255,255,0.92)"
                        stroke={C.border}
                        strokeWidth={0.025}
                        style={{ cursor: "pointer" }}
                        onPointerDown={annexHitStop}
                        onPointerUp={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onAnnexRankSwap(r.gi, -1);
                        }}
                      />
                      <text
                        x={r.x + r.w * 0.31}
                        y={r.y + r.h + 0.2}
                        textAnchor="middle"
                        fontSize={0.12}
                        fontWeight={700}
                        fill={C.tp}
                        pointerEvents="none"
                        fontFamily={FONT}
                      >
                        «
                      </text>
                      <rect
                        x={r.x + r.w * 0.58}
                        y={r.y + r.h + 0.06}
                        width={r.w * 0.22}
                        height={0.22}
                        rx={0.05}
                        fill="rgba(255,255,255,0.92)"
                        stroke={C.border}
                        strokeWidth={0.025}
                        style={{ cursor: "pointer" }}
                        onPointerDown={annexHitStop}
                        onPointerUp={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onAnnexRankSwap(r.gi, 1);
                        }}
                      />
                      <text
                        x={r.x + r.w * 0.69}
                        y={r.y + r.h + 0.2}
                        textAnchor="middle"
                        fontSize={0.12}
                        fontWeight={700}
                        fill={C.tp}
                        pointerEvents="none"
                        fontFamily={FONT}
                      >
                        »
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
            {estructuraHintsByGi != null && planEdges?.exterior?.length ? (
              <EstructuraGlobalExteriorOverlay
                exterior={planEdges.exterior}
                encounters={planEdges.encounters ?? []}
                svgTy={svgTy}
              />
            ) : null}
            </svg>
          </div>
        )}
        {embedMetricsSidebar ? (
          <div
            style={{
              minWidth: 0,
              flex: estructuraHintsByGi != null ? "1 1 200px" : "1 1 160px",
              order: 2,
            }}
          >
            <RoofPreviewMetricsSidebar
              zonas={zonas}
              tipoAguas={tipoAguas}
              pendiente={pendiente}
              selectedGi={selectedGi}
              onZonaDimensionPatch={onZonaDimensionPatch}
              emphasize={estructuraHintsByGi != null}
              noRootFlex
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
