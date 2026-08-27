/** Panelin Ruta window: Document PiP (always over logística) with named popup fallback. */

export const LOGISTICA_AGENT_WINDOW_NAME = "logistica-trucker";

export function isLogisticaAgentWindow() {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("agentWindow") === "1";
  } catch {
    return false;
  }
}

export function buildLogisticaAgentUrl(opts = {}) {
  const origin =
    opts.origin || (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const url = new URL("/logistica", origin);
  const draft = String(opts.draft || "").trim();
  if (draft) url.searchParams.set("draft", draft);
  url.searchParams.set("agentWindow", "1");
  return url.toString();
}

function fillPipWithAgent(pipWin, src) {
  const doc = pipWin?.document;
  if (!doc?.body) return;
  doc.documentElement.style.height = "100%";
  doc.body.style.cssText = "margin:0;height:100%;overflow:hidden;background:#111;";
  let iframe = doc.querySelector("iframe[data-logistica-agent]");
  if (!iframe) {
    iframe = doc.createElement("iframe");
    iframe.setAttribute("data-logistica-agent", "1");
    iframe.title = "Panelin Ruta";
    iframe.setAttribute("allow", "microphone; clipboard-read; clipboard-write");
    iframe.style.cssText = "border:0;width:100%;height:100%;display:block;";
    doc.body.replaceChildren(iframe);
  }
  if (iframe.getAttribute("src") !== src) iframe.src = src;
}

/**
 * Open Panelin Ruta so it stays over the logística module.
 * Chromium: Document Picture-in-Picture (true always-on-top).
 * Else: named popup, focused on open.
 */
export async function openLogisticaAgentWindow(opts = {}) {
  if (typeof window === "undefined") return null;
  const src = buildLogisticaAgentUrl(opts);
  const width = Number(opts.width) > 0 ? Math.round(opts.width) : 440;
  const height = Number(opts.height) > 0 ? Math.round(opts.height) : 760;

  const existingPip = window.documentPictureInPicture?.window;
  if (existingPip && !existingPip.closed) {
    fillPipWithAgent(existingPip, src);
    try {
      existingPip.focus?.();
    } catch {
      /* ignore */
    }
    return existingPip;
  }

  try {
    const { openDocumentPipWindow, isDocumentPipSupported } = await import("../openDocumentPip.js");
    if (isDocumentPipSupported()) {
      const pip = await openDocumentPipWindow({ width, height, mirrorStyles: false });
      if (pip?.window) {
        fillPipWithAgent(pip.window, src);
        return pip.window;
      }
    }
  } catch {
    /* fall through to popup */
  }

  const features = [
    "popup=yes",
    `width=${width}`,
    `height=${height}`,
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");
  const win = window.open(src, LOGISTICA_AGENT_WINDOW_NAME, features);
  try {
    win?.focus?.();
  } catch {
    /* ignore */
  }
  return win;
}
