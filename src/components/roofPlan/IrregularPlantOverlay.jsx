// SVG: stepped strips, cut line, Freeform-like ruler + angle badge
import { useMemo } from "react";
import { C, FONT } from "../../data/constants.js";

export default function IrregularPlantOverlay({
  zoneRect,
  layout,
  cut,
  selectedStripId,
  onSelectStrip,
  showRuler = true,
}) {
  const { x: zx, y: zy, w: zw, h: zh } = zoneRect;
  const strips = layout?.strips || [];

  const cutSvg = useMemo(() => {
    if (!cut?.p0 || !cut?.p1) return null;
    return {
      x1: zx + cut.p0.x,
      y1: zy + cut.p0.y,
      x2: zx + cut.p1.x,
      y2: zy + cut.p1.y,
    };
  }, [cut, zx, zy]);

  const ruler = useMemo(() => {
    if (!cutSvg || !showRuler) return null;
    const dx = cutSvg.x2 - cutSvg.x1;
    const dy = cutSvg.y2 - cutSvg.y1;
    const len = Math.hypot(dx, dy);
    const angDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const mx = (cutSvg.x1 + cutSvg.x2) / 2;
    const my = (cutSvg.y1 + cutSvg.y2) / 2;
    const nx = len > 1e-9 ? -dy / len : 0;
    const ny = len > 1e-9 ? dx / len : 1;
    return { len, angDeg, mx, my, nx, ny, off: 0.12, dx, dy };
  }, [cutSvg, showRuler]);

  return (
    <g data-bmc="irregular-overlay" pointerEvents="auto">
      <rect
        x={zx}
        y={zy}
        width={zw}
        height={zh}
        fill="none"
        stroke={C.border}
        strokeWidth={0.02}
        strokeDasharray="0.08 0.06"
        opacity={0.5}
        pointerEvents="none"
      />

      {strips.map((s) => {
        const sx = zx + s.x0;
        const sw = s.width;
        const yCover = zy + (s.y0Cover ?? 0);
        const hCover = Math.max(0.02, s.L_cover || 0);
        const hOrder = Math.max(hCover, s.L_order || 0);
        const selected = selectedStripId === s.id;
        return (
          <g key={s.id}>
            <rect
              x={sx}
              y={yCover}
              width={sw}
              height={hOrder}
              fill={C.primary}
              fillOpacity={selected ? 0.28 : 0.14}
              stroke={selected ? C.brand : C.primary}
              strokeWidth={selected ? 0.045 : 0.02}
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectStrip?.(s.id);
              }}
            />
            {hOrder > hCover + 1e-4 && (
              <rect
                x={sx}
                y={yCover + hCover}
                width={sw}
                height={hOrder - hCover}
                fill="url(#irr-waste-hatch)"
                stroke="none"
                pointerEvents="none"
              />
            )}
            <text
              x={sx + sw / 2}
              y={yCover + Math.min(hOrder, hCover) / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={Math.min(0.22, sw * 0.35)}
              fill={C.tp}
              fontWeight={700}
              fontFamily={FONT}
              pointerEvents="none"
            >
              {s.id}
            </text>
            <text
              x={sx + sw / 2}
              y={yCover + Math.min(hOrder, hCover) / 2 + 0.22}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={Math.min(0.16, sw * 0.28)}
              fill={C.ts}
              fontWeight={600}
              fontFamily={FONT}
              pointerEvents="none"
            >
              {Number(s.L_order).toFixed(2)} m
            </text>
          </g>
        );
      })}

      <defs>
        <pattern id="irr-waste-hatch" width={0.12} height={0.12} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={0.12} stroke="#c2410c" strokeWidth={0.02} opacity={0.45} />
        </pattern>
      </defs>

      {cutSvg && (
        <g pointerEvents="none">
          <line x1={cutSvg.x1} y1={cutSvg.y1} x2={cutSvg.x2} y2={cutSvg.y2} stroke="#c2410c" strokeWidth={0.055} strokeLinecap="round" />
          <circle cx={cutSvg.x1} cy={cutSvg.y1} r={0.08} fill="#c2410c" />
          <circle cx={cutSvg.x2} cy={cutSvg.y2} r={0.08} fill="#c2410c" />
        </g>
      )}

      {ruler && cutSvg && (
        <g pointerEvents="none">
          <line
            x1={cutSvg.x1 + ruler.nx * ruler.off}
            y1={cutSvg.y1 + ruler.ny * ruler.off}
            x2={cutSvg.x2 + ruler.nx * ruler.off}
            y2={cutSvg.y2 + ruler.ny * ruler.off}
            stroke="#64748b"
            strokeWidth={0.1}
            strokeLinecap="round"
            opacity={0.85}
          />
          <line
            x1={cutSvg.x1 + ruler.nx * ruler.off}
            y1={cutSvg.y1 + ruler.ny * ruler.off}
            x2={cutSvg.x2 + ruler.nx * ruler.off}
            y2={cutSvg.y2 + ruler.ny * ruler.off}
            stroke="#f8fafc"
            strokeWidth={0.035}
            strokeLinecap="round"
            opacity={0.95}
          />
          <text
            x={ruler.mx + ruler.nx * (ruler.off + 0.18)}
            y={ruler.my + ruler.ny * (ruler.off + 0.18)}
            textAnchor="middle"
            fontSize={0.2}
            fontWeight={700}
            fill="#0f172a"
            fontFamily={FONT}
          >
            {ruler.len.toFixed(2)} m
          </text>
          <g transform={`translate(${cutSvg.x1},${cutSvg.y1})`}>
            <circle r={0.28} fill="#fff" stroke="#334155" strokeWidth={0.025} opacity={0.95} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={0.14} fontWeight={700} fill="#0f172a" fontFamily={FONT}>
              {Math.abs(ruler.angDeg).toFixed(0)}°
            </text>
          </g>
        </g>
      )}
    </g>
  );
}
