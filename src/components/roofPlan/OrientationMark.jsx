// ═══════════════════════════════════════════════════════════════════════════
// OrientationMark.jsx — "PLANTA" title + North arrow at top-left of 2D plan.
// Placed in SVG user-space (meters). Always visible when cotas are active.
// ═══════════════════════════════════════════════════════════════════════════

const FONT = "'Inter', 'Helvetica Neue', sans-serif";

/**
 * @param {{ x: number, y: number, svgTy: object }} props
 * x, y = top-left anchor in SVG user space (meters).
 */
export default function OrientationMark({ x, y, svgTy }) {
  if (!svgTy?.m) return null;
  const m = svgTy.m;
  const fontSize = svgTy.dimFontPrimary ?? svgTy.dimFont;
  const arrowH = fontSize * 2.2;
  const arrowW = fontSize * 0.6;

  // Arrow tip at (ax, ay), pointing up (negative Y in SVG)
  const ax = x + fontSize * 3.5;
  const ay = y;

  return (
    <g data-bmc-layer="orientation-mark" pointerEvents="none" opacity={0.6}>
      {/* "PLANTA" label */}
      <text
        x={x}
        y={y + fontSize * 0.3}
        fontSize={fontSize * 1.1}
        fontWeight={600}
        fontFamily={FONT}
        fill="#212121"
        stroke="none"
        letterSpacing={fontSize * 0.15}
      >
        PLANTA
      </text>
      {/* Simple north arrow */}
      <line
        x1={ax} y1={ay + arrowH}
        x2={ax} y2={ay}
        stroke="#212121" strokeWidth={0.025 * m}
      />
      {/* Arrow head */}
      <polygon
        points={`${ax},${ay - arrowW * 0.3} ${ax - arrowW / 2},${ay + arrowW * 0.5} ${ax + arrowW / 2},${ay + arrowW * 0.5}`}
        fill="#212121"
      />
      {/* "N" label */}
      <text
        x={ax}
        y={ay - arrowW * 0.5}
        textAnchor="middle"
        fontSize={fontSize * 0.7}
        fontWeight={600}
        fontFamily={FONT}
        fill="#212121"
        stroke="none"
      >
        N
      </text>
    </g>
  );
}
