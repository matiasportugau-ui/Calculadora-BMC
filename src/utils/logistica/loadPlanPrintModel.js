/**
 * Load-plan printable model (Ops UX F6).
 * Pure — unload order + package identity for multi-view print sheet.
 *
 * Package X coordinates are mirrored to the same cabin-left / cola-right
 * convention as SVG/3D (`bmcLogisticaBedView`), so a printed plan matches
 * what operators see on screen.
 */

import { bedViewExtents, mirrorBedXForView } from "../bmcLogisticaBedView.js";
import { packageCuboidMetrics } from "./remitoPackageMetrics.js";

/**
 * @param {object} pkg
 * @returns {string}
 */
export function packageIdentityLabel(pkg) {
  if (!pkg) return "";
  const cli = String(pkg.sCli || "").trim();
  const ped = String(pkg.sPed || "").trim();
  const shortCli = cli.length > 18 ? `${cli.slice(0, 16)}…` : cli;
  if (shortCli && ped) return `${shortCli}\n#${ped}`;
  if (shortCli) return shortCli;
  if (ped) return `#${ped}`;
  return pkg.kind === "accessory" ? `P${pkg.sOrd}·ACC` : `P${pkg.sOrd}·${pkg.n}`;
}

/**
 * @param {object} pkg
 * @returns {string} single-line for SVG
 */
export function packageIdentityLabelFlat(pkg) {
  return packageIdentityLabel(pkg).replace(/\n/g, " · ");
}

/**
 * Build unload steps from cargo (door/tail first when available).
 * @param {{ cargo?: object, stops?: object[] }} input
 */
export function buildUnloadSteps(input = {}) {
  const cargo = input.cargo || {};
  const stops = Array.isArray(input.stops) ? input.stops : [];
  const stopById = new Map(stops.map((s) => [s.id, s]));

  if (Array.isArray(cargo.stopUnloadOrder) && cargo.stopUnloadOrder.length) {
    return cargo.stopUnloadOrder.map((entry, i) => {
      const stop = entry.stop || stopById.get(entry.stopId) || {};
      return {
        step: i + 1,
        stopId: stop.id || entry.stopId,
        orden: stop.orden ?? entry.orden,
        cliente: stop.cliente || entry.cliente || "",
        orderId: stop.orderId || stop.cotizacionId || "",
        note: entry.note || "Descargar parada (orden físico)",
      };
    });
  }

  // Fallback: reverse stop orden (last loaded ≈ first out of door for simple routes)
  const ordered = [...stops].sort((a, b) => (b.orden || 0) - (a.orden || 0));
  return ordered.map((stop, i) => ({
    step: i + 1,
    stopId: stop.id,
    orden: stop.orden,
    cliente: stop.cliente || "",
    orderId: stop.orderId || stop.cotizacionId || "",
    note: "Orden inverso de paradas (fallback)",
  }));
}

/**
 * @param {{ info?: object, stops?: object[], cargo?: object, truckL?: number }} input
 */
export function buildLoadPlanPrintModel(input = {}) {
  const cargo = input.cargo || { placed: [], rowH: [0, 0] };
  const placed = Array.isArray(cargo.placed) ? cargo.placed : [];
  const truckL = Number(input.truckL) || 8;
  const { minXV, maxXV } = bedViewExtents(placed, truckL);

  const packages = placed.map((pkg) => {
    const cuboid = packageCuboidMetrics(pkg);
    const engStart = pkg.xStart ?? 0;
    const engEnd = pkg.xEnd ?? engStart + (pkg.len || 0);
    const mirrored = mirrorBedXForView({ xStart: engStart, xEnd: engEnd }, truckL);
    return {
      id: pkg.id,
      stableKey: pkg.stableKey,
      label: packageIdentityLabelFlat(pkg),
      sCli: pkg.sCli || "",
      sPed: pkg.sPed || "",
      sOrd: pkg.sOrd,
      row: pkg.row,
      /** View coords: cabin left (low X), cola/door right — same as SVG/3D */
      xStart: mirrored.xStart,
      xEnd: mirrored.xEnd,
      zBase: pkg.zBase ?? 0,
      len: pkg.len,
      h: pkg.h,
      volumeM3: cuboid.volumeM3,
      ov: Boolean(pkg.ov),
      sCol: pkg.sCol || "#003366",
      tipo: pkg.tipo,
      n: pkg.n,
    };
  });

  return {
    header: {
      numero: input.info?.numero || "",
      fecha: input.info?.fecha || "",
      transportista: input.info?.transportista || "",
      patente: input.info?.patente || "",
      truckL,
    },
    unloadSteps: buildUnloadSteps({ cargo, stops: input.stops }),
    packages,
    rowH: cargo.rowH || [0, 0],
    /** Left edge of view (0, or negative if ever needed); packages use cabin-left X */
    minX: minXV,
    maxX: maxXV,
    orientation: {
      cabin: "left",
      cola: "right",
      note: "Cabina izquierda · cola / puerta derecha (igual que vistas SVG/3D)",
    },
  };
}
