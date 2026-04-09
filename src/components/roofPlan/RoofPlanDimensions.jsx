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
  makeBumpCounter,
  DIM_THEME,
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

  // A-3: junction x-positions between adjacent top/bottom segments (different zones)
  const topJunctions = [];
  for (let i = 0; i < tops.length - 1; i++) {
    const xEnd = tops[i].x1 + tops[i].length;
    if (Math.abs(xEnd - tops[i + 1].x1) < 1e-3) topJunctions.push({ x: xEnd, y: tops[i].y1 });
  }
  const bottomJunctions = [];
  for (let i = 0; i < bottoms.length - 1; i++) {
    const xEnd = bottoms[i].x1 + bottoms[i].length;
    if (Math.abs(xEnd - bottoms[i + 1].x1) < 1e-3) bottomJunctions.push({ x: xEnd, y: bottoms[i].y1 });
  }

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
      {bottomJunctions.map((j, i) => {
        const yDimLine = j.y + svgTy.dimStackBottom;
        const h = svgTy.tickLen * 2;
        return (
          <line key={`sep-bot-${i}`} x1={j.x} y1={yDimLine - h / 2} x2={j.x} y2={yDimLine + h / 2}
            stroke={ROOF_PLAN_DIM_STROKE} strokeWidth={svgTy.strokeTick * 1.1} opacity={0.45} pointerEvents="none" />
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
      {topJunctions.map((j, i) => {
        const yDimLine = j.y - svgTy.dimStackTop;
        const h = svgTy.tickLen * 2;
        return (
          <line key={`sep-top-${i}`} x1={j.x} y1={yDimLine - h / 2} x2={j.x} y2={yDimLine + h / 2}
            stroke={ROOF_PLAN_DIM_STROKE} strokeWidth={svgTy.strokeTick * 1.1} opacity={0.45} pointerEvents="none" />
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
export function PanelChainDimensions({
  panels,
  strips,
  x0,
  yBase,
  yEdge,
  existingDimOffset,
  svgTy,
  theme,
  displayMode,
  mode,
}) {
  const resolvedMode = displayMode ?? mode ?? "client";
  const resolvedTheme = theme ?? DIM_THEME;
  const resolvedPanels = panels ?? strips?.map((s, i) => ({
    id: `T-${String(i + 1).padStart(2, "0")}`,
    x0: s.x0 ?? 0,
    width: s.width ?? 0,
    isCut: false,
  }));
  const resolvedYBase = yBase ?? yEdge;
  const resolvedDimOffset = existingDimOffset ?? svgTy?.dimStackBottom ?? 0;

  if (resolvedMode === 'client') return null;
  if (!resolvedPanels?.length || !Number.isFinite(resolvedYBase)) return null;

  const chainY = resolvedYBase + resolvedDimOffset + resolvedTheme.CHAIN_OFFSET;
  const tick = svgTy.tickLen;
  const chainFont = svgTy.dimFont * 0.82;

  return (
    <g data-bmc-layer={resolvedTheme.layers.chain} opacity={resolvedTheme.chainOpacity} pointerEvents="none">
      {resolvedPanels.map((panel) => {
        const px1 = x0 + panel.x0;
        const px2 = px1 + panel.width;
        const color = panel.isCut ? resolvedTheme.warningColor : resolvedTheme.chainColor;
        const label = panel.isCut ? `${fmtDimMm(panel.width)} ✂` : fmtDimMm(panel.width);
        const labelWidthEst = label.length * chainFont * 0.62;
        const showLabel = panel.width >= labelWidthEst * 0.75;

        return (
          <g key={panel.id} stroke={color} fill={color}>
            {/* Líneas de extensión */}
            <line
              x1={px1} y1={resolvedYBase}
              x2={px1} y2={chainY}
              strokeWidth={svgTy.strokeExt}
              opacity={0.6}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={px2} y1={resolvedYBase}
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
export function PanelLabels({ panels, strips, x0, y0, h, svgTy, theme, displayMode, mode }) {
  const resolvedMode = displayMode ?? mode ?? "client";
  const resolvedTheme = theme ?? DIM_THEME;
  const resolvedPanels = panels ?? strips?.map((s, i) => ({
    id: `T-${String(i + 1).padStart(2, "0")}`,
    x0: s.x0 ?? 0,
    width: s.width ?? 0,
    isCut: false,
  }));

  if (resolvedMode === 'technical') return null;
  if (!resolvedPanels?.length) return null;

  const labelFont = svgTy.dimFont * 0.72;
  const cutFont = labelFont * 0.8;

  return (
    <g data-bmc-layer={resolvedTheme.layers.labels} pointerEvents="none">
      {resolvedPanels.map((panel) => {
        const cx = x0 + panel.x0 + panel.width / 2;
        const cy = y0 + h / 2;
        const color = panel.isCut ? resolvedTheme.warningColor : resolvedTheme.textColor;
        const labelWidthEst = panel.id.length * labelFont * 0.62;
        if (panel.width < labelWidthEst * 0.5) return <g key={panel.id} />;

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
                fill={resolvedTheme.warningColor}
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
export function VerificationBadge({ layout, verification, x, y, svgTy }) {
  const resolvedLayout = layout ?? verification;
  if (!resolvedLayout) return null;

  const font = svgTy.dimFont * 0.72;
  let text, fill;

  if (typeof resolvedLayout.summary === "string") {
    text = resolvedLayout.summary;
    if (!resolvedLayout.isValid) {
      fill = "#B71C1C";
    } else if ((resolvedLayout.warnings?.length ?? 0) > 0) {
      fill = "#E65100";
    } else {
      fill = "#1B5E20";
    }
  } else if (!resolvedLayout.isValid) {
    text = '✗ Error en layout';
    fill = '#B71C1C';
  } else if (resolvedLayout.warnings.length > 0) {
    text = `⚠ ${resolvedLayout.warnings[0]}`;
    fill = '#E65100';
  } else {
    text = `✓ ${resolvedLayout.nPaneles} panel${resolvedLayout.nPaneles !== 1 ? 'es' : ''} · ${resolvedLayout.area.toFixed(2)} m²`;
    fill = '#1B5E20';
  }

  return (
    <g data-bmc-layer={DIM_THEME.layers.verification} pointerEvents="none">
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

// ─── GlobalOverallDims (A-1 ancho total + A-2 largo total) ───────────────────
/**
 * Cota acumulada global: una línea que abarca todo el ancho (arriba) y todo el largo (izquierda).
 * Se posiciona un nivel más afuera que las cotas de segmento individual.
 * Es la más fina de todas (strokeMain * 0.8).
 */
export function GlobalOverallDims({ rects, svgTy }) {
  if (!rects?.length) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  const totalW = maxX - minX;
  const totalH = maxY - minY;
  if (totalW <= 0 || totalH <= 0) return null;

  const tick = svgTy.tickLen * 1.1;
  const strokeO = svgTy.strokeMain * 0.8;
  const fontSize = svgTy.dimFont * 1.05;
  const yDimLine = minY - svgTy.dimStackTop - svgTy.dimStackStep;
  const xDimLine = minX - svgTy.sideOffset - svgTy.sideStep;
  const labelW = `${fmtArchMeters(totalW)} m`;
  const labelH = `${fmtArchMeters(totalH)} m`;

  return (
    <g data-bmc-layer="global-overall-dims" pointerEvents="none" stroke={ROOF_PLAN_DIM_STROKE} fill={ROOF_PLAN_DIM_STROKE}>
      {/* A-1: ancho total — arriba */}
      <line x1={minX} y1={minY} x2={minX} y2={yDimLine} strokeWidth={svgTy.strokeExt} opacity={ROOF_PLAN_DIM_EXT_OPACITY} />
      <line x1={maxX} y1={minY} x2={maxX} y2={yDimLine} strokeWidth={svgTy.strokeExt} opacity={ROOF_PLAN_DIM_EXT_OPACITY} />
      <line x1={minX} y1={yDimLine} x2={maxX} y2={yDimLine} strokeWidth={strokeO} />
      <line x1={minX} y1={yDimLine - tick / 2} x2={minX} y2={yDimLine + tick / 2} strokeWidth={svgTy.strokeTick} />
      <line x1={maxX} y1={yDimLine - tick / 2} x2={maxX} y2={yDimLine + tick / 2} strokeWidth={svgTy.strokeTick} />
      <text
        x={(minX + maxX) / 2}
        y={yDimLine - fontSize * 0.35}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight={700}
        fontFamily={FONT}
        stroke="none"
      >
        {labelW}
      </text>

      {/* A-2: largo total — izquierda */}
      <line x1={minX} y1={minY} x2={xDimLine} y2={minY} strokeWidth={svgTy.strokeExt} opacity={ROOF_PLAN_DIM_EXT_OPACITY} />
      <line x1={minX} y1={maxY} x2={xDimLine} y2={maxY} strokeWidth={svgTy.strokeExt} opacity={ROOF_PLAN_DIM_EXT_OPACITY} />
      <line x1={xDimLine} y1={minY} x2={xDimLine} y2={maxY} strokeWidth={strokeO} />
      <line x1={xDimLine - tick / 2} y1={minY} x2={xDimLine + tick / 2} y2={minY} strokeWidth={svgTy.strokeTick} />
      <line x1={xDimLine - tick / 2} y1={maxY} x2={xDimLine + tick / 2} y2={maxY} strokeWidth={svgTy.strokeTick} />
      <text
        x={xDimLine - fontSize * 0.85}
        y={(minY + maxY) / 2}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight={700}
        fontFamily={FONT}
        stroke="none"
        transform={`rotate(-90 ${xDimLine - fontSize * 0.85} ${(minY + maxY) / 2})`}
      >
        {labelH}
      </text>
    </g>
  );
}

// ─── Obstacle bridge (for RoofPreview chain dim collision avoidance) ──────────
export { buildEstructuraCotaObstacleRects as computeCotaObstacles } from '../../utils/roofPlanCotaObstacles.js';
