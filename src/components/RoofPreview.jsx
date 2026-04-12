// ═══════════════════════════════════════════════════════════════════════════
// RoofPreview.jsx — Vista previa del techo (rejilla de paneles, drag, pendiente)
// Coordenadas del SVG en metros (planta). preview.x/y alimenta encuentros y (con geometría) el BOM;
// buildRoofPlanEdges muestra perímetro/encuentros. Cotas: `roofPlan/RoofPlanDimensions.jsx`, `utils/roofPlanSvgTypography.js`, `utils/roofPlanDrawingTheme.js`.
// Rejilla en planta: largo del panel = largo del techo (h en SVG);
// cantidad de paneles reparte el ancho en planta (w) cada au → columnas verticales / juntas verticales (alineado a calcPanelesTecho).
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { BORDER_OPTIONS, C, FONT, PANELS_TECHO, TR } from "../data/constants.js";
import CollapsibleHint from "./CollapsibleHint.jsx";
import { calcFactorPendiente } from "../utils/calculations.js";
import { useRoofPreviewPlanLayout } from "../hooks/useRoofPreviewPlanLayout.js";
import { encounterPairKey, findEncounters, getSharedSidesPerZona } from "../utils/roofPlanGeometry.js";
import { normalizeEncounter } from "../utils/roofEncounterModel.js";
import {
  formatZonaDisplayTitle,
  getLateralAnnexRootBodyGi,
  isLateralAnnexZona,
} from "../utils/roofLateralAnnexLayout.js";
import { nextRoofSlopeMark } from "../utils/roofSlopeMark.js";
import { buildAnchoStripsPlanta, panelCountAcrossAnchoPlanta } from "../utils/roofPanelStripsPlanta.js";
import { buildRoofPlanSvgTypography } from "../utils/roofPlanSvgTypography.js";
import { buildEstructuraCotaObstacleRects as computeCotaObstacles } from "../utils/roofPlanCotaObstacles.js";
import {
  EstructuraGlobalExteriorOverlay,
  PanelChainDimensions,
  PanelLabels,
  VerificationBadge,
} from "./roofPlan/RoofPlanDimensions.jsx";
import { buildPanelLayout } from "../utils/panelLayout.js";
import { verifyPanelLayout } from "../utils/panelLayoutVerification.js";
import {
  fijacionDotsLayout,
  fijacionRowsFromHints,
  yForFijacionRowPlanta,
} from "../utils/roofEstructuraDotsLayout.js";
import {
  countCombinadaMaterialsInDots,
  cycleCombinadaMaterial,
  mergeCombinadaByKeyWithDefaults,
} from "../utils/combinadaFijacionShared.js";

/** ViewBox slack: `useRoofPreviewPlanLayout.js` (`viewBoxSlackMeters`, proporcional al plano). */
/** Menos de 1 = el rectángulo se mueve más lento que el puntero (mejor precisión). */
const DRAG_SENSITIVITY = 0.52;
/** Distancia máx (m) para que el borde de una zona se enganche al borde de otra al soltar. */
const SNAP_ZONE_M = 0.35;
/** Máx. pasos en deshacer / rehacer (planta 2D). */
const MAX_PLAN_UNDO = 5;

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

/** Snapshot { gi: { x, y } } para deshacer/rehacer posiciones en planta 2D. */
function snapshotZonaPositions(zonasList) {
  const snap = {};
  if (!Array.isArray(zonasList)) return snap;
  for (let i = 0; i < zonasList.length; i++) {
    const px = zonasList[i]?.preview?.x;
    const py = zonasList[i]?.preview?.y;
    if (Number.isFinite(px) && Number.isFinite(py)) snap[i] = { x: px, y: py };
  }
  return snap;
}

function isEditableKeyEventTarget(target) {
  if (!target || typeof target.closest !== "function") return false;
  return !!target.closest('input, textarea, select, [contenteditable="true"]');
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

function combinadaMaterialFill(mat) {
  if (mat === "hormigon") return "#0ea5e9";
  if (mat === "madera") return "#b45309";
  return "#1e293b";
}

/**
 * Paso Estructura: líneas de apoyo (violetas), puntos de fijación (hover → BOM).
 * Modo Combinada: clic en apoyos, bandas de perímetro y puntos para asignar hormigón / metal / madera.
 */
function EstructuraZonaOverlay({
  r,
  hints,
  svgTy,
  exterior = [],
  combinadaAssign = false,
  combinadaByKey = null,
  combinadaPtsH = 0,
  combinadaPtsMetal = 0,
  combinadaPtsMadera = 0,
  onCombinadaZoneInteraction = null,
}) {
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

  const zm = svgTy?.m ?? 1;
  const rows = fijacionRowsFromHints(hints);
  const supportLinesVisual = [];
  const supportLinesHit = [];
  if (rows >= 2 && r.h > 1e-6) {
    const n = Math.min(32, rows);
    for (let i = 0; i < n; i++) {
      const yy = yForFijacionRowPlanta(r, n, i);
      supportLinesVisual.push(
        <line
          key={`est-ap-v-${r.gi}-${i}`}
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
      if (combinadaAssign && typeof onCombinadaZoneInteraction === "function") {
        supportLinesHit.push(
          <line
            key={`est-ap-hit-${r.gi}-${i}`}
            x1={r.x}
            y1={yy}
            x2={r.x + r.w}
            y2={yy}
            stroke="transparent"
            strokeWidth={0.22 * zm}
            pointerEvents="stroke"
            style={{ cursor: "pointer" }}
            onPointerDown={(ev) => {
              ev.stopPropagation();
              ev.preventDefault();
              const pts = fijacionDotsLayout(r, hints, exterior);
              const keysInRow = pts.filter((d) => d.rowIndex === i).map((d) => d.key);
              if (!keysInRow.length) return;
              onCombinadaZoneInteraction(r.gi, (prev) => {
                const first = prev[keysInRow[0]] || "metal";
                const nm = cycleCombinadaMaterial(first);
                const next = { ...prev };
                for (const k of keysInRow) next[k] = nm;
                return next;
              });
            }}
          />,
        );
      }
    }
  }

  const dotPts = fijacionDotsLayout(r, hints, exterior);
  const dotKeys = dotPts.map((d) => d.key);
  const mergedByKey =
    combinadaAssign && typeof onCombinadaZoneInteraction === "function"
      ? mergeCombinadaByKeyWithDefaults(
          dotKeys,
          combinadaByKey && typeof combinadaByKey === "object" ? combinadaByKey : {},
          combinadaPtsH,
          combinadaPtsMetal,
          combinadaPtsMadera,
        )
      : {};

  const wStrip = Math.min(0.35, Math.max(0.08, r.w * 0.14));
  const hStrip = Math.min(0.35, Math.max(0.08, r.h * 0.12));
  const perimeterBands =
    combinadaAssign && typeof onCombinadaZoneInteraction === "function" && rows >= 2
      ? [
          {
            key: "perim-top",
            x: r.x,
            y: r.y,
            w: r.w,
            h: hStrip,
            pick: (dots) => dots.filter((d) => d.rowIndex === 0).map((d) => d.key),
          },
          {
            key: "perim-bot",
            x: r.x,
            y: r.y + r.h - hStrip,
            w: r.w,
            h: hStrip,
            pick: (dots) => dots.filter((d) => d.rowIndex === rows - 1).map((d) => d.key),
          },
          {
            key: "perim-left",
            x: r.x,
            y: r.y,
            w: wStrip,
            h: r.h,
            pick: (dots) =>
              dots
                .filter((d) => d.cx <= r.x + wStrip + 1e-6 || (d.kind === "pv" && d.edge === "left"))
                .map((d) => d.key),
          },
          {
            key: "perim-right",
            x: r.x + r.w - wStrip,
            y: r.y,
            w: wStrip,
            h: r.h,
            pick: (dots) =>
              dots
                .filter((d) => d.cx >= r.x + r.w - wStrip - 1e-6 || (d.kind === "pv" && d.edge === "right"))
                .map((d) => d.key),
          },
        ]
      : [];

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
        <g pointerEvents="none">{supportLinesVisual}</g>
        {combinadaAssign && supportLinesHit.length ? <g pointerEvents="auto">{supportLinesHit}</g> : null}
        {perimeterBands.map((band) => (
          <rect
            key={`${band.key}-${r.gi}`}
            x={band.x}
            y={band.y}
            width={band.w}
            height={band.h}
            fill="rgba(124,58,237,0.06)"
            stroke="rgba(124,58,237,0.35)"
            strokeWidth={0.02 * zm}
            style={{ cursor: "pointer" }}
            pointerEvents="auto"
            onPointerDown={(ev) => {
              if (typeof onCombinadaZoneInteraction !== "function") return;
              ev.stopPropagation();
              ev.preventDefault();
              const keysPick = band.pick(dotPts);
              if (!keysPick.length) return;
              onCombinadaZoneInteraction(r.gi, (prev) => {
                const first = prev[keysPick[0]] || "metal";
                const nm = cycleCombinadaMaterial(first);
                const next = { ...prev };
                for (const k of keysPick) next[k] = nm;
                return next;
              });
            }}
          />
        ))}
        <g pointerEvents="auto">
          {dotPts.map((d) => {
            const mat = combinadaAssign ? mergedByKey[d.key] || "metal" : "metal";
            const fill = combinadaAssign ? combinadaMaterialFill(mat) : "#1e293b";
            return (
              <g key={`fij-dot-${r.gi}-${d.key}`}>
                <circle
                  cx={d.cx}
                  cy={d.cy}
                  r={hitR}
                  fill="transparent"
                  style={{ cursor: combinadaAssign ? "pointer" : "pointer" }}
                  onMouseEnter={showPopoverAt}
                  onMouseLeave={scheduleHidePopover}
                  aria-label={
                    combinadaAssign
                      ? `Material: ${mat}. Clic para rotar (hormigón / metal / madera).`
                      : "Ver productos de fijación incluidos en la cotización"
                  }
                  onPointerDown={(ev) => {
                    if (!combinadaAssign || typeof onCombinadaZoneInteraction !== "function") return;
                    ev.stopPropagation();
                    ev.preventDefault();
                    onCombinadaZoneInteraction(r.gi, (prev) => {
                      const next = { ...prev };
                      next[d.key] = cycleCombinadaMaterial(prev[d.key] || "metal");
                      return next;
                    });
                  }}
                />
                <circle
                  cx={d.cx}
                  cy={d.cy}
                  r={dotR}
                  fill={fill}
                  stroke="#f8fafc"
                  strokeWidth={0.012 * zm}
                  opacity={0.92}
                  pointerEvents="none"
                />
              </g>
            );
          })}
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

const PLANTA_BORDER_SIDE_LABELS = {
  frente: "Frente inferior",
  fondo: "Frente superior",
  latIzq: "Lateral izq.",
  latDer: "Lateral der.",
};

function resolvePlantaBorderPanelFam(panelFamiliaKey) {
  return PANELS_TECHO[panelFamiliaKey]?.fam || "";
}

function plantaBorderOptsForSide(side, panelFamiliaKey) {
  const fam = resolvePlantaBorderPanelFam(panelFamiliaKey);
  return (BORDER_OPTIONS[side] || []).filter((o) => !o.familias || o.familias.includes(fam));
}

/**
 * Paso «Accesorios perimetrales»: bandas en planta (fondo=borde superior SVG, frente=inferior), misma convención que RoofBorderSelector / 3D.
 */
function PlantaBordesEdgeStrips({
  r,
  svgTy,
  multiZona,
  sharedSidesMap,
  disabledSidesGlobal,
  techoBorders,
  zonas,
  openGi,
  openSide,
  onStripPointerDown,
}) {
  const zm = svgTy?.m ?? 1;
  const wStrip = Math.min(0.35, Math.max(0.08, r.w * 0.14));
  const hStrip = Math.min(0.35, Math.max(0.08, r.h * 0.12));
  const gi = r.gi;
  const sideDefs = [
    { side: "latIzq", x: r.x, y: r.y, w: wStrip, h: r.h },
    { side: "latDer", x: r.x + r.w - wStrip, y: r.y, w: wStrip, h: r.h },
    { side: "fondo", x: r.x, y: r.y, w: r.w, h: hStrip },
    { side: "frente", x: r.x, y: r.y + r.h - hStrip, w: r.w, h: hStrip },
  ];

  const currentVal = (side) => {
    if (multiZona) {
      const zb = zonas[gi]?.preview?.borders ?? {};
      return zb[side] ?? techoBorders[side] ?? "";
    }
    return techoBorders[side] ?? "";
  };

  const isDisabled = (side) => {
    if (!multiZona && (disabledSidesGlobal || []).includes(side)) return true;
    if (multiZona && sharedSidesMap.get(gi)?.get(side)?.fullySide) return true;
    return false;
  };

  return (
    <g data-bmc-layer="planta-bordes-assign" pointerEvents="auto">
      {sideDefs.map(({ side, x, y, w, h }) => {
        const dis = isDisabled(side);
        const val = currentVal(side);
        const active = val && val !== "none";
        const isOpen = openGi === gi && openSide === side;
        let fill = "rgba(147,197,253,0.20)";
        if (dis) fill = "rgba(200,205,216,0.28)";
        else if (isOpen) fill = "rgba(59,130,246,0.40)";
        else if (active) fill = "rgba(96,165,250,0.35)";
        const stroke = isOpen ? C.primary : active ? C.primary : "rgba(37,99,235,0.5)";
        return (
          <rect
            key={`planta-bd-${gi}-${side}`}
            x={x}
            y={y}
            width={w}
            height={h}
            rx={0.05 * zm}
            fill={fill}
            stroke={stroke}
            strokeWidth={isOpen ? 0.06 * zm : 0.035 * zm}
            style={{ cursor: dis ? "not-allowed" : "pointer" }}
            onPointerDown={(ev) => {
              if (dis) return;
              ev.stopPropagation();
              ev.preventDefault();
              onStripPointerDown(ev, gi, side);
            }}
          />
        );
      })}
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
 * @param {Record<number, object>|null} [props.estructuraHintsByGi] - overlay Estructura (apoyos, fijaciones; requiere hints por zona)
 * @param {boolean} [props.showPlantaExteriorCotas] - cotas rojas globales (perímetro + encuentros) sin paso Estructura; p. ej. desde paso Dimensiones del wizard
 * @param {boolean} [props.embedMetricsSidebar] - false = sin columna de métricas (mostrar `RoofPreviewMetricsSidebar` en el wizard)
 * @param {number|null} [props.selectedZonaGi] - zona seleccionada si `embedMetricsSidebar` es false
 * @param {(gi: number|null) => void} [props.onSelectedZonaGiChange] - al elegir zona en el SVG (con métricas externas)
 * @param {boolean} [props.denseChrome] - true en visor embebido: menos padding y el bloque SVG crece con el host (flex + altura máxima)
 * @param {boolean} [props.combinadaFijacionAssign] - paso Estructura + tipo Combinada: clic en 2D para materiales (una sola zona en planta)
 * @param {Record<number, Record<string, string>>|null} [props.combinadaFijByGi] - mapa punto → hormigon|metal|madera por zona
 * @param {(payload: { byGi: Record<number, Record<string, string>>, ptsHorm: number, ptsMetal: number, ptsMadera: number }) => void} [props.onCombinadaFijacionSync]
 * @param {number} [props.combinadaPtsH] - conteos actuales (para inicializar puntos sin mapa)
 * @param {number} [props.combinadaPtsMetal]
 * @param {number} [props.combinadaPtsMadera]
 * @param {boolean} [props.bordesPlantaAssign] - paso Accesorios perimetrales: bandas en planta + popover (como 3D)
 * @param {string} [props.bordesPanelFamiliaKey] - clave `PANELS_TECHO` (p. ej. techo.familia) para filtrar BORDER_OPTIONS
 * @param {Record<string, string>|null} [props.techoBorders] - bordes globales (`techo.borders`)
 * @param {(side: string, val: string) => void} [props.onTechoBorderChange] - una sola zona efectiva en planta
 * @param {(gi: number, side: string, val: string) => void} [props.onZonaBorderChange] - multizona
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
  panelObj = null,
  bomPanelResultsByGi = null,
  combinadaFijacionAssign = false,
  combinadaFijByGi = null,
  onCombinadaFijacionSync = null,
  combinadaPtsH = 0,
  combinadaPtsMetal = 0,
  combinadaPtsMadera = 0,
  bordesPlantaAssign = false,
  bordesPanelFamiliaKey = "",
  techoBorders = null,
  onTechoBorderChange = null,
  onZonaBorderChange = null,
}) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const tapRef = useRef(null);
  const plantaBorderPopRef = useRef(null);
  const [plantaBorderPick, setPlantaBorderPick] = useState(null);
  const [plantaBorderPopoverStyle, setPlantaBorderPopoverStyle] = useState(null);
  const [dragOverlay, setDragOverlay] = useState(null);
  const [encounterPrompt, setEncounterPrompt] = useState(null);
  const [internalSelectedGi, setInternalSelectedGi] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const zonasRef = useRef(zonas);
  useEffect(() => {
    zonasRef.current = zonas;
  }, [zonas]);

  const metricsExternal = embedMetricsSidebar === false && typeof onSelectedZonaGiChange === "function";
  const selectedGi = metricsExternal ? (selectedZonaGiProp ?? null) : internalSelectedGi;
  const setSelectedGi = useCallback(
    (gi) => {
      if (metricsExternal) onSelectedZonaGiChange(gi);
      else setInternalSelectedGi(gi);
    },
    [metricsExternal, onSelectedZonaGiChange],
  );

  const { planEdges, layout } = useRoofPreviewPlanLayout(zonas, tipoAguas, panelObj ? 0.60 : null);

  const combinadaSingleZona = Boolean(combinadaFijacionAssign && layout.entries.length === 1);

  const bordersGlobalForPlanta = techoBorders && typeof techoBorders === "object" ? techoBorders : {};
  const validZonasForBordes = useMemo(
    () => (zonas || []).filter((z) => z?.largo > 0 && z?.ancho > 0),
    [zonas],
  );
  const multiZonaBordes = validZonasForBordes.length > 1;
  const bordesSharedSidesMap = useMemo(() => {
    if (!bordesPlantaAssign || !multiZonaBordes) return new Map();
    try {
      return getSharedSidesPerZona(validZonasForBordes, tipoAguas);
    } catch {
      return new Map();
    }
  }, [bordesPlantaAssign, multiZonaBordes, validZonasForBordes, tipoAguas]);

  const disabledSidesGlobalBordes = tipoAguas === "dos_aguas" && !multiZonaBordes ? ["fondo"] : [];
  const bordesPlantaHandlersOk = typeof onTechoBorderChange === "function" || typeof onZonaBorderChange === "function";

  useEffect(() => {
    if (!bordesPlantaAssign) {
      setPlantaBorderPick(null);
      setPlantaBorderPopoverStyle(null);
    }
  }, [bordesPlantaAssign]);

  useEffect(() => {
    if (!plantaBorderPick) return;
    const handler = (e) => {
      const inPop = plantaBorderPopRef.current?.contains(e.target);
      if (!inPop) {
        setPlantaBorderPick(null);
        setPlantaBorderPopoverStyle(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [plantaBorderPick]);

  const positionPlantaBorderPopover = useCallback(() => {
    const popEl = plantaBorderPopRef.current;
    if (!plantaBorderPick || !popEl) return;
    const popRect = popEl.getBoundingClientRect();
    if (popRect.width === 0 || popRect.height === 0) return;
    const vpPad = 10;
    const gap = 10;
    const vw = typeof window !== "undefined" ? window.innerWidth : 800;
    const vh = typeof window !== "undefined" ? window.innerHeight : 600;
    const { ax, ay, side } = plantaBorderPick;
    const canBottom = ay + gap + popRect.height + vpPad <= vh;
    const canTop = ay - gap - popRect.height - vpPad >= 0;
    let top =
      side === "fondo"
        ? (canTop || !canBottom ? ay - gap - popRect.height : ay + gap)
        : side === "frente"
          ? (canBottom || !canTop ? ay + gap : ay - gap - popRect.height)
          : ay - popRect.height / 2;
    let left = ax - popRect.width / 2;
    left = Math.min(Math.max(vpPad, left), vw - popRect.width - vpPad);
    top = Math.min(Math.max(vpPad, top), vh - popRect.height - vpPad);
    setPlantaBorderPopoverStyle({ top, left, opacity: 1 });
  }, [plantaBorderPick]);

  useLayoutEffect(() => {
    if (plantaBorderPick) positionPlantaBorderPopover();
    else setPlantaBorderPopoverStyle(null);
  }, [plantaBorderPick, positionPlantaBorderPopover]);

  useEffect(() => {
    if (!plantaBorderPick) return;
    window.addEventListener("resize", positionPlantaBorderPopover);
    window.addEventListener("scroll", positionPlantaBorderPopover, true);
    return () => {
      window.removeEventListener("resize", positionPlantaBorderPopover);
      window.removeEventListener("scroll", positionPlantaBorderPopover, true);
    };
  }, [plantaBorderPick, positionPlantaBorderPopover]);

  const handlePlantaBordeStripDown = useCallback((ev, gi, side) => {
    setPlantaBorderPick((prev) => {
      if (prev?.gi === gi && prev?.side === side) return null;
      return { gi, side, ax: ev.clientX, ay: ev.clientY };
    });
  }, []);

  const applyPlantaBorderOption = useCallback(
    (optId) => {
      if (!plantaBorderPick) return;
      const { gi, side } = plantaBorderPick;
      if (multiZonaBordes && typeof onZonaBorderChange === "function") {
        onZonaBorderChange(gi, side, optId);
      } else if (typeof onTechoBorderChange === "function") {
        onTechoBorderChange(side, optId);
      }
      setPlantaBorderPick(null);
      setPlantaBorderPopoverStyle(null);
    },
    [plantaBorderPick, multiZonaBordes, onZonaBorderChange, onTechoBorderChange],
  );

  const handleCombinadaZoneInteraction = useCallback(
    (gi, updater) => {
      if (!combinadaSingleZona || typeof onCombinadaFijacionSync !== "function") return;
      const entry = layout.entries[0];
      if (!entry || entry.gi !== gi) return;
      const hints = estructuraHintsByGi?.[gi];
      if (!hints) return;
      const ext = planEdges?.exterior ?? [];
      const dots = fijacionDotsLayout(entry, hints, ext);
      const keys = dots.map((d) => d.key);
      const prev = mergeCombinadaByKeyWithDefaults(
        keys,
        (combinadaFijByGi && combinadaFijByGi[gi]) || {},
        combinadaPtsH,
        combinadaPtsMetal,
        combinadaPtsMadera,
      );
      const next = updater(prev);
      const c = countCombinadaMaterialsInDots(dots, next);
      onCombinadaFijacionSync({
        byGi: { [gi]: next },
        ptsHorm: c.ptsHorm,
        ptsMetal: c.ptsMetal,
        ptsMadera: c.ptsMadera,
      });
    },
    [
      combinadaSingleZona,
      onCombinadaFijacionSync,
      layout.entries,
      estructuraHintsByGi,
      planEdges,
      combinadaFijByGi,
      combinadaPtsH,
      combinadaPtsMetal,
      combinadaPtsMadera,
    ],
  );

  const svgTy = useMemo(() => buildRoofPlanSvgTypography(layout.viewMetrics), [layout.viewMetrics]);

  /** Margen SVG y leyenda: cotas rojas (planta) y/o overlay completo Estructura. */
  const plantaCotaChromeActive = estructuraHintsByGi != null || showPlantaExteriorCotas;

  const effectivePanelAu = panelObj?.au ?? panelAu;

  /**
   * `buildPanelLayout` solo usa `panel.au`. Sin `panelObj` del catálogo (p. ej. paso temprano),
   * igual armamos layout con `effectivePanelAu` para que no queden solo cotas de perímetro y parezca
   * que “falta” la cadena mm / etiquetas T-xx bajo las cotas rojas.
   */
  const layoutPanelSource = useMemo(() => {
    if (panelObj) return panelObj;
    if (effectivePanelAu > 0) return { au: effectivePanelAu };
    return null;
  }, [panelObj, effectivePanelAu]);

  const panelLayouts = useMemo(() => {
    if (!layoutPanelSource) return null;
    const is2A = tipoAguas === 'dos_aguas';
    return layout.entries.map((r) => {
      const ancho = is2A ? r.z.ancho / 2 : r.z.ancho;
      return { gi: r.gi, layout: buildPanelLayout({ panel: layoutPanelSource, largo: r.z.largo, ancho }) };
    });
  }, [layoutPanelSource, layout.entries, tipoAguas]);

  const cotaObstacles = useMemo(() => {
    if (!plantaCotaChromeActive) return [];
    return computeCotaObstacles(planEdges?.exterior ?? [], planEdges?.encounters ?? [], svgTy);
  }, [plantaCotaChromeActive, planEdges, svgTy]);

  const verifications = useMemo(() => {
    if (!panelLayouts) return null;
    const result = {};
    for (const { gi, layout: pl } of panelLayouts) {
      const entryLargo = layout.entries.find((r) => r.gi === gi)?.z.largo ?? 0;
      // Usa BOM externo si disponible; si no, verifica el layout contra sí mismo (siempre ✓)
      const bom = bomPanelResultsByGi?.[gi] ?? {
        cantPaneles: pl.totalPanels,
        areaTotal: +(pl.totalPanels * pl.au * entryLargo).toFixed(2),
        anchoTotal: pl.anchoTotal,
      };
      result[gi] = verifyPanelLayout(pl, bom, entryLargo);
    }
    return result;
  }, [panelLayouts, bomPanelResultsByGi, layout.entries]);

  /** Espacio extra para cotas exteriores (planta / Estructura). */
  const svgViewBox = useMemo(() => {
    if (!layout.viewMetrics) return layout.viewBox;
    const chainActive = !!panelLayouts;
    if ((!plantaCotaChromeActive && !chainActive) || layout.entries.length === 0) return layout.viewBox;
    const { vbX, vbY, vbW, vbH } = layout.viewMetrics;
    const ext = planEdges?.exterior ?? [];
    const nSide = (side) => Math.min(8, ext.filter((s) => s.side === side).length);
    // No usar `svgTy.m` completo: inflaba el viewBox y achicaba el techo en pantalla. Cotas siguen en coords ampliadas.
    const vbPadScale = Math.min(1.22, Math.max(1, 0.62 + 0.22 * svgTy.m));
    const padL = (1.05 + nSide("left") * 0.14) * vbPadScale;
    const padT = (0.55 + nSide("top") * 0.14) * vbPadScale;
    // chainPad: reserva espacio para chain dim lines (yEdge + dimStackBottom + 3×CHAIN_STEP)
    const chainPad = chainActive ? (svgTy.dimStackBottom ?? 0.3) + 0.56 : 0;
    const padB = (0.68 + nSide("bottom") * 0.14) * vbPadScale + chainPad;
    const padR = (0.45 + nSide("right") * 0.14) * vbPadScale;
    return `${vbX - padL} ${vbY - padT} ${vbW + padL + padR} ${vbH + padT + padB}`;
  }, [layout.viewBox, layout.viewMetrics, layout.entries.length, plantaCotaChromeActive, planEdges?.exterior, svgTy.m, svgTy.dimStackBottom, panelLayouts, localDisplayMode]);

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
      const before = snapshotZonaPositions(zonasRef.current);
      setRedoStack((r) => [...r.slice(-(MAX_PLAN_UNDO - 1)), before]);
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

  const applyRedo = useCallback(() => {
    setRedoStack((r) => {
      if (!r.length) return r;
      const nextPos = r[r.length - 1];
      const before = snapshotZonaPositions(zonasRef.current);
      setUndoStack((s) => [...s.slice(-(MAX_PLAN_UNDO - 1)), before]);
      for (const k of Object.keys(nextPos)) {
        const gi = Number(k);
        const pos = nextPos[k];
        if (Number.isFinite(pos?.x) && Number.isFinite(pos?.y)) {
          onZonaPreviewChange?.(gi, { x: pos.x, y: pos.y });
        }
      }
      return r.slice(0, -1);
    });
  }, [onZonaPreviewChange]);

  useEffect(() => {
    if (!onZonaPreviewChange) return;
    const onKey = (e) => {
      if (!e.metaKey && !e.ctrlKey) return;
      if (isEditableKeyEventTarget(e.target)) return;
      if (e.key === "z" || e.key === "Z") {
        if (e.shiftKey) {
          e.preventDefault();
          applyRedo();
        } else {
          e.preventDefault();
          applyUndo();
        }
      } else if ((e.key === "y" || e.key === "Y") && e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        applyRedo();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [applyUndo, applyRedo, onZonaPreviewChange]);

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
        setUndoStack((s) => [...s.slice(-(MAX_PLAN_UNDO - 1)), d.startSnapshot]);
        setRedoStack([]);
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
              title="Deshacer último movimiento en planta (Ctrl/Cmd+Z)"
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
          {redoStack.length > 0 && onZonaPreviewChange && (
            <button
              type="button"
              onClick={applyRedo}
              title="Rehacer (Ctrl/Cmd+Shift+Z o Ctrl+Y)"
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
              Rehacer
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
              {combinadaSingleZona ? (
                <>
                  {" "}
                  <strong style={{ color: C.tp }}>Combinada:</strong> tocá una línea de apoyo, una banda violeta del perímetro o un punto para rotar hormigón → metal → madera; los contadores se actualizan solos. Con varias zonas en planta, usá los números del panel.
                </>
              ) : null}
              Movimiento de zonas en planta: <strong>Deshacer / Rehacer</strong> o <kbd>Ctrl/Cmd+Z</kbd> / <kbd>Ctrl/Cmd+Shift+Z</kbd>.
            </>
          ) : (
            <>
              <strong style={{ color: C.tp }}>Planta:</strong> cotas rojas = perímetro libre y longitud en cada encuentro; la cadena de cotas en mm bajo el borde inferior = paños según el ancho útil (AU) del panel. Arrastrá las zonas para ubicarlas
              correctamente antes de bordes y estructura. <strong>Deshacer / Rehacer</strong> en la barra o <kbd>Ctrl/Cmd+Z</kbd> y <kbd>Ctrl/Cmd+Shift+Z</kbd> (o <kbd>Ctrl+Y</kbd> en Windows).
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
      {bordesPlantaAssign && bordesPlantaHandlersOk && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: C.ts,
            marginTop: plantaCotaChromeActive ? -2 : 0,
            marginBottom: 8,
            lineHeight: 1.35,
          }}
        >
          <strong style={{ color: C.tp }}>Accesorios perimetrales (planta):</strong> tocá los bordes resaltados de cada zona; misma convención que el 3D (frente = borde inferior del rectángulo en 2D). Los lados totalmente compartidos entre zonas no se eligen aquí.
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
                    au={effectivePanelAu}
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
                      combinadaAssign={combinadaSingleZona}
                      combinadaByKey={combinadaFijByGi?.[r.gi] ?? null}
                      combinadaPtsH={combinadaPtsH}
                      combinadaPtsMetal={combinadaPtsMetal}
                      combinadaPtsMadera={combinadaPtsMadera}
                      onCombinadaZoneInteraction={handleCombinadaZoneInteraction}
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
                        {panelCountAcrossAnchoPlanta(r.w, effectivePanelAu)}{" "}
                        {panelCountAcrossAnchoPlanta(r.w, effectivePanelAu) === 1 ? "panel" : "paneles"}
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
                  {bordesPlantaAssign && bordesPlantaHandlersOk ? (
                    <PlantaBordesEdgeStrips
                      r={r}
                      svgTy={svgTy}
                      multiZona={multiZonaBordes}
                      sharedSidesMap={bordesSharedSidesMap}
                      disabledSidesGlobal={disabledSidesGlobalBordes}
                      techoBorders={bordersGlobalForPlanta}
                      zonas={zonas}
                      openGi={plantaBorderPick?.gi ?? null}
                      openSide={plantaBorderPick?.side ?? null}
                      onStripPointerDown={handlePlantaBordeStripDown}
                    />
                  ) : null}
                </g>
              );
            })}
            {panelLayouts && layout.entries.map((r) => {
              const pl = panelLayouts.find((x) => x.gi === r.gi);
              if (!pl) return null;
              return (
                <g key={`panel-overlay-${r.gi}`} pointerEvents="none">
                  <PanelLabels
                    strips={pl.layout.panels}
                    x0={r.x} y0={r.y} h={r.h}
                    svgTy={svgTy}
                  />
                  {verifications?.[r.gi] && (
                    <VerificationBadge
                      x={r.x + r.w} y={r.y}
                      verification={verifications[r.gi]}
                      svgTy={svgTy}
                    />
                  )}
                </g>
              );
            })}
            {panelLayouts && layout.entries.map((r) => {
              const pl = panelLayouts.find((x) => x.gi === r.gi);
              if (!pl) return null;
              const strips = buildAnchoStripsPlanta(r.w, effectivePanelAu);
              return (
                <PanelChainDimensions
                  key={`chain-${r.gi}`}
                  strips={strips}
                  x0={r.x}
                  yEdge={r.y + r.h}
                  svgTy={svgTy}
                  obstacleRects={cotaObstacles}
                />
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
      {plantaBorderPick && typeof document !== "undefined" && bordesPlantaAssign && bordesPlantaHandlersOk
        ? createPortal(
            (() => {
              const { gi, side } = plantaBorderPick;
              const opts = plantaBorderOptsForSide(side, bordesPanelFamiliaKey);
              let curVal = "";
              if (multiZonaBordes) {
                curVal = zonas[gi]?.preview?.borders?.[side] ?? bordersGlobalForPlanta[side] ?? "";
              } else {
                curVal = bordersGlobalForPlanta[side] ?? "";
              }
              const title = multiZonaBordes
                ? `Zona ${gi + 1} — ${PLANTA_BORDER_SIDE_LABELS[side] || side}`
                : PLANTA_BORDER_SIDE_LABELS[side] || side;
              return (
                <div
                  ref={plantaBorderPopRef}
                  style={{
                    position: "fixed",
                    zIndex: 10070,
                    top: plantaBorderPopoverStyle?.top ?? -9999,
                    left: plantaBorderPopoverStyle?.left ?? -9999,
                    opacity: plantaBorderPopoverStyle?.opacity ?? 0,
                    transition: "opacity 80ms ease",
                    fontFamily: FONT,
                    background: C.surface,
                    borderRadius: 10,
                    boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
                    minWidth: 220,
                    maxWidth: 320,
                    maxHeight: 320,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      padding: "6px 12px",
                      fontSize: 10,
                      fontWeight: 700,
                      color: C.ts,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      borderBottom: `1px solid ${C.border}`,
                      background: C.surfaceAlt,
                      borderRadius: "10px 10px 0 0",
                      flexShrink: 0,
                    }}
                  >
                    {title}
                  </div>
                  <div style={{ overflowY: "auto", borderRadius: "0 0 10px 10px" }}>
                    {opts.map((opt, oi) => {
                      const isSel = curVal === opt.id;
                      return (
                        <div
                          key={`${side}-${opt.id}-${oi}`}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            applyPlantaBorderOption(opt.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              applyPlantaBorderOption(opt.id);
                            }
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 12px",
                            cursor: "pointer",
                            fontSize: 13,
                            background: isSel ? C.primarySoft : "transparent",
                            fontWeight: isSel ? 500 : 400,
                            color: C.tp,
                            transition: TR,
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span>{opt.label}</span>
                            {opt.descripcion ? (
                              <span style={{ fontSize: 10, color: C.ts, fontWeight: 400, lineHeight: 1.3 }}>{opt.descripcion}</span>
                            ) : null}
                          </div>
                          {isSel ? <Check size={14} color={C.primary} style={{ flexShrink: 0 }} /> : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })(),
            document.body,
          )
        : null}
    </div>
  );
}
