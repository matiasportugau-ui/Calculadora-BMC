// ═══════════════════════════════════════════════════════════════════════════
// FloorPlanPolygonEditor.jsx — Dibujo libre de plano para Techo + Fachada
// Click para agregar vértices (snapeados a eje horizontal/vertical + grilla del
// ancho útil del panel); click cerca del primer vértice cierra el polígono;
// arrastrar un vértice ya cerrado lo reposiciona manteniendo el contorno
// rectilíneo. El polígono cerrado se descompone en `zonas` rectangulares vía
// polygonFloorPlan.js — mismo contrato que ya consume el motor de cálculo.
//
// Limitación conocida (v1): sin edición numérica por segmento todavía — solo
// edición visual (click + drag). Ver docs/team/PLAN-FLOOR-PLAN-TECHO-FACHADA.md
// Fase 3 para esa extensión futura.
// ═══════════════════════════════════════════════════════════════════════════

import { useRef, useState } from "react";
import { RotateCcw, Undo2 } from "lucide-react";
import { C, FONT, SHC, TR, TN } from "../data/constants.js";
import { StepperInput } from "./FloorPlanEditor.jsx";
import {
  snapPointToGrid,
  snapToAxisAligned,
  polygonPerimeter,
  isRectilinear,
  isSimplePolygon,
  polygonToFloorPlan,
} from "../utils/polygonFloorPlan.js";

const SVG_SIZE = 320;
const PAD_M = 1.5;
const CLOSE_TOLERANCE_PX = 16;
const DEFAULT_GRID = 1.12;

function computeViewBox(vertices, gridSize) {
  const pts = vertices.length ? vertices : [{ x: 0, y: 0 }];
  const minX = Math.min(0, ...pts.map((p) => p.x)) - PAD_M;
  const maxX = Math.max(gridSize * 4, ...pts.map((p) => p.x)) + PAD_M;
  const minY = Math.min(0, ...pts.map((p) => p.y)) - PAD_M;
  const maxY = Math.max(gridSize * 4, ...pts.map((p) => p.y)) + PAD_M;
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const scale = SVG_SIZE / Math.max(spanX, spanY);
  return { minX, maxX, minY, maxY, scale };
}

/**
 * @param {object} value - { vertices: [{x,y}], closed: boolean, alto: number }
 * @param {function} onChange - (plano) => void, plano = { vertices, closed, alto, zonas, perimetro, area, valid }
 * @param {number} gridSize - grilla de snap en metros (ancho útil del panel de techo activo)
 */
export default function FloorPlanPolygonEditor({ value = {}, onChange, gridSize = DEFAULT_GRID, labelS }) {
  const vertices = value.vertices || [];
  const closed = value.closed === true && vertices.length >= 4;
  const alto = value.alto ?? 3.5;
  const grid = gridSize > 0 ? gridSize : DEFAULT_GRID;

  const [dragIdx, setDragIdx] = useState(null);
  const svgRef = useRef(null);

  const { minX, maxX, minY, maxY, scale } = computeViewBox(vertices, grid);
  const toScreen = (p) => ({ x: (p.x - minX) * scale, y: (maxY - p.y) * scale });
  const toWorld = (sx, sy) => ({ x: sx / scale + minX, y: maxY - sy / scale });

  const emit = (nextVertices, nextClosed, nextAlto = alto) => {
    const plan = nextClosed ? polygonToFloorPlan(nextVertices) : null;
    onChange({
      vertices: nextVertices,
      closed: nextClosed,
      alto: nextAlto,
      zonas: plan?.zonas ?? [],
      perimetro: plan?.perimetro ?? 0,
      area: plan?.area ?? 0,
      valid: plan?.valid ?? false,
    });
  };

  const pointFromEvent = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  };

  const handleSvgClick = (e) => {
    if (closed || dragIdx !== null) return;
    const { sx, sy } = pointFromEvent(e);
    const raw = toWorld(sx, sy);

    if (vertices.length === 0) {
      emit([snapPointToGrid(raw, grid)], false);
      return;
    }

    if (vertices.length >= 3) {
      const firstScreen = toScreen(vertices[0]);
      if (Math.hypot(firstScreen.x - sx, firstScreen.y - sy) <= CLOSE_TOLERANCE_PX) {
        // El array ya es un polígono cerrado implícito (todas las funciones de
        // geometría envuelven vertices[(i+1)%n]) — si el último lado (vertices[n-1]
        // -> vertices[0]) ya es rectilíneo, cerrar sin tocar los vértices dibujados.
        if (isRectilinear(vertices) && isSimplePolygon(vertices)) {
          emit(vertices, true);
        }
        return;
      }
    }

    const prev = vertices[vertices.length - 1];
    const next = snapToAxisAligned(prev, raw, grid);
    if (Math.abs(next.x - prev.x) < 1e-6 && Math.abs(next.y - prev.y) < 1e-6) return;
    emit([...vertices, next], false);
  };

  const undoLast = () => {
    if (closed || vertices.length === 0) return;
    emit(vertices.slice(0, -1), false);
  };

  const reset = () => emit([], false);

  const handleVertexPointerDown = (idx) => (e) => {
    if (!closed) return;
    e.stopPropagation();
    e.target.setPointerCapture?.(e.pointerId);
    setDragIdx(idx);
  };

  const handlePointerMove = (e) => {
    if (dragIdx === null) return;
    const { sx, sy } = pointFromEvent(e);
    const raw = snapPointToGrid(toWorld(sx, sy), grid);
    const n = vertices.length;
    const candidate = vertices.map((v, i) => (i === dragIdx ? raw : { ...v }));

    const prevIdx = (dragIdx - 1 + n) % n;
    const nextIdx = (dragIdx + 1) % n;
    const prevWasHorizontal = Math.abs(vertices[prevIdx].y - vertices[dragIdx].y) < 1e-6;
    const nextWasHorizontal = Math.abs(vertices[nextIdx].y - vertices[dragIdx].y) < 1e-6;
    candidate[prevIdx] = prevWasHorizontal
      ? { ...candidate[prevIdx], y: raw.y }
      : { ...candidate[prevIdx], x: raw.x };
    candidate[nextIdx] = nextWasHorizontal
      ? { ...candidate[nextIdx], y: raw.y }
      : { ...candidate[nextIdx], x: raw.x };

    if (!isRectilinear(candidate) || !isSimplePolygon(candidate)) return; // drag inválido: se ignora, no se aplica
    emit(candidate, true);
  };

  const handlePointerUp = () => setDragIdx(null);

  const plan = closed ? polygonToFloorPlan(vertices) : null;
  const drawnPerimeter = vertices.length >= 2 ? polygonPerimeter(vertices.length >= 3 && closed ? vertices : vertices) : 0;

  const gridLines = [];
  for (let gx = Math.ceil(minX / grid) * grid; gx <= maxX; gx += grid) {
    const sx = (gx - minX) * scale;
    gridLines.push(<line key={`v${gx}`} x1={sx} y1={0} x2={sx} y2={SVG_SIZE} stroke={C.border} strokeWidth={0.5} opacity={0.4} />);
  }
  for (let gy = Math.ceil(minY / grid) * grid; gy <= maxY; gy += grid) {
    const sy = (maxY - gy - minY) * scale;
    gridLines.push(<line key={`h${gy}`} x1={0} y1={sy} x2={SVG_SIZE} y2={sy} stroke={C.border} strokeWidth={0.5} opacity={0.4} />);
  }

  const screenVertices = vertices.map(toScreen);
  const pathD = screenVertices.length
    ? `M ${screenVertices.map((p) => `${p.x},${p.y}`).join(" L ")}${closed ? " Z" : ""}`
    : "";

  return (
    <div style={{ fontFamily: FONT, background: C.surface, borderRadius: 16, padding: 20, boxShadow: SHC, marginBottom: 16 }}>
      <div style={{ ...(labelS || {}), marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>✏️</span>
          DIBUJO LIBRE — Polígono rectilíneo
        </span>
        <span style={{ display: "flex", gap: 6 }}>
          {!closed && vertices.length > 0 && (
            <button type="button" onClick={undoLast} title="Deshacer último punto" style={iconBtnS}>
              <Undo2 size={14} color={C.tp} />
            </button>
          )}
          {vertices.length > 0 && (
            <button type="button" onClick={reset} title="Reiniciar" style={iconBtnS}>
              <RotateCcw size={14} color={C.tp} />
            </button>
          )}
        </span>
      </div>

      <div style={{ fontSize: 12, color: C.ts, marginBottom: 16, lineHeight: 1.5 }}>
        {closed
          ? "Arrastrá un vértice para ajustar el contorno. Los lados se mantienen a 90°."
          : vertices.length === 0
          ? `Hacé click para empezar a dibujar (grilla de ${grid.toFixed(2)} m — ancho útil del panel).`
          : "Seguí haciendo click para agregar lados (siempre horizontales o verticales). Click cerca del primer punto para cerrar."}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, alignItems: "start", flexWrap: "wrap" }}>
        <div style={{ padding: 12, background: C.surfaceAlt, borderRadius: 12, border: `1px solid ${C.border}` }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            width={SVG_SIZE}
            height={SVG_SIZE}
            onClick={handleSvgClick}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ display: "block", cursor: closed ? "default" : "crosshair", touchAction: "none" }}
          >
            {gridLines}
            {pathD && (
              <path
                d={pathD}
                fill={closed ? C.primary : "none"}
                fillOpacity={closed ? 0.15 : 0}
                stroke={C.primary}
                strokeWidth={2}
                strokeLinejoin="round"
              />
            )}
            {screenVertices.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={i === 0 && !closed && vertices.length >= 3 ? 8 : 5}
                fill={dragIdx === i ? C.brand : C.primary}
                stroke="#fff"
                strokeWidth={1.5}
                style={{ cursor: closed ? "grab" : "default" }}
                onPointerDown={handleVertexPointerDown(i)}
              />
            ))}
          </svg>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <StepperInput
            label="Alto pared (m)"
            value={alto}
            onChange={(v) => emit(vertices, closed, v)}
            min={1}
            max={14}
            step={0.5}
            unit="m"
          />
          {closed && plan?.valid && (
            <>
              <div style={{ padding: 12, background: C.primarySoft, borderRadius: 10, border: `1px solid ${C.primary}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.primary, marginBottom: 4 }}>Se deriva automáticamente</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.tp, ...TN }}>{plan.area.toFixed(1)} m²</div>
                <div style={{ fontSize: 12, color: C.ts }}>Área techo — {plan.zonas.length} zona{plan.zonas.length !== 1 ? "s" : ""}</div>
              </div>
              <div style={{ padding: 12, background: C.surfaceAlt, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 4 }}>Perímetro</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.tp, ...TN }}>{plan.perimetro.toFixed(1)} m</div>
                <div style={{ fontSize: 12, color: C.ts }}>Fachadas</div>
              </div>
            </>
          )}
          {closed && !plan?.valid && (
            <div style={{ padding: 12, background: C.warningSoft, borderRadius: 10, border: `1px solid ${C.warning}`, fontSize: 12, color: C.tp }}>
              El contorno quedó inválido (autointersección). Reiniciá el dibujo.
            </div>
          )}
          {!closed && vertices.length > 0 && (
            <div style={{ fontSize: 12, color: C.ts }}>{vertices.length} punto{vertices.length !== 1 ? "s" : ""} — {drawnPerimeter.toFixed(1)} m recorridos</div>
          )}
        </div>
      </div>
    </div>
  );
}

const iconBtnS = {
  width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${C.border}`,
  background: C.surface, cursor: "pointer", display: "flex", alignItems: "center",
  justifyContent: "center", transition: TR,
};
