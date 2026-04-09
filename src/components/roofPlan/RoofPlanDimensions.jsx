// ═══════════════════════════════════════════════════════════════════════════
// RoofPlanDimensions.jsx — Cotas SVG (perímetro libre, encuentros, cadena de paneles).
// Funciones puras: `roofPlanSvgTypography.js`, `roofPlanCotaObstacles.js`,
// `roofPlanDrawingTheme.js`, `panelLayout.js`.
// Exports: EstructuraGlobalExteriorOverlay (existente, no modificado),
//          PanelChainDimensions, PanelLabels, VerificationBadge (nuevos).
// ISO 129 / IRAM 4513 compliance: sí — cadena más alejada del objeto que overall
// (trade-off aditivo: no modifica EstructuraGlobalExteriorOverlay existente).
// ═══════════════════════════════════════════════════════════════════════════

import { FONT } from "../../data/constants.js";
import { fmtArchMeters, fmtDimMm } from "../../utils/roofPlanSvgTypography.js";
import {
  ROOF_PLAN_DIM_STROKE,
  ROOF_PLAN_DIM_EXT_OPACITY,
  ROOF_PLAN_ENCOUNTER_LABEL_FILL,
  ROOF_PLAN_ENCOUNTER_LABEL_HALO,
  ROOF_PLAN_LAYER_GLOBAL_COTAS,
} from "../../utils/roofPlanDrawingTheme.js";

function ArchDimHorizontal({ x0, yBottom, widthM, yDimLine, svgTy }) {
  const w = widthM;
  const tick = svgTy.tickLen;
  const label = `${fmtArchMeters(w)} m`;
  const labelWidthEst = label.length * svgTy.dimFont * 0.62;
  const showLabel = w >= labelWidthEst * 0.75;
  return (
    <g pointerEvents="none" stroke={ROOF_PLAN_DIM_STROKE} fill={ROOF_PLAN_DIM_STROKE}>
      <line
        x1={x0}
        y1={yBottom}
        x2={x0}
        y2={yDimLine}
        strokeWidth={svgTy.strokeExt}
        opacity={ROOF_PLAN_DIM_EXT_OPACITY}
      />
      <line
        x1={x0 + w}
        y1={yBottom}
        x2={x0 + w}
        y2={yDimLine}
        strokeWidth={svgTy.strokeExt}
        opacity={ROOF_PLAN_DIM_EXT_OPACITY}
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
      {showLabel && (
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
      )}
    </g>
  );
}

function ArchDimHorizontalTop({ x0, yEdge, widthM, yDimLine, svgTy }) {
  const w = widthM;
  const tick = svgTy.tickLen;
  const label = `${fmtArchMeters(w)} m`;
  const labelWidthEst = label.length * svgTy.dimFont * 0.62;
  const showLabel = w >= labelWidthEst * 0.75;
  return (
    <g pointerEvents="none" stroke={ROOF_PLAN_DIM_STROKE} fill={ROOF_PLAN_DIM_STROKE}>
      <line x1={x0} y1={yEdge} x2={x0} y2={yDimLine} strokeWidth={svgTy.strokeExt} opacity={ROOF_PLAN_DIM_EXT_OPACITY} />
      <line x1={x0 + w} y1={yEdge} x2={x0 + w} y2={yDimLine} strokeWidth={svgTy.strokeExt} opacity={ROOF_PLAN_DIM_EXT_OPACITY} />
      <line x1={x0} y1={yDimLine} x2={x0 + w} y2={yDimLine} strokeWidth={svgTy.strokeMain} />
      <line x1={x0} y1={yDimLine - tick / 2} x2={x0} y2={yDimLine + tick / 2} strokeWidth={svgTy.strokeTick} />
      <line x1={x0 + w} y1={yDimLine - tick / 2} x2={x0 + w} y2={yDimLine + tick / 2} strokeWidth={svgTy.strokeTick} />
      {showLabel && (
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
      )}
    </g>
  );
}

function ArchDimVerticalSegmentRight({ xRef, xDim, y1, y2, spanM, svgTy }) {
  const tick = svgTy.tickLen;
  const ym = (y1 + y2) / 2;
  const label = `${fmtArchMeters(spanM)} m`;
  const tx = xDim + svgTy.dimFont * 0.85;
  const labelWidthEst = label.length * svgTy.dimFont * 0.95 * 0.62;
  const showLabel = (y2 - y1) >= labelWidthEst * 0.75;
  return (
    <g pointerEvents="none" stroke={ROOF_PLAN_DIM_STROKE} fill={ROOF_PLAN_DIM_STROKE}>
      <line x1={xRef} y1={y1} x2={xDim} y2={y1} strokeWidth={svgTy.strokeExt} opacity={ROOF_PLAN_DIM_EXT_OPACITY} />
      <line x1={xRef} y1={y2} x2={xDim} y2={y2} strokeWidth={svgTy.strokeExt} opacity={ROOF_PLAN_DIM_EXT_OPACITY} />
      <line x1={xDim} y1={y1} x2={xDim} y2={y2} strokeWidth={svgTy.strokeMain} />
      <line x1={xDim - tick / 2} y1={y1} x2={xDim + tick / 2} y2={y1} strokeWidth={svgTy.strokeTick} />
      <line x1={xDim - tick / 2} y1={y2} x2={xDim + tick / 2} y2={y2} strokeWidth={svgTy.strokeTick} />
      {showLabel && (
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
      )}
    </g>
  );
}

function ArchDimVerticalSegment({ xRef, xDim, y1, y2, spanM, svgTy }) {
  const tick = svgTy.tickLen;
  const ym = (y1 + y2) / 2;
  const label = `${fmtArchMeters(spanM)} m`;
  const tx = xDim - svgTy.dimFont * 0.85;
  const labelWidthEst = label.length * svgTy.dimFont * 0.95 * 0.62;
  const showLabel = (y2 - y1) >= labelWidthEst * 0.75;
  return (
    <g pointerEvents="none" stroke={ROOF_PLAN_DIM_STROKE} fill={ROOF_PLAN_DIM_STROKE}>
      <line x1={xRef} y1={y1} x2={xDim} y2={y1} strokeWidth={svgTy.strokeExt} opacity={ROOF_PLAN_DIM_EXT_OPACITY} />
      <line x1={xRef} y1={y2} x2={xDim} y2={y2} strokeWidth={svgTy.strokeExt} opacity={ROOF_PLAN_DIM_EXT_OPACITY} />
      <line x1={xDim} y1={y1} x2={xDim} y2={y2} strokeWidth={svgTy.strokeMain} />
      <line x1={xDim - tick / 2} y1={y1} x2={xDim + tick / 2} y2={y1} strokeWidth={svgTy.strokeTick} />
      <line x1={xDim - tick / 2} y1={y2} x2={xDim + tick / 2} y2={y2} strokeWidth={svgTy.strokeTick} />
      {showLabel && (
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
      )}
    </g>
  );
}

/**
 * Cotas en **aristas exteriores expuestas** (tras restar encuentros) + longitud registrada en cada encuentro.
 * Las líneas quedan **afuera** del rectángulo de techo (sin solapar el relleno del panel).
 */
export function EstructuraGlobalExteriorOverlay({ exterior = [], encounters = [], svgTy }) {
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

// ─────────────────────────────────────────────────────────────────────────────
// NUEVOS COMPONENTES — cadena de paneles, IDs, badge de verificación
// Principio: ADITIVOS. No tocan EstructuraGlobalExteriorOverlay.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cadena de cotas horizontales — una cota por panel.
 * Se posiciona MÁS LEJOS del objeto que la cota overall existente
 * (trade-off aditivo — ver decisión A en el plan).
 *
 * Solo renderiza cuando `displayMode !== 'client'`.
 *
 * @param {{
 *   panels: import('../../utils/panelLayout.js').PanelLayoutResult['panels'],
 *   x0: number,
 *   yBase: number,
 *   existingDimOffset: number,
 *   svgTy: object,
 *   theme: import('../../utils/roofPlanDrawingTheme.js').DIM_THEME,
 *   displayMode: 'client'|'technical'|'full',
 * }} props
 */
export function PanelChainDimensions({ panels, x0, yBase, existingDimOffset, svgTy, theme, displayMode }) {
  if (displayMode === 'client') return null;
  if (!panels?.length) return null;

  const chainY = yBase + existingDimOffset + theme.CHAIN_OFFSET;
  const tick = svgTy.tickLen;
  const chainFont = svgTy.dimFont * 0.82;

  return (
    <g data-bmc-layer={theme.layers.chain} opacity={theme.chainOpacity} pointerEvents="none">
      {panels.map((panel) => {
        const px1 = x0 + panel.x0;
        const px2 = px1 + panel.width;
        const color = panel.isCut ? theme.warningColor : theme.chainColor;
        const label = panel.isCut ? `${fmtDimMm(panel.width)} ✂` : fmtDimMm(panel.width);
        const labelWidthEst = label.length * chainFont * 0.62;
        const showLabel = panel.width >= labelWidthEst * 0.75;

        return (
          <g key={panel.id} stroke={color} fill={color}>
            {/* Líneas de extensión */}
            <line
              x1={px1} y1={yBase}
              x2={px1} y2={chainY}
              strokeWidth={svgTy.strokeExt}
              opacity={0.6}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={px2} y1={yBase}
              x2={px2} y2={chainY}
              strokeWidth={svgTy.strokeExt}
              opacity={0.6}
              vectorEffect="non-scaling-stroke"
            />
            {/* Línea de cota */}
            <line
              x1={px1} y1={chainY}
              x2={px2} y2={chainY}
              strokeWidth={svgTy.strokeMain}
              vectorEffect="non-scaling-stroke"
            />
            {/* Terminadores (ticks) */}
            <line
              x1={px1} y1={chainY - tick / 2}
              x2={px1} y2={chainY + tick / 2}
              strokeWidth={svgTy.strokeTick}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={px2} y1={chainY - tick / 2}
              x2={px2} y2={chainY + tick / 2}
              strokeWidth={svgTy.strokeTick}
              vectorEffect="non-scaling-stroke"
            />
            {/* Etiqueta en mm */}
            {showLabel && (
              <text
                x={(px1 + px2) / 2}
                y={chainY + chainFont * 1.1}
                textAnchor="middle"
                fontSize={chainFont}
                fontWeight={600}
                fontFamily={FONT}
                stroke="none"
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/**
 * IDs de panel (T-01, T-02…) dentro de los cuerpos de panel.
 * Visible en modos 'client' y 'full'. No visible en 'technical'.
 *
 * @param {{
 *   panels: import('../../utils/panelLayout.js').PanelLayoutResult['panels'],
 *   x0: number,
 *   y0: number,
 *   h: number,
 *   svgTy: object,
 *   theme: object,
 *   displayMode: 'client'|'technical'|'full',
 * }} props
 */
export function PanelLabels({ panels, x0, y0, h, svgTy, theme, displayMode }) {
  if (displayMode === 'technical') return null;
  if (!panels?.length) return null;

  const labelFont = svgTy.dimFont * 0.72;
  const cutFont = labelFont * 0.8;

  return (
    <g data-bmc-layer={theme.layers.labels} pointerEvents="none">
      {panels.map((panel) => {
        const cx = x0 + panel.x0 + panel.width / 2;
        const cy = y0 + h / 2;
        const color = panel.isCut ? theme.warningColor : theme.textColor;
        const labelWidthEst = panel.id.length * labelFont * 0.62;
        if (panel.width < labelWidthEst * 0.5) return null;

        return (
          <g key={panel.id}>
            <text
              x={cx}
              y={panel.isCut ? cy - cutFont * 0.7 : cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={labelFont}
              fontWeight={700}
              fontFamily={FONT}
              fill={color}
              opacity={0.65}
            >
              {panel.id}
            </text>
            {panel.isCut && (
              <text
                x={cx}
                y={cy + cutFont * 0.8}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={cutFont}
                fontWeight={600}
                fontFamily={FONT}
                fill={theme.warningColor}
                opacity={0.75}
              >
                ✂
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/**
 * Badge de validez del layout en la esquina del SVG.
 * Muestra `layout.isValid` y el primer `layout.warnings[0]` si existe.
 * No hace comparación con BOM (para eso usar `verifyLayoutVsBom` en el wizard).
 *
 * @param {{
 *   layout: import('../../utils/panelLayout.js').PanelLayoutResult,
 *   x: number,
 *   y: number,
 *   svgTy: object,
 * }} props
 */
export function VerificationBadge({ layout, x, y, svgTy }) {
  if (!layout) return null;

  const font = svgTy.dimFont * 0.72;
  let text, fill;

  if (!layout.isValid) {
    text = '✗ Error en layout';
    fill = '#B71C1C';
  } else if (layout.warnings.length > 0) {
    text = `⚠ ${layout.warnings[0]}`;
    fill = '#E65100';
  } else {
    text = `✓ ${layout.nPaneles} panel${layout.nPaneles !== 1 ? 'es' : ''} · ${layout.area.toFixed(2)} m²`;
    fill = '#1B5E20';
  }

  return (
    <g data-bmc-layer="dim-verification" pointerEvents="none">
      <text
        x={x}
        y={y}
        fontSize={font}
        fontFamily={FONT}
        fill={fill}
        opacity={0.85}
      >
        {text}
      </text>
    </g>
  );
}
