/**
 * BMC logística — motor de empaquetado y colocación (puro, sin DOM ni fetch).
 * Guía operativa: no sustituye ingeniería estructural ni peso legal del vehículo.
 */

let _defaultId = 0;
function defaultUid() {
  return String(++_defaultId);
}

/** Reinicia el contador de IDs por defecto (tests). */
export function resetDefaultCargoIds() {
  _defaultId = 0;
}

export const TRUCK_W = 2.4;
export const ROW_W = 1.2;
export const MAX_H = 1.5;
export const MAX_OVH = 2.0;

/** Multiplicadores de área por tipo (reservado / futuro peso-volumen). */
export const AREA_USE = { ISODEC: 1.12, ISOROOF: 1.1 };

/** Máximo de paneles por paquete según espesor (mm). */
export const MAX_P = {
  40: 12,
  50: 10,
  60: 10,
  80: 8,
  100: 8,
  150: 6,
  200: 4,
  250: 3,
};

export const COLORS = [
  "#2563EB",
  "#059669",
  "#D97706",
  "#DC2626",
  "#7C3AED",
  "#DB2777",
  "#0891B2",
  "#EA580C",
];

export const TIPOS = ["ISODEC", "ISOPANEL", "ISOROOF", "ISOWALL", "ISOFRIG", "ISOFRIG_PIR"];
export const ESPS = [40, 50, 60, 80, 100, 150, 200, 250];
export const LENS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function aw(tipo) {
  return AREA_USE[tipo] || 1.0;
}

/** Altura del paquete (m) según espesor mm y cantidad apilada en el paquete. */
export function ph(espesorMm, n) {
  return +(
    0.1 +
    n * (espesorMm / 1000) +
    Math.max(0, n - 1) * 0.02
  ).toFixed(4);
}

/**
 * @param {string} direccion
 * @param {string} [zona]
 * @param {string} [linkUbicacion]
 * @returns {string} URL de mapas o cadena vacía si no hay datos
 */
export function mapsUrlFromStop(direccion, zona, linkUbicacion) {
  const link = linkUbicacion != null ? String(linkUbicacion).trim() : "";
  if (link) return link;
  const q = [direccion, zona].filter((x) => x != null && String(x).trim() !== "").map(String).join(", ");
  if (!q) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

const ROW_URL_RE = /https?:\/\/[^\s"'<>]+/gi;

function trimUrlTail(u) {
  return String(u || "")
    .trim()
    .replace(/[,;.)'"]+$/g, "");
}

/**
 * Copia superficial de una fila de planilla / API (objeto plano).
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>}
 */
export function snapshotSheetRow(row) {
  if (!row || typeof row !== "object") return {};
  try {
    if (typeof structuredClone === "function") return /** @type {Record<string, unknown>} */ (structuredClone(row));
  } catch {
    /* fall through */
  }
  try {
    return JSON.parse(JSON.stringify(row));
  } catch {
    return { ...row };
  }
}

/**
 * URLs http(s) encontradas en cualquier celda de la fila.
 * @param {Record<string, unknown>} row
 * @returns {string[]}
 */
export function collectUrlsFromRow(row) {
  const found = [];
  if (!row || typeof row !== "object") return found;
  for (const v of Object.values(row)) {
    const s = String(v ?? "");
    let m;
    const re = new RegExp(ROW_URL_RE.source, "gi");
    while ((m = re.exec(s))) found.push(trimUrlTail(m[0]));
  }
  return [...new Set(found)];
}

/**
 * Primer enlace que parezca mapa (Google / Waze / goo.gl maps).
 * @param {Record<string, unknown>} row
 */
export function inferLinkMapFromRow(row) {
  for (const u of collectUrlsFromRow(row)) {
    if (/google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|waze\.com/i.test(u)) return u;
  }
  return "";
}

/**
 * Primer enlace útil como adjunto (Drive / Docs / PDF), excluyendo mapas.
 * @param {Record<string, unknown>} row
 */
export function inferLinkAdjuntoFromRow(row) {
  for (const u of collectUrlsFromRow(row)) {
    if (/google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|waze\.com/i.test(u)) continue;
    if (/drive\.google\.com|docs\.google\.com|\.pdf(\?|$)/i.test(u)) return u;
  }
  for (const u of collectUrlsFromRow(row)) {
    if (/google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|waze\.com/i.test(u)) continue;
    return u;
  }
  return "";
}

/**
 * Regla: pedidos distintos no se combinan; se generan paquetes más chicos si hace falta.
 * @param {{ id: string, orden: number, cliente?: string, color?: string }} stop
 * @param {{ tipo: string, espesor: number, longitud: number, cantidad: number }} panel
 * @param {() => string} [uid]
 */
export function buildPkgs(stop, panel, uid = defaultUid) {
  const max = MAX_P[panel.espesor] || 8;
  let rem = Number(panel.cantidad);
  const pkgs = [];
  while (rem > 0) {
    const n = Math.min(rem, max);
    pkgs.push({
      id: uid(),
      sId: stop.id,
      sOrd: stop.orden,
      sCol: stop.color,
      sCli: stop.cliente,
      tipo: panel.tipo,
      esp: Number(panel.espesor),
      len: Number(panel.longitud),
      n,
      h: ph(panel.espesor, n),
    });
    rem -= n;
  }
  return pkgs;
}

/**
 * Colocación simplificada: máx 2 filas, altura máx, saliente máx.
 * Orden de carga = inverso al orden de entrega (última parada al fondo).
 * @param {Array<{ id: string, orden: number, cliente?: string, color?: string, paneles: Array<{ tipo: string, espesor: number, longitud: number, cantidad: number }> }>} stops
 * @param {number} trL largo carrocería (m)
 * @param {() => string} [uid]
 */
export function placeCargo(stops, trL, uid = defaultUid) {
  const all = [...stops]
    .sort((a, b) => a.orden - b.orden)
    .flatMap((s) => s.paneles.flatMap((p) => buildPkgs(s, p, uid)));
  if (!all.length) {
    return { placed: [], rowH: [0, 0], warns: [], maxLen: trL };
  }
  const load = [...all].sort((a, b) => b.sOrd - a.sOrd);
  const rowH = [0, 0];
  const placed = [];
  const warns = new Set();
  load.forEach((pkg) => {
    const ovh = Math.max(0, pkg.len - trL);
    if (ovh > MAX_OVH) {
      warns.add(
        `P${pkg.sOrd}: panel ${pkg.len}m sobresale ${ovh.toFixed(1)}m (máx ${MAX_OVH}m)`
      );
    }
    let row = rowH[0] <= rowH[1] ? 0 : 1;
    if (rowH[row] + pkg.h > MAX_H + 0.001) {
      const alt = 1 - row;
      if (rowH[alt] + pkg.h <= MAX_H + 0.001) row = alt;
      else warns.add(`P${pkg.sOrd}: excede ${MAX_H}m — requiere 2° camión`);
    }
    const ov = rowH[row] + pkg.h > MAX_H + 0.001;
    placed.push({
      ...pkg,
      row,
      zBase: rowH[row],
      ovh,
      ov,
    });
    rowH[row] += pkg.h;
  });
  return {
    placed,
    rowH,
    warns: [...warns],
    maxLen: Math.max(...placed.map((p) => p.len), trL),
  };
}

/**
 * @param {number} orden 1-based
 * @param {typeof COLORS} colors
 */
export function mkStop(orden, colors = COLORS, uid = defaultUid) {
  const i = Math.max(0, orden - 1);
  return {
    id: uid(),
    orden,
    cliente: "",
    telefono: "",
    direccion: "",
    zona: "",
    linkUbicacion: "",
    linkAdjunto: "",
    cotizacionId: "",
    color: colors[i % colors.length],
    paneles: [],
    accesorios: [],
  };
}

export function mkPanel(uid = defaultUid) {
  return {
    id: uid(),
    tipo: "ISODEC",
    espesor: 100,
    longitud: 6,
    cantidad: 1,
  };
}

export function mkAcc(uid = defaultUid) {
  return {
    id: uid(),
    descr: "",
    cantidad: 1,
  };
}

/**
 * Convierte una fila canónica de `GET /api/proximas-entregas` en una parada vacía (sin paneles).
 * @param {Record<string, string>} row — p. ej. COTIZACION_ID, CLIENTE_NOMBRE, TELEFONO, DIRECCION, ZONA, LINK_UBICACION
 * @param {number} orden — 1-based
 */
export function stopFromProximaRow(row, orden, colors = COLORS, uid = defaultUid) {
  const i = orden - 1;
  const linkAdjunto =
    String(row.LINK_COTIZACION ?? row.LINK_ADJUNTO ?? "").trim() || inferLinkAdjuntoFromRow(row);
  const linkUbicacion = String(row.LINK_UBICACION ?? "").trim() || inferLinkMapFromRow(row);
  return {
    id: uid(),
    orden,
    cliente: String(row.CLIENTE_NOMBRE ?? row.Cliente ?? "").trim(),
    telefono: String(row.TELEFONO ?? row["Teléfono"] ?? "").trim(),
    direccion: String(row.DIRECCION ?? row["Ubicación / Dirección"] ?? "").trim(),
    zona: String(row.ZONA ?? "").trim(),
    linkUbicacion,
    linkAdjunto,
    cotizacionId: String(row.COTIZACION_ID ?? row.ID ?? "").trim(),
    color: colors[i % colors.length],
    paneles: [],
    accesorios: [],
    /** Snapshot de todas las columnas devueltas por la API / pegado JSON (CRM + canónicos). */
    rawSheet: snapshotSheetRow(row),
  };
}
