/**
 * Explicación de paquetes y colocación a partir del motor BMC (buildPkgs / placeCargo).
 */

import { buildPkgs, placeCargo, resetDefaultCargoIds } from "./cargoEngine.js";

/**
 * Por cada línea de panel: cuántos paquetes genera MAX_P y desglose corto.
 * @param {{ id: string, orden: number, cliente?: string, color?: string, paneles: any[] }} stop
 * @returns {Array<{ label: string, pkgCount: number, detail: string }>}
 */
export function describePanelPackages(stop) {
  resetDefaultCargoIds();
  const out = [];
  for (const p of stop.paneles || []) {
    const pkgs = buildPkgs(stop, p);
    const parts = pkgs.map(
      (pk, i) => `Paq.${i + 1}: ${pk.n}×${pk.esp}mm · L${pk.len}m · ~${(pk.h * 100).toFixed(0)}cm alto`
    );
    out.push({
      label: `${p.tipo} ${p.espesor}mm · L${p.longitud}m · cant ${p.cantidad}`,
      pkgCount: pkgs.length,
      detail: parts.join(" · "),
    });
  }
  return out;
}

/**
 * Colocación en camión para una sola parada (filas A/B, advertencias).
 * @param {Parameters<typeof placeCargo>[0][0]} stop
 * @param {number} truckL
 */
export function describeTruckPlacementOneStop(stop, truckL) {
  resetDefaultCargoIds();
  return placeCargo([stop], truckL);
}
