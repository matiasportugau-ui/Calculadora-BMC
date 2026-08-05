/**
 * Freight quotation engine — SDD-CALCULADORA-FLETES.md
 */

import { PANELS_PARED, PANELS_TECHO, TARIFAS_LOGISTICAS } from "../data/constants.js";
import { uyuToUsdInteger } from "./brouFx.js";
import {
  STANDARD_BED_M,
  LONG_BED_M,
  placeCargo,
  classifyVehicleOccupancy,
} from "./logistica/cargoPacking.js";
import { countPanels } from "./roofPanelStripsPlanta.js";

/** Useful width (m) for panel-count from zone ancho — matches calcPanelesTecho. */
function panelAuForTipo(tipo) {
  const key = String(tipo || "").trim();
  return Number(PANELS_TECHO[key]?.au || PANELS_PARED[key]?.au || 0) || 0;
}

/**
 * Panels across a zone width. dos_aguas mirrors scenarioOrchestrator half-slopes.
 * @param {number} ancho
 * @param {number} au
 * @param {boolean} dosAguas
 */
function cantPanelesForZonaAncho(ancho, au, dosAguas) {
  const w = Math.max(0, Number(ancho) || 0);
  if (!(au > 0) || !(w > 0)) return 0;
  if (dosAguas) {
    const half = +(w / 2).toFixed(2);
    return countPanels(half, au) + countPanels(half, au);
  }
  return countPanels(w, au);
}

/** First BOM panel line with geometry (camara techoResult has no largoReal). */
function panelGeometryFromItems(items) {
  for (const it of Array.isArray(items) ? items : []) {
    const cant = Math.max(0, Math.floor(Number(it?.cantPaneles) || 0));
    const largo = Math.max(0, Number(it?.largoPanel) || 0);
    if (cant > 0 && largo > 0) {
      const sku = String(it.sku || "");
      const m = sku.match(/^([A-Za-z0-9_]+)-(\d+)$/);
      return {
        cant,
        largo,
        tipo: m?.[1] || null,
        espesor: m ? Number(m[2]) || 0 : 0,
      };
    }
  }
  return null;
}

/** @typedef {'retiro'|'ciudad_costa'|'mvd'|'canelones'|'maldonado_corredor'|'especial'} ZonaId */

const RETIRO_RE = /\b(retiro|planta|colonia\s*nicolich|nicolich)\b/i;
const COSTA_RE = /\b(ciudad\s*de\s*la\s*costa|solymar|shangril[aá]|el\s*pinar|lagomar|lomas?\s*de\s*solymar|barrio\s*c[oó]rdoba|colinas\s*de\s*carrasco)\b/i;
const MVD_RE = /\b(montevideo|mvd|pocitos|carrasco|centro|cord[oó]n|buceo|malv[ií]n|prado|cerro)\b/i;
const CANELONES_RE = /\b(canelones|las\s*piedras|pando|toledo|progreso|la\s*paz|santa\s*luc[ií]a|sauce|joanic[oó]|tapia|empalme\s*olmos)\b/i;
const MALDO_RE = /\b(maldonado|piri[aá]polis|san\s*carlos|pan\s*de\s*az[uú]car|punta\s*del\s*este|manantiales|jos[eé]\s*ignacio|balneario\s*buenos\s*aires|sol[ií]s|atl[aá]ntida|parque\s*del\s*plata|la\s*floresta|costa\s*azul|park\s*miramar)\b/i;
const ESPECIAL_RE = /\b(salto|paysand[uú]|tacuaremb[oó]|rivera|artigas|cerro\s*largo|treinta\s*y\s*tres|rocha|florida|durazno|flores|lavalleja|soriano|colonia(?!\s*nicolich)|r[ií]o\s*negro)\b/i;

/**
 * @param {string} text
 * @returns {ZonaId}
 */
export function classifyZona(text) {
  const s = String(text || "").trim();
  if (!s) return "especial";
  if (RETIRO_RE.test(s)) return "retiro";
  if (COSTA_RE.test(s)) return "ciudad_costa";
  if (ESPECIAL_RE.test(s) && !MALDO_RE.test(s) && !MVD_RE.test(s) && !CANELONES_RE.test(s)) {
    return "especial";
  }
  if (MALDO_RE.test(s)) return "maldonado_corredor";
  if (CANELONES_RE.test(s)) return "canelones";
  if (MVD_RE.test(s)) return "mvd";
  // Corridor heuristic: east Canelones / route to Maldonado keywords already in MALDO_RE.
  // Unknown → especial (manual).
  return "especial";
}

/**
 * Build panel lines for packing from calculator state.
 * @param {{ techo?: any, pared?: any, results?: any }} state
 * @returns {Array<{ tipo: string, espesor: number, longitud: number, cantidad: number }>}
 */
export function buildPanelLoadsFromQuote(state = {}) {
  const loads = [];
  const techo = state.techo || {};
  const pared = state.pared || {};
  const results = state.results || {};
  const techoResult = results.techoResult || null;
  const techoResultGeom = panelGeometryFromItems(techoResult?.allItems);

  const techoTipo = String(
    techo.familia || techo.tipo || techoResultGeom?.tipo || results?.panel?.familia || "ISODEC"
  );
  const techoEsp =
    Number(techo.espesor ?? results?.panel?.espesor ?? techoResultGeom?.espesor ?? 0) || 0;
  const zonas = Array.isArray(techo.zonas) ? techo.zonas : [];
  const au = Number(results?.panel?.au || techo.au || 0) || panelAuForTipo(techoTipo);
  let usedFlatPanelesAsRoof = false;

  if (zonas.length) {
    // Never fall back to results.paneles.cantPaneles per zone — that total is
    // shared across all zonas and would N× overstate cargo / freight.
    for (const z of zonas) {
      const largo = Math.max(0, Number(z.largo ?? z.largoPanel) || 0);
      const esp = Math.max(0, Number(z.espesor ?? techoEsp) || 0);
      let cant = Math.max(0, Math.floor(Number(z.cantPaneles ?? z.panelesAncho) || 0));
      if (cant <= 0) {
        const dosAguas = z.dosAguas === true || techo.tipoAguas === "dos_aguas";
        cant = cantPanelesForZonaAncho(z.ancho, au, dosAguas);
      }
      if (cant > 0 && largo > 0 && esp > 0) {
        loads.push({ tipo: techoTipo, espesor: esp, longitud: largo, cantidad: cant });
      }
    }
  } else if (techoResult?.paneles) {
    // camara_frig: ceiling lives on results.techoResult; walls on flat results.paneles
    const cant = Math.max(
      0,
      Math.floor(Number(techoResult.paneles.cantPaneles ?? techoResultGeom?.cant) || 0)
    );
    const largo = Math.max(
      0,
      Number(techoResult.largoReal ?? techoResultGeom?.largo ?? techo.largo ?? 0) || 0
    );
    const esp =
      techoEsp ||
      Math.max(0, Number(techoResultGeom?.espesor || pared.espesor) || 0);
    const tipo = techoResultGeom?.tipo || techoTipo;
    if (cant > 0 && largo > 0 && esp > 0) {
      loads.push({ tipo, espesor: esp, longitud: largo, cantidad: cant });
    }
  } else {
    const hasRoofGeometry =
      techoEsp > 0 &&
      (Boolean(techo.familia || techo.tipo) ||
        Number(results?.largoReal ?? techo.largo) > 0);
    if (hasRoofGeometry) {
      const cant = Math.max(0, Math.floor(Number(results?.paneles?.cantPaneles) || 0));
      const largo = Math.max(0, Number(results?.largoReal ?? techo.largo ?? 0) || 0);
      if (cant > 0 && largo > 0 && techoEsp > 0) {
        loads.push({ tipo: techoTipo, espesor: techoEsp, longitud: largo, cantidad: cant });
        usedFlatPanelesAsRoof = true;
      }
    }
  }

  const paredTipo = String(pared.familia || pared.tipo || "ISOPANEL");
  const paredEsp = Number(pared.espesor || 0) || 0;
  let paredCant = Math.max(
    0,
    Math.floor(Number(results?.paredResult?.paneles?.cantPaneles || pared.cantPaneles) || 0)
  );
  // solo_fachada / camara_frig spread wall counts on results.paneles (no paredResult).
  if (
    !paredCant &&
    !usedFlatPanelesAsRoof &&
    (techoResult?.paneles || !techo.familia)
  ) {
    paredCant = Math.max(0, Math.floor(Number(results?.paneles?.cantPaneles) || 0));
  }
  const paredLargo = Math.max(
    0,
    Number(pared.alto || results?.paredResult?.paneles?.alto || 0) || 0
  );
  if (paredCant > 0 && paredLargo > 0 && paredEsp > 0) {
    loads.push({ tipo: paredTipo, espesor: paredEsp, longitud: paredLargo, cantidad: paredCant });
  }

  return loads;
}

/**
 * Subtotal of quote excluding freight line (USD s/IVA).
 * @param {Array<{ title?: string, items?: Array<{ sku?: string, total?: number }> }>|null} groups
 * @param {number} [fallbackTotal]
 */
export function cotizacionSinFleteFromGroups(groups, fallbackTotal = 0) {
  if (!Array.isArray(groups)) return Math.max(0, Number(fallbackTotal) || 0);
  let sum = 0;
  for (const g of groups) {
    for (const it of g.items || []) {
      if (String(it.sku || "").toUpperCase() === "FLETE") continue;
      if (/flete/i.test(String(it.label || ""))) continue;
      sum += Number(it.total) || 0;
    }
  }
  return Math.max(0, +sum.toFixed(2));
}

/**
 * @param {object} input
 * @param {string} [input.destino] address / depto text
 * @param {boolean} [input.retiroEnPlanta]
 * @param {Array<{ tipo: string, espesor: number, longitud: number, cantidad: number }>} [input.panels]
 * @param {number} [input.cotizacionSinFlete]
 * @param {number|null} [input.fxRateUyuPerUsd] BROU-like rate (UYU per USD)
 * @param {typeof TARIFAS_LOGISTICAS} [input.tarifas]
 */
export function quoteFreight(input = {}) {
  const tarifas = input.tarifas || TARIFAS_LOGISTICAS;
  const destino = String(input.destino || "").trim();
  const zona = input.retiroEnPlanta ? "retiro" : classifyZona(destino);
  const panels = Array.isArray(input.panels) ? input.panels : [];
  const cotizacionSinFlete = Math.max(0, Number(input.cotizacionSinFlete) || 0);
  const fx = input.fxRateUyuPerUsd != null ? Number(input.fxRateUyuPerUsd) : null;

  const summaryBase = {
    zona,
    destino,
    filasUsadas: 0,
    vehicle: null,
    largoMax: 0,
    bedM: STANDARD_BED_M,
    warns: [],
    fxRate: fx,
    mode: "auto",
  };

  if (zona === "retiro") {
    return {
      ok: true,
      mode: "auto",
      ventaUsd: 0,
      costoUsd: 0,
      summary: { ...summaryBase, vehicle: "retiro", label: "Retiro en planta — USD 0" },
    };
  }

  if (zona === "especial") {
    return {
      ok: false,
      mode: "especial",
      ventaUsd: null,
      costoUsd: null,
      summary: {
        ...summaryBase,
        vehicle: "especial",
        label: "Cotización especial — cargar flete a mano",
      },
      error: "zona_especial",
    };
  }

  if (!panels.length && (zona === "maldonado_corredor" || zona === "ciudad_costa")) {
    // Without panels, assume typical 1-row short load for corridor/costa tabular rates.
    summaryBase.warns = ["Sin paneles en cotización — se asume 1 fila ≤8 m"];
  }

  const stops = [{ id: "quote", orden: 1, cliente: "cotizacion", paneles: panels }];
  const pack8 = placeCargo(stops, STANDARD_BED_M, { maxH: tarifas.alturaMaxEstibaM });
  const packLong = placeCargo(stops, LONG_BED_M, { maxH: tarifas.alturaMaxEstibaM });
  const occ = panels.length
    ? classifyVehicleOccupancy(pack8, packLong)
    : {
        vehicle: "estandar_1_fila",
        filasUsadas: 1,
        largoMax: 0,
        bedM: STANDARD_BED_M,
        pack: pack8,
        needsSpecialReview: false,
      };

  summaryBase.filasUsadas = occ.filasUsadas;
  summaryBase.vehicle = occ.vehicle;
  summaryBase.largoMax = occ.largoMax;
  summaryBase.bedM = occ.bedM;
  summaryBase.warns = [...(summaryBase.warns || []), ...(occ.pack?.warns || [])];

  if (occ.needsSpecialReview || occ.vehicle === "especial") {
    return {
      ok: false,
      mode: "especial",
      ventaUsd: null,
      costoUsd: null,
      summary: {
        ...summaryBase,
        label: "No entra en camión estándar/largo — cotización especial",
      },
      error: "no_cabe",
    };
  }

  // ── MVD / Canelones: max(min, %)
  if (zona === "mvd" || zona === "canelones") {
    const z = tarifas.zonas[zona];
    const pct = Math.round(cotizacionSinFlete * (z.pctSobreCotizacionSinFlete || 0.1));
    const ventaUsd = Math.max(z.minimoUsd || 0, pct);
    return {
      ok: true,
      mode: "auto",
      ventaUsd,
      costoUsd: null,
      summary: {
        ...summaryBase,
        label: `${zona === "mvd" ? "Montevideo" : "Canelones"} — max(${z.minimoUsd}, 10% = ${pct}) → USD ${ventaUsd}`,
        cotizacionSinFlete,
      },
    };
  }

  // ── Maldonado corridor / Ciudad de la Costa
  const m = tarifas.zonas.maldonado_corredor;
  const costa = tarifas.zonas.ciudad_costa;
  const isCosta = zona === "ciudad_costa";

  if (occ.vehicle === "estandar_1_fila") {
    const ventaUsd = isCosta ? costa.unaFilaUsd : m.unaFilaUsd;
    return {
      ok: true,
      mode: "auto",
      ventaUsd,
      costoUsd: null,
      summary: {
        ...summaryBase,
        label: `${isCosta ? "Ciudad de la Costa" : "Corredor MVD–Maldonado"} · 1 fila · ≤8 m → USD ${ventaUsd}`,
      },
    };
  }

  if (occ.vehicle === "camion_largo") {
    const ventaUsd = m.camionLargoVentaUsd;
    return {
      ok: true,
      mode: "auto",
      ventaUsd,
      costoUsd: null,
      summary: {
        ...summaryBase,
        label: `Camión 12–14 m → USD ${ventaUsd}`,
      },
    };
  }

  // UYU-based: full truck or remolque
  if (fx == null || !Number.isFinite(fx) || fx <= 0) {
    return {
      ok: false,
      mode: "needs_fx",
      ventaUsd: null,
      costoUsd: null,
      summary: {
        ...summaryBase,
        label: "Falta tipo de cambio BROU del día para convertir UYU→USD",
      },
      error: "needs_fx",
      pendingUyu: occ.vehicle === "remolque"
        ? { ventaUyu: m.remolqueVentaUyu, costoUyu: m.remolqueCostoUyu }
        : {
            ventaUyu: m.camionCompletoCostoUyu + (tarifas.margenCamionCompletoUyu || 3000),
            costoUyu: m.camionCompletoCostoUyu,
          },
    };
  }

  if (occ.vehicle === "remolque") {
    const ventaUsd = uyuToUsdInteger(m.remolqueVentaUyu, fx);
    const costoUsd = uyuToUsdInteger(m.remolqueCostoUyu, fx);
    return {
      ok: true,
      mode: "auto",
      ventaUsd,
      costoUsd,
      summary: {
        ...summaryBase,
        label: `Remolque (>8 m) — venta UYU ${m.remolqueVentaUyu} → USD ${ventaUsd}`,
      },
    };
  }

  // estandar_2_filas
  const ventaUyu = m.camionCompletoCostoUyu + (tarifas.margenCamionCompletoUyu || 3000);
  const ventaUsd = uyuToUsdInteger(ventaUyu, fx);
  const costoUsd = uyuToUsdInteger(m.camionCompletoCostoUyu, fx);
  const factor = isCosta ? costa.factorVsMaldonado || 0.9 : 1;
  const ventaFinal = Math.round(ventaUsd * factor);
  const costoFinal = costoUsd == null ? null : Math.round(costoUsd * factor);

  return {
    ok: true,
    mode: "auto",
    ventaUsd: ventaFinal,
    costoUsd: costoFinal,
    summary: {
      ...summaryBase,
      label: `${isCosta ? "Costa" : "Corredor"} · 2 filas — (costo+margen) → USD ${ventaFinal}`,
    },
  };
}

/**
 * High-level helper for the wizard.
 */
export function quoteFreightFromWizard({
  proyecto,
  techo,
  pared,
  results,
  bomGroups,
  retiroEnPlanta,
  fxRateUyuPerUsd,
  tarifas,
} = {}) {
  const destino = [proyecto?.direccion, proyecto?.departamento, proyecto?.localidad, proyecto?.zona]
    .filter(Boolean)
    .join(" ");
  const panels = buildPanelLoadsFromQuote({ techo, pared, results });
  const cotizacionSinFlete = cotizacionSinFleteFromGroups(bomGroups);
  return quoteFreight({
    destino,
    retiroEnPlanta,
    panels,
    cotizacionSinFlete,
    fxRateUyuPerUsd,
    tarifas,
  });
}
