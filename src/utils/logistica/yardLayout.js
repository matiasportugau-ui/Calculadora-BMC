/**
 * Yard dump — "Descargar el camión": place each order's packages in separated piles around the truck.
 */

import { packageHeightM } from "./cargoPacking.js";

/**
 * @param {object[]} stops
 * @param {object[]} placed - current packages (from placeCargo + free)
 * @param {number} truckL
 * @param {{
 *   gapM?: number,
 *   marginM?: number,
 *   sideOffsetM?: number,
 * }} [opts]
 * @returns {Record<string, { xStart: number, zBase: number, row: number, freeDrag: true, zone: 'yard', yardStopId: string }>}
 */
export function buildYardDump(stops = [], placed = [], truckL = 8, opts = {}) {
  const gapM = opts.gapM != null ? Number(opts.gapM) : 0.5;
  const marginM = opts.marginM != null ? Number(opts.marginM) : 1.8;
  const sideOffsetM = opts.sideOffsetM != null ? Number(opts.sideOffsetM) : 0.35;
  const bed = Math.max(1, Number(truckL) || 8);

  const stopList = Array.isArray(stops) ? [...stops] : [];
  // Prefer stop order
  stopList.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

  /** @type {Map<string, object[]>} */
  const byStop = new Map();
  for (const p of placed || []) {
    if (!p) continue;
    const sid = p.sId || p.stopId || "_orphan";
    if (!byStop.has(sid)) byStop.set(sid, []);
    byStop.get(sid).push(p);
  }

  // Include stops with no placed pkgs still as empty slots? skip empties
  const orderedStopIds = [];
  for (const s of stopList) {
    if (s?.id && byStop.has(s.id)) orderedStopIds.push(s.id);
  }
  for (const sid of byStop.keys()) {
    if (!orderedStopIds.includes(sid)) orderedStopIds.push(sid);
  }

  const n = orderedStopIds.length;
  if (!n) return {};

  // Layout: alternate south (row-like band below) and north (above) of truck, left→right
  // Truck occupies x [0, bed], lateral z bands: south z negative via row encoding —
  // free-drag uses xStart along length and row 0/1 for lateral half.
  // Yard: use xStart outside bed or beside with zone=yard; encode "side" in row + large offsets.
  //
  // Convention:
  // - side 0 (south): row=0, xStart progresses along -margin.. and beyond bed
  // - side 1 (north): row=1
  // Stacks placed with xStart = slotX, packages stacked by zBase.

  const freePositions = {};
  const slotsPerSide = Math.ceil(n / 2);

  orderedStopIds.forEach((stopId, index) => {
    const pkgs = byStop.get(stopId) || [];
    // Sort: panels first (longer base), accessories on top — physical default
    const ordered = [...pkgs].sort((a, b) => {
      const aAcc = a.kind === "accessory" ? 1 : 0;
      const bAcc = b.kind === "accessory" ? 1 : 0;
      if (aAcc !== bAcc) return aAcc - bAcc;
      return (Number(b.len) || 0) - (Number(a.len) || 0);
    });

    const side = index % 2; // 0 south, 1 north → row
    const slotOnSide = Math.floor(index / 2);
    // Spread slots along truck length, starting before cab (negative x) wrapping past bed
    const span = bed + marginM * 2;
    const slotWidth = slotsPerSide > 0 ? span / slotsPerSide : span;
    const maxLen = ordered.reduce((m, p) => Math.max(m, Number(p.len) || 0), 3);
    const slotX = -marginM + slotOnSide * slotWidth + gapM;

    // Separate piles: each stop gets exclusive x band; shift slightly by sideOffset for clarity
    const xStart = slotX + (side === 1 ? sideOffsetM : 0);
    // Ensure yard piles don't sit on truck bed center: push south piles left of 0 if needed
    // Actually place completely off-bed: south left of 0 or beyond bed
    let yardX = xStart;
    if (yardX >= 0 && yardX < bed) {
      // push to south-west of truck
      yardX = -marginM - (slotOnSide + 1) * (maxLen * 0.15 + gapM);
    }

    let z = 0;
    for (const pkg of ordered) {
      const key = pkg.stableKey;
      if (!key) continue;
      const h = Number(pkg.h) || packageHeightM(pkg.tipo, pkg.esp, pkg.n) || 0.2;
      freePositions[key] = {
        xStart: yardX,
        zBase: z,
        row: side === 1 ? 1 : 0,
        freeDrag: true,
        zone: "yard",
        yardStopId: stopId,
      };
      z += h;
    }
  });

  return freePositions;
}

/**
 * Count how many free positions are in yard zone.
 * @param {Record<string, object>} freePositions
 */
export function countYardPackages(freePositions = {}) {
  return Object.values(freePositions || {}).filter((p) => p && p.zone === "yard").length;
}

/**
 * Clear only yard positions (keep truck free-drags).
 * @param {Record<string, object>} freePositions
 */
export function clearYardPositions(freePositions = {}) {
  const next = {};
  for (const [k, v] of Object.entries(freePositions || {})) {
    if (v && v.zone === "yard") continue;
    next[k] = v;
  }
  return next;
}
