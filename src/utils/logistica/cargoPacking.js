/**
 * Pure cargo packing for BMC logistics + freight quoting (single SoT).
 * Used by fleteEngine and BmcLogisticaApp — no local placeCargo in the app.
 *
 * Public API:
 *   placeCargo(stops, trL, opts?)
 *   placeCargo(stops, trL, strategy, layoutOptions?)  // ops shorthand
 *
 * opts: { maxH, strategy, mode, manualOrderKeys, rowOverrides, maxOvh, uid }
 *
 * Freight fields always on result: filasUsadas, largoMax, cabe, bedM, maxH
 * Ops fields: stacksByRow, unloadPlan, stopUnloadOrder, strategy, layoutMode, …
 */

import {
  MAX_H as OPS_DISPLAY_MAX_H,
  MANUAL_LAYOUT_VERSION,
  panelStableKey,
  accessoryStableKey,
} from "../bmcLogisticaCargo.js";

export const FREIGHT_MAX_H = 2.4;
export const ROW_W = 1.2;
export const STANDARD_BED_M = 8;
export const LONG_BED_M = 13;
export const MAX_OVH = 2.0;
export { OPS_DISPLAY_MAX_H as OPS_MAX_H };

/** Max panels per closed package by thickness (mm) — SDD / quote SoT. */
export const MAX_P = {
  40: 12,
  50: 10,
  60: 10,
  80: 8,
  100: 8,
  150: 6,
  200: 5,
  250: 4,
};

const DEFAULT_EXTRA_M = 0.02;
const ISOROOF_NERVIO_M = 0.04;
const DEFAULT_ACC_W = 0.3;
const DEFAULT_ACC_H = 0.2;
const DEFAULT_ACC_FOAM_MM = 50;

let _uid = 0;
function defaultUid() {
  return `p${++_uid}`;
}

export function isIsoroofTipo(tipo) {
  return /isoroof/i.test(String(tipo || ""));
}

/**
 * Stack height (m) for n panels of thickness espMm.
 */
export function packageHeightM(tipo, espMm, n) {
  const e = Math.max(0, Number(espMm) || 0) / 1000;
  const count = Math.max(0, Math.floor(Number(n) || 0));
  if (count <= 0) return 0;
  if (isIsoroofTipo(tipo)) {
    const pairs = Math.floor(count / 2);
    const rem = count % 2;
    const pairH = e + e + ISOROOF_NERVIO_M;
    const remH = rem ? e + ISOROOF_NERVIO_M : 0;
    return +(pairs * pairH + remH).toFixed(4);
  }
  return +(count * (e + DEFAULT_EXTRA_M)).toFixed(4);
}

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * @param {{ id?: string, orden?: number, cliente?: string, color?: string }} stop
 * @param {{ tipo: string, espesor: number, longitud: number, cantidad: number, id?: string }} panel
 * @param {() => string} [uid]
 */
export function buildPkgs(stop, panel, uid = defaultUid) {
  const esp = Math.round(Number(panel.espesor) || 0);
  const max = MAX_P[esp] || 8;
  let rem = Math.max(0, Math.floor(Number(panel.cantidad) || 0));
  const pkgs = [];
  let chunkIdx = 0;
  const panelId = panel.id || `panel-${chunkIdx}`;
  while (rem > 0) {
    const n = Math.min(rem, max);
    pkgs.push({
      id: uid(),
      stableKey: panelStableKey(stop?.id || "s0", panelId, chunkIdx),
      chunkIdx,
      sId: stop?.id || "s0",
      sOrd: stop?.orden ?? 1,
      sCol: stop?.color || "",
      sCli: stop?.cliente || "",
      kind: "panel",
      tipo: String(panel.tipo || "PANEL"),
      esp,
      len: Math.max(0, Number(panel.longitud) || 0),
      n,
      h: packageHeightM(panel.tipo, esp, n),
    });
    chunkIdx += 1;
    rem -= n;
  }
  return pkgs;
}

function getStopLongestLength(stop) {
  const fromPanels = Math.max(0, ...((stop?.paneles || []).map((p) => safeNum(p.longitud))));
  return fromPanels || 3;
}

function accessoryPresetFor(accesorios) {
  const raw = (accesorios || []).map((acc) => String(acc.descr || "")).join(" ").toLowerCase();
  if (/cumbrera|babeta|tapajunta|zingueria|perfil/.test(raw)) return { ancho: 0.22, alto: 0.14 };
  if (/tornillo|fijacion|arandela|remache/.test(raw)) return { ancho: 0.2, alto: 0.12 };
  if (/silicona|sellador|espuma|burlete|cinta/.test(raw)) return { ancho: 0.26, alto: 0.18 };
  if (/puerta|ventana|marco/.test(raw)) return { ancho: 0.45, alto: 0.3 };
  return { ancho: DEFAULT_ACC_W, alto: DEFAULT_ACC_H };
}

/**
 * Build accessory package(s) for a stop (ops).
 * @param {object} stop
 * @param {() => string} [uid]
 */
export function buildAccessoryPkgs(stop, uid = defaultUid) {
  const accesorios = stop?.accesorios || [];
  const cfg = stop?.accPackage || {};
  if (!accesorios.length) return [];
  if (cfg.enabled === false) return [];
  const preset = accessoryPresetFor(accesorios);
  const totalAcc = accesorios.reduce((acc, item) => acc + Math.max(1, safeNum(item.cantidad, 1)), 0);
  const foamM = clamp(safeNum(cfg.foamMm, DEFAULT_ACC_FOAM_MM), 0, 100) / 1000;
  const contentH = clamp(safeNum(cfg.alto, preset.alto), 0.1, 0.5);
  return [
    {
      id: uid(),
      stableKey: accessoryStableKey(stop.id || "s0"),
      sId: stop.id || "s0",
      sOrd: stop.orden ?? 1,
      sCol: stop.color || "",
      sCli: stop.cliente || "",
      kind: "accessory",
      tipo: "ACCESORIOS",
      esp: "",
      len: clamp(safeNum(cfg.longitud, getStopLongestLength(stop)), 1, 14),
      n: 1,
      h: +(contentH + foamM).toFixed(4),
      width: clamp(safeNum(cfg.ancho, preset.ancho), 0.2, 0.5),
      foamMm: Math.round(foamM * 1000),
      contentHeight: contentH,
      accessoryCount: totalAcc,
      accessorySummary: accesorios.map((item) => `${item.cantidad}x ${item.descr}`).join(" · "),
    },
  ];
}

export function buildStopPackages(stop, uid = defaultUid) {
  return [
    ...((stop?.paneles || []).flatMap((panel) => buildPkgs(stop, panel, uid))),
    ...buildAccessoryPkgs(stop, uid),
  ];
}

function getRowSummary(stacksByRow) {
  return stacksByRow.map((stacks) => ({
    height: stacks.length ? Math.max(...stacks.map((stack) => stack.height)) : 0,
    usedLen: stacks.reduce((acc, stack) => acc + stack.len, 0),
    stackCount: stacks.length,
  }));
}

function getStackTopLen(stack) {
  if (!stack?.items?.length) return stack?.len || 0;
  return stack.items[stack.items.length - 1].len;
}

function getHeightSpreadAfter(stacksByRow, row, stackIndex, nextHeight, type) {
  const heights = stacksByRow[row].map((stack, idx) => (idx === stackIndex ? nextHeight : stack.height));
  if (type === "new") heights.push(nextHeight);
  if (!heights.length) return nextHeight;
  return Math.max(...heights) - Math.min(...heights);
}

function pickCandidateScore(candidate, strategy) {
  const { type, rowSummary, nextHeight, row, usedLenAfter, stackHeightAfter, stackIndex, heightSpreadAfter } =
    candidate;
  if (strategy === "compact") {
    return [
      type === "existing" ? 0 : 1,
      rowSummary[row].usedLen ? 0 : 1,
      usedLenAfter,
      heightSpreadAfter,
      stackIndex ?? 999,
      nextHeight,
      row,
    ];
  }
  if (strategy === "doorPriority") {
    return [
      type === "existing" ? 0 : 1,
      nextHeight,
      heightSpreadAfter,
      rowSummary[row].usedLen,
      stackHeightAfter,
      row,
    ];
  }
  // balanced
  return [
    nextHeight,
    heightSpreadAfter,
    type === "existing" ? 0 : 1,
    usedLenAfter,
    stackHeightAfter,
    row,
  ];
}

function compareScore(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

function buildUnloadPlan(placed) {
  const stackDoorOrder = [...new Set(placed.map((pkg) => pkg.stackId))].sort((a, b) => {
    const sa = placed.find((pkg) => pkg.stackId === a);
    const sb = placed.find((pkg) => pkg.stackId === b);
    if (!sa || !sb) return 0;
    if (sa.xStart !== sb.xStart) return sa.xStart - sb.xStart;
    if (sa.row !== sb.row) return sa.row - sb.row;
    return String(a).localeCompare(String(b));
  });
  const stackRankMap = new Map(stackDoorOrder.map((stackId, idx) => [stackId, idx + 1]));
  const ordered = [...placed].sort((a, b) => {
    const rankA = stackRankMap.get(a.stackId) || 999;
    const rankB = stackRankMap.get(b.stackId) || 999;
    if (rankA !== rankB) return rankA - rankB;
    if (a.zBase !== b.zBase) return b.zBase - a.zBase;
    if (a.sOrd !== b.sOrd) return a.sOrd - b.sOrd;
    return String(a.id).localeCompare(String(b.id));
  });
  return ordered.map((pkg, idx) => ({
    ...pkg,
    unloadRank: idx + 1,
    stackUnloadRank: stackRankMap.get(pkg.stackId) || null,
  }));
}

function summarizeStopUnload(unloadPlan, stops) {
  return (stops || [])
    .map((stop) => {
      const pkgs = unloadPlan.filter((pkg) => pkg.sId === stop.id);
      const firstRank = pkgs.length ? Math.min(...pkgs.map((pkg) => pkg.unloadRank)) : Number.POSITIVE_INFINITY;
      const avgHeightPct = pkgs.length
        ? Math.round(
            (pkgs.reduce((acc, pkg) => acc + (pkg.zBase + pkg.h / 2) / OPS_DISPLAY_MAX_H, 0) / pkgs.length) * 100
          )
        : 0;
      const topZ = pkgs.length ? Math.max(...pkgs.map((pkg) => pkg.zBase + pkg.h)) : 0;
      return { stop, pkgs, firstRank, avgHeightPct, topZ };
    })
    .sort((a, b) => a.firstRank - b.firstRank || b.topZ - a.topZ || a.stop.orden - b.stop.orden);
}

/**
 * layoutEngine:
 * - `stack` — full ops geometry (x stacks, strategies) — default when strategy string API used
 * - `column` — freight occupancy (height fill A/B only) — used by fleteEngine for stable tariffs
 */
function normalizePlaceArgs(third, fourth) {
  if (typeof third === "string") {
    return {
      layoutEngine: fourth?.layoutEngine || "stack",
      strategy: third || "balanced",
      mode: fourth?.mode || "auto",
      manualOrderKeys: fourth?.manualOrderKeys || [],
      rowOverrides: fourth?.rowOverrides || {},
      maxH: fourth?.maxH != null ? Number(fourth.maxH) : OPS_DISPLAY_MAX_H,
      maxOvh: fourth?.maxOvh != null ? Number(fourth.maxOvh) : MAX_OVH,
      uid: fourth?.uid || defaultUid,
    };
  }
  const o = third && typeof third === "object" ? third : {};
  const hasOpsKeys =
    o.strategy != null ||
    o.mode != null ||
    o.manualOrderKeys != null ||
    o.rowOverrides != null ||
    o.layoutEngine === "stack";
  return {
    layoutEngine: o.layoutEngine || (hasOpsKeys ? "stack" : "column"),
    strategy: o.strategy || "balanced",
    mode: o.mode || "auto",
    manualOrderKeys: o.manualOrderKeys || [],
    rowOverrides: o.rowOverrides || {},
    maxH: o.maxH != null ? Number(o.maxH) : hasOpsKeys ? OPS_DISPLAY_MAX_H : FREIGHT_MAX_H,
    maxOvh: o.maxOvh != null ? Number(o.maxOvh) : MAX_OVH,
    uid: typeof o.uid === "function" ? o.uid : defaultUid,
  };
}

/**
 * Pick A/B row for freight column fill.
 * Prefer already-used rows that fit so filasUsadas reflects minimum occupancy
 * (SDD: 1 fila = A OR B free), not a load-balanced spread across both rows.
 */
function pickColumnRow(rowH, pkgH, maxH) {
  const eps = 0.001;
  const room = (r) => maxH - rowH[r];
  const fits = (r) => pkgH <= room(r) + eps;
  const usedFit = [0, 1].filter((r) => rowH[r] > eps && fits(r));
  if (usedFit.length) {
    // Prefer the used row with more remaining height (denser single-fila fill).
    return usedFit.reduce((best, r) => (room(r) > room(best) ? r : best));
  }
  const emptyFit = [0, 1].filter((r) => rowH[r] <= eps && fits(r));
  if (emptyFit.length) return emptyFit[0];
  // Neither row fits — return the one with more room (caller may split/overflow).
  return room(0) >= room(1) ? 0 : 1;
}

/**
 * Freight column fill (legacy quote packer) — height into rows A/B, no longitudinal stacks.
 * Preserves zone tariff occupancy classification.
 */
function placeCargoColumn(stops, bed, maxH, uid) {
  const all = (stops || []).flatMap((s) => (s.paneles || []).flatMap((p) => buildPkgs(s, p, uid)));
  if (!all.length) {
    return {
      placed: [],
      rowH: [0, 0],
      filasUsadas: 0,
      largoMax: 0,
      warns: [],
      cabe: true,
      maxH,
      bedM: bed,
      maxLen: bed,
      maxX: bed,
      rowCursor: [bed, bed],
      minX: 0,
      stacksByRow: [[], []],
      unloadPlan: [],
      stopUnloadOrder: [],
      strategy: "column",
      layoutMode: "auto",
      layoutEngine: "column",
      manualLayoutVersion: MANUAL_LAYOUT_VERSION,
    };
  }

  const queue = [...all].sort((a, b) => b.len - a.len || b.h - a.h);
  const rowH = [0, 0];
  const placed = [];
  const warns = new Set();
  let largoMax = 0;

  while (queue.length) {
    const pkg = queue.shift();
    largoMax = Math.max(largoMax, pkg.len);
    if (pkg.len > bed + 0.001) {
      warns.add(`Panel ${pkg.len}m supera carrocería ${bed}m`);
    }

    let row = pickColumnRow(rowH, pkg.h, maxH);
    let room = maxH - rowH[row];
    const alt = 1 - row;
    const roomAlt = maxH - rowH[alt];

    if (pkg.h <= room + 0.001) {
      placed.push({ ...pkg, row, zBase: rowH[row], ov: false, xStart: 0, xEnd: pkg.len });
      rowH[row] += pkg.h;
      continue;
    }

    if (pkg.n > 1) {
      let nFit = pkg.n - 1;
      while (nFit >= 1) {
        const hFit = packageHeightM(pkg.tipo, pkg.esp, nFit);
        if (hFit <= room + 0.001 || hFit <= roomAlt + 0.001) break;
        nFit -= 1;
      }
      if (nFit >= 1) {
        const hFit = packageHeightM(pkg.tipo, pkg.esp, nFit);
        const useRow = pickColumnRow(rowH, hFit, maxH);
        placed.push({
          ...pkg,
          id: `${pkg.id}_a`,
          n: nFit,
          h: hFit,
          row: useRow,
          zBase: rowH[useRow],
          ov: false,
          xStart: 0,
          xEnd: pkg.len,
        });
        rowH[useRow] += hFit;
        queue.unshift({
          ...pkg,
          id: `${pkg.id}_b`,
          n: pkg.n - nFit,
          h: packageHeightM(pkg.tipo, pkg.esp, pkg.n - nFit),
        });
        continue;
      }
    }

    warns.add(`Estiba supera ${maxH}m — reorganizar / otro vehículo`);
    placed.push({ ...pkg, row, zBase: rowH[row], ov: true, xStart: 0, xEnd: pkg.len });
    rowH[row] += pkg.h;
  }

  const filasUsadas = (rowH[0] > 0.001 ? 1 : 0) + (rowH[1] > 0.001 ? 1 : 0);
  const heightOverflow = rowH.some((h) => h > maxH + 0.001) || placed.some((p) => p.ov);
  const lengthOverflow = largoMax > bed + 0.001;
  const cabe =
    !heightOverflow && !lengthOverflow && ![...warns].some((w) => /supera|otro vehículo/i.test(w));

  return {
    placed,
    rowH,
    filasUsadas,
    largoMax,
    warns: [...warns],
    cabe,
    maxH,
    bedM: bed,
    maxLen: Math.max(...placed.map((p) => p.len), bed),
    maxX: bed,
    rowCursor: [bed, bed],
    minX: 0,
    stacksByRow: [[], []],
    unloadPlan: [],
    stopUnloadOrder: [],
    strategy: "column",
    layoutMode: "auto",
    layoutEngine: "column",
    manualLayoutVersion: MANUAL_LAYOUT_VERSION,
  };
}

/**
 * Place packages into rows A/B with stack geometry + strategy.
 *
 * @param {Array} stops
 * @param {number} trL bed length (m)
 * @param {string|object} [third] strategy string or options
 * @param {object} [fourth] layoutOptions when third is strategy string
 */
export function placeCargo(stops, trL, third = {}, fourth = {}) {
  const opts = normalizePlaceArgs(third, fourth);
  const { strategy, mode, manualOrderKeys, rowOverrides, maxH, maxOvh, uid, layoutEngine } = opts;
  const bed = Math.max(1, Number(trL) || STANDARD_BED_M);

  if (layoutEngine === "column") {
    return placeCargoColumn(stops, bed, maxH, uid);
  }

  const all = [...(stops || [])]
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .flatMap((s) => buildStopPackages(s, uid));

  const empty = {
    placed: [],
    rowH: [0, 0],
    filasUsadas: 0,
    largoMax: 0,
    warns: [],
    cabe: true,
    maxH,
    bedM: bed,
    maxLen: bed,
    maxX: bed,
    rowCursor: [bed, bed],
    minX: 0,
    stacksByRow: [[], []],
    unloadPlan: [],
    stopUnloadOrder: [],
    strategy,
    layoutMode: mode,
    manualLayoutVersion: MANUAL_LAYOUT_VERSION,
  };

  if (!all.length) return empty;

  const orderIdx = new Map((manualOrderKeys || []).map((k, i) => [k, i]));
  const load = [...all].sort((a, b) => {
    if (mode === "manual" && manualOrderKeys.length) {
      const ia = orderIdx.has(a.stableKey) ? orderIdx.get(a.stableKey) : 9999;
      const ib = orderIdx.has(b.stableKey) ? orderIdx.get(b.stableKey) : 9999;
      if (ia !== ib) return ia - ib;
    }
    if (a.sOrd !== b.sOrd) return b.sOrd - a.sOrd;
    if (a.len !== b.len) return b.len - a.len;
    return b.h - a.h;
  });

  const stacksByRow = [[], []];
  const rowCursor = [bed, bed];
  const placed = [];
  const warns = new Set();

  load.forEach((pkg) => {
    const ovh = Math.max(0, pkg.len - bed);
    if (ovh > maxOvh) {
      warns.add(`P${pkg.sOrd}: panel ${pkg.len}m sobresale ${ovh.toFixed(1)}m. Revisar largo útil del camión.`);
    }

    const forcedRow = rowOverrides[pkg.stableKey];
    const rowSummary = getRowSummary(stacksByRow);
    const candidates = [];

    for (let row = 0; row < 2; row += 1) {
      if (forcedRow !== undefined && forcedRow !== row) continue;
      stacksByRow[row].forEach((stack, stackIndex) => {
        const topLen = getStackTopLen(stack);
        const fitsOnImmediateSupport = pkg.len <= topLen + 0.001;
        const nextStackHeight = stack.height + pkg.h;
        if (!fitsOnImmediateSupport || nextStackHeight > maxH + 0.001) return;
        const nextHeight = Math.max(rowSummary[row].height, nextStackHeight);
        const heightSpreadAfter = getHeightSpreadAfter(stacksByRow, row, stackIndex, nextStackHeight, "existing");
        candidates.push({
          type: "existing",
          row,
          stackIndex,
          stackHeightAfter: nextStackHeight,
          nextHeight,
          rowSummary,
          usedLenAfter: rowSummary[row].usedLen,
          heightSpreadAfter,
          supportLen: topLen,
        });
      });

      const stackXStart = rowCursor[row] - pkg.len;
      const lengthOk = stackXStart >= -maxOvh - 0.001;
      if (lengthOk && pkg.h <= maxH + 0.001) {
        const nextHeight = Math.max(rowSummary[row].height, pkg.h);
        const heightSpreadAfter = getHeightSpreadAfter(stacksByRow, row, null, pkg.h, "new");
        candidates.push({
          type: "new",
          row,
          stackHeightAfter: pkg.h,
          nextHeight,
          rowSummary,
          usedLenAfter: rowSummary[row].usedLen + pkg.len,
          heightSpreadAfter,
        });
      }
    }

    let chosen = null;
    if (candidates.length) {
      chosen = [...candidates].sort((a, b) =>
        compareScore(pickCandidateScore(a, strategy), pickCandidateScore(b, strategy))
      )[0];
    } else {
      const rowSummaryNow = getRowSummary(stacksByRow);
      const anyHeightOk = rowSummaryNow.some(() => pkg.h <= maxH + 0.001);
      if (!anyHeightOk) warns.add(`P${pkg.sOrd}: excede ${maxH}m en ambas filas — se requiere 2° camión.`);
      else warns.add(`P${pkg.sOrd}: no entra en largo útil sin exceder la tolerancia de saliente.`);
      chosen = { type: "overflow", row: rowCursor[0] >= rowCursor[1] ? 0 : 1 };
    }

    const row = chosen.row;
    let stack;

    if (chosen.type === "existing") {
      stack = stacksByRow[row][chosen.stackIndex];
    } else {
      const len = pkg.len;
      const xStart = rowCursor[row] - len;
      const xEnd = rowCursor[row];
      stack = {
        id: `R${row + 1}-S${stacksByRow[row].length + 1}`,
        row,
        len,
        xStart,
        xEnd,
        height: 0,
        items: [],
      };
      stacksByRow[row].push(stack);
      rowCursor[row] = xStart;
    }

    const zBase = stack.height;
    const alignedXStart = stack.xEnd - pkg.len;
    const alignedXEnd = stack.xEnd;
    const ov = zBase + pkg.h > maxH + 0.001;
    const supportLen = chosen.type === "existing" ? getStackTopLen(stack) : pkg.len;
    const placedPkg = {
      ...pkg,
      row,
      zBase,
      xStart: alignedXStart,
      xEnd: alignedXEnd,
      ovh,
      ov,
      stackId: stack.id,
      stackLen: stack.len,
      layerIndex: stack.items.length,
      supportLen,
      supportRatio: supportLen > 0 ? Math.min(1, supportLen / Math.max(pkg.len, 0.001)) : 1,
    };
    stack.items.push(placedPkg);
    stack.height += pkg.h;
    placed.push(placedPkg);
  });

  const rowH = getRowSummary(stacksByRow).map((row) => row.height);
  const unloadPlan = buildUnloadPlan(placed);
  const stopUnloadOrder = summarizeStopUnload(unloadPlan, stops);
  const filasUsadas = (rowH[0] > 0.001 ? 1 : 0) + (rowH[1] > 0.001 ? 1 : 0);
  const largoMax = placed.length ? Math.max(...placed.map((p) => p.len)) : 0;
  const heightOverflow = rowH.some((h) => h > maxH + 0.001) || placed.some((p) => p.ov);
  const lengthOverflow = largoMax > bed + 0.001;
  const cabe =
    !heightOverflow &&
    !lengthOverflow &&
    ![...warns].some((w) => /excede|2° camión|no entra|sobresale/i.test(w));

  return {
    placed,
    rowH,
    filasUsadas,
    largoMax,
    warns: [...warns],
    cabe,
    maxH,
    bedM: bed,
    maxLen: Math.max(...placed.map((p) => p.len), bed),
    maxX: placed.length ? Math.max(bed, ...placed.map((p) => p.xEnd)) : bed,
    rowCursor,
    minX: Math.min(0, ...placed.map((p) => p.xStart)),
    stacksByRow,
    unloadPlan,
    stopUnloadOrder,
    strategy,
    layoutMode: mode,
    layoutEngine: "stack",
    manualLayoutVersion: MANUAL_LAYOUT_VERSION,
  };
}

/**
 * Classify vehicle / occupancy for freight tariffs.
 *
 * Remolque (>8 m) only when the load actually fits on the long bed. A bare
 * `largoMax > 8` short-circuit previously auto-quoted remolque for height/
 * length overflows (e.g. 80×10 m ISODEC100 → cabe:false but venta USD 700).
 */
export function classifyVehicleOccupancy(pack8, packLong = null) {
  const largoMax = pack8?.largoMax || packLong?.largoMax || 0;
  if (largoMax > STANDARD_BED_M + 0.001) {
    if (packLong?.cabe) {
      return {
        vehicle: "remolque",
        filasUsadas: packLong.filasUsadas,
        largoMax: packLong.largoMax || largoMax,
        bedM: LONG_BED_M,
        pack: packLong,
        needsSpecialReview: false,
      };
    }
    return {
      vehicle: "especial",
      filasUsadas: packLong?.filasUsadas || pack8?.filasUsadas || 0,
      largoMax,
      bedM: LONG_BED_M,
      pack: packLong || pack8,
      needsSpecialReview: true,
    };
  }
  if (pack8?.cabe) {
    return {
      vehicle: pack8.filasUsadas <= 1 ? "estandar_1_fila" : "estandar_2_filas",
      filasUsadas: pack8.filasUsadas,
      largoMax,
      bedM: STANDARD_BED_M,
      pack: pack8,
      needsSpecialReview: false,
    };
  }
  if (packLong?.cabe) {
    return {
      vehicle: "camion_largo",
      filasUsadas: packLong.filasUsadas,
      largoMax: packLong.largoMax,
      bedM: LONG_BED_M,
      pack: packLong,
      needsSpecialReview: false,
    };
  }
  return {
    vehicle: "especial",
    filasUsadas: pack8?.filasUsadas || 0,
    largoMax,
    bedM: STANDARD_BED_M,
    pack: pack8,
    needsSpecialReview: true,
  };
}
