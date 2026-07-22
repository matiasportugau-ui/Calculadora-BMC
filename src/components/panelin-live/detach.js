/**
 * Open the Panelin Live voice window as a detached, floating, always-on-top
 * window that can sit over Google Sheets / any other app.
 *
 * Two strategies, in order of preference (mirrors the TraKtiMe timer's
 * src/components/traktime/Timer/detach.js):
 *  1. Document Picture-in-Picture (Chromium) via shared openDocumentPipWindow
 *  2. Fallback: same-origin popup /panelin/live?floating=1
 */
import { openDocumentPipWindow } from "../../utils/openDocumentPip.js";

export async function openFloatingPanelinLive({ width = 420, height = 620 } = {}) {
  const pip = await openDocumentPipWindow({ width, height, mirrorStyles: true });
  if (pip?.documentPiP) return pip;

  // Popup fallback (same SPA + origin, compact flag)
  if (typeof window !== "undefined") {
    const url = new URL(`${window.location.origin}/panelin/live`);
    url.searchParams.set("floating", "1");
    const popup = window.open(
      url.toString(),
      "panelin-live",
      `popup=yes,width=${width},height=${height},resizable=yes,scrollbars=no`,
    );
    return { documentPiP: false, window: popup };
  }

  return null;
}

/** True when the current window is rendering the compact floating Panelin Live. */
export function isFloatingPanelinLive() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("floating") === "1";
}
