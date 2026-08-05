/**
 * BMC Envíos shared design tokens (Liquid Glass / Apple crystal).
 * CSS classes: src/styles/bmc-envios-glass.css
 * Spec: docs/sdd/bmc-envios/DESIGN-UI.md
 *
 * Prefer CSS classes for layout chrome. Use ENV_HEX for SVG/canvas fills
 * (CSS variables on SVG fill are less portable).
 */

export const ENV_FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";

/** Semantic colors for inline styles / SVG (day defaults; night via CSS vars on DOM). */
export const ENV_HEX = {
  bg: "#f5f5f7",
  surface: "#ffffff",
  surfaceAlt: "#fafafa",
  primary: "#0071e3",
  brand: "#1a3a5c",
  text: "#1d1d1f",
  muted: "#6e6e73",
  border: "#e5e5ea",
  success: "#34c759",
  danger: "#ff3b30",
  warning: "#ff9f0a",
};

/**
 * Inline style map compatible with legacy BmcLogisticaApp `T` object.
 * Page chrome should use className `envios-app` instead of T.bg when possible.
 */
export const ENV_T = {
  bg: ENV_HEX.bg,
  surface: ENV_HEX.surface,
  surfaceAlt: ENV_HEX.surfaceAlt,
  primary: ENV_HEX.primary,
  brand: ENV_HEX.brand,
  text: ENV_HEX.text,
  muted: ENV_HEX.muted,
  border: ENV_HEX.border,
  success: ENV_HEX.success,
  danger: ENV_HEX.danger,
  warning: ENV_HEX.warning,
  shadow: "0 1px 3px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.06)",
  radius: 12,
  font: ENV_FONT,
};

/** Solid content card (no glass) — diagrams, forms. */
export const enviosCardSolidStyle = {
  background: ENV_HEX.surface,
  border: "1px solid rgba(0,0,0,.06)",
  borderRadius: ENV_T.radius,
  boxShadow: ENV_T.shadow,
};

/** Solid field (wizard may pass its own inputS; this is fallback). */
export const enviosFieldStyle = {
  width: "100%",
  padding: "9px 12px",
  border: "1.5px solid rgba(0,0,0,.1)",
  borderRadius: 10,
  background: ENV_HEX.surface,
  color: ENV_HEX.text,
  fontSize: 13,
  fontFamily: ENV_FONT,
  boxSizing: "border-box",
};

export const enviosLabelStyle = {
  display: "block",
  fontSize: 11,
  color: ENV_HEX.muted,
  fontWeight: 600,
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

export const enviosSectionTitleStyle = {
  margin: "0 0 10px",
  color: ENV_HEX.brand,
  fontWeight: 700,
  fontSize: 14,
};
