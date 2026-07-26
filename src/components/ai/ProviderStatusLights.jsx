/**
 * ProviderStatusLights — green / amber / red / gray readiness dots (SDD Phase C).
 *
 * Props:
 *   readiness: { ready, light, activeProvider, providers?: [...] }
 *   compact?: boolean  — aggregate only
 *   onRefresh?: () => void
 */

const COLORS = {
  green: "#188038",
  red: "#d93025",
  amber: "#f9ab00",
  gray: "#9aa0a6",
};

function lightColor(light) {
  return COLORS[light] || COLORS.gray;
}

function aggregateLabel(readiness) {
  if (!readiness) return "IA: sin datos";
  const light = readiness.light || "gray";
  if (light === "green" || readiness.ready) {
    const via = readiness.activeProvider ? ` via ${readiness.activeProvider}` : "";
    return `IA lista${via}`;
  }
  if (light === "amber") return "IA limitada";
  if (light === "red") return "IA no disponible";
  return "IA: verificando…";
}

export function LightDot({ light, label, reason, size = 8 }) {
  const color = lightColor(light);
  return (
    <span
      className="providerLight"
      title={reason || label}
      role="img"
      aria-label={`${label}: ${reason || light}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
    >
      <span
        className="providerLight__dot"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          display: "inline-block",
          flexShrink: 0,
          boxShadow: light === "green" ? `0 0 0 2px ${color}33` : undefined,
        }}
      />
      {label ? (
        <span className="providerLight__label" style={{ fontSize: 11, lineHeight: 1.2 }}>
          {label}
        </span>
      ) : null}
    </span>
  );
}

export default function ProviderStatusLights({
  readiness,
  compact = false,
  onRefresh,
  style,
}) {
  const light = readiness?.light || "gray";
  const label = aggregateLabel(readiness);
  const providers = Array.isArray(readiness?.providers) ? readiness.providers : [];

  return (
    <div
      className="providerStatusLights"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <LightDot light={light} label={label} reason={label} size={9} />
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            style={{
              border: "none",
              background: "transparent",
              color: "inherit",
              opacity: 0.75,
              fontSize: 11,
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            Actualizar
          </button>
        ) : null}
      </div>
      {!compact && providers.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px 10px",
            opacity: 0.92,
          }}
        >
          {providers
            .filter((p) => p.id !== "openrouter" || p.configured)
            .map((p) => (
              <LightDot
                key={p.id}
                light={p.light || "gray"}
                label={p.id}
                reason={p.reason || p.reasonCode || p.state}
                size={7}
              />
            ))}
        </div>
      ) : null}
    </div>
  );
}
