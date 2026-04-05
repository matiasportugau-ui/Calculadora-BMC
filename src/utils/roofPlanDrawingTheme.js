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
