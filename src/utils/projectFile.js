// ═══════════════════════════════════════════════════════════════════════════
// src/utils/projectFile.js — Serialize / deserialize calculator state
// Format: .bmc.json (Panelin BMC project file)
// ═══════════════════════════════════════════════════════════════════════════

const FILE_FORMAT_VERSION = 1;
const APP_VERSION = "3.1.0";

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
      tipoCliente: "empresa", nombre: "", rut: "", telefono: "",
      direccion: "", descripcion: "", refInterna: "",
      fecha: new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" }),
    },
    techo: {
      familia: "", espesor: "", color: "Blanco",
      zonas: [{ largo: 6.0, ancho: 5.0 }],
      pendiente: 0, tipoAguas: "una_agua", tipoEst: "metal", ptsHorm: 0,
      borders: { frente: "gotero_frontal", fondo: "gotero_lateral", latIzq: "gotero_lateral", latDer: "gotero_lateral" },
      opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
    },
    pared: {
      familia: "", espesor: "", color: "Blanco",
      alto: 3.5, perimetro: 40, numEsqExt: 4, numEsqInt: 0,
      aberturas: [], tipoEst: "metal", inclSell: true, incl5852: false,
    },
    camara: { largo_int: 6, ancho_int: 4, alto_int: 3 },
    flete: 280,
    overrides: {},
    excludedItems: {},
    categoriasActivas: {},
    techoAnchoModo: "metros",
  };

  return {
    _meta: data._meta || {},
    scenario: data.scenario || defaults.scenario,
    listaPrecios: data.listaPrecios || defaults.listaPrecios,
    proyecto: { ...defaults.proyecto, ...(data.proyecto || {}) },
    techo: { ...defaults.techo, ...(data.techo || {}) },
    pared: { ...defaults.pared, ...(data.pared || {}) },
    camara: { ...defaults.camara, ...(data.camara || {}) },
    flete: data.flete ?? defaults.flete,
    overrides: data.overrides || defaults.overrides,
    excludedItems: data.excludedItems || defaults.excludedItems,
    categoriasActivas: data.categoriasActivas || defaults.categoriasActivas,
    techoAnchoModo: data.techoAnchoModo || defaults.techoAnchoModo,
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
