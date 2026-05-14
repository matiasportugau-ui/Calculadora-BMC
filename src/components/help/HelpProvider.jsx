import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

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

const STORAGE_KEY = "bmc_admin_cot_help_dismissed";

const FALLBACK_SOURCE = {
  generatedAt: null,
  mode: "fallback",
  steps: [
    {
      id: "topbar-live",
      intent: "Indicador de conexión y actividad",
      helpType: "tooltip",
      helpText: {
        short: "Verde = listo. Amarillo = procesando. Rojo = error o token inválido.",
        long: "Refleja el estado vivo del módulo: cargar pendientes, batch IA, sync CRM, marcar enviadas. Si queda rojo, revisá el token o reintentá con R.",
      },
    },
    {
      id: "kpi-pendientes",
      intent: "Pendientes",
      helpType: "tooltip",
      helpText: {
        short: "Filas con consulta sin marcar Aprobada/Enviada",
        long: "Es el embudo principal: cotizaciones que requieren acción tuya. Filtrá con las pills para focalizar.",
      },
    },
    {
      id: "kpi-error",
      intent: "Con error ⚠",
      helpType: "tooltip",
      helpText: {
        short: "Respuestas IA marcadas con ⚠",
        long: "El batch IA falló para estas filas (faltó contexto, consulta ambigua, etc.). Revisalas a mano o reprocesá con la flag 'Forzar' en Generar IA.",
      },
    },
    {
      id: "kpi-stale",
      intent: "≥14 días sin enviar",
      helpType: "tooltip",
      helpText: {
        short: "Cotizaciones envejecidas — alta prioridad",
        long: "Filas con consulta hace ≥14 días que siguen abiertas. Cerralas (Marcar enviada) o archivalas — si no, perdés contexto del cliente y la oportunidad.",
      },
    },
    {
      id: "batch-modal",
      intent: "Generar IA en lote",
      helpType: "first-time-tip",
      helpText: {
        short: "Procesa todas las pendientes con IA",
        long: "Llama al backend (/api/wolfboard/quote-batch) que recorre todas las filas con consulta sin respuesta. Forzar = reprocesa ⚠. SyncCRM = propaga a CRM_Operativo. Persiste tus selecciones en localStorage.",
      },
    },
    {
      id: "drawer-regenerate-hint",
      intent: "Por qué no hay 'Regenerar IA' por fila",
      helpType: "inline-?",
      helpText: {
        short: "El backend es bulk-only por ahora",
        long: "El endpoint /api/wolfboard/quote-batch no acepta rowNum. Para regenerar una fila, vaciá su respuesta y corré Generar IA — el batch agarra todas las pendientes. Issue trackeado para hacer el endpoint per-row.",
      },
    },
  ],
};

const HelpContext = createContext({
  steps: new Map(),
  dismissed: new Set(),
  dismiss: () => {},
  reset: () => {},
});

function loadDismissed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function persistDismissed(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

function buildStepsMap(source) {
  const map = new Map();
  const list = source?.steps || [];
  for (const s of list) {
    if (s && s.id) map.set(s.id, s);
  }
  return map;
}

export function HelpProvider({ children, source = FALLBACK_SOURCE }) {
  const steps = useMemo(() => buildStepsMap(source), [source]);
  const [dismissed, setDismissed] = useState(loadDismissed);

  // Prod-fallback warn — if PROD is using the embedded fallback, the consumer
  // forgot to pass `source` (or source.json import failed). Tutorial coverage
  // will be the 6 seed steps only. Identity check is stable: default-prop
  // assignment reuses the same FALLBACK_SOURCE module-scope const reference.
  useEffect(() => {
    if (import.meta.env.PROD && source === FALLBACK_SOURCE) {
      // eslint-disable-next-line no-console
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

export function useHelpContext() {
  return useContext(HelpContext);
}
