// panelLayout.js — Fuente de verdad para plano Y cotización de paneles
// Depende de: (ninguno — función pura)
// Consumido por: RoofPlanDimensions.jsx, RoofPreview.jsx, panelLayoutVerification.js
// ISO 129 / IRAM 4513 compliance: sí — genera datos para cadena + overall

/**
 * Genera el layout completo de paneles para UN lado/zona del techo.
 * Única fuente de verdad compartida entre el plano SVG y el motor de BOM.
 *
 * Alineado con `buildAnchoStripsPlanta` y `panelCountAcrossAnchoPlanta`:
 * usa Math.ceil(ancho / au - 1e-9) para evitar off-by-one en múltiplos exactos.
 *
 * @param {{ au: number, largo: number, ancho: number }} opts
 *   au    — ancho útil del panel en metros (ej: 1.12 para ISODEC_EPS)
 *   largo — largo del panel en metros (ej: 6)
 *   ancho — ancho total a cubrir en metros (ej: 8.36)
 * @returns {PanelLayoutResult}
 */
export function buildPanelLayout(opts = {}) {
  // Compat: aceptar firma histórica { panel, largo, ancho } además de { au, largo, ancho }.
  const au = Number(opts.au ?? opts.panel?.au ?? 0);
  const largo = Number(opts.largo ?? 0);
  const ancho = Number(opts.ancho ?? 0);

  if (!(au > 0) || !(largo > 0) || !(ancho > 0)) {
    return {
      panels: [],
      nPaneles: 0,
      nEnteros: 0,
      nCortados: 0,
      anchoTotal: 0,
      largoTotal: largo ?? 0,
      anchoCorte: null,
      area: 0,
      nJuntas: 0,
      au: au ?? 0,
      inputAncho: ancho ?? 0,
      inputLargo: largo ?? 0,
      isValid: false,
      warnings: ['Parámetros insuficientes para calcular layout'],
    };
  }

  const n = Math.max(1, Math.ceil(ancho / au - 1e-9));
  const panels = [];
  let x0 = 0;

  for (let i = 0; i < n; i++) {
    const remaining = ancho - x0;
    // Clamp last panel: floating-point accumulation can make `remaining`
    // slightly > au (e.g. 5.6000000000000005 / 1.12 = 5 exact panels but
    // remaining ≈ 1.1200000000000001). Also guard against negative remainder.
    const width = i < n - 1 ? au : Math.min(au, Math.max(0, remaining));
    const isCut = width < au - 1e-9;
    panels.push({
      index: i,
      id: `T-${String(i + 1).padStart(2, '0')}`,
      x0,
      width,
      isCut,
      isStandard: !isCut,
    });
    x0 += width;
  }

  const nCortados = panels.filter((p) => p.isCut).length;
  const nEnteros = n - nCortados;
  const anchoTotal = panels.reduce((s, p) => s + p.width, 0);
  const area = anchoTotal * largo;
  const nJuntas = n - 1;
  const anchoCorte = nCortados > 0 ? panels[n - 1].width : null;

  const warnings = [];
  if (nCortados > 0) {
    warnings.push(
      `Panel ${panels[n - 1].id} requiere corte a ${Math.round(anchoCorte * 1000)} mm (descarte: ${Math.round((au - anchoCorte) * 1000)} mm)`
    );
  }
  if (largo > 12) {
    warnings.push(`Largo ${largo} m supera máximo de transporte (12 m)`);
  }
  if (largo < 2.3) {
    warnings.push(`Largo ${largo} m es menor al mínimo de producción (2,3 m)`);
  }

  return {
    panels,
    nPaneles: n,
    nEnteros,
    nCortados,
    anchoTotal,
    largoTotal: largo,
    anchoCorte,
    area: +area.toFixed(4),
    nJuntas,
    au,
    inputAncho: ancho,
    inputLargo: largo,
    isValid: anchoTotal >= ancho - 1e-6,
    warnings,
  };
}

/**
 * @typedef {Object} PanelLayoutResult
 * @property {Array<{index:number, id:string, x0:number, width:number, isCut:boolean, isStandard:boolean}>} panels
 * @property {number} nPaneles
 * @property {number} nEnteros
 * @property {number} nCortados
 * @property {number} anchoTotal
 * @property {number} largoTotal
 * @property {number|null} anchoCorte
 * @property {number} area
 * @property {number} nJuntas
 * @property {number} au
 * @property {number} inputAncho
 * @property {number} inputLargo
 * @property {boolean} isValid
 * @property {string[]} warnings
 */
