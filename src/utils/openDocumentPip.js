/**
 * Shared Document Picture-in-Picture helper (Chromium).
 * SDD-PANELIN-COWORK §10.4 Mode C / PR-H — reuse for Panelin Live + Co-Work desk.
 */

/**
 * @returns {boolean}
 */
export function isDocumentPipSupported() {
  try {
    return typeof window !== "undefined" && "documentPictureInPicture" in window;
  } catch {
    return false;
  }
}

/**
 * Best-effort copy of same-origin stylesheets into a PiP document.
 * @param {Document} targetDoc
 * @param {Document} [sourceDoc]
 */
export function mirrorStylesToDocument(targetDoc, sourceDoc) {
  if (!targetDoc) return;
  const src = sourceDoc || (typeof document !== "undefined" ? document : null);
  if (!src) return;
  try {
    for (const sheet of Array.from(src.styleSheets || [])) {
      try {
        const rules = Array.from(sheet.cssRules).map((r) => r.cssText).join("");
        const style = targetDoc.createElement("style");
        style.textContent = rules;
        targetDoc.head.appendChild(style);
      } catch {
        if (sheet.href) {
          const link = targetDoc.createElement("link");
          link.rel = "stylesheet";
          link.href = sheet.href;
          targetDoc.head.appendChild(link);
        }
      }
    }
  } catch {
    /* style mirroring is best-effort */
  }
}

/**
 * Open a Document PiP window. Caller owns rendering (portal or iframe).
 * @param {{ width?: number, height?: number, mirrorStyles?: boolean }} [opts]
 * @returns {Promise<{ documentPiP: true, window: Window } | null>}
 */
export async function openDocumentPipWindow(opts = {}) {
  if (!isDocumentPipSupported()) return null;
  const width = Number(opts.width) > 0 ? Math.round(opts.width) : 420;
  const height = Number(opts.height) > 0 ? Math.round(opts.height) : 720;
  try {
    const pip = await window.documentPictureInPicture.requestWindow({ width, height });
    if (opts.mirrorStyles !== false) {
      mirrorStylesToDocument(pip.document);
    }
    if (pip.document?.body) {
      pip.document.body.style.margin = "0";
      pip.document.body.style.height = "100%";
      pip.document.documentElement.style.height = "100%";
    }
    return { documentPiP: true, window: pip };
  } catch {
    /* user dismissed or unsupported config */
    return null;
  }
}
