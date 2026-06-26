import { Moon, Sun } from "lucide-react";
import { useBmcAppearance } from "../../contexts/BmcAppearanceProvider.jsx";

export default function AppearanceToggle({ compact = false }) {
  const { appearance, toggleDayNight } = useBmcAppearance();
  const isNight = appearance === "night";
  const label = isNight ? "Modo noche (clic para día)" : "Modo día (clic para noche)";

  return (
    <button
      type="button"
      onClick={toggleDayNight}
      title={label}
      aria-label={label}
      className="glass-minimal"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 0 : 6,
        padding: compact ? "6px 8px" : "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,var(--g-edge))",
        background: "rgba(var(--g-tint), calc(var(--g-frost) + 0.08))",
        cursor: "pointer",
        color: "var(--g-text)",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {isNight ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
      {!compact && <span>{isNight ? "Día" : "Noche"}</span>}
    </button>
  );
}
