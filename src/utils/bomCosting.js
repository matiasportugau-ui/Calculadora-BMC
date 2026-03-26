// ═══════════════════════════════════════════════════════════════════════════
// bomCosting.js — Costo vs venta por línea de BOM (uso interno / hoja Costeo)
// ═══════════════════════════════════════════════════════════════════════════

import { FIJACIONES, HERRAMIENTAS, SELLADORES } from "../data/constants.js";

function scanPerfilsForSku(perfilTecho, perfilPared, sku) {
  if (!sku) return null;
  for (const tree of [perfilTecho, perfilPared]) {
    if (!tree || typeof tree !== "object") continue;
    for (const byFam of Object.values(tree)) {
      if (!byFam || typeof byFam !== "object") continue;
      for (const byEsp of Object.values(byFam)) {
        if (!byEsp || typeof byEsp !== "object") continue;
        for (const row of Object.values(byEsp)) {
          if (row && row.sku === sku && typeof row.costo === "number") return row.costo;
        }
      }
    }
  }
  return null;
}

/**
 * Costo unitario USD s/IVA por línea de BOM (null si no hay dato en catálogo).
 * @param {object} item — { sku, cant, ... }
 * @param {object} ctx — PANELS_TECHO, PANELS_PARED, PERFIL_TECHO, PERFIL_PARED, fleteCostUsd (number|undefined)
 */
export function resolveBomLineCostUnit(item, ctx) {
  const sku = item?.sku;
  if (!sku) return null;
  if (sku === "FLETE") {
    const c = ctx?.fleteCostUsd;
    if (typeof c === "number" && !Number.isNaN(c) && c >= 0) return c;
    return null;
  }
  if (FIJACIONES[sku]?.costo != null) return FIJACIONES[sku].costo;
  if (HERRAMIENTAS?.[sku]?.costo != null) return HERRAMIENTAS[sku].costo;
  if (SELLADORES[sku]?.costo != null) return SELLADORES[sku].costo;
  const m = String(sku).match(/^(.+)-(\d+)$/);
  if (m) {
    const fam = m[1];
    const esp = Number(m[2]);
    const pt = ctx?.PANELS_TECHO?.[fam] || ctx?.PANELS_PARED?.[fam];
    const co = pt?.esp?.[esp]?.costo;
    if (typeof co === "number") return co;
  }
  const pc = scanPerfilsForSku(ctx?.PERFIL_TECHO, ctx?.PERFIL_PARED, sku);
  if (pc != null) return pc;
  return null;
}

/**
 * @param {Array<{ title: string, items: object[] }>} groups
 * @param {object} ctx
 * @returns {{ rows: object[], sumCostAll: number, sumSaleForMargin: number, sumCostForMargin: number, totalMargin: number, totalMarginPct: number|null, fleteMissingCost: boolean }}
 */
export function buildCostingReport(groups, ctx) {
  const rows = [];
  let sumCostAll = 0;
  let sumSaleForMargin = 0;
  let sumCostForMargin = 0;
  const fleteVenta = Number(ctx?.fleteVentaUsd) || 0;
  const fleteCostOk = typeof ctx?.fleteCostUsd === "number" && !Number.isNaN(ctx.fleteCostUsd) && ctx.fleteCostUsd >= 0;
  const fleteMissingCost = fleteVenta > 0 && !fleteCostOk;

  for (const g of groups || []) {
    for (const it of g.items || []) {
      const sale = Number(it.total) || 0;
      const cant = Number(it.cant) || 0;
      const sku = it.sku;
      const isFlete = sku === "FLETE";
      const unitCost = resolveBomLineCostUnit(it, ctx);
      const costTotal = unitCost != null ? +(unitCost * cant).toFixed(2) : null;
      let margin = null;
      let marginPct = null;
      if (costTotal != null) {
        margin = +(sale - costTotal).toFixed(2);
        if (costTotal > 0) marginPct = +(((sale - costTotal) / costTotal) * 100).toFixed(1);
      }
      let countForMargin = true;
      if (isFlete && fleteMissingCost) countForMargin = false;
      if (costTotal == null) countForMargin = false;

      if (costTotal != null) sumCostAll += costTotal;
      if (countForMargin) {
        sumSaleForMargin += sale;
        sumCostForMargin += costTotal;
      }

      rows.push({
        group: g.title,
        label: it.label,
        sku: it.sku || "—",
        cant,
        unidad: it.unidad || "—",
        unitCost,
        costTotal,
        pu: it.pu,
        saleTotal: sale,
        margin,
        marginPct,
        countForMargin,
        isFlete,
      });
    }
  }

  const totalMargin = +(sumSaleForMargin - sumCostForMargin).toFixed(2);
  const totalMarginPct = sumCostForMargin > 0 ? +(((sumSaleForMargin - sumCostForMargin) / sumCostForMargin) * 100).toFixed(1) : null;

  return {
    rows,
    sumCostAll,
    sumSaleForMargin,
    sumCostForMargin,
    totalMargin,
    totalMarginPct,
    fleteMissingCost,
  };
}
