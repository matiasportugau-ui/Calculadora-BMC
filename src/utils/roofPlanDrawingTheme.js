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
export const ROOF_PLAN_LAYER_GLOBAL_COTAS = "estructura-global-cotas";

/** Etiqueta numérica en encuentro (relleno + halo para legibilidad sobre geometría). */
export const ROOF_PLAN_ENCOUNTER_LABEL_FILL = "#0f172a";
export const ROOF_PLAN_ENCOUNTER_LABEL_HALO = "#ffffff";

/**
 * Tema visual para el sistema de acotación de paneles individuales.
 * Todos los offsets están en unidades del viewBox SVG (metros).
 * Consume: PanelChainDimensions, PanelLabels, VerificationBadge (RoofPlanDimensions.jsx)
 */
export const DIM_THEME = {
  // ── Offsets (metros en el viewBox) ──────────────────────────────────────
  /** Metros más allá de la línea overall existente donde va la cadena. */
  CHAIN_OFFSET: 0.14,
  /** Separación entre niveles adicionales de cota. */
  CHAIN_STEP: 0.14,

  // ── Colores ──────────────────────────────────────────────────────────────
  chainColor: '#C62828',      // rojo — cadena (paneles individuales)
  overallColor: '#1565C0',    // azul — total overall (reservado para uso externo)
  warningColor: '#E65100',    // naranja — panel cortado
  textColor: '#212121',       // casi negro — IDs de panel

  // ── Terminadores ─────────────────────────────────────────────────────────
  defaultTerminator: 'tick',  // 'tick' | 'arrow'

  // ── Capas SVG (data-bmc-layer) ───────────────────────────────────────────
  layers: {
    chain: 'dim-chain',
    overall: 'dim-overall',
    labels: 'dim-panel-ids',
    verification: 'dim-verification',
  },

  // ── Opacidad ─────────────────────────────────────────────────────────────
  chainOpacity: 0.85,
};
