import {
  PANELS_TECHO as DEF_PANELS_TECHO,
  PANELS_PARED as DEF_PANELS_PARED,
} from "../data/constants.js";
import { normalizarMedida } from "./calculations.js";

/** @returns {{ largo: number }} */
export function defaultLibrePanelTramo() {
  return { largo: 6 };
}

/** @returns {import("./librePanelDimensions.js").LibrePanelLine} */
export function defaultLibrePanelLine() {
  return {
    familia: "",
    espesor: "",
    color: "Blanco",
    m2: 0,
    inputModo: "dimensiones",
    anchoModo: "paneles",
    panelesAncho: 9,
    anchoM: 0,
    tramos: [defaultLibrePanelTramo()],
  };
}

/**
 * @param {string} familia
 * @param {number|string} espesor
 * @param {object} [catalog]
 */
export function resolveLibrePanelCatalogEntry(familia, espesor, catalog = {}) {
  const PANELS_TECHO = catalog.PANELS_TECHO || DEF_PANELS_TECHO;
  const PANELS_PARED = catalog.PANELS_PARED || DEF_PANELS_PARED;
  const all = { ...PANELS_TECHO, ...PANELS_PARED };
  const panel = all[familia];
  if (!panel) return null;
  const espNum = Number(espesor);
  const espData = panel.esp[espNum] ?? panel.esp[espesor];
  if (!espData) return null;
  return { panel, espData, espNum, au: panel.au };
}

/**
 * Métricas de una línea libre (m² directo o largo × ancho/paneles, con varios largos).
 * @param {object} line
 * @param {object} [catalog]
 */
export function computeLibrePanelLineMetrics(line, catalog = {}) {
  const modo = line?.inputModo === "m2" ? "m2" : line?.inputModo === "dimensiones" ? "dimensiones" : "m2";
  if (modo === "m2" || !line?.inputModo) {
    const m2 = Number(line?.m2) || 0;
    return { m2, totalPaneles: null, tramosDetail: [], mode: "m2", au: null };
  }

  const entry = resolveLibrePanelCatalogEntry(line.familia, line.espesor, catalog);
  if (!entry) {
    return { m2: 0, totalPaneles: 0, tramosDetail: [], mode: "dimensiones", au: null };
  }

  const { panel } = entry;
  const anchoModo = line.anchoModo === "metros" ? "metros" : "paneles";
  const tramos = Array.isArray(line.tramos) && line.tramos.length ? line.tramos : [{ largo: 0 }];

  let cantPanelesAncho = 0;
  let anchoM = 0;
  if (anchoModo === "paneles") {
    cantPanelesAncho = Math.max(1, Math.ceil(Number(line.panelesAncho) || 1));
    anchoM = +(cantPanelesAncho * panel.au).toFixed(2);
  } else {
    anchoM = Number(line.anchoM) || 0;
    const norm = normalizarMedida("metros", anchoM, panel);
    cantPanelesAncho = norm.cantPaneles;
    anchoM = norm.ancho;
  }

  const tramosDetail = [];
  let totalM2 = 0;
  let totalPaneles = 0;

  for (let i = 0; i < tramos.length; i++) {
    const largo = Number(tramos[i]?.largo) || 0;
    if (largo <= 0) continue;
    const areaTramo = +(cantPanelesAncho * largo * panel.au).toFixed(2);
    totalM2 += areaTramo;
    totalPaneles += cantPanelesAncho;
    tramosDetail.push({
      idx: i + 1,
      largo,
      cantPaneles: cantPanelesAncho,
      panelesAncho: cantPanelesAncho,
      anchoM,
      au: panel.au,
      areaM2: areaTramo,
      label: `${cantPanelesAncho} paneles × ${largo.toFixed(2)} m`,
    });
  }

  return {
    m2: +totalM2.toFixed(2),
    totalPaneles: totalPaneles || null,
    tramosDetail,
    mode: "dimensiones",
    au: panel.au,
    panelesAncho: cantPanelesAncho,
    anchoM,
  };
}

/**
 * @param {object} line
 * @param {object} metrics
 * @param {string} baseLabel
 */
export function formatLibrePanelBomLabel(line, metrics, baseLabel) {
  if (!metrics?.tramosDetail?.length) return baseLabel;
  if (metrics.tramosDetail.length === 1) {
    const t = metrics.tramosDetail[0];
    return `${baseLabel} · ${t.cantPaneles} paneles × ${t.largo.toFixed(2)} m`;
  }
  const partes = metrics.tramosDetail.map((t) => `${t.cantPaneles}×${t.largo.toFixed(2)} m`);
  return `${baseLabel} · ${partes.join(" + ")} (${metrics.totalPaneles} paneles)`;
}

/**
 * Normaliza líneas guardadas (compatibilidad con proyectos antiguos solo m²).
 * @param {object} line
 */
export function normalizeLibrePanelLine(line) {
  if (!line || typeof line !== "object") return defaultLibrePanelLine();
  const inputModo = line.inputModo === "dimensiones" ? "dimensiones" : "m2";
  return {
    ...defaultLibrePanelLine(),
    ...line,
    inputModo,
    anchoModo: line.anchoModo === "metros" ? "metros" : "paneles",
    tramos: Array.isArray(line.tramos) && line.tramos.length
      ? line.tramos.map((t) => ({ largo: Number(t?.largo) || 0 }))
      : [defaultLibrePanelTramo()],
  };
}