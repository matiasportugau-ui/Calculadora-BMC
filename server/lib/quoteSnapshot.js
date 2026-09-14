/**
 * Server-canonical freeze. ADR-003 / ADR-004.
 * Existing snapshot is never overwritten.
 * Prices come only from LISTA_ACTIVA catalog — never from client unit prices.
 */

import {
  setListaPrecios,
  SERVICIOS,
  p,
  CALCULATOR_DATA_VERSION,
} from "../../src/data/constants.js";
import {
  buildProductCatalogIndex,
  rowPriceHint,
} from "../../src/utils/productCatalogIndex.js";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** sku → unit price USD ex-IVA from baked calculator constants (LISTA_ACTIVA). */
export function buildListaActivaCatalog(lista = "venta") {
  const listaNorm = lista === "venta" ? "venta" : "web";
  setListaPrecios(listaNorm);
  const catalog = {};
  for (const row of buildProductCatalogIndex()) {
    if (!row?.sku) continue;
    const price = rowPriceHint(row, listaNorm);
    if (price == null || !Number.isFinite(Number(price))) continue;
    const n = Number(price);
    catalog[row.sku] = n;
    // Accept both ISODEC_EPS-100 (calc BOM) and ISODEC_EPS_100 (tests / aliases).
    if (String(row.sku).includes("-")) {
      catalog[String(row.sku).replace(/-/g, "_")] = n;
    }
  }
  if (SERVICIOS?.flete) {
    catalog.FLETE = p(SERVICIOS.flete);
  }
  return catalog;
}

function flattenRawLines(payload) {
  if (!payload || typeof payload !== "object") return [];
  const direct =
    payload.lines ||
    payload.items ||
    payload.resumen?.lines ||
    payload.summary?.lines ||
    null;
  if (Array.isArray(direct)) return direct;

  // GPT /calc shape: bom = [{ grupo, items: [{ sku, cant, pu_usd, ... }] }]
  if (Array.isArray(payload.bom)) {
    const out = [];
    for (const entry of payload.bom) {
      if (Array.isArray(entry?.items)) out.push(...entry.items);
      else if (entry && typeof entry === "object" && (entry.sku || entry.id || entry.descripcion)) {
        out.push(entry);
      }
    }
    return out;
  }
  return [];
}

export function extractLines(payload) {
  return flattenRawLines(payload)
    .map((l) => ({
      sku: String(l.sku || l.id || l.code || l.nombre || l.descripcion || "line"),
      qty: num(l.qty ?? l.cantidad ?? l.cant) ?? 0,
      client_unit: num(l.unit_price ?? l.precio ?? l.unit_price_client ?? l.pu_usd ?? l.pu),
    }))
    .filter((l) => l.qty > 0);
}

export function pickClientTotal(payload) {
  if (!payload || typeof payload !== "object") return null;
  return (
    num(payload.totalUsd) ||
    num(payload.total_usd) ||
    num(payload.totals?.usd) ||
    num(payload.summary?.total_usd) ||
    num(payload.resumen?.total_usd) ||
    null
  );
}

/**
 * @param {object} payload
 * @param {object} [opts]
 * @param {Record<string, number>} [opts.catalog] sku → unit price USD ex-IVA
 * @param {object|null} [opts.existingSnapshot]
 * @param {string} [opts.lista]
 * @param {string} [opts.dataVersion]
 * @param {Date} [opts.now]
 */
export function buildBmcSnapshot(payload, opts = {}) {
  if (opts.existingSnapshot && typeof opts.existingSnapshot === "object") {
    return { snapshot: opts.existingSnapshot, reused: true };
  }
  const lista = opts.lista || payload?.lista || "venta";
  const catalog =
    opts.catalog && Object.keys(opts.catalog).length
      ? opts.catalog
      : buildListaActivaCatalog(lista);

  const lines = extractLines(payload).map((l) => {
    const fromCat = num(catalog[l.sku]);
    // ADR / SDD §9.1: ignore client unit prices — never trust payload_fallback.
    return {
      sku: l.sku,
      qty: l.qty,
      unit_price_server: fromCat != null ? fromCat : 0,
      source: fromCat != null ? "LISTA_ACTIVA" : "unpriced",
      client_unit: l.client_unit,
    };
  });

  const priced = lines.filter((l) => l.source === "LISTA_ACTIVA");
  const allPriced = lines.length > 0 && priced.length === lines.length;
  const subtotal = priced.reduce((s, l) => s + l.qty * l.unit_price_server, 0);
  const iva = 0.22;
  const total_usd = allPriced
    ? Math.round(subtotal * (1 + iva) * 100) / 100
    : null;
  const client_total_usd = pickClientTotal(payload);
  const cost = priced.reduce((s, l) => s + l.qty * l.unit_price_server * 0.83, 0);
  const margin_usd = allPriced ? Math.round((subtotal - cost) * 100) / 100 : null;
  const margin_pct =
    allPriced && subtotal > 0
      ? Math.round((margin_usd / subtotal) * 10000) / 100
      : null;
  const price_drift =
    allPriced &&
    client_total_usd != null &&
    Math.abs(client_total_usd - total_usd) > 0.05;

  return {
    reused: false,
    snapshot: {
      lista,
      currency: "USD",
      lines,
      subtotal_usd: allPriced ? Math.round(subtotal * 100) / 100 : null,
      iva,
      total_usd,
      margin_usd,
      margin_pct,
      client_total_usd,
      price_drift: !!price_drift,
      priced_at: (opts.now || new Date()).toISOString(),
      calculator_data_version:
        opts.dataVersion ||
        payload?.calculator_data_version ||
        CALCULATOR_DATA_VERSION ||
        null,
      incomplete: !allPriced,
    },
  };
}
