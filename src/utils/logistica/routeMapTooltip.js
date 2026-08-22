/**
 * Safe Leaflet pin tooltips for /logistica RouteLeafletMap.
 *
 * Leaflet's bindTooltip(string) writes to innerHTML — never pass sheet/operator
 * labels (cliente, place names) as raw HTML strings.
 */

/**
 * Plain-text tooltip for a route pin.
 * @param {{ label?: string, geo?: { isManuallyAdjusted?: boolean, source?: string } } | null | undefined} leg
 * @param {number} index 0-based position in the legs array
 * @returns {string}
 */
export function routePinTooltipText(leg, index) {
  const n = Number(index) + 1;
  const label = String(leg?.label ?? "");
  const moved = Boolean(leg?.geo?.isManuallyAdjusted) || leg?.geo?.source === "manual";
  return `${Number.isFinite(n) ? n : 1}. ${label}${moved ? " · pin aprox. (movido)" : ""}`;
}

/**
 * Build a Text-only node for Leaflet bindTooltip / bindPopup.
 * @param {string} text
 * @param {Pick<Document, "createElement">} [doc]
 * @returns {HTMLElement}
 */
export function createLeafletTextTooltip(text, doc = typeof document !== "undefined" ? document : null) {
  if (!doc?.createElement) {
    throw new Error("createLeafletTextTooltip requires a Document");
  }
  const el = doc.createElement("span");
  el.textContent = String(text ?? "");
  return el;
}
