/**
 * Canonical config for Panelin Front (public storefront agent).
 * Env still wins for kill switch, CORS, WA number, chat model (see server/config.js).
 */
export const STOREFRONT_AGENT_CONFIG = Object.freeze({
  name: "Panelin Front",
  voice: "rex",
  languageHint: "es-MX",
  sttLabel: "Leila",
  maxSessionMs: 8 * 60 * 1000,
  chatModelEnv: "STOREFRONT_CHAT_MODEL",
  chatModelDefault: "grok-3-mini",
  reasoning: { effort: "high" },
  lead: {
    origen: "VW",
    required: Object.freeze(["nombre", "telefono"]),
    optional: Object.freeze(["zona", "email"]),
    gate: "nombre+telefono before chat",
    startConsulta: "Chat tienda Panelin — inicio",
  },
  intakeOrder: Object.freeze(["nombre", "telefono", "tipo", "medidas", "luz", "zona"]),
  quote: {
    mode: "insist-only",
    lista: "web",
    pdf: true,
    attachToLead: true,
    shipping: "never",
    disclaimer:
      "Estoy aprendiendo y esto puede no ser muy preciso, pero vamos a intentarlo. " +
      "Te armo una aproximación con la calculadora y te dejo un PDF para descargar. " +
      "El flete no va incluido: hay que corroborarlo aparte.",
    fleteNote: "flete: no cotizado / a corroborar",
  },
  shopHosts: Object.freeze([
    "bmcuruguay.com.uy",
    "www.bmcuruguay.com.uy",
    "xj4rir-qz.myshopify.com",
  ]),
});

export const STOREFRONT_QUOTE_DISCLAIMER = STOREFRONT_AGENT_CONFIG.quote.disclaimer;
export const STOREFRONT_FLETE_NOTE = STOREFRONT_AGENT_CONFIG.quote.fleteNote;
