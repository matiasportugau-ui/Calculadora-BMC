/**
 * Canonical viewport breakpoints for JS. Must stay aligned with
 * src/styles/bmc-mobile.css @media rules and class semantics.
 *
 * @see docs/calculadora/MOBILE-VIEW-AUDIT.md
 */

export const VIEWPORT = {
  /** Matches @media (max-width: 639px) — phone-only (e.g. .bmc-desktop-actions hidden). */
  PHONE_MAX_PX: 639,
  /** Matches @media (min-width: 640px) tablet band lower bound. */
  TABLET_MIN_PX: 640,
  /** Matches @media (max-width: 1023px) — compact/mobile+tablet shell (.bmc-mobile-bar, grid). */
  MOBILE_LAYOUT_MAX_PX: 1023,
  /** Matches @media (min-width: 1024px) — desktop shell. */
  DESKTOP_MIN_PX: 1024,
  /** Matches @media (max-width: 759px) — .bmc-pdf-modal-compact + PDFPreviewModal compact mode. */
  PDF_COMPACT_MODAL_MAX_PX: 759,
  /**
   * /logistica only (not the calculator). Compact master 390×844.
   * CSS: ruta-desk.css + bmc-envios-glass.css @media (max-width: 767px).
   */
  LOGISTICA_COMPACT_MAX_PX: 767,
  /** /logistica tablet lower bound — map + itinerary coexist. */
  LOGISTICA_REGULAR_MIN_PX: 768,
  /** /logistica wide — persistent 50/50 split. */
  LOGISTICA_WIDE_MIN_PX: 1024,
};

/** Media query string for PDF preview full-screen / compact layout (same threshold as CSS). */
export function mqCompactPdfModal() {
  return `(max-width: ${VIEWPORT.PDF_COMPACT_MODAL_MAX_PX}px)`;
}

export function isPhoneViewportWidth(widthPx) {
  return widthPx <= VIEWPORT.PHONE_MAX_PX;
}

export function isTabletViewportWidth(widthPx) {
  return widthPx >= VIEWPORT.TABLET_MIN_PX && widthPx <= VIEWPORT.MOBILE_LAYOUT_MAX_PX;
}

/** True when the main calculator should use compact/mobile+tablet layout (≤1023px). */
export function isCompactMainLayoutWidth(widthPx) {
  return widthPx <= VIEWPORT.MOBILE_LAYOUT_MAX_PX;
}

/** /logistica compact (phone) — stack + thumb CTAs. Not the calculator 1023 shell. */
export function isLogisticaCompactLayoutWidth(widthPx) {
  return widthPx <= VIEWPORT.LOGISTICA_COMPACT_MAX_PX;
}

/** /logistica tablet band (768–1023). */
export function isLogisticaRegularLayoutWidth(widthPx) {
  return widthPx >= VIEWPORT.LOGISTICA_REGULAR_MIN_PX && widthPx < VIEWPORT.LOGISTICA_WIDE_MIN_PX;
}
