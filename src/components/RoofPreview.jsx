// ═══════════════════════════════════════════════════════════════════════════
// RoofPreview.jsx — Vista previa del techo (rejilla de paneles, drag, pendiente)
// Coordenadas del SVG en metros (planta). preview.x/y no alimenta el BOM todavía;
// buildRoofPlanEdges (mismo criterio de layout) muestra perímetro/encuentros solo informativo.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useMemo, useRef } from "react";
import { C, FONT } from "../data/constants.js";
import { calcFactorPendiente } from "../utils/calculations.js";
import { buildRoofPlanEdges } from "../utils/roofPlanGeometry.js";
import { isLateralAnnexZona } from "../utils/roofLateralAnnexLayout.js";
import { nextRoofSlopeMark } from "../utils/roofSlopeMark.js";

/** Margen extra (m) alrededor del layout en fila: el viewBox no depende de preview.x/y → no “salta” el layout al arrastrar. */
const VIEWBOX_SLACK_M = 2.8;
/** Menos de 1 = el rectángulo se mueve más lento que el puntero (mejor precisión). */
const DRAG_SENSITIVITY = 0.52;
/** Alineación fina al soltar (m); 0 = desactivado. */
const SNAP_ON_RELEASE_M = 0.05;
/** Distancia máx (m) para que el borde de una zona se enganche al borde de otra al soltar. */
const SNAP_ZONE_M = 0.35;
function effAnchoM(z, is2A) {
  return is2A ? z.ancho / 2 : z.ancho;
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

function PanelGrid({ x0, y0, w, h, au, stroke, strokeW }) {
  if (!(au > 0) || !(w > 0) || !(h > 0)) return null;
  const lines = [];
  let xi = x0 + au;
  let k = 0;
  while (xi < x0 + w - 1e-6) {
    lines.push(
      <line
        key={`${xi}-${k++}`}
        x1={xi}
        y1={y0}
        x2={xi}
        y2={y0 + h}
        stroke={stroke}
        strokeWidth={strokeW}
        opacity={0.45}
        pointerEvents="none"
      />,
    );
    xi += au;
  }
  return <g>{lines}</g>;
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
}) {
  const fp = calcFactorPendiente(pendiente);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const tapRef = useRef(null);

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
      };
    },
    [onZonaPreviewChange],
  );

  const handlePointerMove = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (isLateralAnnexZona(zonas[d.gi])) return;
      const dx = e.clientX - d.clientSX;
      const dy = e.clientY - d.clientSY;
      if (dx * dx + dy * dy > 64) d.moved = true;
      const svg = svgRef.current;
      if (!svg) return;
      const p = clientToSvg(svg, e.clientX, e.clientY);
      const rawX = d.rectStartX + (p.x - d.pointerStartX) * DRAG_SENSITIVITY;
      const rawY = d.rectStartY + (p.y - d.pointerStartY) * DRAG_SENSITIVITY;
      // Magnetic snap: adhere when edge within threshold; detach automatically when raw moves away
      let finalX = rawX, finalY = rawY;
      let bestDX = SNAP_ZONE_M, bestDY = SNAP_ZONE_M;
      for (const r of layout.entries) {
        if (r.gi === d.gi) continue;
        const curR = rawX + d.rectW, curB = rawY + d.rectH;
        if (Math.abs(curR - r.x) < bestDX)         { bestDX = Math.abs(curR - r.x);         finalX = r.x - d.rectW; }
        if (Math.abs(rawX - (r.x + r.w)) < bestDX) { bestDX = Math.abs(rawX - (r.x + r.w)); finalX = r.x + r.w; }
        if (Math.abs(curB - r.y) < bestDY)         { bestDY = Math.abs(curB - r.y);         finalY = r.y - d.rectH; }
        if (Math.abs(rawY - (r.y + r.h)) < bestDY) { bestDY = Math.abs(rawY - (r.y + r.h)); finalY = r.y + r.h; }
      }
      const vm = layout.viewMetrics;
      const { x, y } = clampZonaTopLeft(finalX, finalY, d.rectW, d.rectH, vm);
      onZonaPreviewChange?.(d.gi, { x, y });
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
      dragRef.current = null;
    },
    [cycleSlope, onZonaPreviewChange, zonas, layout.viewMetrics],
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
      </div>
      <div style={{ fontSize: 11, color: C.ts, marginBottom: 10, lineHeight: 1.4 }}>
        Arrastrá cada <strong style={{ color: C.tp }}>zona independiente</strong> en planta. Los{" "}
        <strong style={{ color: C.tp }}>anexos laterales</strong> (mismo cuerpo) no se arrastran: usá las flechas ← →
        para el costado y « » para el orden en la cadena. Doble clic en la superficie: pendiente visual.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
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
              width: "100%",
              maxWidth: 280,
              height: 200,
              flexShrink: 0,
              alignSelf: "flex-start",
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
            {encounters.map((enc) => (
              <line
                key={enc.id}
                x1={enc.x1} y1={enc.y1} x2={enc.x2} y2={enc.y2}
                stroke="#f59e0b"
                strokeWidth={0.07}
                strokeDasharray="0.18 0.09"
                pointerEvents="none"
                opacity={0.95}
              />
            ))}
            {layout.entries.map((r) => {
              const sm = r.z.preview?.slopeMark;
              const showSlope = sm === "along_largo_pos" || sm === "along_largo_neg";
              const fs = Math.max(0.16, Math.min(0.32, r.w * 0.11));
              const annex = isLateralAnnexZona(r.z);
              const canDrag = Boolean(onZonaPreviewChange) && !annex;
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
                    fill={annex ? "#6366f1" : C.primary}
                    fillOpacity={annex ? 0.18 : 0.14}
                    stroke={annex ? "#6366f1" : C.primary}
                    strokeWidth={0.04}
                    style={{ cursor: canDrag ? "grab" : "default" }}
                    onPointerDown={(e) => handlePointerDown(e, r.gi, r)}
                  />
                  <PanelGrid
                    x0={r.x}
                    y0={r.y}
                    w={r.w}
                    h={r.h}
                    au={panelAu}
                    stroke={C.brand}
                    strokeW={0.035}
                  />
                  <text
                    x={r.x + r.w / 2}
                    y={r.y + r.h / 2}
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
                Por zona
              </div>
              {layout.entries.map((r, i) => {
                const a = r.z.largo * r.z.ancho;
                return (
                  <div key={r.gi} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                    <span style={{ color: C.ts }}>
                      Zona {i + 1}
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
                <span>Suma zonas</span>
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
                    La cotización sigue usando bordes globales; esto prepara accesorios por tramo.
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
