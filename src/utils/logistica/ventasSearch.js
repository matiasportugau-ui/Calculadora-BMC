/**
 * Ventas client search filter (Ops UX F2).
 * Pure — does not fetch CSV. Fixes legacy r[7]-only matching.
 */

import {
  normalizeSearchText,
  classifyVentasCoordination,
  batchColorFromKey,
  coordinationChipCaption,
} from "./coordinationStatus.js";
import {
  withSaleStatusChip,
  isJunkVentasMappedRow,
  isActiveLogisticsSale,
} from "./saleState.js";
import { isJunkVentasRow } from "./ventasSheetMap.js";

export { normalizeSearchText };

/**
 * Build searchable haystack from a mapped Ventas row (mapVentasRow shape).
 * @param {object} mapped
 * @returns {string}
 */
export function mappedRowSearchHaystack(mapped = {}) {
  return normalizeSearchText(
    [
      mapped.nombre,
      mapped.orderId,
      mapped.cotizacionId,
      mapped.pickupId,
      mapped.dir,
      mapped.tel,
      mapped.estadoText,
      mapped.zona,
      mapped.rawSheetText,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

/**
 * @param {object} mapped mapVentasRow result
 * @param {string} queryRaw
 * @returns {boolean}
 */
export function mappedRowMatchesQuery(mapped, queryRaw) {
  const q = normalizeSearchText(queryRaw);
  if (!q) return true;
  return mappedRowSearchHaystack(mapped).includes(q);
}

/**
 * @param {object[]} mappedRows
 * @param {string} queryRaw
 * @returns {object[]}
 */
export function filterMappedVentasRows(mappedRows, queryRaw) {
  const list = Array.isArray(mappedRows) ? mappedRows : [];
  const q = normalizeSearchText(queryRaw);
  if (!q) return list;
  return list.filter((row) => mappedRowMatchesQuery(row, q));
}

/**
 * Attach coordination + sale-state chip DTO for UI.
 * @param {object} mapped
 * @returns {object}
 */
export function withCoordinationChip(mapped) {
  // Prefer full sale chip (includes camión / con_pendientes / entregado).
  return withSaleStatusChip(mapped);
}

/**
 * Drop junk section headers and optionally archived (entregado/enviado) rows.
 * @param {object[]} mappedRows
 * @param {{ activeOnly?: boolean }} [opts]
 */
export function filterOperationalVentasRows(mappedRows, opts = {}) {
  const list = Array.isArray(mappedRows) ? mappedRows : [];
  return list.filter((row) => {
    if (isJunkVentasRow(row) || isJunkVentasMappedRow(row)) return false;
    if (!String(row.nombre || "").trim() && !String(row.orderId || "").trim()) return false;
    if (opts.activeOnly) {
      const chip = withSaleStatusChip(row);
      if (!isActiveLogisticsSale(chip.saleStatus || chip.coordination)) return false;
    }
    return true;
  });
}

/**
 * Map + filter + chip pipeline for buscarSheet.
 * @param {object[]} mappedRows from mapVentasRow
 * @param {string} queryRaw
 * @returns {object[]}
 */
export function searchMappedVentasRows(mappedRows, queryRaw) {
  const operational = filterOperationalVentasRows(mappedRows, { activeOnly: false });
  return filterMappedVentasRows(operational, queryRaw).map(withCoordinationChip);
}
