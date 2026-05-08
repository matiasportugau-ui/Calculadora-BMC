// KB Surface enum + helpers — multi-canal awareness.
// Brief: docs/team/panelsim/knowledge/KB-MULTICANAL-DESIGN-V2.md §6.1.

/** Canales soportados. Default: panelin_chat. */
export const KB_SURFACES = Object.freeze([
  "panelin_chat",
  "mercado_libre",
  "whatsapp",
  "email",
  "wolfboard",
]);

/** Límite de caracteres por canal (truncado con ellipsis si se excede). */
export const SURFACE_LIMITS = Object.freeze({
  panelin_chat: 4000,
  mercado_libre: 350,
  whatsapp: 700,
  email: 2000,
  wolfboard: 4000,
});

const DEFAULT_SURFACE = "panelin_chat";

/**
 * Normaliza un surface a uno de los valores de KB_SURFACES.
 * Cualquier valor inválido (null, undefined, string desconocido, no-string) → DEFAULT_SURFACE.
 *
 * @param {unknown} value
 * @returns {typeof KB_SURFACES[number]}
 */
export function normalizeSurface(value) {
  if (typeof value !== "string" || !value) return DEFAULT_SURFACE;
  return KB_SURFACES.includes(value) ? value : DEFAULT_SURFACE;
}
