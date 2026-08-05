/**
 * Manual package layout overrides (Ops UX F5).
 * Pure — drives existing cargoPacking manualOrderKeys + rowOverrides.
 */

/**
 * Force a package onto fila A (0) or B (1).
 * @param {Record<string, number>} rowOverrides
 * @param {string} stableKey
 * @param {0|1|number} targetRow
 * @returns {Record<string, number>}
 */
export function applyPackageRowOverride(rowOverrides = {}, stableKey, targetRow) {
  if (!stableKey) return { ...(rowOverrides || {}) };
  const row = Number(targetRow) === 1 ? 1 : 0;
  return { ...(rowOverrides || {}), [stableKey]: row };
}

/**
 * Move activeKey before beforeKey in manual order list (insert at start if beforeKey missing).
 * @param {string[]} keys
 * @param {string} activeKey
 * @param {string|null} beforeKey
 * @returns {string[]}
 */
export function moveStableKeyBefore(keys = [], activeKey, beforeKey) {
  if (!activeKey) return Array.isArray(keys) ? [...keys] : [];
  const list = (Array.isArray(keys) ? keys : []).filter((k) => k && k !== activeKey);
  if (!beforeKey || !list.includes(beforeKey)) {
    return [activeKey, ...list];
  }
  const idx = list.indexOf(beforeKey);
  list.splice(idx, 0, activeKey);
  return list;
}

/**
 * Ensure all placed stableKeys appear in manual order (append missing).
 * @param {string[]} keys
 * @param {object[]} placed
 * @returns {string[]}
 */
export function ensureManualOrderKeys(keys = [], placed = []) {
  const base = Array.isArray(keys) ? [...keys] : [];
  const seen = new Set(base);
  for (const p of placed || []) {
    const k = p?.stableKey;
    if (k && !seen.has(k)) {
      base.push(k);
      seen.add(k);
    }
  }
  return base;
}

/**
 * Apply a package drop / fila change and force manual layout mode.
 * @param {{
 *   rowOverrides?: Record<string, number>,
 *   manualPkgOrderKeys?: string[],
 *   stableKey: string,
 *   targetRow?: 0|1|number,
 *   beforeKey?: string|null,
 *   placed?: object[],
 * }} input
 */
export function applyPackageLayoutChange(input = {}) {
  const stableKey = input.stableKey;
  let rowOverrides = { ...(input.rowOverrides || {}) };
  let manualPkgOrderKeys = ensureManualOrderKeys(input.manualPkgOrderKeys || [], input.placed || []);

  if (stableKey && input.targetRow != null) {
    rowOverrides = applyPackageRowOverride(rowOverrides, stableKey, input.targetRow);
  }
  if (stableKey && input.beforeKey !== undefined) {
    manualPkgOrderKeys = moveStableKeyBefore(manualPkgOrderKeys, stableKey, input.beforeKey);
  }

  return {
    cargoLayoutMode: "manual",
    rowOverrides,
    manualPkgOrderKeys,
  };
}
