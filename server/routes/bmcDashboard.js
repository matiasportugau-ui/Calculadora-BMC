/**
 * BMC Finanzas dashboard API — Express router.
 * Mount at /api so routes are /api/cotizaciones, /api/proximas-entregas, etc.
 * Used when Finanzas tab is served at /finanzas from the main server.
 * Error semantics: 503 = Sheets backend unavailable; 200 + empty = no data.
 */
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { google } from "googleapis";
import {
  defaultTailAGAK_Email,
  rangeAGAK,
  CRM_TAB,
  FIRST_DATA_ROW,
  Col,
} from "../lib/crmOperativoLayout.js";
import { parseCrmRowAtoAK, extractMlQuestionId, isSi } from "../lib/crmRowParse.js";
import { sendWhatsAppText } from "../lib/whatsappOutbound.js";
import { readPanelsimEmailSummary } from "../lib/panelsimSummaryReader.js";
import { colIndexToLetter, colLetterToIndex } from "../lib/sheetColumnLetters.js";
import { normalizeIsodecEpsVentaLocalCsvRows } from "../lib/matrizCsvNormalization.js";
import { getCockpitTokenRequestBrowserOrigin } from "../lib/cockpitTokenOrigin.js";
import { syncUnansweredQuestions } from "../ml-crm-sync.js";
import { createTokenStore } from "../tokenStore.js";
import { createMercadoLibreClient } from "../mercadoLibreClient.js";
import { addTrainingEntry } from "../lib/trainingKB.js";
import { getGoogleAuthClient } from "../lib/googleAuthCache.js";
import { buildTaskProviderChain } from "../lib/modelRouter.js";

const SCOPE_READ = "https://www.googleapis.com/auth/spreadsheets.readonly";
const SCOPE_WRITE = "https://www.googleapis.com/auth/spreadsheets";

/** In-memory TTL cache to reduce Sheets read bursts (per-user quota). 0 = disabled. */
function parseSheetsCacheTtlMs(envVal, defaultMs) {
  const n = Number(envVal);
  if (!Number.isFinite(n)) return defaultMs;
  return Math.max(0, Math.floor(n));
}

const SHEETS_TAB_NAMES_TTL_MS = parseSheetsCacheTtlMs(
  process.env.BMC_SHEETS_TAB_NAMES_TTL_MS,
  120_000,
);
const SHEETS_VENTAS_MERGE_TTL_MS = parseSheetsCacheTtlMs(
  process.env.BMC_SHEETS_VENTAS_MERGE_TTL_MS,
  90_000,
);

/** CRM IA fallback order (suggest-response, parse-email, etc.): quality first, then cost/speed. */
const CRM_AI_PROVIDER_RANKING = ["claude", "openai", "grok", "gemini"];

const sheetsReadCache = new Map();

function sheetsCacheGet(key) {
  const e = sheetsReadCache.get(key);
  if (!e) return undefined;
  if (Date.now() > e.exp) {
    sheetsReadCache.delete(key);
    return undefined;
  }
  return e.val;
}

function sheetsCacheSet(key, val, ttlMs) {
  if (!ttlMs || ttlMs <= 0) return;
  sheetsReadCache.set(key, { val, exp: Date.now() + ttlMs });
}

/** After ventas writes, drop tab-name + merged ventas entries for this workbook. */
function invalidateVentasSheetsReadCache(sheetId) {
  if (!sheetId) return;
  sheetsReadCache.delete(`tabNames:${sheetId}`);
  const prefix = `ventasAll:${sheetId}:`;
  for (const k of sheetsReadCache.keys()) {
    if (k.startsWith(prefix)) sheetsReadCache.delete(k);
  }
}

function sheetsReadRetryMaxAttempts() {
  const n = Number(process.env.BMC_SHEETS_READ_MAX_RETRIES);
  if (!Number.isFinite(n) || n < 1) return 5;
  return Math.min(12, Math.floor(n));
}

function sheetsReadRetryBaseMs() {
  const n = Number(process.env.BMC_SHEETS_READ_RETRY_BASE_MS);
  if (!Number.isFinite(n) || n < 0) return 500;
  return Math.min(8_000, Math.floor(n));
}

function isSheetsRateOrQuotaError(err) {
  const status = err?.response?.status;
  const code = err?.code;
  const msg = String(err?.message || err?.errors?.[0]?.message || "").toLowerCase();
  if (status === 429 || code === 429) return true;
  if (status === 403 && (msg.includes("quota") || msg.includes("rate"))) return true;
  if (msg.includes("quota exceeded") || msg.includes("quota limit")) return true;
  if (msg.includes("user rate limit") || msg.includes("rate limit exceeded")) return true;
  return false;
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry Sheets reads on 429 / quota (exponential backoff + jitter). `BMC_SHEETS_READ_MAX_RETRIES=1` disables retries. */
async function withSheetsReadRetry(_label, fn) {
  const maxAttempts = sheetsReadRetryMaxAttempts();
  const baseMs = sheetsReadRetryBaseMs();
  if (maxAttempts <= 1) return fn();

  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!isSheetsRateOrQuotaError(e) || attempt === maxAttempts) throw e;
      const exp = Math.min(25_000, baseMs * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * (baseMs + 120));
      await sleepMs(exp + jitter);
    }
  }
  throw lastErr;
}

function getStartOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getEndOfWeek(d) {
  const start = getStartOfWeek(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function isInCurrentWeek(dateVal) {
  const d = parseDate(dateVal);
  if (!d) return false;
  const start = getStartOfWeek(new Date());
  const end = getEndOfWeek(new Date());
  const t = d.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function normalizeCurrency(val) {
  const currency = String(val || "$").trim();
  return currency || "$";
}

function getResumenPagosPorPeriodo(rows) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startWeek = getStartOfWeek(today);
  const endWeek = new Date(startWeek);
  endWeek.setDate(endWeek.getDate() + 6);
  endWeek.setHours(23, 59, 59, 999);
  const nextWeekStart = new Date(endWeek);
  nextWeekStart.setDate(nextWeekStart.getDate() + 1);
  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
  nextWeekEnd.setHours(23, 59, 59, 999);
  const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
  const byDate = {};
  const byCurrency = {};
  let estaSemana = 0;
  let proximaSemana = 0;
  let esteMes = 0;
  let total = 0;
  for (let i = 0; i < rows.length; i++) {
    const monto = parseFloat(rows[i].MONTO) || 0;
    const key = normalizeCurrency(rows[i].MONEDA);
    let vencio = null;
    if (!byCurrency[key]) {
      byCurrency[key] = { total: 0, estaSemana: 0, proximaSemana: 0, esteMes: 0 };
    }
    if (rows[i].FECHA_VENCIMIENTO) {
      vencio = parseDate(rows[i].FECHA_VENCIMIENTO);
      if (vencio) {
        const dateStr = vencio.toISOString().slice(0, 10);
        if (!byDate[dateStr]) byDate[dateStr] = { total: 0, byCurrency: {} };
        byDate[dateStr].total += monto;
        byDate[dateStr].byCurrency[key] = (byDate[dateStr].byCurrency[key] || 0) + monto;
      }
    }
    total += monto;
    byCurrency[key].total += monto;
    if (vencio) {
      const t = vencio.getTime();
      if (t >= startWeek.getTime() && t <= endWeek.getTime()) {
        estaSemana += monto;
        byCurrency[key].estaSemana += monto;
      } else if (t >= nextWeekStart.getTime() && t <= nextWeekEnd.getTime()) {
        proximaSemana += monto;
        byCurrency[key].proximaSemana += monto;
      }
      if (t <= endMonth.getTime()) {
        esteMes += monto;
        byCurrency[key].esteMes += monto;
      }
    } else {
      esteMes += monto;
      byCurrency[key].esteMes += monto;
    }
  }
  return { byDate, byCurrency, estaSemana, proximaSemana, esteMes, total };
}

function buildWhatsAppBlock(row) {
  const cliente = row.CLIENTE_NOMBRE || "—";
  const telefono = row.TELEFONO || "—";
  const ubicacion =
    row.LINK_UBICACION ||
    (row.DIRECCION || row.ZONA ? [row.DIRECCION, row.ZONA].filter(Boolean).join(", ") : "—");
  const pedido = row.COTIZACION_ID || "—";
  const fotoCotizacion =
    row.LINK_COTIZACION || (row.NOTAS ? `Items: ${row.NOTAS}` : "Ver cotización en sistema");
  return [
    `📦 *Pedido:* ${pedido}`,
    `👤 *Cliente:* ${cliente}`,
    `📞 *Teléfono:* ${telefono}`,
    `📍 *Ubicación:* ${ubicacion}`,
    `📄 *Cotización / items:* ${fotoCotizacion}`,
    "—",
  ].join("\n");
}

function buildCoordinacionLogisticaText(rows) {
  const header = "🚚 *Coordinación logística — entregas de la semana*\n\n";
  const blocks = rows.map(buildWhatsAppBlock);
  return header + blocks.join("\n");
}

const CRM_TO_BMC = {
  ID: "COTIZACION_ID",
  Fecha: "FECHA_CREACION",
  Cliente: "CLIENTE_NOMBRE",
  Teléfono: "TELEFONO",
  "Ubicación / Dirección": "DIRECCION",
  Origen: "ORIGEN",
  "Consulta / Pedido": "NOTAS",
  Estado: "ESTADO",
  Responsable: "ASIGNADO_A",
  "Fecha próxima acción": "FECHA_ENTREGA",
  "Monto estimado USD": "MONTO_ESTIMADO",
  Observaciones: "COMENTARIOS_ENTREGA",
};

function mapCrmRowToBmc(row) {
  const out = {};
  for (const [crm, bmc] of Object.entries(CRM_TO_BMC)) {
    out[bmc] = row[crm] ?? row[bmc] ?? "";
  }
  return { ...row, ...out };
}

async function getFirstSheetName(sheetId) {
  const authClient = await getGoogleAuthClient(SCOPE_READ);
  const sheets = google.sheets({ version: "v4", auth: authClient });
  const meta = await withSheetsReadRetry("spreadsheets.get", () =>
    sheets.spreadsheets.get({ spreadsheetId: sheetId })
  );
  const first = meta.data.sheets?.[0]?.properties?.title;
  return first || "Hoja 1";
}

async function getSheetNames(sheetId) {
  if (!sheetId) return [];
  const cacheKey = `tabNames:${sheetId}`;
  if (SHEETS_TAB_NAMES_TTL_MS > 0) {
    const hit = sheetsCacheGet(cacheKey);
    if (hit) return [...hit];
  }
  const authClient = await getGoogleAuthClient(SCOPE_READ);
  const sheets = google.sheets({ version: "v4", auth: authClient });
  const meta = await withSheetsReadRetry("spreadsheets.get", () =>
    sheets.spreadsheets.get({ spreadsheetId: sheetId })
  );
  const names = (meta.data.sheets || []).map((s) => s.properties?.title).filter(Boolean);
  sheetsCacheSet(cacheKey, names, SHEETS_TAB_NAMES_TTL_MS);
  return [...names];
}

function findKey(obj, ...candidates) {
  const keys = Object.keys(obj || {});
  const norm = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  for (const c of candidates) {
    const nc = norm(c);
    const found = keys.find((k) => norm(k) === nc || norm(k).includes(nc));
    if (found) return obj[found];
  }
  return "";
}

/** Primer URL http(s) en un texto (p. ej. link de mapa dentro de DIRECCIÓN). */
function extractFirstHttpUrl(text) {
  const m = String(text || "").match(/https?:\/\/[^\s"'<>]+/i);
  if (!m) return "";
  return m[0].replace(/[,;.)'"]+$/g, "");
}

/**
 * Fila de la pestaña Ventas apta para logística (cliente/pedido real, no separadores de semana).
 * @param {Record<string, unknown>} r
 */
function ventasRowIsLogisticaRow(r) {
  const id = String(findKey(r, "ID. Pedido", "ID Pedido", "Id. Pedido") || "").trim();
  const nom = String(findKey(r, "NOMBRE", "Nombre") || "").trim();
  if (!id && !nom) return false;
  if (/^semana del\b/i.test(nom)) return false;
  if (/^origen$/i.test(id)) return false;
  return true;
}

function parseNum(val) {
  if (val == null || val === "") return 0;
  const s = String(val).trim();
  const eu = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(eu);
  return isNaN(n) ? parseFloat(s.replace(/[^\d.-]/g, "")) || 0 : n;
}

function mapPagos2026ToCanonical(row) {
  const fecha = findKey(row, "FECHA", "Fecha") || findKey(row, "PLAZO");
  const cliente = findKey(row, "CLIENTE", "Cliente");
  const orden = findKey(row, "ÓRDEN", "ORDEN", "Pedido", "N° Pedido", "Ped. Nro");
  const saldoUsd = findKey(row, "Saldo a Proveedor USD", "Pago a Proveedor USD");
  const ventaUsd = findKey(row, "Venta U$S IVA inc.", "Precio de Venta IVA Inc");
  const saldoPesos = findKey(row, "Saldo a Proveedor", "Pago a Proveedor");
  const montoUsd = parseNum(saldoUsd || ventaUsd);
  const montoPesos = parseNum(saldoPesos);
  const monto = montoUsd || montoPesos;
  const moneda = montoUsd ? "UES" : "$";
  const estado = findKey(row, "ESTADO", "Estado") || "Pendiente";
  const precioVenta = parseNum(findKey(row, "Precio de Venta IVA Inc", "Venta U$S IVA inc."));
  const costoCompra = parseNum(findKey(row, "Costo de la compra"));
  return {
    CLIENTE_NOMBRE: cliente,
    COTIZACION_ID: orden,
    MONTO: monto,
    MONEDA: moneda,
    FECHA_VENCIMIENTO: fecha,
    ESTADO_PAGO: estado,
    PROVEEDOR: findKey(row, "PROVEEDOR", "Proveedor"),
    PRECIO_VENTA: precioVenta,
    COSTO_COMPRA: costoCompra,
  };
}

function mapVentas2026ToCanonical(row, proveedor = "") {
  const idPedido = findKey(row, "ID. Pedido", "ID Pedido", "Id. Pedido");
  const nombre = findKey(row, "NOMBRE", "Nombre");
  const fechaEntrega = findKey(row, "FECHA ENTREGA", "FECHA ENTREGA", "Fecha entrega");
  const costo = parseNum(findKey(row, "COSTO SIN IVA", "MONTO SIN IVA", "Costo", "Costo SIN IVA"));
  const ganancia = parseNum(findKey(row, "GANANCIAS SIN IVA", "Ganancia", "GANANCIAS SIN IVA"));
  const saldos = findKey(row, "SALDOS", "Saldos");
  const pagoProveedor = findKey(row, "Pago a Proveedor", "Pago a Proveedor");
  const facturado = findKey(row, "FACTURADO", "Facturado");
  const numFactura = findKey(row, "Nº FACTURA", "Nº Factura", "NUM FACTURA");
  const direccionRaw = findKey(row, "DIRECCIÓN", "Dirección", "DIRECCION");
  let linkUbicacion = String(
    findKey(row, "LINK UBICACION", "Link ubicación", "LINK_UBICACION", "MAPS", "Google Maps") || ""
  ).trim();
  const urlInDir = extractFirstHttpUrl(direccionRaw);
  if (!linkUbicacion && urlInDir && /maps\.(google|app)/i.test(urlInDir)) linkUbicacion = urlInDir;
  let direccion = String(direccionRaw || "").trim();
  if (urlInDir && direccion.includes(urlInDir)) {
    direccion = direccion
      .replace(urlInDir, "")
      .replace(/\s*-\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  const telefono = findKey(row, "CONTACTO", "Teléfono", "TELEFONO", "Telefono", "TEL");
  const zona = findKey(row, "ZONA", "Zona");
  const linkCarpeta = findKey(row, "CARPETA", "Carpeta", "ADJUNTO", "PDF");
  const pedidoResumen = findKey(row, "ENCARGO", "PEDIDO", "Pedido", "Consulta / Pedido", "CONSULTA / PEDIDO");
  return {
    COTIZACION_ID: idPedido,
    CLIENTE_NOMBRE: nombre,
    FECHA_ENTREGA: fechaEntrega,
    COSTO: costo,
    GANANCIA: ganancia,
    SALDO_CLIENTE: saldos,
    PAGO_PROVEEDOR: pagoProveedor,
    FACTURADO: facturado,
    NUM_FACTURA: numFactura,
    PROVEEDOR: proveedor || findKey(row, "PROVEEDOR", "Proveedor"),
    DIRECCION: direccion,
    TELEFONO: telefono,
    ZONA: zona,
    LINK_UBICACION: linkUbicacion,
    LINK_CARPETA: linkCarpeta,
    PEDIDO_RESUMEN: pedidoResumen,
  };
}

function mapStockEcommerceToCanonical(row) {
  const codigo = findKey(row, "Codigo", "Código", "Codigo");
  const producto = findKey(row, "Producto");
  const costo = parseNum(findKey(row, "Costo m2 U$S + IVA", "Costo m2 U$S + IVA", "Costo"));
  const margen = parseNum(findKey(row, "Margen %", "Margen %"));
  const ganancia = parseNum(findKey(row, "Ganancia"));
  const venta = parseNum(findKey(row, "Venta + IVA", "Venta Inm +IVA", "Venta Inm IVA inc"));
  const stock = parseNum(findKey(row, "Stock", "STOCK"));
  const pedido = parseNum(findKey(row, "Pedido RYC", "Pedido 11/08", "Pedido 30/6"));
  return {
    CODIGO: codigo,
    PRODUCTO: producto,
    COSTO_USD: costo,
    MARGEN_PCT: margen,
    GANANCIA: ganancia,
    VENTA_USD: venta,
    STOCK: stock,
    PEDIDO_PENDIENTE: pedido,
  };
}

async function getSheetData(sheetId, sheetName, useWrite = false, options = {}) {
  const { schema, headerRowOffset = 0 } = options;
  const authClient = await getGoogleAuthClient(useWrite ? SCOPE_WRITE : SCOPE_READ);
  const sheets = google.sheets({ version: "v4", auth: authClient });
  const range =
    headerRowOffset > 0
      ? `'${sheetName}'!A${headerRowOffset + 1}:ZZ`
      : `'${sheetName}'`;
  const res = await withSheetsReadRetry("values.get", () =>
    sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    })
  );
  const rows = res.data.values || [];
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0];
  let data = rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i] ?? ""));
    return obj;
  });
  if (schema === "CRM_Operativo") {
    data = data.filter((r) => r.ID || r.Cliente || r.COTIZACION_ID);
    data = data.map(mapCrmRowToBmc);
  }
  if (schema === "Pagos_2026") {
    data = data.filter((r) => findKey(r, "FECHA", "CLIENTE", "PROVEEDOR") || findKey(r, "Saldo a Proveedor USD", "Pago a Proveedor USD"));
    data = data.map(mapPagos2026ToCanonical);
  }
  if (schema === "Ventas_2026") {
    data = data.filter((r) => findKey(r, "ID. Pedido", "NOMBRE", "COSTO SIN IVA") || findKey(r, "MONTO SIN IVA"));
    data = data.map((r) => mapVentas2026ToCanonical(r, ""));
  }
  if (schema === "Stock_Ecommerce") {
    data = data.filter((r) => findKey(r, "Codigo", "Producto") || findKey(r, "Código"));
    data = data.map(mapStockEcommerceToCanonical);
  }
  return { headers, rows: data };
}

async function getProximasEntregas(sheetId, schema) {
  const sheetName = schema === "CRM_Operativo" ? "CRM_Operativo" : "Master_Cotizaciones";
  const opts = schema === "CRM_Operativo" ? { schema, headerRowOffset: 2 } : {};
  const { rows } = await getSheetData(sheetId, sheetName, false, opts);
  if (schema === "CRM_Operativo") {
    return rows.filter(
      (r) =>
        ["Pendiente", "Abierto"].includes(String(r.ESTADO || "")) &&
        r.FECHA_ENTREGA &&
        isInCurrentWeek(r.FECHA_ENTREGA)
    );
  }
  return rows.filter(
    (r) =>
      r.ESTADO === "Confirmado" &&
      r.FECHA_ENTREGA &&
      isInCurrentWeek(r.FECHA_ENTREGA)
  );
}

async function handleMarcarEntregado(sheetId, body) {
  const { cotizacionId, comentarios = "" } = body || {};
  if (!cotizacionId) throw new Error("cotizacionId required");
  const authClient = await getGoogleAuthClient(SCOPE_WRITE);
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const { rows: masterRows } = await getSheetData(sheetId, "Master_Cotizaciones");
  const rowIndex = masterRows.findIndex((r) => String(r.COTIZACION_ID) === String(cotizacionId));
  if (rowIndex === -1) throw new Error("Cotización no encontrada");

  const row = masterRows[rowIndex];
  const destHeaders = [
    "COTIZACION_ID", "FECHA_CREACION", "FECHA_ACTUALIZACION", "CLIENTE_ID", "CLIENTE_NOMBRE",
    "TELEFONO", "DIRECCION", "ZONA", "ASIGNADO_A", "ESTADO", "FECHA_ENVIO", "FECHA_CONFIRMACION",
    "FECHA_ENTREGA", "COMENTARIOS_ENTREGA", "FECHA_ENTREGA_REAL", "ORIGEN", "MONTO_ESTIMADO", "MONEDA", "NOTAS", "ETIQUETAS",
    "USUARIO_CREACION", "USUARIO_ACTUALIZACION", "VERSION", "LINK_UBICACION", "LINK_COTIZACION",
  ];
  const destRow = destHeaders.map((h) => {
    if (h === "FECHA_ENTREGA_REAL") return new Date().toISOString().slice(0, 10);
    if (h === "COMENTARIOS_ENTREGA") return comentarios;
    return row[h] ?? "";
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "'Ventas realizadas y entregadas'!A:Y",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [destRow] },
  });

  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const masterSheetId = sheetMeta.data.sheets?.find(
    (s) => s.properties?.title === "Master_Cotizaciones"
  )?.properties?.sheetId;
  if (masterSheetId !== undefined) {
    const sheetRowIndex = rowIndex + 1;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: masterSheetId,
                dimension: "ROWS",
                startIndex: sheetRowIndex,
                endIndex: sheetRowIndex + 1,
              },
            },
          },
        ],
      },
    });
  }

  return { ok: true, cotizacionId };
}

function checkSheetsAvailable(config) {
  const sheetId = config.bmcSheetId || "";
  const credsPath =
    config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  if (!sheetId || !credsPath) return false;
  const resolved = path.isAbsolute(credsPath) ? credsPath : path.resolve(process.cwd(), credsPath);
  return fs.existsSync(resolved);
}

function checkPagosAvailable(config) {
  const credsPath =
    config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  if (!credsPath) return false;
  const resolved = path.isAbsolute(credsPath) ? credsPath : path.resolve(process.cwd(), credsPath);
  if (!fs.existsSync(resolved)) return false;
  return !!(config.bmcPagosSheetId || config.bmcSheetId);
}

function checkCalendarioAvailable(config) {
  const credsPath =
    config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  if (!credsPath) return false;
  const resolved = path.isAbsolute(credsPath) ? credsPath : path.resolve(process.cwd(), credsPath);
  if (!fs.existsSync(resolved)) return false;
  return !!(config.bmcCalendarioSheetId || config.bmcSheetId);
}

function checkVentasAvailable(config) {
  const credsPath =
    config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  if (!credsPath) return false;
  const resolved = path.isAbsolute(credsPath) ? credsPath : path.resolve(process.cwd(), credsPath);
  if (!fs.existsSync(resolved)) return false;
  return !!config.bmcVentasSheetId;
}

function checkStockAvailable(config) {
  const credsPath =
    config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  if (!credsPath) return false;
  const resolved = path.isAbsolute(credsPath) ? credsPath : path.resolve(process.cwd(), credsPath);
  if (!fs.existsSync(resolved)) return false;
  return !!config.bmcStockSheetId;
}

function noConfig(res) {
  res.status(503).json({
    ok: false,
    error: "Sheets not configured",
  });
}

function sheetsUnavailable(res, message = "Sheets backend unavailable") {
  res.status(503).json({ ok: false, error: message });
}

function isMissingSheetError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("unable to parse range") ||
    message.includes("requested entity was not found") ||
    message.includes("does not match grid limits")
  );
}

const MESES_ES = {
  "01": "ENERO", "02": "FEBRERO", "03": "MARZO", "04": "ABRIL",
  "05": "MAYO", "06": "JUNIO", "07": "JULIO", "08": "AGOSTO",
  "09": "SEPTIEMBRE", "10": "OCTUBRE", "11": "NOVIEMBRE", "12": "DICIEMBRE",
};

function monthParamToTabName(month) {
  // "2026-03" → "MARZO 2026"
  const parts = String(month || "").split("-");
  if (parts.length < 2) return null;
  const [year, mm] = parts;
  const mes = MESES_ES[mm.padStart(2, "0")];
  return mes && year ? `${mes} ${year}` : null;
}

/** A1 range for ventas tab: headers row 2, data from row 3 (matches getSheetData headerRowOffset: 1). */
function ventasTabRangeA1(tabName) {
  const safe = String(tabName).replace(/'/g, "''");
  return `'${safe}'!A2:ZZ`;
}

/**
 * One batchGet per chunk instead of N values.get — fewer Sheets read quota units on cache miss.
 * Falls back to per-tab getSheetData if a batch fails (e.g. bad tab name / range).
 */
async function fetchVentasRowsAllTabsBatched(sheetId, tabNames) {
  if (!tabNames.length) return [];
  const authClient = await getGoogleAuthClient(SCOPE_READ);
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const CHUNK = 40;
  const merged = [];

  async function fallbackPerTab(chunk) {
    const results = await Promise.allSettled(
      chunk.map(async (tabName) => {
        try {
          const { rows: rawRows } = await getSheetData(sheetId, tabName, false, { headerRowOffset: 1 });
          const filtered = rawRows.filter((r) =>
            findKey(r, "ID. Pedido", "NOMBRE", "COSTO SIN IVA") || findKey(r, "MONTO SIN IVA")
          );
          return filtered.map((r) => mapVentas2026ToCanonical(r, tabName));
        } catch {
          return [];
        }
      })
    );
    return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  }

  for (let i = 0; i < tabNames.length; i += CHUNK) {
    const chunk = tabNames.slice(i, i + CHUNK);
    const ranges = chunk.map(ventasTabRangeA1);
    try {
      const res = await withSheetsReadRetry("values.batchGet", () =>
        sheets.spreadsheets.values.batchGet({
          spreadsheetId: sheetId,
          ranges,
        })
      );
      const vrs = res.data.valueRanges || [];
      for (let j = 0; j < chunk.length; j++) {
        const tabName = chunk[j];
        const values = vrs[j]?.values;
        if (!values || values.length < 2) continue;
        const headers = values[0];
        const dataRows = values.slice(1);
        const rawRows = dataRows.map((row) => {
          const obj = {};
          headers.forEach((h, idx) => {
            obj[h] = row[idx] ?? "";
          });
          return obj;
        });
        const filtered = rawRows.filter((r) =>
          findKey(r, "ID. Pedido", "NOMBRE", "COSTO SIN IVA") || findKey(r, "MONTO SIN IVA")
        );
        merged.push(...filtered.map((r) => mapVentas2026ToCanonical(r, tabName)));
      }
    } catch {
      merged.push(...(await fallbackPerTab(chunk)));
    }
  }

  return merged;
}

async function getAllVentasData(sheetId, proveedorFilter) {
  if (!sheetId) return [];
  const provKey = String(proveedorFilter ?? "").trim().toLowerCase();
  const mergeKey = `ventasAll:${sheetId}:${provKey}`;
  if (SHEETS_VENTAS_MERGE_TTL_MS > 0) {
    const hit = sheetsCacheGet(mergeKey);
    if (hit) return structuredClone(hit);
  }

  const tabNames = await getSheetNames(sheetId);
  const allRows = await fetchVentasRowsAllTabsBatched(sheetId, tabNames);
  const out = proveedorFilter
    ? allRows.filter((r) => String(r.PROVEEDOR || "").toLowerCase().includes(String(proveedorFilter).toLowerCase()))
    : allRows;

  sheetsCacheSet(mergeKey, out, SHEETS_VENTAS_MERGE_TTL_MS);
  return structuredClone(out);
}

async function getOptionalSheetRows(sheetId, sheetName) {
  try {
    const { rows } = await getSheetData(sheetId, sheetName);
    return rows || [];
  } catch (error) {
    if (isMissingSheetError(error)) return [];
    throw error;
  }
}

function getCotizacionesSheetOpts(schema) {
  if (schema === "CRM_Operativo") {
    return { sheetName: "CRM_Operativo", opts: { schema, headerRowOffset: 2 } };
  }
  return { sheetName: "Master_Cotizaciones", opts: {} };
}

// ─── Write helpers ────────────────────────────────────────────────────────
// colIndexToLetter / colLetterToIndex: ../lib/sheetColumnLetters.js

async function appendAuditLog(sheets, sheetId, action, rowId, oldVal, newVal, sheetName) {
  const now = new Date().toISOString();
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "'AUDIT_LOG'!A:H",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[now, action, String(rowId), String(oldVal), String(newVal), "api", "api", sheetName]],
      },
    });
  } catch (_e) {
    // audit failure must not fail the main operation
  }
}

async function handleCreateCotizacion(sheetId, body) {
  const authClient = await getGoogleAuthClient(SCOPE_WRITE);
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const newId = "COT-" + Date.now();
  const today = new Date().toISOString().slice(0, 10);

  // Get headers from CRM_Operativo — row 3 (headerRowOffset: 2)
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "'CRM_Operativo'!A3:ZZ3",
  });
  const headers = (headerRes.data.values || [[]])[0] || [];

  const canonical = {
    COTIZACION_ID: newId,
    FECHA_CREACION: today,
    ESTADO: body.ESTADO || "Pendiente",
    CLIENTE_NOMBRE: body.CLIENTE_NOMBRE || "",
    TELEFONO: body.TELEFONO || "",
    DIRECCION: body.DIRECCION || "",
    ORIGEN: body.ORIGEN || "",
    NOTAS: body.NOTAS || "",
    ASIGNADO_A: body.ASIGNADO_A || "",
    FECHA_ENTREGA: body.FECHA_ENTREGA || "",
    MONTO_ESTIMADO: body.MONTO_ESTIMADO || "",
    COMENTARIOS_ENTREGA: body.COMENTARIOS_ENTREGA || "",
  };

  const row = headers.length > 0
    ? headers.map((h) => {
        const bmcKey = CRM_TO_BMC[h];
        return bmcKey ? (canonical[bmcKey] ?? "") : (canonical[h] ?? body[h] ?? "");
      })
    : Object.values(canonical);

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "'CRM_Operativo'!A:ZZ",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });

  await appendAuditLog(sheets, sheetId, "API_CREATE", newId, "", newId, "CRM_Operativo");
  return { ok: true, id: newId, row: canonical };
}

async function handleUpdateCotizacion(sheetId, id, body) {
  const authClient = await getGoogleAuthClient(SCOPE_WRITE);
  const sheets = google.sheets({ version: "v4", auth: authClient });

  // Headers start at row 3 (headerRowOffset: 2)
  const dataRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "'CRM_Operativo'!A3:ZZ",
  });
  const allRows = dataRes.data.values || [];
  if (allRows.length === 0) throw new Error("CRM_Operativo vacío");

  const headers = allRows[0];
  const idColIndex = headers.findIndex((h) => h === "ID" || CRM_TO_BMC[h] === "COTIZACION_ID");
  if (idColIndex === -1) throw new Error("Columna ID no encontrada en CRM_Operativo");

  const dataRows = allRows.slice(1);
  const rowIndex = dataRows.findIndex((r) => String(r[idColIndex] || "") === String(id));
  if (rowIndex === -1) throw new Error(`Cotización ${id} no encontrada`);

  // spreadsheet row: 2 offset rows + 1 header row (row 3) + 1-based data index
  const spreadsheetRowNum = rowIndex + 4;

  const updatable = {
    ESTADO: "Estado",
    ASIGNADO_A: "Responsable",
    FECHA_ENTREGA: "Fecha próxima acción",
  };
  const updates = [];
  const oldValues = {};

  for (const [bmcKey, crmKey] of Object.entries(updatable)) {
    if (body[bmcKey] === undefined) continue;
    const colIndex = headers.findIndex((h) => h === crmKey);
    if (colIndex === -1) continue;
    oldValues[bmcKey] = dataRows[rowIndex][colIndex] || "";
    updates.push({
      range: `'CRM_Operativo'!${colIndexToLetter(colIndex)}${spreadsheetRowNum}`,
      values: [[body[bmcKey]]],
    });
  }

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data: updates },
    });
  }

  const changedFields = Object.keys(body).filter((k) => updatable[k] !== undefined).join(",");
  await appendAuditLog(sheets, sheetId, "API_UPDATE", id, JSON.stringify(oldValues), changedFields, "CRM_Operativo");
  return { ok: true, id };
}

async function handleCreatePago(pagoSheetId, mainSheetId, body) {
  const authClient = await getGoogleAuthClient(SCOPE_WRITE);
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const tabName = await getFirstSheetName(pagoSheetId);

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: pagoSheetId,
    range: `'${tabName}'!A1:ZZ1`,
  });
  const headers = (headerRes.data.values || [[]])[0] || [];

  // Canonical → sheet column fuzzy map
  const canonicalMap = {
    FECHA: body.FECHA_VENCIMIENTO || "",
    Fecha: body.FECHA_VENCIMIENTO || "",
    PLAZO: body.FECHA_VENCIMIENTO || "",
    PROVEEDOR: body.PROVEEDOR || "",
    Proveedor: body.PROVEEDOR || "",
    CLIENTE: body.CLIENTE_NOMBRE || "",
    Cliente: body.CLIENTE_NOMBRE || "",
    MONTO: body.MONTO || "",
    MONEDA: body.MONEDA || "$",
    ESTADO: body.ESTADO_PAGO || "Pendiente",
    Estado: body.ESTADO_PAGO || "Pendiente",
    "Saldo a Proveedor USD": body.MONTO || "",
    "Pago a Proveedor USD": body.MONTO || "",
    COTIZACION_ID: body.COTIZACION_ID || "",
    ORDEN: body.COTIZACION_ID || "",
  };

  let row;
  if (headers.length > 0) {
    row = headers.map((h) => canonicalMap[h] ?? body[h] ?? "");
    if (!headers.some((h) => /ORDEN|COTIZACION|Pedido/i.test(h))) {
      row.push(body.COTIZACION_ID || "");
    }
  } else {
    row = [
      body.FECHA_VENCIMIENTO || "", body.PROVEEDOR || "", body.CLIENTE_NOMBRE || "",
      body.MONTO || "", body.MONEDA || "$", body.ESTADO_PAGO || "Pendiente", body.COTIZACION_ID || "",
    ];
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: pagoSheetId,
    range: `'${tabName}'!A:ZZ`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });

  await appendAuditLog(sheets, mainSheetId, "API_CREATE_PAGO", body.COTIZACION_ID || "NEW", "", JSON.stringify(body), tabName);
  return { ok: true, row: body };
}

async function handleUpdatePago(pagoSheetId, mainSheetId, id, body) {
  const authClient = await getGoogleAuthClient(SCOPE_WRITE);
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const tabName = await getFirstSheetName(pagoSheetId);

  const dataRes = await sheets.spreadsheets.values.get({
    spreadsheetId: pagoSheetId,
    range: `'${tabName}'!A:ZZ`,
  });
  const allRows = dataRes.data.values || [];
  if (allRows.length === 0) throw new Error("Hoja de pagos vacía");

  const headers = allRows[0];
  const cotizColIndex = headers.findIndex((h) => /ORDEN|COTIZACION|Pedido/i.test(h));
  const dataRows = allRows.slice(1);
  const rowIndex = cotizColIndex !== -1
    ? dataRows.findIndex((r) => String(r[cotizColIndex] || "") === String(id))
    : -1;
  if (rowIndex === -1) throw new Error(`Pago para cotización ${id} no encontrado`);

  const spreadsheetRowNum = rowIndex + 2;
  const updates = [];

  const estadoColIndex = headers.findIndex((h) => /ESTADO/i.test(h));
  if (estadoColIndex !== -1 && body.ESTADO_PAGO !== undefined) {
    updates.push({
      range: `'${tabName}'!${colIndexToLetter(estadoColIndex)}${spreadsheetRowNum}`,
      values: [[body.ESTADO_PAGO]],
    });
    if (body.ESTADO_PAGO === "Cobrado") {
      const fechaCobColIndex = headers.findIndex((h) => /FECHA_COBRO|FECHA COBRO/i.test(h));
      if (fechaCobColIndex !== -1) {
        updates.push({
          range: `'${tabName}'!${colIndexToLetter(fechaCobColIndex)}${spreadsheetRowNum}`,
          values: [[body.FECHA_COBRO || new Date().toISOString().slice(0, 10)]],
        });
      }
    }
  }

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: pagoSheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data: updates },
    });
  }

  await appendAuditLog(sheets, mainSheetId, "API_UPDATE_PAGO", id, "", JSON.stringify(body), tabName);
  return { ok: true, id };
}

async function handleCreateVenta(ventasSheetId, body) {
  const authClient = await getGoogleAuthClient(SCOPE_WRITE);
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const tabNames = await getSheetNames(ventasSheetId);
  const proveedor = body.PROVEEDOR || "";
  const targetTab = tabNames.find((t) => t.toLowerCase() === proveedor.toLowerCase()) || tabNames[0];

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: ventasSheetId,
    range: `'${targetTab}'!A2:ZZ2`,
  });
  const headers = (headerRes.data.values || [[]])[0] || [];

  const ventasMap = {
    "ID. Pedido": body.COTIZACION_ID || "",
    "Id. Pedido": body.COTIZACION_ID || "",
    "ID Pedido": body.COTIZACION_ID || "",
    NOMBRE: body.CLIENTE_NOMBRE || "",
    Nombre: body.CLIENTE_NOMBRE || "",
    "FECHA ENTREGA": body.FECHA_ENTREGA || "",
    "Fecha entrega": body.FECHA_ENTREGA || "",
    "COSTO SIN IVA": body.COSTO || "",
    "MONTO SIN IVA": body.COSTO || "",
    "GANANCIAS SIN IVA": body.GANANCIA || "",
    Ganancia: body.GANANCIA || "",
    SALDOS: body.SALDO_CLIENTE || "",
    Saldos: body.SALDO_CLIENTE || "",
    "Pago a Proveedor": body.PAGO_PROVEEDOR || "",
    FACTURADO: body.FACTURADO || "",
    Facturado: body.FACTURADO || "",
    "Nº FACTURA": body.NUM_FACTURA || "",
    "Nº Factura": body.NUM_FACTURA || "",
    CARPETA: body.LINK_CARPETA || body.linkCarpeta || "",
    Carpeta: body.LINK_CARPETA || body.linkCarpeta || "",
    "DIRECCIÓN": body.DIRECCION || "",
    Dirección: body.DIRECCION || "",
    DIRECCION: body.DIRECCION || "",
    CONTACTO: body.TELEFONO || "",
    Contacto: body.TELEFONO || "",
    ENCARGO: body.PEDIDO_RESUMEN || "",
    PEDIDO: body.PEDIDO_RESUMEN || "",
  };

  const row = headers.length > 0
    ? headers.map((h) => ventasMap[h] ?? body[h] ?? "")
    : [
        body.COTIZACION_ID || "", body.CLIENTE_NOMBRE || "", body.FECHA_ENTREGA || "",
        body.COSTO || "", body.GANANCIA || "", body.SALDO_CLIENTE || "",
        body.PAGO_PROVEEDOR || "", body.FACTURADO || "", body.NUM_FACTURA || "",
      ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: ventasSheetId,
    range: `'${targetTab}'!A:ZZ`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });

  invalidateVentasSheetsReadCache(ventasSheetId);

  return { ok: true, row: body, tab: targetTab };
}

function formatIsoDateToDdMmYyyy(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "").trim());
  if (!m) return String(iso ?? "").trim();
  return `${m[3]}/${m[2]}/${m[1]}`;
}

async function getSheetTabTitleByGid(spreadsheetId, gid) {
  const authClient = await getGoogleAuthClient(SCOPE_WRITE);
  const sheets = google.sheets({ version: "v4", auth: authClient });
  const meta = await withSheetsReadRetry("spreadsheets.get", () =>
    sheets.spreadsheets.get({ spreadsheetId })
  );
  const gidNum = Number(gid);
  if (!Number.isFinite(gidNum)) return null;
  const sh = (meta.data.sheets || []).find((s) => s.properties?.sheetId === gidNum);
  return sh?.properties?.title || null;
}

async function handleVentasLogisticaFechaEntrega(ventasSheetId, body) {
  const gid = body?.gid;
  const row1Based = Number(body?.row1Based);
  const fechaEntrega = body?.fechaEntrega;

  if (!ventasSheetId) throw new Error("Ventas sheet no configurado (BMC_VENTAS_SHEET_ID)");
  if (gid == null || String(gid).trim() === "") throw new Error("Missing gid (pestaña)");
  if (!Number.isFinite(row1Based) || row1Based < 2) throw new Error("row1Based inválido (mín. 2)");

  const tabTitle = await getSheetTabTitleByGid(ventasSheetId, gid);
  if (!tabTitle) throw new Error("No se encontró la pestaña para ese gid");

  const value =
    fechaEntrega === "" || fechaEntrega === null || fechaEntrega === undefined
      ? ""
      : formatIsoDateToDdMmYyyy(fechaEntrega);

  const authClient = await getGoogleAuthClient(SCOPE_WRITE);
  const sheets = google.sheets({ version: "v4", auth: authClient });
  const safeTab = String(tabTitle).replace(/'/g, "''");
  const range = `'${safeTab}'!G${row1Based}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: ventasSheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] },
  });

  invalidateVentasSheetsReadCache(ventasSheetId);
  return { ok: true, range, value };
}

async function handleUpdateStock(stockSheetId, mainSheetId, codigo, body) {
  const authClient = await getGoogleAuthClient(SCOPE_WRITE);
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const sheetName = await getFirstSheetName(stockSheetId);

  // headerRowOffset: 2 → headers at row 3
  const dataRes = await sheets.spreadsheets.values.get({
    spreadsheetId: stockSheetId,
    range: `'${sheetName}'!A3:ZZ`,
  });
  const allRows = dataRes.data.values || [];
  if (allRows.length === 0) throw new Error("Stock vacío");

  const headers = allRows[0];
  const codigoColIndex = headers.findIndex((h) => /Codigo|Código/i.test(h));
  const actualCodigoCol = codigoColIndex !== -1 ? codigoColIndex : 2;

  const dataRows = allRows.slice(1);
  const rowIndex = dataRows.findIndex((r) => String(r[actualCodigoCol] || "").trim() === String(codigo).trim());
  if (rowIndex === -1) throw new Error(`Producto ${codigo} no encontrado`);

  // 2 offset rows + 1 header row + 1-based index = rowIndex + 4
  const spreadsheetRowNum = rowIndex + 4;
  const updates = [];

  const stockColIndex = headers.findIndex((h) => /^Stock$/i.test(h.trim()));
  const pedidoColIndex = headers.findIndex((h) => /Pedido/i.test(h));
  const syncAtColIndex = headers.findIndex((h) => /SHOPIFY_SYNC_AT/i.test(h));

  if (body.STOCK !== undefined && stockColIndex !== -1) {
    updates.push({
      range: `'${sheetName}'!${colIndexToLetter(stockColIndex)}${spreadsheetRowNum}`,
      values: [[body.STOCK]],
    });
  }
  if (body.PEDIDO_PENDIENTE !== undefined && pedidoColIndex !== -1) {
    updates.push({
      range: `'${sheetName}'!${colIndexToLetter(pedidoColIndex)}${spreadsheetRowNum}`,
      values: [[body.PEDIDO_PENDIENTE]],
    });
  }
  if (syncAtColIndex !== -1) {
    updates.push({
      range: `'${sheetName}'!${colIndexToLetter(syncAtColIndex)}${spreadsheetRowNum}`,
      values: [[new Date().toISOString()]],
    });
  }

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: stockSheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data: updates },
    });
  }

  await appendAuditLog(sheets, mainSheetId, "API_UPDATE_STOCK", codigo, "", JSON.stringify(body), sheetName);
  return { ok: true, codigo };
}

// ─── MATRIZ precios → planilla calculadora ──────────────────────────────────
// MATRIZ: F, L, M, T = **tal cual** la celda (sin ÷ ni × IVA). F/L/T ex IVA en lista; M referencia c/IVA tal cual.
// Columnas buscadas por nombre: costo/costos, venta/venta_bmc, venta_web/web. Fallback índices fijos.

function findColIndex(headers, ...patterns) {
  for (const p of patterns) {
    const re = typeof p === "string" ? new RegExp(p, "i") : p;
    const idx = (headers || []).findIndex((h) => re.test(String(h || "").trim()));
    if (idx >= 0) return idx;
  }
  return -1;
}

// ─── MATRIZ column mapping (approved by Matias per-tab) ─────────────────────
// Use `COL("L")` so the source of truth matches Google Sheets headers (avoids off-by-one on raw indices).
const COL = (letter) => colLetterToIndex(letter);

// Only tabs listed here are queried. Add new supplier tabs after Matias approves.
const MATRIZ_TAB_COLUMNS = {
  BROMYROS: {
    sku: COL("D"),
    descripcion: COL("E"),
    // F — Costo m² USD ex IVA: **tal cual** celda.
    costo: COL("F"),
    // L — venta local: **tal cual** celda.
    ventaLocal: COL("L"),
    // M — ref. consumidor c/IVA: CSV `venta_local_iva_inc` **tal cual**.
    ventaIvaInc: COL("M"),
    // T — Venta web USD ex IVA: CSV `venta_web`, push `.web` **tal cual**.
    web: COL("T"),
    // U — Venta web USD c/IVA: CSV `venta_web_iva_inc` **tal cual** (solo lectura; no push).
    webIvaInc: COL("U"),
  },
  // Add more tabs here after mapping approval:
  // "R y C Tornillos": { sku: COL("D"), ... },
};

async function buildPlanillaDesdeMatriz(matrizSheetId) {
  const { getPathForMatrizSku } = await import("../../src/data/matrizPreciosMapping.js");
  const authClient = await getGoogleAuthClient(SCOPE_READ);
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const approvedTabs = Object.keys(MATRIZ_TAB_COLUMNS);
  if (approvedTabs.length === 0) {
    return { csv: "\uFEFFpath,descripcion,categoria,costo,venta_local,venta_local_iva_inc,venta_web,venta_web_iva_inc,unidad,tab\n", count: 0 };
  }

  const csvRows = [];
  const header = [
    "path",
    "descripcion",
    "categoria",
    "costo",
    "venta_local",
    "venta_local_iva_inc",
    "venta_web",
    "venta_web_iva_inc",
    "unidad",
    "tab",
  ];
  csvRows.push(header.join(","));
  let count = 0;

  const parseNum = (v) => {
    if (v == null || v === "") return null;
    let s = String(v).trim().replace(/\s/g, "");
    if (!s) return null;
    // Support both 1.025,50 and 1025.50 without multiplying dot-decimal values by 100.
    if (s.includes(",") && s.includes(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (s.includes(",")) {
      s = s.replace(",", ".");
    }
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  };
  const esc = (s) => {
    const str = String(s);
    return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
  };

  for (const tabName of approvedTabs) {
    const cols = MATRIZ_TAB_COLUMNS[tabName];
    let allRows;
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: matrizSheetId,
        range: `'${tabName}'!A1:Z500`,
      });
      allRows = res.data.values || [];
    } catch (e) {
      continue; // tab missing or unreadable — skip
    }
    if (allRows.length < 2) continue;

    const dataRows = allRows.slice(1);
    for (const row of dataRows) {
      const skuRaw = row[cols.sku];
      const path = getPathForMatrizSku(skuRaw);
      if (!path) continue;

      const descripcion = row[cols.descripcion] || "";
      const costoRaw = parseNum(row[cols.costo]);
      const ventaLocalRaw = parseNum(row[cols.ventaLocal]);
      const ventaIvaIncRaw = parseNum(row[cols.ventaIvaInc]);
      const webRaw = parseNum(row[cols.web]);
      const webIvaIncRaw =
        cols.webIvaInc != null ? parseNum(row[cols.webIvaInc]) : null;

      // F, L, M, T, U: copiar número de planilla sin transformar.
      // Regla confirmada: T = venta web ex IVA.
      // La UI calcula Web c/IVA desde `venta_web`; si U existe, se expone como referencia.
      const costo = costoRaw != null ? +costoRaw.toFixed(2) : "";
      const venta = ventaLocalRaw != null ? +ventaLocalRaw.toFixed(2) : "";
      const ventaInc = ventaIvaIncRaw != null ? +ventaIvaIncRaw.toFixed(2) : "";
      const ventaWeb = webRaw != null ? +webRaw.toFixed(2) : "";
      const ventaWebIvaInc =
        webIvaIncRaw != null ? +webIvaIncRaw.toFixed(2) : "";

      const categoria = path.startsWith("PANELS_TECHO") ? "Paneles Techo"
        : path.startsWith("PANELS_PARED") ? "Paneles Pared"
        : path.startsWith("PERFIL_") ? "Perfilería Techo"
        : path.startsWith("SELLADORES") ? "Selladores"
        : path.startsWith("FIJACIONES") ? "Fijaciones"
        : path.startsWith("SERVICIOS") ? "Servicios"
        : "Otros";
      const unidad = path.includes("esp.") ? "m²" : "unid";

      csvRows.push(
        [path, esc(descripcion), categoria, costo, venta, ventaInc, ventaWeb, ventaWebIvaInc, unidad, tabName].join(","),
      );
      count++;
    }
  }

  // Keep roof ISODEC EPS venta_local aligned with wall ISOPANEL EPS at same espesor.
  normalizeIsodecEpsVentaLocalCsvRows(csvRows);

  return { csv: "\uFEFF" + csvRows.join("\n"), count };
}

/**
 * Aplica overrides de la calculadora (keys `path.costo|venta|web|webIvaInc`) a filas MATRIZ
 * cuyo SKU (col D) mapea a `path` en `matrizPreciosMapping.js`.
 * Overrides `.costo` / `.venta` / `.web` / `.webIvaInc` → celdas **F**, **L**, **T**, **U** **tal cual** (sin ×/÷ IVA). No escribe **M**.
 * Requiere scope escritura Sheets y rol Editor en el workbook MATRIZ.
 */
async function pushMatrizPricingOverrides(matrizSheetId, overrides, credsPath, dryRun) {
  const { getPathForMatrizSku } = await import("../../src/data/matrizPreciosMapping.js");
  const resolved = path.isAbsolute(credsPath) ? credsPath : path.resolve(process.cwd(), credsPath);
  if (!fs.existsSync(resolved)) throw new Error("Credenciales Google no encontradas");

  const byPath = new Map();
  for (const [fullKey, val] of Object.entries(overrides || {})) {
    const m = String(fullKey).match(/^(.+)\.(costo|venta|web|webIvaInc)$/);
    if (!m) continue;
    if (val === null || val === "") continue;
    const num = typeof val === "number" ? val : parseFloat(String(val).replace(",", "."));
    if (Number.isNaN(num) || num < 0) continue;
    const basePath = m[1];
    const field = m[2];
    if (!byPath.has(basePath)) byPath.set(basePath, {});
    byPath.get(basePath)[field] = +num.toFixed(2);
  }

  if (byPath.size === 0) {
    return {
      ok: true,
      dryRun: Boolean(dryRun),
      updated: 0,
      planned: [],
      skippedPaths: [],
      message: "No hay overrides con formato path.costo, path.venta, path.web o path.webIvaInc",
    };
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: resolved,
    scopes: [SCOPE_WRITE],
  });
  const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });

  const planned = [];
  const matchedPaths = new Set();

  for (const tabName of Object.keys(MATRIZ_TAB_COLUMNS)) {
    const colSpec = MATRIZ_TAB_COLUMNS[tabName];
    let allRows;
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: matrizSheetId,
        range: `'${tabName}'!A1:Z500`,
      });
      allRows = res.data.values || [];
    } catch {
      continue;
    }
    if (allRows.length < 2) continue;
    const dataRows = allRows.slice(1);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const skuRaw = row[colSpec.sku];
      const calcPath = getPathForMatrizSku(skuRaw);
      if (!calcPath || !byPath.has(calcPath)) continue;
      matchedPaths.add(calcPath);
      const changes = byPath.get(calcPath);
      const sheetRowNum = i + 2;
      const cells = {};
      if (changes.costo != null) {
        cells[colIndexToLetter(colSpec.costo)] = +(+changes.costo).toFixed(2);
      }
      if (changes.venta != null) {
        cells[colIndexToLetter(colSpec.ventaLocal)] = +(+changes.venta).toFixed(2);
      }
      if (changes.web != null) {
        cells[colIndexToLetter(colSpec.web)] = +(+changes.web).toFixed(2);
      }
      if (changes.webIvaInc != null && colSpec.webIvaInc != null) {
        cells[colIndexToLetter(colSpec.webIvaInc)] = +(+changes.webIvaInc).toFixed(2);
      }
      if (Object.keys(cells).length === 0) continue;
      planned.push({
        tab: tabName,
        row: sheetRowNum,
        sku: String(skuRaw || "").trim(),
        path: calcPath,
        cells,
      });
    }
  }

  const skippedPaths = [...byPath.keys()].filter((p) => !matchedPaths.has(p));

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      updated: 0,
      planned,
      skippedPaths,
      tabs: Object.keys(MATRIZ_TAB_COLUMNS),
    };
  }

  const data = [];
  for (const p of planned) {
    for (const [letter, value] of Object.entries(p.cells)) {
      data.push({
        range: `'${p.tab}'!${letter}${p.row}`,
        values: [[value]],
      });
    }
  }

  if (data.length === 0) {
    return {
      ok: true,
      dryRun: false,
      updated: 0,
      planned: [],
      skippedPaths: [...byPath.keys()],
      message: "Ninguna fila MATRIZ coincide con los paths de los overrides (revisá SKU col D o pestañas en MATRIZ_TAB_COLUMNS)",
    };
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: matrizSheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });

  return {
    ok: true,
    dryRun: false,
    updated: data.length,
    rowsTouched: planned.length,
    planned,
    skippedPaths,
  };
}

// ─── Router ───────────────────────────────────────────────────────────────

export default function createBmcDashboardRouter(config) {
  const router = Router();
  const sheetId = config.bmcSheetId || "";
  const schema = config.bmcSheetSchema || "Master_Cotizaciones";
  const { sheetName: cotizSheet, opts: cotizOpts } = getCotizacionesSheetOpts(schema);

  router.use((_req, res, next) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    next();
  });

  router.get("/cotizaciones", async (_req, res) => {
    if (!checkSheetsAvailable(config)) return noConfig(res);
    try {
      const { headers, rows } = await getSheetData(sheetId, cotizSheet, false, cotizOpts);
      res.json({ ok: true, headers, data: rows });
    } catch (e) {
      sheetsUnavailable(res, e.message);
    }
  });

  router.get("/proximas-entregas", async (_req, res) => {
    if (!checkSheetsAvailable(config)) return noConfig(res);
    try {
      const data = await getProximasEntregas(sheetId, schema);
      res.json({ ok: true, data });
    } catch (e) {
      sheetsUnavailable(res, e.message);
    }
  });

  router.get("/coordinacion-logistica", async (req, res) => {
    if (!checkSheetsAvailable(config)) return noConfig(res);
    try {
      const ids = req.query.ids;
      let rows;
      if (ids) {
        const idList = ids.split(",").map((s) => s.trim()).filter(Boolean);
        const { rows: all } = await getSheetData(sheetId, cotizSheet, false, cotizOpts);
        rows = all.filter((r) => idList.includes(String(r.COTIZACION_ID || r.ID)));
      } else {
        rows = await getProximasEntregas(sheetId, schema);
      }
      const text = buildCoordinacionLogisticaText(rows);
      res.json({ ok: true, text, count: rows.length });
    } catch (e) {
      sheetsUnavailable(res, e.message);
    }
  });

  router.get("/audit", async (_req, res) => {
    if (!checkSheetsAvailable(config)) return noConfig(res);
    try {
      const { headers, rows } = await getSheetData(sheetId, config.bmcAuditTab);
      res.json({ ok: true, headers, data: rows });
    } catch (e) {
      if (schema === "CRM_Operativo") res.json({ ok: true, headers: [], data: [] });
      else sheetsUnavailable(res, e.message);
    }
  });

  router.get("/pagos-pendientes", async (_req, res) => {
    if (!checkPagosAvailable(config)) return noConfig(res);
    try {
      let rows = [];
      if (config.bmcPagosSheetId) {
        const sheetName = await getFirstSheetName(config.bmcPagosSheetId);
        const { rows: r } = await getSheetData(config.bmcPagosSheetId, sheetName, false, { schema: "Pagos_2026" });
        rows = r || [];
      } else {
        const { rows: r } = await getSheetData(sheetId, config.bmcPagosTab);
        rows = r || [];
      }
      const pending = rows.filter(
        (r) => !r.ESTADO_PAGO || String(r.ESTADO_PAGO).toLowerCase() === "pendiente"
      );
      res.json({ ok: true, data: pending });
    } catch (e) {
      sheetsUnavailable(res, e.message);
    }
  });

  router.get("/metas-ventas", async (_req, res) => {
    if (!checkSheetsAvailable(config)) return noConfig(res);
    try {
      const rows = await getOptionalSheetRows(sheetId, config.bmcMetasTab);
      res.json({ ok: true, data: rows });
    } catch (e) {
      sheetsUnavailable(res, e.message);
    }
  });

  router.get("/calendario-vencimientos", async (req, res) => {
    if (!checkCalendarioAvailable(config)) return noConfig(res);
    try {
      let headers = [];
      let rows = [];
      let resolvedTab = null;
      if (config.bmcCalendarioSheetId) {
        const monthParam = req.query.month;
        if (monthParam) {
          const tabName = monthParamToTabName(monthParam);
          resolvedTab = tabName || await getFirstSheetName(config.bmcCalendarioSheetId);
        } else {
          resolvedTab = await getFirstSheetName(config.bmcCalendarioSheetId);
        }
        const out = await getSheetData(config.bmcCalendarioSheetId, resolvedTab, false, { headerRowOffset: 1 });
        headers = out.headers || [];
        rows = out.rows || [];
      } else {
        const out = await getSheetData(sheetId, config.bmcCalendarioTab);
        headers = out.headers || [];
        rows = out.rows || [];
      }
      res.json({ ok: true, headers, data: rows, tab: resolvedTab });
    } catch (e) {
      if (isMissingSheetError(e)) {
        return res.json({ ok: true, headers: [], data: [] });
      }
      sheetsUnavailable(res, e.message);
    }
  });

  router.get("/ventas", async (req, res) => {
    if (!checkVentasAvailable(config)) return noConfig(res);
    try {
      const ventasSheetId = config.bmcVentasSheetId;
      const headers = [
        "COTIZACION_ID",
        "CLIENTE_NOMBRE",
        "FECHA_ENTREGA",
        "COSTO",
        "GANANCIA",
        "SALDO_CLIENTE",
        "PAGO_PROVEEDOR",
        "FACTURADO",
        "NUM_FACTURA",
        "PROVEEDOR",
        "DIRECCION",
        "TELEFONO",
        "ZONA",
        "LINK_UBICACION",
        "LINK_CARPETA",
        "PEDIDO_RESUMEN",
      ];
      const tabFilter = req.query.tab;
      const proveedorFilter = req.query.proveedor;
      const logistica =
        req.query.logistica === "1" ||
        req.query.logistica === "true" ||
        String(req.query.logistica || "").toLowerCase() === "yes";

      if (tabFilter) {
        // Read a specific tab by name
        const { rows: rawRows } = await getSheetData(ventasSheetId, tabFilter, false, { headerRowOffset: 1 });
        const filtered = rawRows.filter((r) =>
          logistica
            ? ventasRowIsLogisticaRow(r)
            : findKey(r, "ID. Pedido", "NOMBRE", "COSTO SIN IVA") || findKey(r, "MONTO SIN IVA")
        );
        const data = filtered.map((r) => mapVentas2026ToCanonical(r, tabFilter));
        return res.json({ ok: true, headers, data, tab: tabFilter, logistica: logistica || undefined });
      }

      // Iterate all 23 tabs and merge results
      const data = await getAllVentasData(ventasSheetId, proveedorFilter);
      res.json({ ok: true, headers, data, tabs: "all" });
    } catch (e) {
      if (isMissingSheetError(e)) {
        return res.json({ ok: true, headers: [], data: [] });
      }
      if (String(e?.message || "").includes("not supported for this document")) {
        return res.json({ ok: true, headers: [], data: [], _fallback: "Workbook format not supported by Sheets API" });
      }
      sheetsUnavailable(res, e.message);
    }
  });

  router.get("/ventas/tabs", async (_req, res) => {
    if (!checkVentasAvailable(config)) return noConfig(res);
    try {
      const tabs = await getSheetNames(config.bmcVentasSheetId);
      res.json({ ok: true, tabs });
    } catch (e) {
      sheetsUnavailable(res, e.message);
    }
  });

  router.get("/stock-ecommerce", async (_req, res) => {
    if (!checkStockAvailable(config)) return noConfig(res);
    try {
      const stockSheetId = config.bmcStockSheetId;
      const sheetName = await getFirstSheetName(stockSheetId);
      const out = await getSheetData(stockSheetId, sheetName, false, { schema: "Stock_Ecommerce", headerRowOffset: 2 });
      const headers = ["CODIGO", "PRODUCTO", "COSTO_USD", "MARGEN_PCT", "GANANCIA", "VENTA_USD", "STOCK", "PEDIDO_PENDIENTE"];
      res.json({ ok: true, headers, data: out.rows || [] });
    } catch (e) {
      if (isMissingSheetError(e)) {
        return res.json({ ok: true, headers: [], data: [] });
      }
      sheetsUnavailable(res, e.message);
    }
  });

  router.get("/stock-kpi", async (_req, res) => {
    if (!checkStockAvailable(config)) return noConfig(res);
    try {
      const stockSheetId = config.bmcStockSheetId;
      const sheetName = await getFirstSheetName(stockSheetId);
      const { rows } = await getSheetData(stockSheetId, sheetName, false, { schema: "Stock_Ecommerce", headerRowOffset: 2 });
      const items = rows || [];
      const bajoStock = items.filter((r) => (parseFloat(r.STOCK) || 0) < 5 && (parseFloat(r.STOCK) || 0) >= 0).length;
      const totalProductos = items.filter((r) => r.CODIGO || r.PRODUCTO).length;
      const valorInventario = items.reduce((sum, r) => sum + (parseFloat(r.COSTO_USD) || 0) * (parseFloat(r.STOCK) || 0), 0);
      res.json({
        ok: true,
        bajoStock,
        totalProductos,
        valorInventario: Math.round(valorInventario * 100) / 100,
      });
    } catch (e) {
      if (isMissingSheetError(e)) {
        return res.json({ ok: true, bajoStock: 0, totalProductos: 0, valorInventario: 0 });
      }
      sheetsUnavailable(res, e.message);
    }
  });

  router.get("/kpi-financiero", async (_req, res) => {
    if (!checkPagosAvailable(config)) return noConfig(res);
    try {
      let pagosRows = [];
      if (config.bmcPagosSheetId) {
        const sheetName = await getFirstSheetName(config.bmcPagosSheetId);
        const { rows: r } = await getSheetData(config.bmcPagosSheetId, sheetName, false, { schema: "Pagos_2026" });
        pagosRows = r || [];
      } else {
        const { rows: r } = await getSheetData(sheetId, config.bmcPagosTab);
        pagosRows = r || [];
      }
      const metasRows = await getOptionalSheetRows(sheetId, config.bmcMetasTab);
      const pending = (pagosRows || []).filter(
        (r) => !r.ESTADO_PAGO || String(r.ESTADO_PAGO).toLowerCase() === "pendiente"
      );
      const resumen = getResumenPagosPorPeriodo(pending);
      const calendar = Object.keys(resumen.byDate)
        .sort()
        .map((date) => {
          const point = resumen.byDate[date] || { total: 0, byCurrency: {} };
          const byCurrency = point.byCurrency || {};
          return {
            date,
            total: point.total || 0,
            $: byCurrency.$ || 0,
            UES: byCurrency.UES || 0,
            byCurrency,
          };
        });
      res.json({
        ok: true,
        pendingPayments: pending,
        calendar,
        byPeriod: {
          estaSemana: resumen.estaSemana,
          proximaSemana: resumen.proximaSemana,
          esteMes: resumen.esteMes,
          total: resumen.total,
        },
        byCurrency: resumen.byCurrency,
        currencies: Object.keys(resumen.byCurrency),
        metas: metasRows || [],
      });
    } catch (e) {
      sheetsUnavailable(res, e.message);
    }
  });

  router.get("/stock/history", async (_req, res) => {
    if (!checkStockAvailable(config)) return noConfig(res);
    try {
      const stockSheetId = config.bmcStockSheetId;
      const [existencias, egresos] = await Promise.all([
        getOptionalSheetRows(stockSheetId, "EXISTENCIAS_Y_PEDIDOS"),
        getOptionalSheetRows(stockSheetId, "Egresos"),
      ]);
      res.json({ ok: true, existencias, egresos });
    } catch (e) {
      sheetsUnavailable(res, e.message);
    }
  });

  router.get("/kpi-report", async (_req, res) => {
    const credsPath =
      config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
    const hasCreds = credsPath && fs.existsSync(path.isAbsolute(credsPath) ? credsPath : path.resolve(process.cwd(), credsPath));
    if (!hasCreds) return noConfig(res);

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const monthKey = `${yyyy}-${mm}`;
    const mesName = MESES_ES[mm] || "";
    const monthLabel = `${mesName} ${yyyy}`.trim();

    async function fetchPagosResumen() {
      if (!checkPagosAvailable(config)) return null;
      try {
        let pagosRows = [];
        if (config.bmcPagosSheetId) {
          const sheetName = await getFirstSheetName(config.bmcPagosSheetId);
          const { rows: r } = await getSheetData(config.bmcPagosSheetId, sheetName, false, { schema: "Pagos_2026" });
          pagosRows = r || [];
        } else if (sheetId) {
          const { rows: r } = await getSheetData(sheetId, config.bmcPagosTab);
          pagosRows = r || [];
        }
        const pending = (pagosRows || []).filter(
          (r) => !r.ESTADO_PAGO || String(r.ESTADO_PAGO).toLowerCase() === "pendiente"
        );
        return getResumenPagosPorPeriodo(pending);
      } catch {
        return null;
      }
    }

    async function fetchProximas() {
      if (!checkSheetsAvailable(config)) return [];
      try {
        return await getProximasEntregas(sheetId, schema);
      } catch {
        return [];
      }
    }

    async function fetchStockKpi() {
      if (!checkStockAvailable(config)) return { bajoStock: 0, totalProductos: 0, valorInventario: 0 };
      try {
        const stockSheetId = config.bmcStockSheetId;
        const sheetName = await getFirstSheetName(stockSheetId);
        const { rows } = await getSheetData(stockSheetId, sheetName, false, { schema: "Stock_Ecommerce", headerRowOffset: 2 });
        const items = rows || [];
        const bajoStock = items.filter((r) => (parseFloat(r.STOCK) || 0) < 5 && (parseFloat(r.STOCK) || 0) >= 0).length;
        const totalProductos = items.filter((r) => r.CODIGO || r.PRODUCTO).length;
        const valorInventario = items.reduce((sum, r) => sum + (parseFloat(r.COSTO_USD) || 0) * (parseFloat(r.STOCK) || 0), 0);
        return { bajoStock, totalProductos, valorInventario: Math.round(valorInventario * 100) / 100 };
      } catch {
        return { bajoStock: 0, totalProductos: 0, valorInventario: 0 };
      }
    }

    async function fetchMetas() {
      if (!checkSheetsAvailable(config)) return [];
      try {
        return await getOptionalSheetRows(sheetId, config.bmcMetasTab);
      } catch {
        return [];
      }
    }

    async function fetchVentas() {
      if (!checkVentasAvailable(config)) return [];
      try {
        return await getAllVentasData(config.bmcVentasSheetId);
      } catch {
        return [];
      }
    }

    try {
      const [pagosRes, proximasRes, stockRes, metasRes, ventasRes] = await Promise.allSettled([
        fetchPagosResumen(),
        fetchProximas(),
        fetchStockKpi(),
        fetchMetas(),
        fetchVentas(),
      ]);

      const resumen = pagosRes.status === "fulfilled" ? pagosRes.value : null;
      const proximas = proximasRes.status === "fulfilled" ? proximasRes.value : [];
      const stockKpi = stockRes.status === "fulfilled" ? stockRes.value : { bajoStock: 0, totalProductos: 0, valorInventario: 0 };
      const metasRows = metasRes.status === "fulfilled" ? metasRes.value : [];
      const ventasRows = ventasRes.status === "fulfilled" ? ventasRes.value : [];

      const currencies = resumen ? Object.keys(resumen.byCurrency || {}).filter(Boolean) : [];
      const moneda = currencies.indexOf("$") !== -1 ? "$" : (currencies[0] || "$");
      const byCur = resumen?.byCurrency?.[moneda] || { total: 0, estaSemana: 0, proximaSemana: 0, esteMes: 0 };

      const totalPendiente = byCur.total || 0;
      const estaSemana = byCur.estaSemana || 0;
      const proximaSemana = byCur.proximaSemana || 0;
      const pagosEsteMes = byCur.esteMes || 0;
      const entregasEstaSemana = Array.isArray(proximas) ? proximas.length : 0;
      const bajoStock = stockKpi?.bajoStock ?? 0;

      let objetivoMensual = null;
      const metaRow = (metasRows || []).find((r) => {
        const p = String(r.PERIODO || "").toUpperCase();
        return (
          p.includes(monthKey) ||
          p.includes(monthLabel.toUpperCase()) ||
          (mesName && p.includes(mesName)) ||
          p.includes(String(yyyy))
        );
      });
      if (metaRow) {
        objetivoMensual = parseNum(findKey(metaRow, "META_MONTO", "Meta", "META")) || null;
      }

      let realAcumulado = 0;
      for (const row of ventasRows || []) {
        const fecha = parseDate(findKey(row, "FECHA_ENTREGA", "FECHA ENTREGA", "Fecha entrega"));
        if (fecha && fecha.getFullYear() === yyyy && String(fecha.getMonth() + 1).padStart(2, "0") === mm) {
          realAcumulado += parseNum(findKey(row, "GANANCIA", "GANANCIAS SIN IVA", "Ganancia")) || 0;
        }
      }

      let base_ganancia_anual = 0;
      for (const row of ventasRows || []) {
        const fecha = parseDate(findKey(row, "FECHA_ENTREGA", "FECHA ENTREGA", "Fecha entrega"));
        if (fecha && fecha.getFullYear() === yyyy) {
          base_ganancia_anual += parseNum(findKey(row, "GANANCIA", "GANANCIAS SIN IVA", "Ganancia")) || 0;
        }
      }
      const irae_prevision = {
        base_ganancia_anual: Math.round(base_ganancia_anual * 100) / 100,
        tasa: 0.25,
        monto_estimado: Math.round(base_ganancia_anual * 0.25 * 100) / 100,
        fiscal_disclaimer: "Estimación sobre margen bruto. Consultar contador para ajustes por gastos deducibles y depreciación.",
        periodo: `${yyyy}-01-01/${yyyy}-${mm}-${dd}`,
      };

      let equilibrio = "Sin meta";
      if (objetivoMensual != null && objetivoMensual > 0) {
        if (realAcumulado >= objetivoMensual) equilibrio = "En meta";
        else if (realAcumulado >= objetivoMensual * 0.8) equilibrio = "Cerca";
        else equilibrio = "Por debajo";
      }

      res.json({
        ok: true,
        totalPendiente,
        estaSemana,
        proximaSemana,
        entregasEstaSemana,
        bajoStock,
        objetivoMensual: objetivoMensual ?? null,
        realAcumulado,
        pagosEsteMes,
        equilibrio,
        moneda,
        irae_prevision,
      });
    } catch (e) {
      sheetsUnavailable(res, e.message);
    }
  });

  /**
   * GET /api/fiscal/bps-irae
   *
   * Returns Uruguay tax estimates for the current month derived from Ventas data.
   * Tax rates applied:
   *   - IVA:  22% (Decreto 220/998, Art. 1 — tasa básica)
   *   - IRAE: 25% on net profit (Art. 15, Ley 18.083)
   *   - BPS empleador: 7.5% nominal (aporte patronal básico Art. 153, Ley 16.713)
   *
   * resultado_neto = IVA débito (ventas) − IVA crédito (compras) — posición neta DGI.
   *
   * If Ventas sheet is unavailable → returns zeros with estimated: true (200, not 503).
   * If Sheets creds missing entirely → 503 via noConfig.
   */
  router.get("/fiscal/bps-irae", async (_req, res) => {
    // Require at minimum that Google creds exist (same guard used by kpi-report)
    const credsPath =
      config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
    const hasCreds =
      credsPath &&
      fs.existsSync(path.isAbsolute(credsPath) ? credsPath : path.resolve(process.cwd(), credsPath));
    if (!hasCreds) return noConfig(res);

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const mesLabel = `${MESES_ES[mm] || mm} ${yyyy}`;

    // Attempt to read Ventas rows; fall back to zeros if sheet not configured
    let ventasRows = [];
    let estimated = false;
    if (checkVentasAvailable(config)) {
      try {
        ventasRows = await getAllVentasData(config.bmcVentasSheetId);
      } catch (e) {
        // Sheets returned an error — degrade gracefully (200 + estimated flag)
        estimated = true;
      }
    } else {
      estimated = true;
    }

    // Filter rows belonging to current month using FECHA_ENTREGA
    const currentMonthRows = (ventasRows || []).filter((row) => {
      const fecha = parseDate(findKey(row, "FECHA_ENTREGA", "FECHA ENTREGA", "Fecha entrega"));
      return (
        fecha &&
        fecha.getFullYear() === yyyy &&
        String(fecha.getMonth() + 1).padStart(2, "0") === mm
      );
    });

    // Aggregate costo (base compra sin IVA) and ganancia (margen sin IVA)
    let costoMes = 0;
    let gananciaMes = 0;
    for (const row of currentMonthRows) {
      costoMes += parseNum(findKey(row, "COSTO SIN IVA", "COSTO", "Costo SIN IVA", "Costo")) || 0;
      gananciaMes +=
        parseNum(findKey(row, "GANANCIAS SIN IVA", "GANANCIA", "Ganancia")) || 0;
    }

    const ventaNeta = costoMes + gananciaMes; // venta sin IVA

    // IVA débito: IVA cobrado al cliente sobre el precio de venta
    const iva_ventas = Math.round(ventaNeta * 0.22 * 100) / 100;
    // IVA crédito: IVA pagado al proveedor sobre el costo de compra
    const iva_compras = Math.round(costoMes * 0.22 * 100) / 100;
    // Posición neta IVA ante DGI (débito − crédito)
    const resultado_neto = Math.round((iva_ventas - iva_compras) * 100) / 100;

    // IRAE: 25% sobre ganancia (margen bruto, sin ajustes por gastos deducibles)
    const irae_estimado = Math.round(gananciaMes * 0.25 * 100) / 100;

    // BPS empleador: 7.5% sobre masa salarial — sin datos de nómina en Sheets → 0 + flag
    const bps_empleador = 0;
    const bps_dependiente = 0;

    res.json({
      ok: true,
      mes: `${yyyy}-${mm}`,
      mes_label: mesLabel,
      irae_estimado,
      bps_empleador,
      bps_dependiente,
      iva_ventas,
      iva_compras,
      resultado_neto,
      estimated: estimated || currentMonthRows.length === 0,
      filas_mes: currentMonthRows.length,
      fiscal_disclaimer:
        "Estimaciones fiscales sobre margen bruto Sheets. No incluyen ajustes por gastos deducibles, depreciación ni nómina. Consultar contador.",
    });
  });

  router.post("/cotizaciones", async (req, res) => {
    if (!checkSheetsAvailable(config)) return noConfig(res);
    if (schema !== "CRM_Operativo") {
      return res.status(501).json({ ok: false, error: "POST cotizaciones solo disponible para schema CRM_Operativo" });
    }
    try {
      const result = await handleCreateCotizacion(sheetId, req.body || {});
      res.json(result);
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  router.patch("/cotizaciones/:id", async (req, res) => {
    if (!checkSheetsAvailable(config)) return noConfig(res);
    if (schema !== "CRM_Operativo") {
      return res.status(501).json({ ok: false, error: "PATCH cotizaciones solo disponible para schema CRM_Operativo" });
    }
    try {
      const result = await handleUpdateCotizacion(sheetId, req.params.id, req.body || {});
      res.json(result);
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  router.post("/pagos", async (req, res) => {
    if (!checkPagosAvailable(config)) return noConfig(res);
    const pagoSheetId = config.bmcPagosSheetId || sheetId;
    try {
      const result = await handleCreatePago(pagoSheetId, sheetId, req.body || {});
      res.json(result);
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  router.patch("/pagos/:id", async (req, res) => {
    if (!checkPagosAvailable(config)) return noConfig(res);
    const pagoSheetId = config.bmcPagosSheetId || sheetId;
    try {
      const result = await handleUpdatePago(pagoSheetId, sheetId, req.params.id, req.body || {});
      res.json(result);
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  router.post("/ventas", async (req, res) => {
    if (!checkVentasAvailable(config)) return noConfig(res);
    try {
      const result = await handleCreateVenta(config.bmcVentasSheetId, req.body || {});
      res.json(result);
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  router.patch("/stock/:codigo", requireCrmCockpitAuth, async (req, res) => {
    if (!checkStockAvailable(config)) return noConfig(res);
    try {
      const result = await handleUpdateStock(config.bmcStockSheetId, sheetId, req.params.codigo, req.body || {});
      res.json(result);
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  router.post("/marcar-entregado", async (req, res) => {
    if (!checkSheetsAvailable(config)) return noConfig(res);
    if (schema === "CRM_Operativo") {
      return res.status(501).json({
        ok: false,
        error: "marcar-entregado no soportado para schema CRM_Operativo",
      });
    }
    try {
      const result = await handleMarcarEntregado(sheetId, req.body);
      res.json(result);
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  router.get("/actualizar-precios-calculadora", async (req, res) => {
    const matrizId = config.bmcMatrizSheetId;
    const credsPath = config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
    if (!matrizId || !credsPath) {
      return res.status(503).json({ ok: false, error: "MATRIZ sheet no configurado (BMC_MATRIZ_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS)" });
    }
    const resolved = path.isAbsolute(credsPath) ? credsPath : path.resolve(process.cwd(), credsPath);
    if (!fs.existsSync(resolved)) {
      return res.status(503).json({ ok: false, error: "Credenciales Google no encontradas" });
    }
    try {
      const { csv, count } = await buildPlanillaDesdeMatriz(matrizId);
      const filename = `bmc-precios-matriz-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      // Lectura en vivo desde Sheets API (sin caché servidor); evitar CDN/navegador sirviendo CSV viejo
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");
      res.send(csv);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.post("/crm/suggest-response", async (req, res) => {
    const { consulta, origen, cliente, producto, observaciones, provider, itemId } = req.body || {};
    if (!consulta) return res.status(400).json({ ok: false, error: "Missing consulta" });

    // Ranking: 1-Claude (best instruction following + rioplatense)
    //          2-OpenAI gpt-4o-mini (reliable, good Spanish)
    //          3-Grok grok-3-mini  (proven working, fast)
    //          4-Gemini 2.0-flash  (fallback)
    // When no specific provider requested, use model-routing config for crm_suggest task.
    const available = new Set(
      [
        config.anthropicApiKey && "claude",
        config.openaiApiKey    && "openai",
        config.grokApiKey      && "grok",
        config.geminiApiKey    && "gemini",
      ].filter(Boolean)
    );
    const defaultRanking = CRM_AI_PROVIDER_RANKING.filter((p) => available.has(p));
    const { chain: routedChain, modelOverrides: crmModelOverrides } =
      buildTaskProviderChain("crm_suggest", available, defaultRanking);
    const chain = provider ? [provider] : routedChain;

    const apiKeys = {
      claude: config.anthropicApiKey,
      openai: config.openaiApiKey,
      grok:   config.grokApiKey,
      gemini: config.geminiApiKey,
    };

    const hasAnyKey = Object.values(apiKeys).some((k) => String(k || "").trim().length > 0);
    if (!hasAnyKey) {
      return res.status(503).json({
        ok: false,
        code: "IA_NOT_CONFIGURED",
        error:
          "Ninguna clave IA configurada. Definí al menos una: ANTHROPIC_API_KEY, OPENAI_API_KEY, GROK_API_KEY, GEMINI_API_KEY (p. ej. Secret Manager en Cloud Run).",
      });
    }

    // Look up previous Q&A from the same client on the same product
    let historyContext = "";
    if (cliente && itemId && checkSheetsAvailable(config)) {
      try {
        const sheets = await getCrmSheetsWrite();
        const r = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `'${CRM_TAB}'!A${FIRST_DATA_ROW}:AK500`,
        });
        const history = [];
        for (const rawRow of (r.data.values || [])) {
          const p = parseCrmRowAtoAK([rawRow]);
          if (String(p.cliente || "").trim() !== String(cliente).trim()) continue;
          if (!String(p.observaciones || "").includes(itemId)) continue;
          if (String(p.consulta || "").trim() === String(consulta).trim()) continue;
          const ans = p.respuestaSugerida || p.enviadoEl;
          if (!ans) continue;
          history.push({ pregunta: p.consulta, respuesta: p.respuestaSugerida, fecha: p.fecha });
        }
        if (history.length > 0) {
          const recent = history.slice(-3);
          historyContext = "\n\nHistorial de consultas previas del mismo cliente sobre este producto:\n" +
            recent.map((h, i) => `[${i + 1}] (${h.fecha || "s/f"}) Preguntó: "${h.pregunta}"\n    Respondimos: "${h.respuesta}"`).join("\n");
        }
      } catch (_) { /* non-fatal — continue without history */ }
    }

    const systemPrompt = `Sos el asistente de ventas de BMC Uruguay (METALOG SAS), empresa que vende paneles de aislamiento térmico: Isodec EPS/PIR (techos), Isopanel EPS/PIR (paredes/fachadas), Isoroof 3G/Plus/Foil. Precios en USD/m² IVA incluido. Cuando no tenés el precio exacto, pedí medidas y uso para cotizar. Respondés en español rioplatense, breve y profesional. Cerrás siempre con "Saludos BMC URUGUAY!"`;

    const userMsg = [
      `Canal: ${origen || "desconocido"}`,
      `Cliente: ${cliente || "desconocido"}`,
      producto      ? `Producto/publicación: ${producto}`  : null,
      observaciones ? `Observaciones: ${observaciones}`    : null,
      historyContext || null,
      `Consulta: ${consulta}`,
    ].filter(Boolean).join("\n");

    const errors = [];

    for (const p of chain) {
      const apiKey = apiKeys[p];
      if (!apiKey) { errors.push(`${p}: no key`); continue; }

      try {
        let respuesta = "";

        if (p === "claude") {
          const { default: Anthropic } = await import("@anthropic-ai/sdk");
          const anthropic = new Anthropic({ apiKey });
          const msg = await anthropic.messages.create({
            model: crmModelOverrides?.claude || "claude-haiku-4-5-20251001",
            max_tokens: 300,
            system: systemPrompt,
            messages: [{ role: "user", content: userMsg }],
          });
          respuesta = msg.content[0]?.text || "";

        } else if (p === "openai") {
          const { default: OpenAI } = await import("openai");
          const openai = new OpenAI({ apiKey });
          const completion = await openai.chat.completions.create({
            model: crmModelOverrides?.openai || "gpt-4o-mini",
            max_tokens: 300,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMsg },
            ],
          });
          respuesta = completion.choices[0]?.message?.content || "";

        } else if (p === "grok") {
          const { default: OpenAI } = await import("openai");
          const grok = new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" });
          const completion = await grok.chat.completions.create({
            model: "grok-3-mini",
            max_tokens: 300,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMsg },
            ],
          });
          respuesta = completion.choices[0]?.message?.content || "";

        } else if (p === "gemini") {
          const { GoogleGenerativeAI } = await import("@google/generative-ai");
          const genai = new GoogleGenerativeAI(apiKey);
          const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" });
          const result = await model.generateContent(`${systemPrompt}\n\n${userMsg}`);
          respuesta = result.response.text() || "";
        }

        if (respuesta) return res.json({ ok: true, respuesta, provider: p });

      } catch (e) {
        errors.push(`${p}: ${e.message?.slice(0, 80)}`);
      }
    }

    res.status(503).json({ ok: false, error: "All providers failed", details: errors });
  });

  // ── parse-email: extraer datos de un email de consulta/cotización ──
  router.post("/crm/parse-email", async (req, res) => {
    const { asunto, cuerpo, remitente } = req.body || {};
    if (!cuerpo) return res.status(400).json({ ok: false, error: "Missing cuerpo" });

    const RANKING = CRM_AI_PROVIDER_RANKING;
    const apiKeys = { claude: config.anthropicApiKey, openai: config.openaiApiKey, grok: config.grokApiKey, gemini: config.geminiApiKey };

    const systemPrompt = `Sos un extractor de datos de emails de consulta/cotización para BMC Uruguay (paneles de aislamiento térmico). Analizás el email y extraés datos estructurados en JSON.

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

    const userMsg = `Extraé los datos de este email de consulta:\n\nDe: ${remitente || "desconocido"}\nAsunto: ${asunto || "sin asunto"}\n\n${cuerpo}`;

    const jsonSchema = `{
  "cliente": "", "telefono": "", "ubicacion": "", "email_remitente": "",
  "resumen_pedido": "", "categoria": "", "urgencia": "",
  "tipo_cliente": "", "cotizacion_formal": "", "validar_stock": "",
  "probabilidad_cierre": "", "observaciones": ""
}`;

    const errors = [];
    for (const p of RANKING) {
      const apiKey = apiKeys[p];
      if (!apiKey) { errors.push(`${p}: no key`); continue; }
      try {
        let raw = "";
        if (p === "claude") {
          const { default: Anthropic } = await import("@anthropic-ai/sdk");
          const anthropic = new Anthropic({ apiKey });
          const msg = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001", max_tokens: 500, system: systemPrompt,
            messages: [{ role: "user", content: `${userMsg}\n\nFormato esperado:\n${jsonSchema}` }],
          });
          raw = msg.content[0]?.text || "";
        } else if (p === "openai" || p === "grok") {
          const { default: OpenAI } = await import("openai");
          const client = new OpenAI(p === "grok" ? { apiKey, baseURL: "https://api.x.ai/v1" } : { apiKey });
          const completion = await client.chat.completions.create({
            model: p === "grok" ? "grok-3-mini" : "gpt-4o-mini", max_tokens: 500,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `${userMsg}\n\nFormato esperado:\n${jsonSchema}` },
            ],
          });
          raw = completion.choices[0]?.message?.content || "";
        } else if (p === "gemini") {
          const { GoogleGenerativeAI } = await import("@google/generative-ai");
          const genai = new GoogleGenerativeAI(apiKey);
          const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" });
          const result = await model.generateContent(`${systemPrompt}\n\n${userMsg}\n\nFormato esperado:\n${jsonSchema}`);
          raw = result.response.text() || "";
        }
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleaned);
        return res.json({ ok: true, data: parsed, provider: p });
      } catch (e) {
        errors.push(`${p}: ${e.message?.slice(0, 80)}`);
      }
    }
    res.status(503).json({ ok: false, error: "All providers failed", details: errors });
  });

  // ── ingest-email: parsea email + escribe en CRM_Operativo ──
  router.post("/crm/ingest-email", async (req, res) => {
    const { asunto, cuerpo, remitente, messageId } = req.body || {};
    if (!cuerpo) return res.status(400).json({ ok: false, error: "Missing cuerpo" });

    const RANKING = CRM_AI_PROVIDER_RANKING;
    const apiKeys = { claude: config.anthropicApiKey, openai: config.openaiApiKey, grok: config.grokApiKey, gemini: config.geminiApiKey };

    const systemPrompt = `Sos un extractor de datos de emails de consulta/cotización para BMC Uruguay (paneles de aislamiento térmico). Analizás el email y extraés datos estructurados en JSON.

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

    const userMsg = `Extraé los datos de este email de consulta:\n\nDe: ${remitente || "desconocido"}\nAsunto: ${asunto || "sin asunto"}\n\n${cuerpo}`;
    const jsonSchema = `{\n  "cliente": "", "telefono": "", "ubicacion": "", "email_remitente": "",\n  "resumen_pedido": "", "categoria": "", "urgencia": "",\n  "tipo_cliente": "", "cotizacion_formal": "", "validar_stock": "",\n  "probabilidad_cierre": "", "observaciones": ""\n}`;

    let parsed = null;
    let provider = null;
    const errors = [];
    for (const p of RANKING) {
      const apiKey = apiKeys[p];
      if (!apiKey) { errors.push(`${p}: no key`); continue; }
      try {
        let raw = "";
        if (p === "claude") {
          const { default: Anthropic } = await import("@anthropic-ai/sdk");
          const anthropic = new Anthropic({ apiKey });
          const msg = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001", max_tokens: 500, system: systemPrompt,
            messages: [{ role: "user", content: `${userMsg}\n\nFormato esperado:\n${jsonSchema}` }],
          });
          raw = msg.content[0]?.text || "";
        } else if (p === "openai" || p === "grok") {
          const { default: OpenAI } = await import("openai");
          const client = new OpenAI(p === "grok" ? { apiKey, baseURL: "https://api.x.ai/v1" } : { apiKey });
          const completion = await client.chat.completions.create({
            model: p === "grok" ? "grok-3-mini" : "gpt-4o-mini", max_tokens: 500,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `${userMsg}\n\nFormato esperado:\n${jsonSchema}` },
            ],
          });
          raw = completion.choices[0]?.message?.content || "";
        } else if (p === "gemini") {
          const { GoogleGenerativeAI } = await import("@google/generative-ai");
          const genai = new GoogleGenerativeAI(apiKey);
          const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" });
          const result = await model.generateContent(`${systemPrompt}\n\n${userMsg}\n\nFormato esperado:\n${jsonSchema}`);
          raw = result.response.text() || "";
        }
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleaned);
        provider = p;
        break;
      } catch (e) {
        errors.push(`${p}: ${e.message?.slice(0, 80)}`);
      }
    }

    if (!parsed) {
      return res.status(503).json({ ok: false, error: "All providers failed", details: errors });
    }

    const d = parsed;
    let crmRow = null;
    const credsPath = config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
    if (config.bmcSheetId && credsPath) {
      try {
        const { google } = await import("googleapis");
        const auth = new google.auth.GoogleAuth({
          keyFile: credsPath,
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
        const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });
        const sheetId = config.bmcSheetId;
        const now = new Date().toISOString();

        // CRM_Operativo — primera fila con col C vacía a partir de fila 4
        const crmClientes = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId, range: "'CRM_Operativo'!C4:C500",
        });
        const crmVals = crmClientes.data.values || [];
        crmRow = crmVals.length + 4;
        for (let i = 0; i < crmVals.length; i++) {
          if (!crmVals[i][0] || !crmVals[i][0].toString().trim()) { crmRow = i + 4; break; }
        }

        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `'CRM_Operativo'!B${crmRow}:K${crmRow}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [[
            now, d.cliente || "", d.telefono || d.email_remitente || remitente || "",
            d.ubicacion || "", "Email-Auto", d.resumen_pedido || "",
            d.categoria || "", "", "Pendiente", "",
          ]] },
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `'CRM_Operativo'!R${crmRow}:T${crmRow}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [[d.probabilidad_cierre || "", d.urgencia || "", d.validar_stock || "No"]] },
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `'CRM_Operativo'!V${crmRow}:W${crmRow}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [[d.tipo_cliente || "", d.observaciones || ""]] },
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: rangeAGAK(crmRow),
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [defaultTailAGAK_Email()] },
        });
        console.log(`[Email] ✓ Ingested → CRM row ${crmRow}, provider: ${provider}, messageId: ${messageId || "?"}`);
      } catch (e) {
        console.error(`[Email] ✗ Sheets write failed:`, e.message);
      }
    }

    res.json({ ok: true, data: d, provider, crmRow, messageId: messageId || null });
  });

  router.post("/crm/parse-conversation", async (req, res) => {
    const { dialogo } = req.body || {};
    if (!dialogo) return res.status(400).json({ ok: false, error: "Missing dialogo" });

    const RANKING = CRM_AI_PROVIDER_RANKING;
    const apiKeys = { claude: config.anthropicApiKey, openai: config.openaiApiKey, grok: config.grokApiKey, gemini: config.geminiApiKey };

    const systemPrompt = `Sos un extractor de datos de conversaciones de WhatsApp para BMC Uruguay (paneles de aislamiento térmico). Analizás el diálogo y extraés datos estructurados en JSON.

Reglas:
- Identificá quién es el VENDEDOR (se presenta como parte de BMC/Bnesser) y quién es el CLIENTE
- Si no se identifica vendedor, dejá vendedor vacío
- Extraé teléfono solo si aparece explícito en el texto
- Categoría: Accesorios, Paneles techo, Paneles pared, Proyecto completo, Ferretería, Repuestos, Servicio/instalación, Otro
- Urgencia: Hoy, 24h, Esta semana, Este mes, Sin urgencia
- tipo_cliente: Particular, Empresa, Arquitecto, Constructor, Distribuidor, Instalador, Cliente existente, Sin clasificar
- probabilidad_cierre: Alta (quiere comprar ya), Media (interesado, comparando), Baja (solo consulta)
- validar_stock: Si (entrega inmediata/urgente), No (sin urgencia de entrega)
- cotizacion_formal: Si (pide presupuesto/cotización), No
- El resumen_pedido debe ser conciso: qué necesita, medidas si las dio, uso
- observaciones: contexto relevante que no entra en otros campos

Respondé SOLO JSON válido, sin markdown ni explicación.`;

    const userMsg = `Extraé los datos de esta conversación de WhatsApp:\n\n${dialogo}`;

    const jsonSchema = `{
  "cliente": "", "telefono": "", "ubicacion": "", "vendedor": "",
  "resumen_pedido": "", "categoria": "", "urgencia": "",
  "tipo_cliente": "", "cotizacion_formal": "", "validar_stock": "",
  "probabilidad_cierre": "", "observaciones": ""
}`;

    const errors = [];
    for (const p of RANKING) {
      const apiKey = apiKeys[p];
      if (!apiKey) { errors.push(`${p}: no key`); continue; }
      try {
        let raw = "";
        if (p === "claude") {
          const { default: Anthropic } = await import("@anthropic-ai/sdk");
          const anthropic = new Anthropic({ apiKey });
          const msg = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001", max_tokens: 500, system: systemPrompt,
            messages: [{ role: "user", content: `${userMsg}\n\nFormato esperado:\n${jsonSchema}` }],
          });
          raw = msg.content[0]?.text || "";
        } else if (p === "openai" || p === "grok") {
          const { default: OpenAI } = await import("openai");
          const client = new OpenAI(p === "grok" ? { apiKey, baseURL: "https://api.x.ai/v1" } : { apiKey });
          const completion = await client.chat.completions.create({
            model: p === "grok" ? "grok-3-mini" : "gpt-4o-mini", max_tokens: 500,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `${userMsg}\n\nFormato esperado:\n${jsonSchema}` },
            ],
          });
          raw = completion.choices[0]?.message?.content || "";
        } else if (p === "gemini") {
          const { GoogleGenerativeAI } = await import("@google/generative-ai");
          const genai = new GoogleGenerativeAI(apiKey);
          const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" });
          const result = await model.generateContent(`${systemPrompt}\n\n${userMsg}\n\nFormato esperado:\n${jsonSchema}`);
          raw = result.response.text() || "";
        }
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleaned);
        return res.json({ ok: true, data: parsed, provider: p });
      } catch (e) {
        errors.push(`${p}: ${e.message?.slice(0, 80)}`);
      }
    }
    res.status(503).json({ ok: false, error: "All providers failed", details: errors });
  });

  // ── CRM cockpit (columnas AG–AK) — requiere API_AUTH_TOKEN ─────────────────
  function requireCrmCockpitAuth(req, res, next) {
    const token = config.apiAuthToken;
    if (!token) {
      return res.status(503).json({
        ok: false,
        error: "API_AUTH_TOKEN not configured — cockpit mutations disabled",
      });
    }
    const auth = String(req.headers.authorization || "");
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const xKey = String(req.headers["x-api-key"] || req.query?.key || "");
    if (bearer === token || xKey === token) return next();
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  // Delivers the cockpit token to the browser at runtime so it never needs to
  // be baked into the Vite bundle via VITE_BMC_API_AUTH_TOKEN.
  // Browser-only: requires a verified Origin or Referer against an explicit allowlist
  // (curl / scripts without those headers get 403). See server/lib/cockpitTokenOrigin.js.
  router.get("/crm/cockpit-token", (req, res) => {
    const token = config.apiAuthToken;
    if (!token) return res.status(503).json({ ok: false, error: "API_AUTH_TOKEN not configured" });
    const allowedOrigin = getCockpitTokenRequestBrowserOrigin(req, config);
    if (!allowedOrigin) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }
    res.json({ ok: true, token });
  });

  /** Logística: escribe fecha de entrega en columna G de Ventas (fila = cliente; pestaña por gid). Auth = CRM cockpit. */
  router.post("/ventas/logistica-fecha-entrega", requireCrmCockpitAuth, async (req, res) => {
    if (!checkVentasAvailable(config)) return noConfig(res);
    try {
      const result = await handleVentasLogisticaFechaEntrega(config.bmcVentasSheetId, req.body || {});
      res.json(result);
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message || String(e) });
    }
  });

  /** Overrides calculadora → celdas MATRIZ (BROMYROS u otras pestañas aprobadas). Mismo auth que CRM cockpit. */
  router.post("/matriz/push-pricing-overrides", requireCrmCockpitAuth, async (req, res) => {
    const matrizId = config.bmcMatrizSheetId;
    const credsPath = config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
    if (!matrizId || !credsPath) {
      return res.status(503).json({
        ok: false,
        error: "MATRIZ sheet no configurado (BMC_MATRIZ_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS)",
      });
    }
    const overrides = req.body?.overrides;
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
      return res.status(400).json({
        ok: false,
        error: 'Body debe incluir overrides: objeto { "PANELS_TECHO....costo": number, ... }',
      });
    }
    const dryRun = Boolean(req.body?.dryRun);
    try {
      const result = await pushMatrizPricingOverrides(matrizId, overrides, credsPath, dryRun);
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  /** PANELSIM / Thunderbird — lee STATUS + reporte MD del repo IMAP (auth = CRM cockpit). */
  router.get("/email/panelsim-summary", requireCrmCockpitAuth, (req, res) => {
    try {
      const rawMax = req.query.reportMaxChars;
      const n = rawMax != null ? Number(rawMax) : NaN;
      const reportMaxChars = Number.isFinite(n) && n > 0 ? n : undefined;
      const result = readPanelsimEmailSummary({
        cwd: process.cwd(),
        bmcEmailInboxRepo: config.bmcEmailInboxRepo || undefined,
        reportMaxChars,
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  });

  /**
   * Borrador saliente (proveedor/cliente) para probar en chat y pegar en Thunderbird.
   * No envía correo. Auth = CRM cockpit.
   */
  router.post("/email/draft-outbound", requireCrmCockpitAuth, async (req, res) => {
    const { role, hechos, tono, asunto_contexto } = req.body || {};
    if (!hechos || String(hechos).trim().length < 3) {
      return res.status(400).json({ ok: false, error: "Missing hechos (context for the email)" });
    }
    const r = String(role || "proveedor").toLowerCase();
    const systemPrompt =
      r === "cliente"
        ? `Sos redactor de emails comerciales para BMC Uruguay (paneles de aislamiento térmico). Generás un borrador breve en español rioplatense. No inventás precios, plazos ni compromisos que no estén en los hechos. Cerrá con "Saludos, BMC Uruguay".`
        : `Sos redactor de emails hacia proveedores para BMC Uruguay. Pedís aclaraciones, confirmás recepción o coordinás según los hechos. No inventás montos. Español rioplatense profesional.`;

    const userMsg = `Tono: ${tono || "breve y profesional"}
Asunto sugerido (opcional): ${asunto_contexto || "—"}
Hechos y pedido del usuario:
${hechos}

Respondé SOLO JSON válido, sin markdown, con esta forma exacta:
{"asunto":"","cuerpo":""}`;

    const RANKING = CRM_AI_PROVIDER_RANKING;
    const apiKeys = {
      claude: config.anthropicApiKey,
      openai: config.openaiApiKey,
      grok: config.grokApiKey,
      gemini: config.geminiApiKey,
    };
    const errors = [];
    for (const p of RANKING) {
      const apiKey = apiKeys[p];
      if (!apiKey) {
        errors.push(`${p}: no key`);
        continue;
      }
      try {
        let raw = "";
        if (p === "claude") {
          const { default: Anthropic } = await import("@anthropic-ai/sdk");
          const anthropic = new Anthropic({ apiKey });
          const msg = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 600,
            system: systemPrompt,
            messages: [{ role: "user", content: userMsg }],
          });
          raw = msg.content[0]?.text || "";
        } else if (p === "openai" || p === "grok") {
          const { default: OpenAI } = await import("openai");
          const client = new OpenAI(p === "grok" ? { apiKey, baseURL: "https://api.x.ai/v1" } : { apiKey });
          const completion = await client.chat.completions.create({
            model: p === "grok" ? "grok-3-mini" : "gpt-4o-mini",
            max_tokens: 600,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMsg },
            ],
          });
          raw = completion.choices[0]?.message?.content || "";
        } else if (p === "gemini") {
          const { GoogleGenerativeAI } = await import("@google/generative-ai");
          const genai = new GoogleGenerativeAI(apiKey);
          const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" });
          const result = await model.generateContent(`${systemPrompt}\n\n${userMsg}`);
          raw = result.response.text() || "";
        }
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleaned);
        const asunto = String(parsed.asunto || "").slice(0, 500);
        const cuerpo = String(parsed.cuerpo || "");
        if (!cuerpo) throw new Error("empty cuerpo");
        return res.json({ ok: true, asunto, cuerpo, provider: p, role: r });
      } catch (e) {
        errors.push(`${p}: ${e.message?.slice(0, 120)}`);
      }
    }
    return res.status(503).json({ ok: false, error: "All providers failed", details: errors });
  });

  async function getCrmSheetsWrite() {
    const credsPath = config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
    if (!sheetId || !credsPath) throw new Error("Sheets not configured");
    const resolved = path.isAbsolute(credsPath) ? credsPath : path.resolve(process.cwd(), credsPath);
    if (!fs.existsSync(resolved)) throw new Error("Credentials file not found");
    const auth = new google.auth.GoogleAuth({
      keyFile: resolved,
      scopes: [SCOPE_WRITE],
    });
    return google.sheets({ version: "v4", auth: await auth.getClient() });
  }

  router.get("/crm/cockpit/row/:rowNum", requireCrmCockpitAuth, async (req, res) => {
    const rowNum = Number(req.params.rowNum);
    if (!rowNum || rowNum < FIRST_DATA_ROW) {
      return res.status(400).json({ ok: false, error: `row must be >= ${FIRST_DATA_ROW}` });
    }
    if (!checkSheetsAvailable(config)) return noConfig(res);
    try {
      const sheets = await getCrmSheetsWrite();
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${CRM_TAB}'!A${rowNum}:AK${rowNum}`,
      });
      const parsed = parseCrmRowAtoAK(r.data.values || []);
      return res.json({ ok: true, row: rowNum, parsed });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.post("/crm/cockpit/quote-link", requireCrmCockpitAuth, async (req, res) => {
    const row = Number(req.body?.row);
    const url = String(req.body?.url || "").trim();
    if (!row || row < FIRST_DATA_ROW) return res.status(400).json({ ok: false, error: `Invalid row (>= ${FIRST_DATA_ROW})` });
    if (!url) return res.status(400).json({ ok: false, error: "Missing url" });
    if (!checkSheetsAvailable(config)) return noConfig(res);
    try {
      const sheets = await getCrmSheetsWrite();
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'${CRM_TAB}'!${Col.LINK_PRESUPUESTO}${row}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[url]] },
      });
      return res.json({ ok: true, row, column: Col.LINK_PRESUPUESTO });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.post("/crm/cockpit/approval", requireCrmCockpitAuth, async (req, res) => {
    const row = Number(req.body?.row);
    const approved = req.body?.approved;
    if (!row || row < FIRST_DATA_ROW) return res.status(400).json({ ok: false, error: `Invalid row` });
    if (typeof approved !== "boolean") return res.status(400).json({ ok: false, error: "Missing approved (boolean)" });
    if (!checkSheetsAvailable(config)) return noConfig(res);
    try {
      const sheets = await getCrmSheetsWrite();
      const val = approved ? "Sí" : "No";
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'${CRM_TAB}'!${Col.APROBADO_ENVIAR}${row}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[val]] },
      });
      return res.json({ ok: true, row, aprobadoEnviar: val });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.post("/crm/cockpit/mark-sent", requireCrmCockpitAuth, async (req, res) => {
    const row = Number(req.body?.row);
    const sentAt = String(req.body?.sentAt || "").trim() || new Date().toISOString();
    if (!row || row < FIRST_DATA_ROW) return res.status(400).json({ ok: false, error: `Invalid row` });
    if (!checkSheetsAvailable(config)) return noConfig(res);
    try {
      const sheets = await getCrmSheetsWrite();
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'${CRM_TAB}'!${Col.ENVIADO_EL}${row}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[sentAt]] },
      });
      return res.json({ ok: true, row, enviadoEl: sentAt });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  /** Save an AI-generated response to column AF (respuestaSugerida) for a CRM row. */
  router.post("/crm/cockpit/save-response", requireCrmCockpitAuth, async (req, res) => {
    const row = Number(req.body?.row);
    const text = String(req.body?.text || "").trim();
    const original = String(req.body?.original || "").trim();
    const question = String(req.body?.question || "").trim();
    const questionId = String(req.body?.questionId || "").trim();
    if (!row || row < FIRST_DATA_ROW) return res.status(400).json({ ok: false, error: "Invalid row" });
    if (!text) return res.status(400).json({ ok: false, error: "Missing text" });
    if (!checkSheetsAvailable(config)) return noConfig(res);
    try {
      const sheets = await getCrmSheetsWrite();
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'${CRM_TAB}'!AF${row}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[text]] },
      });
      let trainingEntry = null;
      if (question && original && original !== text) {
        try {
          trainingEntry = addTrainingEntry({
            category: "sales",
            question,
            goodAnswer: text,
            badAnswer: original,
            context: questionId ? `Mercado Libre Q:${questionId}` : "Mercado Libre",
            source: "ml-edit",
          });
        } catch (_) { /* non-fatal */ }
      }
      return res.json({ ok: true, row, respuestaSugerida: text, trainingEntry: trainingEntry?.id ?? null });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  /** Same rules as legacy POST /crm/cockpit/send-approved — body.row = CRM_Operativo row. */
  async function handleCrmCockpitSendApproved(req, res) {
    const row = Number(req.body?.row);
    if (!row || row < FIRST_DATA_ROW) return res.status(400).json({ ok: false, error: `Invalid row` });
    if (!checkSheetsAvailable(config)) return noConfig(res);
    try {
      const sheets = await getCrmSheetsWrite();
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${CRM_TAB}'!A${row}:AK${row}`,
      });
      const parsed = parseCrmRowAtoAK(r.data.values || []);
      if (isSi(parsed.bloquearAuto)) {
        return res.status(400).json({ ok: false, error: "Bloquear auto is Sí — row locked" });
      }
      if (!isSi(parsed.aprobadoEnviar)) {
        return res.status(400).json({ ok: false, error: "Aprobado enviar must be Sí" });
      }
      if (String(parsed.enviadoEl || "").trim()) {
        return res.status(400).json({ ok: false, error: "Already marked sent (Enviado el)" });
      }
      const text = String(parsed.respuestaSugerida || parsed.consulta || "").trim();
      if (!text) return res.status(400).json({ ok: false, error: "No text (AF/G empty)" });

      const origen = String(parsed.origen || "");
      const qid = extractMlQuestionId(parsed.observaciones);
      const base = String(config.publicBaseUrl || `http://127.0.0.1:${config.port}`).replace(/\/$/, "");

      if (qid && (/ML/i.test(origen) || /Q:\d+/.test(parsed.observaciones))) {
        const fr = await fetch(`${base}/ml/questions/${qid}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await fr.json().catch(() => ({}));
        if (!fr.ok) {
          return res.status(502).json({ ok: false, error: "ML answer failed", status: fr.status, details: data });
        }
        const sentAt = new Date().toISOString();
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `'${CRM_TAB}'!${Col.ENVIADO_EL}${row}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [[sentAt]] },
        });

        // KB: human-approved ML answer → save as high-confidence active entry
        const kbQuestion = String(parsed.consulta || parsed.observaciones || "").trim();
        if (kbQuestion && text) {
          setImmediate(() => {
            try {
              addTrainingEntry({
                question: kbQuestion,
                goodAnswer: text,
                category: "sales",
                context: `[ML] Q:${qid} | ${String(parsed.producto || "").slice(0, 80)}`,
                source: "human_ml",
                status: "active",
                confidence: 1.0,
                convId: String(qid),
              });
            } catch { /* non-critical */ }
          });
        }

        return res.json({ ok: true, channel: "ml", questionId: qid, sentAt, ml: data });
      }

      if (/WA/i.test(origen) || /WhatsApp/i.test(origen)) {
        if (!config.whatsappAccessToken || !config.whatsappPhoneNumberId) {
          return res.status(503).json({ ok: false, error: "WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set" });
        }
        const to = parsed.telefono;
        if (!to) return res.status(400).json({ ok: false, error: "Missing phone (column D)" });
        const wa = await sendWhatsAppText({
          to,
          text,
          accessToken: config.whatsappAccessToken,
          phoneNumberId: config.whatsappPhoneNumberId,
        });
        const sentAt = new Date().toISOString();
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `'${CRM_TAB}'!${Col.ENVIADO_EL}${row}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [[sentAt]] },
        });
        return res.json({ ok: true, channel: "whatsapp", questionId: null, sentAt, wa });
      }

      return res.status(400).json({
        ok: false,
        error: "Unsupported origen for send-approved (need ML + Q:id in W, or WA in F)",
        origen,
      });
    } catch (e) {
      req.log?.error({ err: e }, "crm/cockpit/send-approved failed");
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  router.post("/crm/cockpit/send-approved", requireCrmCockpitAuth, handleCrmCockpitSendApproved);

  router.get("/crm/cockpit/ml-queue", requireCrmCockpitAuth, async (req, res) => {
    if (!checkSheetsAvailable(config)) return noConfig(res);
    const estadoFilter = String(req.query.estado || "").trim().toLowerCase();
    try {
      const sheets = await getCrmSheetsWrite();
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${CRM_TAB}'!A${FIRST_DATA_ROW}:AK500`,
      });
      const rawRows = r.data.values || [];
      const items = [];
      for (let i = 0; i < rawRows.length; i++) {
        const rowNum = FIRST_DATA_ROW + i;
        const parsed = parseCrmRowAtoAK([rawRows[i]]);
        const qid = extractMlQuestionId(parsed.observaciones);
        if (!qid) continue;
        const origen = String(parsed.origen || "").toUpperCase();
        const obs = String(parsed.observaciones || "");
        if (!origen.includes("ML") && !obs.includes("Q:")) continue;
        if (estadoFilter && !String(parsed.estado || "").toLowerCase().includes(estadoFilter)) continue;
        items.push({ row: rowNum, parsed, questionId: qid });
      }
      return res.json({ ok: true, items });
    } catch (e) {
      req.log?.error({ err: e }, "crm/cockpit/ml-queue failed");
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.get("/crm/cockpit/wa-queue", requireCrmCockpitAuth, async (req, res) => {
    if (!checkSheetsAvailable(config)) return noConfig(res);
    const estadoFilter = String(req.query.estado || "").trim().toLowerCase();
    try {
      const sheets = await getCrmSheetsWrite();
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${CRM_TAB}'!A${FIRST_DATA_ROW}:AK500`,
      });
      const rawRows = r.data.values || [];
      const items = [];
      for (let i = 0; i < rawRows.length; i++) {
        const rowNum = FIRST_DATA_ROW + i;
        const parsed = parseCrmRowAtoAK([rawRows[i]]);
        const origen = String(parsed.origen || "");
        if (!/WA/i.test(origen) && !/WhatsApp/i.test(origen)) continue;
        if (estadoFilter && !String(parsed.estado || "").toLowerCase().includes(estadoFilter)) continue;
        items.push({ row: rowNum, parsed });
      }
      return res.json({ ok: true, items });
    } catch (e) {
      req.log?.error({ err: e }, "crm/cockpit/wa-queue failed");
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.post("/crm/cockpit/sync-ml", requireCrmCockpitAuth, async (req, res) => {
    const credsPath = config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
    if (!sheetId) return noConfig(res);
    const logger = req.log ?? console;
    try {
      const ts = createTokenStore({
        storageType: config.tokenStorage,
        filePath: config.tokenFile,
        gcsBucket: config.tokenGcsBucket,
        gcsObject: config.tokenGcsObject,
        encryptionKey: config.tokenEncryptionKey,
        logger,
      });
      const tokens = await ts.read();
      if (!tokens?.access_token) {
        return res.status(503).json({ ok: false, error: "No ML tokens — run /auth/ml/start first" });
      }
      const mlClient = createMercadoLibreClient({ config, tokenStore: ts, logger });
      const result = await syncUnansweredQuestions({
        ml: mlClient,
        sheetId,
        credsPath,
        logger,
      });
      return res.json({ ok: true, synced: result.synced });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  /**
   * Stable id for command-center APIs: `crm:42` (preferred), `crm-42`, or `42`.
   * @returns {number|null}
   */
  function parseConsultationIdToCrmRow(consultationId) {
    const raw = String(consultationId || "").trim();
    if (!raw) return null;
    let s = raw;
    const lower = raw.toLowerCase();
    if (lower.startsWith("crm:")) s = raw.slice(4);
    else if (lower.startsWith("crm-")) s = raw.slice(4);
    const row = Number(s);
    if (!Number.isFinite(row) || row < FIRST_DATA_ROW) return null;
    return Math.floor(row);
  }

  /** Clasifica fila CRM por canal (ML, WA, Meta) para cola unificada. */
  function classifyCrmChannel(parsed) {
    const origen = String(parsed?.origen || "");
    const obs = String(parsed?.observaciones || "");
    const qid = extractMlQuestionId(obs);
    if (qid || /ML/i.test(origen) || /\bQ:\d+/i.test(obs)) return "mercadolibre";
    if (/WA|WhatsApp/i.test(origen)) return "whatsapp";
    if (/instagram|(^|\s)ig(\s|$)|IG-/i.test(origen)) return "instagram";
    if (/facebook|messenger|\bfb\b/i.test(origen)) return "facebook";
    return null;
  }

  /**
   * Cola unificada: una lectura de CRM_Operativo con canal por fila (ML, WA, IG, FB).
   * Query: `channel` = all | mercadolibre | whatsapp | instagram | facebook
   */
  router.get("/crm/cockpit/unified-queue", requireCrmCockpitAuth, async (req, res) => {
    if (!checkSheetsAvailable(config)) return noConfig(res);
    const raw = String(req.query.channel || "all").trim().toLowerCase();
    const channelFilter =
      raw === "mercadolibre" || raw === "whatsapp" || raw === "instagram" || raw === "facebook"
        ? raw
        : "all";
    const estadoFilter = String(req.query.estado || "").trim().toLowerCase();
    try {
      const sheets = await getCrmSheetsWrite();
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${CRM_TAB}'!A${FIRST_DATA_ROW}:AK500`,
      });
      const rawRows = r.data.values || [];
      const items = [];
      for (let i = 0; i < rawRows.length; i++) {
        const rowNum = FIRST_DATA_ROW + i;
        const parsed = parseCrmRowAtoAK([rawRows[i]]);
        const channel = classifyCrmChannel(parsed);
        if (!channel) continue;
        if (channelFilter !== "all" && channel !== channelFilter) continue;
        if (estadoFilter && !String(parsed.estado || "").toLowerCase().includes(estadoFilter)) continue;
        const questionId = extractMlQuestionId(parsed.observaciones);
        items.push({ row: rowNum, channel, parsed, questionId: questionId || null });
      }
      return res.json({ ok: true, items, channelFilter });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  /**
   * Command center (phase 1): normalized CRM queue for omnichannel consults.
   * Same filters as /crm/cockpit/unified-queue; adds stable `id` + UI-oriented flags.
   * Auth: CRM cockpit token (Bearer / x-api-key).
   */
  router.get("/consultations", requireCrmCockpitAuth, async (req, res) => {
    if (!checkSheetsAvailable(config)) return noConfig(res);
    const raw = String(req.query.channel || "all").trim().toLowerCase();
    const channelFilter =
      raw === "mercadolibre" || raw === "whatsapp" || raw === "instagram" || raw === "facebook"
        ? raw
        : "all";
    const estadoFilter = String(req.query.estado || "").trim().toLowerCase();
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(500, Math.floor(limitRaw)) : 200;
    try {
      const sheets = await getCrmSheetsWrite();
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${CRM_TAB}'!A${FIRST_DATA_ROW}:AK500`,
      });
      const rawRows = r.data.values || [];
      const consultations = [];
      const facets = { byChannel: {}, canSendApproved: 0, pendingReply: 0 };
      for (let i = 0; i < rawRows.length; i++) {
        const rowNum = FIRST_DATA_ROW + i;
        const parsed = parseCrmRowAtoAK([rawRows[i]]);
        const channel = classifyCrmChannel(parsed);
        if (!channel) continue;
        if (channelFilter !== "all" && channel !== channelFilter) continue;
        if (estadoFilter && !String(parsed.estado || "").toLowerCase().includes(estadoFilter)) continue;
        const questionId = extractMlQuestionId(parsed.observaciones);
        const enviado = !!String(parsed.enviadoEl || "").trim();
        const canSend =
          isSi(parsed.aprobadoEnviar) && !enviado && !isSi(parsed.bloquearAuto);
        const consulta = String(parsed.consulta || "").trim();
        const snippet =
          consulta.length > 160 ? `${consulta.slice(0, 157)}…` : consulta;
        if (canSend) facets.canSendApproved += 1;
        if (!enviado && consulta) facets.pendingReply += 1;
        facets.byChannel[channel] = (facets.byChannel[channel] || 0) + 1;
        consultations.push({
          id: `crm:${rowNum}`,
          kind: "crm",
          channel,
          crmRow: rowNum,
          cliente: parsed.cliente || "",
          telefono: parsed.telefono || "",
          estado: parsed.estado || "",
          fecha: parsed.fecha || "",
          origen: parsed.origen || "",
          consultaSnippet: snippet,
          questionId: questionId || null,
          flags: {
            canSendApproved: canSend,
            hasSuggestedReply: !!String(parsed.respuestaSugerida || "").trim(),
            enviado,
            bloquearAuto: isSi(parsed.bloquearAuto),
          },
        });
      }
      const limited = consultations.slice(0, limit);
      return res.json({
        ok: true,
        channelFilter,
        estadoFilter: estadoFilter || null,
        limit,
        total: consultations.length,
        facets,
        consultations: limited,
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  /**
   * Alias of POST /crm/cockpit/send-approved with stable resource id `crm:ROW`.
   * Body optional (merged); `row` is set from the path. Same auth + validation.
   */
  router.post("/consultations/:consultationId/reply", requireCrmCockpitAuth, async (req, res) => {
    const row = parseConsultationIdToCrmRow(req.params.consultationId);
    if (!row) {
      return res.status(400).json({
        ok: false,
        error: `Invalid consultation id (use crm:${FIRST_DATA_ROW} or numeric row >= ${FIRST_DATA_ROW})`,
      });
    }
    const prev = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    req.body = { ...prev, row };
    return handleCrmCockpitSendApproved(req, res);
  });

  /**
   * Sincroniza canales con API pull hacia CRM. ML = mismas reglas que sync-ml.
   * WhatsApp ya ingresa vía webhook; Facebook/Instagram requieren Graph API (no implementado).
   */
  router.post("/crm/cockpit/sync-all", requireCrmCockpitAuth, async (req, res) => {
    if (!sheetId) return noConfig(res);
    const credsPath = config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const want = Array.isArray(body.channels) ? body.channels.map((c) => String(c).toLowerCase()) : null;
    const runMl = !want || want.includes("mercadolibre") || want.includes("ml") || want.includes("all");

    const result = {
      ok: true,
      mercadolibre: { ran: false, synced: 0, error: null },
      whatsapp: {
        ran: false,
        mode: "webhook",
        detail:
          "Las conversaciones WA entran en vivo por POST /webhooks/whatsapp y se escriben en CRM. No hay pull batch en este servidor.",
      },
      facebook: {
        ran: false,
        skipped: true,
        detail:
          "Messenger / Facebook Page inbox no está conectado en este repo. Cuando exista fila con origen Facebook/Messenger, aparecerá en la cola unificada.",
      },
      instagram: {
        ran: false,
        skipped: true,
        detail:
          "Instagram Direct no está conectado en este repo. Podés etiquetar origen en la planilla (p. ej. Instagram) para ver la fila acá.",
      },
    };

    if (runMl) {
      result.mercadolibre.ran = true;
      try {
        const ts = createTokenStore({
          storageType: config.tokenStorage,
          filePath: config.tokenFile,
          gcsBucket: config.tokenGcsBucket,
          gcsObject: config.tokenGcsObject,
          encryptionKey: config.tokenEncryptionKey,
          logger: req.log ?? console,
        });
        const tokens = await ts.read();
        if (!tokens?.access_token) {
          result.mercadolibre.error = "No ML tokens — run /auth/ml/start first";
        } else {
          const mlClient = createMercadoLibreClient({ config, tokenStore: ts, logger: req.log ?? console });
          const syncResult = await syncUnansweredQuestions({
            ml: mlClient,
            sheetId,
            credsPath,
            logger: req.log ?? console,
          });
          result.mercadolibre.synced = syncResult.synced ?? 0;
        }
      } catch (e) {
        result.mercadolibre.error = e.message || String(e);
      }
    }

    if (result.mercadolibre.ran && result.mercadolibre.error) {
      result.ok = false;
    }
    return res.json(result);
  });

  return router;
}
