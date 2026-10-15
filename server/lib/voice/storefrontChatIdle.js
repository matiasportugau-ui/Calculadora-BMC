/**
 * Storefront chat idle + closeout helpers (widget copies the same strings).
 * One check-in after silence; no more until the shopper replies.
 * Closeout on farewell / cut / abandon → Admin 2.0 col J.
 */

export const CHAT_IDLE_MS = 25 * 1000;
export const CHAT_ABANDON_MS = 50 * 1000;
export const CHAT_HIDDEN_MS = 60 * 1000;
export const CHAT_CHECKIN = "¿Seguís ahí? Cuando quieras seguimos con la aproximación.";
export const CHAT_CLOSEOUT_BYE = "Quedó registrada tu consulta en BMC. Cuando quieras volvemos.";

const FAREWELL_RE =
  /\b(chau|adios|adeu|nos vemos|hasta luego|me voy|despues sigo|bye)\b/;
const THANKS_ONLY_RE = /^(muchas gracias|gracias|listo,? gracias|dale,? gracias)[\s!.]*$/;
// A farewell is a short closing line; anything with a question or numbers is a real message.
const FAREWELL_MAX_WORDS = 6;

export function isStorefrontFarewell(text) {
  const t = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
  if (!t || /[?\d]/.test(t) || t.split(/\s+/).length > FAREWELL_MAX_WORDS) return false;
  return FAREWELL_RE.test(t) || THANKS_ONLY_RE.test(t);
}

export function formatCloseoutFooter(reason) {
  const r = String(reason || "closed").slice(0, 40);
  return `— closeout ${r}`;
}
