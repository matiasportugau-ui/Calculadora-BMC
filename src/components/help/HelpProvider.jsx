import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { STORAGE_KEY, FALLBACK_SOURCE, loadDismissed, persistDismissed, buildStepsMap } from "./helpUtils.js";

/**
 * Help / tutorial provider.
 *
 * Consume `source` (de `docs/walkthrough/admin-cot/source.json`) y expone
 * los steps por id. Si no se pasa source, usa el FALLBACK_SOURCE — un seed
 * minimo para que los componentes funcionen mientras el walkthrough no
 * haya corrido todavía.
 *
 * También gestiona "dismissed" para FirstTimeTip: ids que el usuario ya
 * descartó. Persiste en localStorage["bmc_admin_cot_help_dismissed"].
 */

const HelpContext = createContext({
  steps: new Map(),
  dismissed: new Set(),
  dismiss: () => {},
  reset: () => {},
});

export function HelpProvider({ children, source = FALLBACK_SOURCE }) {
  const steps = useMemo(() => buildStepsMap(source), [source]);
  const [dismissed, setDismissed] = useState(loadDismissed);

  // Prod-fallback warn — if PROD is using the embedded fallback, the consumer
  // forgot to pass `source` (or source.json import failed). Tutorial coverage
  // will be the 6 seed steps only. Identity check is stable: default-prop
  // assignment reuses the same FALLBACK_SOURCE module-scope const reference.
  useEffect(() => {
    if (import.meta.env.PROD && source === FALLBACK_SOURCE) {
      console.warn(
        "[HelpProvider] PROD is using FALLBACK_SOURCE (6 seed steps). " +
          "Consumer likely forgot to import source.json — tutorial coverage will be minimal.",
      );
    }
  }, [source]);

  // Re-sync if another tab updates dismissed list
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setDismissed(loadDismissed());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const dismiss = useCallback((id) => {
    setDismissed((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      persistDismissed(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setDismissed(new Set());
    persistDismissed(new Set());
  }, []);

  const value = useMemo(() => ({ steps, dismissed, dismiss, reset }), [steps, dismissed, dismiss, reset]);

  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- useHelpContext hook is contextual to HelpProvider and must be exported together
export function useHelpContext() {
  return useContext(HelpContext);
}
