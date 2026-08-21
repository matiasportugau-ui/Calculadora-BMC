/**
 * Compact operator tools on Detalle Completo: notes / transportista / nube.
 * Panels expand under the icon row so they don't flood the form.
 */
import { Cloud, Pencil, Truck } from "lucide-react";
import { ENV_T as T } from "../../utils/enviosTheme.js";

const CHIP = {
  width: 44,
  height: 44,
  borderRadius: 12,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  position: "relative",
  flexShrink: 0,
};

/**
 * @param {{
 *   active?: "notes" | "carrier" | "cloud" | null,
 *   onToggle?: (id: "notes" | "carrier" | "cloud") => void,
 *   notesHint?: boolean,
 *   costHint?: boolean,
 *   children?: import("react").ReactNode,
 * }} props
 */
export default function OpsToolsStrip({
  active = null,
  onToggle,
  notesHint = false,
  costHint = false,
  children,
}) {
  const chip = (id, title, Icon, hint) => {
    const on = active === id;
    return (
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-pressed={on}
        onClick={() => onToggle?.(id)}
        style={{
          ...CHIP,
          border: `1.5px solid ${on ? T.primary : T.border}`,
          background: on ? "#e8f1fb" : T.surface,
          color: on ? T.primary : T.brand,
        }}
      >
        <Icon size={20} strokeWidth={2} />
        {hint ? (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 8,
              height: 8,
              borderRadius: 999,
              background: T.primary,
            }}
          />
        ) : null}
      </button>
    );
  };

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          background: T.surface,
        }}
      >
        {chip("notes", "Notas del remito", Pencil, notesHint)}
        {chip("carrier", "Transportista y costeo", Truck, costHint)}
        {chip("cloud", "Nube y borradores", Cloud, false)}
        <span style={{ fontSize: 11, color: T.muted, marginLeft: 4, flex: "1 1 140px" }}>
          Lápiz = notas del remito · camión = costeo · nube = guardados
        </span>
      </div>
      {children ? <div style={{ marginTop: 8 }}>{children}</div> : null}
    </div>
  );
}
