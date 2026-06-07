/**
 * bugReportBus.js
 * Tiny imperative bridge so non-hook code (class ErrorBoundaries, nav click handlers,
 * dev buttons) can open the BugReportModal with pre-filled context.
 *
 * Usage:
 *   import { openBugReport } from "../lib/bugReportBus.js";
 *   openBugReport({ description: "Fallo al hacer batch", error: someErr, extra: { scope: "consulta" } });
 *
 * The modal registers itself on mount via setBugReportOpener.
 */

let opener = null;

export function setBugReportOpener(fn) {
  opener = typeof fn === "function" ? fn : null;
}

export function openBugReport(opts = {}) {
  if (typeof opener === "function") {
    try {
      opener(opts);
    } catch (e) {
      // Last resort: at least surface to console so the report isn't lost
      console.error("[bugReportBus] opener failed", e);
      // Fallback: show a minimal alert with the key info
      const msg = (opts.description || opts.error?.message || "Error reportado");
      if (typeof window !== "undefined") {
        window.alert(`No se pudo abrir el formulario de reporte.\n\n${msg}\n\n(Por favor reportá manualmente o recargá.)`);
      }
    }
  } else {
    // Modal not mounted yet (very early error or lazy). Log richly.
    console.warn("[bugReportBus] No opener registered yet. Bug context:", opts);
    if (typeof window !== "undefined") {
      window.alert("El formulario de reporte de bugs aún no está listo.\nIntentá de nuevo en un segundo o usá el botón en la barra superior.");
    }
  }
}

export function hasBugReportOpener() {
  return typeof opener === "function";
}
