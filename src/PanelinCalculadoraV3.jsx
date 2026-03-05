// ═══════════════════════════════════════════════════════════════════════════
// PanelinCalculadoraV3.jsx — BMC Uruguay · Calculadora de Cotización v3.1
// Un solo archivo React — Default export, sin props
// Precios SIN IVA · IVA 22% al final · Doble lista (venta/web)
// Repo: github.com/matiasportugau-ui/GPT-Panelin-Calc (frontend/)
// Integración: Compatible con GPT Panelin v5 + Calculadora API v4.0
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback, useRef, useEffect, useReducer } from "react";
import {
  ChevronDown, ChevronUp, Printer, Trash2, Copy, Check,
  AlertTriangle, CheckCircle, Info, Minus, Plus, FileText,
  RotateCcw, Edit3, Home, Layers, Grid, Snowflake
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// §1 DESIGN TOKENS + CSS
// ═══════════════════════════════════════════════════════════════════════════

const C = {
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
const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif";
const SHC = "0 1px 3px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.06)";
const SHI = "inset 0 1px 2px rgba(0,0,0,0.04)";
const TR = "all 150ms cubic-bezier(0.4,0,0.2,1)";
const TN = { fontVariantNumeric: "tabular-nums" };
const COLOR_HEX = { Blanco: "#FFFFFF", Gris: "#8C8C8C", Rojo: "#C0392B" };

if (typeof document !== "undefined" && !document.getElementById("bmc-kf")) {
  const s = document.createElement("style");
  s.id = "bmc-kf";
  s.textContent = `
    @keyframes bmc-fade{from{opacity:0}to{opacity:1}}
    @keyframes bmc-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
    @keyframes bmc-slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
  `;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════════════════
// §2 DATOS — PANELIN_PRECIOS_V3_UNIFICADO (FUENTE DE VERDAD)
// Todos los precios SIN IVA. IVA se aplica UNA VEZ al final.
// ═══════════════════════════════════════════════════════════════════════════

const IVA = 0.22;
const IVA_MULT = 1.22;

let LISTA_ACTIVA = "web";

function p(item) {
  if (!item) return 0;
  if (LISTA_ACTIVA === "venta") return item.venta || item.web || 0;
  return item.web || item.venta || 0;
}
function pIVA(item) { return +(p(item) * IVA_MULT).toFixed(2); }
function setListaPrecios(lista) { LISTA_ACTIVA = lista; }

const PANELS_TECHO = {
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

const PANELS_PARED = {
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
  ISOFRIG_PIR: {
    label: "ISOFRIG PIR", sub: "Cámaras Frigoríficas", tipo: "pared",
    au: 1.14, lmin: 2.3, lmax: 14, sist: "anclaje_tornillo", fam: "ISOFRIG",
    esp: {
      40:  { venta: 43.53, web: 53.11, costo: 36.27, ap: null },
      60:  { venta: 47.40, web: 57.83, costo: 41.22, ap: null },
      80:  { venta: 52.29, web: 63.80, costo: 45.47, ap: null },
      100: { venta: 58.01, web: 70.77, costo: 50.44, ap: null },
      150: { venta: 70.37, web: 85.85, costo: 61.19, ap: null },
    },
    col: ["Blanco"], colNotes: { _all: "Solo Blanco sanitario" }, colMax: {},
    notaFrig: "Panel para cámaras frigoríficas y salas limpias. Junta macho-hembra.",
  },
};

const FIJACIONES = {
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

const SELLADORES = {
  silicona:       { label: "Silicona Bromplast 8 x600",     venta: 9.49, web: 11.07, costo: 8.17, unidad: "unid", ml_por_unid: 10.27 },
  cinta_butilo:   { label: "Cinta Butilo 2mm×15mm×22.5m",   venta: 14.89, web: 18.13, costo: 13.38, unidad: "unid" },
  membrana:       { label: "Membrana autoadhesiva 30cm×10m", venta: 16.62, web: 20.28, costo: 14.00, unidad: "rollo" },
  espuma_pu:      { label: "Espuma poliuretano 750cm³",      venta: 25.46, web: 31.06, costo: 25.88, unidad: "unid" },
};

const PERFIL_TECHO = {
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

const PERFIL_PARED = {
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
    ISOFRIG: {
      40:  { sku: "PU50MM", venta: 10.00, web: 11.66, largo: 3.0 },
      60:  { sku: "PU50MM", venta: 10.00, web: 11.66, largo: 3.0 },
      80:  { sku: "PU100MM", venta: 12.42, web: 15.15, largo: 3.0 },
      100: { sku: "PU100MM", venta: 12.42, web: 15.15, largo: 3.0 },
      150: { sku: "PU150MM", venta: 13.97, web: 17.04, largo: 3.0 },
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

const SERVICIOS = {
  flete: { label: "Flete Bromyros (zonas aledañas)", venta: 240.00, web: 252.00, costo: 186.03, unidad: "servicio" },
};

// ═══════════════════════════════════════════════════════════════════════════
// §3 ENGINE TECHO — Usa p() para todos los precios SIN IVA
// ═══════════════════════════════════════════════════════════════════════════

function resolveSKU_techo(tipo, familiaP, espesor) {
  const byTipo = PERFIL_TECHO[tipo];
  if (!byTipo) return null;
  const byFam = byTipo[familiaP];
  if (!byFam) return null;
  if (byFam[espesor]) return { ...byFam[espesor] };
  if (byFam._all) return { ...byFam._all };
  return null;
}

function calcPanelesTecho(panel, espesor, largo, ancho) {
  const espData = panel.esp[espesor];
  if (!espData) return null;
  const cantPaneles = Math.ceil(ancho / panel.au);
  const anchoTotal = cantPaneles * panel.au;
  const areaTotal = +(cantPaneles * largo * panel.au).toFixed(2);
  const precioM2 = p(espData);
  const costoPaneles = +(precioM2 * areaTotal).toFixed(2);
  return { cantPaneles, areaTotal, anchoTotal, costoPaneles, precioM2 };
}

function calcAutoportancia(panel, espesor, largo) {
  const espData = panel.esp[espesor];
  if (!espData || espData.ap == null) {
    return { ok: true, apoyos: null, maxSpan: null, largoMinOK: true, largoMaxOK: true };
  }
  const maxSpan = espData.ap;
  const apoyos = Math.ceil((largo / maxSpan) + 1);
  const ok = largo <= maxSpan;
  const largoMinOK = largo >= (panel.lmin || 0);
  const largoMaxOK = largo <= (panel.lmax || Infinity);
  return { ok, apoyos, maxSpan, largoMinOK, largoMaxOK };
}

function calcFijacionesVarilla(cantP, apoyos, largo, tipoEst, ptsHorm) {
  const puntosFijacion = Math.ceil(((cantP * apoyos) * 2) + (largo * 2 / 2.5));
  const varillas = Math.ceil(puntosFijacion / 4);
  let pMetal, pH;
  if (tipoEst === "metal") { pMetal = puntosFijacion; pH = 0; }
  else if (tipoEst === "hormigon") { pMetal = 0; pH = puntosFijacion; }
  else { pH = Math.min(ptsHorm || 0, puntosFijacion); pMetal = puntosFijacion - pH; }
  const tuercas = (pMetal * 2) + (pH * 1);
  const tacos = pH;
  const items = [];
  const puVar = p(FIJACIONES.varilla_38);
  items.push({ label: FIJACIONES.varilla_38.label, sku: "varilla_38", cant: varillas, unidad: "unid", pu: puVar, total: +(varillas * puVar).toFixed(2) });
  const puTuer = p(FIJACIONES.tuerca_38);
  items.push({ label: FIJACIONES.tuerca_38.label, sku: "tuerca_38", cant: tuercas, unidad: "unid", pu: puTuer, total: +(tuercas * puTuer).toFixed(2) });
  if (tacos > 0) {
    const puTaco = p(FIJACIONES.taco_expansivo);
    items.push({ label: FIJACIONES.taco_expansivo.label, sku: "taco_expansivo", cant: tacos, unidad: "unid", pu: puTaco, total: +(tacos * puTaco).toFixed(2) });
  }
  const puArand = p(FIJACIONES.arandela_carrocero);
  items.push({ label: FIJACIONES.arandela_carrocero.label, sku: "arandela_carrocero", cant: puntosFijacion, unidad: "unid", pu: puArand, total: +(puntosFijacion * puArand).toFixed(2) });
  const puPP = p(FIJACIONES.arandela_pp);
  items.push({ label: FIJACIONES.arandela_pp.label, sku: "arandela_pp", cant: puntosFijacion, unidad: "unid", pu: puPP, total: +(puntosFijacion * puPP).toFixed(2) });
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2), puntosFijacion };
}

function calcFijacionesCaballete(cantP, largo) {
  const caballetes = Math.ceil((cantP * 3 * (largo / 2.9 + 1)) + ((largo * 2) / 0.3));
  const tornillosAguja = caballetes * 2;
  const items = [];
  const puCab = p(FIJACIONES.caballete);
  items.push({ label: FIJACIONES.caballete.label, sku: "caballete", cant: caballetes, unidad: "unid", pu: puCab, total: +(caballetes * puCab).toFixed(2) });
  const paquetesAguja = Math.ceil(tornillosAguja / 100);
  const puAguja = p(FIJACIONES.tornillo_aguja);
  items.push({ label: FIJACIONES.tornillo_aguja.label, sku: "tornillo_aguja", cant: paquetesAguja, unidad: "x100", pu: puAguja, total: +(paquetesAguja * puAguja).toFixed(2) });
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2), puntosFijacion: caballetes };
}

function calcPerfileriaTecho(borders, cantP, largo, anchoTotal, familiaP, espesor, opciones) {
  const items = [];
  let totalML = 0;
  const addPerfil = (label, tipo, dim, famOverride) => {
    const fam = famOverride || familiaP;
    const resolved = resolveSKU_techo(tipo, fam, espesor);
    if (!resolved) return;
    const precio = p(resolved);
    const pzas = Math.ceil(dim / resolved.largo);
    const ml = pzas * resolved.largo;
    totalML += ml;
    items.push({ label, sku: resolved.sku, tipo, cant: pzas, unidad: "unid", pu: precio, total: +(pzas * precio).toFixed(2), ml: +ml.toFixed(2) });
  };
  if (borders.frente && borders.frente !== "none") addPerfil("Frente: " + borders.frente, borders.frente, anchoTotal);
  if (borders.fondo && borders.fondo !== "none") addPerfil("Fondo: " + borders.fondo, borders.fondo, anchoTotal);
  if (borders.latIzq && borders.latIzq !== "none") addPerfil("Lat.Izq: " + borders.latIzq, borders.latIzq, largo);
  if (borders.latDer && borders.latDer !== "none") addPerfil("Lat.Der: " + borders.latDer, borders.latDer, largo);
  if (opciones && opciones.inclGotSup) {
    const gs = resolveSKU_techo("gotero_superior", familiaP, espesor);
    if (gs) {
      const precio = p(gs);
      const pzas = Math.ceil(anchoTotal / gs.largo);
      totalML += pzas * gs.largo;
      items.push({ label: "Gotero superior", sku: gs.sku, tipo: "gotero_superior", cant: pzas, unidad: "unid", pu: precio, total: +(pzas * precio).toFixed(2) });
    }
  }
  // §E CORREGIDO: Canalón usa precios del PERFIL_TECHO + soporte corregido
  if (opciones && opciones.inclCanalon) {
    const canData = resolveSKU_techo("canalon", familiaP, espesor);
    if (canData) {
      const precioCan = p(canData);
      const pzasCan = Math.ceil(anchoTotal / canData.largo);
      totalML += pzasCan * canData.largo;
      items.push({ label: "Canalón", sku: canData.sku, tipo: "canalon", cant: pzasCan, unidad: "unid", pu: precioCan, total: +(pzasCan * precioCan).toFixed(2) });
    }
    // §E SOPORTE CANALÓN CORREGIDO: barras de 3m, 1 soporte por enganche
    const sopData = resolveSKU_techo("soporte_canalon", familiaP, espesor);
    if (sopData) {
      const mlSoportes = (cantP + 1) * 0.30;
      const barrasSoporte = Math.ceil(mlSoportes / sopData.largo);
      const precioSop = p(sopData);
      items.push({ label: "Soporte canalón", sku: sopData.sku, tipo: "soporte_canalon", cant: barrasSoporte, unidad: "unid", pu: precioSop, total: +(barrasSoporte * precioSop).toFixed(2) });
    }
  }
  if (totalML > 0) {
    const fijPerf = Math.ceil(totalML / 0.30);
    const paquetesT1 = Math.ceil(fijPerf / 100);
    const puT1 = p(FIJACIONES.tornillo_t1);
    items.push({ label: FIJACIONES.tornillo_t1.label, sku: "tornillo_t1", tipo: "fijacion_perfileria", cant: paquetesT1, unidad: "x100", pu: puT1, total: +(paquetesT1 * puT1).toFixed(2) });
  }
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2), totalML: +totalML.toFixed(2) };
}

function calcSelladoresTecho(cantP) {
  const items = [];
  const siliconas = Math.ceil(cantP * 0.5);
  const puSil = p(SELLADORES.silicona);
  items.push({ label: SELLADORES.silicona.label, sku: "silicona", cant: siliconas, unidad: "unid", pu: puSil, total: +(siliconas * puSil).toFixed(2) });
  const cintas = Math.ceil(cantP / 10);
  const puCinta = p(SELLADORES.cinta_butilo);
  items.push({ label: SELLADORES.cinta_butilo.label, sku: "cinta_butilo", cant: cintas, unidad: "unid", pu: puCinta, total: +(cintas * puCinta).toFixed(2) });
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2) };
}

function calcTotalesSinIVA(allItems) {
  const sumSinIVA = allItems.reduce((s, i) => s + (i.total || 0), 0);
  const subtotalSinIVA = +sumSinIVA.toFixed(2);
  const iva = +(subtotalSinIVA * IVA).toFixed(2);
  const totalConIVA = +(subtotalSinIVA + iva).toFixed(2);
  return { subtotalSinIVA, iva, totalFinal: totalConIVA };
}

function calcTechoCompleto(inputs) {
  const { familia, espesor, largo, ancho, tipoEst, ptsHorm, borders, opciones, color } = inputs;
  const panel = PANELS_TECHO[familia];
  if (!panel) return { error: `Familia "${familia}" no encontrada` };
  const espData = panel.esp[espesor];
  if (!espData) return { error: `Espesor ${espesor}mm no disponible` };
  const warnings = [];
  if (color) {
    if (!panel.col.includes(color)) warnings.push(`Color "${color}" no disponible para ${familia}`);
    if (panel.colMax && panel.colMax[color] && espesor > panel.colMax[color]) warnings.push(`Color ${color} solo hasta ${panel.colMax[color]}mm`);
  }
  const paneles = calcPanelesTecho(panel, espesor, largo, ancho);
  if (!paneles) return { error: "Error calculando paneles" };
  if (color && panel.colMinArea && panel.colMinArea[color] && paneles.areaTotal < panel.colMinArea[color]) {
    warnings.push(`Color ${color} requiere mín. ${panel.colMinArea[color]} m² (cotizado: ${paneles.areaTotal.toFixed(1)} m²)`);
  }
  const autoportancia = calcAutoportancia(panel, espesor, largo);
  if (!autoportancia.ok) warnings.push(`Largo ${largo}m excede autoportancia máx ${autoportancia.maxSpan}m. Requiere ${autoportancia.apoyos} apoyos.`);
  if (!autoportancia.largoMinOK) warnings.push(`Largo ${largo}m < mínimo ${panel.lmin}m`);
  if (!autoportancia.largoMaxOK) warnings.push(`Largo ${largo}m > máximo fabricable ${panel.lmax}m`);
  let fijaciones;
  if (panel.sist === "varilla_tuerca") {
    fijaciones = calcFijacionesVarilla(paneles.cantPaneles, autoportancia.apoyos || 2, largo, tipoEst || "metal", ptsHorm || 0);
  } else {
    fijaciones = calcFijacionesCaballete(paneles.cantPaneles, largo);
  }
  const perfileria = calcPerfileriaTecho(borders || { frente: "none", fondo: "none", latIzq: "none", latDer: "none" }, paneles.cantPaneles, largo, paneles.anchoTotal, panel.fam, espesor, opciones || {});
  let selladores = { items: [], total: 0 };
  if (!opciones || opciones.inclSell !== false) selladores = calcSelladoresTecho(paneles.cantPaneles);
  const panelItem = { label: panel.label + ` ${espesor}mm`, sku: `${familia}-${espesor}`, cant: paneles.areaTotal, unidad: "m²", pu: paneles.precioM2, total: paneles.costoPaneles };
  const allItems = [panelItem, ...fijaciones.items, ...perfileria.items, ...selladores.items];
  const totales = calcTotalesSinIVA(allItems);
  return { paneles, autoportancia, fijaciones, perfileria, selladores, totales, warnings, allItems };
}

// ═══════════════════════════════════════════════════════════════════════════
// §4 ENGINE PARED — REESCRITO con fijaciones correctas
// ═══════════════════════════════════════════════════════════════════════════

function resolvePerfilPared(tipo, familia, espesor) {
  const byTipo = PERFIL_PARED[tipo];
  if (!byTipo) return null;
  const byFam = byTipo[familia];
  if (byFam) {
    if (byFam[espesor]) return { ...byFam[espesor] };
    if (byFam._all) return { ...byFam._all };
  }
  if (byTipo._all) return { ...byTipo._all };
  return null;
}

function calcPanelesPared(panel, espesor, alto, perimetro, aberturas) {
  const espData = panel.esp[espesor];
  if (!espData) return null;
  const cantPaneles = Math.ceil(perimetro / panel.au);
  const areaBruta = +(cantPaneles * alto * panel.au).toFixed(2);
  let areaAberturas = 0;
  if (aberturas && aberturas.length > 0) {
    for (const ab of aberturas) areaAberturas += ab.ancho * ab.alto * (ab.cant || 1);
  }
  areaAberturas = +areaAberturas.toFixed(2);
  const areaNeta = +Math.max(areaBruta - areaAberturas, 0).toFixed(2);
  const precioM2 = p(espData);
  const costoPaneles = +(precioM2 * areaNeta).toFixed(2);
  return { cantPaneles, areaBruta, areaAberturas, areaNeta, costoPaneles, precioM2 };
}

function calcPerfilesU(panel, espesor, perimetro) {
  const perfData = resolvePerfilPared("perfil_u", panel.fam, espesor);
  if (!perfData) return { items: [], total: 0 };
  const precio = p(perfData);
  const pzas = Math.ceil(perimetro / perfData.largo);
  const items = [];
  items.push({ label: "Perfil U base " + espesor + "mm", sku: perfData.sku, cant: pzas, unidad: "unid", pu: precio, total: +(pzas * precio).toFixed(2) });
  items.push({ label: "Perfil U coronación " + espesor + "mm", sku: perfData.sku, cant: pzas, unidad: "unid", pu: precio, total: +(pzas * precio).toFixed(2) });
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2) };
}

function calcEsquineros(alto, numExt, numInt) {
  const items = [];
  const pExt = resolvePerfilPared("esquinero_ext", null, null);
  const pInt = resolvePerfilPared("esquinero_int", null, null);
  if (pExt && numExt > 0) {
    const pzas = Math.ceil(alto / pExt.largo) * numExt;
    const precio = p(pExt);
    items.push({ label: pExt.label, sku: pExt.sku, cant: pzas, unidad: "unid", pu: precio, total: +(pzas * precio).toFixed(2) });
  }
  if (pInt && numInt > 0) {
    const pzas = Math.ceil(alto / pInt.largo) * numInt;
    const precio = p(pInt);
    items.push({ label: pInt.label, sku: pInt.sku, cant: pzas, unidad: "unid", pu: precio, total: +(pzas * precio).toFixed(2) });
  }
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2) };
}

// §B REESCRITO: Fijaciones de pared — NO usa varilla/tuerca/arandela/tortuga
function calcFijacionesPared(panel, espesor, cantP, alto, perimetro, tipoEst) {
  const items = [];
  const anchoTotal = cantP * panel.au;
  // 1. ANCLAJES A HORMIGÓN — kit cada 0.30m en perímetro inferior
  const anclajes = Math.ceil(anchoTotal / 0.30);
  const puAnc = p(FIJACIONES.anclaje_h);
  items.push({ label: FIJACIONES.anclaje_h.label, sku: "anclaje_h", cant: anclajes, unidad: "unid", pu: puAnc, total: +(anclajes * puAnc).toFixed(2) });
  // 2. TORNILLOS T2 para fijar paneles a estructura (~5.5/m² para metal)
  if (tipoEst === "metal" || tipoEst === "mixto") {
    const areaNeta = cantP * alto * panel.au;
    const tornillosT2 = Math.ceil(areaNeta * 5.5);
    const paquetes = Math.ceil(tornillosT2 / 100);
    const puT2 = p(FIJACIONES.tornillo_t2);
    items.push({ label: FIJACIONES.tornillo_t2.label, sku: "tornillo_t2", cant: paquetes, unidad: "x100", pu: puT2, total: +(paquetes * puT2).toFixed(2) });
  }
  // 3. REMACHES POP para uniones entre perfiles — ~2 por panel
  const remaches = Math.ceil(cantP * 2);
  const paquetesRem = Math.ceil(remaches / 1000);
  if (paquetesRem > 0) {
    const puRem = p(FIJACIONES.remache_pop);
    items.push({ label: FIJACIONES.remache_pop.label, sku: "remache_pop", cant: paquetesRem, unidad: "x1000", pu: puRem, total: +(paquetesRem * puRem).toFixed(2) });
  }
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2) };
}

// §C NUEVOS PERFILES: K2, G2, 5852
function calcPerfilesParedExtra(panel, espesor, cantP, alto, perimetro, opts) {
  const items = [];
  // Perfil K2 — junta interior entre paneles
  const k2Data = PERFIL_PARED.perfil_k2._all;
  if (cantP > 1) {
    const juntasK2 = (cantP - 1) * Math.ceil(alto / k2Data.largo);
    const puK2 = p(k2Data);
    items.push({ label: k2Data.label, sku: k2Data.sku, cant: juntasK2, unidad: "unid", pu: puK2, total: +(juntasK2 * puK2).toFixed(2) });
  }
  // Perfil G2 — tapajunta exterior
  const g2Data = resolvePerfilPared("perfil_g2", panel.fam, espesor);
  if (g2Data) {
    const numTramos = Math.ceil(perimetro / (cantP * panel.au)) || 1;
    const cantG2 = Math.ceil(alto * 2 / 3.0) * Math.max(numTramos, 1);
    const puG2 = p(g2Data);
    items.push({ label: "Perfil G2 tapajunta", sku: g2Data.sku, cant: cantG2, unidad: "unid", pu: puG2, total: +(cantG2 * puG2).toFixed(2) });
  }
  // Perfil 5852 aluminio — OPCIONAL
  if (opts && opts.incl5852) {
    const d5852 = PERFIL_PARED.perfil_5852._all;
    const anchoTotal = cantP * panel.au;
    const cant5852 = Math.ceil(anchoTotal / d5852.largo) * (opts.apoyo5852doble ? 2 : 1);
    const pu5852 = p(d5852);
    items.push({ label: d5852.label, sku: d5852.sku, cant: cant5852, unidad: "unid", pu: pu5852, total: +(cant5852 * pu5852).toFixed(2) });
  }
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2) };
}

// §D SELLADORES PARED: silicona + cinta butilo + membrana + espuma PU
function calcSelladorPared(perimetro, cantPaneles, alto) {
  const items = [];
  const juntasV = cantPaneles - 1;
  const mlJuntas = +(juntasV * alto + perimetro * 2).toFixed(2);
  const siliconas = Math.ceil(mlJuntas / 8);
  const puSil = p(SELLADORES.silicona);
  items.push({ label: SELLADORES.silicona.label, sku: "silicona", cant: siliconas, unidad: "unid", pu: puSil, total: +(siliconas * puSil).toFixed(2) });
  const cintas = Math.ceil(mlJuntas / 22.5);
  const puCinta = p(SELLADORES.cinta_butilo);
  items.push({ label: SELLADORES.cinta_butilo.label, sku: "cinta_butilo", cant: cintas, unidad: "unid", pu: puCinta, total: +(cintas * puCinta).toFixed(2) });
  // Membrana autoadhesiva
  const mlMembrana = perimetro; // encuentros con muro
  const rollosMembrana = Math.ceil(mlMembrana / 10);
  const puMem = p(SELLADORES.membrana);
  items.push({ label: SELLADORES.membrana.label, sku: "membrana", cant: rollosMembrana, unidad: "rollo", pu: puMem, total: +(rollosMembrana * puMem).toFixed(2) });
  // Espuma PU: 2 por cada rollo de membrana
  const espumas = rollosMembrana * 2;
  const puEsp = p(SELLADORES.espuma_pu);
  items.push({ label: SELLADORES.espuma_pu.label, sku: "espuma_pu", cant: espumas, unidad: "unid", pu: puEsp, total: +(espumas * puEsp).toFixed(2) });
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2), mlJuntas };
}

function calcParedCompleto(inputs) {
  const { familia, espesor, alto, perimetro, numEsqExt, numEsqInt, aberturas, tipoEst, inclSell, incl5852, color } = inputs;
  const panel = PANELS_PARED[familia];
  if (!panel) return { error: `Familia "${familia}" no encontrada` };
  const espData = panel.esp[espesor];
  if (!espData) return { error: `Espesor ${espesor}mm no disponible` };
  const warnings = [];
  if (familia === "ISOPANEL_EPS" && espesor === 50) warnings.push("50mm solo para subdivisiones interiores.");
  if (alto > panel.lmax) warnings.push(`Alto ${alto}m > máximo ${panel.lmax}m`);
  if (alto < panel.lmin) warnings.push(`Alto ${alto}m < mínimo ${panel.lmin}m`);
  if ((numEsqExt || 0) === 0) warnings.push("Sin esquinas exteriores — verificar geometría");
  if (color && !panel.col.includes(color)) warnings.push(`Color "${color}" no disponible`);
  const paneles = calcPanelesPared(panel, espesor, alto, perimetro, aberturas || []);
  if (!paneles) return { error: "Error calculando paneles" };
  const perfilesU = calcPerfilesU(panel, espesor, perimetro);
  const esquineros = calcEsquineros(alto, numEsqExt || 0, numEsqInt || 0);
  const fijaciones = calcFijacionesPared(panel, espesor, paneles.cantPaneles, alto, perimetro, tipoEst || "metal");
  const perfilesExtra = calcPerfilesParedExtra(panel, espesor, paneles.cantPaneles, alto, perimetro, { incl5852 });
  let sellador = { items: [], total: 0 };
  if (inclSell !== false) sellador = calcSelladorPared(perimetro, paneles.cantPaneles, alto);
  const panelItem = { label: panel.label + ` ${espesor}mm`, sku: `${familia}-${espesor}`, cant: paneles.areaNeta, unidad: "m²", pu: paneles.precioM2, total: paneles.costoPaneles };
  const allItems = [panelItem, ...perfilesU.items, ...esquineros.items, ...perfilesExtra.items, ...fijaciones.items, ...sellador.items];
  const totales = calcTotalesSinIVA(allItems);
  return { paneles, perfilesU, esquineros, perfilesExtra, fijaciones, sellador, totales, warnings, allItems };
}

// ═══════════════════════════════════════════════════════════════════════════
// §5 ESCENARIOS + OVERRIDES + GEOMETRÍA
// ═══════════════════════════════════════════════════════════════════════════

const SCENARIOS_DEF = [
  { id: "solo_techo", label: "Solo Techo", icon: "🏠", description: "Cubierta con ISODEC o ISOROOF", familias: ["ISODEC_EPS","ISODEC_PIR","ISOROOF_3G","ISOROOF_FOIL","ISOROOF_PLUS"], hasTecho: true, hasPared: false },
  { id: "solo_fachada", label: "Solo Fachada", icon: "🏢", description: "Paredes y cerramientos", familias: ["ISOPANEL_EPS","ISOWALL_PIR"], hasTecho: false, hasPared: true },
  { id: "techo_fachada", label: "Techo + Fachada", icon: "🏗", description: "Proyecto completo", familias: ["ISODEC_EPS","ISODEC_PIR","ISOROOF_3G","ISOROOF_FOIL","ISOROOF_PLUS","ISOPANEL_EPS","ISOWALL_PIR"], hasTecho: true, hasPared: true },
  { id: "camara_frig", label: "Cámara Frigorífica", icon: "❄️", description: "Cerramientos térmicos para frío", familias: ["ISOFRIG_PIR","ISOPANEL_EPS","ISOWALL_PIR"], hasTecho: false, hasPared: true, isCamara: true },
];

const VIS = {
  solo_techo:    { borders: true, largoAncho: true, altoPerim: false, esquineros: false, aberturas: false, camara: false, autoportancia: true, canalGot: true, p5852: false },
  solo_fachada:  { borders: false, largoAncho: false, altoPerim: true, esquineros: true, aberturas: true, camara: false, autoportancia: false, canalGot: false, p5852: true },
  techo_fachada: { borders: true, largoAncho: true, altoPerim: true, esquineros: true, aberturas: true, camara: false, autoportancia: true, canalGot: true, p5852: true },
  camara_frig:   { borders: false, largoAncho: false, altoPerim: false, esquineros: true, aberturas: true, camara: true, autoportancia: false, canalGot: false, p5852: false },
};

const OBRA_PRESETS = ["Vivienda","Barbacoa","Depósito comercial","Galpón industrial","Local comercial","Oficinas","Ampliación / Reforma","Nave logística","Taller","Cerramiento / Anexo","Tinglado / Cobertizo","Cámara frigorífica"];

const BORDER_OPTIONS = {
  frente: [{ id: "gotero_frontal", label: "Gotero simple" },{ id: "gotero_frontal_greca", label: "Gotero greca" },{ id: "none", label: "Sin perfil" }],
  fondo: [{ id: "gotero_frontal", label: "Gotero frontal" },{ id: "babeta_adosar", label: "Muro (adosar)" },{ id: "babeta_empotrar", label: "Muro (empotrar)" },{ id: "cumbrera", label: "Cumbrera" },{ id: "none", label: "Sin perfil" }],
  latIzq: [{ id: "gotero_lateral", label: "Gotero lat." },{ id: "gotero_lateral_camara", label: "Cámara" },{ id: "babeta_adosar", label: "Enc. muro" },{ id: "none", label: "Sin perfil" }],
  latDer: [{ id: "gotero_lateral", label: "Gotero lat." },{ id: "gotero_lateral_camara", label: "Cámara" },{ id: "babeta_adosar", label: "Enc. muro" },{ id: "none", label: "Sin perfil" }],
};

// Override helpers
function createLineId(groupTitle, idx) { return groupTitle.toUpperCase().replace(/\s/g, "_") + "-" + idx; }
function applyOverrides(groups, overrides) {
  if (!overrides || Object.keys(overrides).length === 0) return groups.map(g => ({ ...g, items: g.items.map(i => ({ ...i, isOverridden: false })) }));
  return groups.map(g => ({ ...g, items: g.items.map((item, idx) => {
    const lid = createLineId(g.title, idx);
    const ovr = overrides[lid];
    if (!ovr) return { ...item, isOverridden: false };
    const patched = { ...item, isOverridden: true, lineId: lid };
    if (ovr.field === "cant") { patched.cant = ovr.value; patched.total = +(ovr.value * patched.pu).toFixed(2); }
    else if (ovr.field === "pu") { patched.pu = ovr.value; patched.total = +(patched.cant * ovr.value).toFixed(2); }
    return patched;
  }) }));
}

function bomToGroups(result) {
  if (!result || result.error) return [];
  const groups = [];
  if (result.paneles) {
    const panelItems = result.allItems ? result.allItems.filter(i => i.unidad === "m²") : [];
    if (panelItems.length > 0) groups.push({ title: "PANELES", items: panelItems });
  }
  const sections = [
    { key: "fijaciones", title: "FIJACIONES" },
    { key: "perfileria", title: "PERFILERÍA TECHO" },
    { key: "perfilesU", title: "PERFILES U" },
    { key: "esquineros", title: "ESQUINEROS" },
    { key: "perfilesExtra", title: "PERFILERÍA PARED" },
    { key: "selladores", title: "SELLADORES" },
    { key: "sellador", title: "SELLADORES" },
  ];
  sections.forEach(({ key, title }) => {
    if (result[key] && result[key].items && result[key].items.length > 0) groups.push({ title, items: result[key].items });
  });
  return groups;
}

// ═══════════════════════════════════════════════════════════════════════════
// §6 UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function AnimNum({ value, style }) {
  const [key, setKey] = useState(0);
  const prev = useRef(value);
  useEffect(() => { if (prev.current !== value) { prev.current = value; setKey(k => k + 1); } }, [value]);
  return <span key={key} style={{ display: "inline-block", animation: "bmc-fade 120ms ease-in-out", ...TN, ...style }}>{value}</span>;
}

function CustomSelect({ label, value, options = [], onChange, showBadge }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  const selected = options.find(o => o.value === value);
  return (
    <div ref={ref} style={{ position: "relative", fontFamily: FONT }}>
      {label && <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>}
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${open ? C.primary : C.border}`, background: C.surface, cursor: "pointer", fontSize: 14, color: C.tp, boxShadow: open ? `0 0 0 3px ${C.primarySoft}` : SHI, transition: TR, fontFamily: FONT }}>
        <span style={{ flex: 1, textAlign: "left" }}>{selected ? selected.label : <span style={{ color: C.tt }}>Seleccionar…</span>}{selected?.sublabel && <span style={{ fontSize: 11, color: C.ts, marginLeft: 6 }}>{selected.sublabel}</span>}</span>
        {showBadge && selected?.badge && <span style={{ fontSize: 11, fontWeight: 600, color: C.primary, background: C.primarySoft, borderRadius: 20, padding: "2px 8px", marginRight: 8, ...TN }}>{selected.badge}</span>}
        {open ? <ChevronUp size={16} color={C.primary} /> : <ChevronDown size={16} color={C.ts} />}
      </button>
      {open && <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50, background: C.surface, borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.15)", overflow: "hidden", maxHeight: 280, overflowY: "auto" }}>
        {options.map(opt => <div key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", cursor: "pointer", fontSize: 14, background: opt.value === value ? C.primarySoft : "transparent", fontWeight: opt.value === value ? 500 : 400, color: C.tp, transition: TR }}>
          <span>{opt.label}</span>{opt.value === value && <Check size={14} color={C.primary} />}
        </div>)}
      </div>}
    </div>
  );
}

function StepperInput({ label, value, onChange, min = 0, max = 9999, step = 1, unit = "", decimals = 2 }) {
  const bump = (dir) => { const next = parseFloat((value + dir * step).toFixed(decimals)); if (next >= min && next <= max) onChange(next); };
  const btnS = (dis) => ({ width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.surface, cursor: dis ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: dis ? 0.4 : 1, transition: TR, flexShrink: 0 });
  return (
    <div style={{ fontFamily: FONT }}>
      {label && <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button style={btnS(value <= min)} onClick={() => bump(-1)}><Minus size={14} color={C.tp} /></button>
        <input type="number" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} onBlur={e => { const v = parseFloat(e.target.value); onChange(isNaN(v) ? min : Math.min(max, Math.max(min, v))); }}
          style={{ width: 80, textAlign: "center", borderRadius: 10, border: `1.5px solid ${C.border}`, padding: "6px 8px", fontSize: 14, fontWeight: 500, background: C.surface, color: C.tp, outline: "none", boxShadow: SHI, transition: TR, fontFamily: FONT, ...TN }} />
        <button style={btnS(value >= max)} onClick={() => bump(1)}><Plus size={14} color={C.tp} /></button>
        {unit && <span style={{ fontSize: 13, color: C.ts, marginLeft: 2 }}>{unit}</span>}
      </div>
    </div>
  );
}

function SegmentedControl({ value, onChange, options = [], disabledIds = [] }) {
  return (
    <div style={{ display: "inline-flex", background: C.border, borderRadius: 12, padding: 3, gap: 2, fontFamily: FONT }}>
      {options.map(opt => {
        const isD = disabledIds.includes(opt.id), isA = value === opt.id;
        return <button key={opt.id} onClick={() => !isD && onChange(opt.id)} style={{ padding: "7px 16px", borderRadius: 10, border: "none", cursor: isD ? "not-allowed" : "pointer", background: isA ? C.surface : "transparent", boxShadow: isA ? "0 1px 3px rgba(0,0,0,0.08)" : "none", fontSize: 13, fontWeight: isA ? 500 : 400, color: isA ? C.tp : C.ts, opacity: isD ? 0.4 : 1, transition: TR, fontFamily: FONT, whiteSpace: "nowrap" }}>{opt.label}</button>;
      })}
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: FONT }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.tp }}>{label}</span>
      <button onClick={() => onChange(!value)} style={{ width: 40, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: value ? C.primary : C.border, position: "relative", transition: TR, flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 20, height: 20, borderRadius: "50%", background: C.surface, boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: TR }} />
      </button>
    </div>
  );
}

function KPICard({ label, value, borderColor = C.primary }) {
  return (
    <div style={{ borderRadius: 12, padding: 16, background: C.surface, boxShadow: SHC, borderLeft: `4px solid ${borderColor}`, fontFamily: FONT }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: C.ts, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: C.tp, lineHeight: 1, ...TN }}><AnimNum value={value} /></div>
    </div>
  );
}

function ColorChips({ colors = [], value, onChange, notes = {} }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontFamily: FONT }}>
      {colors.map(color => {
        const isS = value === color, hex = COLOR_HEX[color] || "#999";
        return <button key={color} onClick={() => onChange(color)} title={notes[color] || color} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px 5px 6px", borderRadius: 20, border: `2px solid ${isS ? C.primary : C.border}`, background: isS ? C.primarySoft : C.surface, cursor: "pointer", transition: TR, fontSize: 12, fontWeight: isS ? 600 : 400, color: C.tp }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", background: hex, flexShrink: 0, border: `1px solid ${color === "Blanco" ? C.border : "transparent"}`, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
          {color}
        </button>;
      })}
    </div>
  );
}

function AlertBanner({ type = "warning", message }) {
  const cfg = { success: { bg: C.successSoft, color: "#1B7A2E", Icon: CheckCircle }, warning: { bg: C.warningSoft, color: "#8A6200", Icon: Info }, danger: { bg: C.dangerSoft, color: C.danger, Icon: AlertTriangle } };
  const { bg, color, Icon } = cfg[type] || cfg.warning;
  return <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, background: bg, fontFamily: FONT }}><Icon size={16} color={color} style={{ flexShrink: 0 }} /><span style={{ fontSize: 13, color, fontWeight: 500 }}>{message}</span></div>;
}

function Toast({ message, visible }) {
  if (!visible) return null;
  return <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 50, background: C.success, color: "#fff", borderRadius: 12, padding: "12px 20px", fontSize: 14, fontWeight: 500, fontFamily: FONT, boxShadow: "0 4px 24px rgba(52,199,89,0.35)", animation: "bmc-slideUp 220ms", display: "flex", alignItems: "center", gap: 8 }}><CheckCircle size={16} color="#fff" />{message}</div>;
}

function TableGroup({ title, items = [], subtotal, collapsed = false, onToggle, overrides, onOverride, onRevert }) {
  const cols = "2fr 0.6fr 0.6fr 0.8fr 0.8fr";
  return (
    <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: SHC, fontFamily: FONT, marginBottom: 12 }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", background: C.brandLight, cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14, color: C.brand }}>{collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}{title}</div>
        <span style={{ fontWeight: 700, fontSize: 14, color: C.brand, ...TN }}>${typeof subtotal === "number" ? subtotal.toFixed(2) : subtotal}</span>
      </div>
      {!collapsed && <div>
        <div style={{ display: "grid", gridTemplateColumns: cols, background: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }}>
          {["Descripción", "Cant.", "Unid.", "P.Unit.", "Total"].map((h, i) => <div key={h} style={{ fontSize: 11, fontWeight: 600, color: C.ts, padding: "4px 12px", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: i > 1 ? "right" : "left" }}>{h}</div>)}
        </div>
        {items.map((item, idx) => <div key={idx} style={{ display: "grid", gridTemplateColumns: cols, background: item.isOverridden ? C.warningSoft : idx % 2 === 0 ? C.surface : C.surfaceAlt, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ padding: "8px 12px", fontSize: 13, color: C.tp }}>{item.label}</div>
          <div style={{ padding: "8px 12px", fontSize: 13, textAlign: "right", color: C.ts, ...TN }}>{typeof item.cant === "number" ? (item.cant % 1 === 0 ? item.cant : item.cant.toFixed(2)) : item.cant}</div>
          <div style={{ padding: "8px 12px", fontSize: 13, textAlign: "right", color: C.tt }}>{item.unidad}</div>
          <div style={{ padding: "8px 12px", fontSize: 13, textAlign: "right", color: C.ts, ...TN }}>{typeof item.pu === "number" ? item.pu.toFixed(2) : item.pu}</div>
          <div style={{ padding: "8px 12px", fontSize: 13, textAlign: "right", fontWeight: 600, color: C.tp, ...TN }}>${typeof item.total === "number" ? item.total.toFixed(2) : item.total}</div>
        </div>)}
      </div>}
    </div>
  );
}

function BorderConfigurator({ borders = {}, onChange }) {
  const sides = ["frente", "fondo", "latIzq", "latDer"];
  const sideLabels = { frente: "FRENTE ▼", fondo: "FONDO ▲", latIzq: "◄ IZQ", latDer: "DER ►" };
  const cellS = (active) => ({ display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 600, background: active ? C.primarySoft : C.surface, border: `1.5px solid ${active ? C.primary : C.border}`, color: active ? C.primary : C.ts, textAlign: "center" });
  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gridTemplateRows: "auto auto auto", gap: 4, marginBottom: 16 }}>
        <div /><div style={cellS(borders.fondo && borders.fondo !== "none")}>{sideLabels.fondo}</div><div />
        <div style={cellS(borders.latIzq && borders.latIzq !== "none")}>{sideLabels.latIzq}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: C.brandLight, borderRadius: 8, padding: "10px 0", fontSize: 11, fontWeight: 700, color: C.brand, border: `1px solid ${C.border}` }}>PANELES</div>
        <div style={cellS(borders.latDer && borders.latDer !== "none")}>{sideLabels.latDer}</div>
        <div /><div style={cellS(borders.frente && borders.frente !== "none")}>{sideLabels.frente}</div><div />
      </div>
      {sides.map(side => {
        const opts = BORDER_OPTIONS[side] || [];
        return <div key={side} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{sideLabels[side]}</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {opts.map(opt => <button key={opt.id} onClick={() => onChange(side, opt.id)} style={{ padding: "4px 10px", borderRadius: 20, border: `1.5px solid ${borders[side] === opt.id ? C.primary : C.border}`, background: borders[side] === opt.id ? C.primarySoft : C.surface, fontSize: 11, fontWeight: borders[side] === opt.id ? 600 : 400, color: borders[side] === opt.id ? C.primary : C.ts, cursor: "pointer", transition: TR }}>{opt.label}</button>)}
          </div>
        </div>;
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// §7 PDF GENERATOR + WHATSAPP
// ═══════════════════════════════════════════════════════════════════════════

const fmtPrice = n => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function generatePrintHTML(data) {
  const { client, project, scenario, panel, autoportancia, groups, totals, warnings } = data;
  const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const scenarioLabel = { solo_techo: "Techo", solo_fachada: "Fachada", techo_fachada: "Techo + Fachada", camara_frig: "Cámara Frigorífica" }[scenario] || scenario;
  const autoportStr = autoportancia?.ok === true ? `Autoportante ✓ · Apoyos: ${autoportancia.apoyos}` : autoportancia?.ok === false ? "⚠ Requiere estructura adicional" : "";
  let tableBody = "";
  groups.forEach(g => {
    const sub = g.items.reduce((s, i) => s + (i.total || 0), 0);
    tableBody += `<tr style="background:#F0F4F8"><td colspan="5" style="font-weight:600;padding:4px 6px">▸ ${esc(g.title)}</td><td style="text-align:right;font-weight:600;padding:4px 6px">$${fmtPrice(sub)}</td></tr>`;
    g.items.forEach((item, idx) => {
      tableBody += `<tr style="background:${idx % 2 ? "#FAFAFA" : "#fff"}"><td style="padding:3px 6px">${esc(item.label)}</td><td style="text-align:center;color:#555;padding:3px 6px">${esc(item.sku || "—")}</td><td style="text-align:right;padding:3px 6px">${typeof item.cant === "number" ? (item.cant % 1 === 0 ? item.cant : item.cant.toFixed(2)) : item.cant}</td><td style="text-align:center;padding:3px 6px">${esc(item.unidad)}</td><td style="text-align:right;padding:3px 6px">${fmtPrice(item.pu)}</td><td style="text-align:right;padding:3px 6px">$${fmtPrice(item.total)}</td></tr>`;
    });
  });
  const warnHTML = (warnings || []).map(w => `<li style="color:#FF9500;font-weight:700">⚠ ${esc(w)}</li>`).join("");
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cotización BMC Uruguay</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;font-size:10pt;color:#1D1D1F;margin:0;-webkit-print-color-adjust:exact}table{border-collapse:collapse;width:100%}th,td{border:0.4pt solid #D0D0D0}</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px"><div style="font-size:18pt;font-weight:800;color:#003366">BMC Uruguay</div><div style="font-size:18pt;font-weight:800">COTIZACIÓN</div></div>
<div style="border-bottom:2pt solid #000;margin-bottom:4px"></div>
<div style="font-size:9pt;color:#444;margin-bottom:8px">bmcuruguay.com.uy · 092 663 245 · Maldonado, Uruguay</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:10pt;margin-bottom:8px">
<div><b>Cliente:</b> ${esc(client.nombre)}</div><div><b>Fecha:</b> ${esc(project.fecha)}</div>
<div><b>RUT:</b> ${esc(client.rut)}</div><div><b>Ref:</b> ${esc(project.refInterna)}</div>
<div><b>Obra:</b> ${esc(project.descripcion)}</div><div><b>Validez:</b> 10 días</div>
<div><b>Tel:</b> ${esc(client.telefono)}</div><div><b>Dir:</b> ${esc(client.direccion)}</div>
</div>
<div style="background:#F0F4F8;padding:6px 10px;border-radius:4px;margin-bottom:6px"><b style="color:#003366">PRODUCTO:</b> ${esc(panel.label)} · ${panel.espesor}mm · Color: ${esc(panel.color)} <span style="background:#003366;color:#fff;font-size:7.5pt;font-weight:700;padding:1px 6px;border-radius:3px;margin-left:8px">${esc(scenarioLabel)}</span>${autoportStr ? `<div style="font-size:8.5pt;color:#444;margin-top:2px">${autoportStr}</div>` : ""}</div>
<table style="font-size:9pt;margin-bottom:6px"><thead><tr style="background:#EDEDED;font-weight:700"><th style="text-align:left;width:38%;padding:3px 6px">Descripción</th><th style="text-align:center;width:10%;padding:3px 6px">SKU</th><th style="text-align:right;width:8%;padding:3px 6px">Cant.</th><th style="text-align:center;width:7%;padding:3px 6px">Unid.</th><th style="text-align:right;width:13%;padding:3px 6px">P.U. USD</th><th style="text-align:right;width:14%;padding:3px 6px">Total USD</th></tr></thead><tbody>${tableBody}</tbody></table>
<div style="display:flex;justify-content:flex-end;margin-bottom:6px"><table style="min-width:260px;font-size:10pt"><tr><td style="padding:2px 8px">Subtotal s/IVA</td><td style="text-align:right;padding:2px 8px">$${fmtPrice(totals.subtotalSinIVA)}</td></tr><tr><td style="padding:2px 8px">IVA 22%</td><td style="text-align:right;padding:2px 8px">$${fmtPrice(totals.iva)}</td></tr><tr style="border-top:1pt solid #000;font-size:14pt;font-weight:800"><td style="padding:2px 8px">TOTAL USD</td><td style="text-align:right;color:#003366;padding:2px 8px">$${fmtPrice(totals.totalFinal)}</td></tr></table></div>
<div style="font-size:8pt;line-height:1.4;margin-bottom:6px"><b>COMENTARIOS:</b><ul style="margin:0;padding-left:14px"><li style="font-weight:700">Entrega 10 a 15 días.</li><li style="color:#FF3B30;font-weight:600">Oferta válida 10 días.</li><li style="font-weight:700;color:#FF3B30">Seña 60%, saldo contra entrega.</li><li>Precios en USD, IVA incluido en total.</li>${warnHTML}</ul></div>
<table style="font-size:8.5pt;margin-top:6px"><thead><tr><th colspan="2" style="background:#EDEDED;font-weight:700;text-align:left;padding:3px 8px">Depósito Bancario</th></tr></thead><tbody><tr><td style="padding:3px 8px">Titular: <b>Metalog SAS</b></td><td style="padding:3px 8px">RUT: 120403630012</td></tr><tr><td style="padding:3px 8px">BROU · Cta. Dólares: <b>110520638-00002</b></td><td style="padding:3px 8px">Consultas: <b>092 663 245</b></td></tr></tbody></table>
</body></html>`;
}

function openPrintWindow(html) {
  const w = window.open("", "_blank", "width=800,height=1100");
  if (!w) { alert("Habilitá popups para imprimir."); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

function buildWhatsAppText(data) {
  const { client, project, scenario, panel, totals, listaLabel } = data;
  const scenarioLabel = { solo_techo: "Solo techo", solo_fachada: "Solo fachada", techo_fachada: "Techo + Fachada", camara_frig: "Cámara Frigorífica" }[scenario] || scenario;
  let txt = `*Cotización BMC Uruguay*\n📅 ${project.fecha} · Ref: ${project.refInterna || "—"}\n🏗 Cliente: ${client.nombre}${client.rut ? " · " + client.rut : ""}\n📐 Obra: ${project.descripcion || "—"} · ${client.direccion || "—"}\n💲 Lista: ${listaLabel}\n\n*Escenario:* ${scenarioLabel}\n*Panel:* ${panel.label} ${panel.espesor}mm · Color: ${panel.color}\n`;
  txt += `\n💰 *Subtotal s/IVA:* USD ${fmtPrice(totals.subtotalSinIVA)}\n💰 *IVA 22%:* USD ${fmtPrice(totals.iva)}\n✅ *TOTAL USD: ${fmtPrice(totals.totalFinal)}*\n\n_Entrega 10-15d · Seña 60%_\n_092 663 245 · bmcuruguay.com.uy_`;
  return txt;
}

// ═══════════════════════════════════════════════════════════════════════════
// §8 MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function PanelinCalculadoraV3() {
  // ── State ──
  const [listaPrecios, setLP] = useState("web");
  const [scenario, setScenario] = useState("solo_techo");
  const [proyecto, setProyecto] = useState({ tipoCliente: "empresa", nombre: "", rut: "", telefono: "", direccion: "", descripcion: "", refInterna: "", fecha: new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" }) });
  const [techo, setTecho] = useState({ familia: "", espesor: "", color: "Blanco", largo: 6.0, ancho: 5.0, tipoEst: "metal", ptsHorm: 0, borders: { frente: "gotero_frontal", fondo: "gotero_frontal", latIzq: "gotero_lateral", latDer: "gotero_lateral" }, opciones: { inclCanalon: false, inclGotSup: false, inclSell: true } });
  const [pared, setPared] = useState({ familia: "", espesor: "", color: "Blanco", alto: 3.5, perimetro: 40, numEsqExt: 4, numEsqInt: 0, aberturas: [], tipoEst: "metal", inclSell: true, incl5852: false });
  const [camara, setCamara] = useState({ largo_int: 6, ancho_int: 4, alto_int: 3 });
  const [flete, setFlete] = useState(280);
  const [overrides, setOverrides] = useState({});
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [toast, setToast] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [showTransp, setShowTransp] = useState(false);

  // Sync LISTA_ACTIVA
  useEffect(() => { setListaPrecios(listaPrecios); }, [listaPrecios]);

  const vis = VIS[scenario] || VIS.solo_techo;
  const scenarioDef = SCENARIOS_DEF.find(s => s.id === scenario);

  // ── Get active panel info ──
  const getActivePanel = useCallback(() => {
    if (scenarioDef?.hasTecho && !scenarioDef?.hasPared) return { ...techo, source: PANELS_TECHO };
    if (scenarioDef?.hasPared && !scenarioDef?.hasTecho) return { ...pared, source: PANELS_PARED };
    return { ...techo, source: PANELS_TECHO }; // default
  }, [scenario, techo, pared]);

  // ── Available families for current scenario ──
  const familyOptions = useMemo(() => {
    if (!scenarioDef) return [];
    const allPanels = { ...PANELS_TECHO, ...PANELS_PARED };
    return scenarioDef.familias.map(fk => {
      const pd = allPanels[fk];
      return pd ? { value: fk, label: pd.label, sublabel: pd.sub } : null;
    }).filter(Boolean);
  }, [scenario]);

  // ── Get espesor options ──
  const currentFamilia = scenarioDef?.hasTecho && !scenarioDef?.hasPared ? techo.familia : pared.familia;
  const activePanelData = useMemo(() => {
    const all = { ...PANELS_TECHO, ...PANELS_PARED };
    return all[currentFamilia] || null;
  }, [currentFamilia]);

  const espesorOptions = useMemo(() => {
    if (!activePanelData) return [];
    return Object.keys(activePanelData.esp).map(e => ({ value: Number(e), label: `${e} mm`, badge: activePanelData.esp[e].ap ? `AP ${activePanelData.esp[e].ap}m` : undefined }));
  }, [activePanelData]);

  const currentEspesor = scenarioDef?.hasTecho && !scenarioDef?.hasPared ? techo.espesor : pared.espesor;
  const currentColor = scenarioDef?.hasTecho && !scenarioDef?.hasPared ? techo.color : pared.color;

  // ── Calculate results ──
  const results = useMemo(() => {
    setListaPrecios(listaPrecios);
    const sc = scenario;
    try {
      if (sc === "solo_techo") {
        if (!techo.familia || !techo.espesor) return null;
        return calcTechoCompleto(techo);
      }
      if (sc === "solo_fachada") {
        if (!pared.familia || !pared.espesor) return null;
        return calcParedCompleto(pared);
      }
      if (sc === "techo_fachada") {
        const rT = techo.familia && techo.espesor ? calcTechoCompleto(techo) : null;
        const rP = pared.familia && pared.espesor ? calcParedCompleto(pared) : null;
        if (!rT && !rP) return null;
        const allItems = [...(rT?.allItems || []), ...(rP?.allItems || [])];
        const totales = calcTotalesSinIVA(allItems);
        return { ...rT, paredResult: rP, allItems, totales, warnings: [...(rT?.warnings || []), ...(rP?.warnings || [])] };
      }
      if (sc === "camara_frig") {
        if (!pared.familia || !pared.espesor) return null;
        const perim = 2 * (camara.largo_int + camara.ancho_int);
        const rP = calcParedCompleto({ ...pared, perimetro: perim, alto: camara.alto_int, numEsqExt: 4, numEsqInt: 0 });
        // Techo: use ISODEC_EPS 100mm as default roof for cámaras (wall panels don't go on roof)
        const techoFam = pared.familia in PANELS_TECHO ? pared.familia : "ISODEC_EPS";
        const techoEsp = pared.familia in PANELS_TECHO ? pared.espesor : 100;
        const rT = calcTechoCompleto({ familia: techoFam, espesor: techoEsp, largo: camara.largo_int, ancho: camara.ancho_int, tipoEst: "metal", borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" }, opciones: { inclCanalon: false, inclGotSup: false, inclSell: true }, color: pared.color || "Blanco" });
        const allItems = [...(rP?.allItems || []), ...(rT?.allItems || [])];
        const totales = calcTotalesSinIVA(allItems);
        return { ...rP, techoResult: rT, allItems, totales, warnings: [...(rP?.warnings || []), ...(rT?.warnings || []), "Techo calculado con " + techoFam + " " + techoEsp + "mm"] };
      }
    } catch (e) { return { error: e.message }; }
    return null;
  }, [listaPrecios, scenario, techo, pared, camara, flete]);

  // ── Build BOM groups ──
  const groups = useMemo(() => {
    if (!results || results.error) return [];
    let g = bomToGroups(results);
    // Add flete
    if (flete > 0) {
      const puFlete = p(SERVICIOS.flete);
      g.push({ title: "SERVICIOS", items: [{ label: SERVICIOS.flete.label, sku: "FLETE", cant: 1, unidad: "servicio", pu: puFlete, total: puFlete }] });
    }
    return applyOverrides(g, overrides);
  }, [results, overrides, flete, listaPrecios]);

  // ── Grand totals (with overrides applied) ──
  const grandTotal = useMemo(() => {
    const allItems = [];
    groups.forEach(g => g.items.forEach(i => allItems.push(i)));
    return calcTotalesSinIVA(allItems);
  }, [groups]);

  // ── Helpers ──
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  const handleCopyWA = () => {
    const txt = buildWhatsAppText({
      client: proyecto, project: proyecto, scenario,
      panel: { label: activePanelData?.label || "", espesor: currentEspesor, color: currentColor },
      totals: grandTotal,
      listaLabel: listaPrecios === "venta" ? "BMC directo" : "Web",
    });
    navigator.clipboard.writeText(txt).then(() => showToast("Copiado al portapapeles"));
  };

  const handlePrint = () => {
    const html = generatePrintHTML({
      client: proyecto, project: proyecto, scenario,
      panel: { label: activePanelData?.label || "", espesor: currentEspesor, color: currentColor },
      autoportancia: results?.autoportancia,
      groups: groups.map(g => ({ title: g.title, items: g.items, subtotal: g.items.reduce((s, i) => s + (i.total || 0), 0) })),
      totals: grandTotal,
      warnings: results?.warnings || [],
    });
    openPrintWindow(html);
  };

  const handleReset = () => {
    setTecho({ familia: "", espesor: "", color: "Blanco", largo: 6.0, ancho: 5.0, tipoEst: "metal", ptsHorm: 0, borders: { frente: "gotero_frontal", fondo: "gotero_frontal", latIzq: "gotero_lateral", latDer: "gotero_lateral" }, opciones: { inclCanalon: false, inclGotSup: false, inclSell: true } });
    setPared({ familia: "", espesor: "", color: "Blanco", alto: 3.5, perimetro: 40, numEsqExt: 4, numEsqInt: 0, aberturas: [], tipoEst: "metal", inclSell: true, incl5852: false });
    setCamara({ largo_int: 6, ancho_int: 4, alto_int: 3 });
    setOverrides({});
    setActiveStep(0);
  };

  // ── Input updaters ──
  const uT = (k, v) => setTecho(t => ({ ...t, [k]: v }));
  const uP = (k, v) => setPared(pd => ({ ...pd, [k]: v }));
  const uPr = (k, v) => setProyecto(pr => ({ ...pr, [k]: v }));

  const setFamilia = (fam) => {
    const all = { ...PANELS_TECHO, ...PANELS_PARED };
    const pd = all[fam];
    if (!pd) return;
    if (pd.tipo === "techo") uT("familia", fam);
    else uP("familia", fam);
    // Also set the espesor to first available
    const firstEsp = Object.keys(pd.esp)[0];
    if (pd.tipo === "techo") uT("espesor", Number(firstEsp));
    else uP("espesor", Number(firstEsp));
  };

  // ── Section style ──
  const sectionS = { background: C.surface, borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: SHC };
  const labelS = { fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" };
  const inputS = { width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, color: C.tp, outline: "none", fontFamily: FONT, boxShadow: SHI };

  // ── KPI values ──
  const kpiArea = results?.paneles?.areaTotal || results?.paneles?.areaNeta || 0;
  const kpiPaneles = results?.paneles?.cantPaneles || 0;
  const kpiApoyos = results?.autoportancia?.apoyos || (results?.paneles ? (pared.numEsqExt + pared.numEsqInt) : 0);
  const kpiFij = results?.fijaciones?.puntosFijacion || 0;

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: "100vh" }}>
      {/* HEADER */}
      <div style={{ background: C.brand, color: "#fff", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px" }}>BMC Uruguay</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>· Panelin v3.1</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleReset} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Trash2 size={14} />Limpiar</button>
          <button onClick={handlePrint} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: C.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Printer size={14} />Imprimir</button>
        </div>
      </div>

      {/* PROGRESS */}
      <div style={{ display: "flex", gap: 0, padding: "0 24px", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        {["Proyecto", "Panel", "Bordes", "Opciones"].map((s, i) => (
          <button key={s} onClick={() => setActiveStep(i)} style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: activeStep === i ? 600 : 400, color: activeStep === i ? C.primary : C.ts, borderBottom: `2px solid ${activeStep === i ? C.primary : "transparent"}`, background: "none", border: "none", borderBottomStyle: "solid", cursor: "pointer", transition: TR }}>{s}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 24, padding: 24, maxWidth: 1400, margin: "0 auto", flexWrap: "wrap" }}>
        {/* LEFT PANEL */}
        <div style={{ flex: "1 1 420px", minWidth: 360, maxWidth: 520 }}>
          {/* Lista precios */}
          <div style={sectionS}>
            <div style={labelS}>LISTA DE PRECIOS</div>
            <SegmentedControl value={listaPrecios} onChange={v => setLP(v)} options={[{ id: "venta", label: "Precio BMC" }, { id: "web", label: "Precio Web" }]} />
          </div>

          {/* Escenario */}
          <div style={sectionS}>
            <div style={labelS}>ESCENARIO DE OBRA</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {SCENARIOS_DEF.map(sc => {
                const isS = scenario === sc.id;
                return <div key={sc.id} onClick={() => setScenario(sc.id)} style={{ borderRadius: 16, padding: 20, cursor: "pointer", border: `2px solid ${isS ? C.primary : C.border}`, background: isS ? C.primarySoft : C.surface, transition: TR, boxShadow: isS ? `0 0 0 4px ${C.primarySoft}` : SHC }}>
                  <span style={{ fontSize: 32, display: "block", marginBottom: 8 }}>{sc.icon}</span>
                  <div style={{ fontSize: 15, fontWeight: 600, color: isS ? C.primary : C.tp, marginBottom: 4 }}>{sc.label}</div>
                  <div style={{ fontSize: 12, color: C.ts, lineHeight: 1.4 }}>{sc.description}</div>
                </div>;
              })}
            </div>
          </div>

          {/* Datos proyecto */}
          <div style={sectionS}>
            <div style={labelS}>DATOS DEL PROYECTO</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <SegmentedControl value={proyecto.tipoCliente} onChange={v => uPr("tipoCliente", v)} options={[{ id: "empresa", label: "Empresa" }, { id: "persona", label: "Persona" }]} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><div style={labelS}>Nombre</div><input style={inputS} value={proyecto.nombre} onChange={e => uPr("nombre", e.target.value)} /></div>
              {proyecto.tipoCliente === "empresa" && <div><div style={labelS}>RUT</div><input style={inputS} value={proyecto.rut} onChange={e => uPr("rut", e.target.value)} /></div>}
              <div><div style={labelS}>Teléfono</div><input style={inputS} value={proyecto.telefono} onChange={e => uPr("telefono", e.target.value)} /></div>
              <div><div style={labelS}>Dirección</div><input style={inputS} value={proyecto.direccion} onChange={e => uPr("direccion", e.target.value)} /></div>
              <div style={{ gridColumn: "1/-1" }}>
                <div style={labelS}>Descripción obra</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                  {OBRA_PRESETS.slice(0, 6).map(pr => <button key={pr} onClick={() => uPr("descripcion", pr)} style={{ padding: "3px 10px", borderRadius: 20, border: `1px solid ${proyecto.descripcion === pr ? C.primary : C.border}`, background: proyecto.descripcion === pr ? C.primarySoft : C.surface, fontSize: 11, cursor: "pointer", color: C.tp }}>{pr}</button>)}
                </div>
                <input style={inputS} value={proyecto.descripcion} onChange={e => uPr("descripcion", e.target.value)} placeholder="Descripción libre..." />
              </div>
              <div><div style={labelS}>Ref. interna</div><input style={inputS} value={proyecto.refInterna} onChange={e => uPr("refInterna", e.target.value)} /></div>
              <div><div style={labelS}>Fecha</div><input style={inputS} value={proyecto.fecha} onChange={e => uPr("fecha", e.target.value)} /></div>
            </div>
          </div>

          {/* Panel selector */}
          <div style={sectionS}>
            <div style={labelS}>PANEL</div>
            <CustomSelect label="Familia" value={currentFamilia} options={familyOptions} onChange={setFamilia} />
            <div style={{ marginTop: 12 }}>
              <CustomSelect label="Espesor" value={currentEspesor} options={espesorOptions.map(e => ({ ...e, value: e.value }))} onChange={v => { if (scenarioDef?.hasTecho && !scenarioDef?.hasPared) uT("espesor", v); else uP("espesor", v); }} showBadge />
            </div>
            {activePanelData && <div style={{ marginTop: 12 }}>
              <div style={labelS}>Color</div>
              <ColorChips colors={activePanelData.col} value={currentColor} onChange={c => { if (scenarioDef?.hasTecho && !scenarioDef?.hasPared) uT("color", c); else uP("color", c); }} notes={activePanelData.colNotes || {}} />
            </div>}
          </div>

          {/* Dimensiones Techo */}
          {vis.largoAncho && <div style={sectionS}>
            <div style={labelS}>DIMENSIONES TECHO</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <StepperInput label="Largo (m)" value={techo.largo} onChange={v => uT("largo", v)} min={1} max={20} step={0.5} unit="m" />
              <StepperInput label="Ancho (m)" value={techo.ancho} onChange={v => uT("ancho", v)} min={1} max={20} step={0.5} unit="m" />
            </div>
          </div>}

          {/* Dimensiones Pared */}
          {vis.altoPerim && <div style={sectionS}>
            <div style={labelS}>DIMENSIONES PARED</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <StepperInput label="Alto (m)" value={pared.alto} onChange={v => uP("alto", v)} min={1} max={14} step={0.5} unit="m" />
              <StepperInput label="Perímetro (m)" value={pared.perimetro} onChange={v => uP("perimetro", v)} min={4} max={500} step={1} unit="m" />
            </div>
            {vis.esquineros && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <StepperInput label="Esquinas ext." value={pared.numEsqExt} onChange={v => uP("numEsqExt", v)} min={0} max={20} step={1} decimals={0} />
              <StepperInput label="Esquinas int." value={pared.numEsqInt} onChange={v => uP("numEsqInt", v)} min={0} max={20} step={1} decimals={0} />
            </div>}
          </div>}

          {/* Cámara frigorífica */}
          {vis.camara && <div style={sectionS}>
            <div style={labelS}>DIMENSIONES CÁMARA (internas)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <StepperInput label="Largo (m)" value={camara.largo_int} onChange={v => setCamara(c => ({ ...c, largo_int: v }))} min={1} max={30} step={0.5} unit="m" />
              <StepperInput label="Ancho (m)" value={camara.ancho_int} onChange={v => setCamara(c => ({ ...c, ancho_int: v }))} min={1} max={30} step={0.5} unit="m" />
              <StepperInput label="Alto (m)" value={camara.alto_int} onChange={v => setCamara(c => ({ ...c, alto_int: v }))} min={1} max={14} step={0.5} unit="m" />
            </div>
          </div>}

          {/* Bordes techo */}
          {vis.borders && <div style={sectionS}>
            <div style={labelS}>BORDES Y PERFILERÍA</div>
            <BorderConfigurator borders={techo.borders} onChange={(side, val) => setTecho(t => ({ ...t, borders: { ...t.borders, [side]: val } }))} />
          </div>}

          {/* Estructura */}
          <div style={sectionS}>
            <div style={labelS}>ESTRUCTURA</div>
            <SegmentedControl value={scenarioDef?.hasTecho && !scenarioDef?.hasPared ? techo.tipoEst : pared.tipoEst} onChange={v => { uT("tipoEst", v); uP("tipoEst", v); }} options={[{ id: "metal", label: "Metal" }, { id: "hormigon", label: "Hormigón" }, { id: "mixto", label: "Mixto" }, { id: "madera", label: "Madera" }]} />
          </div>

          {/* Opciones */}
          <div style={sectionS}>
            <div style={labelS}>OPCIONES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {vis.canalGot && <>
                <Toggle label="Canalón" value={techo.opciones.inclCanalon} onChange={v => setTecho(t => ({ ...t, opciones: { ...t.opciones, inclCanalon: v } }))} />
                <Toggle label="Gotero superior" value={techo.opciones.inclGotSup} onChange={v => setTecho(t => ({ ...t, opciones: { ...t.opciones, inclGotSup: v } }))} />
              </>}
              <Toggle label="Selladores" value={scenarioDef?.hasTecho && !scenarioDef?.hasPared ? techo.opciones.inclSell : pared.inclSell} onChange={v => { setTecho(t => ({ ...t, opciones: { ...t.opciones, inclSell: v } })); uP("inclSell", v); }} />
              {vis.p5852 && <Toggle label="Perfil 5852 aluminio" value={pared.incl5852} onChange={v => uP("incl5852", v)} />}
              <div style={{ marginTop: 8 }}>
                <StepperInput label="Flete (USD s/IVA)" value={flete} onChange={setFlete} min={0} max={2000} step={10} unit="USD" decimals={0} />
              </div>
            </div>
          </div>

          {/* Aberturas */}
          {vis.aberturas && <div style={sectionS}>
            <div style={labelS}>ABERTURAS</div>
            {pared.aberturas.map((ab, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, padding: 8, borderRadius: 8, background: C.surfaceAlt }}>
                <SegmentedControl value={ab.tipo} onChange={v => { const next = [...pared.aberturas]; next[i] = { ...next[i], tipo: v }; uP("aberturas", next); }} options={[{ id: "puerta", label: "Puerta" }, { id: "ventana", label: "Ventana" }]} />
                <input type="number" placeholder="Ancho" value={ab.ancho} onChange={e => { const next = [...pared.aberturas]; next[i] = { ...next[i], ancho: parseFloat(e.target.value) || 0 }; uP("aberturas", next); }} style={{ ...inputS, width: 70, padding: "6px 8px" }} />
                <span style={{ color: C.ts, fontSize: 13 }}>×</span>
                <input type="number" placeholder="Alto" value={ab.alto} onChange={e => { const next = [...pared.aberturas]; next[i] = { ...next[i], alto: parseFloat(e.target.value) || 0 }; uP("aberturas", next); }} style={{ ...inputS, width: 70, padding: "6px 8px" }} />
                <input type="number" placeholder="Cant" value={ab.cant} onChange={e => { const next = [...pared.aberturas]; next[i] = { ...next[i], cant: parseInt(e.target.value) || 1 }; uP("aberturas", next); }} style={{ ...inputS, width: 50, padding: "6px 8px" }} />
                <button onClick={() => { const next = pared.aberturas.filter((_, j) => j !== i); uP("aberturas", next); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.danger }}><Trash2 size={14} /></button>
              </div>
            ))}
            <button onClick={() => uP("aberturas", [...pared.aberturas, { tipo: "puerta", ancho: 0.9, alto: 2.1, cant: 1 }])} style={{ padding: "8px 16px", borderRadius: 10, border: `1.5px dashed ${C.border}`, background: C.surface, fontSize: 13, cursor: "pointer", color: C.primary, fontWeight: 500 }}>+ Agregar abertura</button>
          </div>}
        </div>

        {/* RIGHT PANEL */}
        <div style={{ flex: "1 1 480px", minWidth: 400 }}>
          {/* KPI Row */}
          {results && !results.error && <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
            <KPICard label="Área" value={`${kpiArea.toFixed(1)}m²`} borderColor={C.primary} />
            <KPICard label="Paneles" value={kpiPaneles} borderColor={C.success} />
            <KPICard label={vis.autoportancia ? "Apoyos" : "Esquinas"} value={kpiApoyos || "—"} borderColor={C.warning} />
            <KPICard label="Pts fijación" value={kpiFij || "—"} borderColor={C.brand} />
          </div>}

          {/* Warnings */}
          {results?.warnings?.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {results.warnings.map((w, i) => <AlertBanner key={i} type={w.includes("excede") || w.includes("EXCEDE") || w.includes("solo") ? "danger" : "warning"} message={w} />)}
          </div>}

          {/* Autoportancia */}
          {vis.autoportancia && results?.autoportancia && <div style={{ marginBottom: 16 }}>
            <AlertBanner type={results.autoportancia.ok ? "success" : "danger"} message={results.autoportancia.ok ? `Autoportante ✓ · Vano máx: ${results.autoportancia.maxSpan}m · ${results.autoportancia.apoyos} apoyos` : `Largo excede autoportancia (${results.autoportancia.maxSpan}m). Requiere ${results.autoportancia.apoyos} apoyos intermedios.`} />
          </div>}

          {/* No data message */}
          {!results && <div style={{ ...sectionS, textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📐</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.tp, marginBottom: 4 }}>Seleccioná un panel y espesor</div>
            <div style={{ fontSize: 13, color: C.ts }}>Los resultados aparecerán aquí</div>
          </div>}

          {results?.error && <AlertBanner type="danger" message={results.error} />}

          {/* BOM Table */}
          {groups.length > 0 && <div style={{ marginBottom: 16 }}>
            {groups.map((g, gi) => <TableGroup key={gi} title={g.title} items={g.items} subtotal={g.items.reduce((s, i) => s + (i.total || 0), 0)} collapsed={!!collapsedGroups[g.title]} onToggle={() => setCollapsedGroups(cg => ({ ...cg, [g.title]: !cg[g.title] }))} />)}
          </div>}

          {/* Totals */}
          {groups.length > 0 && <div style={{ background: C.dark, borderRadius: 16, padding: 24, color: "#fff", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 14, opacity: 0.7 }}>Subtotal s/IVA</span>
              <span style={{ fontSize: 16, fontWeight: 600, ...TN }}>USD {fmtPrice(grandTotal.subtotalSinIVA)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 14, opacity: 0.7 }}>IVA 22%</span>
              <span style={{ fontSize: 16, fontWeight: 600, ...TN }}>USD {fmtPrice(grandTotal.iva)}</span>
            </div>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 12, marginTop: 8, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 20, fontWeight: 800 }}>TOTAL</span>
              <span style={{ fontSize: 28, fontWeight: 800, ...TN }}>USD {fmtPrice(grandTotal.totalFinal)}</span>
            </div>
          </div>}

          {/* Condiciones */}
          {groups.length > 0 && <div style={{ ...sectionS, fontSize: 12, color: C.ts, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: C.tp }}>Condiciones comerciales:</div>
            <div>Entrega: 10 a 15 días hábiles. Seña: 60%, saldo contra entrega. Validez: 10 días. Precios en USD.</div>
            <div style={{ marginTop: 12, fontWeight: 700, color: C.tp }}>Datos bancarios:</div>
            <div>Metalog SAS · RUT: 120403630012 · BROU Cta. Dólares: 110520638-00002</div>
          </div>}

          {/* Action buttons */}
          {groups.length > 0 && <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <button onClick={handleCopyWA} style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: "none", background: "#25D366", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Copy size={16} />WhatsApp</button>
            <button onClick={handlePrint} style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: "none", background: C.primary, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><FileText size={16} />PDF</button>
          </div>}

          {/* Transparency Panel */}
          {results && !results.error && <div style={{ ...sectionS, padding: 0, overflow: "hidden" }}>
            <div onClick={() => setShowTransp(!showTransp)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", cursor: "pointer", background: C.surfaceAlt }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13, color: C.ts }}><Info size={14} />Transparencia — valores y reglas</div>
              {showTransp ? <ChevronUp size={16} color={C.ts} /> : <ChevronDown size={16} color={C.ts} />}
            </div>
            {showTransp && <div style={{ padding: 20, fontSize: 12, color: C.ts, lineHeight: 1.8, fontFamily: "monospace" }}>
              <div>LISTA_ACTIVA: {listaPrecios}</div>
              <div>Escenario: {scenario}</div>
              {results.paneles && <>
                <div>Paneles: {results.paneles.cantPaneles} × AU={activePanelData?.au}m = {results.paneles.anchoTotal || "—"}m</div>
                <div>Área: {results.paneles.areaTotal || results.paneles.areaNeta} m²</div>
                <div>Precio/m²: ${results.paneles.precioM2} (SIN IVA)</div>
              </>}
              {results.autoportancia && results.autoportancia.maxSpan && <div>Autoportancia: {results.autoportancia.ok ? "OK" : "EXCEDE"} · max={results.autoportancia.maxSpan}m · apoyos={results.autoportancia.apoyos}</div>}
              <div style={{ marginTop: 8, fontWeight: 700 }}>Todos los precios en USD SIN IVA. IVA 22% aplicado al total.</div>
            </div>}
          </div>}
        </div>
      </div>

      <Toast message={toast} visible={!!toast} />
    </div>
  );
}
