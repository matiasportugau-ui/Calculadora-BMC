/**
 * Session-scoped persistence for Panelin calculator split layouts and chat presentation.
 * Aligns react-resizable-panels autoSave with other Panelin sessionStorage keys.
 */

const PRESENTATION_KEY = "panelin-chat-presentation";

/** @type {import('react-resizable-panels').PanelGroupStorage} */
export const panelinPanelGroupStorage = {
  getItem(name) {
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(name, value);
    } catch {
      /* quota / private mode */
    }
  },
};

/**
 * @param {boolean} isCompactLayout
 * @param {boolean} withSidebarChat
 */
export function panelinMainSplitAutoSaveId(isCompactLayout, withSidebarChat) {
  if (isCompactLayout) {
    return withSidebarChat
      ? "bmc-panelin-main-split-compact-with-chat"
      : "bmc-panelin-main-split-compact";
  }
  return withSidebarChat
    ? "bmc-panelin-main-split-with-chat"
    : "bmc-panelin-main-split";
}

/**
 * Floating chat is desktop-only; compact/mobile+tablet stays in the vertical sidebar stack.
 * @param {"sidebar"|"floating"} presentation
 * @param {boolean} isCompactLayout
 * @returns {"sidebar"|"floating"}
 */
export function panelinChatPresentationForViewport(presentation, isCompactLayout) {
  return isCompactLayout ? "sidebar" : presentation;
}

/**
 * @param {boolean} isCompactLayout
 */
export function readStoredChatPresentation(isCompactLayout) {
  if (typeof window === "undefined") return "sidebar";
  try {
    const raw = sessionStorage.getItem(PRESENTATION_KEY);
    const mode = raw === "floating" ? "floating" : "sidebar";
    return panelinChatPresentationForViewport(mode, isCompactLayout);
  } catch {
    return "sidebar";
  }
}