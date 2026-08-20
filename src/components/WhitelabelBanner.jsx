import React, { useEffect } from "react";
import { WHITELABEL_BRAND } from "../config/whitelabel.js";

export default function WhitelabelBanner() {
  useEffect(() => {
    if (!WHITELABEL_BRAND) return undefined;
    const prev = document.title;
    document.title = `${WHITELABEL_BRAND.marca} · Calculadora`;
    return () => { document.title = prev; };
  }, []);
  if (!WHITELABEL_BRAND) return null;
  return (
    <div
      role="banner"
      style={{
        background: "#211E17",
        color: "#FBF6E9",
        padding: "8px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
      }}
    >
      <strong style={{ letterSpacing: "0.08em", color: "#C6A02A" }}>{WHITELABEL_BRAND.marca}</strong>
      <span style={{ opacity: 0.85 }}>{WHITELABEL_BRAND.razonSocial}</span>
    </div>
  );
}
