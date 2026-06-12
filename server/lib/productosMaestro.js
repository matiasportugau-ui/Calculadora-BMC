/**
 * Productos Maestro — Capa de unificación ligera precio + stock
 *
 * Objetivo (fiel al plan del transcript cursor_centralized_price_and_stock_mana.md):
 * - Un registro canónico por producto que une:
 *     sku (MATRIZ col D) ↔ path (calculadora) ↔ codigo (Stock E-Commerce)
 * - Fuente de verdad: MATRIZ (precios) + Stock workbook (inventario) + links manuales persistidos
 * - La calculadora (UI) es el hub visual de edición; las planillas son persistencia.
 * - Links viven en Postgres (bmc_catalog.products) cuando hay DATABASE_URL;
 *   .runtime/product-links.json queda como fallback local (era el storage
 *   original y se perdía en cada deploy de Cloud Run — filesystem efímero).
 *
 * Uso principal:
 *   import { getProductosMaestro, reconcileProductosMaestro, getLinks, saveLinks } from '../lib/productosMaestro.js'
 *
 * No muta Sheets directamente (el push se hace desde rutas con dryRun + token).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
// Sheet helpers — minimal direct implementation to keep the lib self-contained
// (the rich versions live inside bmcDashboard.js; we avoid circular import for now)
import { google } from 'googleapis';
import { getGoogleAuthClient } from './googleAuthCache.js';

const SCOPE_READ = 'https://www.googleapis.com/auth/spreadsheets.readonly';

async function getFirstSheetName(sheetId) {
  try {
    const authClient = await getGoogleAuthClient(SCOPE_READ);
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId, fields: 'sheets.properties.title' });
    const first = meta.data.sheets?.[0]?.properties?.title;
    return first || 'Sheet1';
  } catch (e) {
    return 'Sheet1';
  }
}

async function getSheetData(sheetId, sheetName, useWrite = false, options = {}) {
  const { headerRowOffset = 0 } = options;
  const authClient = await getGoogleAuthClient(useWrite ? 'https://www.googleapis.com/auth/spreadsheets' : SCOPE_READ);
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  const range = `'${sheetName}'!A1:Z800`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
  const all = res.data.values || [];
  if (all.length === 0) return { rows: [], headers: [] };

  const headerRow = all[headerRowOffset] || all[0];
  const headers = headerRow.map((h) => String(h || '').trim().toUpperCase().replace(/\s+/g, '_'));
  const dataRows = all.slice(headerRowOffset + 1);

  const rows = dataRows.map((r) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
    return obj;
  });
  return { rows, headers };
}

const isMissingSheetError = (e) => /Unable to parse range|notFound|404/i.test(String(e?.message || e));


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LINKS_FILE = path.join(REPO_ROOT, '.runtime', 'product-links.json');

function ensureRuntimeDir() {
  const dir = path.join(REPO_ROOT, '.runtime');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/* -------------------------------------------------------------------------- */
/* Links (persistencia durable en Postgres, fallback a JSON local)            */
/* -------------------------------------------------------------------------- */

import { hasCatalogDb } from './catalog/db.js';
import * as catalogStore from './catalog/store.js';

function loadLinksFromFile() {
  try {
    if (fs.existsSync(LINKS_FILE)) {
      const raw = fs.readFileSync(LINKS_FILE, 'utf8');
      const data = JSON.parse(raw);
      return data.links || {};
    }
  } catch (e) {
    console.warn('[productosMaestro] Error leyendo links:', e.message);
  }
  return {};
}

function saveLinksToFile(links) {
  ensureRuntimeDir();
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    links: links || {},
    meta: {
      note: 'SKU (MATRIZ) → CODIGO (Stock). Editado desde UI Productos Maestro o manualmente.',
    },
  };
  fs.writeFileSync(LINKS_FILE, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

export async function loadLinks() {
  if (hasCatalogDb()) {
    try {
      return await catalogStore.getLinks();
    } catch (e) {
      console.warn('[productosMaestro] Error leyendo links de bmc_catalog, fallback a JSON:', e.message);
    }
  }
  return loadLinksFromFile();
}

export async function saveLinks(links) {
  if (hasCatalogDb()) {
    return await catalogStore.saveLinks(links, { calcPathBySku: MATRIZ_SKU_TO_PATH || {} });
  }
  return saveLinksToFile(links);
}

/* -------------------------------------------------------------------------- */
/* Stock loader (reutiliza patrón de /api/stock-ecommerce)                    */
/* -------------------------------------------------------------------------- */

export async function loadStockItems() {
  const stockSheetId = config.bmcStockSheetId;
  if (!stockSheetId) {
    return { ok: false, error: 'BMC_STOCK_SHEET_ID no configurado', items: [] };
  }

  try {
    const sheetName = await getFirstSheetName(stockSheetId);
    const { rows } = await getSheetData(stockSheetId, sheetName, false, {
      schema: 'Stock_Ecommerce',
      headerRowOffset: 2,
    });

    const items = (rows || []).map((r) => ({
      codigo: String(r.CODIGO || r.codigo || '').trim(),
      producto: r.PRODUCTO || r.producto || '',
      costoUsd: parseFloat(r.COSTO_USD || r.costo_usd || 0) || 0,
      ventaUsd: parseFloat(r.VENTA_USD || r.venta_usd || 0) || 0,
      stock: parseFloat(r.STOCK || r.stock || 0) || 0,
      pedidoPendiente: parseFloat(r.PEDIDO_PENDIENTE || r.pedido_pendiente || 0) || 0,
      raw: r,
    })).filter((i) => i.codigo);

    return { ok: true, items, source: 'BMC_STOCK_SHEET_ID' };
  } catch (e) {
    if (isMissingSheetError && isMissingSheetError(e)) {
      return { ok: true, items: [], source: 'missing' };
    }
    return { ok: false, error: e.message, items: [] };
  }
}

/* -------------------------------------------------------------------------- */
/* MATRIZ price items (vía CSV actual + recuperación de SKU vía mapping)      */
/* -------------------------------------------------------------------------- */

import { MATRIZ_SKU_TO_PATH, normalizeSku } from '../../src/data/matrizPreciosMapping.js';

function buildReverseSkuIndex() {
  const reverse = new Map(); // path → canonicalSku (first seen)
  for (const [sku, p] of Object.entries(MATRIZ_SKU_TO_PATH || {})) {
    if (!reverse.has(p)) reverse.set(p, sku);
  }
  return reverse;
}

export async function loadMatrizItems() {
  const base = (config.publicBaseUrl || 'http://localhost:3001').replace(/\/$/, '');
  const url = `${base}/api/actualizar-precios-calculadora`;

  try {
    const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} al leer MATRIZ CSV`, items: [] };
    }
    const csv = await res.text();
    const lines = csv.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return { ok: true, items: [], source: 'empty' };

    const header = lines[0].replace(/^\uFEFF/, '').split(',').map((h) => h.trim().toLowerCase());
    const idx = (name) => header.indexOf(name);

    const skuIdx = idx('sku');
    const pathIdx = idx('path');
    const costoIdx = idx('costo');
    const ventaLocalIdx = idx('venta_local');
    const ventaWebIdx = idx('venta_web');

    const reverseSku = buildReverseSkuIndex();
    const items = [];

    for (let i = 1; i < lines.length; i++) {
      // naive CSV split (sufficient for our controlled output)
      const cells = splitCsvLine(lines[i]);
      const path = (cells[pathIdx] || '').trim();
      if (!path) continue;

      // Prefer the explicit sku column (emitted since Productos Maestro Fase 1)
      let sku = (cells[skuIdx] || '').trim() || null;
      if (!sku) sku = reverseSku.get(path) || null; // fallback for old cached CSVs

      const costo = parseFloat(cells[costoIdx] || 0) || 0;
      const ventaLocal = parseFloat(cells[ventaLocalIdx] || 0) || 0;
      const ventaWeb = parseFloat(cells[ventaWebIdx] || 0) || 0;

      items.push({
        sku,
        path,
        costo,
        ventaLocal,
        ventaWeb,
        source: 'matriz-csv',
      });
    }

    return { ok: true, items, source: 'csv+reverse-mapping' };
  } catch (e) {
    return { ok: false, error: e.message, items: [] };
  }
}

function splitCsvLine(line) {
  // Minimal CSV splitter that respects quotes (good enough for our generated CSV)
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' ) {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

/* -------------------------------------------------------------------------- */
/* Maestro unificado                                                          */
/* -------------------------------------------------------------------------- */

export async function getProductosMaestro(opts = {}) {
  const { includeUnmatched = true } = opts;

  const [matrizRes, stockRes] = await Promise.all([
    loadMatrizItems(),
    loadStockItems(),
  ]);

  const links = await loadLinks();
  const stockByCodigo = new Map(stockRes.items.map((s) => [s.codigo, s]));
  const reverseLinks = new Map(); // codigo → sku
  for (const [sku, codigo] of Object.entries(links)) {
    if (codigo) reverseLinks.set(String(codigo), sku);
  }

  const unified = [];

  // 1. Items que vienen de MATRIZ (precio canónico)
  for (const m of matrizRes.items) {
    const linkedCodigo = links[m.sku] || null;
    const stock = linkedCodigo ? stockByCodigo.get(linkedCodigo) : null;

    unified.push({
      id: m.sku || m.path,
      sku: m.sku,
      path: m.path,
      codigo: linkedCodigo,
      nombre: stock?.producto || m.path.split('.').pop(),
      precio: {
        costo: m.costo,
        ventaLocal: m.ventaLocal,
        ventaWeb: m.ventaWeb,
      },
      stock: stock ? {
        actual: stock.stock,
        pedidoPendiente: stock.pedidoPendiente,
        valorInventario: stock.costoUsd * stock.stock,
      } : null,
      linkStatus: linkedCodigo ? 'linked' : 'matriz-only',
      sources: { matriz: true, stock: !!stock },
    });
  }

  // 2. Items de Stock sin link (si se pide)
  if (includeUnmatched) {
    for (const s of stockRes.items) {
      const linkedSku = reverseLinks.get(s.codigo);
      if (linkedSku) continue; // ya apareció arriba

      const already = unified.find((u) => u.codigo === s.codigo);
      if (already) continue;

      unified.push({
        id: `stock-${s.codigo}`,
        sku: null,
        path: null,
        codigo: s.codigo,
        nombre: s.producto,
        precio: null,
        stock: {
          actual: s.stock,
          pedidoPendiente: s.pedidoPendiente,
          valorInventario: s.costoUsd * s.stock,
        },
        linkStatus: 'stock-only',
        sources: { matriz: false, stock: true },
      });
    }
  }

  return {
    ok: true,
    count: unified.length,
    items: unified,
    meta: {
      matrizSource: matrizRes.source,
      stockSource: stockRes.source,
      linksCount: Object.keys(links).length,
      generatedAt: new Date().toISOString(),
    },
    warnings: [],
  };
}

/* -------------------------------------------------------------------------- */
/* Reconcile (gaps)                                                           */
/* -------------------------------------------------------------------------- */

export async function reconcileProductosMaestro() {
  const maestro = await getProductosMaestro({ includeUnmatched: true });
  const items = maestro.items || [];

  const gaps = {
    matrizOnly: items.filter((i) => i.linkStatus === 'matriz-only'),
    stockOnly: items.filter((i) => i.linkStatus === 'stock-only'),
    linked: items.filter((i) => i.linkStatus === 'linked'),
  };

  const report = {
    ok: true,
    summary: {
      total: items.length,
      linked: gaps.linked.length,
      matrizOnly: gaps.matrizOnly.length,
      stockOnly: gaps.stockOnly.length,
      linkCoverage: items.length ? (gaps.linked.length / items.length) : 0,
    },
    gaps,
    meta: maestro.meta,
  };

  return report;
}

/* -------------------------------------------------------------------------- */
/* Helpers para push (usados por la ruta)                                     */
/* -------------------------------------------------------------------------- */

export function preparePushPayload(edited, { dryRun = true } = {}) {
  // edited: array de items editados desde UI con campos precio y/o stock
  const priceChanges = [];
  const stockChanges = [];

  for (const e of edited || []) {
    if (e.precio && e.sku) {
      priceChanges.push({ sku: e.sku, ...e.precio });
    }
    if (e.stock && e.codigo) {
      stockChanges.push({ codigo: e.codigo, ...e.stock });
    }
  }

  return {
    ok: true,
    dryRun,
    priceChanges,
    stockChanges,
    summary: {
      precios: priceChanges.length,
      stock: stockChanges.length,
    },
  };
}

export default {
  getProductosMaestro,
  reconcileProductosMaestro,
  loadLinks,
  saveLinks,
  loadMatrizItems,
  loadStockItems,
  preparePushPayload,
};
