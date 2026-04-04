// ═══════════════════════════════════════════════════════════════════════════
// src/utils/calc/calcLibre.js — Presupuesto libre (manual line items)
// ═══════════════════════════════════════════════════════════════════════════

import { p } from "../../data/constants.js";
import { getPricing } from "../../data/pricing.js";
import { calcTotalesSinIVA } from "./calcTotales.js";

/**
 * Build a BOM from manual line items selected from the FIJACIONES / HERRAMIENTAS catalogs.
 *
 * Business context: "Presupuesto libre" lets a vendor manually compose a quote
 * from hardware/tools without specifying panel geometry. Used for accessories-only orders.
 *
 * @param {Array<{ bucket?: "FIJACIONES"|"HERRAMIENTAS", id: string, cant: number }>} lineas
 *   Each entry references a catalog item by bucket + id with a quantity.
 *   Items with cant ≤ 0 or missing id are ignored.
 * @returns {{ presupuestoLibre: true, allItems: object[], fijaciones: object, totales: object, warnings: string[] }}
 */
export function calcPresupuestoLibre(lineas = []) {
  const pricing = getPricing();
  const c = (x) => (x?.costo ?? 0);
  const items = [];
  for (const row of lineas) {
    if (!row || row.id == null || row.cant == null || Number(row.cant) <= 0) continue;
    const bucket = row.bucket === "HERRAMIENTAS" ? "HERRAMIENTAS" : "FIJACIONES";
    const data = bucket === "HERRAMIENTAS" ? pricing.HERRAMIENTAS?.[row.id] : pricing.FIJACIONES?.[row.id];
    if (!data) continue;
    const pu = p(data);
    const co = c(data);
    const cant = Number(row.cant);
    items.push({
      label: data.label,
      sku: row.id,
      cant,
      unidad: data.unidad || "unid",
      pu,
      costo: co,
      total: +(cant * pu).toFixed(2),
    });
  }
  const sub = items.reduce((s, i) => s + i.total, 0);
  const totales = calcTotalesSinIVA(items);
  return {
    presupuestoLibre: true,
    allItems: items,
    fijaciones: { items, total: +sub.toFixed(2) },
    totales,
    warnings: [],
  };
}
