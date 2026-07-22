/**
 * Panelin Co-Work — vision frame validation & provider adapters.
 * Spec: docs/team/SDD-PANELIN-COWORK.md
 *
 * Frames are in-memory only (request path). No GCS persistence by default.
 */

import { config } from "../config.js";

export const COWORK_ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export function coworkVisionEnabled() {
  const v = process.env.COWORK_VISION_ENABLED;
  if (v === "0" || v === "false") return false;
  return true;
}

export function coworkMaxAttachments() {
  const n = Number(process.env.COWORK_MAX_ATTACHMENTS || 2);
  return Number.isFinite(n) && n > 0 ? Math.min(4, Math.floor(n)) : 2;
}

export function coworkMaxImageBytes() {
  const n = Number(process.env.COWORK_MAX_IMAGE_BYTES || 1_572_864); // 1.5 MB
  return Number.isFinite(n) && n > 0 ? n : 1_572_864;
}

/**
 * Strip data-URL prefix if present; return raw base64.
 * @param {string} data
 */
export function normalizeBase64(data) {
  const s = String(data || "").trim();
  const m = s.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  return m ? m[1] : s.replace(/\s/g, "");
}

/**
 * Approximate decoded byte length of base64 without allocating Buffer of full image when possible.
 * @param {string} b64
 */
export function approxDecodedBytes(b64) {
  const s = String(b64 || "").replace(/=+$/, "");
  return Math.floor((s.length * 3) / 4);
}

/**
 * Validate and normalize attachment list from a chat message.
 * @param {unknown} raw
 * @returns {{ ok: true, attachments: object[], dropped: object[] } | { ok: false, error: string }}
 */
export function normalizeAttachments(raw) {
  if (!coworkVisionEnabled()) {
    return { ok: true, attachments: [], dropped: [{ reason: "vision_disabled" }] };
  }
  if (raw == null) return { ok: true, attachments: [], dropped: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "attachments_must_be_array" };

  const maxN = coworkMaxAttachments();
  const maxBytes = coworkMaxImageBytes();
  const attachments = [];
  const dropped = [];

  for (let i = 0; i < raw.length; i++) {
    if (attachments.length >= maxN) {
      dropped.push({ index: i, reason: "max_attachments" });
      continue;
    }
    const a = raw[i];
    if (!a || typeof a !== "object") {
      dropped.push({ index: i, reason: "invalid_shape" });
      continue;
    }
    const mime = String(a.mime || a.media_type || "image/jpeg").toLowerCase();
    if (!COWORK_ALLOWED_MIME.has(mime)) {
      dropped.push({ index: i, reason: "mime_not_allowed", mime });
      continue;
    }
    const data = normalizeBase64(a.data || a.base64 || "");
    if (!data || data.length < 32) {
      dropped.push({ index: i, reason: "empty_data" });
      continue;
    }
    const bytes = approxDecodedBytes(data);
    if (bytes > maxBytes) {
      dropped.push({ index: i, reason: "too_large", bytes, maxBytes });
      continue;
    }
    const source = ["live_assist", "oneshot", "paste", "upload"].includes(a.source)
      ? a.source
      : "oneshot";
    attachments.push({
      type: "image",
      mime,
      data,
      source,
      capturedAt: a.capturedAt || a.captured_at || null,
      bytes,
    });
  }

  return { ok: true, attachments, dropped };
}

/**
 * Claude Messages API content blocks for text + images.
 * @param {string} text
 * @param {Array<{mime:string,data:string}>} attachments
 */
export function toClaudeContent(text, attachments = []) {
  const blocks = [];
  for (const a of attachments) {
    blocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: a.mime,
        data: a.data,
      },
    });
  }
  const t = String(text || "").trim();
  if (t || blocks.length === 0) {
    blocks.push({ type: "text", text: t || "(captura de pantalla sin texto)" });
  }
  return blocks;
}

/**
 * Gemini parts: inlineData + text.
 * @param {string} text
 * @param {Array<{mime:string,data:string}>} attachments
 */
export function toGeminiParts(text, attachments = []) {
  const parts = [];
  for (const a of attachments) {
    parts.push({
      inlineData: {
        mimeType: a.mime,
        data: a.data,
      },
    });
  }
  const t = String(text || "").trim();
  parts.push({ text: t || "(captura de pantalla sin texto)" });
  return parts;
}

/**
 * OpenAI / Grok chat message content (array of parts).
 * @param {string} text
 * @param {Array<{mime:string,data:string}>} attachments
 */
export function toOpenAIContent(text, attachments = []) {
  const parts = [];
  const t = String(text || "").trim();
  parts.push({ type: "text", text: t || "(captura de pantalla sin texto)" });
  for (const a of attachments) {
    parts.push({
      type: "image_url",
      image_url: {
        url: `data:${a.mime};base64,${a.data}`,
      },
    });
  }
  return parts;
}

/**
 * Build provider-ready chat messages from our normalized message list.
 * Attachments are only kept on the **last user** message (cost control).
 *
 * @param {Array<{role:string, content:string, attachments?: unknown}>} rawMessages
 * @param {"claude"|"gemini"|"openai"|"grok"} provider
 * @returns {{ messages: object[], framesAccepted: number, framesDropped: object[], hasVision: boolean }}
 */
export function buildMultimodalMessages(rawMessages, provider) {
  const list = Array.isArray(rawMessages) ? rawMessages : [];
  let lastUserIdx = -1;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]?.role === "user") {
      lastUserIdx = i;
      break;
    }
  }

  let framesAccepted = 0;
  const framesDropped = [];
  let lastUserAttachments = [];

  if (lastUserIdx >= 0) {
    const norm = normalizeAttachments(list[lastUserIdx].attachments);
    if (norm.ok) {
      lastUserAttachments = norm.attachments;
      framesAccepted = norm.attachments.length;
      framesDropped.push(...norm.dropped);
    } else {
      framesDropped.push({ reason: norm.error });
    }
  }

  const hasVision = lastUserAttachments.length > 0;

  const messages = list
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m, idx) => {
      // Map index carefully: filter preserves relative order of user/assistant only
      return { role: m.role, content: String(m.content || ""), _raw: m };
    });

  // Recompute last user index on filtered list
  let filtLastUser = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      filtLastUser = i;
      break;
    }
  }

  const out = messages.map((m, i) => {
    const text = m.content;
    const atts = i === filtLastUser ? lastUserAttachments : [];
    if (provider === "claude") {
      if (atts.length === 0) return { role: m.role, content: text };
      if (m.role !== "user") return { role: m.role, content: text };
      return { role: "user", content: toClaudeContent(text, atts) };
    }
    if (provider === "gemini") {
      // Gemini uses separate contents mapping; return intermediate shape
      return {
        role: m.role,
        content: text,
        parts: m.role === "user" && atts.length
          ? toGeminiParts(text, atts)
          : [{ text }],
      };
    }
    // openai / grok
    if (atts.length === 0 || m.role !== "user") {
      return { role: m.role === "assistant" ? "assistant" : "user", content: text };
    }
    return {
      role: "user",
      content: toOpenAIContent(text, atts),
    };
  });

  return { messages: out, framesAccepted, framesDropped, hasVision };
}

/**
 * Optional operator context injection for dynamic prompt tail.
 * @param {object|null} operatorContext
 */
export function formatOperatorContextBlock(operatorContext) {
  if (!operatorContext || typeof operatorContext !== "object") return "";
  const lines = ["## CONTEXTO OPERADOR (Co-Work)"];
  if (operatorContext.surface) lines.push(`- Superficie: ${operatorContext.surface}`);
  if (operatorContext.selectedRow != null) lines.push(`- Fila Admin seleccionada: ${operatorContext.selectedRow}`);
  if (operatorContext.workbook) lines.push(`- Workbook preferido: ${operatorContext.workbook}`);
  if (operatorContext.liveAssist) lines.push("- Live assist: ON (la imagen adjunta es la captura más reciente de la pestaña compartida)");
  const d = operatorContext.defaults && typeof operatorContext.defaults === "object" ? operatorContext.defaults : null;
  if (d) {
    lines.push("- Defaults operador (usá salvo corrección explícita):");
    if (d.listaPrecios) lines.push(`  · Lista precios: ${d.listaPrecios}`);
    if (d.aguasTecho != null) {
      const tipo = Number(d.aguasTecho) === 2 ? "dos_aguas" : "una_agua";
      lines.push(`  · Aguas techo: ${d.aguasTecho} → tipoAguas "${tipo}" (usar en aplicar_estado_calc / setTecho)`);
    }
    if (d.crmFaltaInfoPrefix) lines.push(`  · Prefijo falta-info CRM: "${d.crmFaltaInfoPrefix}"`);
    lines.push("  · Lead WA sin fila Admin → `wa_lead_to_admin` (no inventes rowNum).");
  }
  lines.push("- La imagen es HINT visual; verificá números y filas con tools sheets_* / wolfboard_* antes de cotizar o escribir.");
  return lines.join("\n");
}

// config import kept for future feature flags wired via config.js
void config;
