/**
 * Remito / hoja de ruta package metrics (Ops UX F3b).
 * Pure — reuses ROW_W + loadCharacteristics for material volume estimates.
 */

import { buildStopPackages } from "./cargoPacking.js";
import { ROW_W, estimateStopLoadPhysical, estimateRouteLoadPhysical } from "./loadCharacteristics.js";

/**
 * Cuboid volume of a placed/build package (bed occupancy).
 * @param {{ len?: number, h?: number, w?: number, ancho?: number, width?: number }} pkg
 * @param {number} [widthM]
 * @returns {{ L: number, W: number, H: number, volumeM3: number }}
 */
export function packageCuboidMetrics(pkg = {}, widthM = ROW_W) {
  const L = Math.max(0, Number(pkg.len) || 0);
  const W = Math.max(0, Number(pkg.w ?? pkg.ancho ?? pkg.width) || widthM);
  const H = Math.max(0, Number(pkg.h) || 0);
  return {
    L,
    W,
    H,
    volumeM3: L * W * H,
  };
}

/**
 * @param {number} n
 * @param {number} [digits=3]
 */
export function formatM3(n, digits = 3) {
  const v = Number(n) || 0;
  return v.toFixed(digits);
}

/**
 * @param {number} m
 */
export function formatM(m) {
  const v = Number(m) || 0;
  return `${v.toFixed(2)}m`;
}

/**
 * Canonical remito/WA package code for a stop package index (1-based B#).
 * Must match `stopPackageCode` / WhatsApp lines from `buildStopPackages` order —
 * NOT `cargo.placed` order (packing sorts by length and can reorder).
 * @param {object} stop
 * @param {number} index zero-based index in buildStopPackages(stop)
 */
export function stopPackageCodeAt(stop, index) {
  const n = Math.max(0, Math.floor(Number(index) || 0)) + 1;
  return `P${stop?.orden || "?"}-B${n}`;
}

/**
 * Map placed packages → codes via stableKey against buildStopPackages(stop).
 * Packing may reorder or split; codes must stay aligned with WA / form labels.
 * @param {object} stop
 * @param {object[]} [placed]
 * @returns {Map<string, string>} stableKey → code (first placed part wins for splits)
 */
export function buildStopPackageCodeMap(stop) {
  const canonical = buildStopPackages(stop);
  return new Map(
    canonical.map((pkg, index) => [pkg.stableKey, stopPackageCodeAt(stop, index)]),
  );
}

/**
 * One row per physical package for remito table.
 * @param {object} stop
 * @param {object[]} placed cargo.placed for this stop
 * @param {(stop: object, index: number, pkg: object) => string} [codeFn]
 * @returns {object[]}
 */
export function buildRemitoPackageRows(stop, placed = [], codeFn) {
  const list = Array.isArray(placed) ? placed : [];
  const codeByStableKey = buildStopPackageCodeMap(stop);
  return list.map((pkg, index) => {
    const cuboid = packageCuboidMetrics(pkg);
    const resolved =
      (pkg?.stableKey && codeByStableKey.get(pkg.stableKey)) ||
      stopPackageCodeAt(stop, index);
    const code =
      typeof codeFn === "function" ? codeFn(stop, index, pkg) : resolved;
    const kind = pkg.kind === "accessory" ? "Accesorios" : pkg.tipo || "PANEL";
    const contenido =
      pkg.kind === "accessory"
        ? `Accesorios · ${(stop.accesorios || []).map((a) => `${a.cantidad}× ${a.descr}`).filter(Boolean).join(", ") || "bulto"}`
        : `${kind} ${pkg.esp || "—"}mm · ${pkg.n || 0} u.`;
    return {
      code,
      contenido,
      tipo: kind,
      espesorMm: pkg.esp ?? null,
      cantidad: pkg.n ?? 0,
      fila: pkg.row === 1 ? "B" : "A",
      L: cuboid.L,
      W: cuboid.W,
      H: cuboid.H,
      dimsLabel: `${formatM(cuboid.L)} × ${formatM(cuboid.W)} × ${formatM(cuboid.H)}`,
      volumeM3: cuboid.volumeM3,
      packageId: pkg.id,
      stableKey: pkg.stableKey || null,
    };
  });
}

/**
 * Full remito model for one trip.
 * @param {{ info?: object, stops?: object[], cargo?: object, truckL?: number, codeFn?: Function }} input
 */
export function buildRemitoSimpleModel(input = {}) {
  const stops = Array.isArray(input.stops) ? input.stops : [];
  const cargo = input.cargo || { placed: [], rowH: [0, 0] };
  const placedAll = Array.isArray(cargo.placed) ? cargo.placed : [];
  const routePhys = estimateRouteLoadPhysical(stops);

  let cuboidVol = 0;
  const sections = stops.map((stop) => {
    const placed = placedAll.filter((p) => p.sId === stop.id);
    const packages = buildRemitoPackageRows(stop, placed, input.codeFn);
    const stopCuboid = packages.reduce((t, r) => t + r.volumeM3, 0);
    cuboidVol += stopCuboid;
    const phys = estimateStopLoadPhysical(stop);
    return {
      stopId: stop.id,
      orden: stop.orden,
      cliente: stop.cliente || "",
      telefono: stop.telefono || "",
      direccion: stop.direccion || "",
      orderId: stop.orderId || stop.cotizacionId || "",
      estado: stop.estado || "",
      color: stop.color || "#003366",
      packageCount: packages.length,
      packages,
      cuboidVolumeM3: stopCuboid,
      materialVolumeM3: phys.volumeM3,
      m2: phys.m2,
      estWeightKg: phys.estWeightKg,
      filaA: placed.filter((p) => p.row === 0).length,
      filaB: placed.filter((p) => p.row === 1).length,
    };
  });

  return {
    header: {
      numero: input.info?.numero || "",
      fecha: input.info?.fecha || "",
      transportista: input.info?.transportista || "",
      patente: input.info?.patente || "",
      notas: input.info?.notas || "",
      truckL: input.truckL ?? 8,
    },
    sections,
    totals: {
      stops: stops.length,
      packages: placedAll.length,
      cuboidVolumeM3: cuboidVol,
      materialVolumeM3: routePhys.volumeM3,
      m2: routePhys.m2,
      estWeightKg: routePhys.estWeightKg,
      rowH: cargo.rowH || [0, 0],
    },
  };
}
