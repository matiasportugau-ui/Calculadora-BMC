// ═══════════════════════════════════════════════════════════════════════════
// ScaleBar.jsx — ISO-style graphic scale bar for the 2D roof plan SVG.
// Renders alternating black/white blocks. Auto-selects 1 m or 5 m based on
// footprint span. Placed at bottom-left of the SVG viewBox.
// ═══════════════════════════════════════════════════════════════════════════

const FONT = "'Inter', 'Helvetica Neue', sans-serif";

/**
 * @param {{ x: number, y: number, spanM: number, svgTy: object }} props
 * x, y = bottom-left anchor in SVG user space (meters).
 * spanM = max of viewBox width/height — used to pick scale unit.
 */
export default function ScaleBar({ x, y, spanM, svgTy }) {
  if (!svgTy?.m) return null;
  const m = svgTy.m;

  // Pick round unit: 0.5 m for small plans, 1 m for medium, 5 m for large
  let unit = 1;
  if (spanM > 20) unit = 5;
  else if (spanM < 4) unit = 0.5;

  const blocks = 4;
  const blockW = unit; // each block = 1 unit in SVG meters
  const barH = 0.06 * m;
  const fontSize = svgTy.dimFontTertiary ?? svgTy.dimFont * 0.72;
  const stroke = 0.018 * m;

  return (
    <g data-bmc-layer="scale-bar" pointerEvents="none" opacity={0.7}>
      {Array.from({ length: blocks }, (_, i) => (
        <rect
          key={i}
          x={x + i * blockW}
          y={y}
          width={blockW}
          height={barH}
          fill={i % 2 === 0 ? "#212121" : "#ffffff"}
          stroke="#212121"
          strokeWidth={stroke}
        />
      ))}
      {/* "0" at left end */}
      <text
        x={x}
        y={y - fontSize * 0.4}
        textAnchor="middle"
        fontSize={fontSize}
        fontFamily={FONT}
        fill="#212121"
        stroke="none"
      >
        0
      </text>
      {/* total label at right end */}
      <text
        x={x + blocks * blockW}
        y={y - fontSize * 0.4}
        textAnchor="middle"
        fontSize={fontSize}
        fontFamily={FONT}
        fill="#212121"
        stroke="none"
      >
        {blocks * unit} m
      </text>
    </g>
  );
}
