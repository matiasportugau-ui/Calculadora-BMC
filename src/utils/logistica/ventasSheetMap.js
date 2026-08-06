/**
 * Ventas 2.0 column map for /logistica (workbook 1KFN… / gid 926747636).
 * Prefer header regexes; fall back to fixed A=0 indices from planilla screenshots 2026-08.
 */

import {
  parsePedidoFromColumnC,
  parsePickupIdFromColumnF,
  parsePedidoRetiroFromFreeText,
} from "../ventasPedidoRetiroParse.js";

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

/**
 * A1 column letter for FECHA ENTREGA on Ventas 2.0 (must match VENTAS_V2_FALLBACK.fechaEntrega).
 * POST /api/ventas/logistica-fecha-entrega writes this cell — never G (TIPO/FAB).
 */
export const VENTAS_FECHA_ENTREGA_COL_LETTER = "H";

/**
 * Build Sheets A1 range for logística fecha de entrega write.
 * @param {string} tabTitle
 * @param {number} row1Based
 * @returns {string}
 */
export function buildVentasFechaEntregaA1Range(tabTitle, row1Based) {
  const safeTab = String(tabTitle ?? "").replace(/'/g, "''");
  const row = Number(row1Based);
  if (!Number.isFinite(row) || row < 2) {
    throw new Error("row1Based inválido (mín. 2)");
  }
  return `'${safeTab}'!${VENTAS_FECHA_ENTREGA_COL_LETTER}${row}`;
}

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

/** DD/MM/YYYY or YYYY-MM-DD → YYYY-MM-DD */
export function parsePlanillaFechaToIso(cellVal) {
  const t = String(cellVal ?? "").trim();
  if (!t) return "";
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(t);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return "";
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
  if (/^(nombre|cliente|name)$/i.test(nombre)) nombre = "";

  let pdf = cell(H, row, "pdf");
  // Drive / maps links sometimes land in dirección
  const dirRaw = cell(H, row, "dir");
  if (!pdf && /drive\.google|docs\.google|\/file\/d\//i.test(dirRaw)) {
    pdf = dirRaw;
  }

  return {
    nombre,
    dir: dirRaw,
    pdf,
    tel: cell(H, row, "tel"),
    orderId: String(orderId || "").trim(),
    cotizacionId: "",
    pickupId: String(pickupId || "").trim(),
    zona: "",
    recepcionContacto: "",
    estadoGral,
    estadoText: estadoText || fechaRaw || "",
    rawSheetText: buildSheetFallbackText(headers, row),
    fechaEntrega,
    carpetaDrive: cell(H, row, "carpeta"),
    canal: cell(H, row, "canal"),
    vendedor: cell(H, row, "vendedor"),
    tipoFab: cell(H, row, "tipo"),
    ventasSheetRow1Based: sheetRow1Based ?? null,
    ventasTabGid: opts.gid || "",
  };
}
