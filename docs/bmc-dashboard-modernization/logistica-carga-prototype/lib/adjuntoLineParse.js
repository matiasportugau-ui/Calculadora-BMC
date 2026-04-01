/**
 * Extrae líneas de paneles y accesorios desde texto pegado (PDF / cotización / tabla copiada).
 * Sin fetch ni OCR: el operador copia el texto o la tabla desde el adjunto.
 */

import { ESPS, LENS, TIPOS } from "./cargoEngine.js";
import { parseTsvRows } from "./sheetPaste.js";

const ESP_SET = new Set(ESPS.map(Number));
const LENS_NUM = LENS.map(Number);

function snapLen(x) {
  const n = Number(String(x ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return 6;
  let best = LENS_NUM[0];
  let bestD = Math.abs(best - n);
  for (const L of LENS_NUM) {
    const d = Math.abs(L - n);
    if (d < bestD) {
      best = L;
      bestD = d;
    }
  }
  return best;
}

function snapEsp(x) {
  const n = Math.round(Number(String(x ?? "").replace(",", ".")));
  if (ESP_SET.has(n)) return n;
  let best = ESPS[0];
  let bestD = Math.abs(best - n);
  for (const e of ESPS) {
    const d = Math.abs(e - n);
    if (d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

/**
 * Entero de cantidad desde celda de planilla (uds / bultos / número suelto).
 * @param {string|number|null|undefined} raw
 * @returns {number|null}
 */
export function parseQtyCell(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const m1 = s.match(/\b(\d{1,5})\s*(?:uds?\.?|unidades?|bultos?|planchas?|paneles?|piezas?|pzas?|und\.?|u\.)\b/i);
  if (m1) return Math.min(99999, Math.max(1, parseInt(m1[1], 10)));
  const m2 = s.match(/(?:^|[\s:;,-])(\d{1,5})\s*$/);
  if (m2) return Math.min(99999, Math.max(1, parseInt(m2[1], 10)));
  const digits = s.replace(/[^\d]/g, "");
  if (digits.length >= 1 && digits.length <= 5) {
    const n = parseInt(digits, 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(99999, n);
  }
  return null;
}

/** Cantidad al final de celda producto: "… 12 uds" / "… 8 bultos". */
function extractTrailQtyFromProductCell(text) {
  const s = String(text || "").trim();
  if (!s) return null;
  const m = s.match(/\b(\d{1,5})\s*(?:uds?\.?|unidades?|bultos?|planchas?|paneles?|piezas?)\s*$/i);
  if (m) return Math.min(99999, Math.max(1, parseInt(m[1], 10)));
  return null;
}

/**
 * @param {string} text
 * @returns {string}
 */
export function extractTipoFromLine(text) {
  const u = String(text || "").toUpperCase();
  if (/\bISOFRIG(?:\s|_)?PIR\b/.test(u) || /\bISOFRIG_PIR\b/.test(u)) return "ISOFRIG_PIR";
  if (/\bISOFRIG\b/.test(u)) return "ISOFRIG";
  if (/\bISOWALL\b/.test(u)) return "ISOWALL";
  if (/\bISOROOF\b/.test(u)) return "ISOROOF";
  if (/\bISOPANEL\b/.test(u)) return "ISOPANEL";
  if (/\bISODEC\b/.test(u)) return "ISODEC";
  return "";
}

function isTipoValid(t) {
  return TIPOS.includes(t);
}

/**
 * @param {string} line
 * @returns {{ tipo: string, espesor: number, longitud: number, cantidad: number } | null}
 */
export function parsePanelLineHeuristic(line) {
  let raw = String(line || "").trim();
  if (!raw || /^https?:\/\//i.test(raw)) return null;

  let qtyLead = null;
  const leadQty = raw.match(/^(\d+)\s*[x×]\s+/i);
  if (leadQty) {
    qtyLead = Math.max(1, parseInt(leadQty[1], 10));
    raw = raw.slice(leadQty[0].length).trim();
  }

  const tipo = extractTipoFromLine(raw);
  if (!tipo || !isTipoValid(tipo)) return null;

  const numMatches = [...raw.matchAll(/\d+(?:[.,]\d+)?/g)];
  const nums = numMatches.map((m) => parseFloat(m[0].replace(",", "."))).filter((n) => Number.isFinite(n));
  if (nums.length < 1) return null;

  let espesor = null;
  for (const n of nums) {
    const r = Math.round(n);
    if (Math.abs(n - r) < 0.01 && ESP_SET.has(r)) {
      espesor = r;
      break;
    }
  }
  if (espesor == null) return null;

  const lenCand = nums.filter((n) => {
    const r = Math.round(n);
    if (Math.abs(n - r) < 0.01 && r === espesor) return false;
    return n >= 2 && n <= 14.5;
  });
  const longitud = lenCand.length ? snapLen(lenCand[0]) : 6;

  let cantidad = qtyLead != null ? qtyLead : 1;
  const xm = raw.match(/[x×]\s*(\d+)\b/i);
  const qtyExplicit =
    raw.match(/\b(?:cant\.?|cantidad|qty|bultos?)\s*[:=]\s*(\d{1,5})\b/i) ||
    raw.match(/\b(\d{1,5})\s*(?:bultos?|uds\.?|unidades?|planchas?|paneles?|piezas?)\b/i);
  if (qtyLead == null && qtyExplicit) {
    cantidad = Math.max(1, parseInt(qtyExplicit[1], 10));
  } else if (qtyLead == null && xm) {
    cantidad = Math.max(1, parseInt(xm[1], 10));
  } else if (qtyLead == null) {
    const uds = raw.match(/\b(\d+)\s*(?:uds?\.?|unidades?|planchas?|paneles?|bultos?|piezas?)\b/i);
    if (uds) cantidad = Math.max(1, parseInt(uds[1], 10));
    else {
      const tailInts = nums.filter((n) => {
        const r = Math.round(n);
        if (Math.abs(n - r) >= 0.01) return false;
        if (r === espesor) return false;
        if (lenCand.length && Math.abs(n - lenCand[0]) < 0.01 && n >= 2 && n <= 14) return false;
        return r >= 1 && r <= 999;
      });
      if (tailInts.length) cantidad = Math.max(1, Math.round(tailInts[tailInts.length - 1]));
    }
  }

  return { tipo, espesor: snapEsp(espesor), longitud, cantidad };
}

function normCell(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

/**
 * @param {string[]} headers
 * @returns {Record<string, number>}
 */
function mapHeaderIndices(headers) {
  const idx = {};
  headers.forEach((h, i) => {
    const n = normCell(h);
    if (!n) return;
    if (/^(producto|descripcion|item|linea|panel)/.test(n) || n.includes("producto")) idx.producto = i;
    if (/^tipo$/.test(n) || n === "familia") idx.tipoCol = i;
    if (n.includes("espesor") || n === "esp") idx.espesor = i;
    if (n.includes("largo") || n.includes("longitud") || n === "l m" || n === "largo m") idx.largo = i;
    if (
      idx.cantidad == null &&
      (/^(cant\.?|cantidad|qty|bultos?|uds\.?|unidades?|planchas?|paneles?|piezas?|pzas?|#)$/.test(n) ||
        /^(n|nº|num|numero)\s*\.?\s*(bultos|uds|unidades|planchas|paneles|piezas)/i.test(n) ||
        (/\b(cant|qty|bultos?|uds)\b/i.test(n) && !/fabric|direccion|observ|ubicacion|cliente/i.test(n)))
    ) {
      idx.cantidad = i;
    }
  });
  return idx;
}

/**
 * @param {string} text
 * @returns {{ paneles: Array<{ tipo: string, espesor: number, longitud: number, cantidad: number }>, accesorios: Array<{ descr: string, cantidad: number }>, warnings: string[] }}
 */
export function parseLogisticaFromAdjuntoText(text) {
  const warnings = [];
  const paneles = [];
  const accesorios = [];
  const raw = String(text || "").trim();
  if (!raw) {
    warnings.push("Sin texto para analizar.");
    return { paneles, accesorios, warnings };
  }

  const rows = parseTsvRows(raw);
  if (rows.length >= 2) {
    const hmap = mapHeaderIndices(rows[0]);
    const hasTable =
      (hmap.producto != null || hmap.tipoCol != null) &&
      (hmap.espesor != null || hmap.largo != null || hmap.cantidad != null);
    if (hasTable) {
      for (let r = 1; r < rows.length; r++) {
        const cells = rows[r];
        if (!cells.some((c) => String(c || "").trim())) continue;
        const prodCell = hmap.producto != null ? cells[hmap.producto] : cells.join(" ");
        const tipoCell = hmap.tipoCol != null ? cells[hmap.tipoCol] : prodCell;
        const tipo = extractTipoFromLine(tipoCell) || extractTipoFromLine(prodCell);
        const espRaw = hmap.espesor != null ? cells[hmap.espesor] : "";
        const largoRaw = hmap.largo != null ? cells[hmap.largo] : "";
        const cantRaw = hmap.cantidad != null ? cells[hmap.cantidad] : "";

        if (tipo && isTipoValid(tipo)) {
          const espN = parseFloat(String(espRaw).replace(",", "."));
          const largoN = parseFloat(String(largoRaw).replace(",", "."));
          let cantN = parseQtyCell(cantRaw);
          if (cantN == null) cantN = extractTrailQtyFromProductCell(String(prodCell || ""));
          if (cantN == null && prodCell) {
            const ph0 = parsePanelLineHeuristic(String(prodCell).replace(/\t/g, " ").trim());
            if (ph0 && ph0.tipo === tipo) cantN = ph0.cantidad;
          }
          const espesor = Number.isFinite(espN) ? snapEsp(espN) : null;
          if (espesor != null && ESP_SET.has(espesor)) {
            paneles.push({
              tipo,
              espesor,
              longitud: Number.isFinite(largoN) ? snapLen(largoN) : 6,
              cantidad: Math.max(1, cantN != null ? cantN : 1),
            });
            continue;
          }
        }
        const line = cells.join("\t");
        const ph = parsePanelLineHeuristic(line);
        if (ph) {
          paneles.push(ph);
          continue;
        }
        let acc = parseAccesorioLine(line);
        if (!acc && hmap.cantidad != null) {
          const descr = String(prodCell || "").trim();
          const cantAcc = parseQtyCell(cantRaw);
          if (descr.length >= 2 && cantAcc != null && cantAcc >= 1 && !extractTipoFromLine(descr)) {
            acc = { descr, cantidad: Math.min(99999, cantAcc) };
          }
        }
        if (acc) accesorios.push(acc);
      }
      if (paneles.length || accesorios.length) {
        warnings.push("Interpretado como tabla con encabezados (TSV).");
        return { paneles, accesorios, warnings };
      }
    }
  }

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const seenPanel = new Set();
  for (const line of lines) {
    const ph = parsePanelLineHeuristic(line);
    if (ph) {
      const key = `${ph.tipo}|${ph.espesor}|${ph.longitud}|${ph.cantidad}|${line}`;
      if (!seenPanel.has(key)) {
        seenPanel.add(key);
        paneles.push(ph);
      }
      continue;
    }
    const acc = parseAccesorioLine(line);
    if (acc) accesorios.push(acc);
  }

  if (!paneles.length && !accesorios.length) {
    warnings.push(
      "No se detectaron líneas con tipo de panel (ISODEC, ISOPANEL, …) ni accesorios con cantidad. Copiá la tabla o las líneas de producto desde el PDF."
    );
  }
  return { paneles, accesorios, warnings };
}

/**
 * Línea de accesorio: sin tipo panel, texto + cantidad al final o "N x descripción".
 * @param {string} line
 * @returns {{ descr: string, cantidad: number } | null}
 */
export function parseAccesorioLine(line) {
  const raw = String(line || "").trim();
  if (!raw || /^https?:\/\//i.test(raw)) return null;
  if (extractTipoFromLine(raw)) return null;
  if (raw.length < 4) return null;

  let m = raw.match(/^(\d+)\s*[x×]\s+(.+)$/i);
  if (m) {
    const cant = Math.max(1, parseInt(m[1], 10));
    const descr = m[2].trim().replace(/\s+/g, " ");
    if (descr.length >= 2) return { descr, cantidad: cant };
  }
  m = raw.match(/^(.+?)\s+[-–:]\s*(\d+)\s*(?:uds?\.?|unidades?)?\s*$/i);
  if (m) {
    const descr = m[1].trim().replace(/\s+/g, " ");
    const cant = Math.max(1, parseInt(m[2], 10));
    if (descr.length >= 2 && !/^\d+$/.test(descr)) return { descr, cantidad: cant };
  }
  m = raw.match(/^(.+?)\s+(\d+)\s*$/);
  if (m) {
    const descr = m[1].trim().replace(/\s+/g, " ");
    const cant = Math.max(1, parseInt(m[2], 10));
    if (descr.length >= 3 && cant <= 9999 && !/mm\b/i.test(descr)) return { descr, cantidad: cant };
  }
  return null;
}
