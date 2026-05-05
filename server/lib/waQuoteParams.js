/**
 * WA Cockpit — extracción heurística de parámetros de cotización desde texto
 * libre del cliente. Devuelve un objeto con confianza por campo.
 *
 * Reglas configurables vía waConfig.js → config.quote.{minM2, defaultWallHeightM, requireFamilyOrThickness}.
 * Si waConfig no está disponible (offline test), usa defaults seguros.
 */

let _quoteCfgGetter = null;
function getQuoteConfig() {
  // Lazy-load para no romper en tests offline.
  if (_quoteCfgGetter === null) {
    _quoteCfgGetter = (async () => {
      try {
        const mod = await import("./waConfig.js");
        return mod.getConfig?.()?.quote;
      } catch {
        return null;
      }
    });
  }
  // Best-effort sync: waConfig.getConfig() es síncrono una vez primed.
  // Si todavía no está primed, usamos defaults inline.
  try {

    return _quoteCfgSync();
  } catch {
    return { minM2: 5, defaultWallHeightM: 3, requireFamilyOrThickness: true };
  }
}

// Para no usar dynamic import sync, mantenemos un require-style accessor.
// Este se inicializa al primer llamado tras que waConfig esté primed.
let _waConfigMod = null;
function _quoteCfgSync() {
  if (!_waConfigMod) {
    // Intento sincrónico: import.meta.resolve no funciona en CJS, así que
    // cacheamos el módulo cuando se importa por primera vez asíncronamente
    // arriba en la app (waConfig se importa al arrancar server/index.js).
    // Si aún no está cacheado, devolvemos defaults.
    return { minM2: 5, defaultWallHeightM: 3, requireFamilyOrThickness: true };
  }
  const cfg = _waConfigMod.getConfig?.()?.quote;
  return cfg || { minM2: 5, defaultWallHeightM: 3, requireFamilyOrThickness: true };
}

/** Bootstrap: llamado por server/index.js tras primeWaConfig. */
export function setWaConfigModuleForQuoteParams(mod) {
  _waConfigMod = mod;
}

const FAM_TECHO = ["isodec_eps", "isodec_pir", "isoroof_3g", "isoroof_foil_3g", "isoroof_plus_3g", "isoroof_colonial"];
const FAM_PARED = ["isopanel_eps", "isodec_eps_pared", "isowall_pir"];

const FAM_ALIASES = {
  "isodec eps": "isodec_eps",
  "isodec pir": "isodec_pir",
  "isoroof 3g": "isoroof_3g",
  "isoroof foil": "isoroof_foil_3g",
  "isoroof plus": "isoroof_plus_3g",
  "isoroof colonial": "isoroof_colonial",
  "isopanel eps": "isopanel_eps",
  "isopanel": "isopanel_eps",
  "isowall pir": "isowall_pir",
  "isowall": "isowall_pir",
  "isodec": "isodec_eps", // ambiguo: por defecto a EPS techo, AI puede confirmar
};

/** Devuelve { metros, espesor, familia, scope, color, lista, confidence } o null si no hay nada útil. */
export function extractQuoteParams(text) {
  const s = String(text || "").toLowerCase();
  if (!s.trim()) return null;

  // m² — formatos: "200m²", "200 m2", "200 metros cuadrados"
  let metros = null;
  const m1 = s.match(/(\d{2,5}(?:[.,]\d{1,2})?)\s*(?:m\s*[2²]|metros?\s+cuad|m\^?2)/i);
  if (m1) metros = Number(String(m1[1]).replace(",", "."));

  // espesor: "100mm" "150 mm" "espesor 80"
  let espesor = null;
  const e1 = s.match(/(\d{2,3})\s*mm\b/i);
  const e2 = s.match(/espesor\s+(?:de\s+)?(\d{2,3})/i);
  if (e1) espesor = Number(e1[1]);
  else if (e2) espesor = Number(e2[1]);

  // familia
  let familia = null;
  for (const [alias, canonical] of Object.entries(FAM_ALIASES)) {
    if (s.includes(alias)) {
      familia = canonical;
      break;
    }
  }

  // scope (techo / pared)
  let scope = null;
  if (/techo|cubierta|tinglado|cumbrera|gotero|cana[ll]?[oó]n/i.test(s)) scope = "techo";
  else if (/pared|fachada|muro|c[aá]mara|frigor[ií]fic/i.test(s)) scope = "pared";
  if (!scope && familia) {
    if (FAM_TECHO.includes(familia)) scope = "techo";
    else if (FAM_PARED.includes(familia)) scope = "pared";
  }

  // color
  let color = null;
  if (/\bblanco\b/.test(s)) color = "Blanco";
  else if (/\bgris\b/.test(s)) color = "Gris";
  else if (/\brojo\b|terracota/.test(s)) color = "Rojo";

  // lista (web|venta) — rara vez el cliente lo dice; default null = web
  let lista = null;
  if (/lista\s+venta|distribuidor/i.test(s)) lista = "venta";
  else if (/lista\s+web|cliente\s+final/i.test(s)) lista = "web";

  // Reglas configurables desde waConfig (config.quote):
  //   - minM2: mínimo m² para considerar quote
  //   - requireFamilyOrThickness: bool — si false, basta m² + scope
  const qcfg = getQuoteConfig();
  const fields = { metros, espesor, familia, scope, color, lista };
  const meetsArea = metros != null && metros >= (qcfg.minM2 || 5);
  const meetsFamilyOrThickness = qcfg.requireFamilyOrThickness !== false
    ? (espesor != null || familia != null)
    : true;
  const minimal = meetsArea && meetsFamilyOrThickness && scope != null;
  if (!minimal) return { ...fields, confidence: 0, ready: false };

  const known = [metros, espesor, familia, scope, color].filter((v) => v != null).length;
  const confidence = Math.min(1, 0.4 + 0.12 * known);
  return { ...fields, confidence, ready: true };
}

/**
 * Convierte los params extraídos al body que espera POST /calc/cotizar.
 * Si scope=techo, arma `techo`; si pared, `pared`. m² se reparten en 1 zona.
 */
export function paramsToCalcBody(params) {
  if (!params || !params.ready) return null;
  const { metros, espesor, familia, scope, color, lista } = params;

  // Asumimos 1 zona cuadrada equivalente al área dada (largo×ancho con largo=ancho=√área)
  // El cotizador acepta zonas; con 1 zona simple alcanza para una estimación inicial.
  const lado = Math.sqrt(Number(metros)) || 1;
  const zona = { largo: Number(lado.toFixed(2)), ancho: Number(lado.toFixed(2)) };

  const body = {
    lista: lista || "web",
    flete: 0,
  };

  if (scope === "techo") {
    body.escenario = "solo_techo";
    body.techo = {
      familia: familia || null,
      espesor: espesor || null,
      color: color || "Blanco",
      zonas: [zona],
    };
  } else if (scope === "pared") {
    const qcfg = getQuoteConfig();
    body.escenario = "solo_fachada";
    body.pared = {
      familia: familia || null,
      espesor: espesor || null,
      color: color || "Blanco",
      perimetro_m: Math.round(4 * lado * 10) / 10,
      altura_m: qcfg.defaultWallHeightM || 3,
    };
  } else {
    return null;
  }

  return body;
}
