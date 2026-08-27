/**
 * Persistent local persona for the /logistica trucker Panelin.
 * Survives refresh in this browser (localStorage). No WA send.
 */

export const PERSONA_KEY = "bmc-logistica-trucker-persona-v3";

export const DEFAULT_LOOK =
  "El Transportador: chaqueta negra, calvo, cabina de camión, volante grande, termo y mate."

export const DEFAULT_CORRECTIONS = Object.freeze([
  "Esto es logística mía, la conversación: módulo /logistica BMC Envíos del operador. No es la calculadora. Nunca preguntes escenario techo/pared/cámara ni cotices paneles.",
  "Nunca envíes WhatsApp ni mail. Si hace falta aviso, redactá el texto y esperá que el operador diga enviar.",
  "Álvaro Gonzalez: pedir calle y nro (Maldonado). No inventar dirección ni pin.",
  "ALEDMA: confirmar retiran en planta Kingspan vs entrega Mvdeo antes de cargar dir.",
  "Una sola pregunta por turno. Si el operador corrige o pide cambiar la forma/look, aplicá y persistí.",
]);

export const PERSONA_ACTION_TYPES = Object.freeze([
  "addTruckerCorrection",
  "setTruckerLook",
  "setTruckerArt",
]);

const MAX_CORRECTIONS = 24;
const MAX_LOOK = 400;
const MAX_ART = 1_200_000;

function defaultStorage() {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

export function emptyPersona() {
  return {
    look: DEFAULT_LOOK,
    artSrc: "",
    corrections: [...DEFAULT_CORRECTIONS],
    updatedAt: "",
  };
}

/**
 * @param {Storage|null} [storage]
 */
export function loadTruckerPersona(storage = defaultStorage()) {
  const fallback = emptyPersona();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(PERSONA_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const corrections = Array.isArray(parsed.corrections)
      ? parsed.corrections.map((c) => String(c).trim()).filter(Boolean).slice(-MAX_CORRECTIONS)
      : [...DEFAULT_CORRECTIONS];
    if (!corrections.length) corrections.push(...DEFAULT_CORRECTIONS);
    return {
      look: String(parsed.look || DEFAULT_LOOK).slice(0, MAX_LOOK),
      artSrc: String(parsed.artSrc || "").slice(0, MAX_ART),
      corrections,
      updatedAt: String(parsed.updatedAt || ""),
    };
  } catch {
    return fallback;
  }
}

/**
 * @param {object} persona
 * @param {Storage|null} [storage]
 */
export function saveTruckerPersona(persona, storage = defaultStorage()) {
  const next = {
    look: String(persona?.look || DEFAULT_LOOK).slice(0, MAX_LOOK),
    artSrc: String(persona?.artSrc || "").slice(0, MAX_ART),
    corrections: (Array.isArray(persona?.corrections) ? persona.corrections : [])
      .map((c) => String(c).trim())
      .filter(Boolean)
      .slice(-MAX_CORRECTIONS),
    updatedAt: new Date().toISOString(),
  };
  if (!next.corrections.length) next.corrections.push(...DEFAULT_CORRECTIONS);
  if (storage) {
    try {
      storage.setItem(PERSONA_KEY, JSON.stringify(next));
    } catch {
      /* quota */
    }
  }
  return next;
}

/**
 * @param {object} persona
 * @param {{ type: string, payload?: any }} action
 */
export function applyPersonaAction(persona, action) {
  const cur = {
    look: persona?.look || DEFAULT_LOOK,
    artSrc: persona?.artSrc || "",
    corrections: Array.isArray(persona?.corrections) ? [...persona.corrections] : [...DEFAULT_CORRECTIONS],
    updatedAt: persona?.updatedAt || "",
  };
  const type = action?.type;
  const payload = action?.payload;
  if (type === "addTruckerCorrection") {
    const text = String(payload || "").trim();
    if (!text || text.length > 400) return { ok: false, persona: cur, error: "bad_correction" };
    const folded = text.toLowerCase();
    const next = cur.corrections.filter((c) => c.toLowerCase() !== folded);
    next.push(text);
    cur.corrections = next.slice(-MAX_CORRECTIONS);
    return { ok: true, persona: cur, applied: { type, text } };
  }
  if (type === "setTruckerLook") {
    const look = String(payload || "").trim();
    if (!look) return { ok: false, persona: cur, error: "bad_look" };
    cur.look = look.slice(0, MAX_LOOK);
    return { ok: true, persona: cur, applied: { type, look: cur.look } };
  }
  if (type === "setTruckerArt") {
    const artSrc = String(payload || "").trim();
    if (artSrc && !artSrc.startsWith("data:image/") && !artSrc.startsWith("/")) {
      return { ok: false, persona: cur, error: "bad_art" };
    }
    cur.artSrc = artSrc.slice(0, MAX_ART);
    return { ok: true, persona: cur, applied: { type } };
  }
  return { ok: false, persona: cur, error: "unknown_type" };
}
