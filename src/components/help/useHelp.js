import { useContext } from "react";
import { HelpContext } from "./helpContext.js";
import { isKnownAnchor } from "./anchors.js";

// Per-id dedup so re-renders + React StrictMode double-invoke in DEV don't
// spam the console with the same warning. Module-scope: lives for the
// session. Reset on hot reload (acceptable for DEV-only signal).
const _warnedHelp = new Set();
const _warnedFtt = new Set();

function warnOnce(set, id, message) {
  if (set.has(id)) return;
  set.add(id);
  console.warn(message);
}

export function useHelpContext() {
  return useContext(HelpContext);
}

/**
 * Devuelve el step entero por id, o null si no existe.
 * Step shape: { id, intent, helpType, helpText: { short, long }, screenshot, ... }
 *
 * Dev-warn: if id is non-empty, not in HELP_ANCHORS const, AND has no matching
 * step in the current source — fires a console.warn in DEV builds only,
 * once per unknown id. This distinguishes "anchor in code but step not in
 * source.json" (silent OK) from "typo / unknown anchor" (warned).
 */
export function useHelp(id) {
  const { steps } = useHelpContext();
  if (!id) return null;
  const step = steps.get(id) || null;
  if (!step && import.meta.env.DEV && !isKnownAnchor(id)) {
    warnOnce(
      _warnedHelp,
      id,
      `[useHelp] Unknown anchor id "${id}". ` +
        `Add it to HELP_ANCHORS in src/components/help/anchors.js or fix the typo at the call site.`,
    );
  }
  return step;
}

/**
 * Devuelve { dismissed: boolean, dismiss: () => void } para un id dado.
 * Usar en FirstTimeTip / Callout dismissible.
 */
export function useFirstTimeTipState(id) {
  const { dismissed, dismiss } = useHelpContext();
  if (id && import.meta.env.DEV && !isKnownAnchor(id)) {
    warnOnce(_warnedFtt, id, `[useFirstTimeTipState] Unknown anchor id "${id}".`);
  }

  return {
    dismissed: id ? dismissed.has(id) : false,
    dismiss: () => id && dismiss(id),
  };
}

/**
 * Reset de todos los dismissed (botón "mostrar tutoriales de nuevo").
 */
export function useResetHelp() {
  const { reset } = useHelpContext();
  return reset;
}

// Re-export for convenience: components can `import { useHelp, HELP_ANCHORS } from ".../useHelp"`.
export { HELP_ANCHORS } from "./anchors.js";
