// ═══════════════════════════════════════════════════════════════════════════
// src/utils/projectFile.js — Serialize / deserialize calculator state
// Format: .bmc.json (Panelin BMC project file)
// ═══════════════════════════════════════════════════════════════════════════

import { CATEGORIAS_BOM } from "../data/constants.js";

const FILE_FORMAT_VERSION = 1;
const APP_VERSION = "3.1.2";

/**
 * Serialize the full calculator state into a .bmc.json object.
 * This captures everything needed to restore the form exactly.
 */
export function serializeProject({
  scenario,
  listaPrecios,
  proyecto,
  techo,
  pared,
  camara,
  flete,
  overrides,
  excludedItems,
  categoriasActivas,
  techoAnchoModo,
  quotationCode,
  libreAcc,
  librePanelLines,
  librePerfilQty,
  libreFijQty,
  libreSellQty,
  libreExtra,
  librePerfilFilter,
}) {
  return {
    _meta: {
      formatVersion: FILE_FORMAT_VERSION,
      appVersion: APP_VERSION,
      savedAt: new Date().toISOString(),
      quotationCode: quotationCode || null,
    },
    scenario,
    listaPrecios,
    proyecto,
    techo,
    pared,
    camara,
    flete,
    overrides: overrides || {},
    excludedItems: excludedItems || {},
    categoriasActivas: categoriasActivas || {},
    techoAnchoModo: techoAnchoModo || "metros",
    libreAcc: libreAcc || undefined,
    librePanelLines: librePanelLines || undefined,
    librePerfilQty: librePerfilQty || undefined,
    libreFijQty: libreFijQty || undefined,
    libreSellQty: libreSellQty || undefined,
    libreExtra: libreExtra || undefined,
    librePerfilFilter: librePerfilFilter || undefined,
  };
}

/**
 * Deserialize a .bmc.json object back into calculator state fields.
 * Returns a flat object with every state key, using safe defaults.
 */
export function deserializeProject(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Archivo de proyecto inválido");
  }

  const defaults = {
    scenario: "solo_techo",
    listaPrecios: "web",
    proyecto: {
      tipoCliente: "empresa", nombre: "", rut: "", razonSocial: "", telefono: "",
      direccion: "", descripcion: "", refInterna: "", contactoRef: "",
      fecha: new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" }),
    },
    techo: {
      familia: "", espesor: "", color: "Blanco",
      zonas: [{ largo: 6.0, ancho: 5.0, dosAguas: false }],
      pendiente: 0, tipoAguas: "una_agua", tipoEst: "metal", ptsHorm: 0,
      borders: { frente: "gotero_frontal", fondo: "gotero_lateral", latIzq: "gotero_lateral", latDer: "gotero_lateral" },
      bordesExtendido: false,
      bordesCualquierFamilia: false,
      opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
    },
    pared: {
      familia: "", espesor: "", color: "Blanco",
      alto: 3.5, perimetro: 40, numEsqExt: 4, numEsqInt: 0,
      aberturas: [], tipoEst: "metal", inclSell: true, incl5852: false,
      inclCintaButilo: false, inclSilicona300Neutra: false,
    },
    camara: { largo_int: 6, ancho_int: 4, alto_int: 3 },
    flete: 280,
    overrides: {},
    excludedItems: {},
    categoriasActivas: {},
    techoAnchoModo: "metros",
    libreAcc: null,
    librePanelLines: null,
    librePerfilQty: null,
    libreFijQty: null,
    libreSellQty: null,
    libreExtra: null,
    librePerfilFilter: null,
  };

  const categoriasBase = {};
  try {
    Object.keys(CATEGORIAS_BOM).forEach((k) => {
      categoriasBase[k] = CATEGORIAS_BOM[k].default;
    });
  } catch {
    /* sin constants en entorno de test */
  }

  return {
    _meta: data._meta || {},
    scenario: data.scenario || defaults.scenario,
    listaPrecios: data.listaPrecios || defaults.listaPrecios,
    proyecto: { ...defaults.proyecto, ...(data.proyecto || {}) },
    techo: (() => {
      let rawTecho = { ...defaults.techo, ...(data.techo || {}) };
      // Migrate legacy projects with global tipoAguas="dos_aguas" → set dosAguas on each zone
      if (rawTecho.tipoAguas === "dos_aguas") {
        rawTecho = { ...rawTecho, zonas: (rawTecho.zonas || []).map(z => ({ ...z, dosAguas: true })) };
      }
      return rawTecho;
    })(),
    pared: { ...defaults.pared, ...(data.pared || {}) },
    camara: { ...defaults.camara, ...(data.camara || {}) },
    flete: data.flete ?? defaults.flete,
    overrides: data.overrides || defaults.overrides,
    excludedItems: data.excludedItems || defaults.excludedItems,
    categoriasActivas: { ...categoriasBase, ...(data.categoriasActivas || {}) },
    techoAnchoModo: data.techoAnchoModo || defaults.techoAnchoModo,
    libreAcc: { ...defaults.libreAcc, ...(data.libreAcc && typeof data.libreAcc === "object" ? data.libreAcc : {}) },
    librePanelLines: Array.isArray(data.librePanelLines) && data.librePanelLines.length > 0
      ? data.librePanelLines
      : defaults.librePanelLines,
    librePerfilQty: data.librePerfilQty && typeof data.librePerfilQty === "object" ? data.librePerfilQty : defaults.librePerfilQty,
    libreFijQty: data.libreFijQty && typeof data.libreFijQty === "object" ? data.libreFijQty : defaults.libreFijQty,
    libreSellQty: data.libreSellQty && typeof data.libreSellQty === "object" ? data.libreSellQty : defaults.libreSellQty,
    libreExtra: { ...defaults.libreExtra, ...(data.libreExtra && typeof data.libreExtra === "object" ? data.libreExtra : {}) },
    librePerfilFilter: typeof data.librePerfilFilter === "string" ? data.librePerfilFilter : defaults.librePerfilFilter,
  };
}

/**
 * Convert a project object to a downloadable Blob.
 */
export function projectToBlob(projectData) {
  return new Blob(
    [JSON.stringify(projectData, null, 2)],
    { type: "application/json" },
  );
}

/**
 * Parse a .bmc.json file (File object or string) into deserialized state.
 */
export async function parseProjectFile(fileOrString) {
  let text;
  if (typeof fileOrString === "string") {
    text = fileOrString;
  } else if (fileOrString instanceof Blob) {
    text = await fileOrString.text();
  } else {
    throw new Error("Entrada no válida para parseProjectFile");
  }

  const raw = JSON.parse(text);

  if (raw.snapshot && raw.id) {
    return deserializeProject(raw.snapshot);
  }

  return deserializeProject(raw);
}

/**
 * Build the filename for a .bmc.json project file.
 */
export function projectFileName(quotationCode, clientName) {
  const safe = (clientName || "proyecto").replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _-]/g, "").trim().slice(0, 40);
  return `${quotationCode || "BMC"} — ${safe}.bmc.json`;
}

/**
 * Build the filename for the PDF.
 */
export function pdfFileName(quotationCode, clientName) {
  const safe = (clientName || "cotización").replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _-]/g, "").trim().slice(0, 40);
  return `Cotización ${quotationCode || "BMC"} — ${safe}.pdf`;
}
