/**
 * BMC Envíos F7 — button style builder (pure).
 * Prevents "ghost buttons" on dark panels: outline + white text on light surface.
 */

import { ENV_HEX, ENV_FONT } from "../enviosTheme.js";

/**
 * @param {{
 *   outline?: boolean,
 *   small?: boolean,
 *   disabled?: boolean,
 *   color?: string,
 *   variant?: "default" | "onDark" | "ghost",
 *   active?: boolean,
 *   style?: Record<string, unknown>,
 * }} opts
 * @returns {Record<string, unknown>}
 */
export function btnStyle(opts = {}) {
  const outline = Boolean(opts.outline);
  const small = Boolean(opts.small);
  const disabled = Boolean(opts.disabled);
  const variant = opts.variant || "default";
  const active = Boolean(opts.active);
  const color = opts.color || ENV_HEX.primary;
  const extra = opts.style && typeof opts.style === "object" ? opts.style : {};

  /** @type {Record<string, unknown>} */
  let base;

  if (variant === "onDark") {
    base = {
      padding: small ? "6px 11px" : "8px 14px",
      borderRadius: 10,
      border: active
        ? "1.5px solid rgba(255,255,255,.55)"
        : "1.5px solid rgba(255,255,255,.35)",
      background: active ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.12)",
      color: "#ffffff",
      fontWeight: 600,
      fontSize: small ? 12 : 13,
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: ENV_FONT,
      opacity: disabled ? 0.5 : 1,
      textDecoration: "none",
      display: "inline-block",
      whiteSpace: "nowrap",
      lineHeight: 1.2,
    };
  } else if (variant === "ghost") {
    base = {
      padding: small ? "6px 11px" : "8px 14px",
      borderRadius: 10,
      border: "1.5px solid transparent",
      background: "transparent",
      color: ENV_HEX.text,
      fontWeight: 600,
      fontSize: small ? 12 : 13,
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: ENV_FONT,
      opacity: disabled ? 0.5 : 1,
      textDecoration: "none",
      display: "inline-block",
      whiteSpace: "nowrap",
      lineHeight: 1.2,
    };
  } else {
    base = {
      padding: small ? "6px 11px" : "8px 14px",
      borderRadius: 10,
      border: outline ? `1.5px solid ${ENV_HEX.border}` : "none",
      background: outline ? ENV_HEX.surface : color,
      color: outline ? ENV_HEX.text : "#fff",
      fontWeight: 600,
      fontSize: small ? 12 : 13,
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: ENV_FONT,
      opacity: disabled ? 0.5 : 1,
      textDecoration: "none",
      display: "inline-block",
      whiteSpace: "nowrap",
      lineHeight: 1.2,
    };
  }

  // Merge extra last, but onDark guards: never allow light bg + white text.
  const merged = { ...base, ...extra };
  if (variant === "onDark") {
    const bg = String(merged.background || "");
    const col = String(merged.color || "");
    const looksLightBg =
      /#fff|#ffffff|rgb\(\s*255/i.test(bg) || bg === ENV_HEX.surface;
    const looksWhiteText = /#fff|#ffffff|rgba\(\s*255\s*,\s*255\s*,\s*255/i.test(col);
    if (looksLightBg || !merged.background) {
      merged.background = active ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.12)";
    }
    if (!looksWhiteText) {
      merged.color = "#ffffff";
    }
    // Drop accidental surface from partial spreads
    if (merged.background === ENV_HEX.surface) {
      merged.background = "rgba(255,255,255,.12)";
    }
  }
  return merged;
}

/**
 * Contrast contract for tests / harness.
 * @param {Record<string, unknown>} style
 */
export function isOnDarkContrastSafe(style) {
  if (!style || typeof style !== "object") return false;
  const bg = String(style.background || "");
  const col = String(style.color || "");
  const lightBg = /#fff(fff)?\b|rgb\(\s*255\s*,\s*255\s*,\s*255/i.test(bg);
  const whiteText = /#fff(fff)?\b|rgba\(\s*255\s*,\s*255\s*,\s*255/i.test(col);
  if (lightBg && whiteText) return false;
  if (!bg || bg === "transparent") return false;
  return whiteText || col === "#ffffff";
}
