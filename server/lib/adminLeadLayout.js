/**
 * Canonical Admin 2.0 lead layout (tab "Admin.").
 *
 * Live operator sheet (IAlfred / pipeline), 0-based:
 *   C Estado · D Fecha · E Cliente · F Origen · G Teléfono · H Zona
 *   I Consulta · J Interpretacion AI · K Respuesta AI · L Datos Faltantes · M PDF
 *
 * Wolfboard historically appended A:M with a different map (tel in D, estado in L).
 * Google `values.append` then follows the sheet used-range, so VW chats landed at
 * row 3713+ (empty gap 81–3712, dump cluster at the bottom).
 */

export const ADMIN_LEAD_ORIGEN_VW = "VW";
export const STOREFRONT_STUB_CONSULTA = "Chat tienda Panelin — inicio";
export const WORKING_SET_EMPTY_GAP = 12;
export const WORKING_SET_DUMP_FLOOR = 200;

/** 0-based column indexes on Admin. */
export const ADMIN_COLS = Object.freeze({
  id: 0, // A
  estado: 2, // C
  fecha: 3, // D
  cliente: 4, // E
  origen: 5, // F
  telefono: 6, // G
  zona: 7, // H
  consulta: 8, // I
  interpretacion: 9, // J
  respuesta: 10, // K
  faltantes: 11, // L
  pdf: 12, // M
});

const ESTADO_RE = /^(pendiente|falta info|cotizado|cotizable|asignado|enviado|reclamo|respondida)/i;

export function colLetter(i) {
  let s = "";
  let n = i;
  while (true) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return s;
}

export function isStubStorefrontConsulta(text) {
  const t = String(text || "").trim();
  if (!t) return true;
  if (t === STOREFRONT_STUB_CONSULTA) return true;
  if (/^chat tienda panelin/i.test(t) && t.length < 80) return true;
  return false;
}

export function formatAdminFecha(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}`;
}

function cell(row, idx) {
  return String(row?.[idx] ?? "").trim();
}

export function rowHasLeadData(row) {
  if (!Array.isArray(row)) return false;
  return [2, 3, 4, 5, 6, 8, 9].some((i) => cell(row, i));
}

/**
 * Next empty row in the operator working set (after last occupied, before the
 * giant empty gap / dump cluster). valueRows[0] = sheet row 2.
 *
 * Returns null when the working set is saturated — callers must NOT write to a
 * guessed row (batchUpdate would silently overwrite an existing lead).
 * maxRow is inclusive (default 200 for range A2:M200).
 */
export function findNextWorkingSetRow(valueRows, opts = {}) {
  const startRow = Number(opts.startRow) || 2;
  const gap = Number(opts.gap) || WORKING_SET_EMPTY_GAP;
  const maxRow = Number(opts.maxRow ?? opts.dumpFloor) || WORKING_SET_DUMP_FLOOR;
  const rows = Array.isArray(valueRows) ? valueRows : [];
  let lastOccupied = startRow - 1;
  let empty = 0;
  for (let i = 0; i < rows.length; i++) {
    const rowNum = startRow + i;
    if (rowNum > maxRow) break;
    if (rowHasLeadData(rows[i])) {
      lastOccupied = rowNum;
      empty = 0;
    } else {
      empty += 1;
      if (empty >= gap && lastOccupied >= startRow) {
        break;
      }
    }
  }
  const next = Math.max(lastOccupied + 1, startRow);
  if (next > maxRow) return null;
  const nextIdx = next - startRow;
  if (nextIdx >= 0 && nextIdx < rows.length && rowHasLeadData(rows[nextIdx])) {
    return null;
  }
  return next;
}

/** Prefer canonical (C=Estado) when the row looks like the live operator sheet. */
export function detectAdminRowLayout(row) {
  const c = cell(row, 2);
  const d = cell(row, 3);
  const g = cell(row, 6);
  if (ESTADO_RE.test(c)) return "canonical";
  if (/^\d{1,2}[-/]\d{1,2}/.test(d) && (g.startsWith("+") || /^\d{8,}/.test(g.replace(/\s/g, "")))) {
    return "canonical";
  }
  const l = cell(row, 11);
  const telD = cell(row, 3);
  if (ESTADO_RE.test(l) || /^\+?\d{8,}/.test(telD.replace(/\s/g, ""))) return "legacy";
  return "canonical";
}

export function mapAdminRowCanonical(row, idx, adminSheetId) {
  const sheetBase = `https://docs.google.com/spreadsheets/d/${adminSheetId}/edit`;
  const layout = detectAdminRowLayout(row);
  if (layout === "legacy") {
    return {
      layout,
      rowNum: idx + 2,
      id: cell(row, 0),
      fecha: cell(row, 1),
      telefono: cell(row, 3),
      cliente: cell(row, 4),
      canal: cell(row, 5),
      origen: cell(row, 5),
      zona: cell(row, 7),
      consulta: cell(row, 8),
      interpretacion: cell(row, 9),
      respuesta: cell(row, 9),
      link: cell(row, 10),
      estado: cell(row, 11),
      faltantes: "",
      replaySnapshotUrl: cell(row, 12),
      sheetUrl: sheetBase,
      stub: isStubStorefrontConsulta(cell(row, 8)),
    };
  }
  return {
    layout: "canonical",
    rowNum: idx + 2,
    id: cell(row, 0),
    estado: cell(row, 2),
    fecha: cell(row, 3),
    cliente: cell(row, 4),
    canal: cell(row, 5),
    origen: cell(row, 5),
    telefono: cell(row, 6),
    zona: cell(row, 7),
    consulta: cell(row, 8),
    interpretacion: cell(row, 9),
    respuesta: cell(row, 10),
    faltantes: cell(row, 11),
    link: cell(row, 12),
    replaySnapshotUrl: cell(row, 12),
    sheetUrl: sheetBase,
    stub: isStubStorefrontConsulta(cell(row, 8)),
  };
}

const FAMILY_RE = [
  { re: /isodec|iso\s*dec/i, name: "IsoDec", escenario: "techo" },
  { re: /isoroof|iso\s*roof/i, name: "IsoRoof", escenario: "techo" },
  { re: /isopanel|iso\s*panel/i, name: "IsoPanel", escenario: "pared" },
  { re: /isofrig|c[aá]mara/i, name: "IsoFrig", escenario: "camara" },
  { re: /hiansa/i, name: "Hiansa", escenario: "techo" },
];

function inferFamily(text) {
  for (const f of FAMILY_RE) {
    if (f.re.test(text)) return f;
  }
  return null;
}

function inferEspesor(text) {
  const m = text.match(/\b(\d{2,3})\s*(mm)?\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  if ([30, 40, 50, 80, 100, 120, 150, 200].includes(n)) return n;
  return null;
}

function inferMedidas(text) {
  const m = text.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  return { ancho: Number(m[1]), largo: Number(m[2]) };
}

/**
 * Heuristic evaluate / filter / assume for VW storefront chats.
 * Does not invent firm prices. Tags assumptions with [inferido].
 */
export function evaluateStorefrontConsulta({ consulta = "", zona = "", cliente = "" } = {}) {
  const text = String(consulta || "").trim();
  const stub = isStubStorefrontConsulta(text);
  if (stub) {
    return {
      stub: true,
      filter: "stub_inicio",
      estado: "Falta info",
      interpretacion: "lead_vw · chat tienda · sin consulta útil aún",
      respuesta: "",
      faltantes: "consulta real · tipo (techo/pared) · medidas · espesor · zona · color",
      quotable: false,
      assumed: [],
    };
  }

  const family = inferFamily(text);
  const espesor = inferEspesor(text);
  const medidas = inferMedidas(text);
  const assumed = [];
  const bits = ["lead_vw", cliente ? `cliente=${cliente}` : ""].filter(Boolean);
  if (family) {
    bits.push(`familia=${family.name}`);
    bits.push(`escenario=${family.escenario}`);
    assumed.push(`escenario ${family.escenario} [inferido]`);
  }
  if (espesor) bits.push(`espesor=${espesor}mm`);
  if (medidas) bits.push(`medidas=${medidas.ancho}x${medidas.largo}`);
  if (zona) bits.push(`zona=${zona}`);
  bits.push("lista=web");
  bits.push("flete=no");

  const missing = [];
  if (!family) missing.push("tipo/familia (IsoDec / IsoPanel / …)");
  if (!espesor) missing.push("espesor mm");
  if (!medidas) missing.push("medidas (ancho×largo)");
  if (!zona) missing.push("zona");
  missing.push("color");

  const quotable = Boolean(family && espesor && medidas);
  return {
    stub: false,
    filter: quotable ? "cotizable" : "falta_info",
    estado: quotable ? "Cotizable" : "Falta info",
    interpretacion: bits.join(" · "),
    respuesta: quotable
      ? "Aproximación lista para calc lista web (sin flete). Confirmar color y zona."
      : "Falta dato para armar el presupuesto. Pedir lo listado en L.",
    faltantes: missing.join(" · "),
    quotable,
    assumed,
    family: family?.name || null,
    espesor,
    medidas,
  };
}

export function buildCanonicalAdminUpdates(tab, rowNum, fields, sanitize = (x) => x) {
  const t = String(tab || "Admin.").replace(/'/g, "");
  const n = Number(rowNum);
  const s = (v) => sanitize(String(v ?? ""));
  const pairs = [
    fields.id != null ? ["A", s(fields.id)] : null,
    fields.estado != null ? ["C", s(fields.estado)] : null,
    fields.fecha != null ? ["D", s(fields.fecha)] : null,
    fields.cliente != null ? ["E", s(fields.cliente)] : null,
    fields.origen != null ? ["F", s(fields.origen)] : null,
    fields.telefono != null ? ["G", s(fields.telefono)] : null,
    fields.zona != null ? ["H", s(fields.zona)] : null,
    fields.consulta != null ? ["I", s(fields.consulta)] : null,
    fields.interpretacion != null ? ["J", s(fields.interpretacion)] : null,
    fields.respuesta != null ? ["K", s(fields.respuesta)] : null,
    fields.faltantes != null ? ["L", s(fields.faltantes)] : null,
    fields.link != null ? ["M", s(fields.link)] : null,
  ].filter(Boolean);
  return pairs.map(([col, value]) => ({
    range: `'${t}'!${col}${n}`,
    values: [[value]],
  }));
}
