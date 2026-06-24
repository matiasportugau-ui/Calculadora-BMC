/**
 * Open the TraKtiMe mini-timer as a detached, floating window.
 *
 * Two strategies, in order of preference:
 *  1. Document Picture-in-Picture (Chromium) — a true always-on-top window we
 *     control via the DOM. The caller renders <FloatingTimer/> into
 *     pip.window.document.body with a React portal. Returns { documentPiP:true }.
 *  2. Fallback: a popup window pointed at the same SPA with ?tkDetached=1, which
 *     TraKtiMeModule detects and renders as a standalone floating timer. Works
 *     cross-browser but is not OS-level always-on-top.
 *
 * Reuses the existing detach pattern (Panelin chat uses window.open + a URL
 * flag); auth rides along via the httpOnly session cookie on the same origin.
 */
export async function openFloatingTimer({ width = 360, height = 240 } = {}) {
  // 1. Document Picture-in-Picture
  if (typeof window !== "undefined" && "documentPictureInPicture" in window) {
    try {
      const pip = await window.documentPictureInPicture.requestWindow({ width, height });
      // Mirror same-origin stylesheets so inherited rules apply (our UI is
      // mostly inline-styled, but this keeps native controls consistent).
      try {
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            const rules = Array.from(sheet.cssRules).map((r) => r.cssText).join("");
            const style = pip.document.createElement("style");
            style.textContent = rules;
            pip.document.head.appendChild(style);
          } catch {
            // Cross-origin stylesheet — skip (cssRules throws).
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

  // 2. Popup fallback (same SPA, detached flag)
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    url.searchParams.set("tkDetached", "1");
    const popup = window.open(
      url.toString(),
      "traktime-timer",
      `popup=yes,width=${width + 40},height=${height + 60},resizable=yes,scrollbars=no`,
    );
    return { documentPiP: false, window: popup };
  }

  return null;
}

/** True when the current window was opened as the detached timer popup. */
export function isDetachedTimerWindow() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("tkDetached") === "1";
}
