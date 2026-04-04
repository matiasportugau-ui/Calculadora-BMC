// ═══════════════════════════════════════════════════════════════════════════
// RoofPreview.jsx — Vista previa del techo (rejilla de paneles, drag, pendiente)
// Coordenadas del SVG en metros (planta). preview.x/y alimenta encuentros y (con geometría) el BOM;
// buildRoofPlanEdges muestra perímetro/encuentros; rejilla horizontal = paso au a lo largo de largo en planta.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useMemo, useRef, useState } from "react";
import { C, FONT } from "../data/constants.js";
import CollapsibleHint from "./CollapsibleHint.jsx";
import { calcFactorPendiente } from "../utils/calculations.js";
import { buildRoofPlanEdges, encounterPairKey, findEncounters } from "../utils/roofPlanGeometry.js";
import { normalizeEncounter } from "../utils/roofEncounterModel.js";
import {
  formatZonaDisplayTitle,
  getLateralAnnexRootBodyGi,
  isLateralAnnexZona,
} from "../utils/roofLateralAnnexLayout.js";
import { nextRoofSlopeMark } from "../utils/roofSlopeMark.js";

/** Margen extra (m) alrededor del layout en fila: el viewBox no depende de preview.x/y → no “salta” el layout al arrastrar. */
const VIEWBOX_SLACK_M = 2.8;
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

function getEncounterConfigFromZonas(zonas, ga, gb) {
  const pk = encounterPairKey(ga, gb);
  const low = Math.min(ga, gb);
  const raw = zonas[low]?.preview?.encounterByPair?.[pk];
  return normalizeEncounter(raw);
}

/**
 * Roof-style panel visualization: stripes parallel to ancho (horizontal bands in SVG)
 * spaced by au along largo (h), so each band width = au and count ≈ ceil(h/au).
 * Matches plan: util width steps along the dimension where panels stack (largo in plant).
 */
/** @returns {number} Paneles visuales a lo largo de largo (h), paso au (rejilla horizontal en SVG). */
function panelCountAlongLargoStripe(h, au) {
  if (!(au > 0) || !(h > 0)) return 0;
  return Math.max(1, Math.ceil(h / au - 1e-9));
}

function PanelRoofVisualization({ x0, y0, w, h, au, stroke, strokeW, gradKey = "0" }) {
  if (!(au > 0) || !(w > 0) || !(h > 0)) return null;
  const bands = [];
  const lines = [];
  let y = y0;
  let idx = 0;
  while (y < y0 + h - 1e-9) {
    const bandH = Math.min(au, y0 + h - y);
    const fillOpacity = idx % 2 === 0 ? 0.1 : 0.18;
    bands.push(
      <rect
        key={`band-${idx}`}
        x={x0}
        y={y}
        width={w}
        height={bandH}
        fill={stroke}
        fillOpacity={fillOpacity}
        stroke="none"
        pointerEvents="none"
      />,
    );
    y += au;
    idx += 1;
  }
  let yi = y0 + au;
  let k = 0;
  while (yi < y0 + h - 1e-6) {
    lines.push(
      <line
        key={`hj-${k++}`}
        x1={x0}
        y1={yi}
        x2={x0 + w}
        y2={yi}
        stroke={stroke}
        strokeWidth={strokeW}
        opacity={0.55}
        pointerEvents="none"
      />,
    );
    yi += au;
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

function SlopeArrow({ cx, cy, h, dir }) {
  const half = Math.min(h * 0.22, 0.9);
  const yTip = dir === "along_largo_pos" ? cy + half : cy - half;
  const yTail = dir === "along_largo_pos" ? cy - half : cy + half;
  const tipW = Math.min(h * 0.12, 0.35);
  const col = C.danger;
  return (
    <g pointerEvents="none" stroke={col} strokeWidth={0.05} strokeLinecap="round" strokeLinejoin="round" fill={col}>
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
 * @param {object} props
 * @param {Array} props.zonas - techo.zonas (largo, ancho en m; optional preview)
 * @param {string} props.tipoAguas
 * @param {number} props.pendiente - grados (solo texto factor)
 * @param {number} props.panelAu - ancho útil panel (m)
 * @param {function} [props.onZonaPreviewChange] - (globalIndex, patch) => void
 * @param {function} [props.onResetLayout] - limpia posiciones; conserva slopeMark si aplica
 * @param {function} [props.onAnnexLateralSideChange] - (gi, 'izq'|'der') anexo lateral mismo cuerpo
 * @param {function} [props.onAnnexRankSwap] - (gi, dir: -1|1) intercambia orden en cadena lateral
 * @param {function} [props.onAddZona] - agrega una zona nueva (toolbar)
 * @param {function} [props.onEncounterPairChange] - (pairKey, encounterPatch|null) guarda en `preview.encounterByPair`; null = desconectar
 * @param {function} [props.onZonaDimensionPatch] - (gi, { largo?, ancho? }) edición inline al seleccionar zona
 */
export default function RoofPreview({
  zonas = [],
  tipoAguas = "una_agua",
  pendiente = 0,
  panelAu = 1.12,
  onZonaPreviewChange,
  onResetLayout,
  onAnnexLateralSideChange,
  onAnnexRankSwap,
  onAddZona,
  onEncounterPairChange,
  onZonaDimensionPatch,
}) {
  const fp = calcFactorPendiente(pendiente);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const tapRef = useRef(null);
  const [dragOverlay, setDragOverlay] = useState(null);
  const [encounterPrompt, setEncounterPrompt] = useState(null);
  const [selectedGi, setSelectedGi] = useState(null);
  const [undoStack, setUndoStack] = useState([]);

  const tipoPlanta = tipoAguas === "dos_aguas" ? "dos_aguas" : "una_agua";

  /** Perímetro / encuentros + rectángulos (incluye anexos laterales vía roofLateralAnnexLayout). */
  const planEdges = useMemo(() => {
    if (!zonas?.length) return null;
    try {
      return buildRoofPlanEdges(zonas, tipoPlanta);
    } catch {
      return null;
    }
  }, [zonas, tipoPlanta]);

  const layout = useMemo(() => {
    const entries = planEdges?.rects ?? [];
    let curMinX = Infinity;
    let curMinY = Infinity;
    let curMaxX = -Infinity;
    let curMaxY = -Infinity;
    for (const r of entries) {
      curMinX = Math.min(curMinX, r.x);
      curMinY = Math.min(curMinY, r.y);
      curMaxX = Math.max(curMaxX, r.x + r.w);
      curMaxY = Math.max(curMaxY, r.y + r.h);
    }
    const pad = 0.45;
    const slack = VIEWBOX_SLACK_M;
    const totalArea = entries.reduce((s, r) => s + r.z.largo * r.z.ancho, 0);
    if (!entries.length) {
      return {
        entries: [],
        viewBox: "0 0 10 6",
        totalArea: 0,
        viewMetrics: null,
      };
    }
    const vbW = curMaxX - curMinX + 2 * (pad + slack);
    const vbH = curMaxY - curMinY + 2 * (pad + slack);
    const vbX = curMinX - pad - slack;
    const vbY = curMinY - pad - slack;
    const margin = pad * 0.35;
    return {
      entries,
      viewBox: `${vbX} ${vbY} ${vbW} ${vbH}`,
      totalArea,
      viewMetrics: { vbX, vbY, vbW, vbH, margin },
    };
  }, [planEdges]);

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
    [onZonaPreviewChange, zonas],
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
              Agregar zona
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
        Doble clic en la superficie: pendiente visual. Usá <strong style={{ color: C.tp }}>Agregar zona</strong> para sumar
        superficies independientes.
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
              flex: "1 1 280px",
              width: "100%",
              minWidth: 200,
              maxWidth: "100%",
              height: "clamp(220px, min(42vh, 440px), 520px)",
              minHeight: 220,
              flexShrink: 0,
            }}
          >
            <svg
              ref={svgRef}
              viewBox={layout.viewBox}
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
                    strokeWidth={0.035}
                    strokeDasharray="0.12 0.08"
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
                    strokeWidth={0.035}
                    strokeDasharray="0.12 0.08"
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
                  strokeWidth={0.09}
                  strokeDasharray="0.16 0.1"
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
              const fs = Math.max(0.16, Math.min(0.32, r.w * 0.11));
              const annex = isLateralAnnexZona(r.z);
              const canDrag = Boolean(onZonaPreviewChange);
              const supV = suppressSharedVerticalStroke(r, layout.entries, zonas);
              const showAnnexCtl = annex && (onAnnexLateralSideChange || onAnnexRankSwap);
              const btnH = 0.26;
              const btnY = r.y - btnH - 0.08;
              const side = r.z.preview?.lateralSide === "izq" ? "izq" : "der";
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
                      strokeWidth={0.09}
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
                    strokeW={0.032}
                    gradKey={`z-${r.gi}`}
                  />
                  <g
                    pointerEvents="none"
                    stroke={C.primary}
                    strokeWidth={0.072}
                    fill="none"
                    strokeLinecap="square"
                    opacity={0.92}
                  >
                    <line x1={r.x} y1={r.y} x2={r.x + r.w} y2={r.y} />
                    <line x1={r.x} y1={r.y + r.h} x2={r.x + r.w} y2={r.y + r.h} />
                    {!supV.left && <line x1={r.x} y1={r.y} x2={r.x} y2={r.y + r.h} />}
                    {!supV.right && <line x1={r.x + r.w} y1={r.y} x2={r.x + r.w} y2={r.y + r.h} />}
                  </g>
                  <text
                    x={r.x + r.w / 2}
                    y={r.y + r.h / 2 - fs * 0.35}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={fs}
                    fill={C.primary}
                    fontWeight={600}
                    fontFamily={FONT}
                    pointerEvents="none"
                  >
                    {zonaLabelPlanta(r)}
                  </text>
                  <text
                    x={r.x + r.w / 2}
                    y={r.y + r.h / 2 + fs * 0.55}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={Math.max(0.11, fs * 0.42)}
                    fill={C.ts}
                    fontWeight={600}
                    fontFamily={FONT}
                    pointerEvents="none"
                  >
                    {panelCountAlongLargoStripe(r.h, panelAu)}{" "}
                    {panelCountAlongLargoStripe(r.h, panelAu) === 1 ? "panel" : "paneles"}
                  </text>
                  {showSlope && (
                    <SlopeArrow
                      cx={r.x + r.w * 0.82}
                      cy={r.y + r.h / 2}
                      h={r.h}
                      dir={sm}
                    />
                  )}
                  {showAnnexCtl && (
                    <g pointerEvents="auto">
                      {onAnnexLateralSideChange && (
                        <>
                          <rect
                            x={r.x + r.w * 0.08}
                            y={btnY}
                            width={r.w * 0.38}
                            height={btnH}
                            rx={0.06}
                            fill={side === "izq" ? C.primarySoft : "rgba(255,255,255,0.92)"}
                            stroke={C.primary}
                            strokeWidth={0.03}
                            style={{ cursor: "pointer" }}
                            onPointerDown={annexHitStop}
                            onPointerUp={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onAnnexLateralSideChange(r.gi, "izq");
                            }}
                          />
                          <text
                            x={r.x + r.w * 0.27}
                            y={btnY + btnH * 0.72}
                            textAnchor="middle"
                            fontSize={0.14}
                            fontWeight={700}
                            fill={C.primary}
                            pointerEvents="none"
                            fontFamily={FONT}
                          >
                            ←
                          </text>
                          <rect
                            x={r.x + r.w * 0.54}
                            y={btnY}
                            width={r.w * 0.38}
                            height={btnH}
                            rx={0.06}
                            fill={side === "der" ? C.primarySoft : "rgba(255,255,255,0.92)"}
                            stroke={C.primary}
                            strokeWidth={0.03}
                            style={{ cursor: "pointer" }}
                            onPointerDown={annexHitStop}
                            onPointerUp={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onAnnexLateralSideChange(r.gi, "der");
                            }}
                          />
                          <text
                            x={r.x + r.w * 0.73}
                            y={btnY + btnH * 0.72}
                            textAnchor="middle"
                            fontSize={0.14}
                            fontWeight={700}
                            fill={C.primary}
                            pointerEvents="none"
                            fontFamily={FONT}
                          >
                            →
                          </text>
                        </>
                      )}
                      {onAnnexRankSwap && (
                        <>
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
                        </>
                      )}
                    </g>
                  )}
                </g>
              );
            })}
            </svg>
          </div>
        )}
        <div style={{ minWidth: 0, flex: "1 1 160px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.tp }}>
            <strong style={{ fontSize: 15 }}>{layout.totalArea.toFixed(1)} m²</strong>
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
              <div style={{ fontWeight: 600, color: C.tp, marginBottom: 4, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Por superficie / extensión
              </div>
              {layout.entries.map((r) => {
                const a = r.z.largo * r.z.ancho;
                const label = formatZonaDisplayTitle(zonas, r.gi);
                return (
                  <div key={r.gi} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                    <span style={{ color: C.ts }}>
                      {label}
                      <span style={{ fontSize: 10, display: "block", fontWeight: 500, marginTop: 2 }}>
                        {zonaLabelPlanta(r)} en planta
                      </span>
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
                  <div style={{ fontWeight: 600, color: C.tp, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Planta (encuentros)
                  </div>
                  <div>
                    Perímetro exterior (estim.):{" "}
                    <strong style={{ color: C.tp, fontVariantNumeric: "tabular-nums" }}>{planEdges.totals.exteriorLength} m</strong>
                  </div>
                  <div style={{ marginTop: 2 }}>
                    Encuentros:{" "}
                    <strong style={{ color: C.tp }}>{planEdges.encounters.length}</strong> tramo
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
      </div>
    </div>
  );
}
