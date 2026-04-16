// ═══════════════════════════════════════════════════════════════════════════
// dimensioningFormulas.js — Parámetros de fórmulas de dimensionamiento
// Determinan cantidades de productos en función de variables (área, perímetro, etc.)
// Descargar/upload para editar en Excel o planilla externa.
// ═══════════════════════════════════════════════════════════════════════════

import { getPricing } from "../data/pricing.js";
import { getDimensioningOverrides, getDimensioningFormulaOverrides, setDimensioningOverridesBulk } from "./dimensioningFormulasOverrides.js";

/** Obtener valor de fórmula: override o default */
export function getDimensioningParam(path, defaultValue) {
  const overrides = getDimensioningOverrides();
  if (path in overrides && overrides[path] != null) return +overrides[path];
  return defaultValue;
}

/** Schema base: factores de fórmula (no dependen de paneles) */
const FORMULA_FACTORS = [
  { path: "FIJACIONES_VARILLA.espaciado_perimetro", label: "Espaciado perímetro fijación varilla (m)", default: 2.5, formula: "laterales verticales expuestos (planta): +Σ max(0,ceil(L/valor)−1) por tramo left/right exterior; sin multizona: +2×max(0,ceil(largo/valor)−1); puntos = grilla + lateral; grilla = cantP×(apoyos+2) (apoyos≥2)", unidad: "m", categoria: "Fijaciones Techo" },
  { path: "FIJACIONES_VARILLA.puntos_comercial_default", label: "Puntos fijación (BOM comercial ISODEC PIR)", default: 22, formula: "override cuando opciones.bomComercial", unidad: "unid", categoria: "Fijaciones Techo" },
  { path: "FIJACIONES_VARILLA.largo_comercial_m", label: "Largo barra varilla roscada comercial (m)", default: 1, formula: "barras = ceil(puntos / floor(valor / tramo_m)); tramo = espesor_m + extra sustrato", unidad: "m", categoria: "Fijaciones Techo" },
  { path: "FIJACIONES_VARILLA.rosca_extra_metal_hormigon_m", label: "Rosca útil extra metal/hormigón (m)", default: 0.1, formula: "tramo varilla = espesor panel (m) + valor (Isodec varilla/tuerca)", unidad: "m", categoria: "Fijaciones Techo" },
  { path: "FIJACIONES_VARILLA.rosca_extra_madera_m", label: "Rosca útil extra madera (m)", default: 0.20, formula: "tramo varilla = espesor panel (m) + valor (combinada/madera); madera requiere 20cm extra para atravesar la viga", unidad: "m", categoria: "Fijaciones Techo" },
  { path: "FIJACIONES_VARILLA.varillas_por_punto", label: "Varillas por punto (fallback sin espesor_mm)", default: 4, formula: "solo si opts.espesorMm ausente: varillas = ceil(puntos/valor)", unidad: "unid", categoria: "Fijaciones Techo" },
  { path: "FIJACIONES_CABALETE.factor_largo", label: "Factor largo caballete (m)", default: 2.9, formula: "caballetes por tramo = largo/valor + 1", unidad: "m", categoria: "Fijaciones Techo" },
  { path: "FIJACIONES_CABALETE.factor_ancho", label: "Factor ancho caballete (m)", default: 0.3, formula: "caballetes perim = (largo*2)/valor", unidad: "m", categoria: "Fijaciones Techo" },
  { path: "PERFILERIA.espaciado_fijacion_ml", label: "Espaciado fijación perfilería (m/ml)", default: 0.30, formula: "fijPerf = ceil(totalML/valor)", unidad: "m", categoria: "Perfilería" },
  { path: "PERFILERIA.soporte_canalon_ml_por_apoyo", label: "ML soporte canalón por apoyo", default: 0.30, formula: "mlSoportes = (cantP+1)*valor", unidad: "m", categoria: "Perfilería" },
  { path: "PERFILERIA.canalon_empalme_silicona_ml", label: "Silicona empalme canalón (m)", default: 0.6, formula: "ml por empalme × 2 cordones", unidad: "m", categoria: "Perfilería" },
  { path: "SELLADORES_TECHO.silicona_ml_por_unid", label: "Silicona techo: ml por unidad", default: 10.27, formula: "siliconas = ceil(mlSilicona/valor)", unidad: "ml", categoria: "Selladores Techo" },
  { path: "SELLADORES_TECHO.comercial_siliconas", label: "Kit comercial: cantidad siliconas", default: 4, formula: "BOM comercial ISODEC PIR", unidad: "unid", categoria: "Selladores Techo" },
  { path: "SELLADORES_TECHO.comercial_membranas", label: "Kit comercial: rollos membrana", default: 2, formula: "BOM comercial ISODEC PIR", unidad: "unid", categoria: "Selladores Techo" },
  { path: "SELLADORES_TECHO.comercial_espumas", label: "Kit comercial: espumas PU", default: 4, formula: "BOM comercial ISODEC PIR", unidad: "unid", categoria: "Selladores Techo" },
  { path: "SELLADORES_TECHO.cinta_paneles_por_rollo", label: "Cinta techo: paneles por rollo", default: 10, formula: "cintas = ceil(cantP/valor)", unidad: "paneles", categoria: "Selladores Techo" },
  {
    path: "SELLADORES_TECHO.silicona_300_por_unid_600",
    label: "Silicona 300 ml neutra: unidades por unidad silicona Bromplast 600 ml",
    default: 2,
    formula: "cant_300 = siliconas_600 × valor (techo, pared y kit comercial)",
    unidad: "ratio",
    categoria: "Selladores Techo",
  },
  { path: "FIJACIONES_PARED.anclaje_espaciado", label: "Espaciado anclajes pared (m)", default: 0.30, formula: "anclajes = ceil(anchoTotal/valor)", unidad: "m", categoria: "Fijaciones Pared" },
  { path: "FIJACIONES_PARED.tornillo_t2_por_m2", label: "Tornillos T2 por m² pared", default: 5.5, formula: "tornillos = ceil(areaNeta*valor)", unidad: "unid/m²", categoria: "Fijaciones Pared" },
  { path: "FIJACIONES_PARED.remaches_por_panel", label: "Remaches por panel pared", default: 2, formula: "remaches = cantP*valor", unidad: "unid", categoria: "Fijaciones Pared" },
  { path: "SELLADORES_PARED.silicona_ml_por_unid", label: "Silicona pared: ml por unidad", default: 8, formula: "siliconas = ceil(mlJuntas/valor)", unidad: "ml", categoria: "Selladores Pared" },
  { path: "SELLADORES_PARED.cinta_ml_por_rollo", label: "Cinta pared: ml por rollo", default: 22.5, formula: "cintas = ceil(mlJuntas/valor)", unidad: "ml", categoria: "Selladores Pared" },
  { path: "SELLADORES_PARED.membrana_ml_por_rollo", label: "Membrana: ml por rollo", default: 10, formula: "rollos = ceil(perimetro/valor)", unidad: "ml", categoria: "Selladores Pared" },
  { path: "SELLADORES_PARED.espumas_por_rollo_membrana", label: "Espumas PU por rollo membrana", default: 2, formula: "espumas = rollosMembrana*valor", unidad: "unid", categoria: "Selladores Pared" },
];

/** Construir items planos: factores + params de paneles (au, lmin, lmax, ap) */
export function getDimensioningItemsFlat() {
  const pricing = getPricing();
  const formulaOverrides = getDimensioningFormulaOverrides();
  const items = [...FORMULA_FACTORS.map((f) => ({
    path: f.path,
    label: f.label,
    default: f.default,
    formula: formulaOverrides[f.path] ?? f.formula,
    unidad: f.unidad,
    categoria: f.categoria,
    valor: getDimensioningParam(f.path, f.default),
  }))];

  for (const [famId, panel] of Object.entries(pricing.PANELS_TECHO || {})) {
    const basePathT = `PANELS_TECHO.${famId}`;
    items.push({
      path: `${basePathT}.au`,
      label: `${panel.label} — Ancho útil (m)`,
      default: panel.au,
      formula: formulaOverrides[`${basePathT}.au`] ?? "cantPaneles = ceil(ancho/au)",
      unidad: "m",
      categoria: "Paneles Techo",
      valor: getDimensioningParam(`${basePathT}.au`, panel.au),
    });
    items.push({
      path: `${basePathT}.lmin`,
      label: `${panel.label} — Largo mínimo (m)`,
      default: panel.lmin,
      formula: formulaOverrides[`${basePathT}.lmin`] ?? "validación largo panel",
      unidad: "m",
      categoria: "Paneles Techo",
      valor: getDimensioningParam(`${basePathT}.lmin`, panel.lmin),
    });
    items.push({
      path: `${basePathT}.lmax`,
      label: `${panel.label} — Largo máximo (m)`,
      default: panel.lmax,
      formula: formulaOverrides[`${basePathT}.lmax`] ?? "validación largo panel",
      unidad: "m",
      categoria: "Paneles Techo",
      valor: getDimensioningParam(`${basePathT}.lmax`, panel.lmax),
    });
    if (panel.esp) {
      for (const [esp, data] of Object.entries(panel.esp)) {
        if (data && typeof data === "object" && data.ap != null) {
          const apPath = `${basePathT}.esp.${esp}.ap`;
          items.push({
            path: apPath,
            label: `${panel.label} ${esp}mm — Autoportancia máx (m)`,
            default: data.ap,
            formula: formulaOverrides[apPath] ?? "apoyos = ceil(largo/ap)+1",
            unidad: "m",
            categoria: "Paneles Techo",
            valor: getDimensioningParam(apPath, data.ap),
          });
        }
      }
    }
  }

  for (const [famId, panel] of Object.entries(pricing.PANELS_PARED || {})) {
    const basePathP = `PANELS_PARED.${famId}`;
    items.push({
      path: `${basePathP}.au`,
      label: `${panel.label} — Ancho útil (m)`,
      default: panel.au,
      formula: formulaOverrides[`${basePathP}.au`] ?? "cantPaneles = ceil(perimetro/au)",
      unidad: "m",
      categoria: "Paneles Pared",
      valor: getDimensioningParam(`${basePathP}.au`, panel.au),
    });
    items.push({
      path: `${basePathP}.lmin`,
      label: `${panel.label} — Alto mínimo (m)`,
      default: panel.lmin,
      formula: formulaOverrides[`${basePathP}.lmin`] ?? "validación alto panel",
      unidad: "m",
      categoria: "Paneles Pared",
      valor: getDimensioningParam(`${basePathP}.lmin`, panel.lmin),
    });
    items.push({
      path: `${basePathP}.lmax`,
      label: `${panel.label} — Alto máximo (m)`,
      default: panel.lmax,
      formula: formulaOverrides[`${basePathP}.lmax`] ?? "validación alto panel",
      unidad: "m",
      categoria: "Paneles Pared",
      valor: getDimensioningParam(`${basePathP}.lmax`, panel.lmax),
    });
  }

  return items;
}

/** Aplicar overrides desde CSV/JSON importado. updates: { path: number } */
export function applyDimensioningImport(updates) {
  const parsed = {};
  for (const [path, val] of Object.entries(updates)) {
    const n = typeof val === "number" ? val : parseFloat(String(val).replace(",", "."));
    if (!isNaN(n) && n >= 0) parsed[path] = n;
  }
  setDimensioningOverridesBulk(parsed);
  return parsed;
}
