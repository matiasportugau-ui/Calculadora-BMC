/**
 * surface.js — Canonical mapping of customer-facing surfaces to channel rules.
 *
 *   Surface = where the message lands in front of the customer (a brand-level
 *             concept — Mercado Libre, WhatsApp, Instagram, etc.).
 *   Channel = which channelRenderer rules apply (chat | ml | wa).
 *
 * Multiple surfaces can map to the same channel (e.g. instagram and facebook
 * both render through "wa"-style rules: ≤800 chars, friendly tone). New
 * customer surfaces are added by extending SURFACES + the switch in
 * surfaceToChannel — no scattered regex updates.
 */

export const SURFACES = Object.freeze({
  PANELIN_CHAT:  "panelin_chat",
  MERCADO_LIBRE: "mercado_libre",
  WHATSAPP:      "whatsapp",
  INSTAGRAM:     "instagram",
  FACEBOOK:      "facebook",
  EMAIL:         "email",
});

const SURFACE_LIST = Object.values(SURFACES);

/**
 * Coerce arbitrary input into a canonical SURFACES.* slug, or null when
 * nothing matches.
 *
 * Accepts:
 *   - string  ("ml", "MercadoLibre", "wa", "whatsapp", "instagram", ...)
 *   - object  ({ surface, channel, origen, observaciones, ... })
 *
 * For object input, precedence is: surface > channel > origen/observaciones
 * regex sniff (preserves classifyCrmChannel heuristics so the migration is
 * behavior-preserving).
 *
 * @param {string|object|null|undefined} input
 * @returns {string|null}
 */
export function normalizeSurface(input) {
  if (input == null) return null;

  if (typeof input === "string") {
    const s = input.trim().toLowerCase().replace(/[\s_-]+/g, "_");
    if (!s) return null;
    if (SURFACE_LIST.includes(s)) return s;
    if (s === "ml" || s === "mercadolibre" || s === "mercado_libre") return SURFACES.MERCADO_LIBRE;
    if (s === "wa" || s === "wsp")           return SURFACES.WHATSAPP;
    if (s === "ig")                          return SURFACES.INSTAGRAM;
    if (s === "fb" || s === "messenger")     return SURFACES.FACEBOOK;
    if (s === "chat" || s === "panelin")     return SURFACES.PANELIN_CHAT;
    if (s === "mail" || s === "correo")      return SURFACES.EMAIL;
    return null;
  }

  if (typeof input === "object") {
    if (typeof input.surface === "string") {
      const fromSurface = normalizeSurface(input.surface);
      if (fromSurface) return fromSurface;
    }
    if (typeof input.channel === "string") {
      const c = input.channel.trim().toLowerCase();
      if (c === "ml")   return SURFACES.MERCADO_LIBRE;
      if (c === "wa")   return SURFACES.WHATSAPP;
      if (c === "chat") return SURFACES.PANELIN_CHAT;
    }
    const origen = String(input.origen || "");
    const obs    = String(input.observaciones || "");
    // ML signals: explicit "ML", item id "MLU…", or sync metadata "Q:NNN".
    if (/(^|\s|\/)ML(\s|$|\/)/.test(origen) || /\bMLU?\d/i.test(origen) || /\bQ:\d+/i.test(obs)) {
      return SURFACES.MERCADO_LIBRE;
    }
    if (/whatsapp|(^|\s)wa(\s|$)/i.test(origen)) return SURFACES.WHATSAPP;
    if (/instagram|(^|\s)ig(\s|$)|IG-/i.test(origen)) return SURFACES.INSTAGRAM;
    if (/facebook|messenger|(^|\s)fb(\s|$)/i.test(origen)) return SURFACES.FACEBOOK;
    if (/email|correo|(^|\s)mail(\s|$)/i.test(origen)) return SURFACES.EMAIL;
  }

  return null;
}

/**
 * Map a canonical surface to the channel rules used by channelRenderer.
 * Email currently rides the "chat" channel until a dedicated email surface
 * with its own rules ships.
 *
 * @param {string|null} surface
 * @returns {"chat"|"ml"|"wa"}
 */
export function surfaceToChannel(surface) {
  switch (surface) {
    case SURFACES.MERCADO_LIBRE: return "ml";
    case SURFACES.WHATSAPP:
    case SURFACES.INSTAGRAM:
    case SURFACES.FACEBOOK:      return "wa";
    case SURFACES.EMAIL:         return "chat";
    case SURFACES.PANELIN_CHAT:
    default:                     return "chat";
  }
}

/**
 * Reverse helper: pick a representative surface for a given channel.
 * Used when downstream code only has channel context but needs a surface
 * label (e.g. analytics breakdown that wants a brand-level name).
 *
 * @param {string} channel
 * @returns {string}
 */
export function channelToDefaultSurface(channel) {
  if (channel === "ml") return SURFACES.MERCADO_LIBRE;
  if (channel === "wa") return SURFACES.WHATSAPP;
  return SURFACES.PANELIN_CHAT;
}
