/**
 * server/lib/embeddings.js — Provider-agnostic text embedding (multi-provider).
 *
 * Strategy (runtime):
 *  1. EMBEDDINGS_PROVIDER=openai|gemini|stub fuerza un provider específico.
 *  2. Sin override (auto): cadena openai → gemini, usando el primero con key
 *     usable. Si un provider falla por cuota/auth (401/402/403/429, "credit",
 *     "quota", "billing"), se marca muerto por 5 min y la cadena sigue al
 *     siguiente — así una key de OpenAI presente pero sin créditos ya no
 *     tumba el pipeline (bug observado 2026-08-10: 429 credit_balance_exhausted).
 *  3. Sin ninguna key usable → stub determinístico basado en hash (mismo shape:
 *     1536 floats). El stub garantiza que el pipeline corre en desarrollo sin
 *     credenciales y que la columna vector(1536) recibe datos con forma correcta.
 *
 * Providers reales:
 *  - OpenAI text-embedding-3-small (1536 dims nativas, L2-normalizado por la API).
 *  - Gemini gemini-embedding-001 con outputDimensionality=1536. OJO: con dims
 *    distintas de 3072 la API NO normaliza — acá se L2-normaliza manualmente
 *    para que cosine ≡ dot product, igual que OpenAI y el stub.
 *
 * ⚠️ Espacios vectoriales NO compatibles entre providers: un query embebido con
 * Gemini contra corpus embebido con OpenAI da similitudes sin sentido (RAG
 * degrada a "sin resultados", no a resultados incorrectos, por el umbral de
 * distancia). Al cambiar de provider en producción, re-embeber el corpus
 * (scripts/training/embedQuotes.js) — el cache por content_hash en Postgres
 * no re-embebe si el texto no cambió, hay que forzar el batch.
 *
 * Cache en memoria:
 *  Keyed por provider:content_hash. Evita re-embed del mismo texto en la misma
 *  sesión del proceso y evita mezclar espacios si el provider rota en runtime.
 */

import crypto from "node:crypto";
import { config } from "../config.js";
import { isUsableApiKey } from "./apiKeyUtils.js";

const EMBEDDING_DIM = 1536;

const GEMINI_EMBED_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const OPENAI_EMBED_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

/** Orden de la cadena en modo auto. */
const PROVIDER_ORDER = ["openai", "gemini"];

/** Cooldown tras error de cuota/auth antes de reintentar un provider. */
const DEAD_COOLDOWN_MS = 5 * 60 * 1000;

// provider → epoch ms hasta el cual se considera muerto (cuota agotada / key inválida)
const _deadUntil = new Map();

// In-process cache: `${provider}:${content_hash}` → number[] (1536)
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
  const { embedding } = await embedTextWithProvider(text, contentHash);
  return embedding;
}

/**
 * Igual que embedText pero retorna también qué provider generó el vector —
 * necesario para filtrar por espacio vectorial compatible en las queries
 * pgvector (rag.js) y para el tag provider en quote_embeddings.
 *
 * @param {string} text
 * @param {string} [contentHash]
 * @returns {Promise<{ embedding: number[], provider: "openai"|"gemini"|"stub" }>}
 */
export async function embedTextWithProvider(text, contentHash) {
  if (!text || typeof text !== "string") {
    throw new Error("embeddings.embedText: text must be a non-empty string");
  }

  const hash = contentHash || hashText(text);
  const chain = _resolveChain();

  if (chain.length === 0) {
    const key = `stub:${hash}`;
    if (!_embeddingCache.has(key)) _embeddingCache.set(key, _stubEmbedding(hash));
    return { embedding: _embeddingCache.get(key), provider: "stub" };
  }

  const errors = [];
  for (const provider of chain) {
    const cacheKey = `${provider}:${hash}`;
    if (_embeddingCache.has(cacheKey)) {
      return { embedding: _embeddingCache.get(cacheKey), provider };
    }

    try {
      const embedding = provider === "gemini" ? await _embedGemini(text) : await _embedOpenAI(text);
      _embeddingCache.set(cacheKey, embedding);
      return { embedding, provider };
    } catch (err) {
      errors.push(`${provider}: ${String(err.message || err).slice(0, 160)}`);
      if (_isQuotaOrAuthError(err)) {
        _deadUntil.set(provider, Date.now() + DEAD_COOLDOWN_MS);
      }
    }
  }

  // Había providers reales configurados pero todos fallaron: propagar, nunca
  // degradar en silencio a stub (vectores no semánticos ensuciarían el corpus).
  const err = new Error(`embeddings.embedText: all providers failed → ${errors.join(" | ")}`);
  err.providerErrors = errors;
  throw err;
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
 * Retorna el nombre del provider activo (primero de la cadena vivo y con key).
 * Útil para logging en embedQuotes.js.
 *
 * @returns {"openai"|"gemini"|"stub"}
 */
export function activeProvider() {
  const chain = _resolveChain();
  return chain[0] || "stub";
}

/**
 * True only when a real embedding provider is configured (semantic vectors).
 * When false, embedText() falls back to deterministic STUB vectors that are
 * NOT semantically meaningful. Callers that depend on real similarity — e.g.
 * RAG grounding in omni/knowledge/kbBridge.js — must gate on this so they never
 * retrieve/ground on garbage vectors when RAG_ENABLED is flipped without a key.
 *
 * Ignora dead-marks transitorios (cuota): si hay key usable, esto es true.
 *
 * @returns {boolean}
 */
export function isSemanticEmbeddingAvailable() {
  const override = _providerOverride();
  if (override === "stub") return false;
  if (override) return _hasUsableKey(override);
  return PROVIDER_ORDER.some(_hasUsableKey);
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/** @returns {string} valor normalizado de EMBEDDINGS_PROVIDER ("" si auto) */
function _providerOverride() {
  const raw = String(config.embeddingsProvider || "").trim().toLowerCase();
  return raw === "auto" ? "" : raw;
}

/**
 * Resuelve la cadena de providers reales a intentar, en orden.
 * Vacía ⇒ usar stub.
 *
 * @param {{
 *   override?: string,
 *   openaiKeyOk?: boolean,
 *   geminiKeyOk?: boolean,
 *   nowMs?: number,
 *   deadUntil?: Map<string, number> | Record<string, number>,
 * }} [opts] — seam de test; omitir en producción (lee config + dead-marks vivos).
 * @returns {("openai"|"gemini")[]}
 */
export function resolveEmbeddingsProviderChain(opts = {}) {
  const overrideRaw =
    opts.override !== undefined
      ? String(opts.override || "").trim().toLowerCase()
      : _providerOverride();
  const override = overrideRaw === "auto" ? "" : overrideRaw;

  const hasKey = (provider) => {
    if (provider === "openai" && typeof opts.openaiKeyOk === "boolean") return opts.openaiKeyOk;
    if (provider === "gemini" && typeof opts.geminiKeyOk === "boolean") return opts.geminiKeyOk;
    return _hasUsableKey(provider);
  };

  if (override === "stub") return [];
  if (override === "openai" || override === "gemini") {
    return hasKey(override) ? [override] : [];
  }

  const now = typeof opts.nowMs === "number" ? opts.nowMs : Date.now();
  const deadUntilMs = (provider) => {
    if (opts.deadUntil instanceof Map) return opts.deadUntil.get(provider) || 0;
    if (opts.deadUntil && typeof opts.deadUntil === "object") {
      return Number(opts.deadUntil[provider] || 0) || 0;
    }
    return _deadUntil.get(provider) || 0;
  };

  return PROVIDER_ORDER.filter((p) => hasKey(p) && deadUntilMs(p) <= now);
}

function _resolveChain() {
  return resolveEmbeddingsProviderChain();
}

/** Clasifica errores de cuota/auth que disparan dead-mark (exportado para tests). */
export function isEmbeddingsQuotaOrAuthError(err) {
  return _isQuotaOrAuthError(err);
}

/** @internal Limpia dead-marks in-process — solo tests. */
export function __clearEmbeddingsDeadMarksForTests() {
  _deadUntil.clear();
}

/**
 * Detecta si la key configurada para el provider es realmente usable.
 * Trata como ausente: vacía, sólo whitespace, o placeholders típicos
 * de .env.example ("******", "your-key-here", "...", "REPLACE_ME").
 *
 * @param {"openai"|"gemini"} provider
 * @returns {boolean}
 */
function _hasUsableKey(provider) {
  const key = provider === "gemini" ? config.geminiApiKey : config.openaiApiKey;
  return isUsableApiKey(key);
}

/**
 * Clasifica errores que indican que el provider no va a responder hasta que
 * intervenga un humano (créditos/billing/key): dispara el dead-mark temporal.
 *
 * @param {Error & { status?: number }} err
 * @returns {boolean}
 */
function _isQuotaOrAuthError(err) {
  const status = err?.status || err?.response?.status || 0;
  if ([401, 402, 403, 429].includes(status)) return true;
  return /credit|quota|billing|insufficient|api key/i.test(String(err?.message || ""));
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
    model: OPENAI_EMBED_MODEL,
    input: text,
    dimensions: EMBEDDING_DIM,
  });

  if (!response?.data?.[0]?.embedding) {
    throw new Error("embeddings._embedOpenAI: respuesta inesperada de la API");
  }

  return response.data[0].embedding;
}

/**
 * Llama a Gemini embedContent (gemini-embedding-001) pidiendo 1536 dims.
 * REST directo (sin SDK) — la key viaja en header, nunca en la URL.
 * La API no normaliza salidas ≠3072 dims → se normaliza L2 acá.
 *
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function _embedGemini(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:embedContent`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.geminiApiKey,
    },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIM,
    }),
  });

  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(
      `embeddings._embedGemini: ${body?.error?.message || `HTTP ${resp.status}`}`,
    );
    err.status = resp.status;
    throw err;
  }

  const values = body?.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIM) {
    throw new Error(
      `embeddings._embedGemini: respuesta inesperada (dims=${values?.length ?? "?"})`,
    );
  }

  return _l2Normalize(values);
}

/**
 * Normalización L2 in-place-safe: retorna un array nuevo con longitud 1.
 * Hace que cosine similarity ≡ dot product, consistente entre providers.
 *
 * @param {number[]} values
 * @returns {number[]}
 */
function _l2Normalize(values) {
  let norm = 0;
  for (const v of values) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm === 0) return values.slice();
  return values.map((v) => v / norm);
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

  return _l2Normalize(Array.from(raw));
}
