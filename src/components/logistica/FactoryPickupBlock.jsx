/**
 * End-of-reparto factory pack: email + load order + truck sketch.
 */
import { ENV_T as T, ENV_HEX } from "../../utils/enviosTheme.js";
import { btnStyle } from "../../utils/logistica/btnStyle.js";
import { bedViewExtents } from "../../utils/bmcLogisticaBedView.js";
import { ROW_W } from "../../utils/logistica/cargoPacking.js";

const TRUCK_W = 2.4;

function MiniBtn({ children, onClick, primary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={btnStyle({
        small: true,
        outline: !primary,
        color: primary ? T.primary : undefined,
        style: { padding: "6px 12px", fontSize: 12 },
      })}
    >
      {children}
    </button>
  );
}

/**
 * Top-down bed sketch for the factory (cab left, cola right).
 */
export function FactoryLoadSketch({ cargo, truckL = 8 }) {
  const placed = Array.isArray(cargo?.placed) ? cargo.placed : [];
  const { minXV, maxXV, placedView } = bedViewExtents(placed, truckL);
  const TPX = 28;
  const TPY = 36;
  const cabW = 36;
  const pad = 12;
  const totalLen = Math.max(truckL, maxXV - minXV);
  const svgW = pad * 2 + cabW + totalLen * TPX + 24;
  const svgH = pad * 2 + TRUCK_W * TPY + 18;
  const bedX = pad + cabW;
  const bedY = pad;
  const sx = (m) => bedX + (m - minXV) * TPX;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${svgW} ${svgH}`}
      preserveAspectRatio="xMinYMid meet"
      role="img"
      aria-label={`Croquis de carga camión ${truckL}m`}
      style={{ display: "block", maxWidth: 720, background: "#0f2a45", borderRadius: 10 }}
    >
      <rect x={pad} y={bedY} width={cabW} height={TRUCK_W * TPY} rx={3} fill="#1a4d7a" stroke="#60a5fa" />
      <text x={pad + cabW / 2} y={bedY + TRUCK_W * TPY / 2 + 3} textAnchor="middle" fill="#93c5fd" fontSize={8} fontWeight="700">
        CAB
      </text>
      <rect
        x={bedX}
        y={bedY}
        width={truckL * TPX}
        height={TRUCK_W * TPY}
        fill="#12304a"
        stroke="#60a5fa"
      />
      <line
        x1={bedX}
        y1={bedY + ROW_W * TPY}
        x2={bedX + truckL * TPX}
        y2={bedY + ROW_W * TPY}
        stroke="#3b82f6"
        strokeDasharray="4 3"
      />
      {maxXV > truckL ? (
        <rect
          x={bedX + truckL * TPX}
          y={bedY}
          width={(maxXV - truckL) * TPX}
          height={TRUCK_W * TPY}
          fill="#3a2a12"
          stroke="#f59e0b"
          strokeDasharray="4 3"
        />
      ) : null}
      {placedView.map((pkg) => {
        const x = sx(pkg.xStart);
        const y = bedY + (Number(pkg.row) || 0) * ROW_W * TPY + 2;
        const w = Math.max(4, (Number(pkg.len) || 0) * TPX - 2);
        const h = ROW_W * TPY - 4;
        return (
          <rect
            key={pkg.id || pkg.stableKey}
            x={x}
            y={y}
            width={w}
            height={h}
            rx={2}
            fill={pkg.sCol || ENV_HEX.primary}
            opacity={0.92}
          />
        );
      })}
      <text x={bedX + (truckL * TPX) / 2} y={svgH - 4} textAnchor="middle" fill="#94a3b8" fontSize={8}>
        {truckL}m carrocería · cola →
      </text>
    </svg>
  );
}

/**
 * @param {{
 *   subject?: string,
 *   body?: string,
 *   cargo?: object,
 *   truckL?: number,
 *   stops?: object[],
 *   onCopySubject?: () => void,
 *   onCopyBody?: () => void,
 *   onCopyAll?: () => void,
 * }} props
 */
export default function FactoryPickupBlock({
  subject = "",
  body = "",
  cargo,
  truckL = 8,
  stops = [],
  onCopySubject,
  onCopyBody,
  onCopyAll,
}) {
  const loadOrder = [...(cargo?.stopUnloadOrder || [])].sort((a, b) => a.firstRank - b.firstRank);
  const loadFirst = [...loadOrder].reverse();

  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 14,
        border: `1.5px solid ${T.border}`,
        background: T.surface,
      }}
    >
      <h3 style={{ margin: "0 0 6px", fontSize: 15, color: T.brand }}>
        Coordinación retiro — fábrica
      </h3>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: T.muted, lineHeight: 1.4 }}>
        Al final del armado del reparto. El mail + croquis van a Kingspan / planta para cargar en el orden correcto.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <MiniBtn onClick={onCopySubject}>Copiar asunto</MiniBtn>
        <MiniBtn primary onClick={onCopyBody}>
          Copiar cuerpo
        </MiniBtn>
        <MiniBtn onClick={onCopyAll}>Copiar todo</MiniBtn>
      </div>
      <div
        style={{
          fontSize: 12,
          color: T.muted,
          whiteSpace: "pre-wrap",
          background: T.surfaceAlt,
          borderRadius: 10,
          padding: 10,
          border: `1px solid ${T.border}`,
          marginBottom: 12,
        }}
      >
        <strong style={{ color: T.text }}>{subject}</strong>
        {"\n\n"}
        {body}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.brand, marginBottom: 6 }}>
        Cómo cargar (primero lo que descarga último)
      </div>
      <ol style={{ margin: "0 0 12px", paddingLeft: 20, fontSize: 13, lineHeight: 1.45, color: T.text }}>
        {loadFirst.length ? (
          loadFirst.map((entry, i) => (
            <li key={entry.stop?.id || i}>
              {entry.stop?.cliente || "—"}
              {entry.stop?.orderId ? ` · #${entry.stop.orderId}` : ""}
              {` · ${entry.pkgs?.length || 0} bultos`}
            </li>
          ))
        ) : (
          <li style={{ color: T.muted }}>
            {stops.length ? "Sin estiba calculada aún." : "Agregá paradas para armar la carga."}
          </li>
        )}
      </ol>
      <FactoryLoadSketch cargo={cargo} truckL={truckL} />
    </div>
  );
}
