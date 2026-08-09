/**
 * Free-Drag layout overrides for ops.
 * When a package has a free position, engine geometry is replaced so operators
 * can place bultos that the packer cannot express yet.
 *
 * freePositions: Record<stableKey, { xStart, zBase, row, freeDrag?: true }>
 */

/**
 * @param {unknown} pos
 * @returns {{ xStart: number, zBase: number, row: 0|1, freeDrag: true } | null}
 */
export function normalizeFreePosition(pos) {
  if (!pos || typeof pos !== "object") return null;
  const xStart = Number(pos.xStart);
  const zBase = Number(pos.zBase);
  const row = Number(pos.row) === 1 ? 1 : 0;
  if (!Number.isFinite(xStart) || !Number.isFinite(zBase)) return null;
  const out = {
    xStart,
    zBase: Math.max(0, zBase),
    row,
    freeDrag: true,
  };
  if (pos.zone === "yard" || pos.zone === "truck") out.zone = pos.zone;
  if (pos.yardStopId != null && pos.yardStopId !== "") out.yardStopId = String(pos.yardStopId);
  return out;
}

/**
 * @param {Record<string, unknown>} [map]
 * @returns {Record<string, { xStart: number, zBase: number, row: 0|1, freeDrag: true }>}
 */
export function normalizeFreePositionsMap(map = {}) {
  const out = {};
  if (!map || typeof map !== "object") return out;
  for (const [key, val] of Object.entries(map)) {
    if (!key) continue;
    const n = normalizeFreePosition(val);
    if (n) out[key] = n;
  }
  return out;
}

/**
 * @param {Record<string, object>} map
 * @param {string} stableKey
 * @param {{ xStart?: number, zBase?: number, row?: number, len?: number }} pos
 * @param {{ truckL?: number, maxH?: number }} [bounds]
 */
export function setFreePosition(map = {}, stableKey, pos = {}, bounds = {}) {
  if (!stableKey) return normalizeFreePositionsMap(map);
  const truckL = Number(bounds.truckL);
  const maxH = Number(bounds.maxH);
  const len = Math.max(0.1, Number(pos.len) || 0.1);
  let xStart = Number(pos.xStart);
  let zBase = Number(pos.zBase);
  if (!Number.isFinite(xStart)) xStart = 0;
  if (!Number.isFinite(zBase)) zBase = 0;
  // Soft clamp: allow slight overhang past bed, keep height non-negative
  if (Number.isFinite(truckL) && truckL > 0) {
    xStart = Math.max(-2, Math.min(truckL + 2 - len * 0.1, xStart));
  }
  zBase = Math.max(0, zBase);
  if (Number.isFinite(maxH) && maxH > 0) {
    zBase = Math.min(maxH + 0.5, zBase);
  }
  const next = {
    ...normalizeFreePositionsMap(map),
    [stableKey]: normalizeFreePosition({
      xStart,
      zBase,
      row: pos.row,
      freeDrag: true,
      zone: pos.zone,
      yardStopId: pos.yardStopId,
    }),
  };
  return next;
}

/**
 * @param {Record<string, object>} map
 * @param {string} stableKey
 */
export function clearFreePosition(map = {}, stableKey) {
  const next = { ...normalizeFreePositionsMap(map) };
  if (stableKey) delete next[stableKey];
  return next;
}

/**
 * Apply free-drag overrides onto a placeCargo result (immutable).
 * @param {object} cargo
 * @param {Record<string, object>} freePositions
 * @returns {object}
 */
export function applyFreePositionsToCargo(cargo, freePositions = {}) {
  const map = normalizeFreePositionsMap(freePositions);
  const keys = Object.keys(map);
  if (!cargo || !keys.length) {
    return cargo
      ? {
          ...cargo,
          freeDragCount: 0,
          freeDragKeys: [],
        }
      : cargo;
  }

  const placed = Array.isArray(cargo.placed) ? cargo.placed : [];
  const nextPlaced = placed.map((pkg) => {
    const key = pkg?.stableKey;
    if (!key || !map[key]) return pkg;
    const pos = map[key];
    const len = Math.max(0.01, Number(pkg.len) || 0.01);
    const h = Math.max(0.01, Number(pkg.h) || 0.01);
    const xStart = pos.xStart;
    const xEnd = xStart + len;
    const zBase = pos.zBase;
    const row = pos.row;
    return {
      ...pkg,
      xStart,
      xEnd,
      zBase,
      row,
      freeDrag: true,
      zone: pos.zone || pkg.zone || "truck",
      yardStopId: pos.yardStopId ?? pkg.yardStopId,
      // Keep stackId for identity but mark as free-placed
      stackId: pkg.stackId ? `${String(pkg.stackId).replace(/:free$/, "")}:free` : `FREE-${key}`,
      layerIndex: 0,
      supportLen: len,
      supportRatio: 1,
      ov: zBase + h > (Number(cargo.maxH) || 2.5) + 0.001,
    };
  });

  // Recompute simple rowH from free+engine
  const rowH = [0, 0];
  for (const p of nextPlaced) {
    const top = (Number(p.zBase) || 0) + (Number(p.h) || 0);
    const r = Number(p.row) === 1 ? 1 : 0;
    if (top > rowH[r]) rowH[r] = top;
  }

  const freeDragKeys = nextPlaced.filter((p) => p.freeDrag).map((p) => p.stableKey);

  return {
    ...cargo,
    placed: nextPlaced,
    rowH,
    freeDragCount: freeDragKeys.length,
    freeDragKeys,
  };
}

/**
 * Build free position from a placed package (seed override from engine coords).
 * @param {object} pkg
 */
export function freePositionFromPkg(pkg) {
  if (!pkg) return null;
  return normalizeFreePosition({
    xStart: pkg.xStart,
    zBase: pkg.zBase,
    row: pkg.row,
    zone: pkg.zone,
    yardStopId: pkg.yardStopId,
  });
}

/**
 * Apply same delta to a group of free positions.
 * @param {Record<string, object>} freePositions
 * @param {string[]} keys
 * @param {{ dx?: number, dzBase?: number, row?: number }} delta
 * @param {object[]} placed
 */
export function applyGroupDelta(freePositions = {}, keys = [], delta = {}, placed = []) {
  const byKey = new Map((placed || []).filter((p) => p?.stableKey).map((p) => [p.stableKey, p]));
  const next = { ...normalizeFreePositionsMap(freePositions) };
  for (const k of keys || []) {
    const pkg = byKey.get(k);
    const cur = next[k] || {
      xStart: pkg?.xStart ?? 0,
      zBase: pkg?.zBase ?? 0,
      row: pkg?.row ?? 0,
      freeDrag: true,
      zone: pkg?.zone,
      yardStopId: pkg?.yardStopId,
    };
    const xStart = Number(cur.xStart) + (Number(delta.dx) || 0);
    const zBase = Math.max(0, Number(cur.zBase) + (Number(delta.dzBase) || 0));
    const row = delta.row != null ? (Number(delta.row) === 1 ? 1 : 0) : Number(cur.row) === 1 ? 1 : 0;
    next[k] = normalizeFreePosition({
      xStart,
      zBase,
      row,
      freeDrag: true,
      zone: cur.zone || "truck",
      yardStopId: cur.yardStopId,
    });
  }
  return next;
}
