// ═══════════════════════════════════════════════════════════════════════════
// lgFonts.js — carga no bloqueante de las fuentes de la capa game-like.
//
// Antes las traía un @import dentro de lg-quoter.css, pero eso las vuelve
// dependencia crítica del preload CSS de Vite: si fonts.googleapis.com no
// responde (red de obra, offline, proxy), el chunk lazy queda suspendido y el
// overlay nunca aparece. Como <link> inyectado, el render nunca se bloquea:
// sin red las fuentes degradan a los fallbacks del stack (--lgq-font-*).
//
// Solo lo llaman los módulos lazy (ScenarioCards / PriceHUD), que solo cargan
// con isDesignPreviewEnabled() === true → producción sigue en 0 requests.
// ═══════════════════════════════════════════════════════════════════════════

const LG_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Archivo:wght@700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap";
const LG_FONTS_ID = "lgq-fonts";

/** Inyecta preconnect + stylesheet de fuentes una sola vez. Idempotente. */
export function ensureLgFonts() {
  if (typeof document === "undefined") return;
  if (document.getElementById(LG_FONTS_ID)) return;

  for (const origin of ["https://fonts.googleapis.com", "https://fonts.gstatic.com"]) {
    const pre = document.createElement("link");
    pre.rel = "preconnect";
    pre.href = origin;
    pre.crossOrigin = "anonymous";
    document.head.appendChild(pre);
  }

  const link = document.createElement("link");
  link.id = LG_FONTS_ID;
  link.rel = "stylesheet";
  link.href = LG_FONTS_HREF;
  document.head.appendChild(link);
}
