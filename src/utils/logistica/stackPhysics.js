/**
 * Physical interaction helpers for free-drag / 3D visor.
 * - Buried packages (something on top) cannot move alone
 * - Length-on-shorter soft limit (confirm + LoadWarning)
 */

const FOOTPRINT_EPS = 0.05;
const LEN_EPS = 0.02;

/**
 * Axis-aligned footprint overlap on bed (x length, lateral via row).
 * @param {object} a
 * @param {object} b
 */
export function footprintsOverlap(a, b) {
  if (!a || !b) return false;
  const a0 = Number(a.xStart) || 0;
  const a1 = a0 + (Number(a.len) || 0);
  const b0 = Number(b.xStart) || 0;
  const b1 = b0 + (Number(b.len) || 0);
  if (a1 <= b0 + FOOTPRINT_EPS || b1 <= a0 + FOOTPRINT_EPS) return false;
  // same row or free-drag lateral proximity (row bands)
  const ra = Number(a.row) === 1 ? 1 : 0;
  const rb = Number(b.row) === 1 ? 1 : 0;
  if (ra !== rb) return false;
  return true;
}

/**
 * Packages stacked above pkg (higher zBase, overlapping footprint or same stackId).
 * @param {object[]} placed
 * @param {object} pkg
 * @returns {object[]}
 */
export function findPackagesAbove(placed = [], pkg) {
  if (!pkg) return [];
  const z0 = Number(pkg.zBase) || 0;
  const key = pkg.stableKey || pkg.id;
  const list = Array.isArray(placed) ? placed : [];
  return list.filter((p) => {
    if (!p || (p.stableKey || p.id) === key) return false;
    const zp = Number(p.zBase) || 0;
    if (zp <= z0 + 0.001) return false;
    if (pkg.stackId && p.stackId && String(p.stackId).replace(/:free$/, "") === String(pkg.stackId).replace(/:free$/, "")) {
      return true;
    }
    return footprintsOverlap(pkg, p);
  });
}

/**
 * @param {object[]} placed
 * @param {object} pkg
 */
export function isBuried(placed, pkg) {
  return findPackagesAbove(placed, pkg).length > 0;
}

/**
 * Can start drag on pkg given multi-select keys (stableKeys).
 * Buried OK only if every package above is also selected.
 * @param {object[]} placed
 * @param {object} pkg
 * @param {string[]} [multiSelectKeys]
 */
export function canStartDrag(placed, pkg, multiSelectKeys = []) {
  if (!pkg) return { ok: false, reason: "no_pkg" };
  const above = findPackagesAbove(placed, pkg);
  if (!above.length) return { ok: true, above: [] };
  const sel = new Set((multiSelectKeys || []).filter(Boolean));
  const key = pkg.stableKey || pkg.id;
  if (!sel.has(key)) {
    return {
      ok: false,
      reason: "buried",
      above,
      message: "Primero quita el objeto de arriba o selecciónalo para moverlo en grupo",
    };
  }
  const missing = above.filter((p) => !sel.has(p.stableKey || p.id));
  if (missing.length) {
    return {
      ok: false,
      reason: "buried",
      above,
      missing,
      message: "Primero quita el objeto de arriba o selecciónalo para moverlo en grupo",
    };
  }
  return { ok: true, above, groupMove: true };
}

/**
 * Support length of packages under a candidate placement (same row, lower z).
 * @param {object[]} placed
 * @param {{ xStart: number, len: number, row: number, zBase: number, stableKey?: string }} candidate
 * @returns {{ supportLen: number, supportPkg: object|null }}
 */
export function findSupportUnder(placed = [], candidate = {}) {
  const z0 = Number(candidate.zBase) || 0;
  const row = Number(candidate.row) === 1 ? 1 : 0;
  const key = candidate.stableKey;
  let best = null;
  let bestTop = -1;
  for (const p of placed || []) {
    if (!p) continue;
    if (key && (p.stableKey === key || p.id === key)) continue;
    if ((Number(p.row) === 1 ? 1 : 0) !== row) continue;
    const top = (Number(p.zBase) || 0) + (Number(p.h) || 0);
    if (top > z0 + 0.05) continue; // not under
    if (!footprintsOverlap(candidate, p) && !(Math.abs(top - z0) < 0.15 && footprintsOverlap(
      { ...candidate, zBase: 0 },
      { ...p, zBase: 0 },
    ))) {
      // require x-overlap
      const a0 = Number(candidate.xStart) || 0;
      const a1 = a0 + (Number(candidate.len) || 0);
      const b0 = Number(p.xStart) || 0;
      const b1 = b0 + (Number(p.len) || 0);
      if (a1 <= b0 + FOOTPRINT_EPS || b1 <= a0 + FOOTPRINT_EPS) continue;
    }
    if (top >= bestTop) {
      bestTop = top;
      best = p;
    }
  }
  if (!best) return { supportLen: Number(candidate.len) || 0, supportPkg: null };
  return { supportLen: Number(best.len) || 0, supportPkg: best };
}

/**
 * Soft check: placing longer package on shorter support.
 * @param {object} upper - package being placed (needs len)
 * @param {number} supportLen
 */
export function checkLengthOnShorter(upper, supportLen) {
  const len = Number(upper?.len) || 0;
  const sup = Number(supportLen) || 0;
  if (len <= 0 || sup <= 0) return { ok: true };
  if (len > sup + LEN_EPS) {
    return {
      ok: false,
      soft: true,
      code: "length_on_shorter",
      message:
        "Esto presenta una limitante física (bulto más largo sobre uno más corto). ¿Lo colocamos igual?",
      upperLen: len,
      supportLen: sup,
    };
  }
  return { ok: true };
}

/**
 * Toggle multi-select set.
 * @param {string[]} keys
 * @param {string} stableKey
 * @param {boolean} [shift]
 */
export function toggleMultiSelect(keys = [], stableKey, shift = true) {
  if (!stableKey) return Array.isArray(keys) ? [...keys] : [];
  if (!shift) return [stableKey];
  const set = new Set(keys || []);
  if (set.has(stableKey)) set.delete(stableKey);
  else set.add(stableKey);
  return [...set];
}

export const BURIED_TOAST_ES =
  "Primero quita el objeto de arriba o selecciónalo para moverlo en grupo";
