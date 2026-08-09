/**
 * Shared Panelin AI provider/model selection (chat header, in-chat selector, voice label, Live).
 * Same-tab updates fire `panelin-ai-selection` so UI that doesn't own useChat state stays in sync.
 */

export const PANELIN_AI_STORAGE_KEY = "panelin-chat-ai-selection-v1";
export const PANELIN_AI_EVENT = "panelin-ai-selection";

const ALLOWED = new Set(["claude", "openai", "grok", "gemini"]);

/**
 * @returns {{ aiProvider: string, aiModel: string }}
 */
export function loadPanelinAiSelection() {
  try {
    if (typeof localStorage === "undefined") return { aiProvider: "auto", aiModel: "" };
    const raw = localStorage.getItem(PANELIN_AI_STORAGE_KEY);
    if (!raw) return { aiProvider: "auto", aiModel: "" };
    const o = JSON.parse(raw);
    const aiProvider =
      o?.aiProvider === "claude" ||
      o?.aiProvider === "openai" ||
      o?.aiProvider === "grok" ||
      o?.aiProvider === "gemini"
        ? o.aiProvider
        : "auto";
    const aiModel = typeof o?.aiModel === "string" ? o.aiModel : "";
    return { aiProvider, aiModel };
  } catch {
    return { aiProvider: "auto", aiModel: "" };
  }
}

/**
 * @param {{ aiProvider?: string, aiModel?: string }} sel
 */
export function savePanelinAiSelection(sel) {
  const next = {
    aiProvider: ALLOWED.has(sel?.aiProvider) ? sel.aiProvider : "auto",
    aiModel: typeof sel?.aiModel === "string" ? sel.aiModel : "",
  };
  if (next.aiProvider === "auto") next.aiModel = "";
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PANELIN_AI_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // ignore
  }
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(PANELIN_AI_EVENT, { detail: next }));
    }
  } catch {
    // ignore
  }
  return next;
}

/**
 * Prefer explicit non-auto prop; else stored pick; else auto.
 * @param {string} [propProvider]
 * @param {string} [propModel]
 */
export function resolveEffectiveAiPick(propProvider, propModel) {
  const p = String(propProvider || "auto").trim().toLowerCase() || "auto";
  const m = typeof propModel === "string" ? propModel : "";
  if (p && p !== "auto" && ALLOWED.has(p)) {
    return { aiProvider: p, aiModel: m };
  }
  const stored = loadPanelinAiSelection();
  if (stored.aiProvider && stored.aiProvider !== "auto") {
    return stored;
  }
  return { aiProvider: "auto", aiModel: "" };
}

/**
 * Human label for voice / status chrome.
 * @param {string} aiProvider
 * @param {string} [aiModel]
 */
export function formatAiChatModelLabel(aiProvider, aiModel = "") {
  const p = String(aiProvider || "auto").trim().toLowerCase() || "auto";
  if (!p || p === "auto") return "Auto (cadena del servidor)";
  return aiModel ? `${p} / ${aiModel}` : p;
}
