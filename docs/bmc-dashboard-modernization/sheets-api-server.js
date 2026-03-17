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

const SCOPE_READ = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const SCOPE_WRITE = 'https://www.googleapis.com/auth/spreadsheets';

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
  if (!SHEET_ID) console.warn('Set BMC_SHEET_ID and GOOGLE_APPLICATION_CREDENTIALS');
});
