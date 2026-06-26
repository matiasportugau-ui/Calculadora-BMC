/**
 * emailLeadIngest.js — shared AI structured-extraction for inbound sales emails.
 *
 * Single source of truth for "email → structured BMC lead". Mirrors the proven
 * logic in server/routes/bmcDashboard.js (POST /api/crm/ingest-email): the same
 * 12-field Zod schema and the same Spanish extraction system prompt, run through
 * the AI Gateway (generateObjectViaGateway) with a JSON-parse fallback.
 *
 * Reused by:
 *   - server/routes/chatwoot.js        (webhook: Chatwoot incoming email → lead)
 *   - server/routes/emailAgentChat.js  (email_extraer_lead tool)
 *
 * This module ONLY produces the structured lead object + a normalized summary.
 * Writing the lead into the CRM_Operativo sheet stays in bmcDashboard's writer
 * (so there is exactly one Sheets-writer code path); callers that want a CRM row
 * should POST the result to /api/crm/ingest-email or call the existing writer.
 *
 * NOTE: keep the schema/prompt in lockstep with bmcDashboard.getEmailExtractionSchema().
 */

import { isAiGatewayEnabled, generateObjectViaGateway } from "./aiGatewayClient.js";

/** Zod schema — identical shape to bmcDashboard.getEmailExtractionSchema(). */
export async function getEmailLeadSchema() {
  const { z } = await import("zod");
  return z.object({
    cliente: z.string().default(""),
    telefono: z.string().default(""),
    ubicacion: z.string().default(""),
    email_remitente: z.string().default(""),
    resumen_pedido: z.string().default(""),
    categoria: z.string().default(""),
    urgencia: z.string().default(""),
    tipo_cliente: z.string().default(""),
    cotizacion_formal: z.string().default(""),
    validar_stock: z.string().default(""),
    probabilidad_cierre: z.string().default(""),
    observaciones: z.string().default(""),
  });
}

export const EMAIL_LEAD_SYSTEM_PROMPT = `Sos un extractor de datos de emails de consulta/cotización para BMC Uruguay (paneles de aislamiento térmico). Analizás el email y extraés datos estructurados en JSON.

Reglas:
- Extraé el nombre del cliente del email (firma, saludo, o campo remitente)
- Extraé teléfono solo si aparece explícito en el texto o firma
- Categoría: Accesorios, Paneles techo, Paneles pared, Proyecto completo, Ferretería, Repuestos, Servicio/instalación, Otro
- Urgencia: Hoy, 24h, Esta semana, Este mes, Sin urgencia
- tipo_cliente: Particular, Empresa, Arquitecto, Constructor, Distribuidor, Instalador, Cliente existente, Sin clasificar
- probabilidad_cierre: Alta (quiere comprar ya), Media (interesado, comparando), Baja (solo consulta)
- validar_stock: Si (entrega inmediata/urgente), No (sin urgencia de entrega)
- cotizacion_formal: Si (pide presupuesto/cotización explícitamente), No
- El resumen_pedido debe ser conciso: qué necesita, medidas si las dio, uso
- ubicacion: extraé si mencionan ciudad, departamento, zona, dirección de obra
- observaciones: contexto relevante que no entra en otros campos

Respondé SOLO JSON válido, sin markdown ni explicación.`;

/**
 * Extract a structured BMC lead from a raw email.
 * @param {{ remitente?:string, asunto?:string, cuerpo:string }} email
 * @returns {Promise<{ ok:boolean, lead?:object, provider?:string, error?:string }>}
 */
export async function extractEmailLead({ remitente, asunto, cuerpo } = {}) {
  if (!cuerpo || !String(cuerpo).trim()) {
    return { ok: false, error: "missing_cuerpo" };
  }
  if (!isAiGatewayEnabled()) {
    return { ok: false, error: "ai_gateway_disabled" };
  }
  const userMsg = `Extraé los datos de este email de consulta:\n\nDe: ${remitente || "desconocido"}\nAsunto: ${asunto || "sin asunto"}\n\n${cuerpo}`;
  try {
    const schema = await getEmailLeadSchema();
    const result = await generateObjectViaGateway({
      system: EMAIL_LEAD_SYSTEM_PROMPT,
      prompt: userMsg,
      schema,
      maxTokens: 500,
    });
    if (result?.object) {
      const lead = { ...result.object };
      if (!lead.email_remitente && remitente) lead.email_remitente = remitente;
      return { ok: true, lead, provider: result.provider || null };
    }
    return { ok: false, error: "empty_object" };
  } catch (e) {
    return { ok: false, error: String(e?.message || e).slice(0, 160) };
  }
}

export default { getEmailLeadSchema, extractEmailLead, EMAIL_LEAD_SYSTEM_PROMPT };
