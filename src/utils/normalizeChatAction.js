/**
 * Voice realtime tools emit OpenAI/Grok function-call args as objects
 * (`{ listaPrecios: "venta" }`, `{ flete: 240 }`, `{ scenario: "solo_techo" }`),
 * while text-chat / aplicar_estado_calc emits scalar payloads for setLP /
 * setFlete / setScenario. handleChatAction historically expected scalars —
 * applying the voice object as-is leaves listaPrecios non-comparable,
 * setFlete(Number(obj)) → NaN, and setScenario(obj) without a scenarioDef.
 */

const SCALAR_KEYS = {
  setScenario: ["scenario"],
  setLP: ["listaPrecios", "lista"],
  setFlete: ["flete"],
  setWizardStep: ["wizardStep", "step"],
};

function unwrapScalarPayload(payload, keys) {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(payload, key) && payload[key] != null) {
      return payload[key];
    }
  }
  return payload;
}

/**
 * @param {{ type?: string, payload?: unknown } | null | undefined} action
 * @returns {{ type?: string, payload?: unknown } | null | undefined}
 */
export function normalizeChatAction(action) {
  if (!action || typeof action !== "object" || !action.type) return action;
  const keys = SCALAR_KEYS[action.type];
  if (!keys) return action;
  const payload = unwrapScalarPayload(action.payload, keys);
  if (payload === action.payload) return action;
  return { ...action, payload };
}
