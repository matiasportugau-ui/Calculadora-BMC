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
 * Serialize an SVG element to a plain SVG string — vectorial, no rasterization.
 * Used for PDF injection: the string is embedded directly in the HTML so
 * Playwright (or the browser print path) renders it at full vector quality.
 * @param {SVGSVGElement | null} svgEl
 * @returns {string | null}
 */
export function serializeRoofPlanSvgToString(svgEl) {
  if (!svgEl) return null;
  try {
    const clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.style.cssText = 'width:100%;height:auto;display:block';
    return new XMLSerializer().serializeToString(clone);
  } catch {
    return null;
  }
}

/**
 * Parallel capture of calculator regions for PDF appendix.
 * roofPlan2dSvg — vectorial SVG string (preferred for PDF quality)
 * roofPlan2d    — rasterized PNG data URL (fallback / legacy)
 * @param {{ summaryEl?: HTMLElement | null, totalsEl?: HTMLElement | null, bordersEl?: HTMLElement | null, roofPlanSvgEl?: SVGSVGElement | null, roof3dCanvasEl?: HTMLCanvasElement | null }} targets
 * @returns {Promise<{ summary?: string, totals?: string, borders?: string, roofPlan2dSvg?: string, roofPlan2d?: string, roof3d?: string }>}
 */
export async function capturePdfSnapshotTargets(targets = {}) {
  const { summaryEl, totalsEl, bordersEl, roofPlanSvgEl, roof3dCanvasEl } = targets;
  const [summary, totals, borders] = await Promise.all([
    summaryEl ? captureElementToDataUrl(summaryEl) : Promise.resolve(null),
    totalsEl ? captureElementToDataUrl(totalsEl) : Promise.resolve(null),
    bordersEl ? captureElementToDataUrl(bordersEl) : Promise.resolve(null),
  ]);
  const roof3d = roof3dCanvasEl ? capture3dCanvasToDataUrl(roof3dCanvasEl) : null;
  const roofPlan2dSvg = roofPlanSvgEl ? serializeRoofPlanSvgToString(roofPlanSvgEl) : null;
  const out = {};
  if (summary) out.summary = summary;
  if (totals) out.totals = totals;
  if (borders) out.borders = borders;
  if (roofPlan2dSvg) out.roofPlan2dSvg = roofPlan2dSvg;
  if (roof3d) out.roof3d = roof3d;
  return out;
}

/**
 * Serialize an SVG element to a PNG data URL via canvas.
 * @param {SVGSVGElement | null} svgEl
 * @param {{ scale?: number, backgroundColor?: string }} [opts]
 * @returns {Promise<string | null>} data:image/png;base64,...
 */
export async function captureRoofPlanSvgToDataUrl(svgEl, opts = {}) {
  if (!svgEl) return null;
  try {
    const clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const scale = opts.scale ?? 2;
    const vb = svgEl.viewBox?.baseVal;
    const w = (vb?.width || svgEl.clientWidth || 800) * scale;
    const h = (vb?.height || svgEl.clientHeight || 600) * scale;
    return await new Promise((resolve) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = opts.backgroundColor ?? '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}

/**
 * Capture a WebGL/3D canvas element to a data URL.
 * The canvas MUST have `preserveDrawingBuffer: true`.
 * @param {HTMLCanvasElement | null} canvasEl
 * @returns {string | null}
 */
export function capture3dCanvasToDataUrl(canvasEl) {
  if (!canvasEl) return null;
  try {
    return canvasEl.toDataURL('image/png');
  } catch {
    return null;
  }
}
