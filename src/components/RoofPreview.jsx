// ═══════════════════════════════════════════════════════════════════════════
// RoofPreview.jsx — Vista previa del techo (rejilla de paneles, drag, pendiente)
// Coordenadas del SVG en metros (planta). preview.x/y alimenta encuentros y (con geometría) el BOM;
// buildRoofPlanEdges muestra perímetro/encuentros. Cotas: `roofPlan/RoofPlanDimensions.jsx`, `utils/roofPlanSvgTypography.js`, `utils/roofPlanDrawingTheme.js`.
// Rejilla en planta: largo del panel = largo del techo (h en SVG);
// cantidad de paneles reparte el ancho en planta (w) cada au → columnas verticales / juntas verticales (alineado a calcPanelesTecho).
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Trash2 } from "lucide-react";
import { BORDER_OPTIONS, C, FONT, PANELS_TECHO, PERFIL_TECHO, TR } from "../data/constants.js";
import CollapsibleHint from "./CollapsibleHint.jsx";
import { calcFactorPendiente, calcLargoRealFromModo } from "../utils/calculations.js";
import { useRoofPreviewPlanLayout } from "../hooks/useRoofPreviewPlanLayout.js";
import { encounterPairKey, findEncounters, getSharedSidesPerZona } from "../utils/roofPlanGeometry.js";
import {
  listEncounterPairSegmentRuns,
  patchEncounterPairSegment,
  splitEncounterPairSegmentMid,
  normalizeEncounter,
  pairEncounterBaseRaw,
  encounterBorderPerfil,
  encounterEsContinuo,
  resolveNeighborSharedSide,
} from "../utils/roofEncounterModel.js";
import { formatZonaDisplayTitle, isLateralAnnexZona, getLateralAnnexRootBodyGi } from "../utils/roofLateralAnnexLayout.js";
import { buildZoneBorderExteriorLines, buildZoneBorderExteriorIntervals } from "../utils/roofPlanEdgeSegments.js";
import { nextRoofSlopeMark } from "../utils/roofSlopeMark.js";
import { buildAnchoStripsPlanta, panelCountAcrossAnchoPlanta } from "../utils/roofPanelStripsPlanta.js";
import { buildRoofPlanSvgTypography, fmtDimMm } from "../utils/roofPlanSvgTypography.js";
import { buildEstructuraCotaObstacleRects as computeCotaObstacles } from "../utils/roofPlanCotaObstacles.js";
import { LINE_WEIGHTS } from "../utils/roofPlanDrawingTheme.js";
import ScaleBar from "./roofPlan/ScaleBar.jsx";
import OrientationMark from "./roofPlan/OrientationMark.jsx";
import DatumMark from "./roofPlan/DatumMark.jsx";
import {
  EstructuraGlobalExteriorOverlay,
  OverallEnvelopeDimension,
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
  COMBINADA_MATERIAL_ORDER,
  bulkDisableDots,
  bulkSetDotsMaterialEnabled,
  countCombinadaMaterialsInDots,
  countPtsWithOverrides,
  cycleDotMaterial,
  cycleCombinadaMaterial,
  mergeCombinadaByKeyWithDefaults,
  resolveDotState,
  stripDotOverrideKeys,
  toggleDotEnabled,
} from "../utils/combinadaFijacionShared.js";

/** ViewBox slack: `useRoofPreviewPlanLayout.js` (`viewBoxSlackMeters`, proporcional al plano). */
/** Menos de 1 = el rectángulo se mueve más lento que el puntero (mejor precisión). */
const DRAG_SENSITIVITY = 0.52;
/** Distancia máx (m) para que el borde de una zona se enganche al borde de otra al soltar. */
const SNAP_ZONE_M = 0.35;
/** Máx. pasos en deshacer / rehacer (planta 2D). */
const MAX_PLAN_UNDO = 5;

const PLANTA_PANEL_PICK_STORAGE_KEY = "bmc-roof-planta-panel-pick-v1";

/** Huella de geometría (sin preview.x/y) para no reusar un pick entre cotizaciones distintas. */
function plantaLayoutFingerprint(zonas, tipoAguas, panelAuM) {
  const is2A = tipoAguas === "dos_aguas";
  const au = Number(panelAuM) || 0;
  const parts = (zonas || []).map((z, gi) => {
    const L = Number(z?.largo) || 0;
    const W0 = Number(z?.ancho) || 0;
    const W = is2A ? W0 / 2 : W0;
    return `${gi}:${L.toFixed(4)}:${W.toFixed(4)}`;
  });
  return `${tipoAguas}|${au}|${parts.join(";")}`;
}

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
  if (modo === "pretil") return "#f97316";
  if (modo === "cumbrera") return "#3b82f6";
  if (modo === "desnivel") return "#ef4444";
  return "#f59e0b";
}

/** Etiqueta corta de perfil de encuentro para mostrar inline en el SVG por tramo. */
const ENCOUNTER_PERFIL_LABELS = {
  gotero_frontal:        "Gotero",
  gotero_frontal_greca:  "Greca",
  gotero_lateral:        "Lateral",
  gotero_lateral_camara: "Cámara",
  babeta_adosar:         "Babeta ↗",
  babeta_empotrar:       "Babeta ↙",
  canalon:               "Canalón",
  cumbrera:              "Cumbrera",
  pretil:                "Pretil",
};

function encounterPerfilLabel(normalized) {
  if (!normalized || normalized.modo === "continuo") return null;
  if (normalized.modo === "cumbrera") return "Cumbrera";
  if (normalized.modo === "desnivel") {
    const d = normalized.desnivel;
    if (d) {
      const bajo = ENCOUNTER_PERFIL_LABELS[d.perfilBajo] ?? d.perfilBajo;
      const alto = ENCOUNTER_PERFIL_LABELS[d.perfilAlto] ?? d.perfilAlto;
      if (bajo && alto && bajo !== alto) return `${bajo} / ${alto}`;
      return bajo || alto || "Desnivel";
    }
    return "Desnivel";
  }
  const p = normalized.perfil;
  return (p && p !== "none") ? (ENCOUNTER_PERFIL_LABELS[p] ?? p) : null;
}

/** Punto a lo largo del segmento geométrico del encuentro; `t` en [0,1] de (x1,y1) a (x2,y2). */
function encInterp(enc, t) {
  const u = Math.max(0, Math.min(1, Number(t) || 0));
  return {
    x: enc.x1 + (enc.x2 - enc.x1) * u,
    y: enc.y1 + (enc.y2 - enc.y1) * u,
  };
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

function combinadaMaterialUiLabel(m) {
  if (m === "hormigon") return "Hormigón";
  if (m === "madera") return "Madera";
  return "Metal";
}

/** Popover fijo: elegir material de apoyo (Combinada, una línea punteada). */
function CombinadaApoyoMaterialPopover({ anchor, zonaLabel, rowLabel, onPick, onRowDisable, popRef }) {
  if (!anchor) return null;
  const rawLeft = anchor.left;
  const rawTop = anchor.top;
  const estW = 220;
  const estH = typeof onRowDisable === "function" ? 168 : 120;
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
  const body = (
    <div
      ref={popRef}
      role="dialog"
      aria-label="Material de apoyo"
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 10061,
        width: estW,
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
    >
      <div style={{ fontWeight: 700, color: "#5b21b6", marginBottom: 6 }}>{zonaLabel}</div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{rowLabel}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {COMBINADA_MATERIAL_ORDER.map((m) => (
          <button
            key={m}
            type="button"
            onPointerDown={(ev) => {
              ev.stopPropagation();
              ev.preventDefault();
              onPick(m);
            }}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: `1.5px solid ${m === "hormigon" ? "#0ea5e9" : m === "madera" ? "#b45309" : "#1e293b"}`,
              background: m === "hormigon" ? "#e0f2fe" : m === "madera" ? "#fef3c7" : "#f1f5f9",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              color: m === "hormigon" ? "#0369a1" : m === "madera" ? "#92400e" : "#1e293b",
            }}
          >
            {combinadaMaterialUiLabel(m)}
          </button>
        ))}
      </div>
      {typeof onRowDisable === "function" ? (
        <button
          type="button"
          onPointerDown={(ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            onRowDisable();
          }}
          style={{
            marginTop: 8,
            width: "100%",
            padding: "7px 10px",
            borderRadius: 8,
            border: `1.5px solid ${C.danger}`,
            background: "#fef2f2",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            color: "#b91c1c",
            textAlign: "left",
          }}
        >
          Sin fijación (toda la fila de apoyo)
        </button>
      ) : null}
    </div>
  );
  return typeof document !== "undefined" ? createPortal(body, document.body) : null;
}

/** Paleta fija: material + anular + restaurar base (puntos, perímetro, junta vertical). */
function CombinadaFijacionDotsPalettePopover({
  anchor,
  title,
  subtitle,
  onPickMat,
  onDisable,
  onRestore,
  popRef,
}) {
  if (!anchor || !Array.isArray(anchor.keys) || anchor.keys.length === 0) return null;
  const rawLeft = anchor.left;
  const rawTop = anchor.top;
  const estW = 248;
  const estH = 216;
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
  const body = (
    <div
      ref={popRef}
      role="dialog"
      aria-label="Fijación — material"
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 10062,
        width: estW,
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
    >
      <div style={{ fontWeight: 700, color: "#5b21b6", marginBottom: 4 }}>{title}</div>
      {subtitle ? (
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{subtitle}</div>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {COMBINADA_MATERIAL_ORDER.map((m) => (
          <button
            key={m}
            type="button"
            onPointerDown={(ev) => {
              ev.stopPropagation();
              ev.preventDefault();
              onPickMat(m);
            }}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: `1.5px solid ${m === "hormigon" ? "#0ea5e9" : m === "madera" ? "#b45309" : "#1e293b"}`,
              background: m === "hormigon" ? "#e0f2fe" : m === "madera" ? "#fef3c7" : "#f1f5f9",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              color: m === "hormigon" ? "#0369a1" : m === "madera" ? "#92400e" : "#1e293b",
            }}
          >
            {combinadaMaterialUiLabel(m)}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button
          type="button"
          onPointerDown={(ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            onDisable();
          }}
          style={{
            padding: "7px 10px",
            borderRadius: 8,
            border: `1.5px solid ${C.danger}`,
            background: "#fef2f2",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            color: "#b91c1c",
            textAlign: "left",
          }}
        >
          Sin fijación (anular selección)
        </button>
        <button
          type="button"
          onPointerDown={(ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            onRestore();
          }}
          style={{
            padding: "7px 10px",
            borderRadius: 8,
            border: `1.5px solid ${C.border}`,
            background: C.surfaceAlt,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            color: C.ts,
            textAlign: "left",
          }}
        >
          Restaurar base (quitar ajuste fino)
        </button>
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(body, document.body) : null;
}

/**
 * Paso Estructura: líneas de apoyo (violetas), puntos de fijación (hover → BOM).
 * Modo Combinada: por defecto todos los puntos cuentan (incluidos). Clic en un punto = quitar/restaurar
 * (no cotiza esa fijación; se ve atenuado). Mayús+clic o pulsación larga (~0,45 s) en el punto = paleta
 * de material. Clic en líneas de apoyo y bandas de perímetro = paleta; las juntas verticales panel–panel
 * no son seleccionables (solo encuentro geométrico). Los conteos globales ptsHorm/ptsMetal/ptsMadera se
 * alinean al BOM con `calcFijacionesVarilla` / caballete según familia.
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
  dotOverrides = null,
  onDotCycleMaterial = null,
  onDotToggleEnabled = null,
  apoyoMateriales = null,
  onApoyoMaterialCycle = null,
  onApoyoMaterialDirect = null,
  onFijacionPaletteBulk = null,
  tipoEst = "metal",
}) {
  const [fijPopAnchor, setFijPopAnchor] = useState(null);
  const [apoyoMatPick, setApoyoMatPick] = useState(null);
  const [fijPalette, setFijPalette] = useState(null);
  const apoyoMatPopRef = useRef(null);
  const fijPalettePopRef = useRef(null);
  const hidePopTimer = useRef(null);
  /** Clic corto = toggle punto; pulsación larga / Mayús+clic = paleta (cuando hay bulk handler). */
  const dotPointerRef = useRef({ timer: null, key: null, longFired: false });

  const clearHideTimer = useCallback(() => {
    if (hidePopTimer.current != null) {
      window.clearTimeout(hidePopTimer.current);
      hidePopTimer.current = null;
    }
  }, []);

  const clearDotPointerTimer = useCallback(() => {
    const d = dotPointerRef.current;
    if (d.timer != null) {
      window.clearTimeout(d.timer);
      d.timer = null;
    }
    d.key = null;
    d.longFired = false;
  }, []);

  useEffect(() => () => {
    const d = dotPointerRef.current;
    if (d.timer != null) window.clearTimeout(d.timer);
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

  useEffect(() => {
    if (!apoyoMatPick) return undefined;
    let removeDoc = null;
    let cleaned = false;
    const tid = window.setTimeout(() => {
      if (cleaned) return;
      const handler = (e) => {
        if (apoyoMatPopRef.current?.contains(e.target)) return;
        setApoyoMatPick(null);
      };
      document.addEventListener("pointerdown", handler, true);
      removeDoc = () => document.removeEventListener("pointerdown", handler, true);
    }, 0);
    return () => {
      cleaned = true;
      window.clearTimeout(tid);
      if (removeDoc) removeDoc();
    };
  }, [apoyoMatPick]);

  useEffect(() => {
    if (!fijPalette) return undefined;
    let removeDoc = null;
    let cleaned = false;
    const tid = window.setTimeout(() => {
      if (cleaned) return;
      const handler = (e) => {
        if (fijPalettePopRef.current?.contains(e.target)) return;
        setFijPalette(null);
      };
      document.addEventListener("pointerdown", handler, true);
      removeDoc = () => document.removeEventListener("pointerdown", handler, true);
    }, 0);
    return () => {
      cleaned = true;
      window.clearTimeout(tid);
      if (removeDoc) removeDoc();
    };
  }, [fijPalette]);

  if (!hints) return null;

  const zm = svgTy?.m ?? 1;
  const rows = fijacionRowsFromHints(hints);
  const dotPts = fijacionDotsLayout(r, hints, exterior);
  const supportLinesVisual = [];
  const supportLinesHit = [];
  if (rows >= 2 && r.h > 1e-6) {
    const n = Math.min(32, rows);
    for (let i = 0; i < n; i++) {
      const yy = yForFijacionRowPlanta(r, n, i);
      const apoyoMat = apoyoMateriales && i < apoyoMateriales.length ? apoyoMateriales[i] : null;
      const lineColor = combinadaAssign && apoyoMat ? combinadaMaterialFill(apoyoMat) : "#7c3aed";
      supportLinesVisual.push(
        <line
          key={`est-ap-v-${r.gi}-${i}`}
          x1={r.x}
          y1={yy}
          x2={r.x + r.w}
          y2={yy}
          stroke={lineColor}
          strokeWidth={combinadaAssign && apoyoMat ? 0.065 * zm : 0.048 * zm}
          strokeDasharray={combinadaAssign && apoyoMat ? undefined : `${0.16 * zm} ${0.1 * zm}`}
          opacity={0.88}
          pointerEvents="none"
        />,
      );
      if (!combinadaAssign) continue;
      const keysInRow = dotPts.filter((d) => d.rowIndex === i).map((d) => d.key);
      const canPalette = typeof onFijacionPaletteBulk === "function" && keysInRow.length > 0;
      const canApoyoPop =
        Boolean(apoyoMateriales?.length) && typeof onApoyoMaterialDirect === "function";
      const canApoyoCycle =
        Boolean(apoyoMateriales?.length) && typeof onApoyoMaterialCycle === "function";
      const canZoneCycle = typeof onCombinadaZoneInteraction === "function" && keysInRow.length > 0;
      if (!canPalette && !canApoyoPop && !canApoyoCycle && !canZoneCycle) continue;
      const hitStroke = Math.max(0.22 * zm, canPalette ? 0.3 * zm : 0.22 * zm);
      supportLinesHit.push(
        <line
          key={`est-ap-hit-${r.gi}-${i}`}
          x1={r.x}
          y1={yy}
          x2={r.x + r.w}
          y2={yy}
          stroke="transparent"
          strokeWidth={hitStroke}
          pointerEvents="stroke"
          style={{ cursor: "pointer" }}
          onPointerDown={(ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            if (canPalette) {
              setApoyoMatPick(null);
              setFijPalette({
                left: ev.clientX + 10,
                top: ev.clientY + 6,
                keys: keysInRow,
                title: i === 0 || i === n - 1 ? "Línea de apoyo (perímetro)" : "Línea de apoyo (intermedia)",
                subtitle: `${keysInRow.length} punto(s) en esta fila`,
              });
              return;
            }
            setFijPalette(null);
            if (canApoyoPop) {
              setApoyoMatPick({ rowIndex: i, left: ev.clientX + 10, top: ev.clientY + 6 });
              return;
            }
            if (canApoyoCycle) {
              onApoyoMaterialCycle(r.gi, i);
              return;
            }
            if (canZoneCycle) {
              onCombinadaZoneInteraction(r.gi, (prev) => {
                const first = prev[keysInRow[0]] || "metal";
                const nm = cycleCombinadaMaterial(first);
                const next = { ...prev };
                for (const k of keysInRow) next[k] = nm;
                return next;
              });
            }
          }}
        />,
      );
    }
  }

  const dotKeys = dotPts.map((d) => d.key);
  const canToggleDots = !combinadaAssign && typeof onDotToggleEnabled === "function";
  const mergedByKey =
    combinadaAssign && apoyoMateriales && apoyoMateriales.length
      ? Object.fromEntries(dotPts.map((d) => [d.key, d.rowIndex >= 0 && d.rowIndex < apoyoMateriales.length ? (apoyoMateriales[d.rowIndex] || "metal") : "metal"]))
      : combinadaAssign && typeof onCombinadaZoneInteraction === "function"
        ? mergeCombinadaByKeyWithDefaults(
            dotKeys,
            combinadaByKey && typeof combinadaByKey === "object" ? combinadaByKey : {},
            combinadaPtsH,
            combinadaPtsMetal,
            combinadaPtsMadera,
          )
        : canToggleDots
          ? Object.fromEntries(dotKeys.map((k) => [k, tipoEst || "metal"]))
          : {};

  const wStrip = Math.min(0.35, Math.max(0.08, r.w * 0.14));
  const hStrip = Math.min(0.35, Math.max(0.08, r.h * 0.12));
  const perimeterBands =
    combinadaAssign &&
    rows >= 2 &&
    (typeof onFijacionPaletteBulk === "function" || typeof onCombinadaZoneInteraction === "function")
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
  const cantPanelesHint = Math.max(1, Math.round(Number(hints.cantPaneles)) || 1);
  const gridExpl =
    hints.fijacionDotsMode === "isodec_grid"
      ? `Puntos en planta: ${dotPts.length} (grilla ISODEC: 2/panel en perímetro, 1/panel centrado en apoyos intermedios${perimV > 0 ? `; +${perimV} en laterales de perímetro (~cada ${Number(hints.fijacionEspaciadoPerimetroM) || 2.5} m)` : ""}).${cantPanelesHint >= 2 ? ` Con ${cantPanelesHint} paneles en ancho, las líneas verticales entre columnas son solo referencia visual (no se seleccionan).` : ""} Total cómputo ${totalFij} (base ${grillaFij}${perimV > 0 ? ` + lateral ${perimV}` : ""}). El presupuesto aplica por material: hormigón → tacos + tuerca simple; metal/madera → varilla roscada + tuercas dobles y arandela plana; madera usa tramo de rosca distinto al metal/hormigón.`
      : `Puntos en planta: ${dotPts.length} (reparto en líneas de apoyo; ${totalFij} unidades de cómputo).${cantPanelesHint >= 2 ? ` Con ${cantPanelesHint} paneles, las juntas verticales en planta son solo referencia (no seleccionables).` : ""} En varilla/tuerca, el listado inferior sigue los puntos activos por material (hormigón: tacos; metal/madera: varilla + tuercas según reglas ISODEC).`;
  const dotR = 0.032 * zm;
  const hitR = Math.max(0.048 * zm, dotR * 2.35);

  const bandPaletteTitle = (k) => {
    if (k === "perim-top") return "Perímetro superior";
    if (k === "perim-bot") return "Perímetro inferior";
    if (k === "perim-left") return "Perímetro izquierdo";
    return "Perímetro derecho";
  };

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
              ev.stopPropagation();
              ev.preventDefault();
              setApoyoMatPick(null);
              const keysPick = band.pick(dotPts);
              if (!keysPick.length) return;
              if (typeof onFijacionPaletteBulk === "function") {
                setFijPalette({
                  left: ev.clientX + 10,
                  top: ev.clientY + 6,
                  keys: keysPick,
                  title: bandPaletteTitle(band.key),
                  subtitle: `${keysPick.length} punto(s) en este borde`,
                });
                return;
              }
              if (typeof onCombinadaZoneInteraction !== "function") return;
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
            const resolved = (combinadaAssign || canToggleDots)
              ? resolveDotState(d.key, mergedByKey, dotOverrides)
              : { mat: tipoEst || "metal", enabled: true };
            const { mat, enabled } = resolved;
            const fill = (combinadaAssign || canToggleDots) ? combinadaMaterialFill(mat) : "#1e293b";
            const xSz = dotR * 0.7;
            return (
              <g key={`fij-dot-${r.gi}-${d.key}`} opacity={enabled ? 1 : 0.14}>
                <circle
                  cx={d.cx}
                  cy={d.cy}
                  r={hitR}
                  fill="transparent"
                  style={{ cursor: (combinadaAssign || canToggleDots) ? "pointer" : "default" }}
                  onMouseEnter={showPopoverAt}
                  onMouseLeave={scheduleHidePopover}
                  aria-label={
                    combinadaAssign
                      ? (typeof onFijacionPaletteBulk === "function"
                        ? `Material: ${mat}${enabled ? "" : " (no incluido)"}. Clic: ${enabled ? "quitar" : "incluir"} del cómputo. Mayús+clic o pulsación larga: elegir material. Clic derecho: ${enabled ? "quitar" : "incluir"}.`
                        : `Material: ${mat}${enabled ? "" : " (removido)"}. Clic para cambiar material. Clic derecho para ${enabled ? "remover" : "restaurar"}.`)
                      : canToggleDots
                        ? `Fijación (${mat})${enabled ? "" : " — no incluida"}. Clic para ${enabled ? "quitar" : "incluir"} del cómputo.`
                        : "Ver productos de fijación incluidos en la cotización"
                  }
                  onPointerDown={(ev) => {
                    if (canToggleDots) {
                      ev.stopPropagation();
                      ev.preventDefault();
                      onDotToggleEnabled(r.gi, d.key);
                      return;
                    }
                    if (!combinadaAssign) return;
                    ev.stopPropagation();
                    ev.preventDefault();
                    setApoyoMatPick(null);
                    if (typeof onFijacionPaletteBulk === "function" && typeof onDotToggleEnabled === "function") {
                      if (ev.shiftKey) {
                        clearDotPointerTimer();
                        setFijPalette({
                          left: ev.clientX + 10,
                          top: ev.clientY + 6,
                          keys: [d.key],
                          title: "Punto de fijación",
                          subtitle: `Zona ${(typeof r.gi === "number" ? r.gi : 0) + 1}`,
                        });
                        return;
                      }
                      clearDotPointerTimer();
                      const dotKeyFull = `${r.gi}:${d.key}`;
                      dotPointerRef.current.key = dotKeyFull;
                      dotPointerRef.current.longFired = false;
                      dotPointerRef.current.timer = window.setTimeout(() => {
                        dotPointerRef.current.longFired = true;
                        dotPointerRef.current.timer = null;
                        dotPointerRef.current.key = null;
                        setFijPalette({
                          left: ev.clientX + 10,
                          top: ev.clientY + 6,
                          keys: [d.key],
                          title: "Punto de fijación",
                          subtitle: `Zona ${(typeof r.gi === "number" ? r.gi : 0) + 1}`,
                        });
                      }, 450);
                      try {
                        ev.currentTarget.setPointerCapture(ev.pointerId);
                      } catch { /* ignore */ }
                      return;
                    }
                    if (typeof onFijacionPaletteBulk === "function") {
                      setFijPalette({
                        left: ev.clientX + 10,
                        top: ev.clientY + 6,
                        keys: [d.key],
                        title: "Punto de fijación",
                        subtitle: `Zona ${(typeof r.gi === "number" ? r.gi : 0) + 1}`,
                      });
                      return;
                    }
                    if (typeof onDotCycleMaterial === "function") {
                      onDotCycleMaterial(r.gi, d.key);
                    } else if (typeof onCombinadaZoneInteraction === "function") {
                      onCombinadaZoneInteraction(r.gi, (prev) => {
                        const next = { ...prev };
                        next[d.key] = cycleCombinadaMaterial(prev[d.key] || "metal");
                        return next;
                      });
                    }
                  }}
                  onPointerUp={(ev) => {
                    if (!combinadaAssign || typeof onFijacionPaletteBulk !== "function" || typeof onDotToggleEnabled !== "function") return;
                    const dotKeyFull = `${r.gi}:${d.key}`;
                    if (dotPointerRef.current.key !== dotKeyFull) return;
                    dotPointerRef.current.key = null;
                    if (dotPointerRef.current.timer != null) {
                      window.clearTimeout(dotPointerRef.current.timer);
                      dotPointerRef.current.timer = null;
                      if (!dotPointerRef.current.longFired) onDotToggleEnabled(r.gi, d.key);
                    }
                    dotPointerRef.current.longFired = false;
                    try {
                      if (ev.currentTarget.hasPointerCapture?.(ev.pointerId)) {
                        ev.currentTarget.releasePointerCapture(ev.pointerId);
                      }
                    } catch { /* ignore */ }
                  }}
                  onPointerCancel={(ev) => {
                    clearDotPointerTimer();
                    try {
                      if (ev.currentTarget.hasPointerCapture?.(ev.pointerId)) {
                        ev.currentTarget.releasePointerCapture(ev.pointerId);
                      }
                    } catch { /* ignore */ }
                  }}
                  onContextMenu={(ev) => {
                    if ((!combinadaAssign && !canToggleDots) || typeof onDotToggleEnabled !== "function") return;
                    ev.stopPropagation();
                    ev.preventDefault();
                    clearDotPointerTimer();
                    onDotToggleEnabled(r.gi, d.key);
                  }}
                />
                <circle
                  cx={d.cx}
                  cy={d.cy}
                  r={dotR}
                  fill={enabled ? fill : "transparent"}
                  stroke={enabled ? "#f8fafc" : fill}
                  strokeWidth={0.012 * zm}
                  strokeDasharray={enabled ? "none" : `${0.04 * zm} ${0.03 * zm}`}
                  opacity={0.92}
                  pointerEvents="none"
                />
                {!enabled && (
                  <>
                    <line
                      x1={d.cx - xSz} y1={d.cy - xSz}
                      x2={d.cx + xSz} y2={d.cy + xSz}
                      stroke={fill} strokeWidth={0.012 * zm} pointerEvents="none"
                    />
                    <line
                      x1={d.cx + xSz} y1={d.cy - xSz}
                      x2={d.cx - xSz} y2={d.cy + xSz}
                      stroke={fill} strokeWidth={0.012 * zm} pointerEvents="none"
                    />
                  </>
                )}
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
      <CombinadaApoyoMaterialPopover
        anchor={apoyoMatPick}
        zonaLabel={`Zona ${(typeof r.gi === "number" ? r.gi : 0) + 1}`}
        rowLabel={
          apoyoMatPick && apoyoMateriales?.length
            ? `Línea de apoyo ${apoyoMatPick.rowIndex + 1}${
                apoyoMatPick.rowIndex === 0 || apoyoMatPick.rowIndex === apoyoMateriales.length - 1
                  ? " (perímetro)"
                  : " (intermedio)"
              }`
            : ""
        }
        popRef={apoyoMatPopRef}
        onPick={(mat) => {
          setFijPalette(null);
          if (apoyoMatPick && typeof onApoyoMaterialDirect === "function") {
            onApoyoMaterialDirect(apoyoMatPick.rowIndex, mat);
          }
          setApoyoMatPick(null);
        }}
        onRowDisable={
          typeof onFijacionPaletteBulk === "function" && apoyoMatPick
            ? () => {
                const pts = fijacionDotsLayout(r, hints, exterior);
                const keysInRow = pts
                  .filter((p) => p.rowIndex === apoyoMatPick.rowIndex)
                  .map((p) => p.key);
                if (keysInRow.length) onFijacionPaletteBulk(r.gi, keysInRow, { type: "disable" });
                setApoyoMatPick(null);
                setFijPalette(null);
              }
            : undefined
        }
      />
      <CombinadaFijacionDotsPalettePopover
        anchor={fijPalette}
        title={fijPalette?.title || ""}
        subtitle={fijPalette?.subtitle || ""}
        popRef={fijPalettePopRef}
        onPickMat={(mat) => {
          if (!fijPalette || typeof onFijacionPaletteBulk !== "function") return;
          onFijacionPaletteBulk(r.gi, fijPalette.keys, { type: "mat", mat });
          setFijPalette(null);
        }}
        onDisable={() => {
          if (!fijPalette || typeof onFijacionPaletteBulk !== "function") return;
          onFijacionPaletteBulk(r.gi, fijPalette.keys, { type: "disable" });
          setFijPalette(null);
        }}
        onRestore={() => {
          if (!fijPalette || typeof onFijacionPaletteBulk !== "function") return;
          onFijacionPaletteBulk(r.gi, fijPalette.keys, { type: "restore" });
          setFijPalette(null);
        }}
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

function plantaBorderOptsForSideFiltered(side, panelFamiliaKey, extendido, cualquierFamilia, currentVal) {
  const fam = resolvePlantaBorderPanelFam(panelFamiliaKey);
  const all = BORDER_OPTIONS[side] || [];
  if (cualquierFamilia) return all;
  const byFamily = all.filter(o => !o.familias || o.familias.includes(fam));
  if (extendido) return byFamily;
  const filtered = byFamily.filter(o => o.id === "none" || !!PERFIL_TECHO[o.id]?.[fam]);
  if (currentVal && currentVal !== "none" && !filtered.find(o => o.id === currentVal)) {
    const ghost = byFamily.find(o => o.id === currentVal) ?? all.find(o => o.id === currentVal);
    if (ghost) filtered.push({ ...ghost, label: `${ghost.label} (no estándar)` });
  }
  return filtered;
}

/** Opciones de catálogo para un encuentro entre zonas (eje vertical = laterales; horizontal = fusión frente+fondo). */
function plantaBorderOptsForEncounter(orientation, panelFamiliaKey, extendido = false, cualquierFamilia = false) {
  const fam = resolvePlantaBorderPanelFam(panelFamiliaKey);
  if (orientation === "vertical") {
    return plantaBorderOptsForSideFiltered("latIzq", panelFamiliaKey, extendido, cualquierFamilia, null);
  }
  const seen = new Set();
  const out = [];
  for (const side of ["frente", "fondo"]) {
    for (const o of BORDER_OPTIONS[side] || []) {
      if (!cualquierFamilia && o.familias && !o.familias.includes(fam)) continue;
      if (!cualquierFamilia && !extendido && o.id !== "none" && !PERFIL_TECHO[o.id]?.[fam]) continue;
      if (seen.has(o.id)) continue;
      seen.add(o.id);
      out.push(o);
    }
  }
  return out;
}

/** Mapea id de BORDER_OPTIONS a overlay `encounter` por tramo. */
function segmentEncounterFromCatalogOption(optionId) {
  if (optionId == null || optionId === "" || optionId === "none") {
    return { tipo: "continuo", modo: "continuo", perfil: null, perfilVecino: null, cumbreraUnida: false };
  }
  if (optionId === "cumbrera") {
    return { tipo: "perfil", modo: "cumbrera", perfil: "cumbrera", perfilVecino: "cumbrera", cumbreraUnida: true };
  }
  return { tipo: "perfil", modo: "pretil", perfil: optionId, perfilVecino: optionId };
}

function catalogSelectValueFromSegmentNormalized(n) {
  if (!n || n.modo === "continuo") return "none";
  if (n.modo === "cumbrera") return "cumbrera";
  if (n.modo === "desnivel") return "__desnivel__";
  const p = n.perfil;
  return p && p !== "none" ? p : "none";
}

function encounterPairNeedsSplitProfiles(rawPair) {
  const n = normalizeEncounter(pairEncounterBaseRaw(rawPair));
  return n.modo === "pretil" || n.modo === "desnivel";
}

/** Effective slopeMark for a zone, falling back to root body's mark for lateral annexes. */
function effectiveSlopeMark(r, zonas) {
  if (r.z?.preview?.slopeMark) return r.z.preview.slopeMark;
  const rootGi = getLateralAnnexRootBodyGi(zonas, r.gi);
  return zonas[rootGi]?.preview?.slopeMark ?? "along_largo_pos";
}

/**
 * Arista multizona totalmente compartida: una sola UI si el encuentro no es pretil/desnivel;
 * si es pretil/desnivel, dos áreas (una por zona).
 */
function computePlantaSharedEdgeMeta(gi, side, multiZona, sharedSidesMap, plantRects, zonas) {
  const empty = {
    fully: false,
    hideDuplicate: false,
    split: false,
    neighborGi: null,
    neighborSide: null,
    pairKey: "",
    low: null,
    encNorm: normalizeEncounter(null),
    rawPair: null,
  };
  if (!multiZona || !sharedSidesMap?.get || !plantRects?.length) return empty;
  const fully = Boolean(sharedSidesMap.get(gi)?.get(side)?.fullySide);
  const { neighborGi, neighborSide } = resolveNeighborSharedSide(gi, side, plantRects);
  if (!fully || neighborGi == null || !neighborSide) {
    return { ...empty, neighborGi: neighborGi ?? null, neighborSide: neighborSide ?? null };
  }
  const pairKey = encounterPairKey(gi, neighborGi);
  const low = Math.min(gi, neighborGi);
  const rawPair = zonas[low]?.preview?.encounterByPair?.[pairKey];
  const encNorm = normalizeEncounter(pairEncounterBaseRaw(rawPair));
  const split = encounterPairNeedsSplitProfiles(rawPair);
  const ownerGi = Math.min(gi, neighborGi);
  const ownerSide = gi === ownerGi ? side : neighborSide;
  const hideDuplicate = !split && !(gi === ownerGi && side === ownerSide);
  return {
    fully: true,
    hideDuplicate,
    split,
    neighborGi,
    neighborSide,
    pairKey,
    low,
    encNorm,
    rawPair,
  };
}

function resolvePlantaBorderEffectiveValue(gi, side, multiZona, techoBorders, zonas, sharedSidesMap, plantRects) {
  const meta = computePlantaSharedEdgeMeta(gi, side, multiZona, sharedSidesMap, plantRects, zonas);
  if (meta.hideDuplicate) return "";
  if (meta.fully && !meta.split) {
    if (encounterEsContinuo(meta.encNorm)) return "none";
    const p = encounterBorderPerfil(meta.rawPair);
    return p && p !== "none" ? p : "none";
  }
  if (meta.fully && meta.split && meta.encNorm.modo === "pretil") {
    const v = gi === meta.low ? meta.encNorm.perfil : meta.encNorm.perfilVecino;
    return v && v !== "none" ? v : "";
  }
  if (meta.fully && meta.split && meta.encNorm.modo === "desnivel" && meta.encNorm.desnivel) {
    const d = meta.encNorm.desnivel;
    const v = gi === meta.low ? d.perfilBajo : d.perfilAlto;
    return v && v !== "none" ? v : "";
  }
  if (multiZona) {
    const zb = zonas[gi]?.preview?.borders ?? {};
    return zb[side] ?? techoBorders[side] ?? "";
  }
  return techoBorders[side] ?? "";
}

/**
 * Paso «Accesorios perimetrales»: bandas en planta (fondo=borde superior SVG, frente=inferior), misma convención que RoofBorderSelector / 3D.
 * Etiquetas de perfil centradas dentro de cada sub-franja (inline), sin texto fuera del plano.
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
  bordesPanelFamiliaKey = "",
  plantRects,
  exteriorIntervals = null,
}) {
  const zm = svgTy?.m ?? 1;
  const wStrip = Math.min(0.55, Math.max(0.12, r.w * 0.18));
  const hStrip = Math.min(0.55, Math.max(0.12, r.h * 0.16));
  const gi = r.gi;

  // ── Hover state local — sin afectar al padre ──
  const [hoveredSide, setHoveredSide] = useState(null);

  // Label corta para mostrar inline en la banda
  const SHORT_LABELS = {
    gotero_frontal:        "Gotero",
    gotero_frontal_greca:  "Greca",
    gotero_lateral:        "Lateral",
    gotero_lateral_camara: "Cámara",
    babeta_adosar:         "Babeta ↗",
    babeta_empotrar:       "Babeta ↙",
    canalon:               "Canalón",
    cumbrera:              "Cumbrera",
    none:                  "Sin perfil",
  };

  const frenteAtTop = effectiveSlopeMark(r, zonas) === "along_largo_neg";
  const SIDE_GEOM = {
    latIzq: "left",
    latDer: "right",
    fondo:  frenteAtTop ? "bottom" : "top",
    frente: frenteAtTop ? "top"    : "bottom",
  };
  const sideDefs = [
    { side: "latIzq",                          x: r.x - wStrip,   y: r.y,          w: wStrip, h: r.h    },
    { side: "latDer",                          x: r.x + r.w,      y: r.y,          w: wStrip, h: r.h    },
    { side: frenteAtTop ? "frente" : "fondo",  x: r.x,            y: r.y - hStrip, w: r.w,    h: hStrip },
    { side: frenteAtTop ? "fondo"  : "frente", x: r.x,            y: r.y + r.h,    w: r.w,    h: hStrip },
  ].flatMap(({ side, x, y, w, h }) => {
    const ivs = exteriorIntervals?.[SIDE_GEOM[side]];
    if (!ivs) return [{ side, x, y, w, h }]; // sin datos: comportamiento original
    if (ivs.length === 0) return []; // lado totalmente compartido: sin strip (el encuentro lo maneja)
    const isVert = side === "latIzq" || side === "latDer";
    // Verificar si el único intervalo cubre el lado completo
    if (ivs.length === 1) {
      const [a, b] = ivs[0];
      const fullA = isVert ? r.y : r.x;
      const fullB = isVert ? r.y + r.h : r.x + r.w;
      if (Math.abs(a - fullA) < 0.01 && Math.abs(b - fullB) < 0.01) {
        return [{ side, x, y, w, h }]; // Un solo intervalo completo: strip normal
      }
    }
    // Parcial o múltiple: dividir en sub-strips
    return ivs.map(([a, b], idx) =>
      isVert
        ? { side, x, y: a, w, h: b - a, _subIdx: idx }
        : { side, x: a, y, w: b - a, h, _subIdx: idx }
    );
  });

  const currentVal = (side) =>
    resolvePlantaBorderEffectiveValue(gi, side, multiZona, techoBorders, zonas, sharedSidesMap, plantRects);

  const isDisabled = (side) => !multiZona && (disabledSidesGlobal || []).includes(side);

  const labelProps = (x, y, w, h, isVert) => {
    const cx = x + w / 2;
    const cy = y + h / 2;
    // Constraining dimension: strip thickness (h for horiz bands, w for vert bands)
    const thick = isVert ? w : h;
    const fontSize = Math.max(0.044 * zm, Math.min(0.095 * zm, thick * 0.42));
    return { cx, cy, fontSize };
  };

  const resolveFullLabel = (side, val) => {
    if (!val || val === "none") return null;
    const opts = plantaBorderOptsForSide(side, bordesPanelFamiliaKey);
    const hit = opts.find((o) => o.id === val);
    return hit?.label ?? SHORT_LABELS[val] ?? val;
  };

  return (
    <g data-bmc-layer="planta-bordes-assign" pointerEvents="auto">
      {sideDefs.map(({ side, x, y, w, h, _subIdx }) => {
        const meta = computePlantaSharedEdgeMeta(gi, side, multiZona, sharedSidesMap, plantRects, zonas);
        if (meta.hideDuplicate) return null;
        const dis = isDisabled(side);
        const val = currentVal(side);
        const active = val && val !== "none";
        const isOpen = openGi === gi && openSide === side;
        const isHovered = hoveredSide === side && !dis;

        // Fill progresivo: idle → hover → open
        let fill = active
          ? "rgba(96,165,250,0.22)"
          : "rgba(147,197,253,0.12)";
        if (dis)       fill = "rgba(200,205,216,0.18)";
        if (isHovered) fill = active
          ? "rgba(96,165,250,0.48)"
          : "rgba(147,197,253,0.36)";
        if (isOpen)    fill = "rgba(59,130,246,0.50)";

        const stroke = isOpen
          ? C.primary
          : isHovered
            ? "#93c5fd"
            : active
              ? "rgba(37,99,235,0.55)"
              : "rgba(37,99,235,0.28)";

        const strokeW = isOpen
          ? 0.07 * zm
          : isHovered
            ? 0.055 * zm
            : 0.028 * zm;

        const isVertical = side === "latIzq" || side === "latDer";
        const { cx, cy, fontSize } = labelProps(x, y, w, h, isVertical);
        const textTransform = isVertical ? `rotate(-90, ${cx}, ${cy})` : undefined;
        const clipId = `clip-bd-${gi}-${side}${_subIdx != null ? `-${_subIdx}` : ""}`;
        const titleFull = (() => {
          if (dis && !multiZona && side === "fondo") return `${PLANTA_BORDER_SIDE_LABELS[side] || side} — Cumbrera`;
          const dl = resolveFullLabel(side, val) ?? (active ? val : null);
          if (!dl && !active) return `${PLANTA_BORDER_SIDE_LABELS[side] || side}`;
          return `${PLANTA_BORDER_SIDE_LABELS[side] || side} — ${dl || "Sin perfil"}`;
        })();

        const shortLabel = (() => {
          if (!active) return null;
          return resolveFullLabel(side, val) ?? val;
        })();

        // Minimum size to show label: avoid rendering unreadable text in tiny sub-strips
        const thick = isVertical ? w : h;
        const span = isVertical ? h : w;
        const showLabel = shortLabel && thick >= 0.06 && span >= fontSize * 1.8;

        return (
          <g key={`planta-bd-${gi}-${side}${_subIdx != null ? `-${_subIdx}` : ""}`}>
            <title>{titleFull}</title>
            <clipPath id={clipId}>
              <rect x={x} y={y} width={w} height={h} />
            </clipPath>
            {/* ── Banda hit area ── */}
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx={0.05 * zm}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeW}
              style={{
                cursor: dis ? "not-allowed" : "pointer",
                transition: "fill 120ms ease, stroke 120ms ease",
              }}
              onMouseEnter={() => { if (!dis) setHoveredSide(side); }}
              onMouseLeave={() => setHoveredSide(null)}
              onPointerDown={(ev) => {
                if (dis) return;
                ev.stopPropagation();
                ev.preventDefault();
                onStripPointerDown(ev, gi, side);
              }}
            />
            {/* ── Inline profile label, centered on this strip ── */}
            {showLabel && (
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontSize}
                fontWeight={isOpen ? 700 : 500}
                fill={isOpen ? "#1d4ed8" : "rgba(15,23,42,0.78)"}
                fontFamily={FONT}
                transform={textTransform}
                clipPath={`url(#${clipId})`}
                pointerEvents="none"
                style={{ userSelect: "none" }}
              >
                {shortLabel}
              </text>
            )}
            {/* ── "+" hint on hover when no value assigned ── */}
            {isHovered && !active && !isOpen && (
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontSize * 1.3}
                fill="rgba(147,197,253,0.75)"
                transform={textTransform}
                pointerEvents="none"
                style={{ userSelect: "none" }}
              >
                +
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
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
  const hatchId = `poche-${String(gradKey).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const hatchSpacing = 0.15 * (w > 3 ? 1 : 0.8);
  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.06" />
          <stop offset="50%" stopColor={C.primary} stopOpacity="0.04" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.1" />
        </linearGradient>
        <pattern id={hatchId} width={hatchSpacing} height={hatchSpacing}
          patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={hatchSpacing}
            stroke="#0071E3" strokeWidth={LINE_WEIGHTS.hatch} opacity={0.06} />
        </pattern>
      </defs>
      <rect x={x0} y={y0} width={w} height={h} fill={`url(#${gradId})`} rx={0.08} />
      <rect x={x0} y={y0} width={w} height={h} fill={`url(#${hatchId})`} rx={0.08} />
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
  pendienteModo: globalPendienteModo = "incluye_pendiente",
  globalAlturaDif = 0,
  selectedGi = null,
  onZonaDimensionPatch,
  onRemoveZona,
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: C.tp }}>
              Zona {formatZonaDisplayTitle(zonas, selectedGi)}
            </span>
            {onRemoveZona && zonas.length > 1 && (
              <button
                type="button"
                onClick={() => onRemoveZona(selectedGi)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "none",
                  background: C.dangerSoft,
                  color: C.danger,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Trash2 size={12} />Quitar
              </button>
            )}
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
            const zPm = r.z.pendienteModo ?? globalPendienteModo;
            const zPend = r.z.pendiente ?? pendiente;
            const zAlt = r.z.alturaDif ?? globalAlturaDif;
            const largoReal = calcLargoRealFromModo(r.z.largo, zPm, zPend, zAlt);
            const hasSlope = Math.abs(largoReal - r.z.largo) > 0.001;
            return (
              <div key={r.gi} style={{ marginBottom: hasSlope ? 6 : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                  <span style={{ color: C.ts }}>
                    {label}
                    <span style={{ fontSize: 10, display: "block", fontWeight: 500, marginTop: 2 }}>{zonaLabelPlanta(r)} en planta</span>
                  </span>
                  <strong style={{ color: C.tp, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{a.toFixed(1)} m²</strong>
                </div>
                {hasSlope && (
                  <div style={{ fontSize: 10, color: C.primary, fontWeight: 600, marginTop: 2 }}>
                    Largo panel: {largoReal.toFixed(2)} m
                    <span style={{ fontWeight: 400, color: C.ts }}> (proy. {r.z.largo.toFixed(2)} m)</span>
                  </div>
                )}
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
 * @param {boolean} [props.showPlantaExteriorCotas] - cotas de perímetro globales (trazo gris grafito; perímetro + encuentros) sin paso Estructura; p. ej. desde paso Dimensiones del wizard
 * @param {boolean} [props.embedMetricsSidebar] - false = sin columna de métricas (mostrar `RoofPreviewMetricsSidebar` en el wizard)
 * @param {number|null} [props.selectedZonaGi] - zona seleccionada si `embedMetricsSidebar` es false
 * @param {(gi: number|null) => void} [props.onSelectedZonaGiChange] - al elegir zona en el SVG (con métricas externas)
 * @param {boolean} [props.denseChrome] - true en visor embebido: menos padding y el bloque SVG crece con el host (flex + altura máxima)
 * @param {boolean} [props.combinadaFijacionAssign] - tipo Combinada + pasos con overlay de estructura: clic en 2D para materiales (multizona usa mapa por punto; una zona + apoyoMateriales usa líneas de apoyo)
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
 * @param {string[]|null} [props.apoyoMateriales] - per-apoyo material array (combinada mode)
 * @param {(gi: number, rowIndex: number) => void} [props.onApoyoMaterialCycle] - cycle apoyo material on click (si no hay `onApoyoMaterialDirect`)
 * @param {(rowIndex: number, mat: string) => void} [props.onApoyoMaterialDirect] - asignar material a una línea de apoyo (popover en el plano)
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
  onRemoveZona,
  onEncounterPairChange,
  onZonaDimensionPatch,
  pendienteModo: globalPendienteModoProp = "incluye_pendiente",
  globalAlturaDif: globalAlturaDifProp = 0,
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
  fijDotOverridesByGi = null,
  onFijDotOverridesSync = null,
  bordesPlantaAssign = false,
  bordesPanelFamiliaKey = "",
  bordesExtendido = false,
  bordesCualquierFamilia = false,
  techoBorders = null,
  onTechoBorderChange = null,
  onZonaBorderChange = null,
  apoyoMateriales = null,
  onApoyoMaterialCycle = null,
  onApoyoMaterialDirect = null,
  tipoEst = "metal",
}) {
  const panelAuForPickFp = Number(panelObj?.au ?? panelAu) || 0;
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const tapRef = useRef(null);
  const plantaBorderPopRef = useRef(null);
  /** Conserva el pick al entrar en modo lite perimetral (sin persistir en sessionStorage). */
  const plantaPanelPickBeforeLiteRef = useRef(null);
  const [plantaBorderPick, setPlantaBorderPick] = useState(null);
  const [plantaBorderPopoverStyle, setPlantaBorderPopoverStyle] = useState(null);
  const [dragOverlay, setDragOverlay] = useState(null);
  const [encounterPrompt, setEncounterPrompt] = useState(null);
  const [internalSelectedGi, setInternalSelectedGi] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  /** `${gi}:${strip.idx}` — inspección en planta (sin editar BOM). Hidrata desde sessionStorage si la huella coincide. */
  const [plantaPanelPick, setPlantaPanelPick] = useState(() => {
    if (typeof sessionStorage === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(PLANTA_PANEL_PICK_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.key !== "string") return null;
      const fp = plantaLayoutFingerprint(zonas, tipoAguas, panelAuForPickFp);
      if (parsed.fp !== fp) return null;
      return parsed.key.includes(":") ? parsed.key : null;
    } catch {
      return null;
    }
  });
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

  /** Perímetro azul por tramos: sin línea en juntas internas mismo cuerpo (`roofPlanEdgeSegments.js`). */
  const zoneBorderExteriorLines = useMemo(
    () => buildZoneBorderExteriorLines(layout.entries, zonas),
    [layout.entries, zonas],
  );

  /** Intervalos exteriores por zona para dividir border-strips en sub-strips (encuentro parcial). */
  const zoneBorderExteriorIntervals = useMemo(
    () => buildZoneBorderExteriorIntervals(layout.entries, zonas),
    [layout.entries, zonas],
  );

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
      const meta = computePlantaSharedEdgeMeta(
        gi,
        side,
        multiZonaBordes,
        bordesSharedSidesMap,
        layout.entries,
        zonas,
      );

      if (meta.fully && meta.pairKey && typeof onEncounterPairChange === "function") {
        const low = meta.low;
        const prevFull = zonas[low]?.preview?.encounterByPair?.[meta.pairKey];
        const seed = prevFull && typeof prevFull === "object" ? { ...prevFull } : {};
        const base = pairEncounterBaseRaw(prevFull || {});
        let nextFull = null;

        if (!meta.split) {
          if (optId === "none") {
            nextFull = {
              ...seed,
              ...base,
              tipo: "continuo",
              modo: "continuo",
              perfil: null,
              perfilVecino: null,
              cumbreraUnida: false,
            };
          } else {
            nextFull = {
              ...seed,
              ...base,
              tipo: "perfil",
              modo: "cumbrera",
              perfil: optId,
              perfilVecino: optId,
              cumbreraUnida: true,
            };
          }
        } else if (meta.encNorm.modo === "pretil") {
          const perf = base.perfil ?? "none";
          const pVec = base.perfilVecino ?? "none";
          let pSelf = perf;
          let pNbr = pVec;
          if (gi === meta.low) pSelf = optId;
          else pNbr = optId;
          nextFull = {
            ...seed,
            ...base,
            tipo: "perfil",
            modo: "pretil",
            perfil: pSelf,
            perfilVecino: pNbr,
          };
        } else if (meta.encNorm.modo === "desnivel") {
          const d0 = meta.encNorm.desnivel || {};
          const patch = gi === meta.low ? { perfilBajo: optId } : { perfilAlto: optId };
          const nextD = {
            perfilBajo: d0.perfilBajo ?? meta.encNorm.perfil ?? "none",
            perfilAlto: d0.perfilAlto ?? meta.encNorm.perfil ?? "none",
            ...patch,
          };
          const bom = nextD.perfilBajo || nextD.perfilAlto || "none";
          nextFull = {
            ...seed,
            ...base,
            tipo: "perfil",
            modo: "desnivel",
            perfil: bom,
            desnivel: nextD,
          };
        }

        if (nextFull) {
          onEncounterPairChange(meta.pairKey, nextFull);
          setPlantaBorderPick(null);
          setPlantaBorderPopoverStyle(null);
          return;
        }
      }

      if (multiZonaBordes && typeof onZonaBorderChange === "function") {
        onZonaBorderChange(gi, side, optId);
      } else if (typeof onTechoBorderChange === "function") {
        onTechoBorderChange(side, optId);
      }
      setPlantaBorderPick(null);
      setPlantaBorderPopoverStyle(null);
    },
    [
      plantaBorderPick,
      multiZonaBordes,
      onZonaBorderChange,
      onTechoBorderChange,
      bordesSharedSidesMap,
      layout.entries,
      zonas,
      onEncounterPairChange,
    ],
  );

  /** Suma ptsHorm / ptsMetal / ptsMadera de todas las zonas tras cambiar overrides en `changedGi` (multizona coherente con `calcFijacionesVarilla`). */
  const sumCombinadaPtsAllZonesForDotOverrides = useCallback(
    (changedGi, nextOverridesForGi) => {
      const ext = planEdges?.exterior ?? [];
      let ptsHorm = 0;
      let ptsMetal = 0;
      let ptsMadera = 0;
      const isCombinada = combinadaFijacionAssign || tipoEst === "combinada";
      for (const ent of layout.entries) {
        const g = ent.gi;
        const hz = estructuraHintsByGi?.[g];
        if (!hz) continue;
        const dts = fijacionDotsLayout(ent, hz, ext);
        const ks = dts.map((d) => d.key);
        const byKey = isCombinada
          ? mergeCombinadaByKeyWithDefaults(
              ks,
              (combinadaFijByGi && combinadaFijByGi[g]) || {},
              combinadaPtsH,
              combinadaPtsMetal,
              combinadaPtsMadera,
            )
          : Object.fromEntries(ks.map((k) => [k, tipoEst || "metal"]));
        const ov =
          g === changedGi
            ? nextOverridesForGi
            : (fijDotOverridesByGi && fijDotOverridesByGi[g]) || {};
        const c =
          ov && typeof ov === "object" && Object.keys(ov).length
            ? countPtsWithOverrides(dts, byKey, ov)
            : countCombinadaMaterialsInDots(dts, byKey);
        ptsHorm += c.ptsHorm;
        ptsMetal += c.ptsMetal;
        ptsMadera += c.ptsMadera;
      }
      return { ptsHorm, ptsMetal, ptsMadera };
    },
    [
      layout.entries,
      estructuraHintsByGi,
      planEdges,
      tipoEst,
      combinadaFijacionAssign,
      combinadaFijByGi,
      fijDotOverridesByGi,
      combinadaPtsH,
      combinadaPtsMetal,
      combinadaPtsMadera,
    ],
  );

  const handleCombinadaZoneInteraction = useCallback(
    (gi, updater) => {
      if (!combinadaFijacionAssign || typeof onCombinadaFijacionSync !== "function") return;
      const entry = layout.entries.find((e) => e.gi === gi);
      if (!entry) return;
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

      let ptsHorm = 0;
      let ptsMetal = 0;
      let ptsMadera = 0;
      for (const ent of layout.entries) {
        const g = ent.gi;
        const hz = estructuraHintsByGi?.[g];
        if (!hz) continue;
        const dts = fijacionDotsLayout(ent, hz, ext);
        const ks = dts.map((d) => d.key);
        const existing = (combinadaFijByGi && combinadaFijByGi[g]) || {};
        const byKey = mergeCombinadaByKeyWithDefaults(
          ks,
          g === gi ? next : existing,
          combinadaPtsH,
          combinadaPtsMetal,
          combinadaPtsMadera,
        );
        const ov = (fijDotOverridesByGi && fijDotOverridesByGi[g]) || {};
        const c =
          ov && typeof ov === "object" && Object.keys(ov).length
            ? countPtsWithOverrides(dts, byKey, ov)
            : countCombinadaMaterialsInDots(dts, byKey);
        ptsHorm += c.ptsHorm;
        ptsMetal += c.ptsMetal;
        ptsMadera += c.ptsMadera;
      }

      onCombinadaFijacionSync({
        byGi: { [gi]: next },
        ptsHorm,
        ptsMetal,
        ptsMadera,
      });
    },
    [
      combinadaFijacionAssign,
      onCombinadaFijacionSync,
      layout.entries,
      estructuraHintsByGi,
      planEdges,
      combinadaFijByGi,
      fijDotOverridesByGi,
      combinadaPtsH,
      combinadaPtsMetal,
      combinadaPtsMadera,
    ],
  );

  const handleDotCycleMaterial = useCallback(
    (gi, dotKey) => {
      if (typeof onFijDotOverridesSync !== "function") return;
      const entry = layout.entries.find((e) => e.gi === gi);
      if (!entry) return;
      const hints = estructuraHintsByGi?.[gi];
      if (!hints) return;
      const ext = planEdges?.exterior ?? [];
      const dots = fijacionDotsLayout(entry, hints, ext);
      const keys = dots.map((d) => d.key);
      const isCombinada = combinadaFijacionAssign || tipoEst === "combinada";
      const byKey = isCombinada
        ? mergeCombinadaByKeyWithDefaults(
            keys,
            (combinadaFijByGi && combinadaFijByGi[gi]) || {},
            combinadaPtsH,
            combinadaPtsMetal,
            combinadaPtsMadera,
          )
        : Object.fromEntries(keys.map((k) => [k, tipoEst || "metal"]));
      const prevOv = (fijDotOverridesByGi && fijDotOverridesByGi[gi]) || {};
      const nextOv = cycleDotMaterial(dotKey, byKey, prevOv);
      const c = sumCombinadaPtsAllZonesForDotOverrides(gi, nextOv);
      onFijDotOverridesSync({ gi, overrides: nextOv, ...c });
    },
    [
      onFijDotOverridesSync,
      sumCombinadaPtsAllZonesForDotOverrides,
      layout.entries,
      estructuraHintsByGi,
      planEdges,
      tipoEst,
      combinadaFijacionAssign,
      combinadaFijByGi,
      fijDotOverridesByGi,
      combinadaPtsH,
      combinadaPtsMetal,
      combinadaPtsMadera,
    ],
  );

  const handleDotToggleEnabled = useCallback(
    (gi, dotKey) => {
      if (typeof onFijDotOverridesSync !== "function") return;
      const entry = layout.entries.find((e) => e.gi === gi);
      if (!entry) return;
      const hints = estructuraHintsByGi?.[gi];
      if (!hints) return;
      const ext = planEdges?.exterior ?? [];
      const dots = fijacionDotsLayout(entry, hints, ext);
      const keys = dots.map((d) => d.key);
      const isCombinada = combinadaFijacionAssign || tipoEst === "combinada";
      const byKey = isCombinada
        ? mergeCombinadaByKeyWithDefaults(
            keys,
            (combinadaFijByGi && combinadaFijByGi[gi]) || {},
            combinadaPtsH,
            combinadaPtsMetal,
            combinadaPtsMadera,
          )
        : Object.fromEntries(keys.map((k) => [k, tipoEst || "metal"]));
      const prevOv = (fijDotOverridesByGi && fijDotOverridesByGi[gi]) || {};
      const nextOv = toggleDotEnabled(dotKey, byKey, prevOv);
      const c = sumCombinadaPtsAllZonesForDotOverrides(gi, nextOv);
      onFijDotOverridesSync({ gi, overrides: nextOv, ...c });
    },
    [
      onFijDotOverridesSync,
      sumCombinadaPtsAllZonesForDotOverrides,
      layout.entries,
      estructuraHintsByGi,
      planEdges,
      tipoEst,
      combinadaFijacionAssign,
      combinadaFijByGi,
      fijDotOverridesByGi,
      combinadaPtsH,
      combinadaPtsMetal,
      combinadaPtsMadera,
    ],
  );

  const handleFijacionPaletteBulk = useCallback(
    (gi, keys, action) => {
      if (typeof onFijDotOverridesSync !== "function" || !keys?.length) return;
      const entry = layout.entries.find((e) => e.gi === gi);
      if (!entry) return;
      const hints = estructuraHintsByGi?.[gi];
      if (!hints) return;
      const ext = planEdges?.exterior ?? [];
      const dots = fijacionDotsLayout(entry, hints, ext);
      const allKeys = dots.map((d) => d.key);
      const isCombinada = combinadaFijacionAssign || tipoEst === "combinada";
      const byKey = isCombinada
        ? mergeCombinadaByKeyWithDefaults(
            allKeys,
            (combinadaFijByGi && combinadaFijByGi[gi]) || {},
            combinadaPtsH,
            combinadaPtsMetal,
            combinadaPtsMadera,
          )
        : Object.fromEntries(allKeys.map((k) => [k, tipoEst || "metal"]));
      const prevOv = (fijDotOverridesByGi && fijDotOverridesByGi[gi]) || {};
      let nextOv = prevOv;
      if (action?.type === "restore") {
        nextOv = stripDotOverrideKeys(prevOv, keys);
      } else if (action?.type === "disable") {
        nextOv = bulkDisableDots(keys, byKey, prevOv);
      } else if (action?.type === "mat" && action.mat) {
        nextOv = bulkSetDotsMaterialEnabled(keys, action.mat, byKey, prevOv);
      } else {
        return;
      }
      const c = sumCombinadaPtsAllZonesForDotOverrides(gi, nextOv);
      onFijDotOverridesSync({ gi, overrides: nextOv, ...c });
    },
    [
      onFijDotOverridesSync,
      sumCombinadaPtsAllZonesForDotOverrides,
      layout.entries,
      estructuraHintsByGi,
      planEdges,
      tipoEst,
      combinadaFijacionAssign,
      combinadaFijByGi,
      fijDotOverridesByGi,
      combinadaPtsH,
      combinadaPtsMetal,
      combinadaPtsMadera,
    ],
  );

  const svgTy = useMemo(() => buildRoofPlanSvgTypography(layout.viewMetrics), [layout.viewMetrics]);

  /** Margen SVG y leyenda: cotas de planta (gris grafito) y/o overlay completo Estructura. */
  const plantaCotaChromeActive = estructuraHintsByGi != null || showPlantaExteriorCotas;
  /** Paso accesorios perimetrales: simplificar interior (cadena mm, L×W, T-xx); mantener cotas exteriores. */
  const plantaPerimeterLiteMode = Boolean(bordesPlantaAssign && bordesPlantaHandlersOk);
  const showPlantaDimensionChrome =
    plantaCotaChromeActive || plantaPerimeterLiteMode;

  const effectivePanelAu = panelObj?.au ?? panelAu;

  /**
   * `buildPanelLayout` solo usa `panel.au`. Sin `panelObj` del catálogo (p. ej. paso temprano),
   * igual armamos layout con `effectivePanelAu` para que no queden solo cotas de perímetro y parezca
   * que “falta” la cadena mm / etiquetas T-xx bajo las cotas de perímetro.
   */
  const layoutPanelSource = useMemo(() => {
    if (panelObj) return panelObj;
    if (effectivePanelAu > 0) return { au: effectivePanelAu };
    return null;
  }, [panelObj, effectivePanelAu]);

  const panelLayouts = useMemo(() => {
    if (!layoutPanelSource) return null;
    const is2A = tipoAguas === 'dos_aguas';
    // IDs T-xx únicos en toda la planta (misma secuencia que `layout.entries`), no reiniciar por zona.
    let globalPanelN = 1;
    return layout.entries.map((r) => {
      const ancho = is2A ? r.z.ancho / 2 : r.z.ancho;
      const built = buildPanelLayout({ panel: layoutPanelSource, largo: r.z.largo, ancho });
      const panels = built.panels.map((p) => ({
        ...p,
        id: `T-${String(globalPanelN++).padStart(2, '0')}`,
      }));
      return { gi: r.gi, layout: { ...built, panels } };
    });
  }, [layoutPanelSource, layout.entries, tipoAguas]);

  /** Lista global T-xx → metadatos para selector de inspección (solo lectura; no BOM). */
  const flatPlantaPanels = useMemo(() => {
    if (!panelLayouts?.length) return [];
    const rows = [];
    for (const { gi, layout: pl } of panelLayouts) {
      const r = layout.entries.find((e) => e.gi === gi);
      if (!r || !pl?.panels?.length) continue;
      const zPm = r.z.pendienteModo ?? globalPendienteModoProp;
      const zPend = r.z.pendiente ?? pendiente;
      const zAlt = r.z.alturaDif ?? globalAlturaDifProp;
      const largoReal = calcLargoRealFromModo(r.z.largo, zPm, zPend, zAlt);
      const zonaTitle = formatZonaDisplayTitle(zonas, gi);
      for (const p of pl.panels) {
        rows.push({
          key: `${gi}:${p.idx}`,
          id: p.id,
          gi,
          idx: p.idx,
          widthM: p.width,
          isCut: Boolean(p.isCut),
          largoPlanta: r.z.largo,
          largoReal,
          hasSlope: Math.abs(largoReal - r.z.largo) > 0.001,
          zonaTitle,
        });
      }
    }
    return rows;
  }, [panelLayouts, layout.entries, zonas, pendiente, globalPendienteModoProp, globalAlturaDifProp]);

  const plantaPanelHighlightRect = useMemo(() => {
    if (!plantaPanelPick || !panelLayouts) return null;
    const dash = plantaPanelPick.indexOf(":");
    if (dash < 0) return null;
    const gi = Number(plantaPanelPick.slice(0, dash));
    const idx = Number(plantaPanelPick.slice(dash + 1));
    if (!Number.isFinite(gi) || !Number.isFinite(idx)) return null;
    const pl = panelLayouts.find((x) => x.gi === gi);
    const r = layout.entries.find((e) => e.gi === gi);
    const strip = pl?.layout?.panels?.find((p) => p.idx === idx);
    if (!r || !strip) return null;
    return { x: r.x + strip.x0, y: r.y, w: strip.width, h: r.h };
  }, [plantaPanelPick, panelLayouts, layout.entries]);

  const selectedPlantaPanelMeta = useMemo(() => {
    if (!plantaPanelPick) return null;
    return flatPlantaPanels.find((p) => p.key === plantaPanelPick) ?? null;
  }, [plantaPanelPick, flatPlantaPanels]);

  useEffect(() => {
    if (plantaPerimeterLiteMode) {
      setPlantaPanelPick((prev) => {
        if (prev != null && prev !== "") plantaPanelPickBeforeLiteRef.current = prev;
        return null;
      });
      return;
    }
    const saved = plantaPanelPickBeforeLiteRef.current;
    plantaPanelPickBeforeLiteRef.current = null;
    if (saved != null && saved !== "") {
      setPlantaPanelPick(saved);
    }
  }, [plantaPerimeterLiteMode]);

  useEffect(() => {
    if (layout.entries.length === 0) {
      setPlantaPanelPick(null);
      try {
        if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(PLANTA_PANEL_PICK_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [layout.entries.length]);

  useEffect(() => {
    if (!plantaPanelPick) return;
    if (!flatPlantaPanels.some((p) => p.key === plantaPanelPick)) setPlantaPanelPick(null);
  }, [plantaPanelPick, flatPlantaPanels]);

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    if (plantaPerimeterLiteMode) return;
    const fp = plantaLayoutFingerprint(zonas, tipoAguas, panelAuForPickFp);
    if (!plantaPanelPick) {
      try {
        sessionStorage.removeItem(PLANTA_PANEL_PICK_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      sessionStorage.setItem(
        PLANTA_PANEL_PICK_STORAGE_KEY,
        JSON.stringify({ v: 1, fp, key: plantaPanelPick }),
      );
    } catch {
      /* ignore quota */
    }
  }, [plantaPanelPick, plantaPerimeterLiteMode, zonas, tipoAguas, panelAuForPickFp]);

  const cotaObstacles = useMemo(() => {
    if (!showPlantaDimensionChrome) return [];
    return computeCotaObstacles(planEdges?.exterior ?? [], planEdges?.encounters ?? [], svgTy);
  }, [showPlantaDimensionChrome, planEdges, svgTy]);

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

  /**
   * ViewBox ampliado + marco útil para chrome (escala, título) sin superponer cotas/cadena.
   * `chrome.minX` / `chrome.maxY` coinciden con el rectángulo SVG expandido.
   */
  const svgFrame = useMemo(() => {
    const fallback = { viewBox: layout.viewBox, chrome: null };
    if (!layout.viewMetrics) return fallback;
    if (layout.entries.length === 0) return fallback;
    const chainActive = !!panelLayouts && !plantaPerimeterLiteMode;
    const bordesChrome = bordesPlantaAssign && bordesPlantaHandlersOk;
    /** Sin cadena ni chrome de cotas: vista compacta; si hace falta chrome exterior (p. ej. paso perimetral), usar rama con márgenes completos. */
    if (!plantaCotaChromeActive && !chainActive && !showPlantaDimensionChrome) {
      if (!bordesChrome) return fallback;
      const { vbX, vbY, vbW, vbH } = layout.viewMetrics;
      const bordesCap = Math.max(0.4 * svgTy.m, 0.28);
      const minX = vbX - bordesCap;
      const minY = vbY - bordesCap;
      return {
        viewBox: `${minX} ${minY} ${vbW + 2 * bordesCap} ${vbH + 2 * bordesCap}`,
        chrome: { minX, maxY: vbY + vbH + bordesCap, vbX, vbY, vbW, vbH },
      };
    }
    const { vbX, vbY, vbW, vbH } = layout.viewMetrics;
    const ext = planEdges?.exterior ?? [];
    const nSide = (side) => Math.min(8, ext.filter((s) => s.side === side).length);
    // No usar `svgTy.m` completo: inflaba el viewBox y achicaba el techo en pantalla. Cotas siguen en coords ampliadas.
    const vbPadScale = Math.min(1.22, Math.max(1, 0.62 + 0.22 * svgTy.m));
    const hasEnvelope = !!planEdges?.envelope && layout.entries.length > 0;
    const envExtra = hasEnvelope ? svgTy.dimStackStep * 1.6 : 0;
    const padL = (1.05 + nSide("left") * 0.14) * vbPadScale + envExtra;
    const padT = (0.55 + nSide("top") * 0.14) * vbPadScale;
    // chainPad: reserva espacio para chain dim lines (yEdge + dimStackBottom + 3×CHAIN_STEP)
    const chainPad = chainActive ? (svgTy.dimStackBottom ?? 0.3) + 0.56 : 0;
    // Banda inferior para la escala gráfica (evita solaparse con cadena mm / AU)
    const fontT = svgTy.dimFontTertiary ?? svgTy.dimFont * 0.72;
    const scaleBarBand =
      showPlantaDimensionChrome ? 0.06 * svgTy.m + fontT * 0.55 + 0.12 * svgTy.m : 0;
    const padB =
      (0.68 + nSide("bottom") * 0.14) * vbPadScale + chainPad + envExtra + scaleBarBand;
    const padR = (0.45 + nSide("right") * 0.14) * vbPadScale;
    /** Espacio extra para leyendas de accesorio perimetral fuera del rectángulo (planta 2D). */
    const bordesCap =
      bordesPlantaAssign && bordesPlantaHandlersOk ? Math.max(0.34 * svgTy.m, 0.22) : 0;
    const minX = vbX - padL - bordesCap;
    const maxY = vbY + vbH + padB + bordesCap;
    return {
      viewBox: `${minX} ${vbY - padT - bordesCap} ${vbW + padL + padR + 2 * bordesCap} ${vbH + padT + padB + 2 * bordesCap}`,
      chrome: { minX, maxY, vbX, vbY, vbW, vbH },
    };
  }, [
    layout.viewBox,
    layout.viewMetrics,
    layout.entries.length,
    plantaCotaChromeActive,
    plantaPerimeterLiteMode,
    showPlantaDimensionChrome,
    planEdges?.exterior,
    planEdges?.envelope,
    svgTy.m,
    svgTy.dimFont,
    svgTy.dimFontTertiary,
    svgTy.dimStackBottom,
    svgTy.dimStackStep,
    panelLayouts,
    bordesPlantaAssign,
    bordesPlantaHandlersOk,
  ]);

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
            const enc = missing[0];
            const [a, b] = enc.zoneIndices;
            const pk = encounterPairKey(a, b);
            if (enc.orientation === "horizontal" && tipoAguas === "dos_aguas") {
              onEncounterPairChange(pk, {
                tipo: "perfil",
                modo: "cumbrera",
                perfil: "cumbrera",
                perfilVecino: "cumbrera",
                cumbreraUnida: true,
              });
            }
            setEncounterPrompt({
              pairKey: pk,
              ga: a,
              gb: b,
              encounterLength: enc.length,
              orientation: enc.orientation,
            });
          }
        } catch {
          /* ignore */
        }
      }
      dragRef.current = null;
    },
    [cycleSlope, onEncounterPairChange, zonas, layout.entries, tipoAguas],
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
          {onRemoveZona && selectedGi != null && zonas.length > 1 && (
            <button
              type="button"
              onClick={() => onRemoveZona(selectedGi)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                color: C.danger,
                background: C.dangerSoft,
                border: "none",
                borderRadius: 8,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              <Trash2 size={12} />Quitar zona
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
      {showPlantaDimensionChrome && (
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
              cotas (gris grafito) = solo perímetro libre y longitud en cada encuentro; chip = resumen apoyos/pts fij.; pasá el cursor sobre un punto para ver los productos de fijación que entran en la cotización.
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
              <strong style={{ color: C.tp }}>Planta:</strong> cotas en gris grafito = perímetro libre y longitud en cada encuentro; la cadena de cotas en mm bajo el borde inferior = paños según el ancho útil (AU) del panel. Arrastrá las zonas para ubicarlas
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
            flexDirection: "column",
            gap: 10,
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {encounterPrompt.orientation === "horizontal" && tipoAguas === "dos_aguas" && (
            <div style={{ fontSize: 10, fontWeight: 700, color: "#1d4ed8", background: "#eff6ff", borderRadius: 6, padding: "4px 8px" }}>
              Encuentro horizontal — dos aguas · Modo recomendado: Cumbrera
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
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
          {(() => {
            const pk = encounterPrompt.pairKey;
            const low = Math.min(encounterPrompt.ga, encounterPrompt.gb);
            const rawPair = zonas[low]?.preview?.encounterByPair?.[pk];
            if (rawPair == null) return null;
            const encLenM = Number(encounterPrompt.encounterLength);
            const encOrientation = encounterPrompt.orientation === "horizontal" ? "horizontal" : "vertical";
            const encCatalogOpts = plantaBorderOptsForEncounter(encOrientation, bordesPanelFamiliaKey, bordesExtendido, bordesCualquierFamilia);
            const runs = listEncounterPairSegmentRuns(rawPair);
            const lenLabel = Number.isFinite(encLenM) && encLenM > 0 ? `${encLenM.toFixed(2)} m` : "—";
            return (
              <div
                style={{
                  borderTop: `1px solid ${C.border}`,
                  paddingTop: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: C.ts, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Tramos del encuentro · longitud {lenLabel}
                </div>
                <div style={{ fontSize: 10, color: C.ts, lineHeight: 1.35 }}>
                  Partí el encuentro en tramos y asigná un perfil del catálogo por tramo (p. ej. un tramo con babeta en la zona en contacto y otro con gotero donde no).
                </div>
                {runs.map((run) => {
                  const span = run.t1 - run.t0;
                  const lenM = Number.isFinite(encLenM) && encLenM > 0 ? encLenM * span : null;
                  const canSplit = span > 0.12;
                  const selVal = catalogSelectValueFromSegmentNormalized(run.normalized);
                  const catalogIds = new Set(encCatalogOpts.map((o) => o.id));
                  let selectValue = "none";
                  if (selVal === "__desnivel__") selectValue = "__desnivel__";
                  else if (selVal !== "none" && catalogIds.has(selVal)) selectValue = selVal;
                  else if (selVal !== "none" && selVal !== "__desnivel__") selectValue = selVal;
                  return (
                    <div
                      key={run.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        padding: "10px 10px",
                        borderRadius: 8,
                        border: `1px solid ${run.id === encounterPrompt?.segmentId ? "#0071E3" : C.border}`,
                        background: run.id === encounterPrompt?.segmentId ? "#EBF5FF" : C.surfaceAlt,
                      }}
                    >
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.tp }}>
                          Tramo {run.id}
                          <span style={{ fontWeight: 500, color: C.ts }}>
                            {" "}
                            · {(span * 100).toFixed(0)}%
                            {lenM != null ? ` (~${lenM.toFixed(2)} m)` : ""}
                          </span>
                        </span>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.tp, cursor: "pointer", marginLeft: "auto" }}>
                          <input
                            type="checkbox"
                            checked={run.includeInBom}
                            onChange={() => {
                              const next = patchEncounterPairSegment(rawPair, run.id, { includeInBom: !run.includeInBom });
                              onEncounterPairChange(pk, next);
                            }}
                          />
                          BOM
                        </label>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10, fontWeight: 600, color: C.ts, flex: "1 1 200px", minWidth: 0 }}>
                          Perfil (catálogo)
                          <select
                            value={selectValue}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "__desnivel__") return;
                              const encPatch = segmentEncounterFromCatalogOption(v);
                              const next = patchEncounterPairSegment(rawPair, run.id, { encounter: encPatch });
                              onEncounterPairChange(pk, next);
                            }}
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: C.tp,
                              padding: "6px 8px",
                              borderRadius: 6,
                              border: `1px solid ${C.border}`,
                              background: C.surface,
                              maxWidth: "100%",
                            }}
                          >
                            <option value="none">Continuo / sin perfil</option>
                            {encCatalogOpts.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                            {selVal !== "none" && selVal !== "__desnivel__" && !catalogIds.has(selVal) ? (
                              <option value={selVal}>Actual (id: {selVal})</option>
                            ) : null}
                            {selVal === "__desnivel__" ? (
                              <option value="__desnivel__">Desnivel (elegí otro valor para reemplazar)</option>
                            ) : null}
                          </select>
                        </label>
                        {selVal === "__desnivel__" ? (
                          <span style={{ fontSize: 10, color: C.ts, flex: "1 1 140px" }}>
                            Desnivel: usá los botones superiores o elegí un perfil único en el catálogo para reemplazar el tramo.
                          </span>
                        ) : null}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => {
                              const next = patchEncounterPairSegment(rawPair, run.id, {
                                encounter: { tipo: "continuo", modo: "continuo", perfil: null, perfilVecino: null, cumbreraUnida: false },
                              });
                              onEncounterPairChange(pk, next);
                            }}
                            style={{ fontSize: 10, fontWeight: 600, padding: "4px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: "#ecfdf5", color: "#166534", cursor: "pointer" }}
                          >
                            Continuo
                          </button>
                          {canSplit ? (
                            <button
                              type="button"
                              onClick={() => {
                                const next = splitEncounterPairSegmentMid(rawPair, run.id);
                                if (next) onEncounterPairChange(pk, next);
                              }}
                              style={{ fontSize: 10, fontWeight: 600, padding: "4px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.primary, cursor: "pointer" }}
                            >
                              Partir mitad
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
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
        Al tocar un encuentro nuevo, elegí tipo (continuo, pretil, cumbrera, desnivel); tocá la línea del encuentro para reabrir. Con encuentro ya definido: podés partir en tramos, marcar si cada tramo entra al BOM y elegir perfil del catálogo por tramo (laterales o frente/fondo según el eje del encuentro).
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
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
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
            {!plantaPerimeterLiteMode && flatPlantaPanels.length > 0 && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  flexShrink: 0,
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: denseChrome ? 8 : 10,
                  marginBottom: denseChrome ? 6 : 10,
                  padding: denseChrome ? "6px 8px" : "8px 10px",
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: C.surfaceAlt,
                  fontSize: denseChrome ? 11 : 12,
                  color: C.ts,
                }}
              >
                <label htmlFor="roof-planta-panel-select" style={{ fontWeight: 600, color: C.tp, marginRight: 2 }}>
                  Panel en planta
                </label>
                <select
                  id="roof-planta-panel-select"
                  aria-label="Seleccionar panel en planta"
                  value={plantaPanelPick ?? ""}
                  onChange={(ev) => {
                    const v = ev.target.value;
                    setPlantaPanelPick(v || null);
                  }}
                  style={{
                    minWidth: 120,
                    maxWidth: "100%",
                    flex: "0 1 240px",
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    fontSize: "inherit",
                    background: C.surface,
                    color: C.tp,
                  }}
                >
                  <option value="">— Ninguno —</option>
                  {flatPlantaPanels.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.id}
                      {p.isCut ? " ✂" : ""} · {p.zonaTitle}
                    </option>
                  ))}
                </select>
                {selectedPlantaPanelMeta && (
                  <span style={{ flex: "1 1 220px", minWidth: 0, lineHeight: 1.4 }}>
                    <span style={{ color: C.tp, fontWeight: 600 }}>
                      Largo eje{" "}
                      {selectedPlantaPanelMeta.hasSlope
                        ? `${selectedPlantaPanelMeta.largoReal.toFixed(2)} m`
                        : `${selectedPlantaPanelMeta.largoPlanta.toFixed(2)} m`}
                    </span>
                    {selectedPlantaPanelMeta.hasSlope && (
                      <span style={{ color: C.ts, fontWeight: 500 }}>
                        {" "}
                        (planta {selectedPlantaPanelMeta.largoPlanta.toFixed(2)} m)
                      </span>
                    )}
                    {" · "}
                    <span style={{ color: C.tp, fontWeight: 600 }}>
                      Franja {fmtDimMm(selectedPlantaPanelMeta.widthM)} mm
                    </span>
                    <span style={{ color: C.ts }}> ({selectedPlantaPanelMeta.widthM.toFixed(2)} m)</span>
                    {selectedPlantaPanelMeta.isCut ? (
                      <span style={{ color: C.warning, fontWeight: 700 }}> · Corte</span>
                    ) : null}
                    <span style={{ display: "block", fontSize: denseChrome ? 10 : 11, marginTop: 4, color: C.ts }}>
                      Solo inspección; cotización sigue en Dimensiones y BOM.
                    </span>
                  </span>
                )}
              </div>
            )}
            <svg
              ref={svgRef}
              data-bmc-capture="roof-plan-2d"
              viewBox={svgFrame.viewBox}
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid meet"
              style={{
                flex: 1,
                minHeight: 0,
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
            {encounters.flatMap((enc) => {
              const [ga, gb] = enc.zoneIndices;
              const pk = encounterPairKey(ga, gb);
              const low = Math.min(ga, gb);
              const rawPair = zonas[low]?.preview?.encounterByPair?.[pk];
              const runs = listEncounterPairSegmentRuns(rawPair ?? {});
              const lines = runs.flatMap((run) => {
                const p0 = encInterp(enc, run.t0);
                const p1 = encInterp(enc, run.t1);
                const isContinuo = run.normalized.modo === "continuo";
                const isActive = encounterPrompt?.pairKey === pk && encounterPrompt?.segmentId === run.id;
                const showContinuoEditGuide = isContinuo && isActive;
                const stroke = showContinuoEditGuide
                  ? C.primary
                  : isContinuo
                    ? "rgba(0,0,0,0)"
                    : encounterStrokeForModo(run.normalized.modo);
                const baseW = (isActive ? 2.2 : 1) * LINE_WEIGHTS.encounter * svgTy.m;
                const lineEl = (
                  <line
                    key={`${enc.id}-${run.id}`}
                    x1={p0.x}
                    y1={p0.y}
                    x2={p1.x}
                    y2={p1.y}
                    stroke={stroke}
                    strokeWidth={isContinuo && !showContinuoEditGuide ? Math.max(baseW * 2.4, 0.22 * svgTy.m) : baseW}
                    strokeDasharray={
                      isContinuo && !showContinuoEditGuide ? "none" : `${0.16 * svgTy.m} ${0.1 * svgTy.m}`
                    }
                    pointerEvents="stroke"
                    opacity={isContinuo && !showContinuoEditGuide ? 1 : run.includeInBom ? 0.95 : 0.35}
                    style={{ cursor: onEncounterPairChange ? "pointer" : undefined }}
                    onPointerDown={(ev) => {
                      if (!onEncounterPairChange) return;
                      ev.stopPropagation();
                      setEncounterPrompt({
                        pairKey: pk,
                        ga,
                        gb,
                        encounterLength: enc.length,
                        orientation: enc.orientation,
                        segmentId: run.id,
                      });
                    }}
                  />
                );
                // Per-tramo profile label: shown inline on each non-continuo segment.
                const perfilLabel = !isContinuo ? encounterPerfilLabel(run.normalized) : null;
                const segLenM = enc.length * (run.t1 - run.t0);
                const labelFs = svgTy.encFont * 0.82;
                const minSegForLabel = perfilLabel ? labelFs * perfilLabel.length * 0.52 : 0;
                const labelEl = perfilLabel && segLenM >= minSegForLabel ? (() => {
                  const mx = (p0.x + p1.x) / 2;
                  const my = (p0.y + p1.y) / 2;
                  const isVert = enc.orientation === "vertical";
                  const offX = isVert ? svgTy.encOffX * 0.7 : 0;
                  const offY = isVert ? 0 : -svgTy.encOffY * 0.7;
                  const labelColor = encounterStrokeForModo(run.normalized.modo);
                  return (
                    <text
                      key={`${enc.id}-${run.id}-label`}
                      x={mx + offX}
                      y={my + offY}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={labelFs}
                      fontWeight={600}
                      fontFamily={FONT}
                      fill={labelColor}
                      stroke="#ffffff"
                      strokeWidth={svgTy.encStroke * 1.1}
                      paintOrder="stroke"
                      pointerEvents="none"
                      opacity={run.includeInBom ? 0.92 : 0.45}
                    >
                      {perfilLabel}
                    </text>
                  );
                })() : null;
                return labelEl ? [lineEl, labelEl] : [lineEl];
              });
              // Boundary markers between segments (skip t=0 and t=1 endpoints)
              const markers = runs.length > 1
                ? runs.slice(1).map((run) => {
                    const pt = encInterp(enc, run.t0);
                    return (
                      <circle
                        key={`${enc.id}-boundary-${run.id}`}
                        cx={pt.x}
                        cy={pt.y}
                        r={0.07 * svgTy.m}
                        fill="#fff"
                        stroke="#64748b"
                        strokeWidth={0.025 * svgTy.m}
                        pointerEvents="none"
                      />
                    );
                  })
                : [];
              return [...lines, ...markers];
            })}
            {layout.entries.map((r) => {
              const sm = r.z.preview?.slopeMark;
              const showSlope = sm === "along_largo_pos" || sm === "along_largo_neg";
              const zm = svgTy.m;
              const fs = Math.max(0.2 * zm, Math.min(0.38 * zm, r.w * 0.125 * Math.min(zm, 1.2)));
              const annex = isLateralAnnexZona(r.z);
              const canDrag = Boolean(onZonaPreviewChange);
              const zoneOutline = zoneBorderExteriorLines[r.gi] ?? [];
              const showAnnexCtl = annex && onAnnexRankSwap;
              const showEstructuraOverlay =
                estructuraHintsByGi != null &&
                estructuraHintsByGi[r.gi] &&
                !(bordesPlantaAssign && bordesPlantaHandlersOk);
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
                    strokeW={LINE_WEIGHTS.panelJoint * svgTy.m}
                    gradKey={`z-${r.gi}`}
                  />
                  <g
                    pointerEvents="none"
                    stroke={C.primary}
                    strokeWidth={LINE_WEIGHTS.zoneBorder * svgTy.m}
                    fill="none"
                    strokeLinecap="square"
                    opacity={0.92}
                  >
                    {zoneOutline.map((ln, li) => (
                      <line key={`zb-${r.gi}-${li}`} x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2} />
                    ))}
                  </g>
                  {showEstructuraOverlay ? (
                    <EstructuraZonaOverlay
                      r={r}
                      hints={estructuraHintsByGi[r.gi]}
                      svgTy={svgTy}
                      exterior={planEdges?.exterior ?? []}
                      combinadaAssign={combinadaFijacionAssign}
                      combinadaByKey={combinadaFijByGi?.[r.gi] ?? null}
                      combinadaPtsH={combinadaPtsH}
                      combinadaPtsMetal={combinadaPtsMetal}
                      combinadaPtsMadera={combinadaPtsMadera}
                      onCombinadaZoneInteraction={handleCombinadaZoneInteraction}
                      dotOverrides={fijDotOverridesByGi?.[r.gi] ?? null}
                      onDotCycleMaterial={handleDotCycleMaterial}
                      onDotToggleEnabled={handleDotToggleEnabled}
                      apoyoMateriales={combinadaSingleZona ? apoyoMateriales : null}
                      onApoyoMaterialCycle={combinadaSingleZona ? onApoyoMaterialCycle : null}
                      onApoyoMaterialDirect={combinadaSingleZona ? onApoyoMaterialDirect : null}
                      onFijacionPaletteBulk={typeof onFijDotOverridesSync === "function" ? handleFijacionPaletteBulk : null}
                      tipoEst={tipoEst}
                    />
                  ) : null}
                  {!showEstructuraOverlay && !plantaPerimeterLiteMode ? (
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
                    <>
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
                        bordesPanelFamiliaKey={bordesPanelFamiliaKey}
                        plantRects={layout.entries}
                        exteriorIntervals={zoneBorderExteriorIntervals[r.gi] ?? null}
                      />
                    </>
                  ) : null}
                </g>
              );
            })}
            {plantaPanelHighlightRect && !plantaPerimeterLiteMode && (
              <g pointerEvents="none" data-bmc-layer="planta-panel-focus">
                <rect
                  x={plantaPanelHighlightRect.x}
                  y={plantaPanelHighlightRect.y}
                  width={plantaPanelHighlightRect.w}
                  height={plantaPanelHighlightRect.h}
                  fill={C.warningSoft}
                  stroke={C.warning}
                  strokeWidth={0.09 * svgTy.m}
                  rx={0.1}
                  opacity={0.88}
                />
              </g>
            )}
            {panelLayouts && !plantaPerimeterLiteMode && layout.entries.map((r) => {
              const pl = panelLayouts.find((x) => x.gi === r.gi);
              if (!pl) return null;
              return (
                <g key={`panel-overlay-${r.gi}`} pointerEvents="none">
                  <PanelLabels
                    strips={pl.layout.panels}
                    x0={r.x} y0={r.y} h={r.h}
                    svgTy={svgTy}
                    zoneGi={r.gi}
                    focusPickKey={plantaPanelPick}
                  />
                  {verifications?.[r.gi] && (
                    <VerificationBadge
                      x={r.x} y={r.y + r.h}
                      verification={verifications[r.gi]}
                      svgTy={svgTy}
                    />
                  )}
                </g>
              );
            })}
            {panelLayouts && !plantaPerimeterLiteMode && layout.entries.map((r) => {
              const pl = panelLayouts.find((x) => x.gi === r.gi);
              if (!pl) return null;
              return (
                <PanelChainDimensions
                  key={`chain-${r.gi}`}
                  strips={pl.layout.panels}
                  x0={r.x}
                  yEdge={r.y + r.h}
                  svgTy={svgTy}
                  au={pl.layout.au}
                  obstacleRects={cotaObstacles}
                />
              );
            })}
            {showPlantaDimensionChrome && planEdges?.exterior?.length ? (
              <EstructuraGlobalExteriorOverlay
                exterior={planEdges.exterior}
                encounters={planEdges.encounters ?? []}
                svgTy={svgTy}
              />
            ) : null}
            {showPlantaDimensionChrome && planEdges?.envelope && (() => {
              const ext = planEdges.exterior ?? [];
              const maxBottomBump = ext.filter(s => s.side === 'bottom')
                .reduce((mx, s) => Math.max(mx, ext.filter(b => b.side === 'bottom' && +b.y1.toFixed(2) === +s.y1.toFixed(2)).length), 0);
              const maxLeftBump = ext.filter(s => s.side === 'left')
                .reduce((mx, s) => Math.max(mx, ext.filter(b => b.side === 'left' && +b.x1.toFixed(2) === +s.x1.toFixed(2)).length), 0);
              return (
                <OverallEnvelopeDimension
                  envelope={planEdges.envelope}
                  svgTy={svgTy}
                  bumpCounts={{ maxBottomBump, maxLeftBump }}
                />
              );
            })()}
            {showPlantaDimensionChrome && layout.viewMetrics && (() => {
              const { vbW, vbH } = layout.viewMetrics;
              const spanM = Math.max(vbW, vbH, 2.5);
              const ch = svgFrame.chrome;
              const fontT = svgTy.dimFontTertiary ?? svgTy.dimFont * 0.72;
              const barH = 0.06 * svgTy.m;
              const footprint = barH + fontT * 0.55;
              const margin = 0.05 * svgTy.m;
              if (ch) {
                return (
                  <ScaleBar
                    x={ch.minX + margin}
                    y={ch.maxY - margin - footprint}
                    spanM={spanM}
                    svgTy={svgTy}
                  />
                );
              }
              const { vbX, vbY } = layout.viewMetrics;
              return (
                <ScaleBar
                  x={vbX}
                  y={vbY + vbH + (svgTy.dimStackBottom ?? 0.24)}
                  spanM={spanM}
                  svgTy={svgTy}
                />
              );
            })()}
            {showPlantaDimensionChrome && layout.viewMetrics && (() => {
              const { vbX, vbY } = layout.viewMetrics;
              return (
                <OrientationMark
                  x={vbX}
                  y={vbY - (svgTy.dimStackTop ?? 0.24) * 0.5}
                  svgTy={svgTy}
                />
              );
            })()}
            {showPlantaDimensionChrome && planEdges?.envelope && (() => {
              const env = planEdges.envelope;
              return (
                <DatumMark
                  x={env.minX}
                  y={env.minY + env.totalH}
                  svgTy={svgTy}
                />
              );
            })()}
            {onEncounterPairChange && (planEdges?.encounters ?? []).map((enc, i) => {
              const [a, b] = enc.zoneIndices ?? [];
              if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
              const pk = encounterPairKey(a, b);
              const low = Math.min(a, b);
              const rawPair = zonas[low]?.preview?.encounterByPair?.[pk];
              const isCumbrera = rawPair?.modo === "cumbrera" || rawPair?.cumbreraUnida;
              const color = isCumbrera ? "#1d4ed8" : "#16a34a";
              const visualW = (LINE_WEIGHTS.zoneBorder ?? 0.025) * svgTy.m * 1.5;
              const hitW = visualW * 8;
              const dashLen = enc.orientation === "horizontal" ? 0.22 : 0.18;
              const handleClick = (e) => {
                e.stopPropagation();
                setEncounterPrompt({ pairKey: pk, ga: a, gb: b, encounterLength: enc.length, orientation: enc.orientation });
              };
              return (
                <g key={`enc-${pk}-${i}`} style={{ cursor: "pointer" }} onClick={handleClick}>
                  <line x1={enc.x1} y1={enc.y1} x2={enc.x2} y2={enc.y2} stroke="transparent" strokeWidth={hitW} strokeLinecap="butt" />
                  <line x1={enc.x1} y1={enc.y1} x2={enc.x2} y2={enc.y2} stroke={color} strokeWidth={visualW} strokeLinecap="butt" strokeDasharray={`${dashLen} ${dashLen * 0.55}`} opacity={0.85} pointerEvents="none" />
                </g>
              );
            })}
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
              pendienteModo={globalPendienteModoProp}
              globalAlturaDif={globalAlturaDifProp}
              selectedGi={selectedGi}
              onZonaDimensionPatch={onZonaDimensionPatch}
              onRemoveZona={onRemoveZona}
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
              const curVal = resolvePlantaBorderEffectiveValue(
                gi,
                side,
                multiZonaBordes,
                bordersGlobalForPlanta,
                zonas,
                bordesSharedSidesMap,
                layout.entries,
              );
              const opts = plantaBorderOptsForSideFiltered(side, bordesPanelFamiliaKey, bordesExtendido, bordesCualquierFamilia, curVal);
              const curLabel =
                !curVal || curVal === "none"
                  ? "Sin perfil"
                  : opts.find((o) => o.id === curVal)?.label ?? curVal;
              return (
                <div
                  ref={plantaBorderPopRef}
                  role="dialog"
                  aria-label={PLANTA_BORDER_SIDE_LABELS[side] || side}
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
                      padding: "12px 14px",
                      background: C.primarySoft,
                      borderBottom: `1px solid ${C.border}`,
                      borderRadius: "10px 10px 0 0",
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#1e40af", lineHeight: 1.35 }}>{curLabel}</div>
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
