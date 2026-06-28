import { ExternalLink, Palette, ChevronLeft, ChevronRight } from "lucide-react";
import { BMC_STUDIOS, useBmcStudioTheme } from "../../contexts/BmcStudioThemeProvider.jsx";
import { useBmcAppearance } from "../../contexts/BmcAppearanceProvider.jsx";
import AppearanceToggle from "../glass/AppearanceToggle.jsx";
import { designPreviewBannerLabel } from "../../lib/designPreviewMode.js";

const barStyle = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 10,
  padding: "10px 14px",
  background: "rgba(26, 58, 92, 0.94)",
  color: "#fff",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontSize: 13,
  boxShadow: "0 -4px 24px rgba(0,0,0,0.18)",
  borderTop: "2px solid #ff9f0a",
};

const selectStyle = {
  minWidth: 200,
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.12)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
};

const iconBtn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.1)",
  color: "#fff",
  cursor: "pointer",
};

export default function DesignPreviewBar() {
  const { studioId, studio, setStudioId, cycleStudio } = useBmcStudioTheme();
  const { appearance } = useBmcAppearance();

  const idx = BMC_STUDIOS.findIndex((s) => s.id === studioId);
  const prev = BMC_STUDIOS[(idx - 1 + BMC_STUDIOS.length) % BMC_STUDIOS.length];
  const next = BMC_STUDIOS[(idx + 1) % BMC_STUDIOS.length];

  return (
    <div style={barStyle} role="region" aria-label="Selector de diseño preview">
      <Palette size={18} aria-hidden style={{ flexShrink: 0, color: "#ff9f0a" }} />
      <strong style={{ fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {designPreviewBannerLabel()}
      </strong>

      <button type="button" style={iconBtn} onClick={() => setStudioId(prev.id)} title={prev.label} aria-label={`Anterior: ${prev.label}`}>
        <ChevronLeft size={18} />
      </button>

      <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, opacity: 0.85 }}>Estudio</span>
        <select
          value={studioId}
          onChange={(e) => setStudioId(e.target.value)}
          style={selectStyle}
          aria-label="Elegir estudio de diseño"
        >
          {BMC_STUDIOS.map((s) => (
            <option key={s.id} value={s.id} style={{ color: "#1d1d1f" }}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <button type="button" style={iconBtn} onClick={() => setStudioId(next.id)} title={next.label} aria-label={`Siguiente: ${next.label}`}>
        <ChevronRight size={18} />
      </button>

      <button
        type="button"
        onClick={cycleStudio}
        style={{ ...iconBtn, width: "auto", padding: "0 10px", fontSize: 12, fontWeight: 600 }}
        title="Recorrer estudios"
      >
        {studio.short}
      </button>

      <AppearanceToggle compact />

      <a
        href="/preview/design-mockups"
        style={{
          marginLeft: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "#fff",
          fontSize: 12,
          opacity: 0.9,
        }}
      >
        Mockups HTML <ExternalLink size={14} />
      </a>

      <span style={{ fontSize: 11, opacity: 0.65, width: "100%", marginTop: -4 }}>
        Tema: <strong>{studio.label}</strong> · apariencia {appearance === "night" ? "noche" : "día"} · producción no cambia hasta merge
      </span>
    </div>
  );
}
