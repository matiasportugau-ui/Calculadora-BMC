// ═══════════════════════════════════════════════════════════════════════════
// roofPlanDrawingTheme.js — Tema visual por defecto del plano 2D techo (SVG).
// Centraliza colores y constantes para futuros temas (alto contraste, impresión/PDF).
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Línea principal de cota (perímetro libre + encuentros).
 * Gris grafito (lectura tipo lápiz / grafo), no rojo de acento.
 */
export const ROOF_PLAN_DIM_STROKE = "#5c6470";

/** Opacidad de líneas auxiliares (del elemento al eje de cota) — más suave que el trazo principal. */
export const ROOF_PLAN_DIM_EXT_OPACITY = 0.5;

/** Terminaciones de trazo tipo lápiz (SVG hereda en hijos con stroke). */
export const ROOF_PLAN_DIM_STROKE_PROPS = {
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

/** Referencia de fuente (m en user space SVG) antes de escalar por span del viewBox. */
export const ROOF_PLAN_DIM_FONT_BASE = 0.13;

/** `data-bmc-layer` del grupo de cotas exteriores + encuentros. */
export const ROOF_PLAN_LAYER_GLOBAL_COTAS = "estructura-global-cotas";

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
  /** Cadena mm / paños — mismo familia grafito que ROOF_PLAN_DIM_STROKE. */
  chainColor: "#5c6470",
  /** Cotas “overall” entre niveles de cadena — gris más cargado. */
  overallColor: "#4a5568",
  /** Cota envolvente ISO — tono más oscuro (jerarquía lapicero / 2B). */
  envelopeColor: "#3d4756",
  warningColor: '#E65100',
  textColor: "#3a3f46",
  defaultTerminator: 'tick',
  layers: {
    chain: 'dim-chain',
    overall: 'dim-overall',
    envelope: 'dim-envelope',
    labels: 'dim-panel-ids',
    verification: 'dim-verification',
  },
  chainOpacity: 0.92,
};

// ─── Line weight tiers (ISO 128) ─────────────────────────────────────────────
// Multiplied by svgTy.m at render time. Order: zone border > encounter > dim main > panel joint > hatch.
export const LINE_WEIGHTS = {
  zoneBorder: 0.072,   // existing — heaviest
  encounter: 0.055,    // between zone border and dims
  dimMain: 0.032,      // existing (strokeMain)
  panelJoint: 0.024,   // lighter than dims
  hatch: 0.012,        // subtle diagonal fill pattern
};

// ─── Print / PDF theme (ISO monochrome) ───────────────────────────────────────
export const PRINT_THEME = {
  dimStroke: '#000000',
  zoneFill: '#f5f5f5',
  zoneBorder: '#1a1a1a',
  encounterStroke: '#333333',
  panelJoint: '#666666',
  hatchStroke: '#999999',
  textColor: '#000000',
  fontFamily: "'Share Tech Mono', 'DIN Alternate', 'Courier New', monospace",
};

/**
 * Returns the screen or print theme object.
 * @param {'screen'|'print'} [mode='screen']
 */
export function getTheme(mode = 'screen') {
  if (mode === 'print') return PRINT_THEME;
  return {
    dimStroke: ROOF_PLAN_DIM_STROKE,
    zoneFill: null,
    zoneBorder: null,
    encounterStroke: null,
    panelJoint: null,
    hatchStroke: '#0071E3',
    textColor: DIM_THEME.textColor,
    fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
  };
}
