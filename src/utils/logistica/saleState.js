/**
 * Ventas sale / coordination lifecycle for /logistica (Phase B–C).
 * Pure helpers: status enum, chip labels, sheet cell builders, junk-row filter.
 *
 * Planilla 2.0 (gid 926747636 — "Ventas y Coordinaciones"):
 *   F (idx 5)  ESTADO GRAL free text / ops notes
 *   H (idx 7)  FECHA ENTREGA
 * Archive tab (entregado/enviado): "Ventas Realizadas y Entegadas" (typo in sheet).
 */

/** @typedef {'por_coordinar'|'coordinado'|'con_pendientes'|'entregado'|'enviado'} SaleStatus */

export const SALE_STATUSES = /** @type {const} */ ([
  "por_coordinar",
  "coordinado",
  "con_pendientes",
  "entregado",
  "enviado",
]);

/** Labels for UI selects */
export const SALE_STATUS_LABELS = {
  por_coordinar: "Por coordinar",
  coordinado: "Coordinado",
  con_pendientes: "Con pendientes",
  entregado: "Entregado",
  enviado: "Enviado",
};

/** Max simultaneous trucks / transporters in one day */
export const MAX_CAMIONES = 12;

/**
 * Default archive tab titles (same workbook as Ventas).
 * Prefer first match when resolving by title.
 */
export const VENTAS_ARCHIVE_TAB_CANDIDATES = [
  "Enviados",
  "Ventas Realizadas y Entegadas", // live tab name (typo preserved)
  "Ventas Realizadas y Entregadas",
  "Ventas Realizadas E.E",
];

export function normalizeSaleText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * @param {string|number|null|undefined} n
 * @returns {number|null}
 */
export function parseCamionNumber(n) {
  if (n == null || n === "") return null;
  const num = Number(n);
  if (!Number.isFinite(num) || num < 1 || num > MAX_CAMIONES) return null;
  return Math.floor(num);
}

/**
 * Format ISO YYYY-MM-DD → dd/mm (short) or dd/mm/yyyy.
 * @param {string} iso
 * @param {{ fullYear?: boolean }} [opts]
 */
export function formatIsoToDdMm(iso, opts = {}) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
  if (!m) return "";
  if (opts.fullYear) return `${m[3]}/${m[2]}/${m[1]}`;
  return `${m[3]}/${m[2]}`;
}

/**
 * Parse camión marker from free text: "CAMIÓN 2", "Camion #3", "camion:1".
 * @param {string} text
 * @returns {number|null}
 */
export function extractCamionFromText(text) {
  const n = normalizeSaleText(text);
  const m = n.match(/\bcamion(?:es)?\s*[#:]?\s*(\d{1,2})\b/);
  if (!m) return null;
  return parseCamionNumber(m[1]);
}

/**
 * Classify a mapped Ventas row into full sale status.
 * @param {{
 *   estadoText?: string,
 *   estadoGral?: string,
 *   fechaEntrega?: string,
 *   rawSheetText?: string,
 *   saleStatus?: string,
 *   camion?: number|null,
 * }} row
 * @returns {{
 *   status: SaleStatus,
 *   coordDateIso: string|null,
 *   camion: number|null,
 *   batchKey: string|null,
 *   label: string,
 * }}
 */
export function classifySaleStatus(row = {}) {
  if (row.saleStatus && SALE_STATUSES.includes(/** @type {SaleStatus} */ (row.saleStatus))) {
    const iso = String(row.fechaEntrega || "").trim();
    const coordDateIso = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
    const camion = parseCamionNumber(row.camion) ?? extractCamionFromText(row.estadoText || "");
    return {
      status: /** @type {SaleStatus} */ (row.saleStatus),
      coordDateIso,
      camion,
      batchKey: buildBatchKey(/** @type {SaleStatus} */ (row.saleStatus), coordDateIso, camion),
      label: SALE_STATUS_LABELS[/** @type {SaleStatus} */ (row.saleStatus)],
    };
  }

  const blob = normalizeSaleText(
    [row.estadoText, row.estadoGral, row.rawSheetText].filter(Boolean).join("\n"),
  );
  const camion = parseCamionNumber(row.camion) ?? extractCamionFromText(blob);

  // Negated enviado first
  const negatedEnviado =
    /\bno\s+enviad/.test(blob) ||
    /\bsin\s+enviad/.test(blob) ||
    /\bno\s+se\s+envi/.test(blob) ||
    /\bpendiente\s+de\s+envi/.test(blob);

  if (/\bentregad[oa]s?\b/.test(blob) && !/\bno\s+entregad/.test(blob)) {
    return {
      status: "entregado",
      coordDateIso: null,
      camion,
      batchKey: null,
      label: SALE_STATUS_LABELS.entregado,
    };
  }

  if (!negatedEnviado && (/\benviado\b|\benviada\b|\benviados\b/.test(blob) || /\benviad/.test(blob))) {
    return {
      status: "enviado",
      coordDateIso: null,
      camion,
      batchKey: null,
      label: SALE_STATUS_LABELS.enviado,
    };
  }

  if (/\bcon\s+pendientes?\b|\bpendientes?\s+bmc\b|\bentregas?\s+pendientes?\b/.test(blob)) {
    const iso = String(row.fechaEntrega || "").trim();
    const coordDateIso = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
    return {
      status: "con_pendientes",
      coordDateIso,
      camion,
      batchKey: buildBatchKey("con_pendientes", coordDateIso, camion),
      label: SALE_STATUS_LABELS.con_pendientes,
    };
  }

  const iso = String(row.fechaEntrega || "").trim();
  const coordDateIso = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
  if (coordDateIso) {
    return {
      status: "coordinado",
      coordDateIso,
      camion,
      batchKey: buildBatchKey("coordinado", coordDateIso, camion),
      label: SALE_STATUS_LABELS.coordinado,
    };
  }

  return {
    status: "por_coordinar",
    coordDateIso: null,
    camion,
    batchKey: null,
    label: SALE_STATUS_LABELS.por_coordinar,
  };
}

/**
 * @param {SaleStatus} status
 * @param {string|null} dateIso
 * @param {number|null} camion
 */
export function buildBatchKey(status, dateIso, camion) {
  if (status !== "coordinado" && status !== "con_pendientes") return null;
  if (!dateIso) return null;
  return camion ? `${dateIso}|c${camion}` : dateIso;
}

/**
 * Chip secondary caption (e.g. "Coordinado · 22/05 · Camión 2").
 * @param {ReturnType<typeof classifySaleStatus>} c
 */
export function saleStatusChipCaption(c) {
  if (!c) return "";
  const parts = [c.label];
  if (c.coordDateIso) {
    const ddmm = formatIsoToDdMm(c.coordDateIso);
    if (ddmm) parts.push(ddmm);
  }
  if (c.camion) parts.push(`Camión ${c.camion}`);
  return parts.join(" · ");
}

/**
 * Whether row should appear in "Cargar actuales" / active logistics queue.
 * Entregado / Enviado drop off the operational list.
 * @param {ReturnType<typeof classifySaleStatus>|SaleStatus} c
 */
export function isActiveLogisticsSale(c) {
  const status = typeof c === "string" ? c : c?.status;
  return status !== "entregado" && status !== "enviado";
}

/**
 * Remove `[LOGISTICA:…]` markers without nested/polynomial regex (CodeQL ReDoS).
 * Linear scan — safe on adversarial / huge ESTADO cells.
 * @param {string} text
 */
export function stripLogisticaMarkers(text) {
  const s = String(text || "");
  if (!s) return "";
  const lower = s.toLowerCase();
  let out = "";
  let i = 0;
  while (i < s.length) {
    const start = lower.indexOf("[logistica:", i);
    if (start === -1) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, start);
    const close = s.indexOf("]", start);
    if (close === -1) {
      // Unclosed marker — drop the rest of the marker prefix only, keep trailing text if any.
      out += s.slice(start);
      break;
    }
    i = close + 1;
  }
  return out.replace(/[ \t\f\v\u00a0]+/g, " ").replace(/\n+/g, "\n").trim();
}

/**
 * Identity fingerprint for a Ventas row (orderId + nombre + tel + dir).
 * Intentionally ignores ESTADO/fecha so estado updates do not break matching.
 * Used to delete the correct source row after archive append (row indices shift).
 * @param {string[]|null|undefined} cells row cells A=0
 * @param {{ orderId?: number, nombre?: number, tel?: number, dir?: number }} [idx]
 */
export function ventasRowIdentityFingerprint(cells, idx = {}) {
  const orderIdIdx = idx.orderId ?? 2;
  const nombreIdx = idx.nombre ?? 8;
  const telIdx = idx.tel ?? 15;
  const dirIdx = idx.dir ?? 9;
  const row = Array.isArray(cells) ? cells : [];
  const parts = [orderIdIdx, nombreIdx, telIdx, dirIdx].map((i) =>
    String(row[i] ?? "")
      .trim()
      .replace(/\s+/g, " "),
  );
  return parts.join("\u0001");
}

/**
 * Find 1-based sheet row whose identity fingerprint matches.
 * Prefers hintRow1Based when still matching (fast path).
 * @param {string[][]} dataRows rows from sheet starting at row 2 (index 0 = sheet row 2)
 * @param {string} fingerprint
 * @param {number} [hintRow1Based]
 * @returns {number|null} 1-based row number or null
 */
export function findSheetRow1BasedByFingerprint(dataRows, fingerprint, hintRow1Based) {
  const fp = String(fingerprint || "");
  if (!fp || !Array.isArray(dataRows)) return null;
  if (Number.isFinite(hintRow1Based) && hintRow1Based >= 2) {
    const hintIdx = hintRow1Based - 2;
    if (hintIdx >= 0 && hintIdx < dataRows.length) {
      if (ventasRowIdentityFingerprint(dataRows[hintIdx]) === fp) return hintRow1Based;
    }
  }
  for (let i = 0; i < dataRows.length; i += 1) {
    if (ventasRowIdentityFingerprint(dataRows[i]) === fp) return i + 2;
  }
  return null;
}

/** Statuses that require archive move via logistica-entregado — not plain estado write. */
export const TERMINAL_SALE_STATUSES = /** @type {const} */ (["entregado", "enviado"]);

export function isTerminalSaleStatus(status) {
  return TERMINAL_SALE_STATUSES.includes(/** @type {'entregado'|'enviado'} */ (status));
}

/**
 * Strip previous LOGISTICA markers then append new ones.
 * Keeps human free-text (pagos, notes).
 * @param {string} existingEstado
 * @param {{
 *   status: SaleStatus,
 *   fechaIso?: string|null,
 *   camion?: number|null,
 *   transportista?: string,
 *   comment?: string,
 * }} opts
 */
export function buildEstadoSheetValue(existingEstado, opts) {
  const base = stripLogisticaMarkers(existingEstado);

  const status = opts.status;
  const parts = [`LOGISTICA:${status.toUpperCase()}`];
  if (opts.fechaIso) {
    const d = formatIsoToDdMm(opts.fechaIso, { fullYear: true });
    if (d) parts.push(`FECHA=${d}`);
  }
  if (opts.camion) parts.push(`CAMION=${opts.camion}`);
  if (opts.transportista) parts.push(`TTE=${String(opts.transportista).slice(0, 40)}`);
  if (opts.comment) {
    parts.push(`NOTA=${String(opts.comment).replace(/[[\]]/g, "").slice(0, 120)}`);
  }

  const marker = `[${parts.join(" ")}]`;
  return base ? `${base} ${marker}` : marker;
}

/**
 * Body for POST /api/ventas/logistica-estado
 * @param {{
 *   status: SaleStatus,
 *   fechaEntrega?: string|null,
 *   camion?: number|null,
 *   transportista?: string,
 *   comment?: string,
 *   existingEstadoText?: string,
 * }} input
 */
export function buildLogisticaEstadoPayload(input) {
  const status = input.status;
  if (!SALE_STATUSES.includes(status)) {
    return { ok: false, error: "invalid_status" };
  }
  if (status === "coordinado") {
    const iso = String(input.fechaEntrega || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      return { ok: false, error: "fecha_required_for_coordinado" };
    }
  }
  const camion = parseCamionNumber(input.camion);
  if (status === "coordinado" && camion == null && input.camion != null && input.camion !== "") {
    return { ok: false, error: "invalid_camion" };
  }

  const fechaForSheet =
    status === "por_coordinar"
      ? ""
      : status === "coordinado" || status === "con_pendientes"
        ? String(input.fechaEntrega || "").trim()
        : String(input.fechaEntrega || "").trim() || "";

  return {
    ok: true,
    status,
    fechaEntrega: fechaForSheet,
    camion: camion,
    transportista: input.transportista ? String(input.transportista).slice(0, 80) : "",
    estadoText: buildEstadoSheetValue(input.existingEstadoText || "", {
      status,
      fechaIso: fechaForSheet || null,
      camion,
      transportista: input.transportista,
      comment: input.comment,
    }),
  };
}

/**
 * True when a CSV/data row is a repeated section header (NOMBRE / FECHA ENTREGA labels).
 * @param {{ nombre?: string, orderId?: string, dir?: string, fechaEntrega?: string, estadoText?: string }} mapped
 */
export function isJunkVentasMappedRow(mapped = {}) {
  const nombre = String(mapped.nombre || "").trim();
  if (!nombre && !mapped.orderId && !mapped.dir) {
    // Week separators often only have fecha text like "Semana del …" — keep if they have usable fecha? skip empty names for search.
    if (!mapped.fechaEntrega && !String(mapped.estadoText || "").trim()) return true;
  }
  if (/^(nombre|cliente|name)(\s+\1)?$/i.test(nombre)) return true;
  if (/^fecha\s*entrega/i.test(String(mapped.fechaEntrega || ""))) return true;
  // Provider banner rows: nombre empty-ish but estado is "BECAM 100% de Seña…"
  if (
    (!nombre || /^(nombre|cliente)$/i.test(nombre)) &&
    /^(becam|bromyros|montfrio|dac|ecopanels)/i.test(String(mapped.estadoText || "").trim())
  ) {
    return true;
  }
  return false;
}

/**
 * Attach sale chip DTO (extends coordination chip).
 * @param {object} mapped
 */
export function withSaleStatusChip(mapped) {
  const sale = classifySaleStatus(mapped);
  return {
    ...mapped,
    saleStatus: sale.status,
    camion: sale.camion,
    coordination: {
      status:
        sale.status === "entregado" || sale.status === "enviado"
          ? "enviado"
          : sale.status === "coordinado" || sale.status === "con_pendientes"
            ? "coordinado"
            : "por_coordinar",
      coordDateIso: sale.coordDateIso,
      batchKey: sale.batchKey,
      label: sale.label,
    },
    coordinationCaption: saleStatusChipCaption(sale),
    saleCaption: saleStatusChipCaption(sale),
    coordinationColor: batchColorFromKey(sale.batchKey),
  };
}

/**
 * Stable pastel from batch key.
 * @param {string|null|undefined} batchKey
 */
export function batchColorFromKey(batchKey) {
  if (!batchKey) return "#94a3b8";
  let h = 0;
  const s = String(batchKey);
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return `hsl(${h % 360} 62% 42%)`;
}

/**
 * Resolve transportista name for camión N from a list.
 * @param {Array<{id?:string,nombre:string}>} transportistas
 * @param {number|null} camion
 * @param {Record<string,string>} [camionMap] optional camion→nombre map
 */
export function transportistaForCamion(transportistas, camion, camionMap = {}) {
  if (!camion) return "";
  const mapped = camionMap[String(camion)] || camionMap[camion];
  if (mapped) return String(mapped);
  const list = Array.isArray(transportistas) ? transportistas : [];
  const idx = camion - 1;
  if (idx >= 0 && idx < list.length) return String(list[idx].nombre || "");
  return "";
}
