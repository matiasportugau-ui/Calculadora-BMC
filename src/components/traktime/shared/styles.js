// Toggl-minimal palette. White background, project-color accents.
export const colors = {
  bg: "#ffffff",
  bgSubtle: "#fafafa",
  border: "#e5e5ea",
  text: "#1d1d1f",
  textMuted: "#6e6e73",
  accent: "#0071e3",
  accentSoft: "#e8f0fe",
  ok: "#34c759",
  warn: "#ff9f0a",
  danger: "#ff3b30",
};

export const fonts = {
  body: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif",
  mono: "'SF Mono', Menlo, Consolas, monospace",
};

export const page = {
  padding: 24,
  background: colors.bg,
  minHeight: "100%",
  fontFamily: fonts.body,
  color: colors.text,
};

export const tabBar = {
  display: "flex",
  gap: 4,
  borderBottom: `1px solid ${colors.border}`,
  marginBottom: 24,
};

export const tabButton = (active) => ({
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 600,
  background: "transparent",
  border: "none",
  borderBottom: active ? `2px solid ${colors.accent}` : "2px solid transparent",
  color: active ? colors.text : colors.textMuted,
  cursor: "pointer",
  fontFamily: fonts.body,
});

export const card = {
  background: colors.bg,
  border: `1px solid ${colors.border}`,
  borderRadius: 12,
  padding: 16,
};

export const button = (variant = "primary") => ({
  padding: "10px 18px",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: fonts.body,
  background:
    variant === "primary"
      ? colors.accent
      : variant === "danger"
      ? colors.danger
      : colors.bgSubtle,
  color: variant === "ghost" ? colors.text : "#fff",
  border: variant === "ghost" ? `1px solid ${colors.border}` : "none",
});

export const input = {
  padding: "8px 12px",
  borderRadius: 8,
  border: `1px solid ${colors.border}`,
  fontSize: 14,
  fontFamily: fonts.body,
  outline: "none",
  background: colors.bg,
};

export const dot = (hex) => ({
  display: "inline-block",
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: hex || colors.textMuted,
  marginRight: 6,
  verticalAlign: "middle",
});

export function formatHms(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function formatHm(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
