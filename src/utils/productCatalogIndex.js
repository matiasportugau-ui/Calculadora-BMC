// ═══════════════════════════════════════════════════════════════════════════
// productCatalogIndex.js — Índice plano y unificado de TODO el catálogo vendible
// (paneles por espesor, perfilería, fijaciones/herrajes, selladores) para el
// buscador único del drawer "Agregar producto".
//
// Cada fila queda etiquetada con `addBy` + `key`, que indican EXACTAMENTE qué
// setter de estado "presupuesto libre" debe recibir el alta:
//   - addBy: "perfilQty"  → setLibrePerfilQty[key]   (key = id pt:/pp:)
//   - addBy: "fijQty"     → setLibreFijQty[key]       (key = slug FIJACIONES/HERRAMIENTAS)
//   - addBy: "sellQty"    → setLibreSellQty[key]      (key = slug SELLADORES)
//   - addBy: "panelLine"  → setLibrePanelLines(push { familia, espesor, color })
//
// El precio de la fila es solo una PISTA de UI; el precio autoritativo lo
// resuelve computePresupuestoLibreCatalogo() según LISTA_ACTIVA aguas abajo.
// ═══════════════════════════════════════════════════════════════════════════

import { flattenPerfilesLibre } from "./presupuestoLibreCatalogo.js";
import {
  PANELS_TECHO as DEF_PANELS_TECHO,
  PANELS_PARED as DEF_PANELS_PARED,
  FIJACIONES as DEF_FIJ,
  HERRAMIENTAS as DEF_HERR,
  SELLADORES as DEF_SELL,
  PERFIL_TECHO as DEF_PERFIL_TECHO,
  PERFIL_PARED as DEF_PERFIL_PARED,
} from "../data/constants.js";

/**
 * @typedef {object} ProductRow
 * @property {string} id        Id único estable (para React key + búsqueda).
 * @property {"panel"|"perfil"|"fijacion"|"sellador"} kind
 * @property {"panelLine"|"perfilQty"|"fijQty"|"sellQty"} addBy  Setter destino.
 * @property {string} [key]     Clave para los mapas qty (perfil/fij/sell).
 * @property {string} [familia] Solo panel: clave de PANELS_*.
 * @property {number} [espesor] Solo panel: espesor (mm).
 * @property {string} [colorDefault] Solo panel: primer color disponible.
 * @property {string} label
 * @property {string} [sku]
 * @property {number} [venta]
 * @property {number} [web]
 * @property {string} [unidad]
 * @property {string} category  Grupo BOM ("PANELES"|"PERFILERÍA"|"TORNILLERÍA"|"SELLADORES").
 * @property {string} searchText label+sku en minúsculas (para filtro rápido).
 */

/**
 * Construye el índice unificado de productos vendibles.
 * @param {object} [opts]
 * @param {object} [opts.catalog] Override de catálogo (p.ej. cache Panelin pricing).
 *   Mismo shape que consume computePresupuestoLibreCatalogo: { PANELS_TECHO,
 *   PANELS_PARED, FIJACIONES, HERRAMIENTAS, SELLADORES, PERFIL_TECHO, PERFIL_PARED }.
 * @returns {ProductRow[]} filas ordenadas por label (es-locale).
 */
export function buildProductCatalogIndex({ catalog } = {}) {
  const c = catalog || {};
  const PANELS_TECHO = c.PANELS_TECHO || DEF_PANELS_TECHO;
  const PANELS_PARED = c.PANELS_PARED || DEF_PANELS_PARED;
  const FIJACIONES = c.FIJACIONES || DEF_FIJ;
  const HERRAMIENTAS = c.HERRAMIENTAS !== undefined ? c.HERRAMIENTAS : DEF_HERR;
  const SELLADORES = c.SELLADORES || DEF_SELL;
  const PERFIL_TECHO = c.PERFIL_TECHO || DEF_PERFIL_TECHO;
  const PERFIL_PARED = c.PERFIL_PARED || DEF_PERFIL_PARED;

  /** @type {ProductRow[]} */
  const rows = [];
  const push = (row) => {
    row.searchText = `${row.label || ""} ${row.sku || ""}`.toLowerCase();
    rows.push(row);
  };

  // ── Paneles (techo + pared), una fila por espesor ──────────────────────────
  const allPanels = { ...PANELS_TECHO, ...PANELS_PARED };
  for (const [familia, panel] of Object.entries(allPanels)) {
    if (!panel || !panel.esp) continue;
    const colorDefault = Array.isArray(panel.col) && panel.col.length ? panel.col[0] : "Blanco";
    for (const [espKey, espData] of Object.entries(panel.esp)) {
      if (!espData) continue;
      const espesor = Number(espKey);
      push({
        id: `panel:${familia}:${espKey}`,
        kind: "panel",
        addBy: "panelLine",
        familia,
        espesor,
        colorDefault,
        label: `${panel.label} ${espesor}mm`,
        sku: `${familia}-${espesor}`,
        venta: espData.venta,
        web: espData.web,
        unidad: "m²",
        category: "PANELES",
      });
    }
  }

  // ── Perfilería (reusa el flattener canónico: ids pt:/pp:) ──────────────────
  for (const r of flattenPerfilesLibre(PERFIL_TECHO, PERFIL_PARED)) {
    push({
      id: r.id,
      kind: "perfil",
      addBy: "perfilQty",
      key: r.id,
      label: r.label,
      sku: r.sku,
      venta: r.venta,
      web: r.web,
      unidad: "unid",
      category: "PERFILERÍA",
    });
  }

  // ── Fijaciones + herramientas (ambos van al mapa libreFijQty) ──────────────
  const addAccessory = (source) => {
    for (const [slug, row] of Object.entries(source || {})) {
      if (!row) continue;
      push({
        id: `fij:${slug}`,
        kind: "fijacion",
        addBy: "fijQty",
        key: slug,
        label: row.label,
        sku: slug,
        venta: row.venta,
        web: row.web,
        unidad: row.unidad || "unid",
        category: "TORNILLERÍA",
      });
    }
  };
  addAccessory(FIJACIONES);
  addAccessory(HERRAMIENTAS);

  // ── Selladores ─────────────────────────────────────────────────────────────
  for (const [slug, row] of Object.entries(SELLADORES || {})) {
    if (!row) continue;
    push({
      id: `sell:${slug}`,
      kind: "sellador",
      addBy: "sellQty",
      key: slug,
      label: row.label,
      sku: slug,
      venta: row.venta,
      web: row.web,
      unidad: row.unidad || "unid",
      category: "SELLADORES",
    });
  }

  return rows.sort((a, b) => a.label.localeCompare(b.label, "es"));
}

/**
 * Precio "pista" para la UI según lista activa (misma lógica de fallback que p()).
 * @param {ProductRow} row
 * @param {"venta"|"web"} [listaPrecios]
 */
export function rowPriceHint(row, listaPrecios) {
  if (!row) return 0;
  return listaPrecios === "venta" ? (row.venta ?? row.web ?? 0) : (row.web ?? row.venta ?? 0);
}
