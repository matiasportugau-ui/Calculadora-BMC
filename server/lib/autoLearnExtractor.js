/**
 * Extracts factual Q→A pairs from conversation turns using Claude.
 * Candidates below confidence threshold or too similar to existing KB entries are dropped.
 */
import { config } from "../config.js";
import { findRelevantExamples } from "./trainingKB.js";

const EXTRACT_MODEL = "claude-haiku-4-5-20251001";
const MIN_CONFIDENCE = 0.70;
const DEDUP_SCORE_THRESHOLD = 4;
const MAX_PAIRS_PER_CONV = 8;

const EXTRACT_PROMPT = `Analiza esta conversación entre un usuario y el asistente de ventas Panelin/BMC Uruguay.
Extrae pares pregunta→respuesta que sean:
- Hechos concretos (precios, dimensiones, plazos, procesos, productos)
- Información que sería útil recordar en futuras conversaciones
- NO preguntas de cortesía, saludos, ni respuestas vagas

Devuelve un array JSON (sin markdown) con este schema exacto:
[
  {
    "question": "pregunta del usuario o tema detectado",
    "goodAnswer": "respuesta factual del asistente (texto completo, sin truncar)",
    "badAnswer": "respuesta incorrecta detectada o vacío",
    "category": "sales|product|math|conversational",
    "confidence": 0.0-1.0,
    "rationale": "por qué es útil guardar esto"
  }
]

Si no hay pares útiles devuelve [].
Máximo ${MAX_PAIRS_PER_CONV} pares. Prioriza los más concretos y de mayor confianza.`;

export async function extractLearnablePairs(turns) {
  if (!turns || turns.length < 2) return [];
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
    .filter((p) => p && p.question && p.goodAnswer && typeof p.confidence === "number" && p.confidence >= MIN_CONFIDENCE)
    .slice(0, MAX_PAIRS_PER_CONV);

  // Dedup: drop candidates too similar to existing active KB entries
  const unique = filtered.filter((p) => {
    const matches = findRelevantExamples(p.question, { limit: 1 });
    return matches.length === 0 || matches[0].matchScore < DEDUP_SCORE_THRESHOLD;
  });

  return unique;
}
