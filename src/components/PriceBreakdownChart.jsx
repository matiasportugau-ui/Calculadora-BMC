import { useState } from "react";
import { C, FONT, TN } from "../data/constants.js";
import { fmtPrice } from "../utils/helpers.js";

const PALETTE = [
  "#0071E3", "#34C759", "#FF9F0A", "#FF3B30", "#AF52DE",
  "#5AC8FA", "#FF6482", "#1A3A5C",
];

export default function PriceBreakdownChart({ groups }) {
  const [hovered, setHovered] = useState(null);

  if (!groups || groups.length === 0) return null;

  const segments = groups.map((g, i) => ({
    label: g.title,
    value: g.items.reduce((s, item) => s + (item.total || 0), 0),
    color: PALETTE[i % PALETTE.length],
  })).filter(s => s.value > 0);

  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;

  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 70;
  const innerR = 44;

  const cumulativeStarts = segments.reduce((acc, seg, i) => {
    const prev = i === 0 ? 0 : acc[i - 1] + segments[i - 1].value / total;
    acc.push(prev);
    return acc;
  }, []);

  const arcs = segments.map((seg, i) => {
    const pct = seg.value / total;
    const startAngle = cumulativeStarts[i] * 2 * Math.PI - Math.PI / 2;
    const endAngle = (cumulativeStarts[i] + pct) * 2 * Math.PI - Math.PI / 2;

    const r = hovered === i ? outerR + 4 : outerR;

    const x1Outer = cx + r * Math.cos(startAngle);
    const y1Outer = cy + r * Math.sin(startAngle);
    const x2Outer = cx + r * Math.cos(endAngle);
    const y2Outer = cy + r * Math.sin(endAngle);

    const x1Inner = cx + innerR * Math.cos(endAngle);
    const y1Inner = cy + innerR * Math.sin(endAngle);
    const x2Inner = cx + innerR * Math.cos(startAngle);
    const y2Inner = cy + innerR * Math.sin(startAngle);

    const largeArc = pct > 0.5 ? 1 : 0;

    const d = [
      `M ${x1Outer} ${y1Outer}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
      `L ${x1Inner} ${y1Inner}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2Inner} ${y2Inner}`,
      "Z",
    ].join(" ");

    return { d, color: seg.color, label: seg.label, pct, value: seg.value, idx: i };
  });

  return (
    <div style={{
      background: C.surface, borderRadius: 16, padding: 20,
      boxShadow: "0 1px 3px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.06)",
      fontFamily: FONT,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Desglose de costos
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {arcs.map((arc) => (
              <path
                key={arc.idx}
                d={arc.d}
                fill={arc.color}
                stroke={C.surface}
                strokeWidth={1.5}
                style={{ transition: "all 200ms ease", cursor: "pointer" }}
                onMouseEnter={() => setHovered(arc.idx)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </svg>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
          }}>
            {hovered !== null ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.tp, ...TN }}>
                  {(segments[hovered].value / total * 100).toFixed(0)}%
                </div>
                <div style={{ fontSize: 9, color: C.ts, marginTop: 1 }}>
                  ${fmtPrice(segments[hovered].value)}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.tp, ...TN }}>
                  ${fmtPrice(total)}
                </div>
                <div style={{ fontSize: 9, color: C.ts, marginTop: 1 }}>Total</div>
              </>
            )}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {segments.map((seg, i) => (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "4px 8px",
                borderRadius: 6, cursor: "pointer",
                background: hovered === i ? C.surfaceAlt : "transparent",
                transition: TR,
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span style={{ width: 10, height: 10, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: C.tp, flex: 1, fontWeight: hovered === i ? 600 : 400 }}>
                {seg.label}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.ts, ...TN }}>
                {(seg.pct * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const TR = "all 150ms cubic-bezier(0.4,0,0.2,1)";
