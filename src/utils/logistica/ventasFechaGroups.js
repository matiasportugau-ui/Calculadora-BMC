/**
 * Group / sort mapped Ventas rows by established delivery date (fecha de reparo).
 * Pure — no fetch. ISO YYYY-MM-DD, local calendar (not UTC).
 */

import { parsePlanillaFechaToIso } from "./ventasSheetMap.js";

export const SIN_FECHA_KEY = "sin-fecha";

/**
 * Local calendar YYYY-MM-DD.
 * @param {Date} [d]
 * @returns {string}
 */
export function localDateIso(d = new Date()) {
  const dt = d instanceof Date && !Number.isNaN(d.getTime()) ? d : new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Established repair/delivery date on a mapped Ventas row.
 * @param {object} row
 * @returns {string} ISO or ""
 */
export function rowFechaRepartoIso(row = {}) {
  const a = String(row?.fechaEntrega || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(a)) return a;
  const b = String(row?.coordination?.coordDateIso || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(b)) return b;
  return parsePlanillaFechaToIso(a) || parsePlanillaFechaToIso(b) || "";
}

function cmpText(a, b) {
  return String(a || "").localeCompare(String(b || ""), "es", { numeric: true, sensitivity: "base" });
}

/**
 * Dated rows first (ISO ascending), undated last. Same date: sheet row → orderId → name.
 * @param {object[]} rows
 * @returns {object[]}
 */
export function sortVentasRowsChronological(rows) {
  const list = Array.isArray(rows) ? [...rows] : [];
  list.sort((a, b) => {
    const ia = rowFechaRepartoIso(a);
    const ib = rowFechaRepartoIso(b);
    if (ia && ib && ia !== ib) return ia < ib ? -1 : 1;
    if (ia && !ib) return -1;
    if (!ia && ib) return 1;
    const ra = Number(a?.ventasSheetRow1Based) || 0;
    const rb = Number(b?.ventasSheetRow1Based) || 0;
    if (ra && rb && ra !== rb) return ra - rb;
    const oid = cmpText(a?.orderId, b?.orderId);
    if (oid) return oid;
    return cmpText(a?.nombre, b?.nombre);
  });
  return list;
}

function titleWeekday(iso) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const raw = d.toLocaleDateString("es-UY", { weekday: "short" }).replace(/\.$/, "");
  if (!raw) return "";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function ddmm(iso) {
  const parts = String(iso).split("-");
  if (parts.length < 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}

/**
 * @param {string} iso
 * @param {Date} [now]
 * @returns {string}
 */
export function formatFechaRepartoLabel(iso, now = new Date()) {
  if (!iso) return "Sin fecha de entrega";
  const today = localDateIso(now);
  const t = new Date(`${today}T12:00:00`);
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const diffDays = Math.round((d.getTime() - t.getTime()) / 86400000);
  const dm = ddmm(iso);
  if (diffDays === 0) return `Hoy · ${dm}`;
  if (diffDays === -1) return `Ayer · ${dm}`;
  if (diffDays === 1) return `Mañana · ${dm}`;
  const wd = titleWeekday(iso);
  const year = d.getFullYear() !== now.getFullYear() ? `/${d.getFullYear()}` : "";
  return `${wd ? `${wd} ` : ""}${dm}${year}`;
}

/**
 * @param {object[]} rows mapped Ventas rows
 * @param {{ now?: Date }} [opts]
 * @returns {{
 *   key: string,
 *   iso: string,
 *   label: string,
 *   count: number,
 *   overdue: boolean,
 *   today: boolean,
 *   rows: object[],
 * }[]}
 */
export function groupVentasRowsByFechaReparto(rows, opts = {}) {
  const now = opts.now instanceof Date && !Number.isNaN(opts.now.getTime()) ? opts.now : new Date();
  const today = localDateIso(now);
  const sorted = sortVentasRowsChronological(rows);
  const map = new Map();
  for (const row of sorted) {
    const iso = rowFechaRepartoIso(row);
    const key = iso || SIN_FECHA_KEY;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  const groups = [];
  for (const [key, groupRows] of map) {
    const iso = key === SIN_FECHA_KEY ? "" : key;
    groups.push({
      key,
      iso,
      label: formatFechaRepartoLabel(iso, now),
      count: groupRows.length,
      overdue: Boolean(iso && iso < today),
      today: iso === today,
      rows: groupRows,
    });
  }
  return groups;
}

/**
 * @param {ReturnType<typeof groupVentasRowsByFechaReparto>} groups
 */
export function countFechaGroupBuckets(groups) {
  let overdue = 0;
  let today = 0;
  let upcoming = 0;
  let undated = 0;
  for (const g of groups || []) {
    const n = Number(g?.count) || 0;
    if (!g?.iso) undated += n;
    else if (g.overdue) overdue += n;
    else if (g.today) today += n;
    else upcoming += n;
  }
  return { overdue, today, upcoming, undated };
}

/**
 * First group key per jump chip.
 * @param {ReturnType<typeof groupVentasRowsByFechaReparto>} groups
 */
export function fechaGroupJumpTargets(groups) {
  const list = Array.isArray(groups) ? groups : [];
  return {
    overdue: list.find((g) => g.overdue)?.key || "",
    today: list.find((g) => g.today)?.key || "",
    upcoming: list.find((g) => g.iso && !g.overdue && !g.today)?.key || "",
    undated: list.find((g) => !g.iso)?.key || "",
  };
}
