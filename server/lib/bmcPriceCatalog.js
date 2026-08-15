/**
 * Server-side SKU → unit price (USD ex-IVA) for bmc_snapshot re-price.
 * ADR-003: complete must resolve LISTA_ACTIVA via p(), never trust client pu.
 */

import {
  PANELS_TECHO,
  PANELS_PARED,
  FIJACIONES,
  SELLADORES,
  HERRAMIENTAS,
  PERFIL_TECHO,
  PERFIL_PARED,
  SERVICIOS,
  p,
  setListaPrecios,
} from "../../src/data/constants.js";

function addPrice(map, key, item) {
  if (!key || !item) return;
  const price = p(item);
  if (!Number.isFinite(price)) return;
  const k = String(key);
  // First write wins — avoid clobbering panel familia keys with unrelated ids.
  if (map[k] == null) map[k] = price;
}

function walkPerfiles(map, root) {
  if (!root || typeof root !== "object") return;
  for (const byFam of Object.values(root)) {
    if (!byFam || typeof byFam !== "object") continue;
    for (const byEsp of Object.values(byFam)) {
      if (!byEsp || typeof byEsp !== "object") continue;
      for (const item of Object.values(byEsp)) {
        if (item?.sku) addPrice(map, item.sku, item);
      }
    }
  }
}

/**
 * @param {string} [lista] "venta" | "web"
 * @returns {Record<string, number>}
 */
export function buildBmcPriceCatalog(lista = "venta") {
  setListaPrecios(lista === "venta" ? "venta" : "web");
  const map = Object.create(null);

  for (const [fam, panel] of Object.entries(PANELS_TECHO)) {
    for (const [esp, data] of Object.entries(panel.esp || {})) {
      addPrice(map, `${fam}_${esp}`, data);
      addPrice(map, `${fam}-${esp}`, data);
    }
  }
  for (const [fam, panel] of Object.entries(PANELS_PARED)) {
    for (const [esp, data] of Object.entries(panel.esp || {})) {
      addPrice(map, `${fam}_${esp}`, data);
      addPrice(map, `${fam}-${esp}`, data);
    }
  }
  for (const [id, item] of Object.entries(FIJACIONES)) {
    addPrice(map, id, item);
    if (item.sku) addPrice(map, item.sku, item);
  }
  for (const [id, item] of Object.entries(SELLADORES)) {
    addPrice(map, id, item);
    if (item.sku) addPrice(map, item.sku, item);
  }
  for (const [id, item] of Object.entries(HERRAMIENTAS)) {
    addPrice(map, id, item);
    if (item.sku) addPrice(map, item.sku, item);
  }
  walkPerfiles(map, PERFIL_TECHO);
  walkPerfiles(map, PERFIL_PARED);

  if (SERVICIOS?.flete) {
    addPrice(map, "FLETE", SERVICIOS.flete);
    addPrice(map, "flete", SERVICIOS.flete);
  }

  return map;
}
