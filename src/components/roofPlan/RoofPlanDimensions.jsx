// ═══════════════════════════════════════════════════════════════════════════
// RoofPlanDimensions.jsx — Cotas SVG (perímetro libre, encuentros). Funciones puras:
// `roofPlanSvgTypography.js`, `roofPlanCotaObstacles.js`, `roofPlanDrawingTheme.js`.
// ═══════════════════════════════════════════════════════════════════════════

import { FONT } from "../../data/constants.js";
import { fmtArchMeters, fmtDimMm } from "../../utils/roofPlanSvgTypography.js";
import {
  ROOF_PLAN_DIM_STROKE,
  ROOF_PLAN_DIM_EXT_OPACITY,
  ROOF_PLAN_ENCOUNTER_LABEL_FILL,
  ROOF_PLAN_ENCOUNTER_LABEL_HALO,
  ROOF_PLAN_LAYER_GLOBAL_COTAS,
  makeBumpCounter,
  DIM_THEME,
} from "../../utils/roofPlanDrawingTheme.js";

function ArchDimHorizontal({ x0, yBottom, widthM, yDimLine, svgTy }) {
  const w = widthM;
  const tick = svgTy.tickLen;
  const gap = svgTy.extGap;
  const overshoot = svgTy.extOvershoot;
  const label = `${fmtArchMeters(w)} m`;
  const labelWidthEst = label.length * svgTy.dimFont * 0.62;
  const showLabel = w >= labelWidthEst * 0.75;
  return (
    <g pointerEvents="none" stroke={ROOF_PLAN_DIM_STROKE} fill={ROOF_PLAN_DIM_STROKE}>
      <line
        x1={x0}
        y1={yBottom + gap}
        x2={x0}
        y2={yDimLine + overshoot}
        strokeWidth={svgTy.strokeExt}
        opacity={ROOF_PLAN_DIM_EXT_OPACITY}
      />
      <line
        x1={x0 + w}
        y1={yBottom + gap}
        x2={x0 + w}
        y2={yDimLine + overshoot}
        strokeWidth={svgTy.strokeExt}
        opacity={ROOF_PLAN_DIM_EXT_OPACITY}
      />
      <line x1={x0} y1={yDimLine} x2={x0 + w} y2={yDimLine} strokeWidth={svgTy.strokeMain} />
      <line x1={x0 - tick / 2} y1={yDimLine - tick / 2} x2={x0 + tick / 2} y2={yDimLine + tick / 2}
        strokeWidth={svgTy.strokeTick} />
      <line x1={x0 + w - tick / 2} y1={yDimLine - tick / 2} x2={x0 + w + tick / 2} y2={yDimLine + tick / 2}
        strokeWidth={svgTy.strokeTick} />
      {showLabel && (
        <text
          x={x0 + w / 2}
          y={yDimLine + svgTy.dimFont * 1.05}
          textAnchor="middle"
          fontSize={svgTy.dimFont}
          fontWeight={500}
          fontFamily={FONT}
          stroke="none"
        >
          {label}
        </text>
      )}
    </g>
  );
}

function ArchDimHorizontalTop({ x0, yEdge, widthM, yDimLine, svgTy }) {
  const w = widthM;
  const tick = svgTy.tickLen;
  const gap = svgTy.extGap;
  const overshoot = svgTy.extOvershoot;
  const label = `${fmtArchMeters(w)} m`;
  const labelWidthEst = label.length * svgTy.dimFont * 0.62;
  const showLabel = w >= labelWidthEst * 0.75;
  return (
    <g pointerEvents="none" stroke={ROOF_PLAN_DIM_STROKE} fill={ROOF_PLAN_DIM_STROKE}>
      <line x1={x0} y1={yEdge - gap} x2={x0} y2={yDimLine - overshoot} strokeWidth={svgTy.strokeExt} opacity={ROOF_PLAN_DIM_EXT_OPACITY} />
      <line x1={x0 + w} y1={yEdge - gap} x2={x0 + w} y2={yDimLine - overshoot} strokeWidth={svgTy.strokeExt} opacity={ROOF_PLAN_DIM_EXT_OPACITY} />
      <line x1={x0} y1={yDimLine} x2={x0 + w} y2={yDimLine} strokeWidth={svgTy.strokeMain} />
      <line x1={x0 - tick / 2} y1={yDimLine - tick / 2} x2={x0 + tick / 2} y2={yDimLine + tick / 2}
        strokeWidth={svgTy.strokeTick} />
      <line x1={x0 + w - tick / 2} y1={yDimLine - tick / 2} x2={x0 + w + tick / 2} y2={yDimLine + tick / 2}
        strokeWidth={svgTy.strokeTick} />
      {showLabel && (
        <text
          x={x0 + w / 2}
          y={yDimLine - svgTy.dimFont * 0.35}
          textAnchor="middle"
          fontSize={svgTy.dimFont}
          fontWeight={500}
          fontFamily={FONT}
          stroke="none"
        >
          {label}
        </text>
      )}
    </g>
  );
}

function ArchDimVerticalSegmentRight({ xRef, xDim, y1, y2, spanM, svgTy }) {
  const tick = svgTy.tickLen;
  const gap = svgTy.extGap;
  const overshoot = svgTy.extOvershoot;
  const ym = (y1 + y2) / 2;
  const label = `${fmtArchMeters(spanM)} m`;
  const tx = xDim + svgTy.dimFont * 0.85;
  const labelWidthEst = label.length * svgTy.dimFont * 0.95 * 0.62;
  const showLabel = (y2 - y1) >= labelWidthEst * 0.75;
  return (
    <g pointerEvents="none" stroke={ROOF_PLAN_DIM_STROKE} fill={ROOF_PLAN_DIM_STROKE}>
      <line x1={xRef + gap} y1={y1} x2={xDim + overshoot} y2={y1} strokeWidth={svgTy.strokeExt} opacity={ROOF_PLAN_DIM_EXT_OPACITY} />
      <line x1={xRef + gap} y1={y2} x2={xDim + overshoot} y2={y2} strokeWidth={svgTy.strokeExt} opacity={ROOF_PLAN_DIM_EXT_OPACITY} />
      <line x1={xDim} y1={y1} x2={xDim} y2={y2} strokeWidth={svgTy.strokeMain} />
      <line x1={xDim - tick / 2} y1={y1 - tick / 2} x2={xDim + tick / 2} y2={y1 + tick / 2}
        strokeWidth={svgTy.strokeTick} />
      <line x1={xDim - tick / 2} y1={y2 - tick / 2} x2={xDim + tick / 2} y2={y2 + tick / 2}
        strokeWidth={svgTy.strokeTick} />
      {showLabel && (
        <text
          x={tx}
          y={ym}
          textAnchor="middle"
          fontSize={svgTy.dimFont * 0.95}
          fontWeight={500}
          fontFamily={FONT}
          stroke="none"
          transform={`rotate(-90 ${tx} ${ym})`}
        >
          {label}
        </text>
      )}
    </g>
  );
}

function ArchDimVerticalSegment({ xRef, xDim, y1, y2, spanM, svgTy }) {
  const tick = svgTy.tickLen;
  const gap = svgTy.extGap;
  const overshoot = svgTy.extOvershoot;
  const ym = (y1 + y2) / 2;
  const label = `${fmtArchMeters(spanM)} m`;
  const tx = xDim - svgTy.dimFont * 0.85;
  const labelWidthEst = label.length * svgTy.dimFont * 0.95 * 0.62;
  const showLabel = (y2 - y1) >= labelWidthEst * 0.75;
  return (
    <g pointerEvents="none" stroke={ROOF_PLAN_DIM_STROKE} fill={ROOF_PLAN_DIM_STROKE}>
      <line x1={xRef - gap} y1={y1} x2={xDim - overshoot} y2={y1} strokeWidth={svgTy.strokeExt} opacity={ROOF_PLAN_DIM_EXT_OPACITY} />
      <line x1={xRef - gap} y1={y2} x2={xDim - overshoot} y2={y2} strokeWidth={svgTy.strokeExt} opacity={ROOF_PLAN_DIM_EXT_OPACITY} />
      <line x1={xDim} y1={y1} x2={xDim} y2={y2} strokeWidth={svgTy.strokeMain} />
      <line x1={xDim - tick / 2} y1={y1 - tick / 2} x2={xDim + tick / 2} y2={y1 + tick / 2}
        strokeWidth={svgTy.strokeTick} />
      <line x1={xDim - tick / 2} y1={y2 - tick / 2} x2={xDim + tick / 2} y2={y2 + tick / 2}
        strokeWidth={svgTy.strokeTick} />
      {showLabel && (
        <text
          x={tx}
          y={ym}
          textAnchor="middle"
          fontSize={svgTy.dimFont * 0.95}
          fontWeight={500}
          fontFamily={FONT}
          stroke="none"
          transform={`rotate(-90 ${tx} ${ym})`}
        >
          {label}
        </text>
      )}
    </g>
  );
}

/**
 * Cotas en **aristas exteriores expuestas** (tras restar encuentros) + longitud registrada en cada encuentro.
 * Las líneas quedan **afuera** del rectángulo de techo (sin solapar el relleno del panel).
 */
export function EstructuraGlobalExteriorOverlay({ exterior = [], encounters = [], svgTy }) {
  const nextBottom = makeBumpCounter();
  const nextTop = makeBumpCounter();
  const nextLeft = makeBumpCounter();
  const nextRight = makeBumpCounter();

  const bottoms = exterior.filter((s) => s.side === "bottom").sort((a, b) => a.x1 - b.x1 || a.y1 - b.y1);
  const tops = exterior.filter((s) => s.side === "top").sort((a, b) => a.x1 - b.x1 || a.y1 - b.y1);
  const lefts = exterior.filter((s) => s.side === "left").sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);
  const rights = exterior.filter((s) => s.side === "right").sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);

  // Compute sets of x-values where right/left exterior segments sit, to avoid
  // placing encounter labels on top of those dimension lines.
  const rightExtXSet = new Set(rights.map((s) => +s.x1.toFixed(2)));
  const leftExtXSet = new Set(lefts.map((s) => +s.x1.toFixed(2)));
  const topExtYSet = new Set(tops.map((s) => +s.y1.toFixed(2)));

  const encLabels = encounters.map((enc, i) => {
    const mx = (enc.x1 + enc.x2) / 2;
    const my = (enc.y1 + enc.y2) / 2;
    const len = enc.length;
    const isVert = enc.orientation === "vertical";

    let tx, tyPos;
    if (isVert) {
      // If this encounter x coincides with a right-exterior segment → label goes LEFT (interior)
      // If it coincides with a left-exterior segment → label goes RIGHT (interior)
      const encX = +enc.x1.toFixed(2);
      const nearRight = rightExtXSet.has(encX);
      const nearLeft = leftExtXSet.has(encX);
      const xSign = nearRight ? -1 : nearLeft ? 1 : 1;
      tx = mx + xSign * svgTy.encOffX;
      tyPos = my;
    } else {
      // Horizontal encounter: if y coincides with a top exterior cota (goes UP) → label goes DOWN
      // Otherwise default to UP (away from bottom cotas that go further down).
      const encY = +enc.y1.toFixed(2);
      const nearTop = topExtYSet.has(encY);
      tx = mx;
      tyPos = nearTop ? my + svgTy.encOffY : my - svgTy.encOffY;
    }

    return (
      <g key={`enc-len-${enc.id || i}`} pointerEvents="none">
        <text
          x={tx}
          y={tyPos}
          textAnchor="middle"
          fontSize={svgTy.encFont}
          fontWeight={800}
          fontFamily={FONT}
          fill={ROOF_PLAN_ENCOUNTER_LABEL_FILL}
          stroke={ROOF_PLAN_ENCOUNTER_LABEL_HALO}
          strokeWidth={svgTy.encStroke}
          paintOrder="stroke"
        >
          {`${fmtArchMeters(len)} m`}
        </text>
      </g>
    );
  });

  return (
    <g data-bmc-layer={ROOF_PLAN_LAYER_GLOBAL_COTAS}>
      {bottoms.map((s) => {
        const idx = nextBottom(+s.y1.toFixed(2));
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
        const idx = nextTop(+s.y1.toFixed(2));
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
        const idx = nextLeft(+s.x1.toFixed(2));
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
        const idx = nextRight(+s.x1.toFixed(2));
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

// ─── PanelChainDimensions ─────────────────────────────────────────────────────
/**
 * Cotas encadenadas por panel bajo una zona (ancho individual en mm).
 * Se coloca en el nivel exterior a EstructuraGlobalExteriorOverlay (más lejos de la zona).
 * Paneles cortados se muestran en naranja con ✂.
 *
 * @param {Array<{x0,width,idx,id?,isCut?}>} strips — de buildAnchoStripsPlanta o buildPanelLayout
 * @param {number} x0 — borde izquierdo de la zona en planta (m)
 * @param {number} yEdge — borde inferior de la zona (m)
 * @param {object} svgTy — de buildRoofPlanSvgTypography
 * @param {Array<{minX,maxX,minY,maxY}>} [obstacleRects=[]] — AABBs de computeCotaObstacles
 */
export function PanelChainDimensions({ strips, x0, yEdge, svgTy, obstacleRects = [] }) {
  if (!strips?.length) return null;

  let yDimLine = yEdge + svgTy.dimStackBottom + DIM_THEME.CHAIN_OFFSET;
  for (let attempt = 0; attempt < 3; attempt++) {
    const labelH = svgTy.dimFont * 1.1;
    const overlaps = obstacleRects.some(
      (r) => yDimLine <= r.maxY + labelH && yDimLine >= r.minY - labelH,
    );
    if (!overlaps) break;
    yDimLine += svgTy.dimStackStep;
  }

  const tick = svgTy.tickLen;
  const au = strips[0]?.width ?? 1;

  return (
    <g data-bmc-layer={DIM_THEME.layers.chain} opacity={DIM_THEME.chainOpacity} pointerEvents="none">
      {strips.map((strip) => {
        const x1 = x0 + strip.x0;
        const x2 = x1 + strip.width;
        const cx = (x1 + x2) / 2;
        const label = fmtDimMm(strip.width);
        const isCut = strip.isCut != null ? strip.isCut : strip.width < au - 1e-9;
        const color = isCut ? DIM_THEME.warningColor : DIM_THEME.chainColor;
        const showLabel = strip.width >= label.length * svgTy.dimFont * 0.62 * 0.75;
        return (
          <g key={strip.idx ?? strip.id}>
            <line x1={x1} y1={yDimLine} x2={x2} y2={yDimLine}
              stroke={color} strokeWidth={svgTy.strokeMain} />
            <line x1={x1 - tick / 2} y1={yDimLine - tick / 2} x2={x1 + tick / 2} y2={yDimLine + tick / 2}
              stroke={color} strokeWidth={svgTy.strokeTick} />
            <line x1={x2 - tick / 2} y1={yDimLine - tick / 2} x2={x2 + tick / 2} y2={yDimLine + tick / 2}
              stroke={color} strokeWidth={svgTy.strokeTick} />
            {showLabel && (
              <text x={cx} y={yDimLine + svgTy.dimFont * 1.05}
                fontSize={svgTy.dimFont * 0.85} fill={color}
                textAnchor="middle" fontFamily={FONT} stroke="none">
                {label}{isCut ? ' ✂' : ''}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

// ─── PanelLabels ──────────────────────────────────────────────────────────────
/**
 * Etiquetas de panel (T-01, T-02, …) centradas dentro del cuerpo de cada panel.
 */
export function PanelLabels({ strips, x0, y0, h, svgTy }) {
  if (!strips?.length) return null;
  const fontSize = svgTy.dimFont * 0.75;
  const cy = y0 + h / 2;
  return (
    <g data-bmc-layer={DIM_THEME.layers.labels} opacity={0.65} pointerEvents="none">
      {strips.map((strip) => {
        const cx = x0 + strip.x0 + strip.width / 2;
        const id = strip.id ?? `T-${String((strip.idx ?? 0) + 1).padStart(2, '0')}`;
        const isCut = strip.isCut ?? false;
        const showLabel = strip.width >= id.length * fontSize * 0.62 * 0.6;
        if (!showLabel) return null;
        return (
          <g key={strip.idx ?? id}>
            <text x={cx} y={cy} fontSize={fontSize}
              fill={isCut ? DIM_THEME.warningColor : DIM_THEME.textColor}
              textAnchor="middle" dominantBaseline="middle"
              fontFamily={FONT} stroke="none">
              {id}
            </text>
            {isCut && (
              <text x={cx} y={cy + fontSize * 1.1} fontSize={fontSize * 0.8}
                fill={DIM_THEME.warningColor} textAnchor="middle" dominantBaseline="middle"
                fontFamily={FONT} stroke="none">
                ✂
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

// ─── VerificationBadge ────────────────────────────────────────────────────────
/**
 * Círculo SVG de estado: verde = plano y BOM coinciden, rojo = discrepancia.
 * El <title> muestra el delta al hacer hover.
 */
export function VerificationBadge({ x, y, verification, svgTy }) {
  if (!verification) return null;
  const r = svgTy.dimFont * 0.4;
  const color = verification.ok ? '#22c55e' : '#ef4444';
  const title = verification.ok
    ? 'Plano y cotización coinciden'
    : `Diferencia: ${verification.delta?.panels ?? '?'} panel(es), área Δ${verification.delta?.area ?? '?'} m²`;
  return (
    <g data-bmc-layer={DIM_THEME.layers.verification} pointerEvents="none">
      <circle cx={x} cy={y} r={r} fill={color} opacity={0.85} />
      <title>{title}</title>
    </g>
  );
}
