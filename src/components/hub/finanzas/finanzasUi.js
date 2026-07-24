/** Shared Finanzas hub UI tokens — align Proyección with Cash Flow / Banco tabs */
import { colors, fonts } from "../../traktime/shared/styles.js";

export { colors, fonts };

export const finUi = {
  card: {
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  stat: {
    flex: "1 1 160px",
    background: colors.bgSubtle,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    padding: "14px 16px",
    transition: "box-shadow 0.2s ease, border-color 0.2s ease",
  },
  statHover: {
    boxShadow: "0 4px 14px rgba(0, 113, 227, 0.08)",
    borderColor: "#c7dafc",
  },
  label: {
    display: "block",
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.45,
    fontWeight: 600,
  },
  sectionTitle: { fontSize: 15, fontWeight: 700, margin: 0, color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: 12, lineHeight: 1.45 },
  link: { fontSize: 12, color: colors.accent, textDecoration: "none", fontWeight: 600 },
  mono: { fontFamily: fonts.mono, fontVariantNumeric: "tabular-nums" },
};

export function fmtMoney(v, currencyMode = "uyu") {
  if (v == null || !Number.isFinite(v)) return "—";
  const sym = currencyMode === "usd" || currencyMode === "unified_usd" ? "US$" : "$";
  const abs = Math.abs(v);
  let body;
  if (abs >= 1_000_000) body = `${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  else body = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(Math.round(v));
  return `${v < 0 ? "− " : ""}${sym} ${body}`;
}
