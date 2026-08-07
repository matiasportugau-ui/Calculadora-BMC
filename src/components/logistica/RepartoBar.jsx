/**
 * Barra de reparto activo — En Coordinación / Confirmar / Historial
 */
import { repartoStatusLabel, repartoStatusTone } from "../../utils/logistica/repartoStatus.js";
import { ENV_T as T } from "../../utils/enviosTheme.js";
import { btnStyle } from "../../utils/logistica/btnStyle.js";

const TONE = {
  neutral: { bg: "#f1f5f9", fg: "#475569", border: "#cbd5e1" },
  warning: { bg: "#fff7ed", fg: "#c2410c", border: "#fdba74" },
  info: { bg: "#eff6ff", fg: "#1d4ed8", border: "#93c5fd" },
  success: { bg: "#ecfdf5", fg: "#047857", border: "#6ee7b7" },
  danger: { bg: "#fef2f2", fg: "#b91c1c", border: "#fca5a5" },
};

function MiniBtn({ children, onClick, disabled, primary, color }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={btnStyle({
        small: true,
        disabled,
        color: color || (primary ? T.primary : undefined),
        outline: !primary && !color,
        style: { padding: "6px 12px", fontSize: 12 },
      })}
    >
      {children}
    </button>
  );
}

/**
 * @param {{
 *   reparto: { id?: string, repartoNo?: string, status?: string, revision?: number } | null,
 *   stopCount?: number,
 *   truckL?: number,
 *   busy?: boolean,
 *   onConfirm?: () => void,
 *   onSaveDraft?: () => void,
 *   onOpenHistory?: () => void,
 *   onNewReparto?: () => void,
 * }} props
 */
export default function RepartoBar({
  reparto = null,
  stopCount = 0,
  truckL = 8,
  busy = false,
  onConfirm,
  onSaveDraft,
  onOpenHistory,
  onNewReparto,
}) {
  const status = reparto?.status || (stopCount > 0 ? "en_coordinacion" : "draft");
  const tone = TONE[repartoStatusTone(status)] || TONE.neutral;
  const label = repartoStatusLabel(status);
  const no = reparto?.repartoNo || (stopCount > 0 ? "Pendiente de nº…" : "—");
  const canConfirm = status === "en_coordinacion" && stopCount > 0 && typeof onConfirm === "function";

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 12,
        border: `1.5px solid ${tone.border}`,
        background: tone.bg,
        marginBottom: 12,
      }}
    >
      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: tone.fg, textTransform: "uppercase", letterSpacing: ".04em" }}>
          Reparto activo
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: T.text || "#0f172a", marginTop: 2 }}>
          {no}
          <span
            style={{
              marginLeft: 8,
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 999,
              background: "#fff",
              border: `1px solid ${tone.border}`,
              color: tone.fg,
            }}
          >
            {label}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
          {stopCount} parada{stopCount === 1 ? "" : "s"} · camión {truckL}m
          {reparto?.revision != null ? ` · rev ${reparto.revision}` : ""}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {typeof onSaveDraft === "function" && status === "en_coordinacion" ? (
          <MiniBtn onClick={onSaveDraft} disabled={busy || stopCount < 1}>
            Guardar borrador
          </MiniBtn>
        ) : null}
        {canConfirm ? (
          <MiniBtn primary color="#059669" onClick={onConfirm} disabled={busy}>
            Confirmar coordinación
          </MiniBtn>
        ) : null}
        {status === "coordinado" && typeof onNewReparto === "function" ? (
          <MiniBtn onClick={onNewReparto} disabled={busy}>
            Nuevo reparto
          </MiniBtn>
        ) : null}
        {typeof onOpenHistory === "function" ? (
          <MiniBtn onClick={onOpenHistory} disabled={busy}>
            Historial
          </MiniBtn>
        ) : null}
      </div>
    </div>
  );
}
