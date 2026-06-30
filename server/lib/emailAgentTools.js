/**
 * emailAgentTools.js — tool definitions + executor for the in-app BMC Email Agent.
 *
 * Self-contained (does NOT touch the large agentTools.js). Backed by chatwootClient
 * + emailLeadIngest. Customer-facing / irreversible tools (send, assign) require
 * `user_confirmed:true` in their input — same gate pattern as guardar_en_crm /
 * enviar_whatsapp_link. Draft / report / triage tools are free.
 *
 * Anthropic tool-use schema (input_schema). Used by server/routes/emailAgentChat.js.
 */

import {
  isChatwootConfigured,
  listConversations,
  getConversation,
  getMessages,
  postPrivateNote,
  sendReply,
  setLabels,
  assignConversation,
  setStatus,
  listCannedResponses,
  conversationMeta,
} from "./chatwootClient.js";
import { extractEmailLead } from "./emailLeadIngest.js";

export const EMAIL_AGENT_TOOLS = [
  {
    name: "email_listar_conversaciones",
    description:
      "Lista conversaciones del buzón compartido de BMC. Filtros: status (open|pending|resolved|all), assignee (me|unassigned|assigned|all). Usar para reportar/triage ('emails sin responder', 'qué hay pendiente').",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["open", "pending", "resolved", "all"], description: "Estado. Default open" },
        assignee: { type: "string", enum: ["me", "unassigned", "assigned", "all"], description: "Asignación. Default all" },
      },
    },
  },
  {
    name: "email_leer_conversacion",
    description: "Lee el hilo completo (mensajes) de una conversación por id. Usar antes de redactar una respuesta.",
    input_schema: {
      type: "object",
      properties: { conversationId: { type: "number", description: "ID de conversación Chatwoot" } },
      required: ["conversationId"],
    },
  },
  {
    name: "email_redactar_respuesta",
    description:
      "Redacta (NO envía) una respuesta de ventas BMC para una conversación, en español, tono BMC. Devuelve el borrador para que el operador lo revise.",
    input_schema: {
      type: "object",
      properties: {
        conversationId: { type: "number" },
        instruccion: { type: "string", description: "Qué debe decir la respuesta / contexto del operador" },
      },
      required: ["conversationId"],
    },
  },
  {
    name: "email_guardar_borrador",
    description: "Guarda un borrador como NOTA PRIVADA en la conversación (no se envía al cliente; lo ven los operadores).",
    input_schema: {
      type: "object",
      properties: {
        conversationId: { type: "number" },
        borrador: { type: "string", description: "Texto del borrador" },
      },
      required: ["conversationId", "borrador"],
    },
  },
  {
    name: "email_enviar_respuesta",
    description:
      "ENVÍA una respuesta al cliente (acción irreversible, cara al cliente). Requiere user_confirmed:true. Sin confirmación, NO envía.",
    input_schema: {
      type: "object",
      properties: {
        conversationId: { type: "number" },
        contenido: { type: "string", description: "Texto final aprobado a enviar" },
        user_confirmed: { type: "boolean", description: "true solo si el operador confirmó el envío" },
      },
      required: ["conversationId", "contenido"],
    },
  },
  {
    name: "email_aplicar_etiquetas",
    description: "Organiza: setea el conjunto de etiquetas de la conversación (ej: lead, urgente, cotizado, cerrado).",
    input_schema: {
      type: "object",
      properties: {
        conversationId: { type: "number" },
        etiquetas: { type: "array", items: { type: "string" } },
      },
      required: ["conversationId", "etiquetas"],
    },
  },
  {
    name: "email_asignar",
    description: "Asigna la conversación a un operador (Chatwoot agent id). Requiere user_confirmed:true.",
    input_schema: {
      type: "object",
      properties: {
        conversationId: { type: "number" },
        assigneeId: { type: "number" },
        user_confirmed: { type: "boolean" },
      },
      required: ["conversationId", "assigneeId"],
    },
  },
  {
    name: "email_cambiar_estado",
    description: "Cambia el estado de la conversación: open | pending | resolved.",
    input_schema: {
      type: "object",
      properties: {
        conversationId: { type: "number" },
        estado: { type: "string", enum: ["open", "pending", "resolved"] },
      },
      required: ["conversationId", "estado"],
    },
  },
  {
    name: "email_extraer_lead",
    description: "Extrae datos estructurados de lead BMC de una conversación (cliente, tel, categoría, urgencia, etc.).",
    input_schema: {
      type: "object",
      properties: { conversationId: { type: "number" } },
      required: ["conversationId"],
    },
  },
  {
    name: "email_reusar_plantilla",
    description: "Lista las plantillas / canned responses guardadas para reusar en una respuesta.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "email_reporte",
    description: "Reporte del buzón: conteos por estado (open/pending/resolved) para priorizar el día.",
    input_schema: { type: "object", properties: {} },
  },
];

/** Extract a flat {subject, body, from} from a Chatwoot conversation payload. */
function firstIncoming(convPayload) {
  const msgs = convPayload?.payload || convPayload?.messages || [];
  const arr = Array.isArray(msgs) ? msgs : [];
  const inc = arr.find((m) => m.message_type === 0 || m.message_type === "incoming") || arr[0] || {};
  const meta = convPayload?.meta || {};
  return {
    cuerpo: inc.content || "",
    remitente: meta?.sender?.email || convPayload?.contact?.email || "",
    asunto: convPayload?.additional_attributes?.mail_subject || "",
  };
}

/**
 * Execute one email tool. Returns a JSON-serializable result object.
 * @param {string} name
 * @param {object} input
 * @param {object} ctx - { drafter: async ({conversationId,instruccion,thread}) => string }
 */
export async function executeEmailTool(name, input = {}, ctx = {}) {
  if (!isChatwootConfigured()) {
    return { ok: false, error: "chatwoot_not_configured" };
  }
  try {
    switch (name) {
      case "email_listar_conversaciones": {
        const data = await listConversations({
          status: input.status || "open",
          assigneeType: input.assignee || "all",
        });
        const items = data?.data?.payload || data?.payload || [];
        const slim = (Array.isArray(items) ? items : []).slice(0, 25).map((c) => ({
          id: c.id,
          status: c.status,
          subject: c.additional_attributes?.mail_subject || c.meta?.sender?.name || "(sin asunto)",
          contacto: c.meta?.sender?.email || c.meta?.sender?.name || "",
          ultimo: c.last_non_activity_message?.content?.slice(0, 120) || "",
          etiquetas: c.labels || [],
        }));
        return { ok: true, count: slim.length, conversaciones: slim };
      }
      case "email_leer_conversacion": {
        const conv = await getConversation(input.conversationId);
        const msgs = await getMessages(input.conversationId);
        return { ok: true, conversation: conv, messages: msgs?.payload || msgs || [] };
      }
      case "email_redactar_respuesta": {
        const conv = await getConversation(input.conversationId);
        const thread = firstIncoming(conv);
        const draft = ctx.drafter
          ? await ctx.drafter({ conversationId: input.conversationId, instruccion: input.instruccion, thread })
          : "(no drafter)";
        return { ok: true, borrador: draft, nota: "Borrador NO enviado. Revisá y confirmá para enviar." };
      }
      case "email_guardar_borrador": {
        await postPrivateNote(input.conversationId, `📝 Borrador:\n${input.borrador}`);
        return { ok: true, guardado: true };
      }
      case "email_enviar_respuesta": {
        if (input.user_confirmed !== true) {
          return { ok: false, requiere_confirmacion: true, error: "Falta confirmación del operador para enviar." };
        }
        await sendReply(input.conversationId, input.contenido);
        return { ok: true, enviado: true };
      }
      case "email_aplicar_etiquetas": {
        await setLabels(input.conversationId, input.etiquetas || []);
        return { ok: true, etiquetas: input.etiquetas };
      }
      case "email_asignar": {
        if (input.user_confirmed !== true) {
          return { ok: false, requiere_confirmacion: true, error: "Falta confirmación para asignar." };
        }
        await assignConversation(input.conversationId, input.assigneeId);
        return { ok: true, asignado: input.assigneeId };
      }
      case "email_cambiar_estado": {
        await setStatus(input.conversationId, input.estado);
        return { ok: true, estado: input.estado };
      }
      case "email_extraer_lead": {
        const conv = await getConversation(input.conversationId);
        const thread = firstIncoming(conv);
        const res = await extractEmailLead(thread);
        return res;
      }
      case "email_reusar_plantilla": {
        const data = await listCannedResponses();
        const arr = Array.isArray(data) ? data : data?.payload || [];
        return { ok: true, plantillas: arr.map((t) => ({ short_code: t.short_code, content: t.content })) };
      }
      case "email_reporte": {
        const meta = await conversationMeta({}).catch(() => null);
        const counts = meta?.meta || meta || {};
        return { ok: true, reporte: counts };
      }
      default:
        return { ok: false, error: `unknown_tool:${name}` };
    }
  } catch (e) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
}

export default { EMAIL_AGENT_TOOLS, executeEmailTool };
