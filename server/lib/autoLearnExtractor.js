/**
 * Extracts factual Q→A pairs from conversation turns using Claude.
 * Candidates below confidence threshold, too similar to existing KB, or low quality are dropped.
 *
 * @param {Array<{role: string, content: string}>} turns
 * @param {object} [options]
 * @param {string} [options.source] — e.g. "panelin_chat", "wa", "ml", "autolearned"
 * @param {string|null} [options.convId]
 * @param {string} [options.surface]
 * @returns {Promise<Array<object>>} enriched pairs (with source/convId when provided)
 */
import { config } from "../config.js";
import { hasSimilarQuestion, hasSemanticallySimilarQuestion } from "./trainingKB.js";
import { getExtractorModel, estimateCostUSD } from "./aiProviderConfig.js";

export const EXTRACT_MODEL = getExtractorModel();
export const MIN_CONFIDENCE = 0.70;
export const DEDUP_SCORE_THRESHOLD = 4;
export const MAX_PAIRS_PER_CONV = 8;
export const MIN_GOOD_ANSWER_LEN = 40; // basic quality gate

const EXTRACT_PROMPT = `Eres un especialista en entrenamiento de IA para BMC Uruguay (paneles de aislamiento térmico/acústico — Panelin).

Analiza la conversación y extrae **únicamente** pares pregunta→respuesta de ALTO VALOR para entrenar al agente Panelin en el futuro.

Criterios ESTRICTOS para un par útil:
- Hechos concretos y accionables: precios (siempre aclarar "sin IVA" o "con IVA 22%"), dimensiones reales (m², mm de espesor), familias de panel (ISODEC_EPS, ISOROOF_PLUS, ISOROOF_FOIL, etc.), escenarios (solo_techo, techo_fachada, camara_frig), tipo de estructura, colores, flete, plazos de entrega, procesos de instalación o venta.
- Información que el agente necesitará recordar en cotizaciones futuras con clientes similares (objeciones comunes, comparaciones entre listas "web" vs "venta", mínimos de pedido, comportamientos de autoportancia, etc.).
- La "goodAnswer" debe ser la respuesta factual y completa que dio el asistente (o que debería haber dado).

REGLAS DURAS:
- NUNCA extraigas saludos, "cómo estás", cortesías o respuestas vagas.
- Si el asistente improvisó un precio sin llamar tools → marca como "badAnswer" o descarta.
- Prioriza pares que mencionen números (precios, m², mm, grados de pendiente, etc.).
- La categoría debe ser una de: sales | product | math | conversational | installation | logistics.

Devuelve SOLO un array JSON válido (sin markdown, sin explicaciones) con este schema EXACTO:
[
  {
    "question": "pregunta o tema concreto del usuario",
    "goodAnswer": "respuesta factual completa del asistente (sin truncar)",
    "badAnswer": "respuesta incorrecta o improvisada que se detectó (o cadena vacía)",
    "category": "sales|product|math|conversational|installation|logistics",
    "confidence": 0.0-1.0,
    "rationale": "breve explicación de por qué este par es valioso para entrenar al agente BMC"
  }
]

Si no hay pares de alto valor, devuelve []. Máximo ${MAX_PAIRS_PER_CONV} pares. Sé exigente con la calidad.`;

/**
 * Extrae pares de entrenamiento de alta calidad.
 * Ahora acepta opciones para propagar metadata de origen (mejora trazabilidad del training).
 */
export async function extractLearnablePairs(turns, options = {}) {
  if (!turns || turns.length < 2) return [];

  const {
    source = "autolearned",
    convId = null,
    surface = null,
  } = options;

  const apiKey = config.anthropicApiKey;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const dialogue = turns
    .map((t) => `${t.role === "user" ? "Usuario" : "Panelin"}: ${String(t.content || "").slice(0, 800)}`)
    .join("\n");

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const msg = await client.messages.create({
    model: EXTRACT_MODEL,
    max_tokens: 2048,
    messages: [
      { role: "user", content: `${EXTRACT_PROMPT}\n\n---\nCONVERSACIÓN:\n${dialogue}` },
    ],
  });

  // Structured observability for training cost & usage
  const usage = msg.usage || {};
  const cost = estimateCostUSD("claude", EXTRACT_MODEL, usage);
  // TODO: thread pino logger here once cost-telemetry module exists
  console.log(JSON.stringify({
    event: "ai_training_extraction",
    model: EXTRACT_MODEL,
    input_tokens: usage.input_tokens || 0,
    output_tokens: usage.output_tokens || 0,
    estimated_cost_usd: cost,
    pairs_extracted: "pending", // will be known after parsing
  }));

  const raw = msg.content?.[0]?.text ?? "[]";
  let pairs;
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    pairs = JSON.parse(cleaned);
    if (!Array.isArray(pairs)) pairs = [];
  } catch {
    return [];
  }

  const filtered = pairs
    .filter((p) => {
      if (!p || !p.question || !p.goodAnswer || typeof p.confidence !== "number") return false;
      if (p.confidence < MIN_CONFIDENCE) return false;
      if (String(p.goodAnswer).trim().length < MIN_GOOD_ANSWER_LEN) return false;
      return true;
    })
    .slice(0, MAX_PAIRS_PER_CONV);

  // Dedup: first fast token overlap, then semantic (embedding cosine) when possible.
  // This dramatically reduces near-duplicate training data in the KB.
  const unique = [];
  for (const p of filtered) {
    if (hasSimilarQuestion(p.question, { threshold: DEDUP_SCORE_THRESHOLD })) continue;

    // Semantic check (async but cheap because of cache + small KB)
    const isSemanticDup = await hasSemanticallySimilarQuestion(p.question, { threshold: 0.83 });
    if (isSemanticDup) continue;

    unique.push(p);
  }

  // Enrich with provenance so addTrainingEntry receives clean source/convId
  const enriched = unique.map((p) => ({
    ...p,
    source: p.source || source,
    convId: p.convId || convId,
    surface: p.surface || surface,
  }));

  // Final log with actual training value produced
  // TODO: thread pino logger here once cost-telemetry module exists
  console.log(JSON.stringify({
    event: "ai_training_extraction_complete",
    model: EXTRACT_MODEL,
    pairs_returned: enriched.length,
    pairs_filtered: filtered.length - unique.length,
  }));

  return enriched;
}
