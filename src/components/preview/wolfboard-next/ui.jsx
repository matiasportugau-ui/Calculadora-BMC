// Shared UI primitives for the wolfboard-next prototype — same visual line as
// the current hub (SF Pro stack, #f5f5f7 canvas, white cards, #0071e3 CTA).
export const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";

export const ui = {
  page: { minHeight: "100vh", background: "#f5f5f7", fontFamily: FONT, color: "#1d1d1f" },
  main: { maxWidth: 1180, margin: "0 auto", padding: "18px 20px 48px", width: "100%", boxSizing: "border-box" },
  h1: { margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "#1a3a5c" },
  sub: { margin: "0 0 18px", fontSize: 13, color: "#6e6e73" },
  card: {
    background: "#fff", borderRadius: 12, border: "1px solid #e5e5ea",
    boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.05)", padding: "16px 18px",
  },
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: "#aeb3bb", textTransform: "uppercase", letterSpacing: 1.4,
  },
  th: { textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6e6e73", textTransform: "uppercase", letterSpacing: 0.6, padding: "8px 10px", borderBottom: "1px solid #e5e5ea" },
  td: { fontSize: 13, padding: "9px 10px", borderBottom: "1px solid #f0f0f2", verticalAlign: "middle" },
};

export function SectionDivider({ label }) {
  return (
    <div style={{ margin: "22px 0 12px", display: "flex", alignItems: "center", gap: 12 }}>
      <span style={ui.sectionLabel}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "#e5e5ea" }} />
    </div>
  );
}

export function Badge({ tone = "gray", children }) {
  const tones = {
    green: { color: "#1a7f37", bg: "#dafbe1" },
    yellow: { color: "#9a6700", bg: "#fff8c5" },
    red: { color: "#cf222e", bg: "#ffebe9" },
    gray: { color: "#57606a", bg: "#eaeef2" },
    purple: { color: "#6639ba", bg: "#f0e7ff" },
    blue: { color: "#0b5cad", bg: "#dbeafe" },
  };
  const t = tones[tone] || tones.gray;
  return (
    <span style={{ color: t.color, background: t.bg, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export function KpiCard({ label, value, hint, tone }) {
  const color = tone === "bad" ? "#c0392b" : tone === "ok" ? "#0b8043" : "#1a3a5c";
  return (
    <div style={{ ...ui.card, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 12, color: "#6e6e73", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: -0.4 }}>{value}</span>
      {hint ? <span style={{ fontSize: 11, color: "#aeb3bb" }}>{hint}</span> : null}
    </div>
  );
}

export function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: "7px 14px", borderRadius: 9, fontSize: 13, cursor: "pointer",
            border: active === t.id ? "1.5px solid #1a3a5c" : "1px solid #d2d2d7",
            background: active === t.id ? "#1a3a5c" : "#fff",
            color: active === t.id ? "#fff" : "#1d1d1f",
            fontWeight: active === t.id ? 700 : 500, fontFamily: FONT,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const fmtUsd = (n) =>
  "U$S " + Number(n).toLocaleString("es-UY", { maximumFractionDigits: 0 });
