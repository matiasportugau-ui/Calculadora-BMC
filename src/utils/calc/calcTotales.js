// ═══════════════════════════════════════════════════════════════════════════
// src/utils/calc/calcTotales.js — Totals and IVA calculation
// ═══════════════════════════════════════════════════════════════════════════

import { getIVA } from "../calculatorConfig.js";

/**
 * Calculate subtotal (sin IVA), IVA amount, and total (con IVA) from a BOM items array.
 *
 * Formula: subtotalSinIVA = Σ item.total
 *          iva = subtotalSinIVA × ivaRate   (ivaRate from getIVA(), typically 0.22)
 *          totalFinal = subtotalSinIVA + iva
 *
 * @param {Array<{total: number}>} allItems - BOM line items, each with a `total` (pre-IVA UYU)
 * @returns {{ subtotalSinIVA: number, iva: number, totalFinal: number }}
 */
export function calcTotalesSinIVA(allItems) {
  const ivaRate = getIVA();
  const sumSinIVA = allItems.reduce((s, i) => s + (i.total || 0), 0);
  const subtotalSinIVA = +sumSinIVA.toFixed(2);
  const iva = +(subtotalSinIVA * ivaRate).toFixed(2);
  const totalConIVA = +(subtotalSinIVA + iva).toFixed(2);
  return { subtotalSinIVA, iva, totalFinal: totalConIVA };
}
