/**
 * Resumen operativo para el asistente Panelin (POST /api/agent/chat).
 * Usa las mismas credenciales Sheets que el dashboard (BMC_SHEET_ID + GOOGLE_APPLICATION_CREDENTIALS).
 */

import path from "node:path";
import fs from "node:fs";

const PENDING_CRM_ESTADOS = new Set([
  "pendiente",
  "abierto",
  "en curso",
  "encurso",
  "borrador",
  "draft",
  "nuevo",
  "seguimiento",
  "contactar",
  "esperando",
]);

const CLOSED_CRM_ESTADOS = new Set([
  "cerrado",
  "ganado",
  "perdido",
  "entregado",
  "facturado",
  "cancelado",
  "archivado",
]);

/** @param {unknown} s */
function normEstado(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * @param {Record<string, unknown>} row — fila ya mapeada (mapCrmRowToBmc)
 */
export function crmRowLooksPending(row) {
  const e = normEstado(row.ESTADO);
  if (!e) return true;
  if (CLOSED_CRM_ESTADOS.has(e)) return false;
  if (PENDING_CRM_ESTADOS.has(e)) return true;
  return !e.includes("cerrad") && !e.includes("entregad") && !e.includes("facturad");
}

/**
 * @param {Record<string, unknown>} row
 */
export function masterRowLooksOpen(row) {
  const e = normEstado(row.ESTADO);
  if (!e) return true;
  if (e === "confirmado" || e === "entregado" || e === "cerrado" || e === "cancelado") return false;
  return true;
}

/**
 * Heurística: el usuario pide vista operativa / CRM / ML, no solo cálculo.
 * @param {string} text
 */
export function userMessageWantsOpsSnapshot(text) {
  const t = normEstado(text).replace(/_/g, " ");
  if (t.length < 6) return false;
  const keys = [
    "cotizacion",
    "cotizaciones",
    "crm",
    "pendiente",
    "pendientes",
    "revisar",
    "seguimiento",
    "master",
    "planilla",
    "sheet",
    "hoja",
    "operativo",
    "interno",
    "equipo",
    "logistica",
    "entrega",
    "pago",
    "pagos",
    "mercado libre",
    "mercadolibre",
    "ml ",
    " ml",
    "pregunta",
    "preguntas",
    "shopify",
    "dashboard",
    "finanzas",
  ];
  return keys.some((k) => t.includes(k));
}

/**
 * @param {Record<string, unknown>} r
 * @param {number} maxLen
 */
function clip(r, maxLen) {
  const notas = String(r.NOTAS ?? r.COMENTARIOS_ENTREGA ?? "").replace(/\s+/g, " ").trim();
  if (notas.length <= maxLen) return notas;
  return `${notas.slice(0, maxLen)}…`;
}

/**
 * @param {Record<string, unknown>} r
 */
export function formatCrmRowSummary(r) {
  const id = String(r.COTIZACION_ID || r.ID || "").trim() || "—";
  const cliente = String(r.CLIENTE_NOMBRE || "").trim() || "—";
  const estado = String(r.ESTADO || "").trim() || "—";
  const fecha = String(r.FECHA_CREACION || r.FECHA_ENTREGA || "").trim();
  const origen = String(r.ORIGEN || "").trim();
  const monto = String(r.MONTO_ESTIMADO || "").trim();
  const tail = [origen && `origen=${origen}`, monto && `monto=${monto}`].filter(Boolean).join(" ");
  const line = `- ${id} | ${cliente} | estado=${estado}${fecha ? ` | fecha=${fecha}` : ""}${tail ? ` | ${tail}` : ""}`;
  const c = clip(r, 120);
  return c ? `${line}\n  consulta/notas: ${c}` : line;
}

/**
 * @param {Record<string, unknown>} r
 */
export function formatMasterRowSummary(r) {
  const id = String(r.COTIZACION_ID || "").trim() || "—";
  const cliente = String(r.CLIENTE_NOMBRE || "").trim() || "—";
  const estado = String(r.ESTADO || "").trim() || "—";
  const fecha = String(r.FECHA_ENTREGA || r.FECHA_CREACION || "").trim();
  const line = `- ${id} | ${cliente} | estado=${estado}${fecha ? ` | entrega/fecha=${fecha}` : ""}`;
  const c = clip(r, 120);
  return c ? `${line}\n  notas: ${c}` : line;
}

/**
 * @param {string} sheetId
 * @param {string} credsPath
 */
function sheetsConfigured(sheetId, credsPath) {
  if (!sheetId || !credsPath) return false;
  const resolved = path.isAbsolute(credsPath) ? credsPath : path.resolve(process.cwd(), credsPath);
  return fs.existsSync(resolved);
}

/**
 * @param {object} config
 * @param {{ getSheetData: Function, getCotizacionesSheetOpts: Function }} sheetsApi
 * @param {string} lastUserMessage
 * @param {object} [options]
 * @param {null | { resolveSellerId?: Function, requestWithRetries?: Function }} [options.ml]
 */
export async function buildAgentOpsContextText(config, sheetsApi, lastUserMessage, options = {}) {
  const { ml = null } = options;
  if (!userMessageWantsOpsSnapshot(lastUserMessage)) return "";

  const sheetId = config.bmcSheetId || "";
  const credsPath = config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  const schema = config.bmcSheetSchema || "Master_Cotizaciones";

  const lines = [];
  lines.push("## CONTEXTO INTERNO (solo equipo BMC — no copiar teléfonos/mails a canales públicos)");
  lines.push(
    `Origen de datos: planilla configurada (schema=${schema}). Si falta configuración, decilo en una frase y seguí con lo que sí tengas (p. ej. calculadora).`
  );

  if (!sheetsConfigured(sheetId, credsPath)) {
    lines.push("- Sheets: no disponible en este entorno (falta BMC_SHEET_ID o credenciales).");
  } else {
    try {
      const { getSheetData, getCotizacionesSheetOpts } = sheetsApi;
      const { sheetName, opts } = getCotizacionesSheetOpts(schema);
      const { rows } = await getSheetData(sheetId, sheetName, false, opts);

      if (schema === "CRM_Operativo") {
        const pending = (rows || []).filter(crmRowLooksPending);
        lines.push(`- CRM_Operativo: ${pending.length} fila(s) con estado “abierto/pendiente” (heurística).`);
        const sample = pending.slice(0, 12);
        if (sample.length) {
          lines.push("Muestra (máx. 12):");
          sample.forEach((r) => lines.push(formatCrmRowSummary(r)));
        } else {
          lines.push("No hay filas pendientes con los criterios usados, o el pipeline no sincronizó aún.");
        }
      } else {
        const open = (rows || []).filter(masterRowLooksOpen);
        lines.push(`- Master_Cotizaciones: ${open.length} fila(s) con estado distinto de confirmado/entregado/cerrado (heurística).`);
        const sample = open.slice(0, 12);
        if (sample.length) {
          lines.push("Muestra (máx. 12):");
          sample.forEach((r) => lines.push(formatMasterRowSummary(r)));
        }
        const byEstado = new Map();
        for (const r of rows || []) {
          const k = String(r.ESTADO || "(vacío)").trim() || "(vacío)";
          byEstado.set(k, (byEstado.get(k) || 0) + 1);
        }
        const top = [...byEstado.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
        if (top.length) {
          lines.push(`Resumen por estado (top): ${top.map(([k, n]) => `${k}:${n}`).join(", ")}`);
        }
      }
    } catch (e) {
      lines.push(`- Sheets: error al leer (${String(e.message || e).slice(0, 160)}).`);
    }
  }

  if (ml && typeof ml.resolveSellerId === "function") {
    try {
      const sellerId = await ml.resolveSellerId();
      if (!sellerId) {
        lines.push("- Mercado Libre: sin seller_id / OAuth no completado — no se listaron preguntas.");
      } else {
        const qRes = await ml.requestWithRetries({
          method: "GET",
          path: "/questions/search",
          query: {
            seller_id: sellerId,
            status: "UNANSWERED",
            limit: 15,
            site_id: config.mlSiteId || "MLU",
            api_version: "4",
          },
        });
        const questions = Array.isArray(qRes?.questions) ? qRes.questions : [];
        lines.push(`- Mercado Libre: ${questions.length} pregunta(s) sin responder (muestra hasta 8).`);
        for (const q of questions.slice(0, 8)) {
          const id = q?.id != null ? String(q.id) : "—";
          const created = q?.date_created ? String(q.date_created).slice(0, 16) : "";
          const txt = String(q?.text || "").replace(/\s+/g, " ").trim().slice(0, 140);
          lines.push(`  · Q:${id}${created ? ` (${created})` : ""} — ${txt || "—"}`);
        }
      }
    } catch (e) {
      lines.push(`- Mercado Libre: no se pudo leer (${String(e.message || e).slice(0, 120)}).`);
    }
  }

  lines.push(
    "Instrucción: si el usuario pidió revisar pendientes, respondé con un resumen accionable a partir de esta lista (prioridades, próximo paso). No inventes filas que no aparecen arriba."
  );

  return `\n\n${lines.join("\n")}`;
}
