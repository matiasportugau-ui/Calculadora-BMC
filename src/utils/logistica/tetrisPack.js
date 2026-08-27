/**
 * Route-aware Tetris load: last delivery at the door, leftover ledges filled.
 */
import { placeCargo, ROW_W } from "./cargoPacking.js";
import { canPlaceOnTop, isAccessoryPkg } from "./stackConstraints.js";

/**
 * Delivery stop ids in driving order (first drop first).
 * @param {{ orderedLegs?: object[] } | null} route
 * @param {object[]} stops
 */
export function deliveryIdsFromRoute(route, stops = []) {
  const fromLegs = [];
  const seen = new Set();
  for (const leg of route?.orderedLegs || []) {
    if (leg?.type && leg.type !== "delivery") continue;
    const id = String(leg?.stopId || (leg?.type === "delivery" ? leg.refId : "") || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    fromLegs.push(id);
  }
  if (fromLegs.length) return fromLegs;
  return [...(stops || [])]
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map((s) => String(s.id))
    .filter(Boolean);
}

/**
 * Load keys: last delivery first (door), panels before accessories, longer first.
 * @param {object[]} stops
 * @param {object|null} route
 */
export function loadKeysFromRoute(stops = [], route = null) {
  const delivery = deliveryIdsFromRoute(route, stops);
  const rank = new Map(delivery.map((id, i) => [id, i]));
  const pkgs = [];
  for (const s of stops || []) {
    const panels = Array.isArray(s.paneles) ? s.paneles : [];
    const acc = Array.isArray(s.accesorios) ? s.accesorios : [];
    panels.forEach((p, i) => {
      pkgs.push({
        stableKey: `${s.id}:panel:${p.id || i}:0`,
        sId: s.id,
        kind: "panel",
        len: Number(p.longitud) || 0,
        acc: 0,
      });
    });
    if (acc.length) {
      pkgs.push({
        stableKey: `${s.id}:accessory`,
        sId: s.id,
        kind: "accessory",
        len: Number(s.accPackage?.len) || 1,
        acc: 1,
      });
    }
  }
  pkgs.sort((a, b) => {
    const ra = rank.has(String(a.sId)) ? rank.get(String(a.sId)) : 999;
    const rb = rank.has(String(b.sId)) ? rank.get(String(b.sId)) : 999;
    if (ra !== rb) return rb - ra;
    if (a.acc !== b.acc) return a.acc - b.acc;
    return (b.len || 0) - (a.len || 0);
  });
  return pkgs.map((p) => p.stableKey);
}

function leftoverM3(placed, bed, maxH) {
  const cap = Math.max(1, Number(bed) || 8) * (ROW_W * 2) * Math.max(0.5, Number(maxH) || 2.5);
  const used = (placed || []).reduce((s, p) => {
    const L = Number(p.len) || 0;
    const H = Number(p.h) || 0;
    return s + L * ROW_W * H;
  }, 0);
  return Math.max(0, cap - used);
}

/**
 * Exposed length on a lower layer when the pack above is shorter (aligned to xEnd).
 */
export function stackLedges(placed = [], maxH = 2.5) {
  const byStack = new Map();
  for (const p of placed || []) {
    if (!p?.stackId) continue;
    if (!byStack.has(p.stackId)) byStack.set(p.stackId, []);
    byStack.get(p.stackId).push(p);
  }
  const ledges = [];
  for (const items of byStack.values()) {
    const ordered = [...items].sort((a, b) => (a.zBase || 0) - (b.zBase || 0));
    for (let i = 0; i < ordered.length; i += 1) {
      const layer = ordered[i];
      const above = ordered[i + 1];
      const layerLen = Number(layer.len) || 0;
      const aboveLen = above ? Number(above.len) || 0 : 0;
      const extra = layerLen - aboveLen;
      if (extra < 0.25) continue;
      const xEnd = Number(layer.xEnd);
      const x0 = Number(layer.xStart) || 0;
      const x1 = above ? xEnd - aboveLen : xEnd;
      if (x1 - x0 < 0.25) continue;
      const z = (Number(layer.zBase) || 0) + (Number(layer.h) || 0);
      if (z >= maxH - 0.05) continue;
      ledges.push({
        row: layer.row,
        stackId: layer.stackId,
        xStart: x0,
        xEnd: x1,
        zBase: z,
        support: layer,
        leftoverLen: x1 - x0,
      });
    }
  }
  return ledges.sort((a, b) => b.leftoverLen - a.leftoverLen);
}

/**
 * Move small standalone stacks onto leftover ledges (Tetris).
 * @param {object} cargo placeCargo result
 */
export function fillLedgePockets(cargo) {
  if (!cargo || !Array.isArray(cargo.placed) || cargo.placed.length < 2) return cargo;
  const maxH = Number(cargo.maxH) || 2.5;
  let placed = cargo.placed.map((p) => ({ ...p }));
  const stackCount = (sid) => placed.filter((p) => p.stackId === sid).length;

  let moved = 0;
  let guard = 0;
  while (guard < 40) {
    guard += 1;
    const ledges = stackLedges(placed, maxH);
    if (!ledges.length) break;
    let progress = false;
    for (const ledge of ledges) {
      const candidates = placed
        .filter((p) => {
          if (p.stackId === ledge.stackId) return false;
          if (stackCount(p.stackId) !== 1) return false;
          if ((Number(p.len) || 0) > ledge.leftoverLen + 0.001) return false;
          if (ledge.zBase + (Number(p.h) || 0) > maxH + 0.001) return false;
          if (!canPlaceOnTop(p, ledge.support)) return false;
          return true;
        })
        .sort((a, b) => (Number(b.len) || 0) - (Number(a.len) || 0) || (isAccessoryPkg(a) ? 1 : 0) - (isAccessoryPkg(b) ? 1 : 0));
      const pick = candidates[0];
      if (!pick) continue;
      const len = Number(pick.len) || 0;
      placed = placed.map((p) =>
        p.stableKey === pick.stableKey
          ? {
              ...p,
              row: ledge.row,
              xStart: ledge.xEnd - len,
              xEnd: ledge.xEnd,
              zBase: ledge.zBase,
              stackId: ledge.stackId,
              supportLen: ledge.leftoverLen,
              supportRatio: ledge.leftoverLen > 0 ? Math.min(1, ledge.leftoverLen / Math.max(len, 0.001)) : 1,
              tetrisLedge: true,
            }
          : p,
      );
      moved += 1;
      progress = true;
      break;
    }
    if (!progress) break;
  }

  return {
    ...cargo,
    placed,
    leftoverM3: leftoverM3(placed, cargo.bedM, maxH),
    tetrisMoved: moved,
    strategy: cargo.strategy || "compact",
  };
}

/**
 * Full pack: reverse-route load order + compact stacks + ledge Tetris.
 */
export function tetrisPlaceCargo(stops, truckL, route = null) {
  const keys = loadKeysFromRoute(stops, route);
  const cargo = placeCargo(stops, truckL, "compact", {
    mode: keys.length ? "manual" : "auto",
    manualOrderKeys: keys,
  });
  const filled = fillLedgePockets(cargo);
  return { ...filled, loadKeys: keys, strategy: "tetris" };
}

/**
 * Free-drag map locking Tetris result onto the truck (clears yard).
 */
export function tetrisToFreePositions(cargo) {
  const out = {};
  for (const p of cargo?.placed || []) {
    if (!p?.stableKey) continue;
    out[p.stableKey] = {
      xStart: Number(p.xStart) || 0,
      zBase: Number(p.zBase) || 0,
      row: Number(p.row) === 1 ? 1 : 0,
      freeDrag: true,
      zone: "truck",
    };
  }
  return out;
}
