/**
 * Parser de filas copiadas desde Google Sheets / Excel (TSV).
 * Sin llamadas de red: la "foto" es vista previa vía <img> (Drive thumbnail o URL directa).
 */

/** @typedef {{ label: string, byIndex: Record<string, number|null|undefined> }} SheetPreset */

/** Preset alineado al flujo histórico gviz (cols 0..14+). Ajustá índices si tu pestaña cambió. */
export const SHEET_PASTE_PRESETS = {
  ventasDashboardLegacy: {
    label: "Ventas Dashboard (índices heredados: col.0 pedido, 7–9 cliente/dir/PDF, 14 tel)",
    byIndex: {
      cotizacionId: 0,
      cliente: 7,
      direccion: 8,
      linkAdjunto: 9,
      telefono: 14,
      linkUbicacion: null,
      zona: null,
    },
  },
  ventasDashboardLegacyMapa15: {
    label: "Ventas Dashboard + mapa en col. 15 (opcional)",
    byIndex: {
      cotizacionId: 0,
      cliente: 7,
      direccion: 8,
      linkAdjunto: 9,
      telefono: 14,
      linkUbicacion: 15,
      zona: null,
    },
  },
};

function stripBom(s) {
  return s.replace(/^\uFEFF/, "");
}

/**
 * Divide texto pegado en líneas no vacías.
 * @param {string} text
 * @returns {string[]}
 */
export function splitPasteLines(text) {
  return stripBom(String(text || ""))
    .split(/\r?\n/)
    .map((l) => l.replace(/\r/g, ""))
    .filter((l) => l.trim() !== "");
}

/**
 * Divide una línea TSV respetando comillas CSV básicas.
 * @param {string} line
 * @returns {string[]}
 */
export function splitTsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
      continue;
    }
    if (!inQ && c === "\t") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((c) => c.replace(/^"|"$/g, "").trim());
}

/**
 * @param {string} text
 * @returns {string[][]}
 */
export function parseTsvRows(text) {
  return splitPasteLines(text).map(splitTsvLine);
}

function normHeader(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

/** Mapa alias canónico → posibles títulos de columna en planilla */
const HEADER_ALIASES = {
  cliente: ["cliente", "nombre", "cliente nombre", "cliente_nombre"],
  direccion: ["direccion", "ubicacion", "ubicacion / direccion", "dir"],
  zona: ["zona"],
  telefono: ["telefono", "tel", "cel", "tel/cel", "telefono celular"],
  cotizacionId: [
    "cotizacion_id",
    "id",
    "pedido",
    "n pedido",
    "n° pedido",
    "npedido",
    "orden",
    "cotizacion",
  ],
  linkUbicacion: ["link_ubicacion", "link ubicacion", "maps", "mapa", "google maps", "ubicacion link"],
  linkAdjunto: [
    "link_cotizacion",
    "link cotizacion",
    "pdf",
    "foto",
    "imagen",
    "adjunto",
    "archivo",
    "link",
    "drive",
  ],
};

/**
 * Primera fila = encabezados, segunda = valores (como al copiar 2 filas en Sheets).
 * @param {string} text
 * @returns {Record<string, string>|null}
 */
export function parseHeaderThenValueRow(text) {
  const rows = parseTsvRows(text);
  if (rows.length < 2) return null;
  const headers = rows[0].map(normHeader);
  const values = rows[1];
  const map = {};
  headers.forEach((h, i) => {
    map[h] = String(values[i] ?? "").trim();
  });
  const out = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const al of aliases) {
      const key = normHeader(al);
      if (map[key] !== undefined && map[key] !== "") {
        out[field] = map[key];
        break;
      }
    }
  }
  /** Coincidencia por inclusión si no hubo match exacto */
  const headerKeys = Object.keys(map);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (out[field]) continue;
    for (const hk of headerKeys) {
      if (aliases.some((a) => hk.includes(normHeader(a)) || normHeader(a).includes(hk))) {
        out[field] = map[hk];
        break;
      }
    }
  }
  return out;
}

/**
 * @param {string[]} cells
 * @param {keyof typeof SHEET_PASTE_PRESETS} presetKey
 */
export function mapCellsByPreset(cells, presetKey) {
  const preset = SHEET_PASTE_PRESETS[presetKey];
  if (!preset) throw new Error(`Preset desconocido: ${presetKey}`);
  const out = {};
  for (const [field, idx] of Object.entries(preset.byIndex)) {
    if (idx == null || idx === undefined) continue;
    out[field] = String(cells[idx] ?? "").trim();
  }
  return out;
}

/** Detecta URL de mapas en cualquier celda. */
export function inferMapLinkFromCells(cells) {
  const re = /https?:\/\/[^\s"'<>]+/gi;
  for (const raw of cells) {
    const s = String(raw || "");
    const m = s.match(re);
    if (!m) continue;
    for (const url of m) {
      if (/google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|waze\.com/i.test(url)) return url.trim();
    }
  }
  return "";
}

/** Primera URL http en celdas (para adjunto si la columna dedicada viene vacía). */
export function inferFirstHttpUrl(cells) {
  const re = /https?:\/\/[^\s"'<>]+/gi;
  for (const raw of cells) {
    const s = String(raw || "");
    const m = s.match(re);
    if (!m) continue;
    for (const url of m) {
      const u = url.trim();
      if (/google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|waze\.com/i.test(u)) continue;
      return u;
    }
  }
  return "";
}

/**
 * Extrae ID de archivo de un enlace de Google Drive.
 * @param {string} url
 * @returns {string|null}
 */
export function googleDriveFileIdFromUrl(url) {
  const s = String(url || "").trim();
  const m1 = s.match(/\/file\/d\/([^/]+)/i);
  if (m1) return m1[1];
  const m2 = s.match(/[?&]id=([^&]+)/i);
  if (m2) return m2[1];
  const m3 = s.match(/\/open\?id=([^&]+)/i);
  if (m3) return m3[1];
  return null;
}

/** URL de miniatura pública (puede fallar si el archivo no es "cualquiera con el enlace"). */
export function driveThumbnailUrl(fileId, size = "w400") {
  if (!fileId) return "";
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=${size}`;
}

export function isLikelyDirectImageUrl(url) {
  return /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(String(url || ""));
}

/**
 * @param {string} url
 * @returns {{ type: 'driveThumb'|'direct'|'pdfOrOther', href: string, imgSrc?: string }}
 */
export function classifyAdjuntoUrl(url) {
  const u = String(url || "").trim();
  if (!u) return { type: "pdfOrOther", href: "" };
  const id = googleDriveFileIdFromUrl(u);
  if (id) {
    return { type: "driveThumb", href: u, imgSrc: driveThumbnailUrl(id) };
  }
  if (isLikelyDirectImageUrl(u)) {
    return { type: "direct", href: u, imgSrc: u };
  }
  return { type: "pdfOrOther", href: u };
}

/**
 * Parseo unificado: 2 líneas con encabezados, o 1 línea + preset por índice.
 * @param {string} text
 * @param {string} presetKey
 */
export function extractStopFieldsFromPaste(text, presetKey) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return { fields: {}, cells: [], mode: "empty", warnings: ["Pegá al menos una fila."] };

  const rows = parseTsvRows(trimmed);
  let fields = {};
  let mode = "index";
  const warnings = [];

  const headerParsed = parseHeaderThenValueRow(trimmed);
  if (headerParsed && Object.keys(headerParsed).length > 0) {
    fields = { ...headerParsed };
    mode = "header";
  } else if (rows.length >= 2) {
    fields = mapCellsByPreset(rows[1], presetKey);
    mode = "index_second_row";
    warnings.push(
      "Hay 2+ líneas sin encabezados reconocidos: se usó la 2.ª fila como datos (1.ª ignorada)."
    );
  } else if (rows.length >= 1) {
    fields = mapCellsByPreset(rows[0], presetKey);
    mode = "index";
  }

  const dataCells = mode === "header" ? rows[1] || [] : mode === "index_second_row" ? rows[1] || [] : rows[0] || [];
  if (rows.length > 1 && mode === "index") {
    warnings.push(
      "Hay varias líneas: se usó solo la primera. Para títulos + valores, la 1.ª fila debe tener encabezados reconocibles."
    );
  }

  const mapInf = inferMapLinkFromCells(rows.flat());
  if (mapInf && !fields.linkUbicacion) fields.linkUbicacion = mapInf;

  if (!fields.linkAdjunto && dataCells.length) {
    const guess = inferFirstHttpUrl(dataCells);
    if (guess && guess !== fields.linkUbicacion) {
      fields.linkAdjunto = fields.linkAdjunto || guess;
    }
  }

  return { fields, cells: dataCells, mode, warnings };
}
