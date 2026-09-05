/**
 * Shopify variant matching for storefront quote → cart.
 * Kept in sync with server/public/storefront-voice/widget.js (browser IIFE, no imports).
 */

/** Exact thickness token: "50" must not match "150mm". */
export function mmInTitle(title, mm) {
  if (!mm) return true;
  const t = String(title || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  const n = String(mm).replace(/\D/g, "");
  if (!n) return true;
  // Prefer "50mm"; bare "50" only when not glued to another digit (avoids 150/250).
  if (new RegExp(`(?:^|[^0-9])${n}mm(?:[^0-9]|$)`).test(t)) return true;
  if (/\dmm/.test(t)) return false;
  return new RegExp(`(?:^|[^0-9])${n}(?:[^0-9]|$)`).test(t);
}

export function colorInTitle(title, color) {
  if (!color) return true;
  return String(title || "")
    .toLowerCase()
    .includes(String(color).toLowerCase());
}

/**
 * Pick the best Shopify variant for a quote line.
 * When espesor is set, refuse to return a variant that does not match that mm
 * (never silently substitute 100mm for a 50mm quote).
 */
export function pickVariant(product, line) {
  const vs = (product && product.variants) || [];
  if (!vs.length) return null;
  const mm = String(line?.espesor || "").replace(/\D/g, "");
  const color = String(line?.color || "Blanco");
  const scored = vs.map((v) => {
    const title = `${v.title || ""} ${v.option1 || ""} ${v.option2 || ""} ${v.option3 || ""}`;
    let score = 0;
    if (mm && mmInTitle(title, mm)) score += 4;
    if (colorInTitle(title, color)) score += 2;
    if (v.available !== false) score += 1;
    return { v, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return null;
  if (mm && best.score < 4) return null;
  return best.v;
}
