/**
 * Ventas 2.0 column map for /logistica (workbook 1KFN… / gid 926747636).
 * Prefer header regexes; fall back to fixed A=0 indices from planilla screenshots 2026-08.
 */

import {
  parsePedidoFromColumnC,
  parsePickupIdFromColumnF,
  parsePedidoRetiroFromFreeText,
} from "../ventasPedidoRetiroParse.js";
import { extractAdjuntoHttpsUrl } from "./adjuntoUrl.js";

/** Fixed indices when headers missing / gviz weird (A=0). */
export const VENTAS_V2_FALLBACK = {
  canal: 0,
  vendedor: 1,
  orderId: 2, // C ID. Pedido
  ingreso: 3,
  estadoGral: 4, // E
  estadoText: 5, // F free text
  tipo: 6, // G FAB
  fechaEntrega: 7, // H FECHA ENTREGA
  nombre: 8, // I NOMBRE
  dir: 9, // J DIRECCIÓN
  pdf: 10, // K ENCARGO (Drive PDF)
  carpeta: 11, // L CARPETA
  monto: 12,
  costo: 13,
  ganancias: 14,
  tel: 15, // P CONTACTO
};

function normalizeText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * @param {string[]} headers
 */
export function buildVentasHeaderMap(headers) {
  const map = {};
  if (!Array.isArray(headers)) return map;
  headers.forEach((h, i) => {
    const n = normalizeText(h);
    if (!n) return;
    if (/(^id|nro|numero|#).*pedido|pedido.*id|^pedido$|^order|id\.?\s*pedido/.test(n) && map.orderId == null) {
      map.orderId = i;
    }
    if (/^vendedor/.test(n) && map.vendedor == null) map.vendedor = i;
    if (/^cliente|^nombre\b/.test(n) && map.nombre == null) map.nombre = i;
    if (/direccion|^dir$|domicilio/.test(n) && map.dir == null) map.dir = i;
    if (/telefono|celular|^tel$|^contacto$/.test(n) && map.tel == null) map.tel = i;
    // ENCARGO / PDF / cotización Drive — prefer encargo over generic "link"
    if (/^encargo$|encargo|cotizaci|presupuesto.*pdf|pdf|adjunto/.test(n) && map.pdf == null) {
      map.pdf = i;
    }
    if (/^carpeta$|folder|drive.*folder/.test(n) && map.carpeta == null) map.carpeta = i;
    if (/fecha\s*entrega|fecha.*entrega/.test(n) && map.fechaEntrega == null) map.fechaEntrega = i;
    if (/estado\s*gral|estado gral|^estado$/.test(n) && map.estadoGral == null && !/facturacion|datos fact/.test(n)) {
      map.estadoGral = i;
    }
    if (
      /estado|gral|fact\.|entregas pendientes|pago|retiro/.test(n) &&
      map.estadoText == null &&
      map.estadoGral !== i &&
      !/^fecha/.test(n) &&
      !/facturacion|datos fact/.test(n)
    ) {
      // free-text operational column (often F)
      if (/pago|retiro|flete|coord|enviad|pendiente/.test(n) || n.length > 20) map.estadoText = i;
    }
    if (/^tipo$|^fab$/.test(n) && map.tipo == null) map.tipo = i;
    if (/^canal$|^origen$|^wa$/.test(n) && map.canal == null) map.canal = i;
  });
  // If estadoText still empty, use column F (5) as free text when E is estado gral
  if (map.estadoText == null && map.estadoGral != null) {
    map.estadoText = VENTAS_V2_FALLBACK.estadoText;
  }
  return map;
}

function cell(map, row, key) {
  const fb = VENTAS_V2_FALLBACK[key];
  const idx = map[key] != null ? map[key] : fb;
  if (idx == null || idx < 0 || !row || idx >= row.length) return "";
  return String(row[idx] ?? "").trim();
}

/**
 * Planilla fecha → YYYY-MM-DD for chips / input type=date.
 * Accepts:
 * - YYYY-MM-DD
 * - DD/MM/YYYY or DD/MM/YY
 * - DD/MM (year defaults to current calendar year; override via opts.now)
 * Rejects free-text ops notes ("Falta pagar la seña", "Coordinar", "Stock", months-only, code dumps).
 *
 * @param {unknown} cellVal
 * @param {{ now?: Date }} [opts]
 * @returns {string} ISO date or ""
 */
export function parsePlanillaFechaToIso(cellVal, opts = {}) {
  const t = String(cellVal ?? "").trim();
  if (!t) return "";
  // Free-text / garbage cells — not a coordination date
  if (/import\s+pandas|print\s*\(\s*df/i.test(t)) return "";
  if (
    /falta\s+pagar|seña|coordinar|^stock$|mayo\s*\/|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre|enero|febrero|marzo|abril/i.test(
      t,
    ) &&
    !/^\d{1,2}\//.test(t)
  ) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;

  // DD/MM[/YY[YY]]
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(t);
  if (!m) return "";
  const day = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(day) || !Number.isFinite(month) || day < 1 || day > 31 || month < 1 || month > 12) {
    return "";
  }
  let year;
  if (m[3]) {
    year = m[3].length === 2 ? `20${m[3]}` : m[3];
  } else {
    const now = opts.now instanceof Date && !Number.isNaN(opts.now.getTime()) ? opts.now : new Date();
    year = String(now.getFullYear());
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildSheetFallbackText(headers, row) {
  if (!Array.isArray(headers) || !Array.isArray(row)) return "";
  const preferred = [];
  const all = [];
  headers.forEach((header, index) => {
    const value = String(row[index] || "").trim();
    if (!value) return;
    const h = normalizeText(header);
    const line = `${header}: ${value}`;
    all.push(line);
    if (
      /pedido|consulta|detalle|descripcion|producto|observ|nota|item|panel|accesorio|obra|material|bulto|encargo|resumen|cant/.test(
        h,
      ) &&
      !/cliente|direccion|telefono|celular|mail|vendedor/.test(h)
    ) {
      preferred.push(line);
    }
  });
  return [...preferred, ...all].join("\n");
}

/**
 * Map one Ventas data row for logistica.
 * @param {string[]} headers
 * @param {string[]} row
 * @param {number|null} sheetRow1Based
 * @param {{ gid?: string }} [opts]
 */
export function mapVentasRowV2(headers, row, sheetRow1Based, opts = {}) {
  const H = buildVentasHeaderMap(headers);
  const colC = cell(H, row, "orderId") || (row && row[VENTAS_V2_FALLBACK.orderId]) || "";
  const fromC = parsePedidoFromColumnC(String(colC));
  let orderId = fromC.orderId || String(colC).trim();

  const colF = cell(H, row, "estadoText") || (row && row[VENTAS_V2_FALLBACK.estadoText]) || "";
  let pickupId = parsePickupIdFromColumnF(String(colF));
  if (!pickupId) pickupId = "";

  const estadoGral = cell(H, row, "estadoGral");
  const estadoText = colF || estadoGral;
  const fechaRaw = cell(H, row, "fechaEntrega");
  const fechaEntrega = parsePlanillaFechaToIso(fechaRaw);

  const parsedIds = parsePedidoRetiroFromFreeText([estadoGral, estadoText, fechaRaw].filter(Boolean).join("\n"));
  if (!String(orderId).trim() && parsedIds.orderId) orderId = parsedIds.orderId;
  if (!String(pickupId).trim() && parsedIds.pickupId) pickupId = parsedIds.pickupId;

  let nombre = cell(H, row, "nombre");
  // Never treat header labels as client names
  if (isHeaderLikeLabel(nombre)) nombre = "";

  let pdf = cell(H, row, "pdf");
  // Drive / maps links sometimes land in dirección
  const dirRaw = cell(H, row, "dir");
  if (!pdf && /drive\.google|docs\.google|\/file\/d\//i.test(dirRaw)) {
    pdf = dirRaw;
  }
  const encargoNotes = sanitizeEncargoCell(pdf);
  pdf = encargoNotes.pdf;
  const encargoPlain = encargoNotes.plainText;

  // Strip header-like order ids ("ID. Pedido")
  if (isHeaderLikeLabel(orderId) || /^id\.?\s*pedido$/i.test(orderId)) {
    orderId = "";
  }

  const mapped = {
    nombre,
    dir: isHeaderLikeLabel(dirRaw) ? "" : dirRaw,
    pdf,
    /** Non-URL ENCARGO cell (e.g. product lines) for text infer */
    encargoPlain,
    tel: isHeaderLikeLabel(cell(H, row, "tel")) ? "" : cell(H, row, "tel"),
    orderId: String(orderId || "").trim(),
    cotizacionId: "",
    pickupId: String(pickupId || "").trim(),
    zona: "",
    recepcionContacto: "",
    estadoGral,
    estadoText: estadoText || fechaRaw || "",
    rawSheetText: [encargoPlain, buildSheetFallbackText(headers, row)].filter(Boolean).join("\n"),
    fechaEntrega,
    carpetaDrive: cell(H, row, "carpeta"),
    canal: cell(H, row, "canal"),
    vendedor: cell(H, row, "vendedor"),
    tipoFab: cell(H, row, "tipo"),
    ventasSheetRow1Based: sheetRow1Based ?? null,
    ventasTabGid: opts.gid || "",
  };
  return mapped;
}

/** Header / template labels that must never count as real client data */
const HEADER_LIKE =
  /^(nombre|cliente|name|direccion|dirección|telefono|teléfono|contacto|pedido|id\.?\s*pedido|encargo|carpeta|fecha|vendedor|canal|tipo|estado|pdf|adjunto|monto|—|-|n\/a|null|undefined)$/i;

export function isHeaderLikeLabel(value) {
  const t = String(value || "").trim();
  if (!t) return true;
  if (HEADER_LIKE.test(t)) return true;
  if (/^id\.?\s*pedido$/i.test(t)) return true;
  // Long header blobs from gviz duplicated headers
  if (t.length > 80 && /pedido|nombre|vendedor|entrega/i.test(t) && !/\d{5,}/.test(t)) return true;
  return false;
}

/**
 * Second quoted/arg label from =HYPERLINK("url","label") / HYPERLINK("url"; "label").
 * Labels often carry Cotizacion-Isodec-100-mm….pdf used for filename cargo infer when
 * Drive bytes are unavailable — must not be discarded with the formula wrapper.
 * @param {string} raw
 * @returns {string}
 */
function extractHyperlinkLabel(raw) {
  const s = String(raw || "");
  const m =
    s.match(/HYPERLINK\s*\(\s*"(?:[^"]*)"\s*[,;]\s*"([^"]+)"\s*\)/i) ||
    s.match(/HYPERLINK\s*\(\s*'(?:[^']*)'\s*[,;]\s*'([^']+)'\s*\)/i);
  return m?.[1] ? String(m[1]).trim() : "";
}

/**
 * ENCARGO cell → real URL/pdf vs free text vs garbage labels.
 * Only returns `pdf` when a real Drive/Dropbox https URL can be extracted.
 * Bare filenames (common gviz HYPERLINK display text) go to plainText only —
 * never as pdfLink (proxy would answer url_invalid / "URL no permitida").
 * When the cell is a HYPERLINK formula, keep the display label in plainText so
 * `inferCargoFromEncargoAndSheet` can still parse panel specs if PDF fetch fails.
 *
 * @param {string} raw
 * @returns {{ pdf: string, plainText: string }}
 */
export function sanitizeEncargoCell(raw) {
  const t = String(raw || "").trim();
  if (!t || isHeaderLikeLabel(t) || /^pedido$/i.test(t)) {
    return { pdf: "", plainText: "" };
  }
  const url = extractAdjuntoHttpsUrl(t);
  if (url) {
    // Capture label before stripping the formula (label has panel filename cues).
    const hlLabel = extractHyperlinkLabel(t);
    let leftover = t
      .replace(url, " ")
      .replace(/https?:\/\/[^\s]+/gi, " ")
      .replace(/[=]?HYPERLINK\s*\([^)]*\)/gi, " ")
      .replace(/["'`]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (hlLabel && !leftover.includes(hlLabel)) {
      leftover = [leftover, hlLabel].filter(Boolean).join(" ").trim();
    }
    return { pdf: url, plainText: leftover };
  }
  // Product lines / bare .pdf filenames — text infer only
  return { pdf: "", plainText: t };
}

/**
 * Instruction / note rows pasted into NOMBRE (not real clients).
 * @param {string} nombre
 * @returns {boolean}
 */
export function isInstructionNoiseNombre(nombre) {
  const n = normalizeText(nombre);
  if (!n) return false;
  if (/escaneo de ci|pedir celular|hacer un escaneo|cuando entregamos/.test(n)) return true;
  // Long imperative ops notes without a person-like short name
  if (
    n.length >= 36 &&
    /^(hacer|pedir|no olvid|recordar|cuando|escanear|entregamos)\b/.test(n)
  ) {
    return true;
  }
  if (/import\s+pandas|print\s*\(\s*df/.test(n)) return true;
  return false;
}

/**
 * True when mapped Ventas row is worth listing / adding as a logistics stop.
 * Rejects header clones, empty shells, instruction notes, and label-only ENCARGO noise.
 * @param {object} row mapVentasRowV2 result
 */
export function isVentasLogisticaCandidate(row) {
  if (!row || typeof row !== "object") return false;
  const nombre = String(row.nombre || "").trim();
  const orderId = String(row.orderId || "").trim();
  const tel = String(row.tel || "").trim();
  const dir = String(row.dir || "").trim();
  const pdf = String(row.pdf || "").trim();
  const encargoPlain = String(row.encargoPlain || "").trim();
  const rawBlob = String(row.rawSheetText || row.estadoText || row.fechaEntrega || "");

  if (isInstructionNoiseNombre(nombre)) return false;
  if (/import\s+pandas|print\s*\(\s*df/i.test(rawBlob)) return false;
  // Placeholder pedido labels that are not real IDs
  if (/^(id\.?\s*pedido|encargar|origen)$/i.test(orderId) && isHeaderLikeLabel(nombre || "NOMBRE")) {
    return false;
  }

  if (nombre && !isHeaderLikeLabel(nombre)) {
    // Real name is enough if we also have any ops signal
    if (orderId || tel || dir || pdf || encargoPlain || row.fechaEntrega) return true;
    // Name-only still useful for manual fill — but not ultra-thin shells (1–2 chars)
    return nombre.length >= 3;
  }

  // No real name: need a real pedido id (digits) and some other signal
  const realPedido = /^\d{4,}$/.test(orderId) || /^[A-Z]{0,4}\d{4,}/i.test(orderId);
  if (realPedido && (tel || dir || pdf || encargoPlain)) return true;

  return false;
}

/**
 * Human label for toasts / list (never empty "para .").
 * @param {object} row
 * @param {{ sheetRow?: number|null }} [opts]
 */
export function labelVentasCandidate(row, opts = {}) {
  const nombre = String(row?.nombre || "").trim();
  if (nombre && !isHeaderLikeLabel(nombre)) return nombre;
  const orderId = String(row?.orderId || "").trim();
  if (orderId && !isHeaderLikeLabel(orderId)) return `#${orderId}`;
  const tel = String(row?.tel || "").trim();
  if (tel && !isHeaderLikeLabel(tel)) return `tel ${tel}`;
  const rowN = row?.ventasSheetRow1Based ?? opts.sheetRow;
  if (rowN != null && Number(rowN) > 0) return `fila ${rowN}`;
  return "parada sin nombre";
}

/**
 * Filter + optional sort for search/cargar results.
 * @param {object[]} mappedRows
 * @returns {object[]}
 */
export function filterVentasLogisticaCandidates(mappedRows) {
  if (!Array.isArray(mappedRows)) return [];
  return mappedRows.filter(isVentasLogisticaCandidate);
}

/**
 * Pair CSV data rows with true 1-based Sheets row numbers.
 *
 * gviz CSV: index 0 = header (sheet row 1); data starts at sheet row 2.
 * Blank rows must be dropped *after* capturing the original index — otherwise
 * `filter` + `i + 2` skews `ventasSheetRow1Based` and fecha/archive writes hit
 * the wrong Ventas row (data corruption).
 *
 * @param {string[][]} csvRows full parseCsv output including header at [0]
 * @returns {{ row: string[], sheetRow1Based: number }[]}
 */
export function indexVentasCsvDataRows(csvRows) {
  if (!Array.isArray(csvRows) || csvRows.length < 2) return [];
  const out = [];
  for (let i = 1; i < csvRows.length; i += 1) {
    const row = csvRows[i];
    if (!Array.isArray(row)) continue;
    if (!row.some((c) => String(c || "").trim())) continue;
    out.push({ row, sheetRow1Based: i + 1 });
  }
  return out;
}
