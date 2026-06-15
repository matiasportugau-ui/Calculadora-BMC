/**
 * Helpers for MATRIZ rows whose supplier SKU is reused across multiple products.
 *
 * Some BROMYROS rows share col-D SKU but differ by thickness in the description
 * (for example PU50MM for 50/40/60/80 mm profiles). The calculator mapping is
 * path-based, so pick the row whose description matches the path thickness
 * instead of letting the last duplicate win.
 */

export function extractMatrizPathEspesor(path) {
  const match = String(path || "").match(/\.(\d+)$/);
  return match ? match[1] : null;
}

export function rowDescriptionMatchesEspesor(row, descripcionIndex, espesor) {
  if (!espesor || descripcionIndex == null || descripcionIndex < 0) return false;
  const description = String(row?.[descripcionIndex] || "");
  return new RegExp(`\\b${espesor}\\s?mm\\b`, "i").test(description);
}

export function selectMatrizRowForPath(group, path, descripcionIndex) {
  const entries = (group || [])
    .map((entry, fallbackIndex) => {
      if (Array.isArray(entry)) return { row: entry, rowIndex: fallbackIndex };
      return {
        row: entry?.row,
        rowIndex: entry?.rowIndex ?? fallbackIndex,
      };
    })
    .filter((entry) => Array.isArray(entry.row));

  if (entries.length <= 1) return entries[0] || null;

  const espesor = extractMatrizPathEspesor(path);
  if (espesor) {
    const match = entries.find((entry) =>
      rowDescriptionMatchesEspesor(entry.row, descripcionIndex, espesor),
    );
    if (match) return match;
  }

  return entries[0];
}
