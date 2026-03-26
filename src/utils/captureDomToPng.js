// ═══════════════════════════════════════════════════════════════════════════
// DOM → data URL (JPEG) for embedding in print/PDF HTML
// ═══════════════════════════════════════════════════════════════════════════

import html2canvas from "html2canvas";

/**
 * @param {HTMLElement | null} element
 * @param {object} [opts]
 * @returns {Promise<string | null>} data:image/jpeg;base64,...
 */
export async function captureElementToDataUrl(element, opts = {}) {
  if (!element || !(element instanceof HTMLElement)) return null;
  if (element.offsetHeight < 2 && element.offsetWidth < 2) return null;
  try {
    const canvas = await html2canvas(element, {
      scale: opts.scale ?? 2,
      useCORS: true,
      logging: false,
      backgroundColor: opts.backgroundColor ?? "#ffffff",
      foreignObjectRendering: false,
    });
    return canvas.toDataURL("image/jpeg", opts.quality ?? 0.9);
  } catch {
    return null;
  }
}

/**
 * Parallel capture of calculator regions for PDF appendix.
 * @param {{ summaryEl?: HTMLElement | null, totalsEl?: HTMLElement | null, bordersEl?: HTMLElement | null }} targets
 * @returns {Promise<{ summary?: string, totals?: string, borders?: string }>}
 */
export async function capturePdfSnapshotTargets(targets = {}) {
  const { summaryEl, totalsEl, bordersEl } = targets;
  const [summary, totals, borders] = await Promise.all([
    summaryEl ? captureElementToDataUrl(summaryEl) : Promise.resolve(null),
    totalsEl ? captureElementToDataUrl(totalsEl) : Promise.resolve(null),
    bordersEl ? captureElementToDataUrl(bordersEl) : Promise.resolve(null),
  ]);
  const out = {};
  if (summary) out.summary = summary;
  if (totals) out.totals = totals;
  if (borders) out.borders = borders;
  return out;
}
