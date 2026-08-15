/**
 * Server-canonical freeze. ADR-003 / ADR-004.
 * Existing snapshot is never overwritten.
 * Prices come ONLY from server catalog — never from client unit prices.
 */

import {
  PANELS_TECHO,
  PANELS_PARED,
  FIJACIONES,
  SELLADORES,
  SERVICIOS,
  PERFIL_TECHO,
  PERFIL_PARED,
} from "../../src/data/constants.js";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Resolve unit price without mutating global LISTA_ACTIVA (concurrent-safe). */
function priceForLista(item, lista) {
  if (!item) return 0;
  if (lista === "venta") return item.venta || item.web || 0;
  return item.web || item.venta || 0;
}

function pushLine(out, l) {
  if (!l || typeof l !== "object") return;
  const qty = num(l.qty ?? l.cantidad ?? l.cant) ?? 0;
  if (!(qty > 0)) return;
  out.push({
    sku: String(l.sku || l.id || l.code || l.nombre || "line"),
    qty,
    client_unit: num(l.unit_price ?? l.precio ?? l.unit_price_client ?? l.pu_usd ?? l.pu),
  });
}

/** Flatten calculator BOM groups + flat line arrays. */
export function extractLines(payload) {
  if (!payload || typeof payload !== "object") return [];
  const out = [];
  const flat =
    payload.lines ||
    payload.items ||
    payload.resumen?.lines ||
    payload.summary?.lines ||
    null;
  if (Array.isArray(flat)) {
    for (const l of flat) pushLine(out, l);
  }
  const bom = payload.bom;
  if (Array.isArray(bom)) {
    for (const group of bom) {
      if (Array.isArray(group?.items)) {
        for (const l of group.items) pushLine(out, l);
      } else {
        pushLine(out, group);
      }
    }
  }
  return out;
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

function walkPerfilTree(node, catalog, lista) {
  if (!node || typeof node !== "object") return;
  if (typeof node.sku === "string" && node.sku) {
    const price = priceForLista(node, lista);
    if (Number.isFinite(price)) catalog[node.sku] = price;
  }
  for (const v of Object.values(node)) {
    if (v && typeof v === "object") walkPerfilTree(v, catalog, lista);
  }
}

/**
 * Build sku → unit USD (ex-IVA) from baked constants for the given lista.
 * Does not mutate LISTA_ACTIVA (safe under concurrent /calc requests).
 */
export function buildServerPriceCatalog(lista = "venta") {
  const active = lista === "web" ? "web" : "venta";
  const catalog = Object.create(null);
  for (const [fam, panel] of Object.entries(PANELS_TECHO || {})) {
    for (const [esp, data] of Object.entries(panel.esp || {})) {
      const price = priceForLista(data, active);
      catalog[`${fam}_${esp}`] = price;
      catalog[`${fam}-${esp}`] = price;
      catalog[`${fam}${esp}`] = price;
    }
  }
  for (const [fam, panel] of Object.entries(PANELS_PARED || {})) {
    for (const [esp, data] of Object.entries(panel.esp || {})) {
      const price = priceForLista(data, active);
      catalog[`${fam}_${esp}`] = price;
      catalog[`${fam}-${esp}`] = price;
      catalog[`${fam}${esp}`] = price;
    }
  }
  for (const [id, item] of Object.entries(FIJACIONES || {})) {
    catalog[id] = priceForLista(item, active);
  }
  for (const [id, item] of Object.entries(SELLADORES || {})) {
    catalog[id] = priceForLista(item, active);
  }
  if (SERVICIOS?.flete) catalog.FLETE = priceForLista(SERVICIOS.flete, active);
  walkPerfilTree(PERFIL_TECHO, catalog, active);
  walkPerfilTree(PERFIL_PARED, catalog, active);
  return catalog;
}

/**
 * @param {object} payload
 * @param {object} [opts]
 * @param {Record<string, number>} [opts.catalog] sku → unit price USD ex-IVA
 * @param {object|null} [opts.existingSnapshot]
 * @param {string} [opts.lista]
 * @param {string} [opts.dataVersion]
 * @param {Date} [opts.now]
 * @param {boolean} [opts.allowEmptyCatalog=false] test-only; production always loads catalog
 */
export function buildBmcSnapshot(payload, opts = {}) {
  if (opts.existingSnapshot && typeof opts.existingSnapshot === "object") {
    return { snapshot: opts.existingSnapshot, reused: true };
  }
  const lista = opts.lista || payload?.lista || "venta";
  const catalog =
    opts.catalog && Object.keys(opts.catalog).length
      ? opts.catalog
      : buildServerPriceCatalog(lista);

  const lines = extractLines(payload).map((l) => {
    const fromCat = num(catalog[l.sku]) ?? num(catalog[String(l.sku).replace(/-/g, "_")]);
    if (fromCat != null) {
      return {
        sku: l.sku,
        qty: l.qty,
        unit_price_server: fromCat,
        source: "LISTA_ACTIVA",
        client_unit: l.client_unit,
      };
    }
    // ADR-004 fail-closed: never promote client unit prices into the BMC freeze.
    return {
      sku: l.sku,
      qty: l.qty,
      unit_price_server: 0,
      source: "unpriced",
      client_unit: l.client_unit,
    };
  });

  const priced = lines.filter((l) => l.source === "LISTA_ACTIVA");
  const subtotal = priced.reduce((s, l) => s + l.qty * l.unit_price_server, 0);
  const iva = 0.22;
  const total_usd = Math.round(subtotal * (1 + iva) * 100) / 100;
  const client_total_usd = pickClientTotal(payload);
  const cost = priced.reduce((s, l) => s + l.qty * l.unit_price_server * 0.83, 0);
  const margin_usd = Math.round((subtotal - cost) * 100) / 100;
  const margin_pct = subtotal > 0 ? Math.round((margin_usd / subtotal) * 10000) / 100 : 0;
  const price_drift =
    client_total_usd != null && Math.abs(client_total_usd - total_usd) > 0.05;
  const incomplete =
    lines.length === 0 || lines.some((l) => l.source === "unpriced");

  return {
    reused: false,
    incomplete,
    snapshot: {
      lista,
      currency: "USD",
      lines,
      subtotal_usd: Math.round(subtotal * 100) / 100,
      iva,
      total_usd,
      margin_usd,
      margin_pct,
      client_total_usd,
      price_drift,
      incomplete,
      priced_at: (opts.now || new Date()).toISOString(),
      calculator_data_version: opts.dataVersion || payload?.calculator_data_version || null,
    },
  };
}
