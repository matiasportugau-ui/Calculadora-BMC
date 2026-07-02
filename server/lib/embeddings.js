/**
 * server/lib/embeddings.js — Provider-agnostic text embedding.
 *
 * Strategy (runtime):
 *  1. Si config.openaiApiKey está configurado → usa OpenAI text-embedding-3-small (1536 dim).
 *  2. Sin key → stub determinístico basado en hash (mismo shape: 1536 floats).
 *     El stub garantiza que el pipeline corre en desarrollo sin credenciales y
 *     que la columna vector(1536) de Postgres recibe datos con la forma correcta.
 *
 * Agregar providers futuros:
 *  - Voyage AI: misma firma embedText(), detectar via VOYAGE_API_KEY en config,
 *    llamar POST https://api.voyageai.com/v1/embeddings, model="voyage-2", output_dimension=1536.
 *  - Cohere: similar con COHERE_API_KEY, POST https://api.cohere.com/v1/embed, input_type="search_document".
 *  - En todos los casos: mantener 1536 dims para compatibilidad con la columna vector(1536).
 *    Si el provider usa dimensión diferente (ej. Voyage voyage-3-large = 2048), crear
 *    una nueva columna/tabla o agregar un flag de dimensión en quote_embeddings.
 *
 * Cache en memoria:
 *  Keyed por content_hash. Evita re-embed del mismo texto en la misma sesión del proceso.
 *  El caché no persiste entre reinicios de Cloud Run (ephemeral). Suficiente para el batch.
 */

import crypto from "node:crypto";
import { config } from "../config.js";
import { isUsableApiKey } from "./apiKeyUtils.js";

const EMBEDDING_DIM = 1536;

// In-process cache: content_hash → Float32Array (1536)
// Ring buffer implícito: si crece demasiado, las entradas más viejas se pierden por GC.
// Para producción con corpus grande, considerar un LRU de 10k entradas.
const _embeddingCache = new Map();

/**
 * Genera un embedding de 1536 dimensiones para el texto dado.
 *
 * @param {string} text — texto a embeber (no vacío)
 * @param {string} [contentHash] — hash precomputado del texto para cache lookup.
 *   Si se omite, se calcula internamente. Pasarlo desde embedQuotes.js evita doble hash.
 * @returns {Promise<number[]>} — array de 1536 floats
 */
export async function embedText(text, contentHash) {
  if (!text || typeof text !== "string") {
    throw new Error("embeddings.embedText: text must be a non-empty string");
  }

  const hash = contentHash || hashText(text);

  // Cache hit
  if (_embeddingCache.has(hash)) {
    return _embeddingCache.get(hash);
  }

  let embedding;

  if (_hasUsableOpenAIKey()) {
    embedding = await _embedOpenAI(text);
  } else {
    embedding = _stubEmbedding(hash);
  }

  _embeddingCache.set(hash, embedding);
  return embedding;
}

/**
 * Calcula el sha256 hex del texto (primeros 64 chars del hex = 256 bits).
 * Coincide con el content_hash guardado en quote_embeddings.
 *
 * @param {string} text
 * @returns {string}
 */
export function hashText(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Retorna el nombre del provider activo.
 * Útil para logging en embedQuotes.js.
 *
 * @returns {"openai"|"stub"}
 */
export function activeProvider() {
  return _hasUsableOpenAIKey() ? "openai" : "stub";
}

/**
 * True only when a real embedding provider is configured (semantic vectors).
 * When false, embedText() falls back to deterministic STUB vectors that are
 * NOT semantically meaningful. Callers that depend on real similarity — e.g.
 * RAG grounding in omni/knowledge/kbBridge.js — must gate on this so they never
 * retrieve/ground on garbage vectors when RAG_ENABLED is flipped without a key.
 *
 * @returns {boolean}
 */
export function isSemanticEmbeddingAvailable() {
  return _hasUsableOpenAIKey();
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Detecta si la OPENAI_API_KEY configurada es realmente usable.
 * Trata como ausente: vacía, sólo whitespace, o placeholders típicos
 * de .env.example ("sk-...", "your-key-here", "...", "REPLACE_ME").
 * Esto evita 401s en dev/test cuando hay un valor placeholder en .env.
 *
 * @returns {boolean}
 */
function _hasUsableOpenAIKey() {
  // Shared placeholder-aware check (also catches "sk-your-...", which the old
  // inline regex missed). See server/lib/apiKeyUtils.js.
  return isUsableApiKey(config.openaiApiKey);
}

/**
 * Llama a OpenAI text-embedding-3-small (1536 dims).
 * Usa el SDK openai ya instalado en el proyecto.
 *
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function _embedOpenAI(text) {
  // Importación dinámica para que el módulo cargue sin OPENAI_API_KEY si se usa stub.
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: config.openaiApiKey });

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: EMBEDDING_DIM,
  });

  if (!response?.data?.[0]?.embedding) {
    throw new Error("embeddings._embedOpenAI: respuesta inesperada de la API");
  }

  return response.data[0].embedding;
}

/**
 * Embedding stub determinístico: mismo hash → mismo vector, siempre.
 *
 * Algoritmo: toma el sha256 del hash como semilla (32 bytes), extiende a
 * 1536*4 bytes con SHA-256 iterativo, interpreta como floats entre -1 y 1,
 * luego L2-normaliza para que se comporte como un embedding real (longitud=1).
 *
 * Garantías:
 *  - Misma entrada → mismo vector (determinístico).
 *  - Textos distintos → vectores ortogonales entre sí (alta entropía de hash).
 *  - Shape correcto para la columna vector(1536) de pgvector.
 *  - No requiere red ni API key.
 *
 * Limitación: la similitud coseno entre embeddings stub NO es semántica.
 * Solo sirve para verificar que el pipeline funciona; el RAG en modo stub
 * no va a recuperar casos relevantes.
 *
 * @param {string} contentHash — sha256 hex del texto
 * @returns {number[]}
 */
function _stubEmbedding(contentHash) {
  // Generar suficientes bytes pseudo-aleatorios a partir del hash
  const bytes = [];
  let seed = contentHash;
  while (bytes.length < EMBEDDING_DIM * 4) {
    const chunk = crypto.createHash("sha256").update(seed).digest();
    for (const b of chunk) bytes.push(b);
    seed = chunk.toString("hex");
  }

  // Convertir a floats en [-1, 1]
  const raw = new Float64Array(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    const b0 = bytes[i * 4];
    const b1 = bytes[i * 4 + 1];
    const b2 = bytes[i * 4 + 2];
    const b3 = bytes[i * 4 + 3];
    const uint32 = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;
    raw[i] = (uint32 / 0x7fffffff) - 1; // [-1, 1]
  }

  // L2 normalization (hace que cosine similarity = dot product)
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) norm += raw[i] * raw[i];
  norm = Math.sqrt(norm);

  const result = new Array(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    result[i] = norm > 0 ? raw[i] / norm : 0;
  }

  return result;
}
