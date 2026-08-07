/**
 * Manual package layout overrides (Ops UX F5).
 * Pure — drives existing cargoPacking manualOrderKeys + rowOverrides.
 *
 * Physical rule (stackConstraints): panels never on profiles. Engine enforces
 * on place; callers may audit with validatePlacedStacks after placeCargo.
 */

import { validatePlacedStacks, PANEL_ON_PROFILE_REJECT_ES } from "./stackConstraints.js";

export { validatePlacedStacks, PANEL_ON_PROFILE_REJECT_ES };

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
 * Place active next to neighbor in manual order.
 * position "above" → earlier in load order (typically lower z first then stack on top depends on engine);
 * position "below" → later in load order.
 * Also aligns active to neighbor's fila when neighbor has a row.
 *
 * @param {{
 *   keys?: string[],
 *   activeKey: string,
 *   neighborKey: string,
 *   position?: "above" | "below",
 *   rowOverrides?: Record<string, number>,
 *   placed?: object[],
 * }} input
 */
export function moveRelativeToNeighbor(input = {}) {
  const activeKey = input.activeKey;
  const neighborKey = input.neighborKey;
  const position = input.position === "below" ? "below" : "above";
  let keys = ensureManualOrderKeys(input.keys || [], input.placed || []);
  let rowOverrides = { ...(input.rowOverrides || {}) };

  if (!activeKey || !neighborKey || activeKey === neighborKey) {
    return { manualPkgOrderKeys: keys, rowOverrides };
  }

  keys = keys.filter((k) => k && k !== activeKey);
  if (!keys.includes(neighborKey)) keys.push(neighborKey);

  const nIdx = keys.indexOf(neighborKey);
  if (position === "above") {
    keys.splice(nIdx, 0, activeKey);
  } else {
    keys.splice(nIdx + 1, 0, activeKey);
  }

  // Match neighbor fila when known from overrides or placed geometry
  let neighborRow = rowOverrides[neighborKey];
  if (neighborRow == null && Array.isArray(input.placed)) {
    const np = input.placed.find((p) => p?.stableKey === neighborKey);
    if (np && (np.row === 0 || np.row === 1)) neighborRow = np.row;
  }
  if (neighborRow === 0 || neighborRow === 1) {
    rowOverrides = applyPackageRowOverride(rowOverrides, activeKey, neighborRow);
  }

  return { manualPkgOrderKeys: keys, rowOverrides };
}

/**
 * Find contiguous neighbor in same row (by zBase stack).
 * @param {object[]} placed
 * @param {object} pkg
 * @returns {{ above: object|null, below: object|null }}
 */
export function findStackNeighbors(placed = [], pkg) {
  if (!pkg) return { above: null, below: null };
  const row = Number(pkg.row);
  const sameRow = (Array.isArray(placed) ? placed : [])
    .filter((p) => p && p.stableKey !== pkg.stableKey && Number(p.row) === row)
    .filter((p) => {
      // overlapping x range roughly same stack column
      const a0 = Number(pkg.xStart) || 0;
      const a1 = a0 + (Number(pkg.len) || 0);
      const b0 = Number(p.xStart) || 0;
      const b1 = b0 + (Number(p.len) || 0);
      return a0 < b1 - 0.01 && b0 < a1 - 0.01;
    })
    .sort((a, b) => (Number(a.zBase) || 0) - (Number(b.zBase) || 0));

  const z = Number(pkg.zBase) || 0;
  let above = null;
  let below = null;
  for (const p of sameRow) {
    const pz = Number(p.zBase) || 0;
    if (pz > z + 0.001) {
      if (!above || pz < (Number(above.zBase) || 0)) above = p;
    } else if (pz < z - 0.001) {
      if (!below || pz > (Number(below.zBase) || 0)) below = p;
    }
  }
  // If no geometric neighbors, fall back to any same-row package as stack peer
  if (!above && !below && sameRow.length) {
    const peer = sameRow[sameRow.length - 1];
    return { above: peer, below: sameRow[0] === peer ? null : sameRow[0] };
  }
  return { above, below };
}

/**
 * Apply a package drop / fila change and force manual layout mode.
 * @param {{
 *   rowOverrides?: Record<string, number>,
 *   manualPkgOrderKeys?: string[],
 *   stableKey: string,
 *   targetRow?: 0|1|number,
 *   beforeKey?: string|null,
 *   neighborKey?: string|null,
 *   stackPosition?: "above" | "below",
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
  if (stableKey && input.neighborKey && input.stackPosition) {
    const moved = moveRelativeToNeighbor({
      keys: manualPkgOrderKeys,
      activeKey: stableKey,
      neighborKey: input.neighborKey,
      position: input.stackPosition,
      rowOverrides,
      placed: input.placed,
    });
    manualPkgOrderKeys = moved.manualPkgOrderKeys;
    rowOverrides = moved.rowOverrides;
  }

  return {
    cargoLayoutMode: "manual",
    rowOverrides,
    manualPkgOrderKeys,
  };
}
