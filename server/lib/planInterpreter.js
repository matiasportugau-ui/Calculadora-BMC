import { extractVisionJSON } from "./visionExtract.js";

const VISION_SCHEMA = `{
  "techoZonas": [{"largoM": number, "anchoM": number}],
  "footprintPoligono": [[x, y]] | null,
  "tipoAguas": "una_agua" | "dos_aguas" | null,
  "pendienteGrados": number | null,
  "paredAltoM": number | null,
  "paredPerimetroM": number | null,
  "aberturas": [{"anchoM": number, "altoM": number, "cant": number}],
  "escenarioDetectado": "solo_techo" | "techo_fachada" | "solo_fachada" | "camara_frig",
  "confianza": "alta" | "media" | "baja",
  "notas": [string]
}`;

const SYSTEM_PROMPT = `Sos un asistente experto en interpretar planos de obras de construcción para BMC Uruguay, empresa que vende paneles de aislación térmica.
Tu tarea es extraer dimensiones de superficies (techos y paredes) del plano y devolverlas en formato JSON estricto.

REGLAS:
- Extraé todas las zonas de techo que identifiques como rectángulos independientes (con sus largos y anchos en metros)
- Si el contorno del edificio es una sola figura conectada (rectángulo, L, T, U…), devolvé además "footprintPoligono": la lista ordenada de vértices [x, y] del PERÍMETRO en metros, en sentido antihorario, con origen abajo-izquierda (eje Y hacia arriba). Si no podés determinar el perímetro con seguridad, dejá footprintPoligono en null.
- Si hay cotas en el plano, respetá esas medidas exactas
- Si el plano es un DXF, interpretá las entidades DIMENSION y TEXT que contienen medidas
- El tipo de panel (familia, espesor) NO aparece en planos arquitectónicos — no lo inventes
- Las medidas pueden estar en mm en planos técnicos — convertí a metros
- Si no podés determinar una dimensión con seguridad, dejá null
- Respondé SOLO con el JSON válido, sin texto adicional antes ni después

ESQUEMA JSON esperado:
${VISION_SCHEMA}`;

/**
 * Interpreta un plano (imagen/PDF/DXF) usando TODOS los proveedores de IA
 * configurados, con fallback en cadena. Permite elegir proveedor/modelo.
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 * @param {string} filename
 * @param {object} [opts]
 * @param {string} [opts.provider]  proveedor preferido (claude|gemini|openai|grok)
 * @param {string} [opts.model]     modelo específico para ese proveedor
 */
export async function interpretPlan(fileBuffer, mimeType, filename, opts = {}) {
  const { json, provider, providerLabel, model } = await extractVisionJSON({
    system: SYSTEM_PROMPT,
    instruction: "Analizá este plano y devolvé SOLO el JSON con las dimensiones según el esquema indicado.",
    buffer: fileBuffer,
    mimeType,
    filename,
    preferProvider: opts.provider,
    model: opts.model,
  });
  const mapped = mapToBmc(json);
  return { ...mapped, ai: { provider, providerLabel, model } };
}

/**
 * Resuelve el footprint (polígono de huella, m, Y-up) para alimentar la
 * exportación CAD (`server/lib/cad/*`). Prioriza el polígono de la visión;
 * si no, arma un rectángulo cuando hay exactamente una zona.
 * @returns {{ footprint: number[][]|null, source: string|null }}
 */
export function resolveFootprint(extracted, zonas) {
  const poly = extracted?.footprintPoligono;
  if (Array.isArray(poly) && poly.length >= 3) {
    const pts = poly.map(p => [Number(p?.[0]), Number(p?.[1])]);
    // Estricto: si cualquier vértice es inválido, se descarta el polígono entero
    // (descartar vértices sueltos distorsionaría la huella).
    const allValid = pts.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (allValid) return { footprint: pts, source: "vision_polygon" };
  }
  if (Array.isArray(zonas) && zonas.length === 1) {
    const { largo, ancho } = zonas[0];
    if (largo > 0 && ancho > 0) {
      return { footprint: [[0, 0], [largo, 0], [largo, ancho], [0, ancho]], source: "single_rect" };
    }
  }
  return { footprint: null, source: null };
}

export function mapToBmc(extracted) {
  const warnings = [];
  const gaps = ["familia", "espesor"];

  const zonas = (extracted.techoZonas || [])
    .filter(z => z.largoM > 0 && z.anchoM > 0)
    .map(z => ({ largo: +Number(z.largoM).toFixed(2), ancho: +Number(z.anchoM).toFixed(2) }));

  const { footprint, source: footprintSource } = resolveFootprint(extracted, zonas);
  if (!footprint && zonas.length > 1) {
    warnings.push("Múltiples zonas sin polígono de huella — el operador debe definir el perímetro para el plano CAD.");
  }

  if (!extracted.tipoAguas) {
    warnings.push("Tipo de aguas no detectado — se asumió 1 agua");
  }
  if (extracted.confianza === "baja") {
    warnings.push("Confianza baja en la extracción — verificá las dimensiones antes de cotizar");
  } else if (extracted.confianza === "media") {
    warnings.push("Confianza media — revisá que las medidas sean correctas");
  }

  const scenario =
    zonas.length > 0 && extracted.paredPerimetroM ? "techo_fachada"
    : zonas.length > 0 ? "solo_techo"
    : extracted.paredPerimetroM ? "solo_fachada"
    : null;

  if (!scenario) gaps.push("scenario");
  if (zonas.length === 0 && scenario !== "solo_fachada") gaps.push("zonas");

  const techo = zonas.length > 0 ? {
    zonas,
    tipoAguas: extracted.tipoAguas || "una_agua",
    pendiente: extracted.pendienteGrados || 0,
    familia: "",
    espesor: "",
    color: "Blanco",
    tipoEst: "metal",
    borders: {
      frente: "gotero_frontal",
      fondo: "gotero_lateral",
      latIzq: "gotero_lateral",
      latDer: "gotero_lateral",
    },
    opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
  } : null;

  const pared = extracted.paredPerimetroM ? {
    alto: extracted.paredAltoM || 3.5,
    perimetro: +Number(extracted.paredPerimetroM).toFixed(2),
    aberturas: (extracted.aberturas || []).map(a => ({
      ancho: a.anchoM,
      alto: a.altoM,
      cant: a.cant || 1,
    })),
    numEsqExt: 4,
    numEsqInt: 0,
    familia: "",
    espesor: "",
    color: "Blanco",
  } : null;

  return {
    ok: gaps.length === 0,
    bmcPayload: { scenario, techo, pared, footprint, footprintSource },
    gaps,
    warnings,
    extractedRaw: extracted,
  };
}
