// ═══════════════════════════════════════════════════════════════════════════
// RoofPreview.jsx — Vista previa del techo (rejilla de paneles, drag, pendiente)
// Coordenadas del SVG en metros (planta). preview.x/y alimenta encuentros y (con geometría) el BOM;
// buildRoofPlanEdges muestra perímetro/encuentros. Cotas: `roofPlan/RoofPlanDimensions.jsx`, `utils/roofPlanSvgTypography.js`, `utils/roofPlanDrawingTheme.js`.
// Rejilla en planta: largo del panel = largo del techo (h en SVG);
// cantidad de paneles reparte el ancho en planta (w) cada au → columnas verticales / juntas verticales (alineado a calcPanelesTecho).
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { buildRoofPlanSvgTypography } from "../utils/roofPlanSvgTypography.js";
import { EstructuraGlobalExteriorOverlay } from "./roofPlan/RoofPlanDimensions.jsx";

/** ViewBox slack: `useRoofPreviewPlanLayout.js` (`viewBoxSlackMeters`, proporcional al plano). */
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

/**
 * Posición Y de una fila de fijación en planta: filas **perimetrales** (1.ª y última) se desplazan **hacia adentro**
 * del rectángulo del techo (~30 cm desde el borde), no sobre la línea azul del perímetro.
 */
function yForFijacionRowPlanta(r, rows, ri) {
  if (rows <= 1) return r.y + r.h / 2;
  const base = r.y + (ri / (rows - 1)) * r.h;
  const isPerimeter = ri === 0 || ri === rows - 1;
  if (!isPerimeter) return base;
  const insetNominalM = 0.3;
  const yInset = Math.min(insetNominalM, Math.max(0.04, r.h * 0.5 - 0.02));
  return ri === 0 ? base + yInset : base - yInset;
}

/**
 * Dos fijaciones en **un panel** [xL, xR] (bordes = juntas verticales): **nunca** sobre la junta.
 * Preferencia: **tercios** (misma distancia al borde izq., entre puntos y borde der.) — alineado a “equidistantes”.
 * Paneles angostos: par simétrico con margen mínimo a juntas y separación mínima entre puntos.
 */
/**
 * Alturas Y intermedias a lo largo de un tramo vertical [y1,y2] para que ningún tramo exceda ~espM (m).
 */
function yInteriorSplitsAlongVerticalEdge(y1, y2, espM) {
  const yMin = Math.min(y1, y2);
  const yMax = Math.max(y1, y2);
  const L = yMax - yMin;
  if (!(L > 0) || !(espM > 0)) return [];
  const nSeg = Math.ceil(L / espM);
  if (nSeg <= 1) return [];
  const out = [];
  for (let i = 1; i < nSeg; i++) out.push(yMin + (i * L) / nSeg);
  return out;
}

/**
 * Puntos de fijación en **laterales** de planta (`left`/`right`) sobre perímetro exterior libre,
 * alineados al cómputo `perimetroVerticalInteriorPuntosDesdePlanta` / `countExposedVerticalPerimeterFixingInteriorPointsForZona`.
 */
function fijacionDotsPerimetroVerticalExterior(r, exterior, gi, espM) {
  const dots = [];
  let key = 1_000_000;
  const inset = Math.min(0.3, Math.max(0.04, r.w * 0.11));
  const xLeft = r.x + Math.min(inset, Math.max(0.04, r.w * 0.06));
  const xRight = r.x + r.w - Math.min(inset, Math.max(0.04, r.w * 0.06));
  for (const e of exterior || []) {
    if (e.zoneIndex !== gi) continue;
    if (e.side !== "left" && e.side !== "right") continue;
    const xs = e.side === "left" ? xLeft : xRight;
    for (const cy of yInteriorSplitsAlongVerticalEdge(e.y1, e.y2, espM)) {
      dots.push({ cx: xs, cy, key: key++ });
    }
  }
  return dots;
}

function xPairFijacionPerimeterInPanel(xL, xR, insetNominalM = 0.3) {
  const w = xR - xL;
  if (!(w > 1e-9)) {
    const x = (xL + xR) / 2;
    return { xa: x, xb: x };
  }
  const minBetween = Math.max(0.045, w * 0.07);
  const minFromJoint = Math.min(insetNominalM, Math.max(0.04, w * 0.11));
  const third = w / 3;
  if (third >= minFromJoint && third >= minBetween) {
    return { xa: xL + third, xb: xL + 2 * third };
  }
  const innerL = xL + minFromJoint;
  const innerR = xR - minFromJoint;
  const innerW = innerR - innerL;
  if (innerW >= minBetween) {
    const mid = (innerL + innerR) / 2;
    const half = Math.min(innerW * 0.42, Math.max(minBetween / 2, innerW / 3));
    let xa = mid - half;
    let xb = mid + half;
    if (xb - xa < minBetween) {
      const pad = (minBetween - (xb - xa)) / 2;
      xa -= pad;
      xb += pad;
      xa = Math.max(innerL, Math.min(xa, xb - minBetween));
      xb = Math.min(innerR, Math.max(xb, xa + minBetween));
    }
    return { xa, xb };
  }
  const mid = (xL + xR) / 2;
  const eps = Math.max(0.02, w * 0.08);
  return { xa: mid - eps, xb: mid + eps };
}

/** Reparto de puntos de fijación por filas alineadas a ejes de apoyo (modo legado: reparte P en N filas). */
function fijacionDotsLayoutDistributeTotal(r, hints) {
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
  const mx = Math.min(r.w, Math.max(0.12, r.w * 0.06));
  const x0 = r.x + mx;
  const x1 = r.x + r.w - mx;
  const usableW = Math.max(1e-6, x1 - x0);
  const out = [];
  let key = 0;
  for (let ri = 0; ri < rows; ri++) {
    const nInRow = counts[ri] || 0;
    const yy = yForFijacionRowPlanta(r, rows, ri);
    for (let j = 0; j < nInRow; j++) {
      const t = nInRow === 1 ? 0.5 : (j + 1) / (nInRow + 1);
      const cx = x0 + t * usableW;
      out.push({ cx, cy: yy, key: key++ });
    }
  }
  return out;
}

/**
 * Isodec / varilla: en **perímetro** (primera y última línea de apoyo) **2** puntos por panel en **tercios** del ancho del panel
 * (equidistantes respecto de juntas y entre sí; nunca sobre juntas verticales ni bordes del panel).
 * Filas perimetrales en Y: **~30 cm hacia adentro** del borde del techo (no sobre la línea azul del perímetro).
 * En **intermedios**, **1** punto centrado en cada panel (lejos de juntas).
 */
function fijacionDotsLayoutIsodecGrid(r, hints, exterior) {
  const cantP = Math.max(1, Math.round(Number(hints.cantPaneles)) || 1);
  if (!(r.w > 0) || !(r.h > 0)) return [];
  const nAp = Number(hints.apoyos);
  const rows =
    Number.isFinite(nAp) && nAp >= 2 ? Math.min(24, Math.max(2, Math.round(nAp))) : 2;
  const panelW = r.w / cantP;
  const out = [];
  let key = 0;
  const insetNominal = 0.3;
  for (let ri = 0; ri < rows; ri++) {
    const yy = yForFijacionRowPlanta(r, rows, ri);
    const isPerimeter = ri === 0 || ri === rows - 1;
    for (let pi = 0; pi < cantP; pi++) {
      const xL = r.x + pi * panelW;
      const xR = r.x + (pi + 1) * panelW;
      if (isPerimeter) {
        const { xa, xb } = xPairFijacionPerimeterInPanel(xL, xR, insetNominal);
        out.push({ cx: xa, cy: yy, key: key++ });
        out.push({ cx: xb, cy: yy, key: key++ });
      } else {
        out.push({ cx: (xL + xR) / 2, cy: yy, key: key++ });
      }
    }
  }
  const espM = Number(hints?.fijacionEspaciadoPerimetroM) || 2.5;
  const extra =
    exterior?.length && hints?.fijacionDotsMode === "isodec_grid"
      ? fijacionDotsPerimetroVerticalExterior(r, exterior, r.gi, espM)
      : [];
  return [...out, ...extra];
}

function fijacionDotsLayout(r, hints, exterior) {
  if (!hints || !(r.w > 0) || !(r.h > 0)) return [];
  const useGrid =
    hints.fijacionSistema === "varilla_tuerca" && hints.fijacionDotsMode === "isodec_grid";
  if (useGrid) return fijacionDotsLayoutIsodecGrid(r, hints, exterior);
  const P = Math.round(Number(hints.puntosFijacion));
  if (!(P > 0)) return [];
  return fijacionDotsLayoutDistributeTotal(r, hints);
}

/** Popover fijo al viewport: productos de fijación que entran al presupuesto (BOM). */
function FijacionBomHoverPopover({ anchor, onMouseEnter, onMouseLeave, zonaLabel, sysLabel, gridExpl, productLines }) {
  if (!anchor) return null;
  const rawLeft = anchor.left;
  const rawTop = anchor.top;
  const estW = 292;
  const estH = 248;
  let left = rawLeft;
  let top = rawTop;
  if (typeof window !== "undefined") {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;
    if (left + estW > vw - pad) left = Math.max(pad, vw - estW - pad);
    if (top + estH > vh - pad) top = Math.max(pad, vh - estH - pad);
    left = Math.max(pad, left);
    top = Math.max(pad, top);
  }
  const lines = Array.isArray(productLines) ? productLines.filter(Boolean) : [];
  const body = (
    <div
      role="tooltip"
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 10060,
        maxWidth: 288,
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(255,255,255,0.98)",
        border: "1px solid #c4b5fd",
        boxShadow: "0 10px 28px rgba(15,23,42,0.14)",
        fontFamily: FONT,
        fontSize: 12,
        lineHeight: 1.45,
        color: C.tp,
        pointerEvents: "auto",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div style={{ fontWeight: 700, color: "#5b21b6", marginBottom: 6 }}>Fijación — {zonaLabel}</div>
      <div style={{ fontWeight: 600, marginBottom: 8, color: "#334155" }}>{sysLabel}</div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>{gridExpl}</div>
      <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b", marginBottom: 6 }}>
        Incluye en la cotización
      </div>
      {lines.length ? (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {lines.map((t, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              {t}
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ fontSize: 11, color: "#94a3b8" }}>Sin líneas de fijación en el BOM para esta zona.</div>
      )}
    </div>
  );
  return typeof document !== "undefined" ? createPortal(body, document.body) : null;
}

/**
 * Paso Estructura: líneas de apoyo (violetas), puntos de fijación (hover → BOM).
 * Sin cartel de texto de apoyos/pts (la info está en el panel); cotas rojas en `EstructuraGlobalExteriorOverlay`.
 */
function EstructuraZonaOverlay({ r, hints, svgTy, exterior = [] }) {
  const [fijPopAnchor, setFijPopAnchor] = useState(null);
  const hidePopTimer = useRef(null);

  const clearHideTimer = useCallback(() => {
    if (hidePopTimer.current != null) {
      window.clearTimeout(hidePopTimer.current);
      hidePopTimer.current = null;
    }
  }, []);

  const scheduleHidePopover = useCallback(() => {
    clearHideTimer();
    hidePopTimer.current = window.setTimeout(() => {
      setFijPopAnchor(null);
      hidePopTimer.current = null;
    }, 120);
  }, [clearHideTimer]);

  const showPopoverAt = useCallback(
    (e) => {
      clearHideTimer();
      const x = e.clientX + 12;
      const y = e.clientY + 12;
      setFijPopAnchor({ left: x, top: y });
    },
    [clearHideTimer],
  );

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

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

  const dotPts = fijacionDotsLayout(r, hints, exterior);

  const sysLabel =
    hints.fijacionSistema === "caballete"
      ? "Sistema caballete / tornillo aguja (presupuesto)"
      : "Sistema varilla/tuerca (presupuesto)";
  const totalFij = Math.round(Number(hints.puntosFijacion) || 0);
  const grillaFij = Math.round(Number(hints.puntosFijacionGrilla ?? hints.puntosFijacion) || 0);
  const perimV = Math.round(Number(hints.puntosFijacionPerimetroVertical) || 0);
  const gridExpl =
    hints.fijacionDotsMode === "isodec_grid"
      ? `Puntos dibujados: ${dotPts.length} (grilla en líneas de apoyo: 2/panel en perímetro en tercios del ancho, 1/panel centrado en intermedios${perimV > 0 ? `; +${perimV} en laterales de perímetro exterior (~cada ${Number(hints.fijacionEspaciadoPerimetroM) || 2.5} m en vertical)` : ""}). Total presupuesto: ${totalFij} (grilla base ${grillaFij}${perimV > 0 ? ` + lateral perím. ${perimV}` : ""}).`
      : `Cada punto ≈ 1 unidad del cómputo (${totalFij} total).`;
  const dotR = 0.032 * zm;
  const hitR = Math.max(0.048 * zm, dotR * 2.35);

  return (
    <>
    <g data-bmc-layer="estructura-overlay">
      <g pointerEvents="none">{supportLines}</g>
      <g pointerEvents="auto">
        {dotPts.map((d) => (
          <g key={`fij-dot-${r.gi}-${d.key}`}>
            <circle
              cx={d.cx}
              cy={d.cy}
              r={hitR}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={showPopoverAt}
              onMouseLeave={scheduleHidePopover}
              aria-label="Ver productos de fijación incluidos en la cotización"
            />
            <circle
              cx={d.cx}
              cy={d.cy}
              r={dotR}
              fill="#1e293b"
              stroke="#f8fafc"
              strokeWidth={0.012 * zm}
              opacity={0.9}
              pointerEvents="none"
            />
          </g>
        ))}
      </g>
    </g>
    <FijacionBomHoverPopover
      anchor={fijPopAnchor}
      onMouseEnter={clearHideTimer}
      onMouseLeave={scheduleHidePopover}
      zonaLabel={`Zona ${(typeof r.gi === "number" ? r.gi : 0) + 1}`}
      sysLabel={sysLabel}
      gridExpl={gridExpl}
      productLines={hints.fijacionProductLines}
    />
    </>
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
 * @param {Record<number, object>|null} [props.estructuraHintsByGi] - overlay Estructura (apoyos, fijaciones; requiere hints por zona)
 * @param {boolean} [props.showPlantaExteriorCotas] - cotas rojas globales (perímetro + encuentros) sin paso Estructura; p. ej. desde paso Dimensiones del wizard
 * @param {boolean} [props.embedMetricsSidebar] - false = sin columna de métricas (mostrar `RoofPreviewMetricsSidebar` en el wizard)
 * @param {number|null} [props.selectedZonaGi] - zona seleccionada si `embedMetricsSidebar` es false
 * @param {(gi: number|null) => void} [props.onSelectedZonaGiChange] - al elegir zona en el SVG (con métricas externas)
 * @param {boolean} [props.denseChrome] - true en visor embebido: menos padding y el bloque SVG crece con el host (flex + altura máxima)
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
  showPlantaExteriorCotas = false,
  embedMetricsSidebar = true,
  selectedZonaGi: selectedZonaGiProp,
  onSelectedZonaGiChange,
  denseChrome = false,
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

  /** Margen SVG y leyenda: cotas rojas (planta) y/o overlay completo Estructura. */
  const plantaCotaChromeActive = estructuraHintsByGi != null || showPlantaExteriorCotas;

  /** Espacio extra para cotas exteriores (planta / Estructura). */
  const svgViewBox = useMemo(() => {
    if (!layout.viewMetrics) return layout.viewBox;
    if (!plantaCotaChromeActive || layout.entries.length === 0) return layout.viewBox;
    const { vbX, vbY, vbW, vbH } = layout.viewMetrics;
    const ext = planEdges?.exterior ?? [];
    const nSide = (side) => Math.min(8, ext.filter((s) => s.side === side).length);
    // No usar `svgTy.m` completo: inflaba el viewBox y achicaba el techo en pantalla. Cotas siguen en coords ampliadas.
    const vbPadScale = Math.min(1.22, Math.max(1, 0.62 + 0.22 * svgTy.m));
    const padL = (1.05 + nSide("left") * 0.14) * vbPadScale;
    const padT = (0.55 + nSide("top") * 0.14) * vbPadScale;
    const padB = (0.68 + nSide("bottom") * 0.14) * vbPadScale;
    const padR = (0.45 + nSide("right") * 0.14) * vbPadScale;
    return `${vbX - padL} ${vbY - padT} ${vbW + padL + padR} ${vbH + padT + padB}`;
  }, [layout.viewBox, layout.viewMetrics, layout.entries.length, plantaCotaChromeActive, planEdges?.exterior, svgTy.m]);

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
        padding: denseChrome ? 8 : 16,
        background: C.surfaceAlt,
        borderRadius: denseChrome ? 10 : 12,
        marginBottom: denseChrome ? 0 : 12,
        border: `1px solid ${C.border}`,
        userSelect: "none",
        touchAction: "none",
        fontFamily: FONT,
        ...(denseChrome
          ? {
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
              height: "100%",
            }
          : {}),
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
      {plantaCotaChromeActive && (
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
          {estructuraHintsByGi != null ? (
            <>
              <strong style={{ color: C.tp }}>Estructura:</strong> líneas violetas = ejes de apoyo (cantidad según autoportancia);
              cotas rojas = solo perímetro libre y longitud en cada encuentro; chip = resumen apoyos/pts fij.; pasá el cursor sobre un punto para ver los productos de fijación que entran en la cotización.
            </>
          ) : (
            <>
              <strong style={{ color: C.tp }}>Planta:</strong> cotas rojas = perímetro libre y longitud en cada encuentro. Arrastrá las zonas para ubicarlas
              correctamente antes de bordes y estructura.
            </>
          )}
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
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: denseChrome ? 12 : 20,
          flexWrap: "wrap",
          ...(denseChrome ? { flex: 1, minHeight: 0 } : {}),
        }}
      >
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
                ? plantaCotaChromeActive
                  ? "2 1 300px"
                  : "1 1 280px"
                : "1 1 100%",
              width: "100%",
              minWidth: 200,
              maxWidth: "100%",
              ...(denseChrome
                ? {
                    flex: "1 1 0%",
                    minHeight: plantaCotaChromeActive ? 260 : 200,
                    height: "100%",
                  }
                : {
                    height:
                      plantaCotaChromeActive
                        ? "clamp(min(360px, 72vw), min(62vh, 820px), 920px)"
                        : "clamp(240px, min(48vh, 520px), 560px)",
                    minHeight: plantaCotaChromeActive ? 300 : 240,
                  }),
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
                    <EstructuraZonaOverlay
                      r={r}
                      hints={estructuraHintsByGi[r.gi]}
                      svgTy={svgTy}
                      exterior={planEdges?.exterior ?? []}
                    />
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
            {plantaCotaChromeActive && planEdges?.exterior?.length ? (
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
              flex: denseChrome
                ? plantaCotaChromeActive
                  ? "0 1 min(220px, 34vw)"
                  : "0 1 min(200px, 32vw)"
                : plantaCotaChromeActive
                  ? "1 1 200px"
                  : "1 1 160px",
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
