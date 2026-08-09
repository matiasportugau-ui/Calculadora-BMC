/**
 * Nº de Reparto interno: REP-YYYY-MM-DD-NNN
 */
import { montevideoYmd } from "../quotationNaming.js";

const REP_RE = /^REP-(\d{4})-(\d{2})-(\d{2})-(\d{3})$/;

/**
 * @param {string|Date} [date]
 * @returns {string} YYYY-MM-DD UY
 */
export function repartoDateKey(date = new Date()) {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return montevideoYmd(date instanceof Date ? date : new Date());
}

/**
 * Calendar day from a Postgres DATE / YYYY-MM-DD value.
 * node-pg returns DATE as JS Date at UTC midnight for that calendar day —
 * do NOT run those through Montevideo wall-clock (shifts day near UTC midnight).
 * @param {string|Date|null|undefined} value
 * @returns {string|null} YYYY-MM-DD or null if unusable
 */
export function calendarDateKeyFromDb(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
    if (m) return m[1];
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

/**
 * @param {string} ymd
 * @param {number} seq 1-based
 */
export function formatRepartoNo(ymd, seq) {
  const day = repartoDateKey(ymd);
  const n = Math.max(1, Math.min(999, Math.floor(Number(seq) || 1)));
  return `REP-${day}-${String(n).padStart(3, "0")}`;
}

/**
 * @param {string} repartoNo
 * @returns {{ ymd: string, seq: number } | null}
 */
export function parseRepartoNo(repartoNo) {
  const m = REP_RE.exec(String(repartoNo || "").trim().toUpperCase());
  if (!m) return null;
  return { ymd: `${m[1]}-${m[2]}-${m[3]}`, seq: Number(m[4]) };
}

/**
 * Next sequence from existing list of reparto_no for a day.
 * @param {string[]} existingNos
 * @param {string} [ymd]
 */
export function nextRepartoSeq(existingNos = [], ymd = repartoDateKey()) {
  const day = repartoDateKey(ymd);
  let max = 0;
  for (const no of existingNos || []) {
    const p = parseRepartoNo(no);
    if (p && p.ymd === day && p.seq > max) max = p.seq;
  }
  return max + 1;
}

/**
 * @param {string[]} existingNos
 * @param {string} [ymd]
 */
export function allocateRepartoNo(existingNos = [], ymd = repartoDateKey()) {
  const day = repartoDateKey(ymd);
  const seq = nextRepartoSeq(existingNos, day);
  return formatRepartoNo(day, seq);
}
