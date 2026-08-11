/**
 * projectLibreReset.js — normalize libre/manual BOM UI state when loading a project.
 *
 * Bug DQ: applyDeserializedProject used `if (state.libre*)` guards, so loading a
 * .bmc.json without libre fields left prior-session librePanelLines / qty maps in
 * React state. Those lines merge into BOM for every non-libre scenario via
 * additiveLibreGroups → silent USD inflation after Drive / openBmc import.
 */

import {
  defaultLibrePanelLine,
  normalizeLibrePanelLine,
} from "./librePanelDimensions.js";

export const DEFAULT_LIBRE_ACC = Object.freeze({
  paneles: true,
  perfileria: false,
  tornilleria: false,
  selladores: false,
  servicios: false,
  extraordinarios: false,
});

export const DEFAULT_LIBRE_EXTRA = Object.freeze({
  texto: "",
  precio: "",
  unidades: "",
  cantidad: "",
});

/**
 * Build a full libre UI reset from deserialized project state.
 * Always returns defined fields suitable for unconditional setters.
 *
 * @param {object} [state] — output of deserializeProject (or budget snapshot)
 * @returns {{
 *   libreAcc: object,
 *   librePanelLines: object[],
 *   librePerfilQty: object,
 *   libreFijQty: object,
 *   libreSellQty: object,
 *   libreExtra: object,
 *   librePerfilFilter: string,
 * }}
 */
export function buildLibreUiStateFromDeserialized(state = {}) {
  const acc =
    state.libreAcc &&
    typeof state.libreAcc === "object" &&
    !Array.isArray(state.libreAcc) &&
    Object.keys(state.libreAcc).length > 0
      ? { ...DEFAULT_LIBRE_ACC, ...state.libreAcc }
      : { ...DEFAULT_LIBRE_ACC };

  const lines =
    Array.isArray(state.librePanelLines) && state.librePanelLines.length > 0
      ? state.librePanelLines.map(normalizeLibrePanelLine)
      : [defaultLibrePanelLine()];

  const qtyOrEmpty = (v) =>
    v && typeof v === "object" && !Array.isArray(v) ? { ...v } : {};

  const extra =
    state.libreExtra &&
    typeof state.libreExtra === "object" &&
    !Array.isArray(state.libreExtra)
      ? { ...DEFAULT_LIBRE_EXTRA, ...state.libreExtra }
      : { ...DEFAULT_LIBRE_EXTRA };

  return {
    libreAcc: acc,
    librePanelLines: lines,
    librePerfilQty: qtyOrEmpty(state.librePerfilQty),
    libreFijQty: qtyOrEmpty(state.libreFijQty),
    libreSellQty: qtyOrEmpty(state.libreSellQty),
    libreExtra: extra,
    librePerfilFilter:
      typeof state.librePerfilFilter === "string" ? state.librePerfilFilter : "",
  };
}
