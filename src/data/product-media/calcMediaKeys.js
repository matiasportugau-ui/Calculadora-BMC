import { BORDER_OPTIONS, PANELS_TECHO, PANELS_PARED, FIJACIONES, SELLADORES, HERRAMIENTAS } from "../constants.js";
export const BORDER_FAMILIA_CHIPS = ["ISODEC", "ISODEC_PIR", "ISOROOF", "ISOROOF_COLONIAL"];
export function listBorderMediaKeys() {
  const ids = new Set(); const labels = {};
  for (const side of Object.keys(BORDER_OPTIONS || {})) {
    for (const o of BORDER_OPTIONS[side] || []) {
      if (!o?.id || o.id === "none") continue;
      ids.add(o.id); if (!labels[o.id]) labels[o.id] = o.label || o.id;
    }
  }
  return [...ids].sort().map((id) => ({ domain: "borders", key: id, label: labels[id] || id, supportsFamilia: true }));
}
export function listPanelMediaKeys() {
  return Object.entries({ ...PANELS_TECHO, ...PANELS_PARED }).map(([key, p]) => ({ domain: "panels", key, label: p?.label || key, supportsFamilia: false }));
}
export function listFijacionMediaKeys() {
  return Object.entries({ ...FIJACIONES, ...(HERRAMIENTAS || {}) }).map(([key, row]) => ({ domain: "fijaciones", key, label: row?.label || key, supportsFamilia: false }));
}
export function listSelladorMediaKeys() {
  return Object.entries(SELLADORES || {}).map(([key, row]) => ({ domain: "selladores", key, label: row?.label || key, supportsFamilia: false }));
}
export function listAllMediaKeys() {
  return [...listBorderMediaKeys(), ...listPanelMediaKeys(), ...listFijacionMediaKeys(), ...listSelladorMediaKeys()];
}
