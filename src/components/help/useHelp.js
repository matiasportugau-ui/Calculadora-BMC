import { useHelpContext } from "./HelpProvider.jsx";

/**
 * Devuelve el step entero por id, o null si no existe.
 * Step shape: { id, intent, helpType, helpText: { short, long }, screenshot, ... }
 */
export function useHelp(id) {
  const { steps } = useHelpContext();
  if (!id) return null;
  return steps.get(id) || null;
}

/**
 * Devuelve { dismissed: boolean, dismiss: () => void } para un id dado.
 * Usar en FirstTimeTip / Callout dismissible.
 */
export function useFirstTimeTipState(id) {
  const { dismissed, dismiss } = useHelpContext();
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
