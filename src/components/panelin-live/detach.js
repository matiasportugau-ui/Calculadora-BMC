/**
 * Open the Panelin Live voice window as a detached, floating, always-on-top
 * window that can sit over Google Sheets / any other app.
 *
 * Two strategies, in order of preference (mirrors the TraKtiMe timer's
 * src/components/traktime/Timer/detach.js):
 *  1. Document Picture-in-Picture (Chromium) — a true always-on-top window we
 *     control via the DOM. The caller renders the Panelin Live UI into
 *     pip.window.document.body with a React portal, so the WebRTC voice
 *     session + character canvas keep running (the component stays mounted in
 *     the main JS context). Returns { documentPiP:true, window }.
 *  2. Fallback: a same-origin popup pointed at /panelin/live?floating=1, which
 *     PanelinLivePage renders in compact mode. Works cross-browser but is not
 *     OS-level always-on-top. Returns { documentPiP:false, window }.
 *
 * Auth rides along via the httpOnly bmc_sess cookie on the same origin.
 * PiP is Chromium-only — consistent with the page's existing WebRTC/Safari gate.
 */
export async function openFloatingPanelinLive({ width = 420, height = 620 } = {}) {
  // 1. Document Picture-in-Picture
  if (typeof window !== "undefined" && "documentPictureInPicture" in window) {
    try {
      const pip = await window.documentPictureInPicture.requestWindow({ width, height });
      // Mirror same-origin stylesheets so inherited rules apply (our UI is
      // mostly inline-styled, but this keeps fonts/native controls consistent).
      try {
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            const rules = Array.from(sheet.cssRules).map((r) => r.cssText).join("");
            const style = pip.document.createElement("style");
            style.textContent = rules;
            pip.document.head.appendChild(style);
          } catch {
            // Cross-origin stylesheet — cssRules throws; re-link by href instead.
            if (sheet.href) {
              const link = pip.document.createElement("link");
              link.rel = "stylesheet";
              link.href = sheet.href;
              pip.document.head.appendChild(link);
            }
          }
        }
      } catch {
        /* style mirroring is best-effort */
      }
      pip.document.body.style.margin = "0";
      return { documentPiP: true, window: pip };
    } catch {
      /* user dismissed or unsupported config → fall through to popup */
    }
  }

  // 2. Popup fallback (same SPA + origin, compact flag)
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
