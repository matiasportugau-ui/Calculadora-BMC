/**
 * quoteDualWrite.js — Wrapper de escritura dual Lead → CRM_Operativo + Admin Cotizaciones.
 *
 * Siempre intenta escribir en CRM_Operativo (crmAppend.js).
 * Solo intenta escribir en Admin Cotizaciones si WOLFB_ADMIN_COT_DUAL_WRITE=true.
 *
 * Estrategia de fallo:
 *   - CRM_Operativo falla → se loggea con lead_id + timestamp; se retorna error en result.crm.
 *     La cotización ya fue generada — no se rechaza el lead.
 *   - Admin Cotizaciones falla → se loggea como warning. No bloquea ni rechaza.
 *     Admin Cot es best-effort ("nice to have" para visibilidad del equipo).
 *   - Si ambas fallan: el lead_id + payload quedan disponibles en el resultado para
 *     reconciliación manual.
 *
 * Feature flag:
 *   WOLFB_ADMIN_COT_DUAL_WRITE=true   → activa escritura en Admin Cotizaciones
 *   WOLFB_ADMIN_COT_DUAL_WRITE=false  → solo escribe en CRM_Operativo (default)
 *
 * Uso:
 *   import { dualWriteQuote } from "./quoteDualWrite.js";
 *   const result = await dualWriteQuote({ cliente: ..., telefono: ..., ... });
 *   // result.crm     → { ok, row?, sheetId?, error? }
 *   // result.adminCot → { ok, row?, sheetId?, error?, skipped?: true }
 */

import { appendQuoteToCrm } from "./crmAppend.js";
import { appendQuoteToAdminCot } from "./adminCotAppend.js";
import { config } from "../config.js";

/**
 * @param {object} input - Campos del lead normalizado.
 *   Todos los campos de appendQuoteToCrm son válidos aquí. Adicionalmente:
 *   @param {string} [input.lead_id]          UUID del lead (col A CRM + col A Admin Cot)
 *   @param {string} [input.canal_origen]     Mapeado a origen Admin Cot (col F)
 *   @param {string} [input.cliente_nombre]   Alias de input.cliente para Admin Cot
 *   @param {string} [input.panel_familia]    Para resumen Admin Cot col I
 *   @param {number} [input.panel_espesor]    Para resumen Admin Cot col I
 *   @param {number} [input.area_m2]          Para resumen Admin Cot col I
 *   @param {number} [input.total_con_iva_usd] Para resumen Admin Cot col I
 *   @param {string} [input.timestamp]        ISO 8601 — usado en ambos targets
 *
 * @returns {Promise<{crm: object, adminCot: object}>}
 */
export async function dualWriteQuote(input = {}) {
  const leadId = String(input.lead_id || input.correlation_id || "").trim();
  const ts = input.timestamp || new Date().toISOString();

  // ── 1. CRM_Operativo — siempre ───────────────────────────────────────────
  let crmResult;
  try {
    crmResult = await appendQuoteToCrm({
      cliente: input.cliente_nombre || input.cliente,
      telefono: input.telefono,
      ubicacion: input.ubicacion,
      scenario: input.scenario,
      lista: input.lista,
      total: input.total_con_iva_usd ?? input.total,
      pdf_url: input.pdf_url,
      drive_url: input.drive_url,
      vendedor: input.vendedor,
      observaciones: input.observaciones,
      tipo_cliente: input.tipo_cliente,
      urgencia: input.urgencia,
      probabilidad_cierre: input.probabilidad_cierre,
      correlation_id: leadId || undefined,
    });
  } catch (err) {
    crmResult = { ok: false, error: `dualWrite CRM throw: ${err.message}` };
  }

  if (!crmResult.ok) {
    console.error(
      `[quoteDualWrite] ERROR CRM_Operativo lead_id=${leadId || "(sin id)"} ts=${ts} — ${crmResult.error}`
    );
  }

  // ── 2. Admin Cotizaciones — solo si feature flag activo ───────────────────
  if (!config.wolfbAdminCotDualWriteEnabled) {
    return {
      crm: crmResult,
      adminCot: { ok: true, skipped: true, reason: "WOLFB_ADMIN_COT_DUAL_WRITE desactivado" },
    };
  }

  let adminCotResult;
  try {
    adminCotResult = await appendQuoteToAdminCot({
      lead_id: leadId || undefined,
      timestamp: ts,
      cliente_nombre: input.cliente_nombre || input.cliente,
      telefono: input.telefono,
      ubicacion: input.ubicacion,
      canal_origen: input.canal_origen,
      scenario: input.scenario,
      panel_familia: input.panel_familia,
      panel_espesor: input.panel_espesor,
      area_m2: input.area_m2,
      lista: input.lista,
      total_con_iva_usd: input.total_con_iva_usd ?? input.total,
      notas: input.notas || input.observaciones,
      pdf_url: input.pdf_url,
      drive_url: input.drive_url,
    });
  } catch (err) {
    adminCotResult = { ok: false, error: `dualWrite AdminCot throw: ${err.message}` };
  }

  if (!adminCotResult.ok) {
    console.warn(
      `[quoteDualWrite] WARN Admin Cotizaciones (best-effort) lead_id=${leadId || "(sin id)"} ts=${ts} — ${adminCotResult.error}`
    );
  }

  return { crm: crmResult, adminCot: adminCotResult };
}
