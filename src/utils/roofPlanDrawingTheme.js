// ═══════════════════════════════════════════════════════════════════════════
// roofPlanDrawingTheme.js — Tema visual por defecto del plano 2D techo (SVG).
// Centraliza colores y constantes para futuros temas (alto contraste, impresión/PDF).
// ═══════════════════════════════════════════════════════════════════════════

/** Línea principal de cota (perímetro libre). */
export const ROOF_PLAN_DIM_STROKE = "#dc2626";

/** Opacidad de líneas auxiliares (del elemento al eje de cota). */
export const ROOF_PLAN_DIM_EXT_OPACITY = 0.75;

/** Referencia de fuente (m en user space SVG) antes de escalar por span del viewBox. */
export const ROOF_PLAN_DIM_FONT_BASE = 0.13;

/** `data-bmc-layer` del grupo de cotas exteriores + encuentros. */
export const ROOF_PLAN_LAYERS = Object.freeze({
  globalCotas: "estructura-global-cotas",
  estructuraOverlay: "estructura-overlay",
  cutDraft: "cut-draft",
  cutApplied: "cut-applied",
  hoverDimTooltip: "hover-dim-tooltip",
  chain: "dim-chain",
  overall: "dim-overall",
  labels: "dim-panel-ids",
  verification: "dim-verification",
  globalOverallDims: "global-overall-dims",
});

/** @deprecated usar ROOF_PLAN_LAYERS.globalCotas */
export const ROOF_PLAN_LAYER_GLOBAL_COTAS = ROOF_PLAN_LAYERS.globalCotas;

/** Etiqueta numérica en encuentro (relleno + halo para legibilidad sobre geometría). */
export const ROOF_PLAN_ENCOUNTER_LABEL_FILL = "#0f172a";
export const ROOF_PLAN_ENCOUNTER_LABEL_HALO = "#ffffff";

// ─── Shared counter factory ───────────────────────────────────────────────────
/**
 * Crea un contador de posiciones: primera llamada con clave k devuelve 0, segunda 1, etc.
 * Reemplaza la closure bump() duplicada en RoofPlanDimensions y roofPlanCotaObstacles.
 */
export function makeBumpCounter() {
  const m = new Map();
  return (k) => {
    const n = m.get(k) ?? 0;
    m.set(k, n + 1);
    return n;
  };
}

// ─── Chain dimension theme ────────────────────────────────────────────────────
export const DIM_THEME = {
  CHAIN_OFFSET: 0.14,
  CHAIN_STEP: 0.14,
  chainColor: '#C62828',
  overallColor: '#1565C0',
  warningColor: '#E65100',
  textColor: '#212121',
  defaultTerminator: 'tick',
  layers: {
    chain: ROOF_PLAN_LAYERS.chain,
    overall: ROOF_PLAN_LAYERS.overall,
    labels: ROOF_PLAN_LAYERS.labels,
    verification: ROOF_PLAN_LAYERS.verification,
  },
  chainOpacity: 0.85,
};
