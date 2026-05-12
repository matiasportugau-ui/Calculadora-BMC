/**
 * WA Cockpit — F2 enricher core (lógica pura, sin loop).
 * El loop vive en waEnricherWorker.js. Acá: classifyIntent + generación
 * de las 3 sugerencias usando agentCore.callAgentOnce(channel="wa").
 */
import { callAgentOnce } from "./agentCore.js";
import { buildWaCockpitSuggestionsBlock } from "./chatPrompts.js";

const MAX_HISTORY_MSGS = 12;
const MAX_OPTIONS = 3;

const INTENT_HINTS = [
  { intent: "cotizacion", patterns: [/cotiz/i, /presupuesto/i, /precio/i, /m[2²]/i, /metros/i, /usd/i, /\$\s?\d/i, /cu[aá]nto sale/i] },
  { intent: "consulta_tecnica", patterns: [/espesor/i, /lambda/i, /aut[oó]port/i, /panel/i, /isodec/i, /isoroof/i, /isopanel/i, /isowall/i, /eps|pir|lana/i, /color/i, /perfil/i, /fijaci[oó]n/i] },
  { intent: "follow_up", patterns: [/segu[ií]/i, /sigue/i, /qued[oó] pendiente/i, /retomar/i, /volv[ií]/i] },
  { intent: "objecion", patterns: [/caro/i, /alto/i, /dif[ií]cil/i, /no me convence/i, /lo pienso/i, /lo piensa/i, /duda/i] },
  { intent: "cierre", patterns: [/firmo|firmar|orden de compra|seña|seña?l|comprar|\bok\s*compr/i] },
];

/**
 * Heuristic intent classifier (offline, sin LLM). El enricher la usa para skip
 * `chatter` antes de pegarle al LLM y como fallback si la respuesta del modelo
 * viene corrupta.
 */
export function classifyIntent(text) {
  const s = String(text || "").toLowerCase().trim();
  if (!s) return "chatter";
  if (s.length < 4 && /^(ok|si|sí|no|gracias|dale|listo)$/i.test(s)) return "chatter";
  for (const { intent, patterns } of INTENT_HINTS) {
    if (patterns.some((p) => p.test(s))) return intent;
  }
  return "chatter";
}

const ALLOWED_INTENTS = new Set(["cotizacion", "consulta_tecnica", "objecion", "follow_up", "cierre", "chatter"]);
const ALLOWED_TONES = new Set(["corta", "tecnica", "cierre"]);

/**
 * Parsea (defensivamente) el JSON que produce el LLM en modo cockpit.
 * Devuelve { intent, confidence, options } sane o null si no se pudo.
 *
 * Estrategia (en orden):
 *   1) JSON limpio entre `{` y `}`.
 *   2) Si falla, intenta extraer un bloque ```json ... ``` aunque tenga texto antes/después.
 *   3) Si falla, intenta detectar 3 opciones desde texto natural (formato "1." / "2." / "3." o
 *      bullets con etiquetas "corta:", "técnica:", "cierre:") como fallback amable.
 */
export function parseSuggestionJson(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let text = raw.trim();

  // Strip code-fence accidental
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Estrategia 1: primer `{` hasta el último `}`
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  let obj = null;
  if (first >= 0 && last > first) {
    try {
      obj = JSON.parse(text.slice(first, last + 1));
    } catch {
      obj = null;
    }
  }

  // Estrategia 2: cualquier bloque ```json ... ``` enterrado en prosa
  if (!obj) {
    const m = text.match(/```json\s*([\s\S]*?)```/i);
    if (m) {
      try {
        obj = JSON.parse(m[1].trim());
      } catch {
        obj = null;
      }
    }
  }

  // Estrategia 3: fallback texto natural (heurístico)
  if (!obj) {
    const fallback = parseNaturalLanguageFallback(raw);
    if (fallback) obj = fallback;
  }

  if (!obj || typeof obj !== "object") return null;

  const intent = ALLOWED_INTENTS.has(obj.intent) ? obj.intent : null;
  const confidence =
    typeof obj.confidence === "number" && obj.confidence >= 0 && obj.confidence <= 1
      ? obj.confidence
      : null;

  const options = Array.isArray(obj.options) ? obj.options : [];
  const cleanOptions = [];
  for (const opt of options) {
    if (!opt || typeof opt !== "object") continue;
    const tone = ALLOWED_TONES.has(opt.tone) ? opt.tone : null;
    const txt = typeof opt.text === "string" ? opt.text.trim().slice(0, 600) : "";
    if (!tone || !txt) continue;
    cleanOptions.push({ tone, text: txt });
    if (cleanOptions.length >= MAX_OPTIONS) break;
  }

  return { intent, confidence, options: cleanOptions };
}

/**
 * Si el LLM devolvió texto natural en vez de JSON, intentamos extraer 3
 * opciones detectando patrones tipo numerados o etiquetas por tono.
 * Este parser es deliberadamente conservador: si no encuentra estructura
 * clara, devuelve null y el caller marca `error: "parse_failed"`.
 */
function parseNaturalLanguageFallback(raw) {
  const text = String(raw || "").replace(/\r/g, "");
  const blocks = [];

  // Patrón A: "1. ...", "2. ...", "3. ..."
  const numbered = [...text.matchAll(/(?:^|\n)\s*(\d)[.)]\s*([^\n]+(?:\n(?!\s*\d[.)])[^\n]+)*)/g)];
  if (numbered.length >= 3) {
    for (let i = 0; i < Math.min(3, numbered.length); i++) {
      const tone = i === 0 ? "corta" : i === 1 ? "tecnica" : "cierre";
      blocks.push({ tone, text: numbered[i][2].trim().slice(0, 600) });
    }
  }

  // Patrón B: "Corta: ...", "Técnica: ...", "Cierre: ..."
  if (blocks.length === 0) {
    const labels = [
      { tone: "corta", re: /(?:^|\n)\s*(?:opci[oó]n\s+)?corta\s*[:\-—]\s*([^\n]+(?:\n(?!\s*(?:opci[oó]n\s+)?(?:corta|t[eé]cnica|cierre)\s*[:\-—])[^\n]+)*)/i },
      { tone: "tecnica", re: /(?:^|\n)\s*(?:opci[oó]n\s+)?t[eé]cnica\s*[:\-—]\s*([^\n]+(?:\n(?!\s*(?:opci[oó]n\s+)?(?:corta|t[eé]cnica|cierre)\s*[:\-—])[^\n]+)*)/i },
      { tone: "cierre", re: /(?:^|\n)\s*(?:opci[oó]n\s+)?cierre\s*[:\-—]\s*([^\n]+(?:\n(?!\s*(?:opci[oó]n\s+)?(?:corta|t[eé]cnica|cierre)\s*[:\-—])[^\n]+)*)/i },
    ];
    for (const { tone, re } of labels) {
      const m = text.match(re);
      if (m) blocks.push({ tone, text: m[1].trim().slice(0, 600) });
    }
  }

  if (blocks.length === 0) return null;
  return { intent: null, confidence: null, options: blocks };
}

/**
 * Construye el array de mensajes (estilo OpenAI) que se envía a callAgentOnce
 * a partir del historial de la conversación.
 */
export function buildMessagesFromHistory(messages) {
  const trimmed = messages.slice(-MAX_HISTORY_MSGS);
  return trimmed
    .filter((m) => m && m.text && (m.direction === "in" || m.direction === "out"))
    .map((m) => ({
      role: m.direction === "in" ? "user" : "assistant",
      content: String(m.text).slice(0, 2000),
    }));
}

/**
 * Genera las 3 opciones llamando al pipeline AI compartido.
 *
 * @param {object} opts
 * @param {Array<{direction:string, text:string, ts:string}>} opts.history
 * @param {string} [opts.intentHint]
 * @returns {Promise<{intent: string|null, confidence: number|null, options: Array, provider: string|null, latency_ms: number, error?: string}>}
 */
export async function generateSuggestions({ history, intentHint }) {
  const messages = buildMessagesFromHistory(history);
  if (messages.length === 0) {
    return { intent: null, confidence: null, options: [], provider: null, latency_ms: 0, error: "no_history" };
  }

  // Inyectamos el bloque de modo cockpit como un mensaje "user" final muy explícito.
  // Usamos `channel: "chat"` (no "wa") para evitar el conflicto con la regla "Cerrar con
  // ¡Saludos! BMC Uruguay" — acá NO queremos un mensaje conversacional, queremos JSON.
  const block = buildWaCockpitSuggestionsBlock();
  const cockpitInstruction =
    `[CRITICAL OUTPUT FORMAT OVERRIDE — IGNORE all previous channel formatting rules]\n` +
    `${block}\n\n` +
    `Intent heurístico detectado: ${intentHint || "n/a"}.\n\n` +
    `RESPUESTA: Devuelve EXCLUSIVAMENTE el JSON descrito arriba. Nada antes, nada después. ` +
    `No incluyas saludos, despedidas, ni texto de relleno. La primera carácter de tu respuesta debe ser \`{\` y el último \`}\`.`;

  const lastUser = messages[messages.length - 1];
  if (lastUser?.role === "user") {
    lastUser.content = `${lastUser.content}\n\n${cockpitInstruction}`;
  } else {
    messages.push({ role: "user", content: cockpitInstruction });
  }

  const t0 = Date.now();
  let text = "";
  let provider = null;
  try {
    // taskKey="suggestions" → lee config.ai.suggestions (provider/model/temp/maxTokens)
    // desde waConfig en runtime. channel:"chat" mantiene formato JSON crudo (sin
    // "Cerrar con ¡Saludos!").
    const r = await callAgentOnce(messages, { channel: "chat", taskKey: "suggestions" });
    text = String(r?.text || "");
    provider = r?.provider || null;
  } catch (e) {
    return {
      intent: intentHint || null,
      confidence: null,
      options: [],
      provider: null,
      latency_ms: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const parsed = parseSuggestionJson(text);
  if (!parsed) {
    return {
      intent: intentHint || null,
      confidence: null,
      options: [],
      provider,
      latency_ms: Date.now() - t0,
      error: "parse_failed",
    };
  }

  return {
    intent: parsed.intent || intentHint || null,
    confidence: parsed.confidence,
    options: parsed.options,
    provider,
    latency_ms: Date.now() - t0,
  };
}
