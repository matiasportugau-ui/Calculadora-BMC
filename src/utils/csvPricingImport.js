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

/** `venta_web` exacta — no confundir con `venta_web_iva_inc`. */
export function findVentaWebColumnIndex(headers) {
  return headers.findIndex((c) => String(c || "").trim().toLowerCase() === "venta_web");
}

/** Referencia MATRIZ col U → CSV `venta_web_iva_inc`. */
export function findVentaWebIvaIncColumnIndex(headers) {
  return headers.findIndex((c) => String(c || "").trim().toLowerCase() === "venta_web_iva_inc");
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
 * Parser CSV tolerante a comillas, comas y saltos de línea dentro de celdas.
 * Devuelve una matriz `rows[rowIdx][colIdx]`.
 */
export function parseCsvRows(text) {
  const input = String(text ?? "");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell.trim());
      if (row.some((v) => String(v || "").trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((v) => String(v || "").trim() !== "")) rows.push(row);
  }

  return rows;
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

/**
 * Igual que `getDuplicatePathReport`, pero para filas ya parseadas con `parseCsvRows`.
 */
export function getDuplicatePathReportFromRows(rows, pathIdx) {
  if (pathIdx < 0 || rows.length < 2) return [];
  const byPath = new Map();
  for (let i = 1; i < rows.length; i++) {
    const path = rows[i]?.[pathIdx]?.trim();
    if (!path) continue;
    if (!byPath.has(path)) byPath.set(path, []);
    byPath.get(path).push(i + 1);
  }
  return [...byPath.entries()]
    .filter(([, nums]) => nums.length > 1)
    .map(([path, lineNumbers]) => ({ path, count: lineNumbers.length, lineNumbers }));
}
