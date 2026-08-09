// SVG: final installed roof silhouette (clean plane after cut — no stepped factory strips)
import { useMemo } from "react";
import { C, FONT } from "../../data/constants.js";

function ringToPath(ring, zx, zy) {
  if (!ring?.length) return "";
  const pts = ring.map((p) => `${zx + p.x},${zy + p.y}`);
  return `M ${pts.join(" L ")} Z`;
}

/**
 * Right-plant view: after cut is defined, show only the final roof polygon (smooth).
 * While drawing cut, still show ruler preview.
 */
export default function IrregularFinalPlaneOverlay({
  zoneRect,
  layout,
  cut,
  cutDraft = null,
  showRuler = true,
}) {
  const { x: zx, y: zy, w: zw, h: zh } = zoneRect;
  const poly = layout?.polygon || [];

  const cutSvg = useMemo(() => {
    const p0 = cut?.p0 || cutDraft;
    const p1 = cut?.p1 || (cutDraft && cut?.p0 ? cutDraft : null);
    if (!p0) return null;
    const a = p0;
    const b = p1 || p0;
    return {
      x1: zx + a.x,
      y1: zy + a.y,
      x2: zx + b.x,
      y2: zy + b.y,
      complete: Boolean(cut?.p0 && cut?.p1),
    };
  }, [cut, cutDraft, zx, zy]);

  const ruler = useMemo(() => {
    if (!cutSvg || !showRuler || !cutSvg.complete) return null;
    const dx = cutSvg.x2 - cutSvg.x1;
    const dy = cutSvg.y2 - cutSvg.y1;
    const len = Math.hypot(dx, dy);
    const angDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const mx = (cutSvg.x1 + cutSvg.x2) / 2;
    const my = (cutSvg.y1 + cutSvg.y2) / 2;
    const nx = len > 1e-9 ? -dy / len : 0;
    const ny = len > 1e-9 ? dx / len : 1;
    return { len, angDeg, mx, my, nx, ny, off: 0.12 };
  }, [cutSvg, showRuler]);

  const pathD = useMemo(() => ringToPath(poly, zx, zy), [poly, zx, zy]);
  const hasFinal = poly.length >= 3 && Boolean(cut?.p0 && cut?.p1);

  return (
    <g data-bmc="irregular-final-plane" pointerEvents="none">
      {hasFinal ? (
        <>
          {/* Mask full zone so underlying panel grid does not look like “staircase” */}
          <rect x={zx} y={zy} width={zw} height={zh} fill={C.bg || "#f5f5f7"} opacity={0.92} />
          <path
            d={pathD}
            fill={C.primary}
            fillOpacity={0.22}
            stroke={C.primary}
            strokeWidth={0.045}
            strokeLinejoin="round"
          />
          <path d={pathD} fill="none" stroke={C.brand || C.primary} strokeWidth={0.03} strokeLinejoin="round" opacity={0.85} />
        </>
      ) : null}

      {cutSvg && (
        <g>
          <line
            x1={cutSvg.x1}
            y1={cutSvg.y1}
            x2={cutSvg.x2}
            y2={cutSvg.y2}
            stroke="#c2410c"
            strokeWidth={0.05}
            strokeLinecap="round"
            strokeDasharray={cutSvg.complete ? undefined : "0.08 0.05"}
            opacity={hasFinal ? 0.35 : 1}
          />
          <circle cx={cutSvg.x1} cy={cutSvg.y1} r={0.07} fill="#c2410c" opacity={hasFinal ? 0.4 : 1} />
          {!cutSvg.complete || (cutSvg.x1 !== cutSvg.x2 || cutSvg.y1 !== cutSvg.y2) ? (
            <circle cx={cutSvg.x2} cy={cutSvg.y2} r={0.07} fill="#c2410c" opacity={hasFinal ? 0.4 : 1} />
          ) : null}
        </g>
      )}

      {ruler && cutSvg && !hasFinal && (
        <g>
          <line
            x1={cutSvg.x1 + ruler.nx * ruler.off}
            y1={cutSvg.y1 + ruler.ny * ruler.off}
            x2={cutSvg.x2 + ruler.nx * ruler.off}
            y2={cutSvg.y2 + ruler.ny * ruler.off}
            stroke="#c2410c"
            strokeWidth={0.025}
            opacity={0.7}
          />
          <text
            x={ruler.mx + ruler.nx * (ruler.off + 0.14)}
            y={ruler.my + ruler.ny * (ruler.off + 0.14)}
            textAnchor="middle"
            fontSize={0.18}
            fill="#9a3412"
            fontWeight={700}
            fontFamily={FONT}
          >
            {ruler.len.toFixed(2)} m · {ruler.angDeg.toFixed(0)}°
          </text>
        </g>
      )}
    </g>
  );
}
