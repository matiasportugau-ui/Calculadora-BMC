#!/usr/bin/env node
/**
 * Accessible Base Sync — BMC Workspace Sheets → .accessible-base/ JSON snapshots
 *
 * Reads all configured Google Sheets workbooks, normalizes column names,
 * and writes typed JSON snapshots to .accessible-base/ for agent ingestion.
 * Updates .accessible-base/manifest.json with sync timestamps and row counts.
 *
 * Usage:
 *   npm run sheets:sync               — sync all sheets
 *   npm run sheets:sync -- --sheet=crm_operativo  — sync one sheet
 *   npm run sheets:sync -- --dry-run  — print what would be written, no files
 *   npm run sheets:sync -- --watch 5  — poll every 5 minutes (default: 3)
 *
 * Auto-trigger: POST /api/accessible-base/sync from any write endpoint in
 * bmcDashboard.js or sheets-api-server.js calls this script via child_process.
 */

import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(process.cwd(), '.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR  = path.resolve(process.cwd(), '.accessible-base');
const SCOPE_READ = 'https://www.googleapis.com/auth/spreadsheets.readonly';

// ── Column letter → 0-based index ────────────────────────────────────────────
function col(letter) {
  let n = 0;
  for (const ch of letter.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

// ── Sheet registry — single source of truth for every workbook ────────────────
const REGISTRY = [
  {
    key: 'crm_operativo',
    label: 'CRM Operativo — hub principal de leads y respuestas',
    envId: 'BMC_SHEET_ID',
    tab: process.env.WOLFB_CRM_MAIN_TAB || 'CRM_Operativo',
    headerRow: 2,   // 0-indexed (sheet row 3)
    dataStart: 3,   // 0-indexed (sheet row 4)
    // column letter → canonical field name
    colMap: {
      B: 'fecha_creacion',
      C: 'cliente',
      D: 'telefono',
      E: 'ubicacion',
      F: 'origen',
      G: 'consulta',
      H: 'categoria',
      I: 'urgencia',
      J: 'estado',
      K: 'responsable',
      W: 'observaciones',
      AF: 'respuesta_sugerida',
      AG: 'provider_ia',
      AH: 'link_presupuesto',
      AI: 'aprobado_enviar',
      AJ: 'enviado_el',
      AK: 'bloquear_auto',
    },
    // computed booleans
    boolCols: { AI: 'aprobado_enviar', AK: 'bloquear_auto' },
    // ML question ID extracted from W (observaciones)
    mlIdExtract: true,
  },
  {
    key: 'master_cotizaciones',
    label: 'Master Cotizaciones — entregas, estado y logística',
    envId: 'BMC_SHEET_ID',
    tab: 'Master_Cotizaciones',
    headerRow: 0,
    dataStart: 1,
    // Libro reducido (solo CRM): omitir sin fallar el batch completo
    skipIfTabMissing: true,
    colMap: {
      A: 'cotizacion_id',
      B: 'fecha_creacion',
      C: 'fecha_actualizacion',
      D: 'cliente_id',
      E: 'cliente_nombre',
      F: 'telefono',
      G: 'direccion',
      H: 'zona',
      I: 'asignado_a',
      J: 'estado',
      K: 'fecha_envio',
      L: 'fecha_confirmacion',
      M: 'fecha_entrega',
      N: 'comentarios_entrega',
      O: 'fecha_entrega_real',
      P: 'origen',
      Q: 'monto_estimado',
      R: 'moneda',
      S: 'notas',
      T: 'etiquetas',
      U: 'usuario_creacion',
      V: 'usuario_actualizacion',
      W: 'version',
      X: 'link_ubicacion',
      Y: 'link_cotizacion',
    },
  },
  {
    key: 'pagos_pendientes',
    label: 'Pagos Pendientes 2026 — vencimientos por moneda',
    envId: 'BMC_PAGOS_SHEET_ID',
    defaultId: '1AzHhalsZKGis_oJ6J06zQeOb6uMQCsliR82VrSKUUsI',
    tab: null,       // null = use first tab
    headerRow: 0,
    dataStart: 1,
    colMap: {
      A: 'fecha_vencimiento',
      B: 'cliente',
      C: 'cotizacion_id',
      D: 'precio_venta',
      E: 'costo_compra',
      F: 'monto',
      G: 'moneda',
      H: 'estado_pago',
      I: 'proveedor',
    },
    boolFilter: { col: 'estado_pago', excludeValues: ['Pagado', 'pagado'] },
  },
  {
    key: 'metas_ventas',
    label: 'Metas de Ventas — objetivos mensuales',
    envId: 'BMC_SHEET_ID',
    tab: 'Metas_Ventas',
    headerRow: 0,
    dataStart: 1,
    colMap: {
      A: 'periodo',
      B: 'tipo',
      C: 'meta_monto',
      D: 'moneda',
      E: 'notas',
    },
    optional: true,
  },
  {
    key: 'ventas',
    label: '2.0 Ventas — ventas por proveedor (multi-tab)',
    envId: 'BMC_VENTAS_SHEET_ID',
    tab: null,       // reads all tabs, merges
    headerRow: 1,   // 0-indexed (sheet row 2)
    dataStart: 2,
    // fuzzy column match (lowercase trimmed header → canonical)
    fuzzyColMap: {
      'id. pedido': 'cotizacion_id', 'id pedido': 'cotizacion_id',
      'nombre': 'cliente_nombre', 'cliente': 'cliente_nombre',
      'fecha entrega': 'fecha_entrega',
      'costo sin iva': 'costo', 'monto sin iva': 'costo', 'costo': 'costo',
      'ganancias sin iva': 'ganancia', 'ganancia': 'ganancia',
      'saldos': 'saldo_cliente',
      'pago a proveedor': 'pago_proveedor',
      'facturado': 'facturado',
      'nº factura': 'num_factura', 'nº factura': 'num_factura',
      'carpeta': 'link_carpeta', 'adjunto': 'link_carpeta',
      'dirección': 'direccion', 'direccion': 'direccion',
      'link ubicacion': 'link_ubicacion', 'google maps': 'link_ubicacion',
      'contacto': 'telefono', 'teléfono': 'telefono',
      'zona': 'zona',
      'encargo': 'pedido_resumen', 'pedido': 'pedido_resumen',
    },
    multiTab: true,
    optional: true,
  },
  {
    key: 'stock',
    label: 'Stock E-Commerce — inventario y precios',
    envId: 'BMC_STOCK_SHEET_ID',
    tab: null,
    headerRow: 2,   // 0-indexed (sheet row 3)
    dataStart: 3,
    fuzzyColMap: {
      'codigo': 'codigo', 'código': 'codigo',
      'producto': 'producto',
      'costo m2 u$s + iva': 'costo_usd', 'costo usd': 'costo_usd',
      'margen %': 'margen_pct',
      'ganancia': 'ganancia',
      'venta + iva': 'venta_usd', 'venta inm +iva': 'venta_usd',
      'stock': 'stock',
      'pedido ryc': 'pedido_pendiente', 'pedido pendiente': 'pedido_pendiente',
    },
    optional: true,
  },
  {
    key: 'matriz_precios',
    label: 'MATRIZ Costos y Ventas 2026 — precios canónicos BMC',
    envId: 'BMC_MATRIZ_SHEET_ID',
    defaultId: '1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo',
    tab: 'BROMYROS',
    headerRow: 0,
    dataStart: 1,
    colMap: {
      D: 'sku',
      E: 'descripcion',
      F: 'costo_m2_usd_ex_iva',
      L: 'venta_local',
      M: 'venta_local_iva_inc',
      T: 'venta_web_usd',
      U: 'venta_web_iva_inc',
    },
    // Normalize sentinel strings ("Actualizando", etc.) to null for all price fields
    priceCols: ['costo_m2_usd_ex_iva', 'venta_local', 'venta_local_iva_inc', 'venta_web_usd', 'venta_web_iva_inc'],
    optional: true,
  },
  {
    key: 'admin_cotizaciones',
    label: 'Admin 2.0 — Administrador de Cotizaciones (Wolfboard source)',
    envId: 'WOLFB_ADMIN_SHEET_ID',
    defaultId: '1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0',
    tab: process.env.WOLFB_ADMIN_TAB || 'Admin.',
    headerRow: 0,   // 0-indexed (sheet row 1 = headers)
    dataStart: 1,   // 0-indexed (sheet row 2 = first data, confirmed by operator)
    // Real layout confirmed by operator: I=Consulta, J=Respuesta AI, K=Link, L=Enviado
    colMap: {
      I: 'consulta',
      J: 'respuesta',
      K: 'link_presupuesto',
      L: 'enviado',
    },
    boolCols: { L: 'enviado' },
    // Skip rows with no actual query text — rows where only 'enviado' has a value are junk
    requiredField: 'consulta',
  },
  {
    key: 'audit_log',
    label: 'AUDIT_LOG — trazabilidad de cambios',
    envId: 'BMC_SHEET_ID',
    tab: 'AUDIT_LOG',
    headerRow: 0,
    dataStart: 1,
    colMap: {
      A: 'timestamp',
      B: 'action',
      C: 'row',
      D: 'old_value',
      E: 'new_value',
      F: 'reason',
      G: 'user',
      H: 'sheet',
    },
    optional: true,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveCredentials() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
  if (!raw) return '';
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({ scopes: [SCOPE_READ] });
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

function colLetterIndex(letter) {
  return col(letter);
}

function buildRowFromColMap(rawRow, colMap) {
  const obj = {};
  for (const [letter, field] of Object.entries(colMap)) {
    const idx = colLetterIndex(letter);
    obj[field] = rawRow[idx] ?? '';
  }
  return obj;
}

function buildRowFromFuzzyMap(headerRow, dataRow, fuzzyColMap) {
  const obj = {};
  headerRow.forEach((header, idx) => {
    const key = String(header || '').toLowerCase().trim();
    const field = fuzzyColMap[key];
    if (field) obj[field] = dataRow[idx] ?? '';
  });
  return obj;
}

function normalizeBoolean(val) {
  const s = String(val || '').toUpperCase().trim();
  if (s === 'TRUE' || s === 'SÍ' || s === 'SI') return true;
  if (s === 'FALSE' || s === 'NO' || s === '') return false;
  return val;
}

// Sentinel text values that appear in Sheets when a price hasn't been set yet.
const PRICE_SENTINELS = new Set(['actualizando', 'actualizar', 'actualizar oficialmente', 'pendiente', '-', 'tbd']);

function normalizePriceField(val) {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).trim().toLowerCase();
  if (PRICE_SENTINELS.has(s)) return null;
  const n = parseFloat(String(val).replace(',', '.'));
  return isNaN(n) ? null : val; // keep original string (e.g. "28.1400") for consumers that need precision
}

function extractMlId(observaciones) {
  const match = String(observaciones || '').match(/Q:(\d+)/);
  return match ? match[1] : null;
}

// ── Read one sheet tab ────────────────────────────────────────────────────────

/** Escape sheet title for A1 notation (single quotes → doubled). */
function a1QuoteSheetTitle(title) {
  return String(title || '').replace(/'/g, "''");
}

async function readTab(sheets, spreadsheetId, tabName) {
  // values.get requires a cell range; sheet-only strings often return "Unable to parse range"
  // End column must be valid A1 (ZZZZ is invalid); ZZ covers >700 cols (CRM uses through ~AK)
  const wide = 'A:ZZ';
  const range = tabName
    ? `'${a1QuoteSheetTitle(tabName)}'!${wide}`
    : undefined;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: range || `Sheet1!${wide}`,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  return res.data.values || [];
}

async function getFirstTabName(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return meta.data.sheets?.[0]?.properties?.title || 'Sheet1';
}

async function getAllTabNames(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return (meta.data.sheets || []).map(s => s.properties?.title).filter(Boolean);
}

// ── Sync one entry from registry ──────────────────────────────────────────────

async function syncEntry(sheets, entry) {
  const spreadsheetId = process.env[entry.envId] || entry.defaultId || '';
  if (!spreadsheetId) {
    if (entry.optional) return { skipped: true, reason: `${entry.envId} not set` };
    throw new Error(`${entry.envId} is required but not set`);
  }

  const rows = [];

  if (entry.multiTab) {
    // Merge all tabs (Ventas 2.0)
    const tabNames = await getAllTabNames(sheets, spreadsheetId);
    for (const tab of tabNames) {
      try {
        const raw = await readTab(sheets, spreadsheetId, tab);
        if (raw.length <= entry.dataStart) continue;
        const headerRow = raw[entry.headerRow] || [];
        for (let i = entry.dataStart; i < raw.length; i++) {
          const row = buildRowFromFuzzyMap(headerRow, raw[i], entry.fuzzyColMap);
          if (Object.values(row).some(v => v)) {
            row._tab = tab;
            row._row = i + 1;
            rows.push(row);
          }
        }
      } catch (_) {
        // Skip tabs that fail (e.g., hidden/empty)
      }
    }
  } else {
    let tabName;
    if (entry.tab == null) {
      tabName = await getFirstTabName(sheets, spreadsheetId);
    } else {
      const tabs = await getAllTabNames(sheets, spreadsheetId);
      if (!tabs.includes(entry.tab)) {
        const canSkip = entry.optional === true || entry.skipIfTabMissing === true;
        if (canSkip) {
          return {
            skipped: true,
            reason: `tab "${entry.tab}" not in workbook (${tabs.length} tabs)`,
          };
        }
        throw new Error(
          `Tab "${entry.tab}" not found in ${entry.envId}. Available: ${tabs.join(', ')}`,
        );
      }
      tabName = entry.tab;
    }
    const raw = await readTab(sheets, spreadsheetId, tabName);
    if (raw.length <= entry.dataStart) return { rows: [], rowCount: 0, tab: tabName };
    const headerRow = raw[entry.headerRow] || [];
    for (let i = entry.dataStart; i < raw.length; i++) {
      let row;
      if (entry.colMap) {
        row = buildRowFromColMap(raw[i], entry.colMap);
      } else {
        row = buildRowFromFuzzyMap(headerRow, raw[i], entry.fuzzyColMap || {});
      }
      // Skip blank rows
      if (!Object.values(row).some(v => v)) continue;
      row._row = i + 1;
      // Normalize booleans
      if (entry.boolCols) {
        for (const [, field] of Object.entries(entry.boolCols)) {
          if (field in row) row[field] = normalizeBoolean(row[field]);
        }
      }
      // Require a specific field to be non-empty (e.g. consulta for admin_cotizaciones)
      if (entry.requiredField && !String(row[entry.requiredField] ?? '').trim()) continue;
      // Normalize sentinel strings in price/numeric columns to null
      if (entry.priceCols) {
        for (const field of entry.priceCols) {
          if (field in row) row[field] = normalizePriceField(row[field]);
        }
      }
      // Extract ML question ID
      if (entry.mlIdExtract && row.observaciones) {
        row._ml_question_id = extractMlId(row.observaciones);
      }
      rows.push(row);
    }
  }

  // Apply optional filter
  let finalRows = rows;
  if (entry.boolFilter) {
    const { col: fCol, excludeValues } = entry.boolFilter;
    finalRows = rows.filter(r => !excludeValues.includes(r[fCol]));
  }

  return { rows: finalRows, rowCount: finalRows.length, spreadsheetId };
}

// ── Write snapshot to .accessible-base/ ──────────────────────────────────────

function ensureBaseDir() {
  if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });
}

function writeSnapshot(key, payload, dryRun) {
  const filePath = path.join(BASE_DIR, `${key}.json`);
  if (dryRun) {
    console.log(`[dry-run] would write ${filePath} (${payload._meta?.row_count ?? '?'} rows)`);
    return;
  }
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function readManifest() {
  const mPath = path.join(BASE_DIR, 'manifest.json');
  if (fs.existsSync(mPath)) {
    try { return JSON.parse(fs.readFileSync(mPath, 'utf8')); } catch (_) {}
  }
  return { version: 1, sheets: {} };
}

function writeManifest(manifest, dryRun) {
  const mPath = path.join(BASE_DIR, 'manifest.json');
  manifest.last_sync = new Date().toISOString();
  if (dryRun) { console.log('[dry-run] would update manifest.json'); return; }
  fs.writeFileSync(mPath, JSON.stringify(manifest, null, 2), 'utf8');
}

// ── Main sync loop ────────────────────────────────────────────────────────────

async function syncAll({ targetKey = null, dryRun = false } = {}) {
  const credsPath = resolveCredentials();
  if (!credsPath || !fs.existsSync(credsPath)) {
    console.error('✗ GOOGLE_APPLICATION_CREDENTIALS not set or file not found');
    console.error('  Set the path in .env and ensure the service account has Sheets read access');
    process.exit(1);
  }

  const sheets = await getSheetsClient();
  if (!dryRun) ensureBaseDir();

  const manifest = readManifest();
  const entries = targetKey ? REGISTRY.filter(e => e.key === targetKey) : REGISTRY;

  if (targetKey && entries.length === 0) {
    console.error(`✗ Unknown sheet key: ${targetKey}`);
    console.error(`  Available: ${REGISTRY.map(e => e.key).join(', ')}`);
    process.exit(1);
  }

  const results = [];

  for (const entry of entries) {
    const t0 = Date.now();
    process.stdout.write(`  ⟳  ${entry.key.padEnd(25)} `);
    try {
      const result = await syncEntry(sheets, entry);
      if (result.skipped) {
        console.log(`⏭  skipped (${result.reason})`);
        results.push({ key: entry.key, status: 'skipped', reason: result.reason });
        continue;
      }
      const payload = {
        _meta: {
          key: entry.key,
          label: entry.label,
          synced_at: new Date().toISOString(),
          row_count: result.rowCount,
          spreadsheet_id: result.spreadsheetId,
          source_env: entry.envId,
        },
        rows: result.rows,
      };
      writeSnapshot(entry.key, payload, dryRun);
      manifest.sheets[entry.key] = {
        synced_at: payload._meta.synced_at,
        row_count: result.rowCount,
        spreadsheet_id: result.spreadsheetId,
        label: entry.label,
      };
      const ms = Date.now() - t0;
      console.log(`✓  ${result.rowCount} rows  (${ms}ms)`);
      results.push({ key: entry.key, status: 'ok', rowCount: result.rowCount });
    } catch (err) {
      const ms = Date.now() - t0;
      console.log(`✗  ERROR: ${err.message}  (${ms}ms)`);
      results.push({ key: entry.key, status: 'error', error: err.message });
      manifest.sheets[entry.key] = {
        ...(manifest.sheets[entry.key] || {}),
        last_error: err.message,
        last_error_at: new Date().toISOString(),
      };
    }
  }

  writeManifest(manifest, dryRun);

  const ok = results.filter(r => r.status === 'ok').length;
  const skip = results.filter(r => r.status === 'skipped').length;
  const err = results.filter(r => r.status === 'error').length;
  console.log(`\n  Done: ${ok} synced | ${skip} skipped | ${err} errors`);
  if (!dryRun) console.log(`  Snapshots: ${BASE_DIR}/`);
  return results;
}

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun    = args.includes('--dry-run');
const watchIdx  = args.findIndex(a => a === '--watch');
const watchMin  = watchIdx !== -1 ? Number(args[watchIdx + 1]) || 3 : null;
const sheetArg  = (args.find(a => a.startsWith('--sheet=')) || '').replace('--sheet=', '') || null;

async function run() {
  const stamp = new Date().toLocaleTimeString('es-UY');
  console.log(`\n🔄 Accessible Base Sync  [${stamp}]${dryRun ? '  DRY-RUN' : ''}${sheetArg ? `  --sheet=${sheetArg}` : ''}`);
  await syncAll({ targetKey: sheetArg, dryRun });
}

if (watchMin) {
  console.log(`👀 Watch mode: every ${watchMin} min — Ctrl+C to stop`);
  run();
  setInterval(run, watchMin * 60 * 1000);
} else {
  run().catch(err => { console.error(err); process.exit(1); });
}
