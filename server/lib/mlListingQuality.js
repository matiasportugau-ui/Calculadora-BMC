// Listing Quality Agent — audit MLU listings for BMC (MLOMS P0).
// Proposes patches only; never writes to MercadoLibre (human gate in UI).

import pino from "pino";
import { callAgentOnce } from "./agentCore.js";

const log = pino({ level: process.env.LOG_LEVEL ?? "info" });

export const LISTING_QUALITY_SYSTEM_PROMPT = `Eres auditor de calidad de publicaciones MercadoLibre para BMC Uruguay (paneles aislantes MLU).

Responde ÚNICAMENTE con JSON válido (sin markdown). Estructura exacta:

{
  "scores": {
    "title": 0-10,
    "images": 0-10,
    "attributes": 0-10,
    "description": 0-10,
    "overall": 0-10
  },
  "issues": [
    {
      "area": "title|images|attributes|description|moderation|pricing",
      "severity": "high|medium|low",
      "message": "qué está mal",
      "fix": "cómo corregir"
    }
  ],
  "suggested_patches": {
    "title": "título sugerido o null",
    "description": "texto descripción sugerido o null",
    "attributes": [{ "id": "ATTR_ID", "value_name": "valor" }],
    "image_notes": "notas sobre fotos (no URLs inventadas)"
  },
  "moderation_penalty_note": "texto si aplica penalización, else null",
  "summary": "2-3 oraciones ejecutivas"
}

Rúbrica BMC:
- Título: ≤60 chars, sin precio/promo, producto + espesor/uso claro.
- Fotos: ≥4 reales de producto; no renders/spec sheets como únicas imágenes.
- Atributos: BRAND, espesor, modelo, condición completos cuando la categoría lo exige.
- Descripción: técnica (R-value, núcleo, aplicación techo/pared/cámara).
- Si tags incluye moderation_penalty: severity high; no sugerir activar hasta corregir.
- Precio: coherente con producto; no inventar números — solo señalar si parece incoherente.

Reglas: mínimo 2 issues si hay problemas; suggested_patches solo campos mejorables; no inventar URLs de fotos.`;

/** @param {string} text */
export function parseListingQualityJson(text) {
  const trimmed = String(text || "").trim();
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlock ? codeBlock[1].trim() : trimmed;
  const objMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objMatch) throw new Error("No JSON object found");
  return JSON.parse(objMatch[0]);
}

function normalizeAudit(raw, item) {
  const penalty = !!item?.tags?.includes?.("moderation_penalty");
  const scores = raw.scores && typeof raw.scores === "object" ? raw.scores : {};
  const issues = Array.isArray(raw.issues) ? raw.issues : [];
  const patches = raw.suggested_patches && typeof raw.suggested_patches === "object"
    ? raw.suggested_patches
    : {};

  if (penalty && !issues.some((i) => i.area === "moderation")) {
    issues.unshift({
      area: "moderation",
      severity: "high",
      message: "Publicación con penalización de moderación",
      fix: "Corregir calidad (título, fotos, atributos, descripción) antes de reactivar",
    });
  }

  return {
    scores: {
      title: Number(scores.title) || 0,
      images: Number(scores.images) || 0,
      attributes: Number(scores.attributes) || 0,
      description: Number(scores.description) || 0,
      overall: Number(scores.overall) || 0,
    },
    issues,
    suggested_patches: {
      title: patches.title ?? null,
      description: patches.description ?? null,
      attributes: Array.isArray(patches.attributes) ? patches.attributes : [],
      image_notes: patches.image_notes ?? null,
    },
    moderation_penalty_note: raw.moderation_penalty_note ?? (penalty ? "Penalizada por moderación" : null),
    summary: typeof raw.summary === "string" ? raw.summary : "",
  };
}

function buildUserContent(item, descriptionText) {
  const attrs = (item.attributes || [])
    .slice(0, 40)
    .map((a) => `${a.id}: ${a.value_name ?? a.value_id ?? "—"}`)
    .join("\n");

  return `Auditar publicación MLU:

id: ${item.id}
title: ${item.title}
status: ${item.status}
price: ${item.currency_id} ${item.price}
health: ${item.health ?? "—"}
sold_quantity: ${item.sold_quantity ?? 0}
pictures_count: ${item.pictures?.length ?? 0}
tags: ${(item.tags || []).join(", ") || "—"}
category_id: ${item.category_id}
listing_type_id: ${item.listing_type_id}
condition: ${item.condition}

attributes:
${attrs || "(none)"}

description_plain_text:
${descriptionText || "(sin descripción)"}`;
}

/**
 * @param {{ item: object, descriptionText?: string, provider?: string }} params
 */
export async function auditListingQuality({ item, descriptionText = "", provider }) {
  if (!item?.id) throw new Error("Missing item");

  const userContent = buildUserContent(item, descriptionText);

  const result = await callAgentOnce(
    [{ role: "user", content: userContent }],
    {
      channel: "ml",
      bareSystemPrompt: LISTING_QUALITY_SYSTEM_PROMPT,
      provider,
      override: { maxTokens: 4096 },
    },
  );

  let parsed;
  try {
    parsed = parseListingQualityJson(result.text);
  } catch (firstErr) {
    log.warn({ err: firstErr.message, preview: result.text.slice(0, 400) }, "listing quality JSON parse failed");
    parsed = {
      scores: { title: 0, images: 0, attributes: 0, description: 0, overall: 0 },
      issues: [{ area: "description", severity: "medium", message: "No se pudo parsear auditoría estructurada", fix: "Reintentar auditoría" }],
      suggested_patches: {},
      moderation_penalty_note: null,
      summary: result.text.slice(0, 500),
    };
  }

  const audit = normalizeAudit(parsed, item);

  return {
    audit,
    provider: result.provider,
    model: result.model || null,
    latencyMs: result.latencyMs || null,
    item_id: item.id,
    generated_at: new Date().toISOString(),
  };
}
