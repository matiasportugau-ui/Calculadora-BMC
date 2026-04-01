/**
 * Constantes y claves estables para carga / layout manual (BMC Logística).
 * Preparado para futura fase drag/drop (MANUAL_LAYOUT_VERSION).
 */

export const MAX_H = 2.5;
export const MANUAL_LAYOUT_VERSION = 1;

export function panelStableKey(stopId, panelId, chunkIdx) {
  return `${stopId}:panel:${panelId}:${chunkIdx}`;
}

export function accessoryStableKey(stopId) {
  return `${stopId}:accessory`;
}
