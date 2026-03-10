// ═══════════════════════════════════════════════════════════════════════════
// src/data/constants.js — Design tokens, pricing engine, and all static data
// ═══════════════════════════════════════════════════════════════════════════

// ── §1 DESIGN TOKENS ────────────────────────────────────────────────────────

export const C = {
  bg: "#F5F5F7", surface: "#FFFFFF", surfaceAlt: "#FAFAFA",
  primary: "#0071E3", primarySoft: "#E8F1FB",
  brand: "#1A3A5C", brandLight: "#EEF3F8",
  dark: "#1D1D1F",
  success: "#34C759", successSoft: "#E9F8EE",
  warning: "#FF9F0A", warningSoft: "#FFF5E6",
  danger: "#FF3B30", dangerSoft: "#FFECEB",
  border: "#E5E5EA",
  tp: "#1D1D1F", ts: "#6E6E73", tt: "#AEAEB2",
};
export const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif";
export const SHC = "0 1px 3px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.06)";
export const SHI = "inset 0 1px 2px rgba(0,0,0,0.04)";
export const TR = "all 150ms cubic-bezier(0.4,0,0.2,1)";
export const TN = { fontVariantNumeric: "tabular-nums" };
export const COLOR_HEX = { Blanco: "#FFFFFF", Gris: "#8C8C8C", Rojo: "#C0392B" };

// ── §2 PRICING ENGINE ────────────────────────────────────────────────────────

export const IVA = 0.22;
export const IVA_MULT = 1.22;

export let LISTA_ACTIVA = "web";

export function p(item) {
  if (!item) return 0;
  if (LISTA_ACTIVA === "venta") return item.venta || item.web || 0;
  return item.web || item.venta || 0;
}
export function pIVA(item) { return +(p(item) * IVA_MULT).toFixed(2); }
export function setListaPrecios(lista) { LISTA_ACTIVA = lista; }

// ── §3 PANEL DATA ────────────────────────────────────────────────────────────
// Todos los precios SIN IVA. IVA se aplica UNA VEZ al final.

export const PANELS_TECHO = {
  ISODEC_EPS: {
    label: "ISODEC EPS", sub: "Techos y Cubiertas", tipo: "techo",
    au: 1.12, lmin: 2.3, lmax: 14, sist: "varilla_tuerca", fam: "ISODEC",
    esp: {
      100: { venta: 37.76, web: 45.97, costo: 33.93, ap: 5.5 },
      150: { venta: 42.48, web: 51.71, costo: 38.17, ap: 7.5 },
      200: { venta: 47.64, web: 57.99, costo: 42.81, ap: 9.1 },
      250: { venta: 52.35, web: 63.74, costo: 47.05, ap: 10.4 },
    },
    col: ["Blanco", "Gris", "Rojo"],
    colNotes: { Gris: "Solo 100-150mm · +20 días", Rojo: "Solo 100-150mm · +20 días" },
    colMax: { Gris: 150, Rojo: 150 },
  },
  ISODEC_PIR: {
    label: "ISODEC PIR", sub: "Techos y Cubiertas", tipo: "techo",
    au: 1.12, lmin: 3.5, lmax: 14, sist: "varilla_tuerca", fam: "ISODEC_PIR",
    esp: {
      50:  { venta: 41.82, web: 50.91, costo: 37.58, ap: 3.5 },
      80:  { venta: 42.75, web: 52.04, costo: 38.42, ap: 5.5 },
      120: { venta: 51.38, web: 62.55, costo: 46.18, ap: 7.6 },
    },
    col: ["Blanco", "Gris", "Rojo"], colNotes: {}, colMax: {},
    notas: { 50: "EVITAR ESTE ESPESOR (fuente: Matriz)" },
  },
  ISOROOF_3G: {
    label: "ISOROOF 3G", sub: "Techos Livianos", tipo: "techo",
    au: 1.0, lmin: 3.5, lmax: 8.5, sist: "caballete_tornillo", fam: "ISOROOF",
    esp: {
      30:  { venta: 39.95, web: 48.63, costo: 35.90, ap: 2.8 },
      40:  { venta: 41.98, web: 51.10, costo: 37.72, ap: 3.0 },
      50:  { venta: 44.00, web: 53.56, costo: 39.54, ap: 3.3 },
      80:  { venta: 51.73, web: 62.98, costo: 46.49, ap: 4.0 },
      100: { venta: 56.80, web: 69.15, costo: 51.04, ap: 4.5 },
    },
    col: ["Gris", "Rojo", "Blanco"],
    colNotes: { Blanco: "Mínimo 500 m²" },
    colMinArea: { Blanco: 500 }, colMax: {},
  },
  ISOROOF_FOIL: {
    label: "ISOROOF FOIL 3G", sub: "Techos Livianos", tipo: "techo",
    au: 1.0, lmin: 3.5, lmax: 8.5, sist: "caballete_tornillo", fam: "ISOROOF",
    esp: {
      30: { venta: 32.36, web: 39.40, costo: 29.08, ap: 2.8 },
      50: { venta: 36.69, web: 44.66, costo: 32.97, ap: 3.3 },
    },
    col: ["Gris", "Rojo"], colNotes: {}, colMax: {},
  },
  ISOROOF_PLUS: {
    label: "ISOROOF PLUS 3G", sub: "Techos Premium", tipo: "techo",
    au: 1.0, lmin: 3.5, lmax: 8.5, sist: "caballete_tornillo", fam: "ISOROOF",
    esp: {
      50: { venta: 50.06, web: 60.94, costo: 44.99, ap: 3.3 },
      80: { venta: 58.82, web: 71.61, costo: 52.86, ap: 4.0 },
    },
    col: ["Blanco", "Gris", "Rojo"],
    colNotes: { _all: "PLUS: Mínimo 800 m²" },
    colMinArea: {}, colMax: {},
  },
};

export const PANELS_PARED = {
  ISOPANEL_EPS: {
    label: "ISOPANEL EPS", sub: "Paredes y Fachadas", tipo: "pared",
    au: 1.14, lmin: 2.3, lmax: 14, sist: "anclaje_tornillo", fam: "ISOPANEL",
    esp: {
      50:  { venta: 34.32, web: 41.79, costo: 30.85, ap: null },
      100: { venta: 37.76, web: 45.97, costo: 33.93, ap: null },
      150: { venta: 42.48, web: 51.71, costo: 38.17, ap: null },
      200: { venta: 47.64, web: 57.99, costo: 42.81, ap: null },
      250: { venta: 52.35, web: 63.74, costo: 47.05, ap: null },
    },
    col: ["Blanco", "Gris", "Rojo"], colNotes: {}, colMax: {},
    nota50: "50mm SOLO subdivisiones interiores. Fachada exterior mínimo 100mm.",
  },
  ISOWALL_PIR: {
    label: "ISOWALL PIR", sub: "Fachadas", tipo: "pared",
    au: 1.1, lmin: 3.5, lmax: 14, sist: "anclaje_tornillo", fam: "ISOWALL",
    esp: {
      50:  { venta: 46.74, web: 54.54, costo: 40.26, ap: null },
      80:  { venta: 55.74, web: 65.03, costo: 48.01, ap: null },
      100: { venta: 58.90, web: 71.71, costo: 52.94, ap: null },
    },
    col: ["Blanco", "Gris", "Rojo"], colNotes: {}, colMax: {},
  },
};

export const FIJACIONES = {
  varilla_38:         { label: 'Varilla roscada 3/8" (1m)', venta: 3.12, web: 3.64, costo: 2.69, unidad: "unid" },
  tuerca_38:          { label: 'Tuerca 3/8" galv.',         venta: 0.12, web: 0.07, costo: 0.05, unidad: "unid" },
  arandela_carrocero: { label: 'Arandela carrocero 3/8"',   venta: 1.68, web: 0.64, costo: 0.48, unidad: "unid" },
  arandela_pp:        { label: 'Tortuga PVC (arand. PP)',    venta: 1.27, web: 1.48, costo: 1.10, unidad: "unid" },
  arandela_pp_gris:   { label: 'Tortuga PVC gris',          venta: 1.37, web: 1.60, costo: 1.18, unidad: "unid" },
  taco_expansivo:     { label: 'Taco expansivo 3/8"',       venta: 0.96, web: 1.12, costo: 0.83, unidad: "unid" },
  caballete:          { label: 'Caballete (arand. trapezoidal)', venta: 0.50, web: 0.46, costo: 0.34, unidad: "unid" },
  anclaje_h:          { label: 'Kit anclaje H° (torn.N°10+arand+taco)', venta: 0.09, web: 0.03, costo: 0.07, unidad: "unid" },
  tornillo_t1:        { label: 'Tornillo T1 (perfilería)',  venta: 5.00, web: 5.00, costo: 3.50, unidad: "x100" },
  tornillo_t2:        { label: 'Tornillo T2 (fachada)',     venta: 5.00, web: 5.00, costo: 3.50, unidad: "x100" },
  tornillo_aguja:     { label: 'Tornillo aguja 5"',         venta: 17.00, web: 17.00, costo: 12.00, unidad: "x100" },
  remache_pop:        { label: 'Remache POP blanco',        venta: 0.98, web: 0.98, costo: 0.70, unidad: "x1000" },
};

export const SELLADORES = {
  silicona:       { label: "Silicona Bromplast 8 x600",     venta: 9.49, web: 11.07, costo: 8.17, unidad: "unid", ml_por_unid: 10.27 },
  cinta_butilo:   { label: "Cinta Butilo 2mm×15mm×22.5m",   venta: 14.89, web: 18.13, costo: 13.38, unidad: "unid" },
  membrana:       { label: "Membrana autoadhesiva 30cm×10m", venta: 16.62, web: 20.28, costo: 14.00, unidad: "rollo" },
  espuma_pu:      { label: "Espuma poliuretano 750cm³",      venta: 25.46, web: 31.06, costo: 25.88, unidad: "unid" },
};

export const PERFIL_TECHO = {
  gotero_frontal: {
    ISOROOF: {
      30: { sku: "GFS30", venta: 15.83, web: 18.47, largo: 3.03 },
      50: { sku: "GFS50", venta: 16.76, web: 19.56, largo: 3.03 },
      80: { sku: "GFS80", venta: 17.63, web: 20.57, largo: 3.03 },
    },
    ISODEC: {
      100: { sku: "6838", venta: 15.67, web: 19.12, largo: 3.03 },
      150: { sku: "6839", venta: 22.65, web: 27.63, largo: 3.03 },
      200: { sku: "6840", venta: 23.57, web: 28.75, largo: 3.03 },
      250: { sku: "6841", venta: 23.80, web: 29.03, largo: 3.03 },
    },
    ISODEC_PIR: {
      50:  { sku: "GF80DC",  venta: 19.97, web: 23.30, largo: 3.03 },
      80:  { sku: "GF120DC", venta: 20.87, web: 24.34, largo: 3.03 },
      120: { sku: "GF120DC", venta: 24.69, web: 28.81, largo: 3.03 },
    },
  },
  gotero_frontal_greca: {
    ISOROOF: {
      30: { sku: "GFCGR30", venta: 17.99, web: 19.38, largo: 3.03 },
      50: { sku: "GFCGR30", venta: 17.99, web: 19.38, largo: 3.03 },
      80: { sku: "GFCGR30", venta: 17.99, web: 19.38, largo: 3.03 },
    },
  },
  gotero_lateral: {
    ISOROOF: {
      30: { sku: "GL30", venta: 21.83, web: 26.63, largo: 3.0 },
      50: { sku: "GL50", venta: 23.57, web: 28.75, largo: 3.0 },
      80: { sku: "GL80", venta: 25.31, web: 30.88, largo: 3.0 },
    },
    ISODEC: {
      100: { sku: "6842", venta: 20.77, web: 25.34, largo: 3.0 },
      150: { sku: "6843", venta: 29.07, web: 35.46, largo: 3.0 },
      200: { sku: "6844", venta: 31.75, web: 38.74, largo: 3.0 },
      250: { sku: "6845", venta: 31.75, web: 38.74, largo: 3.0 },
    },
    ISODEC_PIR: {
      50:  { sku: "GL80DC",  venta: 26.51, web: 30.92, largo: 3.0 },
      80:  { sku: "GL80DC",  venta: 26.51, web: 30.92, largo: 3.0 },
      120: { sku: "GL120DC", venta: 31.08, web: 36.26, largo: 3.0 },
    },
  },
  gotero_lateral_camara: {
    ISOROOF: {
      50: { sku: "GLDCAM50", venta: 22.32, web: 27.23, largo: 3.0 },
      80: { sku: "GLDCAM80", venta: 25.11, web: 30.63, largo: 3.0 },
    },
  },
  gotero_superior: {
    ISOROOF: {
      30: { sku: "GFSUP30", venta: 28.21, web: 32.91, largo: 3.03 },
      50: { sku: "GFSUP50", venta: 29.08, web: 33.92, largo: 3.03 },
      80: { sku: "GFSUP80", venta: 30.84, web: 35.98, largo: 3.03 },
    },
    ISODEC_PIR: {
      50: { sku: "GSDECAM50", venta: 27.32, web: 31.88, largo: 3.03 },
      80: { sku: "GSDECAM80", venta: 29.94, web: 34.93, largo: 3.03 },
    },
  },
  babeta_adosar: {
    ISODEC:     { _all: { sku: "6828", venta: 12.19, web: 14.22, largo: 3.0 } },
    ISODEC_PIR: { _all: { sku: "6828", venta: 12.19, web: 14.22, largo: 3.0 } },
    ISOROOF:    { _all: { sku: "BBAS3G", venta: 23.74, web: 28.96, largo: 3.03 } },
  },
  babeta_empotrar: {
    ISODEC:     { _all: { sku: "6865", venta: 12.19, web: 14.22, largo: 3.0 } },
    ISODEC_PIR: { _all: { sku: "6865", venta: 12.19, web: 14.22, largo: 3.0 } },
    ISOROOF:    { _all: { sku: "BBESUP", venta: 22.87, web: 27.90, largo: 3.03 } },
  },
  cumbrera: {
    ISODEC:     { _all: { sku: "6847", venta: 23.57, web: 28.75, largo: 3.03 } },
    ISODEC_PIR: { _all: { sku: "6847", venta: 23.57, web: 28.75, largo: 3.03 } },
    ISOROOF:    { _all: { sku: "CUMROOF3M", venta: 97.86, web: 119.39, largo: 2.20 } },
  },
  canalon: {
    ISOROOF: {
      30: { sku: "CD30", venta: 71.83, web: 83.80, largo: 3.03 },
      50: { sku: "CD50", venta: 73.19, web: 85.39, largo: 3.03 },
      80: { sku: "CD80", venta: 74.22, web: 86.59, largo: 3.03 },
    },
    ISODEC: {
      100: { sku: "6801", venta: 69.54, web: 81.13, largo: 3.03 },
      120: { sku: "CAN.ISDC120", venta: 93.26, web: 108.80, largo: 3.03 },
      150: { sku: "6802", venta: 80.05, web: 93.39, largo: 3.03 },
      200: { sku: "6803", venta: 79.73, web: 93.02, largo: 3.03 },
      250: { sku: "6804", venta: 104.30, web: 121.69, largo: 3.03 },
    },
    ISODEC_PIR: {
      50:  { sku: "6801", venta: 69.54, web: 81.13, largo: 3.03 },
      80:  { sku: "6801", venta: 69.54, web: 81.13, largo: 3.03 },
      120: { sku: "CAN.ISDC120", venta: 93.26, web: 108.80, largo: 3.03 },
    },
  },
  soporte_canalon: {
    ISOROOF: { _all: { sku: "SOPCAN3M", venta: 13.12, web: 15.30, largo: 3.0 } },
    ISODEC:  { _all: { sku: "6805",     venta: 15.94, web: 18.59, largo: 3.0 } },
    ISODEC_PIR: { _all: { sku: "6805",  venta: 15.94, web: 18.59, largo: 3.0 } },
  },
};

export const PERFIL_PARED = {
  perfil_u: {
    ISOPANEL: {
      50:  { sku: "PU50MM",  venta: 10.00, web: 11.66, largo: 3.0 },
      100: { sku: "PU100MM", venta: 12.42, web: 15.15, largo: 3.0 },
      150: { sku: "PU150MM", venta: 13.97, web: 17.04, largo: 3.0 },
      200: { sku: "PU200MM", venta: 17.43, web: 21.26, largo: 3.0 },
      250: { sku: "PU200MM", venta: 17.43, web: 21.26, largo: 3.0 },
    },
    ISOWALL: {
      50:  { sku: "PU50MM", venta: 10.00, web: 11.66, largo: 3.0 },
      80:  { sku: "PU50MM", venta: 13.12, web: 16.01, largo: 3.0 },
      100: { sku: "PU100MM", venta: 12.42, web: 15.15, largo: 3.0 },
    },
  },
  perfil_g2: {
    ISOPANEL: {
      100: { sku: "G2-100", venta: 15.34, web: 18.72, largo: 3.0 },
      150: { sku: "G2-150", venta: 17.61, web: 21.49, largo: 3.0 },
      200: { sku: "G2-200", venta: 21.13, web: 25.78, largo: 3.0 },
      250: { sku: "G2-250", venta: 21.30, web: 25.99, largo: 3.0 },
    },
  },
  perfil_k2: {
    _all: { sku: "K2", venta: 8.59, web: 10.48, costo: 7.40, largo: 3.0,
            label: "Perfil K2 (junta interior 35×35)" },
  },
  esquinero_ext: {
    _all: { sku: "ESQ-EXT", venta: 8.59, web: 10.48, largo: 3.0, label: "Esquinero exterior" },
  },
  esquinero_int: {
    _all: { sku: "ESQ-INT", venta: 8.59, web: 10.48, largo: 3.0, label: "Esquinero interior" },
  },
  perfil_5852: {
    _all: { sku: "PLECHU98", venta: 51.84, web: 63.24, costo: 45.00, largo: 6.8,
            label: "Ángulo aluminio 5852 anodizado (6.8m)" },
  },
};

export const SERVICIOS = {
  flete: { label: "Flete Bromyros (zonas aledañas)", venta: 240.00, web: 252.00, costo: 186.03, unidad: "servicio" },
};

// ── §4 UI CONFIGURATION ──────────────────────────────────────────────────────

export const SCENARIOS_DEF = [
  { id: "solo_techo", label: "Solo Techo", icon: "🏠", description: "Cubierta con ISODEC o ISOROOF", familias: ["ISODEC_EPS","ISODEC_PIR","ISOROOF_3G","ISOROOF_FOIL","ISOROOF_PLUS"], hasTecho: true, hasPared: false },
  { id: "solo_fachada", label: "Solo Fachada", icon: "🏢", description: "Paredes y cerramientos", familias: ["ISOPANEL_EPS","ISOWALL_PIR"], hasTecho: false, hasPared: true },
  { id: "techo_fachada", label: "Techo + Fachada", icon: "🏗", description: "Proyecto completo", familias: ["ISODEC_EPS","ISODEC_PIR","ISOROOF_3G","ISOROOF_FOIL","ISOROOF_PLUS","ISOPANEL_EPS","ISOWALL_PIR"], hasTecho: true, hasPared: true },
  { id: "camara_frig", label: "Cámara Frigorífica", icon: "❄️", description: "Cerramientos térmicos para frío", familias: ["ISOPANEL_EPS","ISOWALL_PIR"], hasTecho: false, hasPared: true, isCamara: true },
];

export const VIS = {
  solo_techo:    { borders: true, largoAncho: true, altoPerim: false, esquineros: false, aberturas: false, camara: false, autoportancia: true, canalGot: true, p5852: false },
  solo_fachada:  { borders: false, largoAncho: false, altoPerim: true, esquineros: true, aberturas: true, camara: false, autoportancia: false, canalGot: false, p5852: true },
  techo_fachada: { borders: true, largoAncho: true, altoPerim: true, esquineros: true, aberturas: true, camara: false, autoportancia: true, canalGot: true, p5852: true },
  camara_frig:   { borders: false, largoAncho: false, altoPerim: false, esquineros: true, aberturas: true, camara: true, autoportancia: false, canalGot: false, p5852: false },
};

export const OBRA_PRESETS = ["Vivienda","Barbacoa","Depósito comercial","Galpón industrial","Local comercial","Oficinas","Ampliación / Reforma","Nave logística","Taller","Cerramiento / Anexo","Tinglado / Cobertizo","Cámara frigorífica"];

export const BORDER_OPTIONS = {
  frente: [{ id: "gotero_frontal", label: "Gotero simple" },{ id: "gotero_frontal_greca", label: "Gotero greca", familias: ["ISOROOF"] },{ id: "canalon", label: "Canalón" },{ id: "none", label: "Sin perfil" }],
  fondo: [{ id: "gotero_lateral", label: "Gotero lateral" },{ id: "gotero_frontal", label: "Gotero frontal" },{ id: "babeta_adosar", label: "Muro (adosar)" },{ id: "babeta_empotrar", label: "Muro (empotrar)" },{ id: "cumbrera", label: "Cumbrera" },{ id: "none", label: "Sin perfil" }],
  latIzq: [{ id: "gotero_lateral", label: "Gotero lat." },{ id: "gotero_lateral_camara", label: "Cámara" },{ id: "babeta_adosar", label: "Enc. muro" },{ id: "none", label: "Sin perfil" }],
  latDer: [{ id: "gotero_lateral", label: "Gotero lat." },{ id: "gotero_lateral_camara", label: "Cámara" },{ id: "babeta_adosar", label: "Enc. muro" },{ id: "none", label: "Sin perfil" }],
};

// STEP_SECTIONS: maps each progress tab index to the section keys visible in the left panel.
// Tab 0=Proyecto, 1=Panel, 2=Bordes, 3=Opciones
export const STEP_SECTIONS = {
  0: ["lista", "escenario", "proyecto"],
  1: ["panel", "categorias", "dimensiones"],
  2: ["bordes", "estructura"],
  3: ["opciones", "aberturas", "flete"],
};

// ── §5 CATEGORIAS BOM ─────────────────────────────────────────────────────────
export const CATEGORIAS_BOM = {
  PANELES: { label: "Paneles", default: true },
  FIJACIONES: { label: "Fijaciones", default: true },
  PERFILERIA: { label: "Perfilería", default: true },
  SELLADORES: { label: "Selladores", default: true },
  SERVICIOS: { label: "Servicios", default: true },
};

export const CATEGORIA_TO_GROUPS = {
  PANELES: ["PANELES"],
  FIJACIONES: ["FIJACIONES"],
  PERFILERIA: ["PERFILERÍA TECHO", "PERFILES U", "ESQUINEROS", "PERFILERÍA PARED"],
  SELLADORES: ["SELLADORES"],
  SERVICIOS: ["SERVICIOS"],
};
