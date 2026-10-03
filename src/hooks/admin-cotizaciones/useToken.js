import { useCockpitOperatorAuth } from "../useCockpitOperatorAuth.js";

/** Identity JWT for Administrador de Cotizaciones. Same auth call as the old hook. */
export function useToken() {
  return useCockpitOperatorAuth({ role: "admin" });
}
