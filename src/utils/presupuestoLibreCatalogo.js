// ═══════════════════════════════════════════════════════════════════════════
// presupuestoLibreCatalogo.js — Catálogo completo “Presupuesto libre” (paneles,
// perfilería, tornillería/herrajes, selladores, flete, extraordinarios)
// Usado por la UI (backup/V3) y por POST /calc/cotizar/presupuesto-libre
// ═══════════════════════════════════════════════════════════════════════════

import { calcTotalesSinIVA } from "./calculations.js";
import {
  PANELS_TECHO as DEF_PANELS_TECHO,
  PANELS_PARED as DEF_PANELS_PARED,
  FIJACIONES as DEF_FIJ,
  HERRAMIENTAS as DEF_HERR,
  SELLADORES as DEF_SELL,
  SERVICIOS as DEF_SERV,
} from "../data/constants.js";

/**
 * Lista plana de filas de perfilería para pickers (ids estables pt:/pp:…).
 * @param {object} perfilTecho
 * @param {object} perfilPared
 */
export function flattenPerfilesLibre(perfilTecho, perfilPared) {
  const out = [];
  const prettyTipo = (s) => s.replace(/_/g, " ");
  const addRow = (id, labelBase, row) => {
    if (!row || !row.sku) return;
    const lab = row.label ? row.label : labelBase;
    out.push({
      id,
      label: `${lab} · barra ${row.largo}m · ${row.sku}`,
      sku: row.sku,
      venta: row.venta,
      web: row.web,
      largo: row.largo,
    });
  };
  for (const [tipo, byFam] of Object.entries(perfilTecho || {})) {
    if (!byFam || typeof byFam !== "object") continue;
    for (const [fam, byEsp] of Object.entries(byFam)) {
      if (!byEsp || typeof byEsp !== "object") continue;
      for (const [espKey, row] of Object.entries(byEsp)) {
        const espLab = espKey === "_all" ? "" : ` ${espKey}mm`;
        const id = `pt:${tipo}:${fam}:${espKey}`;
        const base = `${prettyTipo(tipo)} · ${fam}${espLab}`;
        addRow(id, base, row);
      }
    }
  }
  for (const [tipo, byFam] of Object.entries(perfilPared || {})) {
    if (!byFam || typeof byFam !== "object") continue;
    for (const [fam, byEsp] of Object.entries(byFam)) {
      if (!byEsp || typeof byEsp !== "object") continue;
      for (const [espKey, row] of Object.entries(byEsp)) {
        const espLab = espKey === "_all" ? "" : ` ${espKey}mm`;
        const id = `pp:${tipo}:${fam}:${espKey}`;
        const base = `${prettyTipo(tipo)} · ${fam}${espLab}`;
        addRow(id, base, row);
      }
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "es"));
}

/**
 * @typedef {object} PresupuestoLibreCatalog
 * @property {object} [PANELS_TECHO]
 * @property {object} [PANELS_PARED]
 * @property {object} [FIJACIONES]
 * @property {object} [HERRAMIENTAS]
 * @property {object} [SELLADORES]
 * @property {object} [SERVICIOS]
 */

/**
 * Motor de “presupuesto libre” alineado a la UI de acordeones.
 * @param {object} input
 * @param {string} [input.listaPrecios] "venta" | "web"
 * @param {Array<{familia?: string, espesor?: number|string, color?: string, m2?: number}>} [input.librePanelLines]
 * @param {Record<string, number>} [input.librePerfilQty]
 * @param {Map<string, object>|object} [input.perfilCatalogById]
 * @param {Record<string, number>} [input.libreFijQty]
 * @param {Record<string, number>} [input.libreSellQty]
 * @param {number} [input.flete]
 * @param {{ texto?: string, precio?: string|number, unidades?: string, cantidad?: string|number }} [input.libreExtra]
 * @param {PresupuestoLibreCatalog} [input.catalog] Si se omite, usa constants base.
 */
export function computePresupuestoLibreCatalogo(input) {
  const {
    listaPrecios,
    librePanelLines,
    librePerfilQty,
    perfilCatalogById,
    libreFijQty,
    libreSellQty,
    flete,
    libreExtra,
    catalog = {},
  } = input || {};

  const PANELS_TECHO = catalog.PANELS_TECHO || DEF_PANELS_TECHO;
  const PANELS_PARED = catalog.PANELS_PARED || DEF_PANELS_PARED;
  const FIJACIONES = catalog.FIJACIONES || DEF_FIJ;
  const HERRAMIENTAS = catalog.HERRAMIENTAS !== undefined ? catalog.HERRAMIENTAS : DEF_HERR;
  const SELLADORES = catalog.SELLADORES || DEF_SELL;
  const SERVICIOS = catalog.SERVICIOS || DEF_SERV;

  const lista = listaPrecios === "venta" ? "venta" : "web";
  const priceOf = (row) => (lista === "venta" ? (row.venta ?? row.web ?? 0) : (row.web ?? row.venta ?? 0));
  const allPanels = { ...PANELS_TECHO, ...PANELS_PARED };
  const grouped = {
    PANELES: [],
    PERFILERÍA: [],
    TORNILLERÍA: [],
    SELLADORES: [],
    SERVICIOS: [],
    EXTRAORDINARIOS: [],
  };
  const warnings = [];

  for (const line of librePanelLines || []) {
    const m2 = Number(line.m2);
    if (!line.familia || line.espesor === "" || line.espesor === null || line.espesor === undefined || !m2 || m2 <= 0) continue;
    const panel = allPanels[line.familia];
    if (!panel) {
      warnings.push(`Familia desconocida: ${line.familia}`);
      continue;
    }
    const espNum = Number(line.espesor);
    const espData = panel.esp[espNum] || panel.esp[line.espesor];
    if (!espData) {
      warnings.push(`Espesor no disponible para ${panel.label}`);
      continue;
    }
    const pu = priceOf(espData);
    let col = line.color;
    if (col && panel.col && !panel.col.includes(col)) col = panel.col[0] || "";
    if (!col && panel.col && panel.col.length) col = panel.col[0];
    const label = `${panel.label} ${espNum}mm${col ? ` · ${col}` : ""}`;
    grouped.PANELES.push({
      label,
      sku: `${line.familia}-${espNum}`,
      cant: m2,
      unidad: "m²",
      pu,
      total: +(m2 * pu).toFixed(2),
    });
  }

  const idMap = perfilCatalogById instanceof Map ? perfilCatalogById : new Map();
  for (const [id, qty] of Object.entries(librePerfilQty || {})) {
    const q = Number(qty);
    if (!q || q <= 0) continue;
    const meta = idMap.get(id);
    if (!meta) continue;
    const pu = priceOf(meta);
    grouped.PERFILERÍA.push({
      label: meta.label,
      sku: meta.sku,
      cant: q,
      unidad: "unid",
      pu,
      total: +(q * pu).toFixed(2),
    });
  }

  for (const [key, qty] of Object.entries(libreFijQty || {})) {
    const q = Number(qty);
    if (!q || q <= 0) continue;
    const f = FIJACIONES[key];
    const h = HERRAMIENTAS?.[key];
    const row = f || h;
    if (!row) continue;
    const pu = priceOf(row);
    const unidad = row.unidad || "unid";
    grouped.TORNILLERÍA.push({
      label: row.label,
      sku: key,
      cant: q,
      unidad,
      pu,
      total: +(q * pu).toFixed(2),
    });
  }

  for (const [key, qty] of Object.entries(libreSellQty || {})) {
    const q = Number(qty);
    if (!q || q <= 0) continue;
    const s = SELLADORES[key];
    if (!s) continue;
    const pu = priceOf(s);
    const unidad = s.unidad || "unid";
    grouped.SELLADORES.push({
      label: s.label,
      sku: key,
      cant: q,
      unidad,
      pu,
      total: +(q * pu).toFixed(2),
    });
  }

  const fleteNum = Number(flete);
  if (fleteNum > 0) {
    const fl = SERVICIOS.flete;
    grouped.SERVICIOS.push({
      label: `${fl.label} · importe informado`,
      sku: "FLETE",
      cant: 1,
      unidad: "servicio",
      pu: fleteNum,
      total: +fleteNum.toFixed(2),
    });
  }

  const ex = libreExtra || {};
  const texto = (ex.texto || "").trim();
  const precioRaw = ex.precio === "" || ex.precio == null ? NaN : parseFloat(String(ex.precio).replace(",", "."));
  const cantRaw = ex.cantidad === "" || ex.cantidad == null ? NaN : parseFloat(String(ex.cantidad).replace(",", "."));
  const unidadStr = (ex.unidades || "").trim();
  const hasText = texto.length > 0;
  const hasPrecio = !Number.isNaN(precioRaw) && precioRaw >= 0;
  const hasCant = !Number.isNaN(cantRaw) && cantRaw > 0;
  if (hasText || hasPrecio || hasCant || unidadStr) {
    const label = hasText ? texto : "Partida extraordinaria";
    const unidad = unidadStr || "unid";
    const puE = hasPrecio ? precioRaw : 0;
    const cE = hasCant ? cantRaw : 1;
    grouped.EXTRAORDINARIOS.push({
      label,
      sku: "EXTRA",
      cant: cE,
      unidad,
      pu: puE,
      total: +(cE * puE).toFixed(2),
    });
  }

  const allItems = Object.values(grouped).flat();
  const totales = calcTotalesSinIVA(allItems);
  const libreGroups = ["PANELES", "PERFILERÍA", "TORNILLERÍA", "SELLADORES", "SERVICIOS", "EXTRAORDINARIOS"]
    .map((title) => ({ title, items: grouped[title] }))
    .filter((g) => g.items.length > 0);
  return { allItems, totales, warnings, libreGroups, presupuestoLibre: true };
}
