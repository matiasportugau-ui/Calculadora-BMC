import { setListaPrecios } from "../../src/data/constants.js";
import { executeScenario } from "../../src/utils/scenarioOrchestrator.js";

const VALID_SCENARIOS = new Set(["solo_techo", "solo_fachada", "techo_fachada", "camara_frig"]);
const VALID_LP = new Set(["web", "venta"]);

function normalizeTecho(t) {
  const raw = t && typeof t === "object" ? t : {};
  return {
    familia: String(raw.familia || ""),
    espesor: raw.espesor != null ? String(raw.espesor) : "",
    color: raw.color || "Blanco",
    tipoAguas: raw.tipoAguas || "una_agua",
    tipoEst: raw.tipoEst || "metal",
    pendiente: Number(raw.pendiente) || 0,
    borders: raw.borders || { frente: "gotero_frontal", fondo: "gotero_lateral", latIzq: "gotero_lateral", latDer: "gotero_lateral" },
    opciones: raw.opciones || { inclCanalon: false, inclGotSup: false, inclSell: true },
    zonas: Array.isArray(raw.zonas) && raw.zonas.length > 0
      ? raw.zonas.map((z) => ({ largo: Number(z.largo) || 0, ancho: Number(z.ancho) || 0 }))
      : [{ largo: Number(raw.largo) || 0, ancho: Number(raw.ancho) || 0 }],
  };
}

function normalizePared(p) {
  const raw = p && typeof p === "object" ? p : {};
  return {
    familia: String(raw.familia || ""),
    espesor: raw.espesor != null ? String(raw.espesor) : "",
    color: raw.color || "Blanco",
    alto: Number(raw.alto) || 3.5,
    perimetro: Number(raw.perimetro) || 0,
    numEsqExt: Number(raw.numEsqExt) >= 0 ? Number(raw.numEsqExt) : 4,
    numEsqInt: Number(raw.numEsqInt) || 0,
    tipoEst: raw.tipoEst || "metal",
    inclSell: raw.inclSell !== false,
    aberturas: Array.isArray(raw.aberturas) ? raw.aberturas : [],
  };
}

function normalizeCamara(c) {
  const raw = c && typeof c === "object" ? c : {};
  return {
    largo_int: Number(raw.largo_int) || 0,
    ancho_int: Number(raw.ancho_int) || 0,
    alto_int: Number(raw.alto_int) || 0,
  };
}

/**
 * Validate a buildQuote payload and run a server-side preview using executeScenario.
 *
 * Returns { valid, errors, preview? }
 * preview: { totalItems, subtotalUSD, totalConIVA, warnings }
 */
export function validateAndPreviewQuote(rawPayload) {
  const p = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
  const errors = [];

  if (!VALID_SCENARIOS.has(p.scenario)) {
    errors.push(`scenario inválido "${p.scenario}". Opciones: ${[...VALID_SCENARIOS].join(" | ")}`);
  }
  if (p.listaPrecios && !VALID_LP.has(p.listaPrecios)) {
    errors.push(`listaPrecios inválida "${p.listaPrecios}". Usar "web" o "venta"`);
  }
  if (errors.length) return { valid: false, errors };

  if (p.listaPrecios) {
    try { setListaPrecios(p.listaPrecios); } catch { /* ignore — pricing might not be switchable server-side */ }
  }

  const techo = normalizeTecho(p.techo);
  const pared = normalizePared(p.pared);
  const camara = normalizeCamara(p.camara);

  let result;
  try {
    result = executeScenario(p.scenario, { techo, pared, camara });
  } catch (err) {
    return { valid: false, errors: [`Error en cálculo: ${err.message}`] };
  }

  if (!result) {
    return {
      valid: false,
      errors: ["El escenario retornó null. Verificá que familia y espesor sean válidos para el escenario elegido."],
    };
  }

  const items = result.allItems || [];
  const totales = result.totales || {};
  const subtotalUSD = Number(totales.subtotalSinIVA) || 0;
  const totalConIVA = Number(totales.totalFinal) || 0;

  if (items.length === 0 || subtotalUSD === 0) {
    return {
      valid: false,
      errors: ["BOM resultó vacío. Verificá que familia y espesor sean válidos para el escenario."],
    };
  }

  return {
    valid: true,
    errors: [],
    preview: {
      totalItems: items.length,
      subtotalUSD: +subtotalUSD.toFixed(2),
      totalConIVA: +totalConIVA.toFixed(2),
      warnings: result.warnings || [],
    },
  };
}
