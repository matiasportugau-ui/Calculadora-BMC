/**
 * Route overview — geographic SVG when geo exists; always a schematic timeline.
 */
import { useMemo } from "react";
import { ENV_T as T, ENV_HEX, ENV_FONT } from "../../../utils/enviosTheme.js";
import { projectRouteToSvg } from "../../../utils/logistica/routeExport.js";

const TYPE_COLOR = {
  base: ENV_HEX.brand,
  pickup: ENV_HEX.warning,
  delivery: ENV_HEX.primary,
};

const TYPE_ES = { base: "Salida", pickup: "Levante", delivery: "Entrega" };

/**
 * @param {{
 *   route?: { orderedLegs?: object[], totalKm?: number|null, missingGeoCount?: number } | null,
 *   width?: number,
 *   height?: number,
 * }} props
 */
export default function RouteMapVisualizer({ route, width = 320, height = 200 }) {
  const legs = route?.orderedLegs || [];
  const proj = useMemo(() => projectRouteToSvg(legs, { width, height, pad: 28 }), [legs, width, height]);

  if (!legs.length) {
    return <div style={emptyBox}>Generá la ruta para ver el recorrido.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {proj.hasGeo ? (
        <svg
          viewBox={`0 0 ${proj.width} ${proj.height}`}
          width="100%"
          height={height}
          role="img"
          aria-label="Mapa geográfico del recorrido"
          style={{
            display: "block",
            borderRadius: 12,
            border: `1px solid ${T.border}`,
            background: "linear-gradient(160deg, #f0f7ff 0%, #f8fafc 55%, #eef2ff 100%)",
          }}
        >
          <defs>
            <pattern id="route-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#dbe4f0" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width={proj.width} height={proj.height} fill="url(#route-grid)" opacity="0.55" />
          {proj.pathD ? (
            <path
              d={proj.pathD}
              fill="none"
              stroke={ENV_HEX.brand}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
            />
          ) : null}
          {proj.points.map((p, i) => {
            const fill = TYPE_COLOR[p.leg?.type] || ENV_HEX.primary;
            return (
              <g key={`pin-${p.index}-${i}`}>
                <circle cx={p.x} cy={p.y} r="12" fill="#fff" stroke={fill} strokeWidth="2.5" />
                <text
                  x={p.x}
                  y={p.y + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill={fill}
                  fontFamily={ENV_FONT}
                >
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
      ) : null}

      {/* Schematic always visible — transportista-friendly order */}
      <div
        style={{
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          background: T.surface || "#fff",
          padding: "12px 14px",
        }}
        aria-label="Esquema del recorrido"
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 10, letterSpacing: "0.02em" }}>
          RECORRIDO ({legs.length} paradas)
          {route?.totalKm != null ? ` · ~${Number(route.totalKm).toFixed(0)} km aire` : ""}
          {!proj.hasGeo ? " · sin lat/lng — exportá por nombre en Maps" : ` · ${proj.points.length} con geo`}
        </div>
        <div style={{ display: "grid", gap: 0 }}>
          {legs.map((leg, i) => {
            const color = TYPE_COLOR[leg?.type] || ENV_HEX.primary;
            const isLast = i === legs.length - 1;
            return (
              <div key={`${leg.type}-${leg.refId}-${i}`} style={{ display: "flex", gap: 12, minHeight: 44 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 99,
                      background: color,
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  {!isLast ? (
                    <div style={{ width: 3, flex: 1, minHeight: 16, background: "#cbd5e1", borderRadius: 2, marginTop: 2 }} />
                  ) : null}
                </div>
                <div style={{ flex: 1, paddingBottom: isLast ? 0 : 10, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase" }}>
                    {TYPE_ES[leg?.type] || leg?.type}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{leg?.label || "—"}</div>
                  {leg?.addressText ? (
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{leg.addressText}</div>
                  ) : null}
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                    {leg?.legKmFromPrev != null ? `+${Number(leg.legKmFromPrev).toFixed(1)} km · ` : null}
                    {leg?.geo
                      ? `${Number(leg.geo.lat).toFixed(4)}, ${Number(leg.geo.lng).toFixed(4)}`
                      : leg?.mapUrl
                        ? "link mapa"
                        : "sin geo"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11, color: T.muted }}>
        {Object.entries(TYPE_COLOR).map(([k, c]) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: c, display: "inline-block" }} />
            {TYPE_ES[k]}
          </span>
        ))}
      </div>
    </div>
  );
}

const emptyBox = {
  padding: 16,
  borderRadius: 12,
  border: `1px dashed ${T.border}`,
  background: T.surfaceAlt,
  fontSize: 12,
  color: T.muted,
  lineHeight: 1.45,
  textAlign: "center",
};
