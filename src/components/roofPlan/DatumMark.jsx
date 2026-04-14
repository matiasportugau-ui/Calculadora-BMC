/**
 * DatumMark — ISO-style datum / level indicator (±0.000) for floor plan.
 * Renders an inverted triangle with elevation text at bottom-left of zone.
 */
export default function DatumMark({ x, y, svgTy, heightOffset = 0 }) {
  if (!svgTy) return null;
  const fs = svgTy.dimFontTertiary ?? svgTy.dimFont * 0.72;
  const triH = fs * 1.6;
  const triW = triH * 0.7;
  const halfW = triW / 2;
  const sign = heightOffset >= 0 ? "+" : "";
  const label = `${sign}${heightOffset.toFixed(3)}`;

  return (
    <g data-bmc-layer="datum-mark" opacity={0.65}>
      {/* inverted triangle */}
      <polygon
        points={`${x},${y + triH} ${x - halfW},${y} ${x + halfW},${y}`}
        fill="none"
        stroke="#000"
        strokeWidth={svgTy.dimStroke ?? fs * 0.07}
      />
      {/* horizontal reference line */}
      <line
        x1={x - halfW * 1.4}
        y1={y}
        x2={x + halfW * 1.4}
        y2={y}
        stroke="#000"
        strokeWidth={svgTy.dimStroke ?? fs * 0.07}
      />
      {/* elevation label */}
      <text
        x={x + halfW * 1.6}
        y={y + fs * 0.35}
        fontSize={fs}
        fontFamily="'Share Tech Mono', 'DIN Alternate', 'Courier New', monospace"
        fill="#333"
        dominantBaseline="auto"
      >
        {label}
      </text>
    </g>
  );
}
