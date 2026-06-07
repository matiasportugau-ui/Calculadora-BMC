/**
 * adminCotAppend.js — Escribe una fila en la tab "Enviados" de Admin Cotizaciones.
 *
 * ── SCHEMA ────────────────────────────────────────────────────────────────────
 * Layout A:M inferido de wolfboard.js (líneas 4-9), que es el mismo schema que
 * usa el equipo en Admin. y que POST /wolfboard/enviados replica verbatim al mover
 * filas de Admin. → Enviados:
 *
 *   A(0)  = ID correlación / lead_id
 *   B(1)  = Fecha (formato DD/MM/YYYY — ver nota abajo)
 *   C(2)  = ? (columna no identificada en wolfboard.js — se deja vacía)
 *   D(3)  = Telefono
 *   E(4)  = Cliente
 *   F(5)  = Origen (WA / EM / CL / LO / LL / WEB)
 *   G(6)  = ? (columna no identificada en wolfboard.js — se deja vacía)
 *   H(7)  = Zona / Dirección
 *   I(8)  = Consulta (resumen del pedido)
 *   J(9)  = Respuesta IA (vacío en leads automáticos)
 *   K(10) = Link Drive / PDF URL
 *   L(11) = Estado (se escribe "Enviado")
 *   M(12) = ReplaySnapshotUrl / drive_url alternativo
 *
 * ── ADVERTENCIAS ─────────────────────────────────────────────────────────────
 * 1. El header live de la tab "Enviados" en Admin Cotizaciones NO fue verificado
 *    en tiempo real (el hook de seguridad del sandbox bloquea llamadas googleapis
 *    directas). El mapeo está inferido del código de wolfboard.js. ANTES de flipear
 *    WOLFB_ADMIN_COT_DUAL_WRITE=true en producción, verificar manualmente que la
 *    tab "Enviados" del workbook 1Ie0KCpg... usa este layout A:M.
 *
 * 2. Las columnas C y G son desconocidas (marcadas como "?" en wolfboard.js).
 *    Se dejan vacías — no se inventan valores.
 *
 * 3. Formato de fecha: wolfboard.js línea 849 usa toLocaleDateString("es-UY")
 *    para HTML, y las filas Admin. se leen como string libre (fila[1]). Se usa
 *    formato DD/MM/YYYY para alinearse con el equipo. Si la planilla usa otro
 *    formato, ajustar `formatDateAdminCot`.
 *
 * 4. Idempotencia: si se pasa `lead_id` / `correlation_id`, se escribe en col A.
 *    No se implementa dedup activo (leer A:A antes de append) dado que el feature
 *    flag está off por default. Ver TODO abajo si se necesita en el futuro.
 *
 * ── CREDENCIALES ─────────────────────────────────────────────────────────────
 * Usa la misma service account que wolfboard.js (GOOGLE_APPLICATION_CREDENTIALS).
 * El sheetId es config.wolfbAdminSheetId (env WOLFB_ADMIN_SHEET_ID).
 * La tab es config.wolfbAdminCotEnviadosTab (env WOLFB_ADMIN_COT_ENVIADOS_TAB,
 * default "Enviados").
 *
 * ── MAPEO CANAL → CÓDIGO ORIGEN ──────────────────────────────────────────────
 * canal_origen del Lead JSON  │  Columna F (Origen)
 * ───────────────────────────┼──────────────────────
 * calculadora_web             │  WEB
 * panelin_chat                │  CL   (chat = "calculadora local")
 * wa_inbound                  │  WA
 * email_inbound               │  EM
 * (cualquier otro)            │  se pasa tal cual (truncado a 5 chars)
 *
 * ── RETORNO ──────────────────────────────────────────────────────────────────
 * { ok: true, row: number, sheetId: string }  en éxito
 * { ok: false, error: string }                en fallo (no lanza excepción)
 */

import { google } from "googleapis";
import { config } from "../config.js";
import { sanitizeCellValue } from "./sheetsCsvGuard.js";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

async function getSheetsClient() {
  const credsPath =
    config.googleApplicationCredentials ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    "";
  if (!credsPath) {
    const auth = new google.auth.GoogleAuth({ scopes: [SCOPE] });
    return google.sheets({ version: "v4", auth: await auth.getClient() });
  }
  const auth = new google.auth.GoogleAuth({ keyFile: credsPath, scopes: [SCOPE] });
  return google.sheets({ version: "v4", auth: await auth.getClient() });
}

/**
 * Formatea una fecha ISO → DD/MM/YYYY (formato típico de la planilla Admin Cotizaciones).
 * @param {string|Date} ts
 * @returns {string}
 */
function formatDateAdminCot(ts) {
  const d = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(d.getTime())) return String(ts || "");
  return d.toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Mapea canal_origen del Lead normalizado → código de origen Admin Cotizaciones (col F).
 * @param {string} canal
 * @returns {string}
 */
function mapCanalToOrigen(canal) {
  const map = {
    calculadora_web: "WEB",
    panelin_chat: "CL",
    wa_inbound: "WA",
    email_inbound: "EM",
  };
  const lower = String(canal || "").toLowerCase().trim();
  return map[lower] || String(canal || "").toUpperCase().slice(0, 5);
}

/**
 * Construye el resumen de consulta para col I a partir de los campos del lead.
 * @param {object} input
 * @returns {string}
 */
function buildConsulta(input) {
  const parts = [
    input.scenario ? `[${input.scenario}]` : "",
    input.panel_familia || "",
    input.panel_espesor ? `${input.panel_espesor}mm` : "",
    input.area_m2 ? `${input.area_m2}m²` : "",
    input.lista ? `lista=${input.lista}` : "",
    input.total_con_iva_usd ? `total=USD ${Number(input.total_con_iva_usd).toFixed(2)} c/IVA` : "",
    input.notas ? `| ${input.notas}` : "",
  ];
  return parts.filter(Boolean).join(" ").trim();
}

/**
 * Escribe una fila en la tab "Enviados" del workbook Admin Cotizaciones.
 *
 * @param {object} input
 * @param {string} [input.lead_id]              UUID del lead (va a col A)
 * @param {string} [input.correlation_id]       Alias de lead_id para compatibilidad con crmAppend
 * @param {string} [input.timestamp]            ISO 8601 — formateado a DD/MM/YYYY en col B
 * @param {string} [input.cliente_nombre]       Col E
 * @param {string} [input.telefono]             Col D
 * @param {string} [input.ubicacion]            Col H
 * @param {string} [input.canal_origen]         Col F (mapeado a código WA/EM/CL/WEB)
 * @param {string} [input.scenario]             Usado en resumen col I
 * @param {string} [input.panel_familia]        Usado en resumen col I
 * @param {number} [input.panel_espesor]        Usado en resumen col I
 * @param {number} [input.area_m2]              Usado en resumen col I
 * @param {string} [input.lista]                Usado en resumen col I (web | venta)
 * @param {number} [input.total_con_iva_usd]    Usado en resumen col I
 * @param {string} [input.notas]                Usado en resumen col I
 * @param {string} [input.pdf_url]              Col K
 * @param {string} [input.drive_url]            Col M
 * @returns {Promise<{ok:true,row:number,sheetId:string}|{ok:false,error:string}>}
 */
export async function appendQuoteToAdminCot(input = {}) {
  const sheetId = config.wolfbAdminSheetId;
  if (!sheetId) {
    return {
      ok: false,
      error: "WOLFB_ADMIN_SHEET_ID no configurado — no se puede escribir en Admin Cotizaciones",
    };
  }

  const enviadosTab = config.wolfbAdminCotEnviadosTab || "Enviados";

  let sheets;
  try {
    sheets = await getSheetsClient();
  } catch (err) {
    return { ok: false, error: `Google auth falló: ${err.message}` };
  }

  try {
    const s = sanitizeCellValue;
    const now = input.timestamp ? new Date(input.timestamp) : new Date();
    const correlationId = s(
      String(input.lead_id || input.correlation_id || "").trim()
    );
    const fecha = s(formatDateAdminCot(now));
    const telefono = s(String(input.telefono || "").trim());
    const cliente = s(String(input.cliente_nombre || "").trim() || "—");
    const origen = s(mapCanalToOrigen(input.canal_origen));
    const zona = s(String(input.ubicacion || "").trim());
    const consulta = s(buildConsulta(input));
    const pdfUrl = s(String(input.pdf_url || "").trim());
    const driveUrl = s(String(input.drive_url || "").trim());

    // Layout A:M — columnas C y G desconocidas, se dejan vacías
    const rowValues = [
      correlationId, // A — ID correlación
      fecha,         // B — Fecha
      "",            // C — desconocida
      telefono,      // D — Telefono
      cliente,       // E — Cliente
      origen,        // F — Origen
      "",            // G — desconocida
      zona,          // H — Zona
      consulta,      // I — Consulta
      "",            // J — Respuesta IA (vacío para lead automático)
      pdfUrl,        // K — Link / PDF URL
      "Enviado",     // L — Estado
      driveUrl,      // M — ReplaySnapshotUrl / Drive URL alternativo
    ];

    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `'${enviadosTab}'!A:M`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [rowValues] },
    });

    const updatedRange = appendRes?.data?.updates?.updatedRange || "";
    const appendedRow = Number(
      (updatedRange.match(/![A-Z]+(\d+):[A-Z]+(\d+)$/) || [])[1] || 0
    );

    return { ok: true, row: appendedRow || 0, sheetId };
  } catch (err) {
    return {
      ok: false,
      error: err.message || "Error desconocido al escribir en Admin Cotizaciones",
    };
  }
}
