// ═══════════════════════════════════════════════════════════════════════════
// csvPricingImport.js — CSV MATRIZ / planilla precios: columnas y números
// Usado por PricingEditor y scripts de verificación (Node + Vite).
// ═══════════════════════════════════════════════════════════════════════════

/** Columna de venta: MATRIZ API (`venta_local`) o export editor (`venta_bmc_local` / `venta_bmc` / `venta`). No mapea `venta_local_iva_inc`. */
export function findVentaColumnIndex(headers) {
  return headers.findIndex((c) => {
    const cl = String(c || "").trim().toLowerCase();
    if (cl === "venta_local") return true;
    if (/venta_bmc_local|venta_bmc/i.test(String(c || ""))) return true;
    return cl === "venta" && !/web/i.test(cl);
  });
}

/**
 * Parseo numérico para celdas CSV (USD).
 * - Con coma decimal (UY/Europa): quita puntos miles luego coma → punto (`1.025,50` → 1025.5).
 * - Sin coma: `parseFloat` estándar (`1025.50`, `42.99`).
 */
export function parseCsvNumber(raw) {
  if (raw == null) return null;
  let s = String(raw).replace(/["\s]/g, "").trim();
  if (!s) return null;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const v = parseFloat(s);
  return Number.isNaN(v) || v < 0 ? null : +v.toFixed(2);
}

/** Una fila CSV con campos entre comillas escapadas como en Excel. */
export function splitCsvCells(row) {
  const cells = row.match(/("(?:[^"]|"")*"|[^,]*)/g)?.map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"').trim()) || row.split(",");
  return cells;
}

/**
 * Paths que aparecen más de una vez (import: gana la última fila).
 * @param {string[]} lines — incluye cabecera en [0]
 * @param {number} pathIdx
 * @returns {{ path: string, count: number, lineNumbers: number[] }[]}
 */
export function getDuplicatePathReport(lines, pathIdx) {
  if (pathIdx < 0 || lines.length < 2) return [];
  const byPath = new Map();
  for (let i = 1; i < lines.length; i++) {
    const path = splitCsvCells(lines[i])[pathIdx]?.trim();
    if (!path) continue;
    if (!byPath.has(path)) byPath.set(path, []);
    byPath.get(path).push(i + 1);
  }
  return [...byPath.entries()]
    .filter(([, nums]) => nums.length > 1)
    .map(([path, lineNumbers]) => ({ path, count: lineNumbers.length, lineNumbers }));
}
