/**
 * Display + packing dimensions for placed packages (panels vs accessories).
 * Accessories carry real width; panels occupy full row width (ROW_W).
 */

import { ROW_W } from "./cargoPacking.js";

/**
 * @param {object} pkg placed or built package
 * @returns {{ L: number, W: number, H: number, isAccessory: boolean, volumeM3: number }}
 */
export function packagePhysicalDims(pkg = {}) {
  const isAccessory =
    pkg.kind === "accessory" || String(pkg.tipo || "").toUpperCase() === "ACCESORIOS";
  const L = Math.max(0, Number(pkg.len) || 0);
  const H = Math.max(0, Number(pkg.h) || 0);
  const rawW = Number(pkg.width ?? pkg.w ?? pkg.ancho);
  const W = isAccessory
    ? Math.max(0.05, Number.isFinite(rawW) && rawW > 0 ? rawW : 0.3)
    : ROW_W;
  return {
    L,
    W,
    H,
    isAccessory,
    volumeM3: L * W * H,
  };
}

/**
 * Human-readable L×W×H for UI (accessories use real W; panels show L×H with row note optional).
 * @param {object} pkg
 * @param {{ includeVol?: boolean }} [opts]
 */
export function formatPackageDimsLabel(pkg, opts = {}) {
  const d = packagePhysicalDims(pkg);
  if (d.isAccessory) {
    const base = `${d.L.toFixed(2)}m × ${(d.W * 100).toFixed(0)}cm × ${(d.H * 100).toFixed(0)}cm`;
    return opts.includeVol ? `${base} · ≈${d.volumeM3.toFixed(2)} m³` : base;
  }
  const base = `${d.L.toFixed(2)}m × ${(d.H * 100).toFixed(0)}cm (fila ${ROW_W}m)`;
  return opts.includeVol ? `${base} · ≈${d.volumeM3.toFixed(2)} m³` : base;
}

/**
 * Lateral offset inside a row so accessory sits centered (not stretched to ROW_W).
 * @param {object} pkg
 * @returns {number} meters from row origin (y)
 */
export function packageRowYOffset(pkg) {
  const d = packagePhysicalDims(pkg);
  const row = Number(pkg.row) || 0;
  if (!d.isAccessory) return row * ROW_W;
  return row * ROW_W + (ROW_W - d.W) / 2;
}
