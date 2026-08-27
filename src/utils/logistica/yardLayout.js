/**
 * Yard dump — "Descargar el camión": staging lanes beside the truck (WMS-style).
 * Default layout is floor lanes (not towers) so operators can count packs.
 */

import { packageHeightM } from "./cargoPacking.js";
import { isPlantPickupStop } from "./uyGazetteer.js";

function stopTravels(stop) {
  if (!stop) return true;
  return !isPlantPickupStop(stop);
}

function sortLanePackages(pkgs) {
  return [...pkgs].sort((a, b) => {
    const aAcc = a.kind === "accessory" ? 1 : 0;
    const bAcc = b.kind === "accessory" ? 1 : 0;
    if (aAcc !== bAcc) return aAcc - bAcc;
    const len = (Number(b.len) || 0) - (Number(a.len) || 0);
    if (len !== 0) return len;
    return (Number(b.h) || 0) - (Number(a.h) || 0);
  });
}

function collectByStop(stops, placed, stopIds) {
  const allow = Array.isArray(stopIds) && stopIds.length ? new Set(stopIds.map(String)) : null;
  const stopList = (Array.isArray(stops) ? [...stops] : []).sort(
    (a, b) => (a.orden ?? 0) - (b.orden ?? 0),
  );
  const byStop = new Map();
  for (const p of placed || []) {
    if (!p) continue;
    const sid = String(p.sId || p.stopId || "_orphan");
    if (allow && !allow.has(sid)) continue;
    if (!byStop.has(sid)) byStop.set(sid, []);
    byStop.get(sid).push(p);
  }
  const orderedStopIds = [];
  for (const s of stopList) {
    if (!s?.id) continue;
    if (allow && !allow.has(String(s.id))) continue;
    if (!stopTravels(s)) continue;
    if (byStop.has(String(s.id))) orderedStopIds.push(String(s.id));
  }
  for (const sid of byStop.keys()) {
    if (orderedStopIds.includes(sid)) continue;
    const stop = stopList.find((s) => String(s.id) === sid);
    if (stop && !stopTravels(stop)) continue;
    if (allow && !allow.has(sid)) continue;
    orderedStopIds.push(sid);
  }
  return { stopList, byStop, orderedStopIds };
}

/**
 * Floor lanes south of the truck, parallel to bed X. One stop = one lane.
 * @param {object[]} stops
 * @param {object[]} placed
 * @param {number} truckL
 * @param {{ stopIds?: string[], gapM?: number }} [opts]
 */
export function buildYardLanes(stops = [], placed = [], truckL = 8, opts = {}) {
  const gapM = opts.gapM != null ? Number(opts.gapM) : 0.25;
  const { stopList, byStop, orderedStopIds } = collectByStop(stops, placed, opts.stopIds);
  const freePositions = {};
  orderedStopIds.forEach((stopId, lane) => {
    const stop = stopList.find((s) => String(s.id) === stopId);
    const pkgs = sortLanePackages(byStop.get(stopId) || []);
    let x = 0;
    for (const pkg of pkgs) {
      const key = pkg.stableKey;
      if (!key) continue;
      freePositions[key] = {
        xStart: x,
        zBase: 0,
        row: 0,
        lane,
        freeDrag: true,
        zone: "yard",
        yardStopId: stopId,
        yardLabel: String(stop?.cliente || pkg.sCli || "Pedido").trim() || "Pedido",
        yardColor: stop?.color || pkg.sCol || "#2563eb",
      };
      x += Math.max(0.3, Number(pkg.len) || 1) + gapM;
    }
  });
  return freePositions;
}

/**
 * Legacy stacked piles (north/south). Kept for tests / opt-in.
 */
export function buildYardStacks(stops = [], placed = [], truckL = 8, opts = {}) {
  const gapM = opts.gapM != null ? Number(opts.gapM) : 0.5;
  const marginM = opts.marginM != null ? Number(opts.marginM) : 1.8;
  const sideOffsetM = opts.sideOffsetM != null ? Number(opts.sideOffsetM) : 0.35;
  const bed = Math.max(1, Number(truckL) || 8);
  const { stopList, byStop, orderedStopIds } = collectByStop(stops, placed, opts.stopIds);
  const n = orderedStopIds.length;
  if (!n) return {};
  const freePositions = {};
  const slotsPerSide = Math.ceil(n / 2);
  orderedStopIds.forEach((stopId, index) => {
    const pkgs = sortLanePackages(byStop.get(stopId) || []);
    const side = index % 2;
    const slotOnSide = Math.floor(index / 2);
    const span = bed + marginM * 2;
    const slotWidth = slotsPerSide > 0 ? span / slotsPerSide : span;
    const maxLen = pkgs.reduce((m, p) => Math.max(m, Number(p.len) || 0), 3);
    const slotX = -marginM + slotOnSide * slotWidth + gapM;
    let yardX = slotX + (side === 1 ? sideOffsetM : 0);
    if (yardX >= 0 && yardX < bed) {
      yardX = -marginM - (slotOnSide + 1) * (maxLen * 0.15 + gapM);
    }
    let z = 0;
    for (const pkg of pkgs) {
      const key = pkg.stableKey;
      if (!key) continue;
      const h = Number(pkg.h) || packageHeightM(pkg.tipo, pkg.esp, pkg.n) || 0.2;
      const stop = stopList.find((s) => String(s.id) === stopId);
      freePositions[key] = {
        xStart: yardX,
        zBase: z,
        row: side === 1 ? 1 : 0,
        freeDrag: true,
        zone: "yard",
        yardStopId: stopId,
        yardLabel: String(stop?.cliente || pkg.sCli || "Pedido").trim(),
        yardColor: stop?.color || pkg.sCol || "#2563eb",
      };
      z += h;
    }
  });
  return freePositions;
}

/**
 * @param {object[]} stops
 * @param {object[]} placed
 * @param {number} truckL
 * @param {{ layout?: "lanes"|"stacks", stopIds?: string[] }} [opts]
 */
export function buildYardDump(stops = [], placed = [], truckL = 8, opts = {}) {
  if (opts.layout === "stacks") return buildYardStacks(stops, placed, truckL, opts);
  return buildYardLanes(stops, placed, truckL, opts);
}

export function countYardPackages(freePositions = {}) {
  return Object.values(freePositions || {}).filter((p) => p && p.zone === "yard").length;
}

export function clearYardPositions(freePositions = {}) {
  const next = {};
  for (const [k, v] of Object.entries(freePositions || {})) {
    if (v && v.zone === "yard") continue;
    next[k] = v;
  }
  return next;
}

/**
 * Drop one stop's yard positions (keep other yard + truck free-drags).
 * @param {Record<string, object>} freePositions
 * @param {string} stopId
 */
export function clearYardStop(freePositions = {}, stopId) {
  const id = String(stopId || "");
  if (!id) return { ...freePositions };
  const next = {};
  for (const [k, v] of Object.entries(freePositions || {})) {
    if (v && v.zone === "yard" && String(v.yardStopId) === id) continue;
    next[k] = v;
  }
  return next;
}

/**
 * Floor plaques for 3D / SVG: one per yard stop, at the front of the lane.
 * @param {object[]} placed
 * @returns {{ stopId: string, lane: number, label: string, color: string, xMin: number, xMax: number }[]}
 */
/**
 * Drop yard packs onto the floor or onto the pack below — no hovering gaps.
 * Truck-zone packages are unchanged.
 * @param {object[]} placed
 * @returns {object[]}
 */
export function settleYardPlaced(placed = []) {
  if (!Array.isArray(placed) || !placed.length) return placed || [];
  const yard = [];
  const rest = [];
  for (const p of placed) {
    if (p && p.zone === "yard") yard.push(p);
    else rest.push(p);
  }
  if (!yard.length) return placed;
  const byLane = new Map();
  for (const p of yard) {
    const lane = Number.isFinite(Number(p.lane)) ? Number(p.lane) : 0;
    if (!byLane.has(lane)) byLane.set(lane, []);
    byLane.get(lane).push(p);
  }
  const settled = [];
  for (const group of byLane.values()) {
    const ordered = [...group].sort((a, b) => {
      const dx = (Number(a.xStart) || 0) - (Number(b.xStart) || 0);
      if (dx !== 0) return dx;
      return (Number(a.zBase) || 0) - (Number(b.zBase) || 0);
    });
    const done = [];
    for (const p of ordered) {
      const x0 = Number(p.xStart) || 0;
      const x1 = x0 + Math.max(0, Number(p.len) || 0);
      let z = 0;
      for (const q of done) {
        const qx0 = Number(q.xStart) || 0;
        const qx1 = qx0 + Math.max(0, Number(q.len) || 0);
        const ov = Math.min(x1, qx1) - Math.max(x0, qx0);
        if (ov > 0.05) {
          z = Math.max(z, (Number(q.zBase) || 0) + (Number(q.h) || 0));
        }
      }
      const next = { ...p, zBase: z };
      done.push(next);
      settled.push(next);
    }
  }
  const byKey = new Map(settled.map((p) => [p.stableKey || p.id, p]));
  return placed.map((p) => {
    if (!p || p.zone !== "yard") return p;
    return byKey.get(p.stableKey || p.id) || { ...p, zBase: 0 };
  });
}

export function buildYardPlaques(placed = []) {
  const map = new Map();
  for (const p of placed || []) {
    if (!p || p.zone !== "yard") continue;
    const stopId = String(p.yardStopId || p.sId || "");
    if (!stopId) continue;
    const lane = Number.isFinite(Number(p.lane)) ? Number(p.lane) : 0;
    const xStart = Number(p.xStart) || 0;
    const xEnd = xStart + Math.max(0, Number(p.len) || 0);
    const cur = map.get(stopId);
    if (!cur) {
      map.set(stopId, {
        stopId,
        lane,
        label: String(p.yardLabel || p.sCli || "Pedido").trim() || "Pedido",
        color: p.yardColor || p.sCol || "#2563eb",
        xMin: xStart,
        xMax: xEnd,
      });
    } else {
      cur.xMin = Math.min(cur.xMin, xStart);
      cur.xMax = Math.max(cur.xMax, xEnd);
    }
  }
  return [...map.values()].sort((a, b) => a.lane - b.lane || a.label.localeCompare(b.label));
}
