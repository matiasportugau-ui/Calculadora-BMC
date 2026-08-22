/**
 * Prototype shim — canonical estimators live in src/utils/logistica/loadCharacteristics.js
 * (material m² uses catalog AU, not truck ROW_W).
 */

export { ROW_W } from "./cargoEngine.js";
export {
  kgPerM2ForEspesor,
  estimatePanelLinePhysical,
  estimateStopLoadPhysical,
  estimateRouteLoadPhysical,
} from "../../../../src/utils/logistica/loadCharacteristics.js";
