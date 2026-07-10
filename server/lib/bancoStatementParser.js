/**
 * Parser de extractos bancarios BROU → movimientos normalizados.
 *
 * Formatos soportados:
 *  - XLS/XLSX "Saldos y Movimientos" de e-BROU (el export real del banco):
 *    preámbulo con metadatos (Nº de Cuenta, Moneda, rango de fechas) y luego
 *    la tabla con header `Fecha | Descripción | Número de documento | Asunto |
 *    Dependencia | Débito | Crédito`. Las fechas vienen como seriales Excel y
 *    los importes como número o texto.
 *  - CSV (export legado "Consulta de Movimientos" o re-export de Sheets):
 *    header `Fecha,Descripción,Número Documento,Num. Dep.,Asunto,Débito,Crédito`.
 *    Se tolera el split de decimales sin comillas ("1.185,08" → dos tokens) vía
 *    reparación derecha-a-izquierda; las filas irreparables se reportan en
 *    `errors`, nunca se descartan en silencio.
 *
 * Convenciones es-UY: fechas texto D/M/YYYY (o D/M/YY → 20YY); importes
 * "1.185,08" (EU) y "2,000.00" (US) se detectan por separador decimal.
 * PDFs: fuera de alcance — usar el export XLS del mismo rango.
 */
import crypto from "node:crypto";
import * as XLSX from "xlsx";

export const ENTIDADES = ["bmc", "expreso_este", "personal", "mixta"];

const MAX_MOVEMENT_YEAR = 2100;
const MIN_MOVEMENT_YEAR = 1990;
// Cota dura para el tokenizador CSV (el route ya limita a 2 MB; esto acota el
// loop ante cualquier caller). Por encima → error explícito, nunca truncado mudo.
export const MAX_CSV_CHARS = 4 * 1024 * 1024;

/** Normaliza celdas de header/reglas: minúsculas, sin acentos ni símbolos. */
export function normalizeText(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Serial Excel (sistema 1900) → 'YYYY-MM-DD' vía UTC (sin sorpresas de TZ). */
export function excelSerialToISO(serial) {
  if (!Number.isFinite(serial)) return null;
  const days = Math.floor(serial);
  const ms = Math.round((days - 25569) * 86400 * 1000);
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  if (year < MIN_MOVEMENT_YEAR || year > MAX_MOVEMENT_YEAR) return null;
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Fecha → 'YYYY-MM-DD' | null. Números = serial Excel; texto = D/M/YYYY
 * (es-UY, convención BROU) o ISO. Valida rangos reales (31/2 → null).
 */
export function parseFecha(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return excelSerialToISO(v);
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const dd = String(v.getDate()).padStart(2, "0");
    return `${v.getFullYear()}-${mm}-${dd}`;
  }
  const s = String(v).trim();
  let y;
  let m;
  let d;
  let match = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (match) {
    [, y, m, d] = match.map(Number);
  } else {
    match = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s.*)?$/);
    if (!match) return null;
    d = Number(match[1]);
    m = Number(match[2]);
    y = Number(match[3]);
    if (y < 100) y += 2000;
  }
  if (y < MIN_MOVEMENT_YEAR || y > MAX_MOVEMENT_YEAR || m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Importe → número (2 decimales) | null. Acepta number, "1.185,08" (EU),
 * "2,000.00" (US), "45.00", "1.000" (agrupado EU → 1000). Basura → null.
 */
export function parseAmount(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  }
  let s = String(v).replace(/[^0-9.,-]/g, "");
  const negative = s.startsWith("-");
  s = s.replace(/-/g, "");
  if (!s) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let normalized;
  if (lastDot >= 0 && lastComma >= 0) {
    normalized =
      lastComma > lastDot
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = /,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastDot >= 0) {
    normalized = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s;
  } else {
    normalized = s;
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.round((negative ? -n : n) * 100) / 100;
}

const HEADER_ALIASES = [
  ["fecha", (t) => t === "fecha"],
  ["descripcion", (t) => t.startsWith("descripcion")],
  ["numeroDocumento", (t) => t.includes("documento")],
  ["asunto", (t) => t === "asunto"],
  ["dependencia", (t) => t === "dependencia" || t.startsWith("num dep")],
  ["debito", (t) => t === "debito"],
  ["credito", (t) => t === "credito"],
];

function mapHeaderRow(row) {
  const map = {};
  row.forEach((cell, idx) => {
    const t = normalizeText(cell);
    if (!t) return;
    for (const [key, matcher] of HEADER_ALIASES) {
      if (map[key] === undefined && matcher(t)) {
        map[key] = idx;
        return;
      }
    }
  });
  const ok = map.fecha !== undefined && (map.debito !== undefined || map.credito !== undefined);
  return ok ? map : null;
}

function trimCell(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s.length ? s : null;
}

function cellToText(v) {
  const t = trimCell(v);
  if (t === null) return null;
  return typeof t === "number" ? String(t) : t;
}

/** Metadatos del preámbulo e-BROU (Nº de Cuenta / Moneda). */
function detectMeta(rows, headerIdx) {
  const meta = { accountNumber: null, accountLabel: null, previousAccountNumber: null, currency: null };
  for (const [i, rowArr] of rows.entries()) {
    if (i >= headerIdx) break;
    for (const raw of rowArr || []) {
      if (typeof raw !== "string") continue;
      const cell = raw.trim();
      if (!cell) continue;
      if (cell.includes("\n")) {
        const [labelLine, ...rest] = cell.split("\n");
        const label = normalizeText(labelLine);
        const value = rest.join(" ").trim();
        if (!value) continue;
        if (label.includes("cuenta anterior")) {
          meta.previousAccountNumber = meta.previousAccountNumber || value;
        } else if (/\bde cuenta\b/.test(label)) {
          // sin \s* tras grupo opcional: backtracking polinomial (CodeQL js/polynomial-redos)
          const m = value.replace(/\s+/g, " ").match(/([A-Z]{2})? ?([\d][\d-]{5,})/);
          if (m) {
            meta.accountLabel = meta.accountLabel || value;
            meta.accountNumber = meta.accountNumber || m[2];
          }
        } else if (label === "moneda") {
          if (/US?\$|U\$S|USD|DOLAR/i.test(value)) meta.currency = "USD";
          else if (value.includes("$")) meta.currency = meta.currency || "UYU";
        }
      } else if (!meta.accountNumber && /^\d{6,}-\d{3,}$/.test(cell)) {
        meta.accountNumber = cell;
      }
    }
  }
  return meta;
}

/**
 * Tokenizador CSV RFC-4180 (comillas, comas y saltos de línea embebidos).
 * Máquina de estados sobre for...of — sin loop acotado por .length de datos
 * de usuario (CodeQL js/loop-bound-injection); el lookahead de `""` y `\r\n`
 * se resuelve con flags de estado. El tope de tamaño lo aplica parseBrouCsv.
 */
export function parseCsvRows(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  let pendingQuote = false; // comilla vista dentro de campo citado: ¿escape o cierre?
  let sawCR = false; // \r fuera de comillas: absorber el \n de un posible \r\n

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  const src = typeof text === "string" ? text.replace(/^\uFEFF/, "") : "";
  for (const c of src) {
    if (sawCR) {
      sawCR = false;
      if (c === "\n") continue;
    }
    if (inQuotes) {
      if (pendingQuote) {
        pendingQuote = false;
        if (c === '"') {
          field += '"';
          continue;
        }
        inQuotes = false; // la comilla anterior cerraba el campo; c se procesa normal
      } else if (c === '"') {
        pendingQuote = true;
        continue;
      } else {
        field += c;
        continue;
      }
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      endField();
    } else if (c === "\n") {
      endRow();
    } else if (c === "\r") {
      endRow();
      sawCR = true;
    } else {
      field += c;
    }
  }
  if (field.length || row.length) endRow();
  return rows;
}

/**
 * Reparación de filas CSV sin comillas donde un importe "1.185,08" quedó
 * partido en dos tokens. Fusiona de derecha a izquierda pares
 * (grupo-de-miles, dos-dígitos) hasta calzar el ancho esperado.
 */
function repairSplitDecimals(tokens, expected) {
  const out = tokens.slice();
  while (out.length > expected) {
    let merged = false;
    for (let i = out.length - 2; i >= 0; i--) {
      const left = String(out[i] ?? "").trim();
      const right = String(out[i + 1] ?? "").trim();
      if (/^-?\d{1,3}(\.\d{3})*$/.test(left) && /^\d{2}$/.test(right)) {
        out.splice(i, 2, `${left},${right}`);
        merged = true;
        break;
      }
    }
    if (!merged) break;
  }
  return out;
}

function buildMovements(rows, headerIdx, map, options) {
  const { repairCsv = false } = options || {};
  const headerWidth = Math.max(...Object.values(map)) + 1;
  const movements = [];
  const errors = [];
  // for...of + entries(): sin loop acotado por .length de datos externos
  // (sheet_to_json sobre buffer de usuario) — CodeQL js/loop-bound-injection.
  for (const [i, rawRow] of rows.entries()) {
    if (i <= headerIdx) continue;
    let row = rawRow || [];
    const nonEmpty = row.filter((c) => trimCell(c) !== null);
    if (nonEmpty.length === 0) continue;
    if (repairCsv && row.length > headerWidth) {
      row = repairSplitDecimals(row, headerWidth);
      if (row.length > headerWidth) {
        errors.push({ line: i + 1, reason: "columnas_inesperadas", raw: (rawRow || []).join(",") });
        continue;
      }
    }
    if (repairCsv && row.length < headerWidth) {
      if (nonEmpty.length <= 1) continue; // nota/pie de página
      errors.push({ line: i + 1, reason: "columnas_insuficientes", raw: (rawRow || []).join(",") });
      continue;
    }
    const fecha = parseFecha(row[map.fecha]);
    if (!fecha) {
      if (nonEmpty.length <= 1) continue; // disclaimers/leyendas del extracto
      errors.push({ line: i + 1, reason: "fecha_invalida", raw: nonEmpty.map(cellToText).join(" | ") });
      continue;
    }
    let debito = map.debito !== undefined ? parseAmount(row[map.debito]) : null;
    let credito = map.credito !== undefined ? parseAmount(row[map.credito]) : null;
    if (debito === 0) debito = null;
    if (credito === 0) credito = null;
    if (debito === null && credito === null) {
      errors.push({ line: i + 1, reason: "sin_importe", raw: nonEmpty.map(cellToText).join(" | ") });
      continue;
    }
    movements.push({
      fecha,
      descripcion: cellToText(row[map.descripcion]) || "(sin descripción)",
      numeroDocumento: map.numeroDocumento !== undefined ? cellToText(row[map.numeroDocumento]) : null,
      asunto: map.asunto !== undefined ? cellToText(row[map.asunto]) : null,
      dependencia: map.dependencia !== undefined ? cellToText(row[map.dependencia]) : null,
      debito,
      credito,
    });
  }
  return { movements, errors };
}

/**
 * Hash de dedup por movimiento: sha256 de la tupla normalizada + índice de
 * ocurrencia dentro del extracto. Re-importar el mismo archivo (o rangos
 * solapados) no duplica; dos movimientos idénticos legítimos del mismo día
 * conservan hashes distintos (seq 0 y 1).
 */
function withDedupHashes(movements) {
  const seen = new Map();
  return movements.map((m) => {
    const tuple = [
      m.fecha,
      m.descripcion,
      m.numeroDocumento || "",
      m.asunto || "",
      m.dependencia || "",
      m.debito ?? "",
      m.credito ?? "",
    ].join("|");
    const seq = seen.get(tuple) || 0;
    seen.set(tuple, seq + 1);
    const dedupHash = crypto.createHash("sha256").update(`${tuple}|${seq}`).digest("hex");
    return { ...m, dedupHash };
  });
}

function parseRows(rows, options) {
  let headerIdx = -1;
  let map = null;
  for (const [i, row] of rows.entries()) {
    const candidate = mapHeaderRow(row || []);
    if (candidate) {
      headerIdx = i;
      map = candidate;
      break;
    }
  }
  if (!map) {
    return { headerFound: false, movements: [], errors: [], meta: detectMeta(rows, rows.length) };
  }
  const meta = detectMeta(rows, headerIdx);
  const { movements, errors } = buildMovements(rows, headerIdx, map, options);
  return { headerFound: true, movements: withDedupHashes(movements), errors, meta };
}

/** XLS/XLSX (Buffer) → resultado normalizado. */
export function parseBrouWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { headerFound: false, movements: [], errors: [], meta: detectMeta([], 0) };
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  return parseRows(rows, { repairCsv: false });
}

/** CSV (texto) → resultado normalizado. */
export function parseBrouCsv(text) {
  const src = String(text ?? "");
  if (src.length > MAX_CSV_CHARS) {
    return {
      headerFound: false,
      movements: [],
      errors: [{ line: 0, reason: "csv_demasiado_grande", raw: `${src.length} chars > ${MAX_CSV_CHARS}` }],
      meta: { accountNumber: null, accountLabel: null, previousAccountNumber: null, currency: null },
    };
  }
  return parseRows(parseCsvRows(src), { repairCsv: true });
}

/**
 * Punto de entrada único. `buffer` (XLS/XLSX; XLSX.read también acepta tablas
 * HTML disfrazadas de .xls) tiene prioridad; si no parsea como workbook se
 * intenta como CSV utf-8. `csvText` fuerza el camino CSV.
 */
export function parseBankStatement({ buffer, csvText }) {
  if (buffer && buffer.length) {
    try {
      const result = parseBrouWorkbook(buffer);
      if (result.headerFound) return result;
    } catch {
      // no era un workbook — probar como texto plano
    }
    return parseBrouCsv(buffer.toString("utf8"));
  }
  if (csvText) return parseBrouCsv(csvText);
  return { headerFound: false, movements: [], errors: [], meta: {} };
}

/**
 * Primera regla activa (por priority asc) cuyo pattern es substring
 * case/acentos-insensible de descripción o asunto. Reglas con pattern vacío
 * no matchean.
 */
export function matchRule(movement, rules) {
  const haystack = normalizeText(`${movement.descripcion || ""} ${movement.asunto || ""}`);
  for (const rule of rules) {
    const needle = normalizeText(rule.pattern);
    if (needle && haystack.includes(needle)) return rule;
  }
  return null;
}
