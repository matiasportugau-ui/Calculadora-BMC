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

/**
 * Maps a CRM `origen` free-form string (e.g. "ML", "Mercado Libre", "WA",
 * "WhatsApp", "Email", "Gmail", "Web", "CRM") to a canonical KB surface.
 * Case-insensitive. Mirrors patterns already used in bmcDashboard.js
 * (send-approved branches) for consistent classification across the route.
 *
 * @param {unknown} origen
 * @returns {typeof KB_SURFACES[number]}
 */
export function mapOrigenToSurface(origen) {
  if (typeof origen !== "string" || !origen) return DEFAULT_SURFACE;
  const s = origen.trim();
  if (!s) return DEFAULT_SURFACE;
  if (/\b(ml|mercado\s*libre|mercadolibre)\b/i.test(s)) return "mercado_libre";
  if (/\b(wa|whats?app)\b/i.test(s)) return "whatsapp";
  if (/\b(email|e-?mail|gmail|imap|correo)\b/i.test(s)) return "email";
  if (/\b(wolfboard|wolf\s*board)\b/i.test(s)) return "wolfboard";
  return DEFAULT_SURFACE;
}
