/**
 * BMC Dashboard — Sheets API + integrated dashboard (Phase 3)
 *
 * Serves Master_Cotizaciones, Próximas entregas, Coordinación logística (WhatsApp),
 * and the interactive dashboard UI. Optional write for "marcar entregado".
 *
 * Requires: npm install googleapis
 * Env: GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
 *      BMC_SHEET_ID=your-spreadsheet-id
 *
 * Run: node docs/bmc-dashboard-modernization/sheets-api-server.js
 *
 * Endpoints:
 *   GET /api/cotizaciones           → Master_Cotizaciones
 *   GET /api/proximas-entregas       → Entregas de la semana corriente (ESTADO=Confirmado, FECHA_ENTREGA esta semana)
 *   GET /api/coordinacion-logistica  → Mensaje WhatsApp listo para transportistas (?ids=COT-001,COT-002 o sin ids = todos de próximas)
 *   GET /api/audit                   → AUDIT_LOG
 *   GET /api/server-export          → Export conditions & features (no secrets); use while server is running
 *   POST /api/marcar-entregado       → body: { cotizacionId, comentarios } — mueve a Ventas realizadas y entregadas
 *   GET /                            → Dashboard (index.html)
 */

import http from 'http';
import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

// Load .env from project root when running e.g. npm run bmc-dashboard
loadEnv({ path: path.resolve(process.cwd(), '.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.BMC_SHEETS_API_PORT || '3849', 10);
const SHEET_ID = process.env.BMC_SHEET_ID || '';
const DASHBOARD_DIR = path.join(__dirname, 'dashboard');

const SCOPE_READ  = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const SCOPE_WRITE = 'https://www.googleapis.com/auth/spreadsheets';

// ─── Wolfboard config ─────────────────────────────────────────────────────────
const WOLFB_ADMIN_ID  = process.env.WOLFB_ADMIN_SHEET_ID   || '';
const WOLFB_ADMIN_TAB = process.env.WOLFB_ADMIN_TAB        || 'Admin.';
const WOLFB_CRM_TAB   = process.env.WOLFB_CRM_MAIN_TAB     || 'CRM_Operativo';
const WOLFB_ENV_TAB   = process.env.WOLFB_CRM_ENVIADOS_TAB || 'Enviados';
const WOLFB_DRY_RUN   = process.env.WOLFB_DRY_RUN === '1';
// Admin 2.0: merged title at row 1, column headers at row 2, data from row 3
const WOLFB_ADMIN_DATA_ROW = 3;

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
  const currency = String(val || '$').trim();
  return currency || '$';
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
  return {
    byDate,
    byCurrency,
    estaSemana,
    proximaSemana,
    esteMes,
    total,
  };
}

function resolveCredentialsPath() {
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
  if (!credsPath) return '';
  return path.isAbsolute(credsPath) ? credsPath : path.resolve(process.cwd(), credsPath);
}

function checkSheetsAvailable() {
  const credsPath = resolveCredentialsPath();
  return Boolean(SHEET_ID && credsPath && fs.existsSync(credsPath));
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}

function noConfig(res) {
  sendJson(res, 503, { ok: false, error: 'Sheets not configured' });
}

function sheetsUnavailable(res, message = 'Sheets backend unavailable') {
  sendJson(res, 503, { ok: false, error: message });
}

function isMissingSheetError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('unable to parse range') ||
    message.includes('requested entity was not found') ||
    message.includes('does not match grid limits')
  );
}

async function getOptionalSheetRows(sheetName) {
  try {
    const { rows } = await getSheetData(sheetName);
    return rows || [];
  } catch (error) {
    if (isMissingSheetError(error)) return [];
    throw error;
  }
}

// ─── Wolfboard helpers ────────────────────────────────────────────────────────

function checkWolfboardAvailable() {
  const credsPath = resolveCredentialsPath();
  return Boolean(WOLFB_ADMIN_ID && SHEET_ID && credsPath && fs.existsSync(credsPath));
}

function noWolfboardConfig(res) {
  sendJson(res, 503, {
    ok: false,
    error: 'Wolfboard Sheets not configured (set WOLFB_ADMIN_SHEET_ID + BMC_SHEET_ID + GOOGLE_APPLICATION_CREDENTIALS)',
  });
}

function normalizeText(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 150);
}

async function getSheetsClient(useWrite = false) {
  const auth = new google.auth.GoogleAuth({ scopes: [useWrite ? SCOPE_WRITE : SCOPE_READ] });
  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

// Read Admin 2.0 rows — columns H-K, data starts at WOLFB_ADMIN_DATA_ROW
async function readAdminRows(useWrite = false) {
  const sheets = await getSheetsClient(useWrite);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: WOLFB_ADMIN_ID,
    range: `'${WOLFB_ADMIN_TAB}'!H${WOLFB_ADMIN_DATA_ROW}:K`,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const rows = res.data.values || [];
  const adminAnchor = (rowNum) =>
    `https://docs.google.com/spreadsheets/d/${WOLFB_ADMIN_ID}/edit#gid=0&range=H${rowNum}`;
  return rows
    .map((row, idx) => ({
      rowNum: idx + WOLFB_ADMIN_DATA_ROW,
      H: row[0] ?? '',
      I: row[1] ?? '',
      J: row[2] ?? '',
      K: String(row[3] ?? '').toUpperCase() === 'TRUE',
      sheetUrl: adminAnchor(idx + WOLFB_ADMIN_DATA_ROW),
    }))
    .filter(r => r.H || r.I || r.J);
}

// Read CRM_Operativo rows — header row 3 (HEADER_ROW), data from row 4
// Accesses columns by index (A=0): G=6, AF=31, AH=33, AI=34
async function readCrmRows(useWrite = false) {
  const sheets = await getSheetsClient(useWrite);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${WOLFB_CRM_TAB}'!A4:AK`,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const rows = res.data.values || [];
  return rows
    .map((row, idx) => ({
      _rowNum: idx + 4,
      B:  row[1]  ?? '',
      C:  row[2]  ?? '',
      G:  row[6]  ?? '',
      AF: row[31] ?? '',
      AH: row[33] ?? '',
      AI: row[34] ?? '',
    }))
    .filter(r => r.G || r.B || r.C);
}

// ─── Wolfboard route handlers ─────────────────────────────────────────────────

async function handleWolfboardPendientes(res) {
  try {
    const rows = await readAdminRows();
    const pending = rows.filter(r => !r.K);
    sendJson(res, 200, { ok: true, data: pending, total: rows.length, pending: pending.length });
  } catch (e) {
    sheetsUnavailable(res, e.message);
  }
}

async function handleWolfboardSync(body, res) {
  const direction = body?.direction || 'both';
  try {
    const [adminRows, crmRows] = await Promise.all([readAdminRows(), readCrmRows()]);
    const crmBatch = [];
    const adminBatch = [];
    let updatedCrm = 0;
    let updatedAdmin = 0;
    let skipped = 0;

    if (direction === 'admin_to_crm' || direction === 'both') {
      for (const aRow of adminRows) {
        if (!aRow.I && !aRow.J) { skipped++; continue; }
        const match = crmRows.find(cr => cr.G && aRow.H && normalizeText(cr.G) === normalizeText(aRow.H));
        if (!match) { skipped++; continue; }
        // AF=respuesta, AG=provider(blank), AH=link
        crmBatch.push({
          range: `'${WOLFB_CRM_TAB}'!AF${match._rowNum}:AH${match._rowNum}`,
          values: [[aRow.I, '', aRow.J]],
        });
        updatedCrm++;
      }
    }

    if (direction === 'crm_to_admin' || direction === 'both') {
      for (const cRow of crmRows) {
        if (!cRow.AF && !cRow.AH) { skipped++; continue; }
        if (cRow.AI === 'Sí') { skipped++; continue; }
        const match = adminRows.find(ar => ar.H && cRow.G && normalizeText(ar.H) === normalizeText(cRow.G));
        if (!match) { skipped++; continue; }
        adminBatch.push({
          range: `'${WOLFB_ADMIN_TAB}'!I${match.rowNum}:J${match.rowNum}`,
          values: [[cRow.AF, cRow.AH]],
        });
        updatedAdmin++;
      }
    }

    if (WOLFB_DRY_RUN) {
      return sendJson(res, 200, { ok: true, dryRun: true, updatedAdmin, updatedCrm, skipped, preview: { crmBatch, adminBatch } });
    }

    const sheets = await getSheetsClient(true);
    if (crmBatch.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { valueInputOption: 'USER_ENTERED', data: crmBatch },
      });
    }
    if (adminBatch.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: WOLFB_ADMIN_ID,
        requestBody: { valueInputOption: 'USER_ENTERED', data: adminBatch },
      });
    }
    sendJson(res, 200, { ok: true, dryRun: false, updatedAdmin, updatedCrm, skipped });
  } catch (e) {
    sheetsUnavailable(res, e.message);
  }
}

async function handleWolfboardRow(body, res) {
  const { adminRow, respuesta, link, aprobado } = body || {};
  const rowNum = Number(adminRow);
  if (!rowNum || isNaN(rowNum)) {
    sendJson(res, 400, { ok: false, error: 'adminRow (number) required' });
    return;
  }
  try {
    const sheets = await getSheetsClient(true);
    const adminBatch = [];
    const crmBatch = [];

    if (respuesta !== undefined) {
      adminBatch.push({ range: `'${WOLFB_ADMIN_TAB}'!I${rowNum}`, values: [[respuesta]] });
    }
    if (link !== undefined) {
      adminBatch.push({ range: `'${WOLFB_ADMIN_TAB}'!J${rowNum}`, values: [[link]] });
    }

    // Find matching CRM row by H value
    let crmRowNum = null;
    if (respuesta !== undefined || link !== undefined || aprobado !== undefined) {
      const hRes = await sheets.spreadsheets.values.get({
        spreadsheetId: WOLFB_ADMIN_ID,
        range: `'${WOLFB_ADMIN_TAB}'!H${rowNum}`,
      });
      const hVal = ((hRes.data.values || [['']])[0] || [''])[0] || '';
      if (hVal) {
        const crmRows = await readCrmRows();
        const match = crmRows.find(cr => normalizeText(cr.G) === normalizeText(hVal));
        if (match) {
          crmRowNum = match._rowNum;
          if (respuesta !== undefined) crmBatch.push({ range: `'${WOLFB_CRM_TAB}'!AF${crmRowNum}`, values: [[respuesta]] });
          if (link !== undefined) crmBatch.push({ range: `'${WOLFB_CRM_TAB}'!AH${crmRowNum}`, values: [[link]] });
          if (aprobado !== undefined) crmBatch.push({ range: `'${WOLFB_CRM_TAB}'!AI${crmRowNum}`, values: [[aprobado ? 'Sí' : 'No']] });
        }
      }
    }

    if (WOLFB_DRY_RUN) {
      return sendJson(res, 200, { ok: true, dryRun: true, adminRow: rowNum, crmRow: crmRowNum, adminBatch, crmBatch });
    }

    if (adminBatch.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: WOLFB_ADMIN_ID,
        requestBody: { valueInputOption: 'USER_ENTERED', data: adminBatch },
      });
    }
    if (crmBatch.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { valueInputOption: 'USER_ENTERED', data: crmBatch },
      });
    }
    sendJson(res, 200, { ok: true, dryRun: false, adminRow: rowNum, crmRow: crmRowNum });
  } catch (e) {
    sheetsUnavailable(res, e.message);
  }
}

async function handleWolfboardExport(res) {
  try {
    const rows = await readAdminRows();
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="wolfboard-export-${date}.csv"`);
    const header = 'rowNum,H_consulta,I_respuesta,J_link,K_enviado,sheetUrl\n';
    const csvRow = (r) => [r.rowNum, r.H, r.I, r.J, r.K ? 'TRUE' : 'FALSE', r.sheetUrl]
      .map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',');
    res.statusCode = 200;
    res.end(header + rows.map(csvRow).join('\n'));
  } catch (e) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
}

async function handleWolfboardEnviados(body, res) {
  const { adminRow, force = false } = body || {};
  const rowNum = Number(adminRow);
  if (!rowNum || isNaN(rowNum)) {
    sendJson(res, 400, { ok: false, error: 'adminRow (number) required' });
    return;
  }
  // Safety gate: require explicit force=true
  const preview = { adminRow: rowNum, action: 'move to Enviados + set K=TRUE + delete from Admin' };
  if (!force) {
    sendJson(res, 409, { ok: false, error: 'requires force=true to move row', preview });
    return;
  }
  try {
    const sheets = await getSheetsClient(true);

    // Read full Admin row (A:Z) for archiving
    const rowRes = await sheets.spreadsheets.values.get({
      spreadsheetId: WOLFB_ADMIN_ID,
      range: `'${WOLFB_ADMIN_TAB}'!A${rowNum}:Z${rowNum}`,
    });
    const rowData = (rowRes.data.values || [[]])[0] || [];

    // Mark K=TRUE in Admin
    if (!WOLFB_DRY_RUN) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: WOLFB_ADMIN_ID,
        range: `'${WOLFB_ADMIN_TAB}'!K${rowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['TRUE']] },
      });
    }

    // Append to CRM Enviados tab: [timestamp, ...rowData]
    const timestamp = new Date().toISOString();
    const envRow = [timestamp, ...rowData];
    if (!WOLFB_DRY_RUN) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `'${WOLFB_ENV_TAB}'!A:Z`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [envRow] },
      });
    }

    // Delete Admin row (reuse deleteDimension pattern from handleMarcarEntregado)
    if (!WOLFB_DRY_RUN) {
      const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: WOLFB_ADMIN_ID });
      const adminSheetId = sheetMeta.data.sheets?.find(
        s => s.properties?.title === WOLFB_ADMIN_TAB
      )?.properties?.sheetId;
      if (adminSheetId !== undefined) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: WOLFB_ADMIN_ID,
          requestBody: {
            requests: [{
              deleteDimension: {
                range: { sheetId: adminSheetId, dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum },
              },
            }],
          },
        });
      }
    }

    sendJson(res, 200, { ok: true, dryRun: WOLFB_DRY_RUN, adminRow: rowNum, movedToCrm: true });
  } catch (e) {
    sheetsUnavailable(res, e.message);
  }
}

async function getSheetData(sheetName, useWrite = false) {
  const auth = new google.auth.GoogleAuth({
    scopes: [useWrite ? SCOPE_WRITE : SCOPE_READ],
  });
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${sheetName}'`,
  });
  const rows = res.data.values || [];
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0];
  const data = rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i] ?? ''));
    return obj;
  });
  return { headers, rows: data };
}

async function getProximasEntregas() {
  const { rows } = await getSheetData('Master_Cotizaciones');
  return rows.filter(
    (r) =>
      r.ESTADO === 'Confirmado' &&
      r.FECHA_ENTREGA &&
      isInCurrentWeek(r.FECHA_ENTREGA)
  );
}

function buildWhatsAppBlock(row) {
  const cliente = row.CLIENTE_NOMBRE || '—';
  const telefono = row.TELEFONO || '—';
  const ubicacion =
    row.LINK_UBICACION ||
    (row.DIRECCION || row.ZONA ? [row.DIRECCION, row.ZONA].filter(Boolean).join(', ') : '—');
  const pedido = row.COTIZACION_ID || '—';
  const fotoCotizacion =
    row.LINK_COTIZACION || (row.NOTAS ? `Items: ${row.NOTAS}` : 'Ver cotización en sistema');
  return [
    `📦 *Pedido:* ${pedido}`,
    `👤 *Cliente:* ${cliente}`,
    `📞 *Teléfono:* ${telefono}`,
    `📍 *Ubicación:* ${ubicacion}`,
    `📄 *Cotización / items:* ${fotoCotizacion}`,
    '—',
  ].join('\n');
}

function buildCoordinacionLogisticaText(rows) {
  const header =
    '🚚 *Coordinación logística — entregas de la semana*\n\n';
  const blocks = rows.map(buildWhatsAppBlock);
  return header + blocks.join('\n');
}

async function handleMarcarEntregado(body) {
  const { cotizacionId, comentarios = '' } = body || {};
  if (!cotizacionId) throw new Error('cotizacionId required');
  const auth = new google.auth.GoogleAuth({ scopes: [SCOPE_WRITE] });
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  const { headers: masterHeaders, rows: masterRows } = await getSheetData('Master_Cotizaciones');
  const rowIndex = masterRows.findIndex((r) => String(r.COTIZACION_ID) === String(cotizacionId));
  if (rowIndex === -1) throw new Error('Cotización no encontrada');

  const row = masterRows[rowIndex];
  const destHeaders = [
    'COTIZACION_ID', 'FECHA_CREACION', 'FECHA_ACTUALIZACION', 'CLIENTE_ID', 'CLIENTE_NOMBRE',
    'TELEFONO', 'DIRECCION', 'ZONA', 'ASIGNADO_A', 'ESTADO', 'FECHA_ENVIO', 'FECHA_CONFIRMACION',
    'FECHA_ENTREGA', 'COMENTARIOS_ENTREGA', 'FECHA_ENTREGA_REAL', 'ORIGEN', 'MONTO_ESTIMADO', 'MONEDA', 'NOTAS', 'ETIQUETAS',
    'USUARIO_CREACION', 'USUARIO_ACTUALIZACION', 'VERSION', 'LINK_UBICACION', 'LINK_COTIZACION'
  ];
  const destRow = destHeaders.map((h) => {
    if (h === 'FECHA_ENTREGA_REAL') return new Date().toISOString().slice(0, 10);
    if (h === 'COMENTARIOS_ENTREGA') return comentarios;
    return row[h] ?? '';
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "'Ventas realizadas y entregadas'!A:Y",
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [destRow] },
  });

  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const masterSheetId = sheetMeta.data.sheets?.find(
    (s) => s.properties?.title === 'Master_Cotizaciones'
  )?.properties?.sheetId;
  if (masterSheetId !== undefined) {
    const sheetRowIndex = rowIndex + 1;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: masterSheetId,
                dimension: 'ROWS',
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

function serveStatic(filePath, res) {
  const ext = path.extname(filePath);
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
  };
  res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  if (pathname === '/api/cotizaciones' && req.method === 'GET') {
    if (!checkSheetsAvailable()) {
      noConfig(res);
      return;
    }
    try {
      const { headers, rows } = await getSheetData('Master_Cotizaciones');
      sendJson(res, 200, { ok: true, headers, data: rows });
    } catch (e) {
      sheetsUnavailable(res, e.message);
    }
    return;
  }

  if (pathname === '/api/proximas-entregas' && req.method === 'GET') {
    if (!checkSheetsAvailable()) {
      noConfig(res);
      return;
    }
    try {
      const data = await getProximasEntregas();
      sendJson(res, 200, { ok: true, data });
    } catch (e) {
      sheetsUnavailable(res, e.message);
    }
    return;
  }

  if (pathname === '/api/coordinacion-logistica' && req.method === 'GET') {
    if (!checkSheetsAvailable()) {
      noConfig(res);
      return;
    }
    try {
      const ids = url.searchParams.get('ids');
      let rows;
      if (ids) {
        const idList = ids.split(',').map((s) => s.trim()).filter(Boolean);
        const { rows: all } = await getSheetData('Master_Cotizaciones');
        rows = all.filter((r) => idList.includes(String(r.COTIZACION_ID)));
      } else {
        rows = await getProximasEntregas();
      }
      const text = buildCoordinacionLogisticaText(rows);
      sendJson(res, 200, { ok: true, text, count: rows.length });
    } catch (e) {
      sheetsUnavailable(res, e.message);
    }
    return;
  }

  if (pathname === '/api/audit' && req.method === 'GET') {
    if (!checkSheetsAvailable()) {
      noConfig(res);
      return;
    }
    try {
      const { headers, rows } = await getSheetData('AUDIT_LOG');
      sendJson(res, 200, { ok: true, headers, data: rows });
    } catch (e) {
      sheetsUnavailable(res, e.message);
    }
    return;
  }

  // Export server conditions and features (no secrets) — use while logged in
  if (pathname === '/api/server-export' && req.method === 'GET') {
    const envVars = [
      'BMC_SHEET_ID',
      'GOOGLE_APPLICATION_CREDENTIALS',
      'BMC_SHEETS_API_PORT',
    ];
    const env = {};
    for (const k of envVars) {
      const v = process.env[k];
      if (k === 'GOOGLE_APPLICATION_CREDENTIALS') {
        env[k] = v ? 'set (path hidden)' : 'unset';
      } else {
        env[k] = v ? 'set' : 'unset';
      }
    }
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      server: 'BMC Dashboard (Sheets API)',
      port: PORT,
      nodeVersion: process.version,
      features: {
        endpoints: [
          { method: 'GET', path: '/api/cotizaciones', description: 'Master_Cotizaciones' },
          { method: 'GET', path: '/api/proximas-entregas', description: 'Entregas semana corriente' },
          { method: 'GET', path: '/api/coordinacion-logistica', description: 'Mensaje WhatsApp transportistas (?ids=opcional)' },
          { method: 'GET', path: '/api/audit', description: 'AUDIT_LOG' },
          { method: 'GET', path: '/api/pagos-pendientes', description: 'Pagos_Pendientes' },
          { method: 'GET', path: '/api/metas-ventas', description: 'Metas_Ventas' },
          { method: 'GET', path: '/api/kpi-financiero', description: 'Resumen pagos + metas + calendario' },
          { method: 'POST', path: '/api/marcar-entregado', description: 'body: { cotizacionId, comentarios }' },
          { method: 'GET', path: '/api/server-export', description: 'This export (conditions and features)' },
          { method: 'GET', path: '/api/wolfboard/pendientes', description: 'Admin 2.0 pending rows (K≠TRUE)' },
          { method: 'POST', path: '/api/wolfboard/sync', description: 'body: { direction: "both"|"admin_to_crm"|"crm_to_admin" }' },
          { method: 'POST', path: '/api/wolfboard/row', description: 'body: { adminRow, respuesta?, link?, aprobado? }' },
          { method: 'GET', path: '/api/wolfboard/export', description: 'CSV export of all Admin 2.0 rows' },
          { method: 'POST', path: '/api/wolfboard/enviados', description: 'body: { adminRow, force: true } — move to Enviados' },
        ],
        static: ['GET / → dashboard UI', 'GET /dashboard, /dashboard/* → dashboard assets'],
      },
      env: env,
      sheetsConfigured: checkSheetsAvailable(),
    };
    sendJson(res, 200, exportPayload);
    return;
  }

  if (pathname === '/api/pagos-pendientes' && req.method === 'GET') {
    if (!checkSheetsAvailable()) {
      noConfig(res);
      return;
    }
    try {
      const data = await getSheetData('Pagos_Pendientes');
      const rows = data.rows || [];
      const pending = rows.filter(
        (r) => !r.ESTADO_PAGO || String(r.ESTADO_PAGO).toLowerCase() === 'pendiente'
      );
      sendJson(res, 200, { ok: true, data: pending });
    } catch (e) {
      sheetsUnavailable(res, e.message);
    }
    return;
  }

  if (pathname === '/api/metas-ventas' && req.method === 'GET') {
    if (!checkSheetsAvailable()) {
      noConfig(res);
      return;
    }
    try {
      const rows = await getOptionalSheetRows('Metas_Ventas');
      sendJson(res, 200, { ok: true, data: rows });
    } catch (e) {
      sheetsUnavailable(res, e.message);
    }
    return;
  }

  if (pathname === '/api/kpi-financiero' && req.method === 'GET') {
    if (!checkSheetsAvailable()) {
      noConfig(res);
      return;
    }
    try {
      const { rows: pagosRows } = await getSheetData('Pagos_Pendientes');
      const metasRows = await getOptionalSheetRows('Metas_Ventas');
      const pending = pagosRows.filter(
        (r) => !r.ESTADO_PAGO || String(r.ESTADO_PAGO).toLowerCase() === 'pendiente'
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
      sendJson(res, 200, {
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
        metas: metasRows,
      });
    } catch (e) {
      sheetsUnavailable(res, e.message);
    }
    return;
  }

  if (pathname === '/api/marcar-entregado' && req.method === 'POST') {
    if (!checkSheetsAvailable()) {
      noConfig(res);
      return;
    }
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const result = await handleMarcarEntregado(parsed);
        sendJson(res, 200, result);
      } catch (e) {
        sendJson(res, 400, { ok: false, error: e.message });
      }
    });
    return;
  }

  // ── Wolfboard routes ──────────────────────────────────────────────────────

  if (pathname === '/api/wolfboard/pendientes' && req.method === 'GET') {
    if (!checkWolfboardAvailable()) { noWolfboardConfig(res); return; }
    await handleWolfboardPendientes(res);
    return;
  }

  if (pathname === '/api/wolfboard/sync' && req.method === 'POST') {
    if (!checkWolfboardAvailable()) { noWolfboardConfig(res); return; }
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      const parsed = body ? JSON.parse(body) : {};
      await handleWolfboardSync(parsed, res);
    });
    return;
  }

  if (pathname === '/api/wolfboard/row' && req.method === 'POST') {
    if (!checkWolfboardAvailable()) { noWolfboardConfig(res); return; }
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      const parsed = body ? JSON.parse(body) : {};
      await handleWolfboardRow(parsed, res);
    });
    return;
  }

  if (pathname === '/api/wolfboard/export' && req.method === 'GET') {
    if (!checkWolfboardAvailable()) { noWolfboardConfig(res); return; }
    await handleWolfboardExport(res);
    return;
  }

  if (pathname === '/api/wolfboard/enviados' && req.method === 'POST') {
    if (!checkWolfboardAvailable()) { noWolfboardConfig(res); return; }
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      const parsed = body ? JSON.parse(body) : {};
      await handleWolfboardEnviados(parsed, res);
    });
    return;
  }

  // ── Static serving ────────────────────────────────────────────────────────

  if (pathname === '/' || pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    const file = pathname === '/' || pathname === '/dashboard'
      ? 'index.html'
      : pathname.replace(/^\/dashboard\/?/, '') || 'index.html';
    const filePath = path.resolve(path.join(DASHBOARD_DIR, file));
    const rootDir = path.resolve(DASHBOARD_DIR);
    if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      const indexPath = path.join(DASHBOARD_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        serveStatic(indexPath, res);
        return;
      }
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Not found');
      return;
    }
    serveStatic(filePath, res);
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`BMC Dashboard: http://localhost:${PORT}/`);
  console.log(`  API: /api/cotizaciones, /api/proximas-entregas, /api/coordinacion-logistica, /api/audit`);
  console.log(`  API: /api/pagos-pendientes, /api/metas-ventas, /api/kpi-financiero`);
  console.log(`  Wolfboard: /api/wolfboard/pendientes|sync|row|export|enviados`);
  if (!SHEET_ID) console.warn('Set BMC_SHEET_ID and GOOGLE_APPLICATION_CREDENTIALS');
  if (!WOLFB_ADMIN_ID) console.warn('Wolfboard: set WOLFB_ADMIN_SHEET_ID to enable /api/wolfboard/* endpoints');
});
