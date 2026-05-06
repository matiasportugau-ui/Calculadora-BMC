/**
 * WA Cockpit — schema canónico (zod) para flags + runtime config.
 *
 * Single source of truth: tipos, validación, defaults y docs derivados de aquí.
 *
 * Tres tipos separados (best practice 2026 — Sachith / designrevision):
 *  - SECRETS  → sólo en .env (WA_JWT_SECRET, ANTHROPIC_API_KEY, …) — no aquí.
 *  - FLAGS    → wa_flags (PG): switches rápidos con kill-switch UI.
 *  - SETTINGS → wa_settings (PG): config estable (intervalos, modelos, prompts).
 *
 * Precedencia en runtime:
 *   wa_settings (scope=operator)  →  wa_settings (scope=tenant)
 *   →  process.env (fallback bootstrap)  →  default del schema.
 */

import { z } from "zod";

// ─── Providers AI permitidos ─────────────────────────────────────────────
// Mantener alineado con server/lib/agentCore.js → PROVIDER_CHAIN.
export const AiProvider = z.enum([
  "anthropic",
  "openai",
  "gemini",
  "grok",
]);

// Helper: tarea AI (provider+model+temperature+maxTokens).
// Devolvemos un schema "prefaulted" para que objetos vacíos triggereen los
// defaults de cada leaf en zod v4 (donde .default({}) no propaga recursivo).
const aiTaskShape = (defaults) =>
  z.object({
    provider: AiProvider.default(defaults.provider),
    model: z.string().min(1).max(128).default(defaults.model),
    temperature: z.number().min(0).max(2).default(defaults.temperature),
    maxTokens: z.number().int().min(64).max(8000).default(defaults.maxTokens),
  }).prefault({});

// ─── FLAGS (≤ 8) ─────────────────────────────────────────────────────────
// Cada flag: enabled bool + rollout 0–100 + owner + expiración + descripción.
// Best practice: nunca dejar un flag activo > 30 días post-100% rollout.
export const FlagsSchema = z.object({
  "enricher.enabled": z.boolean().default(false).describe(
    "Worker que clasifica intent y genera sugerencias AI sobre mensajes inbound.",
  ),
  "autoQuote.enabled": z.boolean().default(false).describe(
    "Auto-cotizar cuando el enricher detecta cotización con m² + (espesor o familia).",
  ),
  "webhooks.enabled": z.boolean().default(false).describe(
    "Disparar webhooks salientes (HMAC firmados) en eventos del módulo.",
  ),
  "slaTracking.enabled": z.boolean().default(false).describe(
    "Worker que detecta breaches de SLA (unreplied/unassigned) respetando business hours.",
  ),
  "routingRules.enabled": z.boolean().default(false).describe(
    "Aplicar reglas de wa_rules sobre /ingest (assign automático, label, alert).",
  ),
  "cloudApiOutbound.enabled": z.boolean().default(false).describe(
    "Permitir envíos vía WhatsApp Cloud API (requiere consent_at en wa_conversations).",
  ),
  "extensionLiveSync.enabled": z.boolean().default(true).describe(
    "Permitir live sync de la extensión (live: true en /ingest).",
  ),
  "auditLogVisible.enabled": z.boolean().default(true).describe(
    "Mostrar la pestaña Audit Log en la UI a Owner/Admin.",
  ),
});

export const FLAG_KEYS = Object.freeze(Object.keys(FlagsSchema.shape));

// ─── SETTINGS (~22 keys agrupadas) ───────────────────────────────────────
//
// Nota zod v4: usamos .prefault({}) en cada nested object para que defaults
// de leaves se apliquen recursivamente cuando el input es {} o undefined.

export const SettingsSchema = z.object({
  // Enricher
  enricher: z.object({
    intervalMs: z.number().int().min(1000).max(300000).default(8000),
    batchSize: z.number().int().min(1).max(50).default(5),
    maxHistoryMsgs: z.number().int().min(1).max(50).default(12),
  }).prefault({}),

  // AI per-task (4 tareas × 4 props)
  ai: z.object({
    classify: aiTaskShape({
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      temperature: 0.2,
      maxTokens: 200,
    }),
    suggestions: aiTaskShape({
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      temperature: 0.5,
      maxTokens: 1200,
    }),
    quoteParse: aiTaskShape({
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      temperature: 0.1,
      maxTokens: 300,
    }),
    followupText: aiTaskShape({
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      temperature: 0.7,
      maxTokens: 200,
    }),
  }).prefault({}),

  // Auto-cotización
  quote: z.object({
    minM2: z.number().min(1).max(10000).default(5),
    defaultWallHeightM: z.number().min(1).max(20).default(3),
    requireFamilyOrThickness: z.boolean().default(true),
  }).prefault({}),

  // SLA y business hours (Missive-style)
  sla: z.object({
    unrepliedAlertHours: z.number().min(0.1).max(168).default(2),
    unassignedAlertHours: z.number().min(0.1).max(168).default(0.5),
    businessHours: z.object({
      tz: z.string().default("America/Montevideo"),
      // Cada día: [horaInicio, horaFin] (24h) o null = cerrado.
      mon: z.tuple([z.number().min(0).max(24), z.number().min(0).max(24)]).nullable().default([9, 18]),
      tue: z.tuple([z.number().min(0).max(24), z.number().min(0).max(24)]).nullable().default([9, 18]),
      wed: z.tuple([z.number().min(0).max(24), z.number().min(0).max(24)]).nullable().default([9, 18]),
      thu: z.tuple([z.number().min(0).max(24), z.number().min(0).max(24)]).nullable().default([9, 18]),
      fri: z.tuple([z.number().min(0).max(24), z.number().min(0).max(24)]).nullable().default([9, 18]),
      sat: z.tuple([z.number().min(0).max(24), z.number().min(0).max(24)]).nullable().default(null),
      sun: z.tuple([z.number().min(0).max(24), z.number().min(0).max(24)]).nullable().default(null),
    }).prefault({}),
    breachAction: z.enum(["notify", "reassign", "webhook"]).default("notify"),
    workerIntervalMs: z.number().int().min(1000).max(600000).default(60000),
  }).prefault({}),

  // Outbound
  outbound: z.object({
    ratePerMinPerChat: z.number().int().min(1).max(100).default(6),
    ratePerMinPerOperator: z.number().int().min(1).max(500).default(30),
    dailyCapPerChat: z.number().int().min(1).max(1000).default(50),
  }).prefault({}),

  // Datos / TTL
  data: z.object({
    ttlDays: z.number().int().min(7).max(3650).default(180),
    purgeEnabled: z.boolean().default(true),
  }).prefault({}),

  // Consent (WhatsApp Cloud API requiere opt-in)
  consent: z.object({
    requiredForCloudApi: z.boolean().default(true),
    defaultSource: z.string().min(1).max(64).default("manual"),
  }).prefault({}),

  // Extensión (consumida por GET /api/wa/config/extension)
  extension: z.object({
    heartbeatSeconds: z.number().int().min(15).max(900).default(60),
    batchSizeLive: z.number().int().min(1).max(200).default(50),
    batchSizeHistorical: z.number().int().min(1).max(500).default(200),
    retryDelaysMs: z.array(z.number().int().min(100).max(60000)).default([500, 1500, 4000]),
    liveTickleDebounceMs: z.number().int().min(100).max(30000).default(2500),
  }).prefault({}),

  // Follow-ups (reglas declarativas: kind + horas + template)
  followups: z.object({
    defaultHours: z.number().min(1).max(720).default(24),
    workerIntervalMs: z.number().int().min(1000).max(600000).default(60000),
    rules: z.array(
      z.object({
        kind: z.string().min(1).max(64),
        hours: z.number().min(0.1).max(720),
        template: z.string().max(2000),
        enabled: z.boolean().default(true),
      })
    ).default([
      {
        kind: "remind_24h",
        hours: 24,
        template: "Hola, ¿pudiste revisar la cotización?",
        enabled: true,
      },
    ]),
  }).prefault({}),

  // Prompts (overrides opcionales — vacío = usar default hardcoded en chatPrompts.js)
  prompts: z.object({
    classifyOverride: z.string().max(8000).default(""),
    suggestionsOverride: z.string().max(8000).default(""),
    cockpitInstruction: z.string().max(8000).default(""),
    followupTemplate: z.string().max(2000).default(""),
  }).prefault({}),
}).prefault({});

// Helper: tras .prefault({}) la .shape vive en _def.innerType.shape (zod v4).
function shapeOf(schema) {
  return schema?.shape || schema?._def?.innerType?.shape || {};
}

export const SettingsKeys = Object.freeze(Object.keys(shapeOf(SettingsSchema)));

// ─── Helpers para el loader ─────────────────────────────────────────────

/**
 * Aplica defaults completos (recursivo) y devuelve config válido aún si DB
 * tiene drift / valores inválidos: nunca crashea, sólo loggea warnings.
 *
 * @param {Record<string, any>} dbValuesByKey
 * @param {Record<string, any>} envOverrides
 * @returns {{ data: object, drift: string[] }}
 */
export function buildSettings(dbValuesByKey = {}, envOverrides = {}) {
  const drift = [];
  // Construir objeto siguiendo la estructura del schema; cada namespace puede
  // venir desde DB con key "enricher", "ai.classify", etc.
  const merged = mergeNamespaces(dbValuesByKey, envOverrides);
  const parsed = SettingsSchema.safeParse(merged);
  if (parsed.success) return { data: parsed.data, drift };
  // Drift: usar defaults completos y reportar.
  for (const issue of parsed.error.issues) {
    drift.push(`${issue.path.join(".")}: ${issue.message}`);
  }
  const fallback = SettingsSchema.parse({});
  return { data: fallback, drift };
}

function mergeNamespaces(dbValues, envValues) {
  // dbValues puede tener keys "ai.classify.model" planas o "ai" con objeto.
  // Normalizamos a estructura jerárquica.
  const out = {};
  for (const [k, v] of Object.entries(dbValues)) {
    setPath(out, k, v);
  }
  // env overrides ya vienen normalizados por waConfig.js
  for (const [k, v] of Object.entries(envValues)) {
    if (v !== undefined && v !== null && v !== "") setPath(out, k, v);
  }
  return out;
}

function setPath(obj, dottedKey, value) {
  const parts = dottedKey.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

/**
 * Aplica defaults a flags y normaliza resultado.
 * @param {Record<string, boolean>} dbFlagValues
 * @returns {{ data: object, drift: string[] }}
 */
export function buildFlags(dbFlagValues = {}) {
  const drift = [];
  const parsed = FlagsSchema.safeParse(dbFlagValues);
  if (parsed.success) return { data: parsed.data, drift };
  for (const issue of parsed.error.issues) {
    drift.push(`flag ${issue.path.join(".")}: ${issue.message}`);
  }
  return { data: FlagsSchema.parse({}), drift };
}

/**
 * Devuelve metadata de cada setting/flag para alimentar la UI:
 * { key, type, description, default, min, max }
 */
export function describeSchema() {
  const flags = [];
  for (const [key, def] of Object.entries(shapeOf(FlagsSchema))) {
    flags.push({
      key,
      kind: "flag",
      type: "boolean",
      description: def?._def?.description || def?.description || "",
      default: safeDefault(def) ?? false,
    });
  }

  // Settings: walk recursivo
  const settings = [];
  walk(SettingsSchema, [], settings);
  return { flags, settings };
}

function unwrap(schema) {
  // ZodDefault/ZodPrefault/ZodOptional/ZodNullable wrappers en zod v4
  // exponen el schema original en _def.innerType. Iteramos hasta llegar
  // a un schema con .shape (object) o sin innerType (leaf).
  let s = schema;
  let guard = 0;
  while (s && s._def && s._def.innerType && guard++ < 10) {
    s = s._def.innerType;
  }
  return s;
}

function walk(schema, path, out) {
  const inner = unwrap(schema);
  const shape = inner?.shape;
  if (!shape || typeof shape !== "object") return;
  for (const [key, child] of Object.entries(shape)) {
    const subPath = [...path, key];
    const childUnwrapped = unwrap(child);
    const childShape = childUnwrapped?.shape;
    if (childShape && typeof childShape === "object") {
      walk(child, subPath, out);
    } else {
      out.push({
        key: subPath.join("."),
        kind: "setting",
        type: typeName(childUnwrapped),
        description: child._def?.description || child.description || "",
        default: safeDefault(child),
      });
    }
  }
}

function typeName(schema) {
  if (!schema) return "unknown";
  const t = schema._def?.type || schema._def?.typeName || schema.constructor?.name || "";
  return String(t).replace(/^Zod/, "").toLowerCase();
}

function safeDefault(schema) {
  try {
    // Walk wrappers buscando defaultValue.
    let s = schema;
    let guard = 0;
    while (s && guard++ < 10) {
      const d = s._def?.defaultValue;
      if (d !== undefined) {
        return typeof d === "function" ? d() : d;
      }
      const next = s._def?.innerType;
      if (!next || next === s) break;
      s = next;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
