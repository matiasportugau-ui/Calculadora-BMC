// ═══════════════════════════════════════════════════════════════════════════
// RoofPreview.jsx — Vista previa del techo (rejilla de paneles, drag, pendiente)
// Coordenadas del SVG en metros (planta). preview.x/y solo UI; no afecta BOM.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useMemo, useRef } from "react";
import { C, FONT } from "../data/constants.js";
import { calcFactorPendiente } from "../utils/calculations.js";

const GAP_M = 0.25;
/** Margen extra (m) alrededor del layout en fila: el viewBox no depende de preview.x/y → no “salta” el layout al arrastrar. */
const VIEWBOX_SLACK_M = 2.8;
/** Menos de 1 = el rectángulo se mueve más lento que el puntero (mejor precisión). */
const DRAG_SENSITIVITY = 0.52;
/** Alineación fina al soltar (m); 0 = desactivado. */
const SNAP_ON_RELEASE_M = 0.05;
const SLOPE_MARKS = ["off", "along_largo_pos", "along_largo_neg"];

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
 */
export default function RoofPreview({
  zonas = [],
  tipoAguas = "una_agua",
  pendiente = 0,
  panelAu = 1.12,
  onZonaPreviewChange,
  onResetLayout,
}) {
  const fp = calcFactorPendiente(pendiente);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const tapRef = useRef(null);

  const layout = useMemo(() => {
    const is2A = tipoAguas === "dos_aguas";
    const raw = zonas.map((z, gi) => ({ z, gi })).filter(({ z }) => z?.largo > 0 && z?.ancho > 0);
    let ax = 0;
    const autoPos = {};
    let autoMinX = Infinity;
    let autoMinY = Infinity;
    let autoMaxX = -Infinity;
    let autoMaxY = -Infinity;
    for (const { z, gi } of raw) {
      const w = effAnchoM(z, is2A);
      const h = z.largo;
      const x = ax;
      const y = 0;
      autoPos[gi] = { x, y };
      autoMinX = Math.min(autoMinX, x);
      autoMinY = Math.min(autoMinY, y);
      autoMaxX = Math.max(autoMaxX, x + w);
      autoMaxY = Math.max(autoMaxY, y + h);
      ax += w + GAP_M;
    }
    const entries = raw.map(({ z, gi }) => {
      const w = effAnchoM(z, is2A);
      const h = z.largo;
      const p = z.preview;
      const pos =
        p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : autoPos[gi];
      return { gi, z, x: pos.x, y: pos.y, w, h };
    });
    let curMinX = autoMinX;
    let curMinY = autoMinY;
    let curMaxX = autoMaxX;
    let curMaxY = autoMaxY;
    for (const r of entries) {
      curMinX = Math.min(curMinX, r.x);
      curMinY = Math.min(curMinY, r.y);
      curMaxX = Math.max(curMaxX, r.x + r.w);
      curMaxY = Math.max(curMaxY, r.y + r.h);
    }
    const pad = 0.45;
    const slack = VIEWBOX_SLACK_M;
    const totalArea = raw.reduce((s, { z }) => s + z.largo * z.ancho, 0);
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
  }, [zonas, tipoAguas]);

  const cycleSlope = useCallback(
    (gi) => {
      const z = zonas[gi];
      if (!z || !SLOPE_MARKS.length) return;
      const cur = z.preview?.slopeMark && SLOPE_MARKS.includes(z.preview.slopeMark)
        ? z.preview.slopeMark
        : "off";
      const i = SLOPE_MARKS.indexOf(cur);
      const next = SLOPE_MARKS[(i + 1) % SLOPE_MARKS.length];
      onZonaPreviewChange?.(gi, { slopeMark: next });
    },
    [onZonaPreviewChange, zonas],
  );

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
      const dx = e.clientX - d.clientSX;
      const dy = e.clientY - d.clientSY;
      if (dx * dx + dy * dy > 64) d.moved = true;
      const svg = svgRef.current;
      if (!svg) return;
      const p = clientToSvg(svg, e.clientX, e.clientY);
      const rawX = d.rectStartX + (p.x - d.pointerStartX) * DRAG_SENSITIVITY;
      const rawY = d.rectStartY + (p.y - d.pointerStartY) * DRAG_SENSITIVITY;
      const vm = layout.viewMetrics;
      const { x, y } = clampZonaTopLeft(rawX, rawY, d.rectW, d.rectH, vm);
      onZonaPreviewChange?.(d.gi, { x, y });
    },
    [onZonaPreviewChange, layout.viewMetrics],
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
      if (d.moved && SNAP_ON_RELEASE_M > 0 && onZonaPreviewChange) {
        const z = zonas[d.gi];
        const px = z?.preview;
        if (px && Number.isFinite(px.x) && Number.isFinite(px.y)) {
          const sx = Math.round(px.x / SNAP_ON_RELEASE_M) * SNAP_ON_RELEASE_M;
          const sy = Math.round(px.y / SNAP_ON_RELEASE_M) * SNAP_ON_RELEASE_M;
          const { x, y } = clampZonaTopLeft(sx, sy, d.rectW, d.rectH, layout.viewMetrics);
          if (Math.abs(x - px.x) > 1e-6 || Math.abs(y - px.y) > 1e-6) {
            onZonaPreviewChange(d.gi, { x, y });
          }
        }
      }
      if (e.pointerType === "touch" && !d.moved) {
        const now = Date.now();
        const prev = tapRef.current;
        if (prev && prev.gi === d.gi && now - prev.t < 320) {
          const pdx = e.clientX - prev.x;
          const pdy = e.clientY - prev.y;
          if (pdx * pdx + pdy * pdy < 28 * 28) cycleSlope(d.gi);
          tapRef.current = null;
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
        Arrastrá cada zona para ubicarla en planta. Doble clic (o doble toque): sentido de pendiente visual.
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
            {layout.entries.map((r) => {
              const sm = r.z.preview?.slopeMark;
              const showSlope = sm === "along_largo_pos" || sm === "along_largo_neg";
              const fs = Math.max(0.16, Math.min(0.32, r.w * 0.11));
              const canDrag = Boolean(onZonaPreviewChange);
              return (
                <g key={r.gi}>
                  <rect
                    x={r.x}
                    y={r.y}
                    width={r.w}
                    height={r.h}
                    rx={0.12}
                    fill={C.primary}
                    fillOpacity={0.14}
                    stroke={C.primary}
                    strokeWidth={0.04}
                    style={{ cursor: canDrag ? "grab" : "default" }}
                    onPointerDown={(e) => handlePointerDown(e, r.gi, r)}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      cycleSlope(r.gi);
                    }}
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
