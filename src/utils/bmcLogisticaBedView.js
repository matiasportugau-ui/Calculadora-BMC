/**
 * Vista operativa del plan de carga: el motor usa coordenadas internas (x hacia cabina, saliente en x<0);
 * aquí se espeja para dibujar cabina a la izquierda y cola a la derecha (saliente hacia x>truckL en vista).
 * @module bmcLogisticaBedView
 */

import { MAX_H } from "./bmcLogisticaCargo.js";

export const LOGISTICA_PLAN_EXPORT_SCHEMA_VERSION = 1;

export function mirrorBedXForView(p, truckL) {
  return {
    xStart: truckL - p.xEnd,
    xEnd: truckL - p.xStart,
  };
}

export function mirrorStackForView(stack, truckL) {
  return {
    ...stack,
    xStart: truckL - stack.xEnd,
    xEnd: truckL - stack.xStart,
  };
}

export function bedViewExtents(placed, truckL) {
  if (!placed.length) {
    return { minXV: 0, maxXV: truckL, placedView: [] };
  }
  const placedView = placed.map((p) => ({
    ...p,
    ...mirrorBedXForView(p, truckL),
  }));
  const minXV = Math.min(0, ...placedView.map((p) => p.xStart));
  const maxXV = Math.max(truckL, ...placedView.map((p) => p.xEnd));
  return { minXV, maxXV, placedView };
}

/**
 * KPIs derivados del resultado de `placeCargo` + extensión en vista espejada.
 * @param {object} cargo — retorno de `placeCargo`
 * @param {number} truckL — largo útil camión (m)
 */
export function computeLogisticaKpis(cargo, truckL) {
  const { minXV, maxXV } = bedViewExtents(cargo.placed || [], truckL);
  const salienteM = Math.max(0, maxXV - truckL);
  const spanM = maxXV - minXV;
  const rowH = cargo.rowH || [0, 0];
  const maxRowH = Math.max(rowH[0] || 0, rowH[1] || 0);
  return {
    minXV: round3(minXV),
    maxXV: round3(maxXV),
    salienteM: round3(salienteM),
    spanM: round3(spanM),
    hasSaliente: salienteM > 0.001,
    packageCount: (cargo.placed || []).length,
    stackCount: (cargo.stacksByRow || []).reduce((n, row) => n + row.length, 0),
    rowPeakM: round3(maxRowH),
    rowHeightPctOfLimit: Math.round((maxRowH / MAX_H) * 1000) / 10,
    warnCount: (cargo.warns || []).length,
  };
}

function round3(x) {
  return Math.round(x * 1000) / 1000;
}

function slimPlacedForExport(p) {
  return {
    id: p.id,
    sId: p.sId,
    sOrd: p.sOrd,
    n: p.n,
    len: p.len,
    h: p.h,
    row: p.row,
    xStart: p.xStart,
    xEnd: p.xEnd,
    zBase: p.zBase,
    stackId: p.stackId,
    kind: p.kind,
    ov: p.ov,
    ovh: p.ovh,
  };
}

/**
 * Contrato JSON estable para auditoría, comparación de estrategias e integración futura con otros solvers.
 * @param {{ truckL: number, cargo: object, remitoNumero?: string | null }} args
 */
export function buildLogisticaPlanExportPayload({ truckL, cargo, remitoNumero = null }) {
  const kpis = computeLogisticaKpis(cargo, truckL);
  return {
    schemaVersion: LOGISTICA_PLAN_EXPORT_SCHEMA_VERSION,
    kind: "bmc-logistica-plan",
    generatedAt: new Date().toISOString(),
    remitoNumero: remitoNumero || null,
    truckLengthM: truckL,
    strategy: cargo.strategy,
    layoutMode: cargo.layoutMode,
    manualLayoutVersion: cargo.manualLayoutVersion,
    kpis,
    engine: {
      minX: cargo.minX,
      maxX: cargo.maxX,
      maxPanelLengthM: cargo.maxLen,
    },
    view: {
      minXV: kpis.minXV,
      maxXV: kpis.maxXV,
      note: "Eje X espejado respecto al motor: cabina izquierda, cola derecha; saliente hacia la cola (maxXV > truckLengthM).",
    },
    warns: [...(cargo.warns || [])],
    unloadOrder: (cargo.stopUnloadOrder || []).map((s) => ({
      stopId: s.stop.id,
      orden: s.stop.orden,
      cliente: s.stop.cliente || null,
      firstRank: s.firstRank,
      pkgCount: s.pkgs.length,
    })),
    placed: (cargo.placed || []).map(slimPlacedForExport),
  };
}
