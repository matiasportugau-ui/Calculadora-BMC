/**
 * Wave 2 / N-P7 — coordination monitor for /logistica (not WMS).
 * Pure: filter cola + exception list. Chips already live in coordinationStatus.js.
 */

import { classifyVentasCoordination, normalizeSearchText } from "./coordinationStatus.js";

export const MONITOR_FILTERS = Object.freeze(["all", "por_coordinar", "en_viaje", "entregado"]);

export const MONITOR_FILTER_LABELS = Object.freeze({
  all: "Todas",
  por_coordinar: "Por coordinar",
  en_viaje: "En viaje",
  entregado: "Entregado",
});

export const KINGSPAN_PICKUP_ID = "pickup-kingspan-bromyros";

const CLOCK_RE = /\b(?:[01]?\d|2[0-3])[:hH][0-5]\d\b/;

/**
 * @param {string} text
 * @returns {boolean}
 */
export function hasClockTime(text) {
  return CLOCK_RE.test(String(text || ""));
}

/**
 * @param {object} row mapped Ventas row
 * @returns {boolean}
 */
export function isKingspanPickup(row = {}) {
  const id = String(row.pickupId || row.pickupPointId || "").trim();
  if (id === KINGSPAN_PICKUP_ID) return true;
  const blob = normalizeSearchText(
    `${row.pickupId || ""} ${row.pickupPointId || ""} ${row.estadoText || ""} ${row.rawSheetText || ""}`,
  );
  return /\bkingspan\b|\bbromyros\b/.test(blob);
}

/**
 * Wizard stop (seed ENV / mesa) → monitor row shape.
 * @param {object} stop
 */
export function monitorRowFromStop(stop = {}) {
  return {
    nombre: stop.cliente || stop.nombre || "",
    orderId: stop.orderId || "",
    pdf: String(stop.pdf || stop.pdfLink || "").trim(),
    pickupId: String(stop.pickupPointId || stop.pickupId || "").trim(),
    pickupPointId: String(stop.pickupPointId || "").trim(),
    estadoText: stop.estado || stop.estadoText || "",
    horarioEntrega: stop.horarioEntrega || "",
    rawSheetText: [stop.observacionesLogistica, stop.zona, stop.horarioEntrega].filter(Boolean).join("\n"),
    fechaEntrega: stop.fechaEntrega || "",
  };
}

/**
 * Monitor lane for a Ventas row.
 * @returns {'por_coordinar'|'en_viaje'|'entregado'}
 */
export function monitorLane(row = {}) {
  const n = normalizeSearchText(`${row.estadoText || ""} ${row.estadoGral || ""} ${row.rawSheetText || ""}`);
  if (/\bentregad/.test(n) && !/\bno\s+entregad/.test(n) && !/\bsin\s+entregar/.test(n)) {
    return "entregado";
  }
  if (/\ben\s+viaje\b|\ben\s+transito\b|\ben\s+tr[aá]nsito\b|\ben\s+camino\b/.test(n)) {
    return "en_viaje";
  }
  const chip = row.coordination || classifyVentasCoordination(row);
  if (chip.status === "enviado") return "en_viaje";
  if (chip.status === "por_coordinar") return "por_coordinar";
  // coordinado (has fecha) stays in por_coordinar until left plant / delivered
  return "por_coordinar";
}

/**
 * @param {object[]} rows
 * @param {'all'|'por_coordinar'|'en_viaje'|'entregado'} filter
 */
export function filterRowsByMonitor(rows, filter = "all") {
  const list = Array.isArray(rows) ? rows : [];
  if (!filter || filter === "all") return list;
  return list.filter((r) => monitorLane(r) === filter);
}

/**
 * @param {object} row
 * @returns {Array<{ code: string, label: string }>}
 */
export function exceptionsForRow(row = {}) {
  const out = [];
  if (!String(row.pdf || row.pdfLink || "").trim()) {
    out.push({ code: "pdf_vacio", label: "PDF vacío" });
  }
  const clockBlob = `${row.estadoText || ""} ${row.rawSheetText || ""} ${row.horarioEntrega || ""}`;
  if (isKingspanPickup(row) && !hasClockTime(clockBlob)) {
    out.push({ code: "kingspan_sin_hora", label: "Kingspan sin hora" });
  }
  return out;
}

/**
 * @param {object[]} rows
 * @returns {{ row: object, exceptions: Array<{ code: string, label: string }> }[]}
 */
export function listCoordinationExceptions(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const hits = [];
  for (const row of list) {
    const exceptions = exceptionsForRow(row);
    if (exceptions.length) hits.push({ row, exceptions });
  }
  return hits;
}

/**
 * Counts for filter chips.
 * @param {object[]} rows
 */
export function countMonitorLanes(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const counts = { all: list.length, por_coordinar: 0, en_viaje: 0, entregado: 0 };
  for (const r of list) {
    const lane = monitorLane(r);
    if (counts[lane] != null) counts[lane] += 1;
  }
  return counts;
}
