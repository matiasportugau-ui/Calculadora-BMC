/**
 * productosMaestro.js — merge puro MATRIZ + Stock + links path↔codigo
 * Usado por script reconcile, GET /api/productos-maestro y tests offline.
 */

import fs from "node:fs";
import path from "node:path";
import { splitCsvCells } from "../../src/utils/csvPricingImport.js";
import { MATRIZ_SKU_TO_PATH, normalizeSku } from "../../src/data/matrizPreciosMapping.js";

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;
export const DEFAULT_PRICE_TOLERANCE_PCT = 5;

export const PRODUCT_LINKS_FILE = path.join(process.cwd(), ".runtime", "product-links.json");

/** @typedef {'ok'|'sin_matriz'|'sin_stock_link'|'precio_desalineado'|'bajo_stock'} ProductoEstado */

/**
 * @param {unknown} code
 * @returns {string}
 */
export function normalizeProductCode(code) {
  return normalizeSku(code);
}

/**
 * @returns {Record<string, string>}
 */
export function loadProductLinks() {
  try {
    if (!fs.existsSync(PRODUCT_LINKS_FILE)) return {};
    const raw = JSON.parse(fs.readFileSync(PRODUCT_LINKS_FILE, "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

/**
 * @param {Record<string, string>} links path → codigo_stock
 */
export function saveProductLinks(links) {
  const dir = path.dirname(PRODUCT_LINKS_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PRODUCT_LINKS_FILE, JSON.stringify(links, null, 2), "utf8");
}

/**
 * @param {string} csvText
 * @returns {Array<{ path: string, sku: string, nombre: string, costo: number|null, venta_local: number|null, venta_web: number|null, tab: string }>}
 */
export function parseMatrizCsvToRows(csvText) {
  const text = String(csvText || "").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = splitCsvCells(lines[0]).map((h) => String(h || "").trim().toLowerCase());
  const idx = (name) => headers.indexOf(name);
  const pathIdx = idx("path");
  if (pathIdx < 0) return [];

  const skuIdx = idx("sku");
  const descIdx = headers.findIndex((h) => h === "descripcion" || h === "descripción");
  const costoIdx = idx("costo");
  const ventaIdx = headers.findIndex((h) => h === "venta_local" || h === "venta_bmc_local");
  const webIdx = idx("venta_web");
  const tabIdx = idx("tab");

  const parseNum = (raw) => {
    if (raw == null || raw === "") return null;
    const n = parseFloat(String(raw).replace(",", "."));
    return Number.isNaN(n) ? null : +n.toFixed(2);
  };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvCells(lines[i]);
    const p = cells[pathIdx]?.trim();
    if (!p) continue;
    rows.push({
      path: p,
      sku: skuIdx >= 0 ? String(cells[skuIdx] || "").trim() : "",
      nombre: descIdx >= 0 ? String(cells[descIdx] || "").trim() : "",
      costo: costoIdx >= 0 ? parseNum(cells[costoIdx]) : null,
      venta_local: ventaIdx >= 0 ? parseNum(cells[ventaIdx]) : null,
      venta_web: webIdx >= 0 ? parseNum(cells[webIdx]) : null,
      tab: tabIdx >= 0 ? String(cells[tabIdx] || "").trim() : "",
    });
  }
  return rows;
}

/**
 * @returns {{ skuToPath: Record<string, string>, pathToSkus: Record<string, string[]> }}
 */
export function buildSkuPathIndexes() {
  /** @type {Record<string, string>} */
  const skuToPath = { ...MATRIZ_SKU_TO_PATH };
  /** @type {Record<string, string[]>} */
  const pathToSkus = {};
  for (const [sku, p] of Object.entries(skuToPath)) {
    if (!pathToSkus[p]) pathToSkus[p] = [];
    pathToSkus[p].push(sku);
  }
  return { skuToPath, pathToSkus };
}

/**
 * @param {Array<{ CODIGO?: string, PRODUCTO?: string, COSTO_USD?: number|string, VENTA_USD?: number|string, STOCK?: number|string, PEDIDO_PENDIENTE?: number|string }>} stockRows
 * @returns {Map<string, object>}
 */
export function indexStockByCodigo(stockRows) {
  /** @type {Map<string, object>} */
  const byCode = new Map();
  for (const row of stockRows || []) {
    const code = normalizeProductCode(row.CODIGO || row.Codigo);
    if (!code) continue;
    byCode.set(code, {
      codigo_stock: String(row.CODIGO || row.Codigo || "").trim(),
      producto: String(row.PRODUCTO || row.Producto || "").trim(),
      costo_usd: parseOptionalNum(row.COSTO_USD),
      venta_usd: parseOptionalNum(row.VENTA_USD),
      stock: parseOptionalNum(row.STOCK),
      pedido_pendiente: parseOptionalNum(row.PEDIDO_PENDIENTE),
    });
  }
  return byCode;
}

/**
 * @param {unknown} v
 * @returns {number|null}
 */
function parseOptionalNum(v) {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : +n.toFixed(2);
}

/**
 * @param {object} params
 * @param {ReturnType<typeof parseMatrizCsvToRows>} params.matrizRows
 * @param {Array<object>} [params.stockRows]
 * @param {Record<string, string>} [params.productLinks]
 * @param {string[]} [params.catalogPaths]
 * @param {number} [params.priceTolerancePct]
 * @param {number} [params.lowStockThreshold]
 */
export function mergeProductosMaestro({
  matrizRows = [],
  stockRows = [],
  productLinks = {},
  catalogPaths = [],
  priceTolerancePct = DEFAULT_PRICE_TOLERANCE_PCT,
  lowStockThreshold = DEFAULT_LOW_STOCK_THRESHOLD,
}) {
  const stockByCode = indexStockByCodigo(stockRows);
  const { pathToSkus } = buildSkuPathIndexes();
  const byPath = new Map();

  for (const row of matrizRows) {
    byPath.set(row.path, {
      path: row.path,
      sku: row.sku || (pathToSkus[row.path]?.[0] || ""),
      nombre: row.nombre,
      costo: row.costo,
      venta_local: row.venta_local,
      venta_web: row.venta_web,
      tab: row.tab,
      in_matriz: true,
    });
  }

  for (const p of catalogPaths) {
    if (!byPath.has(p)) {
      byPath.set(p, {
        path: p,
        sku: pathToSkus[p]?.[0] || "",
        nombre: "",
        costo: null,
        venta_local: null,
        venta_web: null,
        tab: "",
        in_matriz: false,
      });
    }
  }

  /** @type {Array<object>} */
  const items = [];
  const matchedStockCodes = new Set();

  for (const base of byPath.values()) {
    const warnings = [];
    /** @type {ProductoEstado[]} */
    const estados = [];

    const linkedCode = productLinks[base.path];
    let stockRow = null;

    if (linkedCode) {
      stockRow = stockByCode.get(normalizeProductCode(linkedCode)) || null;
    }
    if (!stockRow && base.sku) {
      stockRow = stockByCode.get(normalizeProductCode(base.sku)) || null;
    }
    if (!stockRow && base.sku) {
      for (const alt of pathToSkus[base.path] || []) {
        stockRow = stockByCode.get(normalizeProductCode(alt)) || null;
        if (stockRow) break;
      }
    }

    const codigo_stock = linkedCode || stockRow?.codigo_stock || "";
    if (stockRow?.codigo_stock) {
      matchedStockCodes.add(normalizeProductCode(stockRow.codigo_stock));
    }

    if (!base.in_matriz) estados.push("sin_matriz");
    if (!stockRow) {
      estados.push("sin_stock_link");
    } else if (
      base.venta_web != null &&
      stockRow.venta_usd != null &&
      stockRow.venta_usd > 0 &&
      pctDiff(base.venta_web, stockRow.venta_usd) > priceTolerancePct
    ) {
      estados.push("precio_desalineado");
      warnings.push(
        `MATRIZ venta_web ${base.venta_web} vs Stock VENTA_USD ${stockRow.venta_usd} (>${priceTolerancePct}%)`,
      );
    }

    const stockQty = stockRow?.stock ?? null;
    if (stockQty != null && stockQty >= 0 && stockQty < lowStockThreshold) {
      estados.push("bajo_stock");
    }

    const estado = estados.length === 0 ? "ok" : estados[0];

    items.push({
      path: base.path,
      sku: base.sku,
      nombre: base.nombre || stockRow?.producto || "",
      costo: base.costo,
      venta_local: base.venta_local,
      venta_web: base.venta_web,
      stock: stockQty,
      pedido_pendiente: stockRow?.pedido_pendiente ?? null,
      codigo_stock,
      venta_usd_stock: stockRow?.venta_usd ?? null,
      estado,
      estados,
      warnings,
      in_matriz: base.in_matriz,
      tab: base.tab,
    });
  }

  items.sort((a, b) => String(a.path).localeCompare(String(b.path)));

  const orphanStock = [];
  for (const [code, row] of stockByCode.entries()) {
    if (matchedStockCodes.has(code)) continue;
    orphanStock.push({
      codigo_stock: row.codigo_stock,
      producto: row.producto,
      stock: row.stock,
      venta_usd: row.venta_usd,
    });
  }

  const skusInMapping = new Set(Object.keys(MATRIZ_SKU_TO_PATH).map(normalizeSku));
  const skusInMatriz = new Set(matrizRows.map((r) => normalizeSku(r.sku)).filter(Boolean));
  const skusSinPath = [...skusInMatriz].filter((s) => !skusInMapping.has(s));
  const pathsInMatriz = new Set(matrizRows.map((r) => r.path));
  const pathsSinSkuEnMapping = matrizRows
    .filter((r) => r.sku && !MATRIZ_SKU_TO_PATH[normalizeSku(r.sku)])
    .map((r) => ({ path: r.path, sku: r.sku }));

  const summary = {
    total: items.length,
    ok: items.filter((i) => i.estado === "ok").length,
    gaps: {
      sin_matriz: items.filter((i) => i.estados.includes("sin_matriz")).length,
      sin_stock_link: items.filter((i) => i.estados.includes("sin_stock_link")).length,
      precio_desalineado: items.filter((i) => i.estados.includes("precio_desalineado")).length,
      bajo_stock: items.filter((i) => i.estados.includes("bajo_stock")).length,
    },
    orphan_stock_count: orphanStock.length,
    paths_sin_mapping: pathsSinSkuEnMapping.length,
  };

  return {
    items,
    summary,
    reconcile: {
      paths_sin_sku_mapping: pathsSinSkuEnMapping,
      skus_mapping_sin_fila_matriz: [...skusInMapping].filter((s) => !skusInMatriz.has(s)),
      orphan_stock: orphanStock,
      paths_en_matriz: pathsInMatriz.size,
    },
  };
}

/**
 * @param {number} a
 * @param {number} b
 */
function pctDiff(a, b) {
  if (a == null || b == null || b === 0) return 0;
  return Math.abs((a - b) / b) * 100;
}

/**
 * @param {object} merged result of mergeProductosMaestro
 * @returns {string}
 */
export function formatReconcileMarkdown(merged, generatedAt = new Date().toISOString()) {
  const { summary, reconcile, items } = merged;
  const lines = [
    `# Productos Maestro — Reconcile`,
    ``,
    `**Generado:** ${generatedAt}`,
    ``,
    `## Resumen`,
    ``,
    `| Métrica | Valor |`,
    `|---------|-------|`,
    `| Total ítems | ${summary.total} |`,
    `| OK | ${summary.ok} |`,
    `| Sin stock link | ${summary.gaps.sin_stock_link} |`,
    `| Precio desalineado | ${summary.gaps.precio_desalineado} |`,
    `| Bajo stock | ${summary.gaps.bajo_stock} |`,
    `| Stock huérfano (sin MATRIZ) | ${summary.orphan_stock_count} |`,
    `| Paths sin mapping SKU | ${summary.paths_sin_mapping} |`,
    ``,
  ];

  if (reconcile.paths_sin_sku_mapping.length) {
    lines.push(`## Paths en MATRIZ sin entrada en mapping`, ``);
    for (const r of reconcile.paths_sin_sku_mapping.slice(0, 50)) {
      lines.push(`- \`${r.path}\` SKU \`${r.sku}\``);
    }
    if (reconcile.paths_sin_sku_mapping.length > 50) {
      lines.push(`- … +${reconcile.paths_sin_sku_mapping.length - 50} más`);
    }
    lines.push(``);
  }

  const gaps = items.filter((i) => i.estado !== "ok");
  if (gaps.length) {
    lines.push(`## Ítems con gaps (primeros 40)`, ``);
    for (const i of gaps.slice(0, 40)) {
      lines.push(`- \`${i.path}\` — ${i.estado}${i.warnings.length ? `: ${i.warnings[0]}` : ""}`);
    }
    lines.push(``);
  }

  if (reconcile.orphan_stock.length) {
    lines.push(`## Stock sin match en catálogo (primeros 30)`, ``);
    for (const o of reconcile.orphan_stock.slice(0, 30)) {
      lines.push(`- \`${o.codigo_stock}\` ${o.producto || ""} stock=${o.stock ?? "?"}`);
    }
    lines.push(``);
  }

  return lines.join("\n");
}
