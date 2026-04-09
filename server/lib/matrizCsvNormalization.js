const EPS_TO_NORMALIZE = [50, 100, 150, 200, 250];

function serializeCsvCell(value) {
  const str = String(value ?? "");
  if (str.includes('"')) return `"${str.replace(/"/g, '""')}"`;
  if (str.includes(",") || str.includes("\n")) return `"${str}"`;
  return str;
}

/**
 * Split a CSV row preserving commas inside quoted fields.
 * Supports escaped quotes ("") per RFC4180.
 */
export function splitCsvRowSafe(row) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur);
  return cells;
}

/**
 * Normalizes CSV export rows so:
 * PANELS_TECHO.ISODEC_EPS.esp.X venta_local(+IVA)
 * matches PANELS_PARED.ISOPANEL_EPS.esp.X at same espesor.
 *
 * Mutates and returns the same csvRows array.
 */
export function normalizeIsodecEpsVentaLocalCsvRows(csvRows) {
  if (!Array.isArray(csvRows) || csvRows.length <= 1) return csvRows;

  const rowByPath = new Map();
  for (let i = 1; i < csvRows.length; i++) {
    const parts = splitCsvRowSafe(csvRows[i]);
    rowByPath.set(parts[0], { idx: i, parts });
  }

  for (const esp of EPS_TO_NORMALIZE) {
    const paredEntry = rowByPath.get(`PANELS_PARED.ISOPANEL_EPS.esp.${esp}`);
    const techoEntry = rowByPath.get(`PANELS_TECHO.ISODEC_EPS.esp.${esp}`);
    if (!paredEntry || !techoEntry) continue;
    if (paredEntry.parts[4] === techoEntry.parts[4]) continue;

    techoEntry.parts[4] = paredEntry.parts[4];
    techoEntry.parts[5] = paredEntry.parts[5];
    csvRows[techoEntry.idx] = techoEntry.parts.map(serializeCsvCell).join(",");
  }

  return csvRows;
}
