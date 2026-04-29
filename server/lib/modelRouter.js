/**
 * server/lib/modelRouter.js
 *
 * Shared in-memory stores for:
 *   - Per-task model routing  (which provider/model A/B/C to use for each task)
 *   - Auto-evolution config   (thresholds and learning toggles)
 *
 * Consumed by:
 *   - server/routes/agentTraining.js  (CRUD REST endpoints)
 *   - server/routes/agentChat.js      (chat + autolearn)
 *   - server/routes/agentTraining.js  (generate-ml-overrides)
 *   - server/routes/bmcDashboard.js   (crm/suggest-response)
 */

// ── Task catalog ────────────────────────────────────────────────────────────
export const MODEL_ROUTING_TASK_CATALOG = [
  { id: "chat",        label: "Chat panel",           channel: "chat",  description: "Respuestas del chat en tiempo real para cotizaciones y consultas" },
  { id: "ml_response", label: "ML — Respuestas",      channel: "ml",    description: "Respuestas automáticas a preguntas de MercadoLibre" },
  { id: "wa_response", label: "WA — Respuestas",      channel: "wa",    description: "Respuestas a consultas de WhatsApp" },
  { id: "crm_suggest", label: "CRM — Sugerencias",    channel: "crm",   description: "Sugerencias de respuesta multi-canal desde CRM_Operativo" },
  { id: "kb_generate", label: "KB — Generación",      channel: "kb",    description: "Generación de nuevas entradas de Knowledge Base desde conversaciones" },
  { id: "quote_batch", label: "Batch cotizaciones",   channel: "admin", description: "Cotizaciones IA en lote desde Admin 2.0 (wolfboard)" },
  { id: "autolearn",   label: "Auto-aprendizaje",     channel: "train", description: "Extracción de pares Q&A para auto-entrenamiento de la KB" },
  { id: "analytics",   label: "Analytics IA",         channel: "train", description: "Análisis de conversaciones, métricas y reportes de rendimiento" },
  { id: "super_agent", label: "Super-agente",         channel: "chat",  description: "Orquestador de herramientas avanzado (calculadora + KB + acciones)" },
];

// ── Default routing config ──────────────────────────────────────────────────
export const DEFAULT_MODEL_ROUTING = {
  chat:         { a: "claude/claude-haiku-4-5-20251001", b: "openai/gpt-4o-mini", c: null },
  ml_response:  { a: "claude/claude-haiku-4-5-20251001", b: "openai/gpt-4o-mini", c: null },
  wa_response:  { a: "claude/claude-haiku-4-5-20251001", b: "openai/gpt-4o-mini", c: null },
  crm_suggest:  { a: "claude/claude-haiku-4-5-20251001", b: "openai/gpt-4o-mini", c: null },
  kb_generate:  { a: "claude/claude-haiku-4-5-20251001", b: "openai/gpt-4o-mini", c: null },
  quote_batch:  { a: "claude/claude-haiku-4-5-20251001", b: "openai/gpt-4o-mini", c: null },
  autolearn:    { a: "claude/claude-haiku-4-5-20251001", b: null,                  c: null },
  analytics:    { a: "claude/claude-haiku-4-5-20251001", b: "openai/gpt-4o-mini", c: null },
  super_agent:  { a: "claude/claude-haiku-4-5-20251001", b: "openai/gpt-4o-mini", c: null },
};

let _modelRoutingStore = { ...DEFAULT_MODEL_ROUTING };

// ── Default auto-evolution config ───────────────────────────────────────────
export const DEFAULT_AUTO_EVOLUTION = {
  autoApproveThreshold:  0.92,
  crossChannelLearning:  true,
  feedbackLoopEnabled:   true,
  kbHealthAutoFix:       true,
  staleEntryDays:        90,
  maxEntriesPerCategory: 500,
  deduplicateThreshold:  0.88,
  trainingLogRetention:  30,
};

let _autoEvolutionStore = { ...DEFAULT_AUTO_EVOLUTION };

// ── Accessors ───────────────────────────────────────────────────────────────

/** Read the full routing store. Returns a shallow clone to prevent accidental mutations. */
export function getRoutingStore() {
  return { ..._modelRoutingStore };
}

/** Overwrite the full routing store (used by POST /api/agent/model-routing). */
export function setRoutingStore(next) {
  _modelRoutingStore = next;
}

/** Read the auto-evolution config. Returns a shallow clone to prevent accidental mutations. */
export function getAutoEvolutionConfig() {
  return { ..._autoEvolutionStore };
}

/** Overwrite the auto-evolution config (used by POST /api/agent/auto-evolution). */
export function setAutoEvolutionConfig(next) {
  _autoEvolutionStore = next;
}

/**
 * Resolve provider + model for a task, walking the A→B→C fallback chain.
 * `available` is a Set of provider ids that are currently configured.
 *
 * Returns `{ provider, model }` for the first slot whose provider is available,
 * or `null` if no slot matches.
 *
 * @param {string} taskId - One of the MODEL_ROUTING_TASK_CATALOG ids.
 * @param {Set<string>} available - Set of available provider ids e.g. new Set(["claude","openai"])
 * @returns {{ provider: string, model: string } | null}
 */
export function resolveTaskModel(taskId, available) {
  const slots = _modelRoutingStore[taskId];
  if (!slots) return null;
  for (const slot of [slots.a, slots.b, slots.c]) {
    if (!slot) continue;
    const slashIdx = slot.indexOf("/");
    if (slashIdx < 1) continue;
    const provider = slot.slice(0, slashIdx);
    const model    = slot.slice(slashIdx + 1);
    if (available.has(provider)) return { provider, model };
  }
  return null;
}

/**
 * Build an ordered provider chain for a task using the A→B→C routing config.
 * Falls back to the supplied `defaultChain` if no routing entry exists.
 *
 * @param {string} taskId
 * @param {Set<string>} available - configured providers
 * @param {string[]} defaultChain - fallback chain (e.g. ["claude","openai"])
 * @returns {{ chain: string[], modelOverrides: Record<string,string> }}
 *   - `chain`  — ordered list of provider ids to try
 *   - `modelOverrides` — per-provider model override (if the routing slot specifies one)
 */
export function buildTaskProviderChain(taskId, available, defaultChain) {
  const slots = _modelRoutingStore[taskId];
  if (!slots) return { chain: defaultChain, modelOverrides: {} };

  const chain = [];
  const modelOverrides = {};
  for (const slot of [slots.a, slots.b, slots.c]) {
    if (!slot) continue;
    const slashIdx = slot.indexOf("/");
    if (slashIdx < 1) continue;
    const provider = slot.slice(0, slashIdx);
    const model    = slot.slice(slashIdx + 1);
    if (available.has(provider) && !chain.includes(provider)) {
      chain.push(provider);
      if (model) modelOverrides[provider] = model;
    }
  }

  // Append any available providers not covered by the routing config
  for (const p of defaultChain) {
    if (available.has(p) && !chain.includes(p)) chain.push(p);
  }

  return { chain, modelOverrides };
}
