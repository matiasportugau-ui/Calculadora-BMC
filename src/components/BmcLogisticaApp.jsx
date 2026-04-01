import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { parseLogisticaFromAdjuntoText } from "../../docs/bmc-dashboard-modernization/logistica-carga-prototype/lib/adjuntoLineParse.js";
import { extractTextFromPdfArrayBuffer } from "../../docs/bmc-dashboard-modernization/logistica-carga-prototype/lib/pdfTextExtract.js";
import { MAX_H, MANUAL_LAYOUT_VERSION, panelStableKey, accessoryStableKey } from "../utils/bmcLogisticaCargo.js";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import { parsePedidoRetiroFromFreeText, parsePedidoFromColumnC, parsePickupIdFromColumnF } from "../utils/ventasPedidoRetiroParse.js";
import { bedViewExtents, mirrorStackForView, buildLogisticaPlanExportPayload } from "../utils/bmcLogisticaBedView.js";

const TRUCK_W = 2.4;
const ROW_W = 1.2;

/** Largo esquemático de cabina (solo dibujo orientativo, no afecta el motor de carga). */
const CAB_LEN_M = 2.4;
/** Altura cabina en vista lateral (m; escala vertical = SVZ px/m, mismo eje que paquetes). */
const CAB_HEIGHT_M = 1.5;
const MAX_OVH = 2.0;
const MAX_P = { 40: 12, 50: 10, 60: 10, 80: 8, 100: 8, 150: 6, 200: 4, 250: 3 };
const COLORS = ["#0071e3", "#34c759", "#ff9f0a", "#ff3b30", "#af52de", "#ff375f", "#5ac8fa", "#ff6b00"];
const TIPOS = ["ISODEC", "ISOPANEL", "ISOROOF", "ISOWALL", "ISOFRIG", "ISOFRIG_PIR"];
const ESPS = [40, 50, 60, 80, 100, 150, 200, 250];
const LENS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const SH_ID = "1KFNKWLQmBHj_v8BZJDzLklUtUPbNssbYEsWcmc0KPQA";
const SH_GID = "926747636";
const STORAGE_KEY = "bmc-logistica-online-v2";
const STORAGE_KEY_LEGACY = "bmc-logistica-online-v1";

const LogisticaCargoScene3d = lazy(() => import("./logistica/LogisticaCargoScene3d.jsx"));
const DEFAULT_ACC_W = 0.3;
const DEFAULT_ACC_H = 0.2;
const DEFAULT_ACC_FOAM_MM = 50;
const STOP_STATUS = ["Pendiente", "Lista para carga", "Cargada", "En reparto", "Entregada", "Observada"];
const RECEPCION_STATUS = ["Pendiente", "Conforme", "Faltante", "Daño", "No recibido"];
const DISTRIBUTION_MODES = [
  { id: "balanced", label: "Auto balanceado", short: "Balanceado" },
  { id: "compact", label: "Compacto", short: "Compacto" },
  { id: "doorPriority", label: "Acceso rápido", short: "Acceso rápido" },
];
const CHECK_KEYS = [
  ["datosOk", "Datos OK"],
  ["mapaOk", "Mapa OK"],
  ["adjuntoOk", "Adjunto OK"],
  ["bultosOk", "Bultos OK"],
  ["accesoriosOk", "Accesorios OK"],
  ["recepcionAvisada", "Recepción avisada"],
];

const T = {
  bg: "#f5f5f7",
  surface: "#ffffff",
  surfaceAlt: "#fafafa",
  primary: "#0071e3",
  brand: "#1a3a5c",
  text: "#1d1d1f",
  muted: "#6e6e73",
  border: "#e5e5ea",
  success: "#34c759",
  danger: "#ff3b30",
  warning: "#ff9f0a",
  shadow: "0 1px 3px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.06)",
  radius: 12,
  font: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif",
};

const css = {
  card: {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: T.radius,
    boxShadow: T.shadow,
  },
  inp: {
    width: "100%",
    padding: "9px 12px",
    border: `1.5px solid ${T.border}`,
    borderRadius: 10,
    background: T.surface,
    color: T.text,
    fontSize: 13,
    fontFamily: T.font,
    boxSizing: "border-box",
  },
  lbl: {
    display: "block",
    fontSize: 11,
    color: T.muted,
    fontWeight: 600,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: ".05em",
  },
  sectionTitle: {
    margin: "0 0 10px",
    color: T.brand,
    fontWeight: 700,
    fontSize: 14,
  },
};

function Btn({
  children,
  onClick,
  color = T.primary,
  outline = false,
  small = false,
  disabled = false,
  style = {},
  href,
  target,
}) {
  const s = {
    padding: small ? "6px 11px" : "8px 14px",
    borderRadius: 10,
    border: outline ? `1.5px solid ${T.border}` : "none",
    background: outline ? T.surface : color,
    color: outline ? T.text : "#fff",
    fontWeight: 600,
    fontSize: 13,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: T.font,
    opacity: disabled ? 0.5 : 1,
    textDecoration: "none",
    display: "inline-block",
    whiteSpace: "nowrap",
    ...style,
  };
  if (href) return <a href={href} target={target} rel={target === "_blank" ? "noopener noreferrer" : undefined} style={s}>{children}</a>;
  return <button type="button" onClick={onClick} disabled={disabled} style={s}>{children}</button>;
}

/** Cabina esquemática — vista superior (solo orientación). */
function TruckCabTopSvg({ x, y, w, h, stroke, fill }) {
  const hood = w * 0.26;
  return (
    <g>
      <rect x={x + hood} y={y} width={w - hood} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} rx={2} />
      <polygon points={`${x},${y + h * 0.14} ${x + hood},${y} ${x + hood},${y + h} ${x},${y + h * 0.86}`} fill={fill} stroke={stroke} strokeWidth={1.2} />
      <polygon points={`${x + hood * 0.32},${y + h * 0.26} ${x + hood * 0.88},${y + h * 0.16} ${x + hood * 0.85},${y + h * 0.54} ${x + hood * 0.22},${y + h * 0.6}`} fill="rgba(100,160,255,.22)" stroke={stroke} strokeWidth={0.8} />
      <text x={x + w / 2} y={y + h + 11} textAnchor="middle" fontSize={7} fill={T.muted}>Cabina</text>
    </g>
  );
}

/** Cabina esquemática — vista lateral (perfil; groundY = suelo; altura ≈ CAB_HEIGHT_M en escala svz px/m). */
function TruckCabSideSvg({ x, cabW, groundY, stroke, fill, showLabel = true, svz }) {
  const cabH_px = CAB_HEIGHT_M * svz;
  const cabBot = groundY;
  const cabTop = cabBot - cabH_px;
  const windshield = cabW * 0.24;
  const ch = cabBot - cabTop;
  return (
    <g>
      <rect x={x + windshield} y={cabTop} width={cabW - windshield} height={ch} fill={fill} stroke={stroke} strokeWidth={1.5} rx={2} />
      <polygon points={`${x},${cabTop + ch * 0.18} ${x + windshield},${cabTop} ${x + windshield},${cabBot} ${x},${cabBot - ch * 0.04}`} fill={fill} stroke={stroke} strokeWidth={1.2} />
      <polygon points={`${x + windshield * 0.32},${cabTop + ch * 0.22} ${x + windshield * 0.9},${cabTop + ch * 0.1} ${x + windshield * 0.85},${cabTop + ch * 0.52} ${x + windshield * 0.18},${cabTop + ch * 0.55}`} fill="rgba(100,160,255,.2)" stroke={stroke} strokeWidth={0.8} />
      {showLabel ? <text x={x + cabW / 2} y={cabTop - 3} textAnchor="middle" fontSize={7} fill={T.muted}>Cabina</text> : null}
    </g>
  );
}

let _id = 0;
const uid = () => String(++_id);
const ph = (e, n) => +(0.1 + n * (e / 1000) + Math.max(0, n - 1) * 0.02).toFixed(4);
const today = () => new Date().toISOString().slice(0, 10);
const envNo = () => `ENV-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-001`;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const normAccKey = (s) => normalizeText(String(s || "")).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function getAccessoryProfileKey(accesorios) {
  return [...new Set((accesorios || []).map((acc) => normAccKey(acc.descr)).filter(Boolean))].sort().join("+");
}

function getStopLongestLength(stop) {
  const fromPanels = Math.max(0, ...((stop?.paneles || []).map((panel) => safeNum(panel.longitud))));
  return fromPanels || 3;
}

function accessoryPresetFor(accesorios) {
  const raw = (accesorios || []).map((acc) => String(acc.descr || "")).join(" ").toLowerCase();
  if (/cumbrera|babeta|tapajunta|zingueria|perfil/.test(raw)) return { ancho: 0.22, alto: 0.14, label: "Perfil / zingueria" };
  if (/tornillo|fijacion|arandela|remache/.test(raw)) return { ancho: 0.2, alto: 0.12, label: "Fijaciones" };
  if (/silicona|sellador|espuma|burlete|cinta/.test(raw)) return { ancho: 0.26, alto: 0.18, label: "Sellado / espuma" };
  if (/puerta|ventana|marco/.test(raw)) return { ancho: 0.45, alto: 0.3, label: "Aberturas / marcos" };
  return { ancho: DEFAULT_ACC_W, alto: DEFAULT_ACC_H, label: "General" };
}

function buildAccessoryPackageConfig(stop, accProfiles = {}, options = {}) {
  const key = getAccessoryProfileKey(stop?.accesorios || []);
  const saved = key ? accProfiles[key] : null;
  const preset = accessoryPresetFor(stop?.accesorios || []);
  const current = stop?.accPackage || {};
  const preferCurrent = options.preferCurrent !== false;
  return {
    enabled: (stop?.accesorios || []).length > 0,
    longitud: safeNum(preferCurrent ? current.longitud : undefined, saved?.longitud || getStopLongestLength(stop)),
    ancho: clamp(safeNum(preferCurrent ? current.ancho : undefined, saved?.ancho || preset.ancho), 0.2, 0.5),
    alto: clamp(safeNum(preferCurrent ? current.alto : undefined, saved?.alto || preset.alto), 0.1, 0.5),
    foamMm: clamp(safeNum(preferCurrent ? current.foamMm : undefined, saved?.foamMm || DEFAULT_ACC_FOAM_MM), 0, 100),
    manualDims: Boolean(current.manualDims),
    profileKey: key,
    profileLabel: saved ? `Guardado: ${key}` : preset.label,
  };
}

const mkStop = (i) => ({
  id: uid(),
  orden: i + 1,
  cliente: "",
  telefono: "",
  direccion: "",
  cotizacionId: "",
  orderId: "",
  pickupId: "",
  zona: "",
  contactoRecepcion: "",
  horarioEntrega: "",
  /** YYYY-MM-DD; sincroniza a columna G de la planilla Ventas si hay fila vinculada */
  fechaEntrega: "",
  /** Fila 1-based en la pestaña Ventas (CSV gviz: fila datos = índice + 2) */
  ventasSheetRow1Based: null,
  ventasTabGid: "",
  pdfLink: "",
  mapLink: "",
  rawSheetText: "",
  estado: "Pendiente",
  recepcionEstado: "Pendiente",
  recepcionDetalle: "",
  observacionesLogistica: "",
  checks: {
    datosOk: false,
    mapaOk: false,
    adjuntoOk: false,
    bultosOk: false,
    accesoriosOk: false,
    recepcionAvisada: false,
  },
  color: COLORS[i % 8],
  paneles: [],
  accesorios: [],
  accPackage: {
    enabled: false,
    longitud: 3,
    ancho: DEFAULT_ACC_W,
    alto: DEFAULT_ACC_H,
    foamMm: DEFAULT_ACC_FOAM_MM,
    manualDims: false,
    profileKey: "",
    profileLabel: "General",
  },
});
const mkPanel = () => ({ id: uid(), tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 1 });
const mkAcc = () => ({ id: uid(), descr: "", cantidad: 1 });
const mapsUrl = (a) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a || "")}`;

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.trim());
    if (row.some((v) => v !== "")) rows.push(row);
  }
  return rows;
}

function normalizeText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function extractGoogleDriveFileId(url) {
  const s = String(url || "");
  const m1 = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return "";
}

function toFetchablePdfUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  const driveId = extractGoogleDriveFileId(raw);
  if (driveId) return `https://drive.google.com/uc?export=download&id=${driveId}`;
  return raw;
}

async function inferPanelsAndAccessoriesFromPdf(url) {
  const warnings = [];
  if (!url) return { paneles: [], accesorios: [], warnings };

  const fetchUrl = toFetchablePdfUrl(url);
  let res;
  try {
    res = await fetch(fetchUrl);
  } catch (e) {
    return { paneles: [], accesorios: [], warnings: [`No se pudo descargar el adjunto: ${e.message}`] };
  }
  if (!res.ok) {
    return { paneles: [], accesorios: [], warnings: [`Adjunto no accesible (${res.status}). Revisar permisos del PDF/Drive.`] };
  }

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("pdf") || /\.pdf(\?|$)/i.test(fetchUrl)) {
    const buffer = await res.arrayBuffer();
    const pdf = await extractTextFromPdfArrayBuffer(buffer, { maxPages: 20 });
    const parsed = parseLogisticaFromAdjuntoText(pdf.text || "");
    return {
      paneles: parsed.paneles,
      accesorios: parsed.accesorios,
      warnings: [...pdf.warnings, ...parsed.warnings],
    };
  }

  const text = await res.text();
  const parsed = parseLogisticaFromAdjuntoText(text || "");
  return {
    paneles: parsed.paneles,
    accesorios: parsed.accesorios,
    warnings: parsed.warnings,
  };
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
      /pedido|consulta|detalle|descripcion|producto|observ|nota|item|panel|accesorio|obra|material|bulto|unidad|encargo|resumen|lista|linea|cant\.|cantidad|qty/.test(h) &&
      !/cliente|direccion|telefono|celular|pdf|adjunto|archivo|mail/.test(h)
    ) {
      preferred.push(line);
    }
  });
  return [...preferred, ...all].join("\n");
}

/**
 * Planilla Ventas — columnas F vs G (operativo logístico):
 * - **F** (título típico `FECHA ENTREGA` u otro): resumen de **estado en texto**; los datos van separados por `/`.
 *   Ahí vive el **Nº Retiro** (tras mail a fábrica pidiendo retiro, post análisis de carga); en la planilla puede
 *   mostrarse en **rojo** si está producido o cuándo se producirá (formato Sheets, no se replica en la app).
 * - **G**: **fecha de entrega** que definís al **coordinar la logística** — lectura/escritura desde esta app (`fechaDeEntregaG` o índice 6).
 */
function buildHeaderIndexMap(headers) {
  const map = {};
  if (!Array.isArray(headers)) return map;
  headers.forEach((h, i) => {
    const n = normalizeText(String(h || ""));
    if (!n) return;
    if (/(^id|nro|numero|#).*pedido|pedido.*id|^pedido$|^order|id.*pedido/.test(n) && map.orderId == null) map.orderId = i;
    if (/cotiz|remito|factura/.test(n) && map.cotizacionId == null) map.cotizacionId = i;
    if (/id.*retiro|retiro|pickup/.test(n) && map.pickupId == null) map.pickupId = i;
    if (/^zona|^barrio|^localidad/.test(n) && map.zona == null) map.zona = i;
    if (/recepcion|receptor|contacto.*entrega/.test(n) && map.recepcionContacto == null) map.recepcionContacto = i;
    if (/^cliente|^nombre/.test(n) && map.nombre == null) map.nombre = i;
    if (/direccion|^dir$|domicilio/.test(n) && map.dir == null) map.dir = i;
    if (/telefono|celular|^tel$/.test(n) && map.tel == null) map.tel = i;
    if (/pdf|adjunto|archivo|link/.test(n) && map.pdf == null) map.pdf = i;
    /** G: encabezado con "fecha … de … entrega" = fecha coordinada logística (no el resumen F). */
    if (/fecha\s*de\s*entrega/i.test(n) && map.fechaDeEntregaG == null) map.fechaDeEntregaG = i;
    /** F u otras: "FECHA ENTREGA" / texto estado + Nº Retiro (no confundir con fecha G). */
    if (/fecha.*entrega|fecha entrega/i.test(n) && map.fechaEntrega == null && map.fechaDeEntregaG !== i) {
      map.fechaEntrega = i;
    }
    if (
      /estado|gral|fact\.|pu \d+ y pu|entregas pendientes/i.test(n) &&
      map.estadoText == null &&
      !/^fecha/i.test(n) &&
      !/facturacion|datos fact/i.test(n)
    ) {
      map.estadoText = i;
    }
  });
  return map;
}

function getVentasCell(map, row, key, legacyIdx) {
  const idx = map[key] != null ? map[key] : legacyIdx;
  if (idx == null || idx < 0 || !row || idx >= row.length) return "";
  return String(row[idx] || "").trim();
}

/** Columna C (índice 2): solo ID / Nº Pedido. */
function getVentasColumnC(row) {
  if (!row || row.length <= 2) return "";
  return String(row[2] ?? "").trim();
}

/** Columna F (índice 5): resumen estado (/, Nº Retiro, etc.); no es la fecha G. */
function getVentasColumnF(row) {
  if (!row || row.length <= 5) return "";
  return String(row[5] ?? "").trim();
}

/** Columna G (índice legacy 6 si A=0): fecha de entrega coordinada en logística. */
function getVentasFechaDeEntregaCell(H, row) {
  return getVentasCell(H, row, "fechaDeEntregaG", 6);
}

/** Convierte DD/MM/YYYY (celda) → YYYY-MM-DD para input type=date. */
function parsePlanillaFechaGToIso(cell) {
  const t = String(cell ?? "").trim();
  if (!t) return "";
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m2) return t;
  return "";
}

function mapVentasRow(headers, row, sheetRow1Based) {
  const H = buildHeaderIndexMap(headers);
  const fromC = parsePedidoFromColumnC(getVentasColumnC(row));
  let orderId = fromC.orderId || "";
  if (fromC.source === "empty") {
    orderId = getVentasCell(H, row, "orderId", null) || "";
  }

  let pickupId = parsePickupIdFromColumnF(getVentasColumnF(row));
  if (!pickupId) pickupId = getVentasCell(H, row, "pickupId", null) || "";

  const estadoText = getVentasCell(H, row, "estadoText", 4) || "";
  const fechaEntregaText = getVentasCell(H, row, "fechaEntrega", 5) || "";
  const parsedIds = parsePedidoRetiroFromFreeText([estadoText, fechaEntregaText].filter(Boolean).join("\n"));
  if (!String(orderId).trim() && parsedIds.orderId) orderId = parsedIds.orderId;
  if (!String(pickupId).trim() && parsedIds.pickupId) pickupId = parsedIds.pickupId;

  return {
    nombre: getVentasCell(H, row, "nombre", 7) || getVentasCell(H, row, "cliente", 7) || "",
    dir: getVentasCell(H, row, "dir", 8),
    pdf: getVentasCell(H, row, "pdf", 9),
    tel: getVentasCell(H, row, "tel", 14),
    orderId,
    cotizacionId: getVentasCell(H, row, "cotizacionId", null) || "",
    pickupId,
    zona: getVentasCell(H, row, "zona", null) || "",
    recepcionContacto: getVentasCell(H, row, "recepcionContacto", null) || "",
    rawSheetText: buildSheetFallbackText(headers, row),
    fechaEntrega: parsePlanillaFechaGToIso(getVentasFechaDeEntregaCell(H, row)),
    ventasSheetRow1Based: sheetRow1Based ?? null,
    ventasTabGid: SH_GID,
  };
}

function orderDisplayId(stop) {
  const o = (stop.orderId || stop.cotizacionId || "").trim();
  return o || `P${stop.orden}`;
}

function generatePickupEmailSubject(stops) {
  const labels = stops.map(orderDisplayId);
  if (labels.length <= 1) {
    return `Metalog - Coordinación Retiro Pedido (${labels[0] || "—"})`;
  }
  return `Metalog - Coordinación Retiro Pedidos ${labels.map((id) => `(${id})`).join(" ")}`;
}

function generatePickupEmailBody(stops, cargo, info) {
  const fecha = info.fecha || "—";
  const ids = stops.map(orderDisplayId);
  if (ids.length === 0) return "Agregá al menos una parada.";
  let body = "Hola, buena jornada!\n\n";
  if (ids.length === 1) {
    body += `Quiero que el día ${fecha} se retirara el siguiente pedido: ${ids[0]}.`;
  } else {
    body += `Quiero que el día ${fecha} se retiraran los siguientes pedidos: ${ids.join(", ")}.\n\n`;
    body += "Dado el orden de descargas y ruta de este viaje sugerimos que la carga sea de la siguiente forma:\n\n";
    const sorted = [...(cargo.stopUnloadOrder || [])].sort((a, b) => a.firstRank - b.firstRank);
    const loadOrder = [...sorted].reverse();
    loadOrder.forEach((entry, i) => {
      body += `${i + 1}. ${orderDisplayId(entry.stop)}\n`;
    });
  }
  return body.trim();
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

const PANEL_WIDTH_M_EST = 1.2;

function estimateM2ForStops(stops) {
  return stops.reduce(
    (acc, s) =>
      acc +
      (s.paneles || []).reduce((a2, p) => a2 + safeNum(p.longitud) * PANEL_WIDTH_M_EST * safeNum(p.cantidad), 0),
    0
  );
}

function buildDefaultManualOrderKeys(stops) {
  return [...stops]
    .sort((a, b) => a.orden - b.orden)
    .flatMap((s) => buildStopPackages(s).map((p) => p.stableKey));
}

function normalizeInferredCargo(inferred, sourceLabel) {
  return {
    paneles: inferred.paneles.map((p) => ({ id: uid(), ...p })),
    accesorios: inferred.accesorios.map((a) => ({ id: uid(), ...a })),
    warnings: [
      sourceLabel && (inferred.paneles.length || inferred.accesorios.length) ? `Fuente: ${sourceLabel}.` : "",
      ...(inferred.warnings || []),
    ].filter(Boolean),
  };
}

async function inferStopCargo(stopLike) {
  const pdfLink = stopLike?.pdfLink || stopLike?.pdf || "";
  const rawSheetText = String(stopLike?.rawSheetText || "").trim();

  if (pdfLink) {
    const fromPdf = await inferPanelsAndAccessoriesFromPdf(pdfLink);
    if (fromPdf.paneles.length || fromPdf.accesorios.length) {
      return normalizeInferredCargo(fromPdf, "adjunto");
    }
    if (rawSheetText) {
      const fromSheet = parseLogisticaFromAdjuntoText(rawSheetText);
      return normalizeInferredCargo(
        {
          ...fromSheet,
          warnings: [...(fromPdf.warnings || []), "Fallback aplicado con texto de Ventas / Sheets.", ...(fromSheet.warnings || [])],
        },
        "Sheets"
      );
    }
    return normalizeInferredCargo(fromPdf, "adjunto");
  }

  if (rawSheetText) {
    return normalizeInferredCargo(parseLogisticaFromAdjuntoText(rawSheetText), "Sheets");
  }

  return { paneles: [], accesorios: [], warnings: ["Sin PDF ni texto de respaldo en la búsqueda."] };
}

function stopPackageCode(stop, index) {
  return `P${stop.orden}-B${index + 1}`;
}

function packageSummary(pkg) {
  if (pkg.kind === "accessory") {
    return `${pkg.tipo} ${pkg.len}m · ${(pkg.width * 100).toFixed(0)}x${(pkg.contentHeight * 100).toFixed(0)}cm + espuma ${pkg.foamMm}mm`;
  }
  return `${pkg.n}x${pkg.tipo} ${pkg.esp}mm/${pkg.len}m`;
}

function getStopBadges(stop) {
  const badges = [];
  if (!stop.telefono) badges.push({ label: "Sin teléfono", tone: "warning" });
  if (!stop.direccion && !stop.mapLink) badges.push({ label: "Sin mapa", tone: "warning" });
  if (!stop.pdfLink) badges.push({ label: "Sin adjunto", tone: "warning" });
  if (!stop.paneles.length) badges.push({ label: "Sin paneles", tone: "danger" });
  if (stop.estado === "Entregada") badges.push({ label: "Entregada", tone: "success" });
  if (stop.estado === "Observada" || stop.recepcionEstado === "Faltante" || stop.recepcionEstado === "Daño") {
    badges.push({ label: "Con observaciones", tone: "danger" });
  }
  if (stop.estado === "Lista para carga" || stop.estado === "Cargada") {
    badges.push({ label: stop.estado, tone: "primary" });
  }
  return badges;
}

function badgeStyle(tone) {
  const tones = {
    primary: { bg: "#e8f1fb", border: "#bfdbfe", color: T.primary },
    success: { bg: "#e9f8ee", border: "#b7ebc4", color: "#1f7a34" },
    warning: { bg: "#fff5e6", border: "#ffd699", color: "#a35a00" },
    danger: { bg: "#ffeceb", border: "#ffc9c5", color: "#b42318" },
    neutral: { bg: T.surfaceAlt, border: T.border, color: T.muted },
  };
  const t = tones[tone] || tones.neutral;
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 999,
    border: `1px solid ${t.border}`,
    background: t.bg,
    color: t.color,
  };
}

function buildPkgs(stop, panel) {
  const max = MAX_P[panel.espesor] || 8;
  let rem = Math.max(0, safeNum(panel.cantidad));
  const pkgs = [];
  let chunkIdx = 0;
  while (rem > 0) {
    const n = Math.min(rem, max);
    pkgs.push({
      id: uid(),
      stableKey: panelStableKey(stop.id, panel.id, chunkIdx),
      sId: stop.id,
      sOrd: stop.orden,
      sCol: stop.color,
      sCli: stop.cliente,
      tipo: panel.tipo,
      esp: safeNum(panel.espesor),
      len: safeNum(panel.longitud),
      n,
      h: ph(panel.espesor, n),
    });
    chunkIdx += 1;
    rem -= n;
  }
  return pkgs;
}

function buildAccessoryPkg(stop) {
  const accesorios = stop?.accesorios || [];
  const cfg = buildAccessoryPackageConfig(stop);
  if (!accesorios.length || !cfg.enabled) return [];
  const totalAcc = accesorios.reduce((acc, item) => acc + Math.max(1, safeNum(item.cantidad, 1)), 0);
  const foamM = clamp(safeNum(cfg.foamMm, DEFAULT_ACC_FOAM_MM), 0, 100) / 1000;
  const contentH = clamp(safeNum(cfg.alto, DEFAULT_ACC_H), 0.1, 0.5);
  return [{
    id: uid(),
    stableKey: accessoryStableKey(stop.id),
    sId: stop.id,
    sOrd: stop.orden,
    sCol: stop.color,
    sCli: stop.cliente,
    kind: "accessory",
    tipo: "ACCESORIOS",
    esp: "",
    len: clamp(safeNum(cfg.longitud, getStopLongestLength(stop)), 1, 14),
    n: 1,
    h: +(contentH + foamM).toFixed(4),
    width: clamp(safeNum(cfg.ancho, DEFAULT_ACC_W), 0.2, 0.5),
    foamMm: Math.round(foamM * 1000),
    contentHeight: contentH,
    accessoryCount: totalAcc,
    accessorySummary: accesorios.map((item) => `${item.cantidad}x ${item.descr}`).join(" · "),
  }];
}

function buildStopPackages(stop) {
  return [
    ...((stop?.paneles || []).flatMap((panel) => buildPkgs(stop, panel).map((pkg) => ({ ...pkg, kind: "panel" })))),
    ...buildAccessoryPkg(stop),
  ];
}

function getRowSummary(stacksByRow) {
  return stacksByRow.map((stacks) => ({
    height: stacks.length ? Math.max(...stacks.map((stack) => stack.height)) : 0,
    usedLen: stacks.reduce((acc, stack) => acc + stack.len, 0),
    stackCount: stacks.length,
  }));
}

function getStackTopLen(stack) {
  if (!stack?.items?.length) return stack?.len || 0;
  return stack.items[stack.items.length - 1].len;
}

function getHeightSpreadAfter(stacksByRow, row, stackIndex, nextHeight, type) {
  const heights = stacksByRow[row].map((stack, idx) => (idx === stackIndex ? nextHeight : stack.height));
  if (type === "new") heights.push(nextHeight);
  if (!heights.length) return nextHeight;
  return Math.max(...heights) - Math.min(...heights);
}

function pickCandidateScore(candidate, strategy) {
  const { type, rowSummary, nextHeight, row, usedLenAfter, stackHeightAfter, stackIndex, heightSpreadAfter } = candidate;
  if (strategy === "compact") {
    return [
      type === "existing" ? 0 : 1,
      rowSummary[row].usedLen ? 0 : 1,
      usedLenAfter,
      heightSpreadAfter,
      stackIndex ?? 999,
      nextHeight,
      row,
    ];
  }
  if (strategy === "doorPriority") {
    return [
      type === "existing" ? 0 : 1,
      nextHeight,
      heightSpreadAfter,
      rowSummary[row].usedLen,
      stackHeightAfter,
      row,
    ];
  }
  return [
    nextHeight,
    heightSpreadAfter,
    type === "existing" ? 0 : 1,
    usedLenAfter,
    stackHeightAfter,
    row,
  ];
}

function compareScore(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

function buildUnloadPlan(placed) {
  const stackDoorOrder = [...new Set(placed.map((pkg) => pkg.stackId))]
    .sort((a, b) => {
      const sa = placed.find((pkg) => pkg.stackId === a);
      const sb = placed.find((pkg) => pkg.stackId === b);
      if (!sa || !sb) return 0;
      if (sa.xStart !== sb.xStart) return sa.xStart - sb.xStart;
      if (sa.row !== sb.row) return sa.row - sb.row;
      return a.localeCompare(b);
    });
  const stackRankMap = new Map(stackDoorOrder.map((stackId, idx) => [stackId, idx + 1]));
  const ordered = [...placed].sort((a, b) => {
    const rankA = stackRankMap.get(a.stackId) || 999;
    const rankB = stackRankMap.get(b.stackId) || 999;
    if (rankA !== rankB) return rankA - rankB;
    if (a.zBase !== b.zBase) return b.zBase - a.zBase;
    if (a.sOrd !== b.sOrd) return a.sOrd - b.sOrd;
    return a.id.localeCompare(b.id);
  });
  return ordered.map((pkg, idx) => ({ ...pkg, unloadRank: idx + 1, stackUnloadRank: stackRankMap.get(pkg.stackId) || null }));
}

function summarizeStopUnload(unloadPlan, stops) {
  return stops
    .map((stop) => {
      const pkgs = unloadPlan.filter((pkg) => pkg.sId === stop.id);
      const firstRank = pkgs.length ? Math.min(...pkgs.map((pkg) => pkg.unloadRank)) : Number.POSITIVE_INFINITY;
      const avgHeightPct = pkgs.length
        ? Math.round((pkgs.reduce((acc, pkg) => acc + (pkg.zBase + pkg.h / 2) / MAX_H, 0) / pkgs.length) * 100)
        : 0;
      const topZ = pkgs.length ? Math.max(...pkgs.map((pkg) => pkg.zBase + pkg.h)) : 0;
      return {
        stop,
        pkgs,
        firstRank,
        avgHeightPct,
        topZ,
      };
    })
    .sort((a, b) => a.firstRank - b.firstRank || b.topZ - a.topZ || a.stop.orden - b.stop.orden);
}

function placeCargo(stops, trL, strategy = "balanced", layoutOptions = {}) {
  const { mode = "auto", manualOrderKeys = [], rowOverrides = {} } = layoutOptions;
  const all = [...stops]
    .sort((a, b) => a.orden - b.orden)
    .flatMap((s) => buildStopPackages(s));

  if (!all.length) {
    return {
      placed: [],
      rowH: [0, 0],
      warns: [],
      maxLen: trL,
      maxX: trL,
      rowCursor: [trL, trL],
      minX: 0,
      stacksByRow: [[], []],
      unloadPlan: [],
      stopUnloadOrder: [],
      strategy,
      layoutMode: mode,
      manualLayoutVersion: MANUAL_LAYOUT_VERSION,
    };
  }

  const orderIdx = new Map((manualOrderKeys || []).map((k, i) => [k, i]));
  const load = [...all].sort((a, b) => {
    if (mode === "manual" && manualOrderKeys.length) {
      const ia = orderIdx.has(a.stableKey) ? orderIdx.get(a.stableKey) : 9999;
      const ib = orderIdx.has(b.stableKey) ? orderIdx.get(b.stableKey) : 9999;
      if (ia !== ib) return ia - ib;
    }
    if (a.sOrd !== b.sOrd) return b.sOrd - a.sOrd;
    if (a.len !== b.len) return b.len - a.len;
    return b.h - a.h;
  });
  const stacksByRow = [[], []];
  const rowCursor = [trL, trL];
  const placed = [];
  const warns = new Set();

  load.forEach((pkg) => {
    const ovh = Math.max(0, pkg.len - trL);
    if (ovh > MAX_OVH) {
      warns.add(`P${pkg.sOrd}: panel ${pkg.len}m sobresale ${ovh.toFixed(1)}m. Revisar largo útil del camión.`);
    }

    const forcedRow = rowOverrides[pkg.stableKey];
    const rowSummary = getRowSummary(stacksByRow);
    const candidates = [];

    for (let row = 0; row < 2; row += 1) {
      if (forcedRow !== undefined && forcedRow !== row) continue;
      stacksByRow[row].forEach((stack, stackIndex) => {
        const topLen = getStackTopLen(stack);
        const fitsOnImmediateSupport = pkg.len <= topLen + 0.001;
        const nextStackHeight = stack.height + pkg.h;
        if (!fitsOnImmediateSupport || nextStackHeight > MAX_H + 0.001) return;
        const nextHeight = Math.max(rowSummary[row].height, nextStackHeight);
        const heightSpreadAfter = getHeightSpreadAfter(stacksByRow, row, stackIndex, nextStackHeight, "existing");
        candidates.push({
          type: "existing",
          row,
          stackIndex,
          stackHeightAfter: nextStackHeight,
          nextHeight,
          rowSummary,
          usedLenAfter: rowSummary[row].usedLen,
          heightSpreadAfter,
          supportLen: topLen,
        });
      });

      const stackXStart = rowCursor[row] - pkg.len;
      const lengthOk = stackXStart >= -MAX_OVH - 0.001;
      if (lengthOk && pkg.h <= MAX_H + 0.001) {
        const nextHeight = Math.max(rowSummary[row].height, pkg.h);
        const heightSpreadAfter = getHeightSpreadAfter(stacksByRow, row, null, pkg.h, "new");
        candidates.push({
          type: "new",
          row,
          stackHeightAfter: pkg.h,
          nextHeight,
          rowSummary,
          usedLenAfter: rowSummary[row].usedLen + pkg.len,
          heightSpreadAfter,
        });
      }
    }

    let chosen = null;
    if (candidates.length) {
      chosen = [...candidates].sort((a, b) => compareScore(pickCandidateScore(a, strategy), pickCandidateScore(b, strategy)))[0];
    } else {
      const rowSummaryNow = getRowSummary(stacksByRow);
      const anyHeightOk = rowSummaryNow.some(() => pkg.h <= MAX_H + 0.001);
      if (!anyHeightOk) warns.add(`P${pkg.sOrd}: excede ${MAX_H}m en ambas filas — se requiere 2° camión.`);
      else warns.add(`P${pkg.sOrd}: no entra en largo útil sin exceder la tolerancia de saliente.`);
      chosen = { type: "overflow", row: rowCursor[0] >= rowCursor[1] ? 0 : 1 };
    }

    let row = chosen.row;
    let stack;

    if (chosen.type === "existing") {
      stack = stacksByRow[row][chosen.stackIndex];
    } else {
      const len = pkg.len;
      const xStart = rowCursor[row] - len;
      const xEnd = rowCursor[row];
      stack = {
        id: `R${row + 1}-S${stacksByRow[row].length + 1}`,
        row,
        len,
        xStart,
        xEnd,
        height: 0,
        items: [],
      };
      stacksByRow[row].push(stack);
      rowCursor[row] = xStart;
    }

    const zBase = stack.height;
    const alignedXStart = stack.xEnd - pkg.len;
    const alignedXEnd = stack.xEnd;
    const ov = zBase + pkg.h > MAX_H + 0.001;
    const supportLen = chosen.type === "existing" ? getStackTopLen(stack) : pkg.len;
    const placedPkg = {
      ...pkg,
      row,
      zBase,
      xStart: alignedXStart,
      xEnd: alignedXEnd,
      ovh,
      ov,
      stackId: stack.id,
      stackLen: stack.len,
      layerIndex: stack.items.length,
      supportLen,
      supportRatio: supportLen > 0 ? Math.min(1, supportLen / Math.max(pkg.len, 0.001)) : 1,
    };
    stack.items.push(placedPkg);
    stack.height += pkg.h;
    placed.push(placedPkg);
  });

  const rowH = getRowSummary(stacksByRow).map((row) => row.height);
  const unloadPlan = buildUnloadPlan(placed);
  const stopUnloadOrder = summarizeStopUnload(unloadPlan, stops);

  return {
    placed,
    rowH,
    warns: [...warns],
    /** Mayor largo de paquete (m); no confundir con extensión en eje X. */
    maxLen: Math.max(...placed.map((p) => p.len), trL),
    /** Extensión máxima en eje X del layout (borde derecho de carga). */
    maxX: placed.length ? Math.max(trL, ...placed.map((p) => p.xEnd)) : trL,
    rowCursor,
    minX: Math.min(0, ...placed.map((p) => p.xStart)),
    stacksByRow,
    unloadPlan,
    stopUnloadOrder,
    strategy,
    layoutMode: mode,
    manualLayoutVersion: MANUAL_LAYOUT_VERSION,
  };
}

const ISX = 24;
const ISY = 24;
const ISZ = 48;
const C30 = Math.cos(Math.PI / 6);
const S30 = 0.5;
function isoP(x, y, z, ox, oy) {
  return { px: ox + (x * C30 - y * C30) * ISX, py: oy + (x * S30 + y * S30) * ISY - z * ISZ };
}
const fp = (pts) => pts.map((p) => `${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(" ");
function shd(hex, f) {
  if (!hex || hex[0] !== "#") return "#888";
  return `rgb(${Math.round(parseInt(hex.slice(1, 3), 16) * f)},${Math.round(parseInt(hex.slice(3, 5), 16) * f)},${Math.round(parseInt(hex.slice(5, 7), 16) * f)})`;
}

function IsoBox({ x, y, z, dx, dy, dz, col, lbl, ox, oy, alpha = 1 }) {
  const c = (px, py, pz) => isoP(px, py, pz, ox, oy);
  const v = [c(x, y, z), c(x + dx, y, z), c(x + dx, y + dy, z), c(x, y + dy, z), c(x, y, z + dz), c(x + dx, y, z + dz), c(x + dx, y + dy, z + dz), c(x, y + dy, z + dz)];
  const tc = isoP(x + dx / 2, y + dy / 2, z + dz, ox, oy);
  const sw = "rgba(255,255,255,.25)";
  return (
    <g opacity={alpha}>
      <polygon points={fp([v[3], v[2], v[6], v[7]])} fill={shd(col, 0.44)} stroke={sw} strokeWidth={0.4} />
      <polygon points={fp([v[0], v[3], v[7], v[4]])} fill={shd(col, 0.58)} stroke={sw} strokeWidth={0.4} />
      <polygon points={fp([v[1], v[2], v[6], v[5]])} fill={shd(col, 0.58)} stroke={sw} strokeWidth={0.4} />
      <polygon points={fp([v[0], v[1], v[5], v[4]])} fill={shd(col, 0.74)} stroke={sw} strokeWidth={0.4} />
      <polygon points={fp([v[4], v[5], v[6], v[7]])} fill={col} stroke="rgba(255,255,255,.5)" strokeWidth={0.8} />
      {lbl && dz * ISZ > 11 ? (
        <text x={tc.px} y={tc.py + 3} textAnchor="middle" fontSize={7} fill="white" fontWeight="bold">
          {lbl}
        </text>
      ) : null}
    </g>
  );
}

function DiagramPanel({ cargo, truckL, remitoNumero }) {
  const { placed, rowH, stopUnloadOrder, strategy, stacksByRow } = cargo;
  const { minXV, maxXV, placedView } = bedViewExtents(placed, truckL);
  const shiftX = -minXV;
  const totalLen = maxXV - minXV;
  const [diagramView, setDiagramView] = useState("svg");
  const OX = 60;
  const OY = 85;
  const viewW = Math.max(420, OX + (totalLen * C30 + TRUCK_W * C30) * ISX + 80);
  const viewH = 240;
  const sorted = [...placedView].sort((a, b) => b.row - a.row || a.zBase - b.zBase);
  const tf = (x, y, z) => isoP(x, y, z, OX, OY);
  const trLine = (x1, y1, z1, x2, y2, z2, col = "#60A5FA", sw = 1, dash = "") => {
    const a = tf(x1, y1, z1);
    const b = tf(x2, y2, z2);
    return <line x1={a.px} y1={a.py} x2={b.px} y2={b.py} stroke={col} strokeWidth={sw} strokeDasharray={dash} />;
  };
  const pctA = Math.round((rowH[0] / MAX_H) * 100);
  const pctB = Math.round((rowH[1] / MAX_H) * 100);
  const barCol = (p) => (p > 95 ? "#ff3b30" : p > 70 ? "#ff9f0a" : "#34c759");
  const totalStacks = stacksByRow.reduce((acc, row) => acc + row.length, 0);

  return (
    <div
      style={{
        background: T.brand,
        borderRadius: T.radius,
        padding: 16,
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "#fff" }}>{diagramView === "webgl" ? "Explorar carga (WebGL)" : "Vista isométrica (SVG)"}</h3>
          <p style={{ margin: 0, color: "rgba(255,255,255,.65)", fontSize: 12 }}>
            Cabina a la izquierda · cola / carga a la derecha · saliente hacia la cola · estrategia: {DISTRIBUTION_MODES.find((m) => m.id === strategy)?.short || "Auto"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", alignItems: "center" }}>
          <Btn small outline onClick={() => setDiagramView("svg")} style={diagramView === "svg" ? { borderColor: "rgba(255,255,255,.35)", background: "rgba(255,255,255,.12)", color: "#fff" } : { borderColor: "rgba(255,255,255,.2)", color: "rgba(255,255,255,.85)" }}>
            Isométrica
          </Btn>
          <Btn small outline onClick={() => setDiagramView("webgl")} style={diagramView === "webgl" ? { borderColor: "rgba(255,255,255,.35)", background: "rgba(255,255,255,.12)", color: "#fff" } : { borderColor: "rgba(255,255,255,.2)", color: "rgba(255,255,255,.85)" }}>
            Explorar 3D
          </Btn>
          <Btn
            small
            outline
            onClick={() => {
              const payload = buildLogisticaPlanExportPayload({ truckL, cargo, remitoNumero });
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              const safe = String(remitoNumero || "plan").replace(/[^\w.-]+/g, "_");
              a.download = `bmc-logistica-${safe}-${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
            style={{ borderColor: "rgba(255,255,255,.25)", color: "rgba(255,255,255,.9)" }}
          >
            Exportar plan (JSON)
          </Btn>
        </div>
      </div>

      <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 10, overflow: "hidden", width: "100%", maxWidth: "100%", minWidth: 0 }}>
        {diagramView === "webgl" ? (
          <Suspense
            fallback={
              <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.55)", fontSize: 13 }}>
                Cargando vista 3D…
              </div>
            }
          >
            <LogisticaCargoScene3d placed={placedView} shiftX={shiftX} truckL={truckL} maxLen={maxXV} totalLen={totalLen} />
          </Suspense>
        ) : (
        <svg width="100%" height="auto" viewBox={`0 -8 ${viewW} ${viewH}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", maxWidth: "100%", height: "auto" }}>
          {maxXV > truckL ? (
            <polygon points={fp([tf(shiftX + truckL, 0, 0), tf(shiftX + maxXV, 0, 0), tf(shiftX + maxXV, TRUCK_W, 0), tf(shiftX + truckL, TRUCK_W, 0)])} fill="rgba(255,159,10,.12)" stroke="#ff9f0a" strokeWidth={1} strokeDasharray="4,3" />
          ) : null}
          <polygon points={fp([tf(shiftX, 0, 0), tf(shiftX + truckL, 0, 0), tf(shiftX + truckL, TRUCK_W, 0), tf(shiftX, TRUCK_W, 0)])} fill="#0d2137" stroke="#3B82F6" strokeWidth={1.2} />
          {trLine(shiftX, ROW_W, 0, shiftX + truckL, ROW_W, 0, "rgba(255,255,255,.2)", 0.8, "3,3")}
          {sorted.map((pkg) => (
            <IsoBox
              key={pkg.id}
              x={shiftX + pkg.xStart}
              y={pkg.row * ROW_W}
              z={pkg.zBase}
              dx={pkg.len}
              dy={ROW_W}
              dz={pkg.h}
              col={pkg.ov ? "#ff3b30" : pkg.sCol}
              lbl={pkg.kind === "accessory" ? `P${pkg.sOrd}·ACC` : `P${pkg.sOrd}·${pkg.n}`}
              ox={OX}
              oy={OY}
              alpha={pkg.ov ? 0.65 : 1}
            />
          ))}
          {stacksByRow.flat().map((stack) => {
            const sv = mirrorStackForView(stack, truckL);
            const p1 = tf(shiftX + sv.xStart, stack.row * ROW_W, 0);
            const p2 = tf(shiftX + sv.xEnd, stack.row * ROW_W, 0);
            return (
              <g key={stack.id}>
                <line x1={p1.px} y1={p1.py} x2={p2.px} y2={p2.py} stroke="rgba(255,255,255,.22)" strokeWidth={1} strokeDasharray="2,2" />
                <text x={(p1.px + p2.px) / 2} y={p1.py - 4} textAnchor="middle" fontSize={7} fill="rgba(255,255,255,.55)">
                  {stack.id}
                </text>
              </g>
            );
          })}
          {trLine(shiftX, 0, MAX_H, shiftX + truckL, 0, MAX_H, "#ff3b30", 1, "5,3")}
          {trLine(shiftX, TRUCK_W, MAX_H, shiftX + truckL, TRUCK_W, MAX_H, "#ff3b30", 1, "5,3")}
          {trLine(shiftX, 0, MAX_H, shiftX, TRUCK_W, MAX_H, "#ff3b30", 1, "5,3")}
          {trLine(shiftX + truckL, 0, MAX_H, shiftX + truckL, TRUCK_W, MAX_H, "#ff3b30", 1, "5,3")}
          {[
            [shiftX, 0],
            [shiftX + truckL, 0],
            [shiftX, TRUCK_W],
            [shiftX + truckL, TRUCK_W],
          ].map(([x, y], i) => trLine(x, y, 0, x, y, MAX_H, "rgba(255,255,255,.25)", 1, i > 0 ? "3,3" : ""))}
          {trLine(shiftX, 0, 0, shiftX + truckL, 0, 0, "#60A5FA", 1.2)}
          {trLine(shiftX, TRUCK_W, 0, shiftX + truckL, TRUCK_W, 0, "#60A5FA", 1.2)}
          {trLine(shiftX + truckL, 0, 0, shiftX + truckL, TRUCK_W, 0, "#60A5FA", 1.5)}
          {(() => {
            const p = tf(shiftX, 0, MAX_H);
            return <text x={p.px - 3} y={p.py} textAnchor="end" fontSize={9} fill="#ff3b30" fontWeight="bold">{`${MAX_H}m`}</text>;
          })()}
          {(() => {
            const pCab = tf(shiftX, TRUCK_W / 2, -0.1);
            const pCola = tf(shiftX + truckL, TRUCK_W / 2, -0.1);
            return (
              <>
                <text x={pCab.px} y={pCab.py + 13} textAnchor="middle" fontSize={8} fill="#93C5FD" fontWeight="bold">
                  CABINA
                </text>
                <text x={pCola.px} y={pCola.py + 13} textAnchor="middle" fontSize={8} fill="#ff9f0a" fontWeight="bold">
                  COLA
                </text>
              </>
            );
          })()}
          {maxXV > truckL
            ? (() => {
                const p = tf(shiftX + (truckL + maxXV) / 2, TRUCK_W + 0.1, 0);
                return <text x={p.px} y={p.py + 13} textAnchor="middle" fontSize={8} fill="#ff9f0a">↔ {(maxXV - truckL).toFixed(1)}m saliente</text>;
              })()
            : null}
          {rowH.map((h, i) => {
            const x1 = tf(shiftX + maxXV + 0.25, i * ROW_W, 0);
            const x2 = tf(shiftX + maxXV + 0.25, i * ROW_W, h);
            const pct = Math.round((h / MAX_H) * 100);
            const col = barCol(pct);
            return (
              <g key={i}>
                <line x1={x1.px} y1={x1.py} x2={x2.px} y2={x2.py} stroke={col} strokeWidth={4} />
                <text x={x2.px} y={x2.py - 4} textAnchor="middle" fontSize={8} fill={col} fontWeight="bold">{(h * 100).toFixed(0)}cm</text>
              </g>
            );
          })}
        </svg>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          ["Fila A", `${(rowH[0] * 100).toFixed(0)} cm / ${(MAX_H * 100).toFixed(0)} cm`, pctA],
          ["Fila B", `${(rowH[1] * 100).toFixed(0)} cm / ${(MAX_H * 100).toFixed(0)} cm`, pctB],
          ["Paquetes", `${placed.length} total`, null],
          ["Pilas", `${totalStacks} total`, null],
          ["Saliente", maxXV > truckL ? `${(maxXV - truckL).toFixed(1)}m / max 2m` : "Sin saliente", null],
        ].map(([k, v, pct]) => (
          <div key={k} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 10 }}>
            <div style={{ color: "rgba(255,255,255,.55)", fontSize: 11, marginBottom: 4 }}>{k}</div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{v}</div>
            {pct != null ? (
              <div style={{ marginTop: 6, height: 4, background: "rgba(255,255,255,.1)", borderRadius: 2 }}>
                <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: barCol(pct), borderRadius: 2 }} />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div>
        <div style={{ color: "rgba(255,255,255,.55)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Orden de descarga</div>
        <div style={{ display: "grid", gap: 6 }}>
          {stopUnloadOrder.map(({ stop, pkgs, avgHeightPct, firstRank }, idx) => {
            return (
              <div key={stop.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,.05)", borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: stop.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#fff", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    P{stop.orden} · {stop.cliente || "—"}
                  </div>
                  <div style={{ color: "rgba(255,255,255,.45)", fontSize: 10 }}>
                    {pkgs.length} paquetes · alt. media {avgHeightPct}% · primer retiro #{Number.isFinite(firstRank) ? firstRank : "—"}
                  </div>
                </div>
                <div style={{ color: "rgba(255,255,255,.5)", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {idx === 0 ? "🟢 1° DESC" : idx === stopUnloadOrder.length - 1 ? "🔴 ÚLTIMO" : `🟡 ${idx + 1}°`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ color: "rgba(255,255,255,.55)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Pilas físicas</div>
        <div style={{ display: "grid", gap: 6 }}>
          {stacksByRow.flat().map((stack) => (
            <div key={stack.id} style={{ background: "rgba(255,255,255,.05)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>
                {stack.id} · Fila {stack.row === 0 ? "A" : "B"} · {stack.len.toFixed(1)}m · {(stack.height * 100).toFixed(0)}cm
              </div>
              <div style={{ color: "rgba(255,255,255,.45)", fontSize: 10, marginTop: 2 }}>
                {stack.items.map((item) => `${item.sCli || `P${item.sOrd}`} ${item.kind === "accessory" ? `ACC ${item.len}m` : `${item.n}u/${item.len}m`}`).join(" → ")}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RemitoView({ info, stops, cargo, truckL, sendWA }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }} className="np">
        <Btn onClick={() => window.print()} color={T.success}>🖨️ Imprimir / PDF</Btn>
        <Btn onClick={sendWA} color="#25D366">📲 WhatsApp</Btn>
      </div>
      <div style={{ ...css.card, padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `3px solid ${T.brand}`, paddingBottom: 16, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.brand }}>BMC Uruguay</div>
            <div style={{ fontSize: 12, color: T.muted }}>Metalog SAS · Paneles Sandwich · Maldonado</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.primary }}>HOJA DE RUTA</div>
            <div style={{ fontWeight: 700 }}>{info.numero}</div>
            <div style={{ fontSize: 12, color: T.muted }}>{info.fecha}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16, background: T.surfaceAlt, padding: 12, borderRadius: 10 }}>
          {[["Transportista", info.transportista || "—"], ["Patente", info.patente || "—"], ["Camión", `${truckL}m`], ["Paradas / Pkgs", `${stops.length} / ${cargo.placed.length}`]].map(([k, v]) => (
            <div key={k}>
              <div style={css.lbl}>{k}</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{v}</div>
            </div>
          ))}
        </div>
        {info.notas ? <div style={{ background: "#fff8ec", border: "1px solid #ffd966", padding: "8px 12px", borderRadius: 10, marginBottom: 14, fontSize: 13 }}>📝 {info.notas}</div> : null}
        {stops.map((stop) => {
          const pkgs = buildStopPackages(stop);
          const panelPkgs = pkgs.filter((pkg) => pkg.kind !== "accessory");
          const accPkg = pkgs.find((pkg) => pkg.kind === "accessory");
          const placed = cargo.placed.filter((p) => p.sId === stop.id);
          return (
            <div key={stop.id} style={{ marginBottom: 20, borderLeft: `4px solid ${stop.color}`, paddingLeft: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: stop.color }}>PARADA {stop.orden}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{pkgs.length} pkgs · {placed.filter((p) => p.row === 0).length} Fila A · {placed.filter((p) => p.row === 1).length} Fila B</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 6, fontSize: 13, marginBottom: 10 }}>
                <div><span style={{ color: T.muted }}>Cliente: </span><b>{stop.cliente || "—"}</b></div>
                <div><span style={{ color: T.muted }}>Tel: </span><b>{stop.telefono || "—"}</b></div>
                <div><span style={{ color: T.muted }}>Dir: </span><b>{stop.direccion || "—"}</b></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, fontSize: 12, marginBottom: 10, color: T.muted }}>
                <div><span style={{ color: T.muted }}>Pedido: </span><b style={{ color: T.text }}>{stop.cotizacionId || "—"}</b></div>
                <div><span style={{ color: T.muted }}>Estado: </span><b style={{ color: T.text }}>{stop.estado || "—"}</b></div>
                <div><span style={{ color: T.muted }}>Recepción: </span><b style={{ color: T.text }}>{stop.recepcionEstado || "—"}</b></div>
              </div>
              {stop.paneles.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 8 }}>
                  <thead>
                    <tr style={{ background: stop.color, color: "white" }}>
                      {["Tipo", "Espesor", "Largo", "Cant.", "Pkgs", "Alto pkg", "Filas", "IDs bulto"].map((h) => (
                        <th key={h} style={{ padding: "5px 8px", textAlign: "left", fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stop.paneles.map((p, i) => {
                      const pks = buildPkgs(stop, p);
                      const pl = cargo.placed.filter((pp) => pp.sId === stop.id && pp.esp === safeNum(p.espesor) && pp.len === safeNum(p.longitud));
                      const filas = [...new Set(pl.map((pp) => (pp.row === 0 ? "A" : "B")))].join("+");
                      const maxHpk = pks.length ? Math.max(...pks.map((pk) => pk.h)) : 0;
                      return (
                        <tr key={p.id} style={{ background: i % 2 ? T.surface : T.surfaceAlt }}>
                          <td style={{ padding: "4px 8px", fontWeight: 600 }}>{p.tipo}</td>
                          <td style={{ padding: "4px 8px" }}>{p.espesor}mm</td>
                          <td style={{ padding: "4px 8px" }}>{p.longitud}m</td>
                          <td style={{ padding: "4px 8px", fontWeight: 700 }}>{p.cantidad}</td>
                          <td style={{ padding: "4px 8px" }}>{pks.length}</td>
                          <td style={{ padding: "4px 8px", fontWeight: 700, color: maxHpk > MAX_H ? T.danger : T.success }}>{(maxHpk * 100).toFixed(0)}cm{maxHpk > MAX_H ? " ⚠️" : ""}</td>
                          <td style={{ padding: "4px 8px", fontWeight: 700, color: T.primary }}>{filas || "—"}</td>
                          <td style={{ padding: "4px 8px", color: T.muted }}>{pks.map((_, idx) => stopPackageCode(stop, idx)).join(", ")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : null}
              {accPkg ? (
                <div style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 10px", fontSize: 12, marginBottom: 8 }}>
                  <b style={{ color: T.brand }}>Bulto accesorios:</b> {packageSummary(accPkg)} · ID {stopPackageCode(stop, panelPkgs.length)}.
                </div>
              ) : null}
              {stop.accesorios.length > 0 ? <div style={{ fontSize: 12, color: T.muted }}>🔩 {stop.accesorios.map((a) => `${a.cantidad}× ${a.descr}`).join(" · ")}</div> : null}
              {stop.recepcionDetalle ? <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>Observación recepción: {stop.recepcionDetalle}</div> : null}
            </div>
          );
        })}
        <div style={{ borderTop: `2px solid ${T.brand}`, paddingTop: 12, display: "flex", justifyContent: "flex-end", gap: 24, marginBottom: 24 }}>
          {[["Paquetes", cargo.placed.length], ["Fila A", `${(cargo.rowH[0] * 100).toFixed(0)}cm`], ["Fila B", `${(cargo.rowH[1] * 100).toFixed(0)}cm`]].map(([k, v]) => (
            <div key={k} style={{ textAlign: "center" }}>
              <div style={{ color: T.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>{k}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: T.brand }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
          {["Entregado (BMC)", "Recibido (Transportista)", "Conforme (Cliente)"].map((l) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ height: 52, borderBottom: `1px solid ${T.text}`, marginBottom: 6 }} />
              <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BmcLogisticaApp() {
  const [info, setInfo] = useState({ fecha: today(), numero: envNo(), transportista: "", transportistaId: "", patente: "", notas: "" });
  const [stops, setStops] = useState([]);
  const [view, setView] = useState("form");
  const [truckL, setTruckL] = useState(8);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [ventasCache, setVentasCache] = useState({ headers: [], rows: [] });
  const [loadSh, setLoadSh] = useState(false);
  const [shErr, setShErr] = useState("");
  const [distributionMode, setDistributionMode] = useState("balanced");
  const [cargoLayoutMode, setCargoLayoutMode] = useState("auto");
  const [manualPkgOrderKeys, setManualPkgOrderKeys] = useState([]);
  const [rowOverrides, setRowOverrides] = useState({});
  const [autoLoadMsg, setAutoLoadMsg] = useState("");
  const [retryingStopId, setRetryingStopId] = useState("");
  const [accProfiles, setAccProfiles] = useState({});
  const [transportistas, setTransportistas] = useState([]);
  const [camionesCat, setCamionesCat] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [tripCostLog, setTripCostLog] = useState([]);
  const [tripPriceInput, setTripPriceInput] = useState("");
  const [newCarrierName, setNewCarrierName] = useState("");

  useEffect(() => {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) raw = localStorage.getItem(STORAGE_KEY_LEGACY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.info) setInfo((prev) => ({ ...prev, ...parsed.info }));
      if (parsed.accProfiles && typeof parsed.accProfiles === "object") setAccProfiles(parsed.accProfiles);
      if (Array.isArray(parsed.stops)) {
        setStops(
          parsed.stops.map((stop, index) => ({
            ...mkStop(index),
            ...stop,
            orderId: stop.orderId ?? "",
            pickupId: stop.pickupId ?? "",
            checks: { ...mkStop(index).checks, ...(stop.checks || {}) },
            accPackage: buildAccessoryPackageConfig({ ...mkStop(index), ...stop }, parsed.accProfiles || {}),
          }))
        );
      }
      if (parsed.truckL) setTruckL(parsed.truckL);
      if (parsed.view) setView(parsed.view);
      if (parsed.distributionMode) setDistributionMode(parsed.distributionMode);
      if (parsed.cargoLayoutMode === "manual" || parsed.cargoLayoutMode === "auto") setCargoLayoutMode(parsed.cargoLayoutMode);
      if (Array.isArray(parsed.manualPkgOrderKeys)) setManualPkgOrderKeys(parsed.manualPkgOrderKeys);
      if (parsed.rowOverrides && typeof parsed.rowOverrides === "object") setRowOverrides(parsed.rowOverrides);
      if (Array.isArray(parsed.transportistas)) setTransportistas(parsed.transportistas);
      if (Array.isArray(parsed.camionesCat)) setCamionesCat(parsed.camionesCat);
      if (Array.isArray(parsed.priceHistory)) setPriceHistory(parsed.priceHistory);
      if (Array.isArray(parsed.tripCostLog)) setTripCostLog(parsed.tripCostLog);
    } catch {
      // ignore persisted-state errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          info,
          stops,
          truckL,
          view,
          distributionMode,
          accProfiles,
          cargoLayoutMode,
          manualPkgOrderKeys,
          rowOverrides,
          transportistas,
          camionesCat,
          priceHistory,
          tripCostLog,
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [
    info,
    stops,
    truckL,
    view,
    distributionMode,
    accProfiles,
    cargoLayoutMode,
    manualPkgOrderKeys,
    rowOverrides,
    transportistas,
    camionesCat,
    priceHistory,
    tripCostLog,
  ]);

  useEffect(() => {
    if (cargoLayoutMode !== "manual") return;
    const keys = buildDefaultManualOrderKeys(stops);
    setManualPkgOrderKeys((prev) => {
      const next = prev.filter((k) => keys.includes(k));
      keys.forEach((k) => {
        if (!next.includes(k)) next.push(k);
      });
      return next;
    });
  }, [stops, cargoLayoutMode]);

  const updInfo = (k, v) => setInfo((p) => ({ ...p, [k]: v }));
  const addStop = () => setStops((p) => [...p, mkStop(p.length)]);
  const rmStop = (id) => setStops((p) => p.filter((s) => s.id !== id).map((s, i) => ({ ...s, orden: i + 1, color: COLORS[i % 8] })));
  const updStop = (id, k, v) => setStops((p) => p.map((s) => (s.id === id ? { ...s, [k]: v } : s)));
  async function pushVentasFechaEntrega(stop) {
    const row = stop.ventasSheetRow1Based;
    const gid = stop.ventasTabGid || SH_GID;
    const iso = stop.fechaEntrega;
    if (row == null || row < 2) return;
    const token = typeof import.meta !== "undefined" ? import.meta.env?.VITE_BMC_API_AUTH_TOKEN : "";
    if (!token) {
      setAutoLoadMsg(
        "Planilla: falta VITE_BMC_API_AUTH_TOKEN en el build para escribir en Google Sheets (mismo valor que API_AUTH_TOKEN del servidor)."
      );
      return;
    }
    const base = getCalcApiBase();
    try {
      const res = await fetch(`${base}/api/ventas/logistica-fecha-entrega`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gid: String(gid), row1Based: row, fechaEntrega: iso || "" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false) throw new Error(j.error || res.statusText);
      setAutoLoadMsg(`Planilla Ventas: fecha guardada (fila ${row}, columna G).`);
    } catch (e) {
      setAutoLoadMsg(`Planilla Ventas: error al guardar fecha — ${e.message}`);
    }
  }
  function onFechaEntregaChange(stopId, iso) {
    setStops((p) => {
      const next = p.map((s) => (s.id === stopId ? { ...s, fechaEntrega: iso } : s));
      const snap = next.find((s) => s.id === stopId);
      if (snap) queueMicrotask(() => pushVentasFechaEntrega(snap));
      return next;
    });
  }
  const updStopCheck = (id, key, value) => setStops((p) => p.map((s) => (s.id === id ? { ...s, checks: { ...s.checks, [key]: value } } : s)));
  const addPanel = (sid) => setStops((p) => p.map((s) => (s.id === sid ? { ...s, paneles: [...s.paneles, mkPanel()] } : s)));
  const rmPanel = (sid, pid) => setStops((p) => p.map((s) => (s.id === sid ? { ...s, paneles: s.paneles.filter((x) => x.id !== pid) } : s)));
  const updPanel = (sid, pid, k, v) => setStops((p) => p.map((s) => (s.id === sid ? { ...s, paneles: s.paneles.map((x) => (x.id === pid ? { ...x, [k]: v } : x)) } : s)));
  const addAcc = (sid) => setStops((p) => p.map((s) => {
    if (s.id !== sid) return s;
    const next = { ...s, accesorios: [...s.accesorios, mkAcc()] };
    return { ...next, accPackage: buildAccessoryPackageConfig(next, accProfiles) };
  }));
  const rmAcc = (sid, aid) => setStops((p) => p.map((s) => {
    if (s.id !== sid) return s;
    const next = { ...s, accesorios: s.accesorios.filter((x) => x.id !== aid) };
    return { ...next, accPackage: buildAccessoryPackageConfig(next, accProfiles) };
  }));
  const updAcc = (sid, aid, k, v) => setStops((p) => p.map((s) => {
    if (s.id !== sid) return s;
    const next = { ...s, accesorios: s.accesorios.map((x) => (x.id === aid ? { ...x, [k]: v } : x)) };
    if (s.accPackage?.manualDims) {
      const cfg = buildAccessoryPackageConfig(next, accProfiles);
      return { ...next, accPackage: { ...cfg, ...s.accPackage, profileKey: cfg.profileKey, profileLabel: cfg.profileLabel, enabled: cfg.enabled } };
    }
    return { ...next, accPackage: buildAccessoryPackageConfig(next, accProfiles) };
  }));
  const updAccPackage = (sid, key, value) => setStops((p) => p.map((s) => {
    if (s.id !== sid) return s;
    const next = {
      ...s,
      accPackage: {
        ...buildAccessoryPackageConfig(s, accProfiles),
        ...s.accPackage,
        [key]: value,
        manualDims: true,
        enabled: s.accesorios.length > 0,
      },
    };
    const profileKey = next.accPackage.profileKey;
    if (profileKey) {
      setAccProfiles((prev) => ({
        ...prev,
        [profileKey]: {
          longitud: safeNum(next.accPackage.longitud, getStopLongestLength(next)),
          ancho: clamp(safeNum(next.accPackage.ancho, DEFAULT_ACC_W), 0.2, 0.5),
          alto: clamp(safeNum(next.accPackage.alto, DEFAULT_ACC_H), 0.1, 0.5),
          foamMm: clamp(safeNum(next.accPackage.foamMm, DEFAULT_ACC_FOAM_MM), 0, 100),
        },
      }));
    }
    return next;
  }));
  const applyAccSuggestion = (sid) => setStops((p) => p.map((s) => {
    if (s.id !== sid) return s;
    const cfg = buildAccessoryPackageConfig({ ...s, accPackage: { ...s.accPackage, manualDims: false } }, accProfiles, { preferCurrent: false });
    return { ...s, accPackage: { ...cfg, manualDims: false } };
  }));

  const layoutOpts = useMemo(
    () => ({
      mode: cargoLayoutMode,
      manualOrderKeys: manualPkgOrderKeys,
      rowOverrides,
    }),
    [cargoLayoutMode, manualPkgOrderKeys, rowOverrides]
  );

  const cargoVariants = useMemo(
    () =>
      DISTRIBUTION_MODES.map((mode) => ({
        ...mode,
        cargo: placeCargo(stops, truckL, mode.id, layoutOpts),
      })),
    [stops, truckL, layoutOpts]
  );
  const cargo = cargoVariants.find((variant) => variant.id === distributionMode)?.cargo || cargoVariants[0]?.cargo || placeCargo(stops, truckL, "balanced", layoutOpts);
  const totPan = stops.reduce((t, s) => t + s.paneles.reduce((tt, p) => tt + safeNum(p.cantidad), 0), 0);

  async function fetchVentasCsv() {
    const url = `https://docs.google.com/spreadsheets/d/${SH_ID}/gviz/tq?tqx=out:csv&gid=${SH_GID}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const txt = await res.text();
    return parseCsv(txt);
  }

  async function buscarSheet() {
    if (!search.trim()) return;
    setLoadSh(true);
    setShErr("");
    setResults([]);
    try {
      const rows = await fetchVentasCsv();
      const headers = rows[0] || [];
      const q = normalizeText(search);
      const dataRows = rows.slice(1).filter((r) => r.some((c) => String(c || "").trim()));
      setVentasCache({ headers, rows: dataRows });
      const found = dataRows
        .map((r, i) => ({ r, sheetRow: i + 2 }))
        .filter(({ r }) => normalizeText(r[7] || "").includes(q))
        .map(({ r, sheetRow }) => mapVentasRow(headers, r, sheetRow));
      if (!found.length) setShErr(`Sin resultados para "${search}"`);
      else setResults(found);
    } catch (e) {
      setShErr(`Error: ${e.message}`);
    } finally {
      setLoadSh(false);
    }
  }

  async function cargarActuales() {
    setLoadSh(true);
    setShErr("");
    setResults([]);
    try {
      const rows = await fetchVentasCsv();
      const headers = rows[0] || [];
      const dataRows = rows.slice(1).filter((r) => r.some((c) => String(c || "").trim()));
      setVentasCache({ headers, rows: dataRows });
      const found = dataRows.map((r, i) => mapVentasRow(headers, r, i + 2));
      if (!found.length) setShErr("No hay filas con datos en esta pestaña.");
      else {
        setResults(found);
        setShErr("");
      }
    } catch (e) {
      setShErr(`Error: ${e.message}`);
    } finally {
      setLoadSh(false);
    }
  }

  async function agregarStop(r) {
    const baseStop = {
      ...mkStop(stops.length),
      cliente: r.nombre,
      direccion: r.dir,
      telefono: r.tel,
      pdfLink: r.pdf,
      mapLink: r.dir ? mapsUrl(r.dir) : "",
      rawSheetText: r.rawSheetText || "",
      orderId: r.orderId || "",
      pickupId: r.pickupId || "",
      cotizacionId: r.cotizacionId || r.orderId || "",
      zona: r.zona || "",
      contactoRecepcion: r.recepcionContacto || "",
      fechaEntrega: r.fechaEntrega || "",
      ventasSheetRow1Based: r.ventasSheetRow1Based ?? null,
      ventasTabGid: r.ventasTabGid || SH_GID,
      checks: {
        ...mkStop(0).checks,
        datosOk: Boolean(r.nombre && r.dir && r.tel),
        mapaOk: Boolean(r.dir),
        adjuntoOk: Boolean(r.pdf),
      },
    };
    setAutoLoadMsg((r.pdf || r.rawSheetText) ? `Intentando autocompletar paneles para ${r.nombre}...` : "");
    let enrichedStop = baseStop;
    if (r.pdf || r.rawSheetText) {
      const inferred = await inferStopCargo(baseStop);
      enrichedStop = {
        ...baseStop,
        paneles: inferred.paneles,
        accesorios: inferred.accesorios,
        accPackage: buildAccessoryPackageConfig({ ...baseStop, accesorios: inferred.accesorios, paneles: inferred.paneles }, accProfiles),
        observacionesLogistica: inferred.warnings.filter(Boolean).join(" | "),
        recepcionDetalle: inferred.warnings.filter(Boolean).join(" | "),
        checks: {
          ...baseStop.checks,
          bultosOk: inferred.paneles.length > 0,
          accesoriosOk: inferred.accesorios.length > 0 || baseStop.checks.accesoriosOk,
        },
      };
      if (inferred.paneles.length || inferred.accesorios.length) {
        setAutoLoadMsg(`Autocarga OK: ${inferred.paneles.length} líneas de paneles y ${inferred.accesorios.length} accesorios para ${r.nombre}.`);
      } else if (inferred.warnings.length) {
        setAutoLoadMsg(`No se pudo inferir carga automáticamente para ${r.nombre}. ${inferred.warnings[0]}`);
      } else {
        setAutoLoadMsg(`No se detectaron paneles automáticamente para ${r.nombre}.`);
      }
    }
    setStops((p) => [...p, enrichedStop]);
    setResults([]);
    setSearch("");
    setView("form");
  }

  async function retryAutoLoadForStop(stop) {
    setRetryingStopId(stop.id);
    setAutoLoadMsg(`Reintentando autocarga para ${stop.cliente || `Parada ${stop.orden}`}...`);
    try {
      const inferred = await inferStopCargo(stop);
      setStops((prev) =>
        prev.map((item) =>
          item.id === stop.id
            ? {
                ...item,
                paneles: inferred.paneles.length ? inferred.paneles : item.paneles,
                accesorios: inferred.accesorios.length ? inferred.accesorios : item.accesorios,
                accPackage: buildAccessoryPackageConfig({
                  ...item,
                  paneles: inferred.paneles.length ? inferred.paneles : item.paneles,
                  accesorios: inferred.accesorios.length ? inferred.accesorios : item.accesorios,
                }, accProfiles),
                observacionesLogistica: inferred.warnings.filter(Boolean).join(" | "),
                recepcionDetalle: inferred.warnings.filter(Boolean).join(" | "),
                checks: {
                  ...item.checks,
                  bultosOk: inferred.paneles.length > 0 || item.paneles.length > 0,
                  accesoriosOk: inferred.accesorios.length > 0 || item.accesorios.length > 0 || item.checks?.accesoriosOk,
                },
              }
            : item
        )
      );
      if (inferred.paneles.length || inferred.accesorios.length) {
        setAutoLoadMsg(`Reintento OK para ${stop.cliente || `Parada ${stop.orden}`}: ${inferred.paneles.length} líneas de paneles y ${inferred.accesorios.length} accesorios.`);
      } else if (inferred.warnings.length) {
        setAutoLoadMsg(`Sin autocarga para ${stop.cliente || `Parada ${stop.orden}`}. ${inferred.warnings[0]}`);
      } else {
        setAutoLoadMsg(`Sin resultados nuevos para ${stop.cliente || `Parada ${stop.orden}`}.`);
      }
    } finally {
      setRetryingStopId("");
    }
  }

  function sendWA() {
    const lines = stops
      .map((s) => {
        const stopPkgs = buildStopPackages(s);
        const pkgLines = stopPkgs
          .map((pk, idx) => `  📦 ${stopPackageCode(s, idx)} · ${packageSummary(pk)}`)
          .join("\n");
        return `*P${s.orden}: ${s.cliente || "—"}*\nPedido: ${orderDisplayId(s)}${s.pickupId ? ` · Retiro: ${s.pickupId}` : ""}\nEstado: ${s.estado || "Pendiente"}\n📞 ${s.telefono || "—"}\n📍 ${s.direccion || "—"}\n🗺️ ${s.mapLink || (s.direccion ? mapsUrl(s.direccion) : "—")}\n${pkgLines || "  Sin paneles cargados"}${s.accesorios.length ? `\n🔩 ${s.accesorios.map((a) => `${a.cantidad}× ${a.descr}`).join(" · ")}` : ""}${s.recepcionDetalle ? `\nObs.: ${s.recepcionDetalle}` : ""}`;
      })
      .join("\n\n");
    const msg = `🚚 *BMC ${info.numero}* · ${info.fecha}\n🚛 ${info.transportista || "—"} ${info.patente || "—"}\n${info.notas ? `📝 ${info.notas}\n` : ""}\n${lines}\n\n*${cargo.placed.length} pkgs · ${stops.length} paradas · Camión ${truckL}m*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  function moveManualKey(key, dir) {
    setManualPkgOrderKeys((prev) => {
      const idx = prev.indexOf(key);
      if (idx < 0) return prev;
      const ni = idx + dir;
      if (ni < 0 || ni >= prev.length) return prev;
      const next = [...prev];
      const t = next[idx];
      next[idx] = next[ni];
      next[ni] = t;
      return next;
    });
  }

  function setRowOverrideForKey(key, rowVal) {
    setRowOverrides((prev) => {
      const next = { ...prev };
      if (rowVal === "" || rowVal == null) delete next[key];
      else next[key] = Number(rowVal);
      return next;
    });
  }

  function lookupPkgMetaByStableKey(key) {
    for (const s of stops) {
      const pkgs = buildStopPackages(s);
      const found = pkgs.find((p) => p.stableKey === key);
      if (found) return { stop: s, pkg: found };
    }
    return { stop: null, pkg: null };
  }

  return (
    <div style={{ fontFamily: T.font, background: T.bg, minHeight: "100vh", padding: 16 }}>
      <style>{`@media print{.np{display:none!important}} * {box-sizing:border-box;}`}</style>

      <div style={{ ...css.card, display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "16px 20px", borderLeft: `4px solid ${T.brand}`, marginBottom: 12 }} className="np">
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 20, color: T.brand }}>BMC Uruguay — Logística de Carga</h1>
          <div style={{ color: T.muted, fontSize: 13 }}>{`2 filas máx · altura ${MAX_H}m · saliente 2m · pedidos no se mezclan`}</div>
        </div>
        <div style={{ textAlign: "right", color: T.muted, fontSize: 12 }}>
          <div style={{ fontWeight: 700, color: T.text }}>{info.numero} · {info.fecha}</div>
          <div style={{ marginTop: 4 }}>{totPan} paneles · {cargo.placed.length} pkgs · {stops.length} paradas</div>
        </div>
      </div>

      {cargo.warns.map((w, i) => (
        <div key={i} style={{ background: "#ffeceb", border: "1px solid rgba(255,59,48,.25)", color: "#b42318", padding: "10px 14px", borderRadius: 10, marginBottom: 8, fontSize: 13 }}>⚠️ {w}</div>
      ))}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }} className="np">
        {[["form", "📋 Formulario"], ["remito", "📄 Remito"], ["carga", "🚛 Diagrama 3D"]].map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: `1.5px solid ${view === v ? T.primary : T.border}`,
              background: view === v ? T.primary : T.surface,
              color: view === v ? "#fff" : T.text,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: T.font,
            }}
          >
            {l}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>Camión</span>
          <select
            value={truckL}
            onChange={(e) => setTruckL(Number(e.target.value))}
            style={{ padding: "7px 10px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontFamily: T.font, background: T.surface, color: T.text }}
          >
            {[6, 7, 8, 9, 10, 12, 14].map((l) => <option key={l} value={l}>{l}m</option>)}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>Distribución</span>
          <select
            value={distributionMode}
            onChange={(e) => setDistributionMode(e.target.value)}
            style={{ padding: "7px 10px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontFamily: T.font, background: T.surface, color: T.text }}
          >
            {DISTRIBUTION_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>Carga</span>
          <select
            value={cargoLayoutMode}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "manual") {
                setManualPkgOrderKeys(buildDefaultManualOrderKeys(stops));
                setCargoLayoutMode("manual");
              } else {
                setCargoLayoutMode("auto");
                setRowOverrides({});
              }
            }}
            style={{ padding: "7px 10px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontFamily: T.font, background: T.surface, color: T.text }}
          >
            <option value="auto">Automática</option>
            <option value="manual">Manual (orden)</option>
          </select>
        </div>
        <Btn onClick={sendWA} color="#25D366">📲 WhatsApp</Btn>
      </div>

      {view === "remito" ? <RemitoView info={info} stops={stops} cargo={cargo} truckL={truckL} sendWA={sendWA} /> : null}

      {view === "carga" ? (
        <div>
          <DiagramPanel cargo={cargo} truckL={truckL} remitoNumero={info.numero} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12, width: "100%", maxWidth: "100%", minWidth: 0 }}>
            <div style={{ ...css.card, padding: 14, minWidth: 0, maxWidth: "100%" }}>
              <div style={{ ...css.sectionTitle, marginBottom: 8 }}>🔭 Vista Superior</div>
              {(() => {
                const TPX = 50;
                const TPY = 70;
                const { minXV, maxXV, placedView } = bedViewExtents(cargo.placed, truckL);
                const totalLen = maxXV - minXV;
                const cabW = CAB_LEN_M * TPX;
                const bedLeft = 40 + (-minXV) * TPX;
                const cabLeft = bedLeft - cabW;
                const shiftX = cabLeft < 14 ? 14 - cabLeft : 0;
                const tvW = Math.max(320, totalLen * TPX + cabW + 100 + shiftX);
                const tvH = TRUCK_W * TPY + 60;
                const sx = (x) => x + shiftX;
                return (
                  <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
                    <svg width="100%" height="auto" viewBox={`0 0 ${tvW} ${tvH}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", maxWidth: "100%", height: "auto" }}>
                      <TruckCabTopSvg x={sx(cabLeft)} y={10} w={cabW} h={TRUCK_W * TPY} stroke={T.primary} fill={T.surfaceAlt} />
                      <rect x={sx(bedLeft)} y={10} width={truckL * TPX} height={TRUCK_W * TPY} fill={T.surfaceAlt} stroke={T.primary} strokeWidth={1.5} />
                      {maxXV > truckL ? <rect x={sx(40 + (truckL - minXV) * TPX)} y={10} width={(maxXV - truckL) * TPX} height={TRUCK_W * TPY} fill="#fff8ec" stroke={T.warning} strokeWidth={1} strokeDasharray="4,3" /> : null}
                      <line x1={sx(40)} y1={10 + ROW_W * TPY} x2={sx(40 + totalLen * TPX)} y2={10 + ROW_W * TPY} stroke={T.primary} strokeWidth={1} strokeDasharray="4,3" />
                      {[...placedView].sort((a, b) => b.sOrd - a.sOrd).map((pkg) => {
                        const pw = pkg.len * TPX;
                        const ph2 = ROW_W * TPY;
                        const py2 = 10 + pkg.row * ROW_W * TPY;
                        const px2 = sx(40 + (pkg.xStart - minXV) * TPX);
                        return (
                          <g key={pkg.id}>
                            <rect x={px2} y={py2 + 1} width={pw - 1} height={ph2 - 2} fill={pkg.ov ? T.danger : pkg.sCol} opacity={0.8} rx={2} />
                            {pw > 42 ? <text x={px2 + pw / 2} y={py2 + ph2 / 2 + 4} textAnchor="middle" fontSize={9} fill="white" fontWeight="bold">P{pkg.sOrd}·{pkg.kind === "accessory" ? "ACC" : `${pkg.n}u`}</text> : null}
                          </g>
                        );
                      })}
                      <text x={sx(bedLeft)} y={8} textAnchor="middle" fontSize={8} fill={T.primary} fontWeight="bold">
                        Cab.
                      </text>
                      <text x={sx(bedLeft + truckL * TPX)} y={8} textAnchor="middle" fontSize={8} fill={T.warning} fontWeight="bold">
                        Cola
                      </text>
                      <text x={sx(bedLeft) + (truckL * TPX) / 2} y={tvH - 4} textAnchor="middle" fontSize={8} fill={T.muted}>↔ {truckL}m carrocería</text>
                      <text x={sx(34)} y={10 + ROW_W * TPY / 2 + 3} textAnchor="end" fontSize={8} fill={T.muted}>A</text>
                      <text x={sx(34)} y={10 + ROW_W * TPY + ROW_W * TPY / 2 + 3} textAnchor="end" fontSize={8} fill={T.muted}>B</text>
                    </svg>
                  </div>
                );
              })()}
            </div>
            <div style={{ ...css.card, padding: 14, minWidth: 0, maxWidth: "100%" }}>
              <div style={{ ...css.sectionTitle, marginBottom: 8 }}>📏 Vista lateral izq. (desde cabina)</div>
              {(() => {
                const SVX = 50;
                const SVZ = 90;
                const { minXV, maxXV, placedView } = bedViewExtents(cargo.placed, truckL);
                const totalLen = maxXV - minXV;
                const cabW = CAB_LEN_M * SVX;
                const bedLeft = 40 + (-minXV) * SVX;
                const cabLeft = bedLeft - cabW;
                const shiftX = cabLeft < 14 ? 14 - cabLeft : 0;
                const sx = (x) => x + shiftX;
                const svW = Math.max(320, totalLen * SVX + cabW + 120 + shiftX);
                const svH = MAX_H * SVZ + 60;
                const groundY = svH - 10;
                const rowOp = (row) => (row === 0 ? 0.9 : 0.45);
                return (
                  <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
                    <svg width="100%" height="auto" viewBox={`0 0 ${svW} ${svH + 20}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", maxWidth: "100%", height: "auto" }}>
                      <line x1={sx(40)} y1={groundY} x2={sx(40 + totalLen * SVX + 20)} y2={groundY} stroke={T.text} strokeWidth={2} />
                      <TruckCabSideSvg x={sx(cabLeft)} cabW={cabW} groundY={groundY} svz={SVZ} stroke={T.primary} fill={T.surfaceAlt} />
                      <rect x={sx(bedLeft)} y={10} width={truckL * SVX} height={svH - 20} fill={T.surfaceAlt} stroke={T.primary} strokeWidth={1.5} />
                      {maxXV > truckL ? <rect x={sx(40 + (truckL - minXV) * SVX)} y={10} width={(maxXV - truckL) * SVX} height={svH - 20} fill="#fff8ec" stroke={T.warning} strokeWidth={1} strokeDasharray="4,3" /> : null}
                      <line x1={sx(35)} y1={groundY - MAX_H * SVZ} x2={sx(40 + totalLen * SVX + 10)} y2={groundY - MAX_H * SVZ} stroke={T.danger} strokeWidth={1.2} strokeDasharray="5,3" />
                      <text x={sx(32)} y={groundY - MAX_H * SVZ + 3} textAnchor="end" fontSize={8} fill={T.danger} fontWeight="bold">{`${MAX_H}m`}</text>
                      {[...placedView].sort((a, b) => b.sOrd - a.sOrd).map((pkg) => {
                        const bx = sx(40 + (pkg.xStart - minXV) * SVX);
                        const by = groundY - pkg.zBase * SVZ - pkg.h * SVZ;
                        const bw = pkg.len * SVX;
                        const bh = pkg.h * SVZ;
                        return (
                          <g key={pkg.id}>
                            <rect x={bx} y={by} width={bw - 1} height={Math.max(bh - 1, 2)} fill={pkg.ov ? T.danger : pkg.sCol} opacity={rowOp(pkg.row)} rx={1} />
                            {bh > 12 && bw > 40 ? <text x={bx + bw / 2} y={by + bh / 2 + 3} textAnchor="middle" fontSize={7} fill="white" fontWeight="bold">{pkg.kind === "accessory" ? `P${pkg.sOrd} ACC` : `P${pkg.sOrd}`}</text> : null}
                          </g>
                        );
                      })}
                      {Array.from({ length: Math.floor(MAX_H / 0.5) + 1 }, (_, i) => i * 0.5).map((m) => {
                        const py = groundY - m * SVZ;
                        return (
                          <g key={m}>
                            <line x1={sx(36)} y1={py} x2={sx(40)} y2={py} stroke={T.muted} strokeWidth={1} />
                            <text x={sx(34)} y={py + 3} textAnchor="end" fontSize={7} fill={T.muted}>{m}m</text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                );
              })()}
            </div>
            <div style={{ ...css.card, padding: 14, minWidth: 0, maxWidth: "100%" }}>
              <div style={{ ...css.sectionTitle, marginBottom: 8 }}>📐 Vista lateral der.</div>
              {(() => {
                const SVX = 50;
                const SVZ = 90;
                const { minXV, maxXV, placedView } = bedViewExtents(cargo.placed, truckL);
                const totalLen = maxXV - minXV;
                const cabW = CAB_LEN_M * SVX;
                const bedLeft = 40 + (-minXV) * SVX;
                const cabLeft = bedLeft - cabW;
                const shiftX = cabLeft < 14 ? 14 - cabLeft : 0;
                const sx = (x) => x + shiftX;
                const svW = Math.max(320, totalLen * SVX + cabW + 120 + shiftX);
                const svH = MAX_H * SVZ + 60;
                const groundY = svH - 10;
                const rowOp = (row) => (row === 1 ? 0.9 : 0.45);
                const leftEdge = sx(cabLeft);
                const rightEdge = sx(40 + totalLen * SVX + 20);
                const mirrorT = leftEdge + rightEdge;
                const cabTopLabel = groundY - CAB_HEIGHT_M * SVZ;
                return (
                  <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
                    <svg width="100%" height="auto" viewBox={`0 0 ${svW} ${svH + 20}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", maxWidth: "100%", height: "auto" }}>
                      <g transform={`translate(${mirrorT},0) scale(-1,1)`}>
                        <line x1={sx(40)} y1={groundY} x2={rightEdge} y2={groundY} stroke={T.text} strokeWidth={2} />
                        <TruckCabSideSvg x={sx(cabLeft)} cabW={cabW} groundY={groundY} svz={SVZ} stroke={T.primary} fill={T.surfaceAlt} showLabel={false} />
                        <rect x={sx(bedLeft)} y={10} width={truckL * SVX} height={svH - 20} fill={T.surfaceAlt} stroke={T.primary} strokeWidth={1.5} />
                        {maxXV > truckL ? <rect x={sx(40 + (truckL - minXV) * SVX)} y={10} width={(maxXV - truckL) * SVX} height={svH - 20} fill="#fff8ec" stroke={T.warning} strokeWidth={1} strokeDasharray="4,3" /> : null}
                        <line x1={sx(35)} y1={groundY - MAX_H * SVZ} x2={sx(40 + totalLen * SVX + 10)} y2={groundY - MAX_H * SVZ} stroke={T.danger} strokeWidth={1.2} strokeDasharray="5,3" />
                        {[...placedView].sort((a, b) => b.sOrd - a.sOrd).map((pkg) => {
                          const bx = sx(40 + (pkg.xStart - minXV) * SVX);
                          const by = groundY - pkg.zBase * SVZ - pkg.h * SVZ;
                          const bw = pkg.len * SVX;
                          const bh = pkg.h * SVZ;
                          return (
                            <rect key={pkg.id} x={bx} y={by} width={bw - 1} height={Math.max(bh - 1, 2)} fill={pkg.ov ? T.danger : pkg.sCol} opacity={rowOp(pkg.row)} rx={1} />
                          );
                        })}
                      </g>
                      <text x={mirrorT - (sx(cabLeft) + cabW / 2)} y={cabTopLabel - 3} textAnchor="middle" fontSize={7} fill={T.muted}>Cabina</text>
                      {[...placedView].sort((a, b) => b.sOrd - a.sOrd).map((pkg) => {
                        const bx = sx(40 + (pkg.xStart - minXV) * SVX);
                        const by = groundY - pkg.zBase * SVZ - pkg.h * SVZ;
                        const bw = pkg.len * SVX;
                        const bh = pkg.h * SVZ;
                        const cx = mirrorT - (bx + bw / 2);
                        const label = pkg.kind === "accessory" ? `P${pkg.sOrd} ACC` : `P${pkg.sOrd}`;
                        return bh > 12 && bw > 40 ? <text key={`t-${pkg.id}`} x={cx} y={by + bh / 2 + 3} textAnchor="middle" fontSize={7} fill="white" fontWeight="bold">{label}</text> : null;
                      })}
                      <text x={mirrorT - sx(32)} y={groundY - MAX_H * SVZ + 3} textAnchor="start" fontSize={8} fill={T.danger} fontWeight="bold">{`${MAX_H}m`}</text>
                      {Array.from({ length: Math.floor(MAX_H / 0.5) + 1 }, (_, i) => i * 0.5).map((m) => {
                        const py = groundY - m * SVZ;
                        return (
                          <g key={m}>
                            <line x1={mirrorT - sx(40)} y1={py} x2={mirrorT - sx(36)} y2={py} stroke={T.muted} strokeWidth={1} />
                            <text x={mirrorT - sx(34)} y={py + 3} textAnchor="end" fontSize={7} fill={T.muted}>{m}m</text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}

      {view === "form" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr .9fr", gap: 12 }}>
          <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
            <div style={{ ...css.card, padding: 16, background: "#e8f1fb", borderColor: "#bfdbfe" }}>
              <h3 style={css.sectionTitle}>🔍 Buscar cliente en Ventas</h3>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input style={{ ...css.inp, flex: 1, minWidth: 160 }} placeholder="Nombre del cliente..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscarSheet()} />
                <Btn onClick={buscarSheet} disabled={loadSh}>{loadSh ? "⏳" : "Buscar"}</Btn>
                <Btn onClick={cargarActuales} disabled={loadSh} outline>Cargar actuales</Btn>
              </div>
              {ventasCache.rows.length ? <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>Última lectura: {ventasCache.rows.length} filas en pestaña actual.</div> : null}
              {shErr ? <div style={{ color: "#b42318", fontSize: 12, padding: "7px 10px", background: "#ffeceb", borderRadius: 8, marginBottom: 8 }}>{shErr}</div> : null}
              {autoLoadMsg ? <div style={{ color: T.brand, fontSize: 12, padding: "7px 10px", background: "#ffffff", borderRadius: 8, marginBottom: 8, border: "1px solid #bfdbfe" }}>{autoLoadMsg}</div> : null}
              {results.map((r, i) => (
                <div
                  key={i}
                  onClick={() => agregarStop(r)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.surface, border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 12px", cursor: "pointer", marginBottom: 6, transition: "background .15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#dbeafe"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = T.surface; }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: T.brand, fontSize: 13 }}>{r.nombre}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>📍{r.dir || "—"} · 📞{r.tel || "—"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {r.pdf ? <Btn href={r.pdf} target="_blank" outline small>📄 PDF</Btn> : null}
                    <Btn color={T.success} small>+ Parada</Btn>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ ...css.card, padding: 16 }}>
              <h3 style={css.sectionTitle}>Datos del Envío</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div><label style={css.lbl}>Nº Envío</label><input style={css.inp} value={info.numero} onChange={(e) => updInfo("numero", e.target.value)} /></div>
                <div><label style={css.lbl}>Fecha</label><input style={css.inp} type="date" value={info.fecha} onChange={(e) => updInfo("fecha", e.target.value)} /></div>
                <div>
                  <label style={css.lbl}>Transportista</label>
                  <input style={css.inp} list="bmc-transportistas-list" value={info.transportista} onChange={(e) => updInfo("transportista", e.target.value)} placeholder="Nombre o elegí de la lista" />
                  <datalist id="bmc-transportistas-list">
                    {transportistas.map((t) => <option key={t.id} value={t.nombre} />)}
                  </datalist>
                </div>
                <div><label style={css.lbl}>Patente</label><input style={css.inp} value={info.patente} onChange={(e) => updInfo("patente", e.target.value)} /></div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
                <input style={{ ...css.inp, flex: 1, minWidth: 140 }} placeholder="Nuevo transportista" value={newCarrierName} onChange={(e) => setNewCarrierName(e.target.value)} />
                <Btn
                  onClick={() => {
                    const nombre = newCarrierName.trim();
                    if (!nombre) return;
                    const id = uid();
                    setTransportistas((p) => [...p, { id, nombre, createdAt: Date.now() }]);
                    setNewCarrierName("");
                    setInfo((prev) => ({ ...prev, transportista: nombre, transportistaId: id }));
                  }}
                  outline
                  small
                >
                  Guardar transportista
                </Btn>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div><label style={css.lbl}>Precio viaje (UYU)</label><input style={css.inp} type="number" min={0} step="1" value={tripPriceInput} onChange={(e) => setTripPriceInput(e.target.value)} placeholder="Opcional" /></div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <Btn
                    onClick={() => {
                      const precio = safeNum(tripPriceInput, NaN);
                      if (!Number.isFinite(precio) || precio <= 0) return;
                      const m2 = estimateM2ForStops(stops);
                      const entry = {
                        id: uid(),
                        ts: Date.now(),
                        envioNumero: info.numero,
                        fecha: info.fecha,
                        transportista: info.transportista,
                        transportistaId: info.transportistaId,
                        truckL,
                        precio,
                        stopsCount: stops.length,
                        m2Estimado: m2,
                        zonas: stops.map((s) => s.zona).filter(Boolean),
                        orderIds: stops.map((s) => (s.orderId || s.cotizacionId || "").trim()).filter(Boolean),
                      };
                      setTripCostLog((p) => [entry, ...p].slice(0, 200));
                      setPriceHistory((p) =>
                        [
                          {
                            id: uid(),
                            ts: Date.now(),
                            transportistaId: info.transportistaId,
                            transportista: info.transportista,
                            largoM: truckL,
                            precio,
                            envioNumero: info.numero,
                          },
                          ...p,
                        ].slice(0, 500)
                      );
                      setTripPriceInput("");
                    }}
                    color={T.success}
                    small
                  >
                    Registrar costo viaje
                  </Btn>
                </div>
                <div style={{ fontSize: 11, color: T.muted, alignSelf: "flex-end" }}>
                  m² estimado: {estimateM2ForStops(stops).toFixed(1)} · historial: {tripCostLog.length}
                </div>
              </div>
              <label style={css.lbl}>Notas</label>
              <textarea style={{ ...css.inp, resize: "vertical", minHeight: 36 }} value={info.notas} onChange={(e) => updInfo("notas", e.target.value)} placeholder="Accesos, horarios..." />
            </div>

            <div style={{ ...css.card, padding: 16 }}>
              <h3 style={css.sectionTitle}>Email coordinación retiro (fábrica)</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <Btn onClick={() => copyToClipboard(generatePickupEmailSubject(stops))} outline small>Copiar asunto</Btn>
                <Btn onClick={() => copyToClipboard(generatePickupEmailBody(stops, cargo, info))} small>Copiar cuerpo</Btn>
                <Btn
                  onClick={() => copyToClipboard(`${generatePickupEmailSubject(stops)}\n\n${generatePickupEmailBody(stops, cargo, info)}`)}
                  outline
                  small
                >
                  Copiar todo
                </Btn>
              </div>
              <div style={{ fontSize: 12, color: T.muted, whiteSpace: "pre-wrap", background: T.surfaceAlt, borderRadius: 10, padding: 10, border: `1px solid ${T.border}` }}>
                <strong>{generatePickupEmailSubject(stops)}</strong>
                {"\n\n"}
                {generatePickupEmailBody(stops, cargo, info)}
              </div>
            </div>

            <div style={{ ...css.card, padding: 16 }}>
              <h3 style={css.sectionTitle}>Costeo (registro local)</h3>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>Últimos viajes registrados · exportable para análisis futuro.</div>
              <div style={{ maxHeight: 160, overflow: "auto", fontSize: 11, fontFamily: "ui-monospace, monospace" }}>
                {tripCostLog.slice(0, 15).map((line) => (
                  <div key={line.id} style={{ borderBottom: `1px solid ${T.border}`, padding: "4px 0" }}>
                    {line.fecha} · {line.envioNumero} · {line.truckL}m · ${line.precio} · {line.stopsCount} paradas · m²≈{line.m2Estimado?.toFixed?.(1) ?? line.m2Estimado}
                  </div>
                ))}
                {!tripCostLog.length ? <span style={{ color: T.muted }}>Sin registros aún.</span> : null}
              </div>
            </div>

            <div style={{ ...css.card, padding: 16 }}>
              <h3 style={css.sectionTitle}>Historial precios transporte</h3>
              <div style={{ maxHeight: 120, overflow: "auto", fontSize: 11, color: T.muted }}>
                {priceHistory.slice(0, 20).map((p) => (
                  <div key={p.id}>{new Date(p.ts).toLocaleDateString()} · {p.transportista || "—"} · {p.largoM}m · ${p.precio}</div>
                ))}
                {!priceHistory.length ? "Sin registros." : null}
              </div>
            </div>

            {!stops.length ? (
              <div style={{ ...css.card, padding: 20, textAlign: "center", color: T.muted, fontSize: 14 }}>
                No hay paradas. Usá <strong>Buscar</strong> o <strong>Cargar actuales</strong> en Ventas, o <strong>+ Agregar Parada</strong> para empezar vacío.
              </div>
            ) : null}

            {stops.map((stop) => {
              const placed = cargo.placed.filter((p) => p.sId === stop.id);
              const rowA = placed.filter((p) => p.row === 0);
              const rowB = placed.filter((p) => p.row === 1);
              const badges = getStopBadges(stop);
              const totalAcc = stop.accesorios.reduce((t, a) => t + safeNum(a.cantidad), 0);
              return (
                <div key={stop.id} style={{ ...css.card, padding: 16, borderLeft: `4px solid ${stop.color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${stop.color}22` }}>
                    <strong style={{ color: stop.color, fontSize: 14 }}>📍 PARADA {stop.orden}</strong>
                    <div style={{ display: "flex", gap: 6 }}>
                      {stop.pdfLink ? <Btn href={stop.pdfLink} target="_blank" outline small>📄 PDF</Btn> : null}
                      {stop.direccion ? <Btn href={stop.mapLink || mapsUrl(stop.direccion)} target="_blank" color={T.success} small>🗺️ Mapa</Btn> : null}
                      {(stop.pdfLink || stop.rawSheetText) ? (
                        <Btn onClick={() => retryAutoLoadForStop(stop)} outline small>
                          {retryingStopId === stop.id ? "⏳ Reintentando" : "↻ Reintentar autocarga"}
                        </Btn>
                      ) : null}
                      <Btn onClick={() => rmStop(stop.id)} color={T.danger} small>✕</Btn>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    <span style={badgeStyle("neutral")}>Pedido {orderDisplayId(stop)}</span>
                    <span style={badgeStyle("neutral")}>{placed.length} bultos · {safeNum(stop.paneles.reduce((t, p) => t + safeNum(p.cantidad), 0))} paneles · {totalAcc} acc.</span>
                    {badges.map((badge) => <span key={badge.label} style={badgeStyle(badge.tone)}>{badge.label}</span>)}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 8, marginBottom: 10 }}>
                    <div><label style={css.lbl}>Cliente</label><input style={css.inp} value={stop.cliente} onChange={(e) => updStop(stop.id, "cliente", e.target.value)} /></div>
                    <div><label style={css.lbl}>Teléfono</label><input style={css.inp} value={stop.telefono} onChange={(e) => updStop(stop.id, "telefono", e.target.value)} /></div>
                    <div><label style={css.lbl}>Dirección</label><input style={css.inp} value={stop.direccion} onChange={(e) => { updStop(stop.id, "direccion", e.target.value); updStop(stop.id, "mapLink", e.target.value ? mapsUrl(e.target.value) : ""); }} /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                    <div><label style={css.lbl}>ID pedido</label><input style={css.inp} value={stop.orderId || ""} onChange={(e) => updStop(stop.id, "orderId", e.target.value)} placeholder="Desde Ventas / CRM" /></div>
                    <div><label style={css.lbl}>ID cotización</label><input style={css.inp} value={stop.cotizacionId || ""} onChange={(e) => updStop(stop.id, "cotizacionId", e.target.value)} placeholder="Remito / cotización" /></div>
                    <div><label style={css.lbl}>ID retiro</label><input style={css.inp} value={stop.pickupId || ""} onChange={(e) => updStop(stop.id, "pickupId", e.target.value)} placeholder="Proveedor / fábrica" /></div>
                    <div><label style={css.lbl}>Zona</label><input style={css.inp} value={stop.zona || ""} onChange={(e) => updStop(stop.id, "zona", e.target.value)} placeholder="Barrio / zona" /></div>
                    <div><label style={css.lbl}>Recepción (contacto)</label><input style={css.inp} value={stop.contactoRecepcion || ""} onChange={(e) => updStop(stop.id, "contactoRecepcion", e.target.value)} placeholder="Nombre receptor" /></div>
                    <div><label style={css.lbl}>Horario</label><input style={css.inp} value={stop.horarioEntrega || ""} onChange={(e) => updStop(stop.id, "horarioEntrega", e.target.value)} placeholder="Ej. 08:00-12:00" /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 220px) 1fr", gap: 8, marginBottom: 12, alignItems: "end" }}>
                    <div>
                      <label style={css.lbl}>Fecha De Entrega</label>
                      <input
                        style={css.inp}
                        type="date"
                        value={/^\d{4}-\d{2}-\d{2}$/.test(String(stop.fechaEntrega || "").trim()) ? stop.fechaEntrega : ""}
                        onChange={(e) => onFechaEntregaChange(stop.id, e.target.value)}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: T.muted, paddingBottom: 8, lineHeight: 1.35 }}>
                      {stop.ventasSheetRow1Based
                        ? `Se guarda en la planilla Ventas (columna «Fecha De Entrega», G), fila ${stop.ventasSheetRow1Based}, formato dd/mm/aaaa. Requiere API y token.`
                        : "Para escribir en la planilla, agregá la parada desde Buscar / Cargar actuales (fila vinculada)."}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                    <div><label style={css.lbl}>Link PDF pedido</label><input style={css.inp} value={stop.pdfLink || ""} onChange={(e) => updStop(stop.id, "pdfLink", e.target.value)} placeholder="https://drive.google.com/..." /></div>
                    <div><label style={css.lbl}>Link mapa</label><input style={{ ...css.inp, color: T.muted, fontSize: 11 }} value={stop.mapLink || (stop.direccion ? mapsUrl(stop.direccion) : "")} onChange={(e) => updStop(stop.id, "mapLink", e.target.value)} /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                    <div>
                      <label style={css.lbl}>Estado operativo</label>
                      <select style={css.inp} value={stop.estado || "Pendiente"} onChange={(e) => updStop(stop.id, "estado", e.target.value)}>
                        {STOP_STATUS.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={css.lbl}>Recepción</label>
                      <select style={css.inp} value={stop.recepcionEstado || "Pendiente"} onChange={(e) => updStop(stop.id, "recepcionEstado", e.target.value)}>
                        {RECEPCION_STATUS.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={css.lbl}>Checklist de salida</label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                      {CHECK_KEYS.map(([key, label]) => (
                        <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 10px", background: T.surfaceAlt, fontSize: 12, color: T.text, textTransform: "none", letterSpacing: 0, marginBottom: 0 }}>
                          <input type="checkbox" checked={Boolean(stop.checks?.[key])} onChange={(e) => updStopCheck(stop.id, key, e.target.checked)} />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={css.lbl}>Paneles</label>
                    {stop.paneles.map((p) => {
                      const pks = buildPkgs(stop, p);
                      return (
                        <div key={p.id} style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                            <select style={{ ...css.inp, width: "auto", flex: 2, minWidth: 100 }} value={p.tipo} onChange={(e) => updPanel(stop.id, p.id, "tipo", e.target.value)}>
                              {TIPOS.map((t) => <option key={t}>{t}</option>)}
                            </select>
                            <select style={{ ...css.inp, width: 86 }} value={p.espesor} onChange={(e) => updPanel(stop.id, p.id, "espesor", Number(e.target.value))}>
                              {ESPS.map((e) => <option key={e} value={e}>{e}mm</option>)}
                            </select>
                            <select style={{ ...css.inp, width: 70 }} value={p.longitud} onChange={(e) => updPanel(stop.id, p.id, "longitud", Number(e.target.value))}>
                              {LENS.map((l) => <option key={l} value={l}>{l}m</option>)}
                            </select>
                            <input style={{ ...css.inp, width: 56 }} type="number" min={1} value={p.cantidad} onChange={(e) => updPanel(stop.id, p.id, "cantidad", Math.max(1, Number(e.target.value)))} />
                            <Btn onClick={() => rmPanel(stop.id, p.id)} color={T.danger} small>✕</Btn>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {pks.map((pk, i) => (
                              <span key={i} style={{ fontSize: 11, background: `${stop.color}12`, border: `1px solid ${stop.color}30`, borderRadius: 999, padding: "3px 9px", color: T.text }}>
                                {stopPackageCode(stop, i)}: {pk.n}p · {(pk.h * 100).toFixed(0)}cm
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <Btn onClick={() => addPanel(stop.id)} color={T.primary} small>+ Panel</Btn>
                  </div>

                  {placed.length > 0 ? (
                    <div style={{ background: `${stop.color}0d`, border: `1px solid ${stop.color}22`, borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 12 }}>
                      <b style={{ color: stop.color }}>En camión: </b>
                      {rowA.length > 0 ? <span> Fila A: {rowA.map((pk) => packageSummary(pk)).join(", ")}</span> : null}
                      {rowB.length > 0 ? <span> · Fila B: {rowB.map((pk) => packageSummary(pk)).join(", ")}</span> : null}
                    </div>
                  ) : null}

                  <div>
                    <label style={css.lbl}>Accesorios</label>
                    {(() => {
                      const accCfg = buildAccessoryPackageConfig(stop, accProfiles);
                      return stop.accesorios.length ? (
                        <div style={{ background: "#f8fafc", border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: T.brand }}>Bulto unico de accesorios por pedido</div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <span style={{ ...badgeStyle("neutral"), fontSize: 10 }}>{accCfg.profileLabel}</span>
                              <Btn onClick={() => applyAccSuggestion(stop.id)} outline small>Usar sugerida</Btn>
                            </div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                            <div>
                              <label style={css.lbl}>Largo</label>
                              <input style={css.inp} type="number" min={1} max={14} step="0.1" value={accCfg.longitud} onChange={(e) => updAccPackage(stop.id, "longitud", Number(e.target.value))} />
                            </div>
                            <div>
                              <label style={css.lbl}>Ancho</label>
                              <input style={css.inp} type="number" min={0.2} max={0.5} step="0.01" value={accCfg.ancho} onChange={(e) => updAccPackage(stop.id, "ancho", Number(e.target.value))} />
                            </div>
                            <div>
                              <label style={css.lbl}>Alto carga</label>
                              <input style={css.inp} type="number" min={0.1} max={0.5} step="0.01" value={accCfg.alto} onChange={(e) => updAccPackage(stop.id, "alto", Number(e.target.value))} />
                            </div>
                            <div>
                              <label style={css.lbl}>Espuma base</label>
                              <input style={css.inp} type="number" min={0} max={100} step="5" value={accCfg.foamMm} onChange={(e) => updAccPackage(stop.id, "foamMm", Number(e.target.value))} />
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>
                            Base tipica: 2 bloques de espuma de 50mm. Altura total estimada del bulto: {((safeNum(accCfg.alto) + safeNum(accCfg.foamMm) / 1000) * 100).toFixed(0)}cm.
                          </div>
                        </div>
                      ) : null;
                    })()}
                    {stop.accesorios.map((a) => (
                      <div key={a.id} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                        <input style={{ ...css.inp, flex: 3 }} placeholder="Perfil U, tornillos, silicona..." value={a.descr} onChange={(e) => updAcc(stop.id, a.id, "descr", e.target.value)} />
                        <input style={{ ...css.inp, width: 56 }} type="number" min={1} value={a.cantidad} onChange={(e) => updAcc(stop.id, a.id, "cantidad", Math.max(1, Number(e.target.value)))} />
                        <Btn onClick={() => rmAcc(stop.id, a.id)} color={T.danger} small>✕</Btn>
                      </div>
                    ))}
                    <Btn onClick={() => addAcc(stop.id)} outline small>+ Accesorio</Btn>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label style={css.lbl}>Observaciones logísticas / recepción</label>
                    <textarea style={{ ...css.inp, resize: "vertical", minHeight: 50 }} value={stop.recepcionDetalle || stop.observacionesLogistica || ""} onChange={(e) => { updStop(stop.id, "recepcionDetalle", e.target.value); updStop(stop.id, "observacionesLogistica", e.target.value); }} placeholder="Faltantes, daño, acceso, descarga parcial, etc." />
                  </div>
                </div>
              );
            })}

            <Btn onClick={addStop} color={T.success} style={{ width: "100%", padding: "12px 16px", fontSize: 14, borderRadius: 12 }}>
              + Agregar Parada
            </Btn>
          </div>

          <div style={{ position: "sticky", top: 16, alignSelf: "start" }}>
            <DiagramPanel cargo={cargo} truckL={truckL} remitoNumero={info.numero} />
            <div style={{ ...css.card, padding: 16, marginTop: 12 }}>
              <div style={css.sectionTitle}>Variantes sugeridas</div>
              <div style={{ display: "grid", gap: 8 }}>
                {cargoVariants.map((variant) => {
                  const rowMax = Math.max(...variant.cargo.rowH);
                  const stopLead = variant.cargo.stopUnloadOrder[0]?.stop?.cliente || "—";
                  const stackCount = variant.cargo.stacksByRow.reduce((acc, row) => acc + row.length, 0);
                  const unstableSupports = variant.cargo.placed.filter((pkg) => pkg.layerIndex > 0 && pkg.supportRatio < 0.98).length;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setDistributionMode(variant.id)}
                      style={{
                        textAlign: "left",
                        borderRadius: 10,
                        border: `1.5px solid ${distributionMode === variant.id ? T.primary : T.border}`,
                        background: distributionMode === variant.id ? "#e8f1fb" : T.surface,
                        padding: "10px 12px",
                        cursor: "pointer",
                        fontFamily: T.font,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                        <strong style={{ color: T.brand, fontSize: 13 }}>{variant.label}</strong>
                        <span style={{ fontSize: 11, color: distributionMode === variant.id ? T.primary : T.muted }}>
                          {distributionMode === variant.id ? "Activa" : "Usar"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: T.muted }}>
                        Altura crítica: {(rowMax * 100).toFixed(0)}cm · Pilas: {stackCount} · Apoyos críticos: {unstableSupports}
                      </div>
                      <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                        1° descarga: {stopLead} · Alertas: {variant.cargo.warns.length}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ ...css.card, padding: 16, marginTop: 12 }}>
              <div style={css.sectionTitle}>Orden de carga (manual)</div>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>
                {cargoLayoutMode === "manual" ? (
                  <span style={{ color: T.primary, fontWeight: 600 }}>Modo manual · v{MANUAL_LAYOUT_VERSION}</span>
                ) : (
                  "Elegí «Manual (orden)» arriba para reordenar bultos antes del cálculo."
                )}
              </div>
              {cargoLayoutMode === "manual" && manualPkgOrderKeys.length ? (
                <div style={{ display: "grid", gap: 6, maxHeight: 280, overflow: "auto" }}>
                  {manualPkgOrderKeys.map((key) => {
                    const meta = lookupPkgMetaByStableKey(key);
                    if (!meta.pkg || !meta.stop) return null;
                    return (
                      <div key={key} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 8, fontSize: 12, background: T.surfaceAlt }}>
                        <div style={{ fontWeight: 700, color: T.brand }}>P{meta.stop.orden} · {packageSummary(meta.pkg)}</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <Btn onClick={() => moveManualKey(key, -1)} outline small>↑</Btn>
                          <Btn onClick={() => moveManualKey(key, 1)} outline small>↓</Btn>
                          <select
                            value={rowOverrides[key] === 0 || rowOverrides[key] === 1 ? String(rowOverrides[key]) : ""}
                            onChange={(e) => setRowOverrideForKey(key, e.target.value)}
                            style={{ padding: "4px 8px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, fontFamily: T.font }}
                          >
                            <option value="">Fila (auto)</option>
                            <option value="0">Forzar A</option>
                            <option value="1">Forzar B</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <div style={{ ...css.card, padding: 16, marginTop: 12 }}>
              <div style={css.sectionTitle}>Próximamente</div>
              <div style={{ display: "grid", gap: 8, fontSize: 13, color: T.muted }}>
                {[
                  "Etiquetas QR por bulto y escaneo en recepción",
                  "Firma / foto de conformidad por parada",
                  "Optimización automática de ruta y multi-camión",
                  "Sync en tiempo real con CRM / Sheets",
                  "Control de peso legal y centro de carga",
                ].map((item) => (
                  <div key={item} style={{ padding: "8px 10px", borderRadius: 10, background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 12 }} className="np">
        {[["Camión", `${truckL}m`], ["Fila A", `${(cargo.rowH[0] * 100).toFixed(0)}cm / ${(MAX_H * 100).toFixed(0)}cm`], ["Fila B", `${(cargo.rowH[1] * 100).toFixed(0)}cm / ${(MAX_H * 100).toFixed(0)}cm`]].map(([k, v]) => (
          <div key={k} style={{ ...css.card, padding: "10px 14px" }}>
            <div style={{ ...css.lbl, marginBottom: 3 }}>{k}</div>
            <div style={{ fontWeight: 700, color: T.brand, fontSize: 15 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
