import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { parseLogisticaFromAdjuntoText } from "../../docs/bmc-dashboard-modernization/logistica-carga-prototype/lib/adjuntoLineParse.js";
import { extractTextFromPdfArrayBuffer } from "../../docs/bmc-dashboard-modernization/logistica-carga-prototype/lib/pdfTextExtract.js";
import { MAX_H, MANUAL_LAYOUT_VERSION } from "../utils/bmcLogisticaCargo.js";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import { bedViewExtents, mirrorStackForView, buildLogisticaPlanExportPayload } from "../utils/bmcLogisticaBedView.js";
import {
  ENV_T as T,
  enviosCardSolidStyle,
  enviosFieldStyle,
  enviosLabelStyle,
  enviosSectionTitleStyle,
} from "../utils/enviosTheme.js";
import {
  placeCargo,
  buildPkgs,
  buildStopPackages,
  ROW_W,
} from "../utils/logistica/cargoPacking.js";
import {
  formatPackageDimsLabel,
  packagePhysicalDims,
  packageRowYOffset,
} from "../utils/logistica/packageDims.js";
import {
  loadBridgePayload,
  clearBridgePayload,
  bridgePayloadToStops,
  mergeBridgeIntoStops,
} from "../utils/logistica/bridgePayload.js";
import { searchMappedVentasRows, withCoordinationChip } from "../utils/logistica/ventasSearch.js";
import {
  reorderStops,
  renumberStops,
  defaultCollapsedStopIds,
  toggleCollapsedStopId,
} from "../utils/logistica/stopReorder.js";
import {
  STOP_STATUS,
  applyStatusTransition,
  statusSelectOptions,
} from "../utils/logistica/stopStatusFsm.js";
import { buildRemitoSimpleModel, formatM3 } from "../utils/logistica/remitoPackageMetrics.js";
import {
  applyPackageLayoutChange,
  findStackNeighbors,
  PANEL_ON_PROFILE_REJECT_ES,
} from "../utils/logistica/packageDrop.js";
import {
  PANEL_ON_PROFILE_RULE_ES,
} from "../utils/logistica/stackConstraints.js";
import {
  applyFreePositionsToCargo,
  setFreePosition,
  clearFreePosition,
  normalizeFreePositionsMap,
  applyGroupDelta,
} from "../utils/logistica/freeDragLayout.js";
import {
  findSupportUnder,
  checkLengthOnShorter,
  BURIED_TOAST_ES,
} from "../utils/logistica/stackPhysics.js";
import {
  appendLoadWarning,
  formatLoadWarningsForPlan,
  normalizeLoadWarnings,
  warningFromLengthCheck,
  createLoadWarning,
  LOAD_WARNING_CODES,
} from "../utils/logistica/loadWarnings.js";
import { buildYardDump, clearYardPositions, countYardPackages } from "../utils/logistica/yardLayout.js";
import ViewerChrome from "./logistica/ViewerChrome.jsx";
import RepartoBar from "./logistica/RepartoBar.jsx";
import { canPlaceOnTop } from "../utils/logistica/stackConstraints.js";
import { allocateRepartoNo, repartoDateKey } from "../utils/logistica/repartoNumber.js";
import {
  buildRepartoPayload,
  statusOnFirstStop,
  repartoStatusLabel,
  stopSummariesForReparto,
} from "../utils/logistica/repartoStatus.js";
import {
  loadCatalogFromStorage,
  saveCatalogToStorage,
  addUserPlace,
  listPlaces,
  getPlaceById,
  mergeCatalogPlaces,
} from "../utils/logistica/pickupCatalog.js";
import {
  createWizardUi,
  shouldEnableWizard,
  applyDefaultPickupToStops,
  tryCompleteStep,
} from "../utils/logistica/wizardState.js";
import { suggestRoute } from "../utils/logistica/routeSuggest.js";
import EnvioWizardShell from "./logistica/wizard/EnvioWizardShell.jsx";
import StepPedidos from "./logistica/wizard/StepPedidos.jsx";
import StepFlota from "./logistica/wizard/StepFlota.jsx";
import StepLevantes from "./logistica/wizard/StepLevantes.jsx";
import StepRuta from "./logistica/wizard/StepRuta.jsx";
import {
  buildLoadPlanPrintModel,
} from "../utils/logistica/loadPlanPrintModel.js";
import {
  packageBultoCounts,
  packageLabelCompact,
  packageLabelTiny,
  highlightKeysForPackage,
} from "../utils/logistica/packageIdentity.js";
import { btnStyle } from "../utils/logistica/btnStyle.js";
import {
  mapsSearchUrl,
  mapsCoordsUrl,
  parseLatLng,
  applyGeocodeToStop,
  tripLegDistances,
} from "../utils/logistica/geocode.js";
import {
  buildEnviosDraft,
  parseEnviosDraftPayload,
  draftIdFromEnvNo,
} from "../utils/logistica/enviosDraft.js";
import {
  fingerprintDraft,
  shouldAutosave,
  parsePutDraftResponse,
  AUTOSAVE_MIN_INTERVAL_MS,
} from "../utils/logistica/enviosDraftSync.js";
import { safeHttpUrl, safeTelUrl } from "../utils/logistica/safeExternalUrl.js";
import PackageLayoutList from "./logistica/PackageLayoutList.jsx";
import EnviosDraftBrowser from "./logistica/EnviosDraftBrowser.jsx";
import {
  mapVentasRowV2,
  filterVentasLogisticaCandidates,
  labelVentasCandidate,
} from "../utils/logistica/ventasSheetMap.js";
import { inferCargoFromEncargoAndSheet } from "../utils/logistica/cargoFromEncargo.js";
import {
  matchAdminQuotes,
  normalizeAdminQuoteRow,
} from "../utils/logistica/adminQuoteMatch.js";

const TRUCK_W = 2.4;

/** Largo esquemático de cabina (solo dibujo orientativo, no afecta el motor de carga). */
const CAB_LEN_M = 2.4;
/** Altura cabina en vista lateral (m; escala vertical = SVZ px/m, mismo eje que paquetes). */
const CAB_HEIGHT_M = 1.5;
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

/** Solid content styles; chrome uses CSS classes from bmc-envios-glass.css */
const css = {
  card: enviosCardSolidStyle,
  inp: enviosFieldStyle,
  lbl: enviosLabelStyle,
  sectionTitle: enviosSectionTitleStyle,
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
  variant = "default",
  active = false,
}) {
  const s = btnStyle({ outline, small, disabled, color, variant, active, style });
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
  const panelLen = getStopLongestLength(stop);
  const manual = Boolean(current.manualDims);
  // When not manual, always track longest panel (mkStop default longitud:3 must not stick).
  const longitud = manual
    ? clamp(safeNum(preferCurrent ? current.longitud : undefined, saved?.longitud || panelLen), 1, 14)
    : panelLen;
  return {
    enabled: (stop?.accesorios || []).length > 0,
    longitud,
    ancho: clamp(
      safeNum(preferCurrent && manual ? current.ancho : undefined, saved?.ancho || preset.ancho),
      0.15,
      0.6,
    ),
    alto: clamp(
      safeNum(preferCurrent && manual ? current.alto : undefined, saved?.alto || preset.alto),
      0.1,
      0.5,
    ),
    foamMm: clamp(
      safeNum(preferCurrent && manual ? current.foamMm : undefined, saved?.foamMm || DEFAULT_ACC_FOAM_MM),
      0,
      100,
    ),
    manualDims: manual,
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
  /** Drive folder from Ventas col L (remito firmado target) */
  carpetaDrive: "",
  /** P2: { lat, lng, label, source, at } | null */
  geo: null,
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
    /** null → resolve to longest panel when packing (not a sticky 3m default) */
    longitud: null,
    ancho: DEFAULT_ACC_W,
    alto: DEFAULT_ACC_H,
    foamMm: DEFAULT_ACC_FOAM_MM,
    manualDims: false,
    profileKey: "",
    profileLabel: "General",
  },
  /** POD / confirm delivery (local draft; optional cloud draft later) */
  entregaConfirm: {
    confirmed: false,
    confirmedAt: null,
    comments: "",
    /** { name, mime, dataUrl, size, at } | null — base64 preview, keep small */
    proof: null,
  },
});
const mkPanel = () => ({ id: uid(), tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 1 });
const mkAcc = () => ({ id: uid(), descr: "", cantidad: 1 });
/** @deprecated use mapsSearchUrl — kept as thin alias for call sites */
const mapsUrl = (a) => mapsSearchUrl(a);

function truncate(s, n = 40) {
  const t = String(s || "").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, Math.max(1, n - 1))}…`;
}

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

/**
 * Phase B: try server adjunto proxy first (avoids Drive CORS), then browser fetch.
 * @param {string} url
 * @param {{ token?: string, apiBase?: string }} [opts]
 */
async function inferPanelsAndAccessoriesFromPdf(url, opts = {}) {
  const warnings = [];
  if (!url) return { paneles: [], accesorios: [], warnings };

  const token =
    opts.token ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_BMC_API_AUTH_TOKEN) ||
    "";
  const apiBase = opts.apiBase || (typeof getCalcApiBase === "function" ? getCalcApiBase() : "");

  // 1) Server proxy
  if (token && apiBase) {
    try {
      const proxyRes = await fetch(`${apiBase}/api/envios/adjunto-fetch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });
      const j = await proxyRes.json().catch(() => ({}));
      if (proxyRes.ok && j.ok && j.base64) {
        const binary = atob(j.base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        const buffer = bytes.buffer;
        const ctype = String(j.contentType || "").toLowerCase();
        if (ctype.includes("pdf") || /\.pdf/i.test(url) || bytes[0] === 0x25) {
          const pdf = await extractTextFromPdfArrayBuffer(buffer, { maxPages: 20 });
          const parsed = parseLogisticaFromAdjuntoText(pdf.text || "");
          return {
            paneles: parsed.paneles,
            accesorios: parsed.accesorios,
            warnings: ["Adjunto vía proxy API.", ...pdf.warnings, ...parsed.warnings],
            source: "adjunto_proxy",
          };
        }
        const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
        const parsed = parseLogisticaFromAdjuntoText(text || "");
        return {
          paneles: parsed.paneles,
          accesorios: parsed.accesorios,
          warnings: ["Adjunto texto vía proxy API.", ...parsed.warnings],
          source: "adjunto_proxy",
        };
      }
      if (j.error) {
        warnings.push(`Proxy adjunto: ${j.error}${j.message ? ` (${j.message})` : ""}`);
      }
    } catch (e) {
      warnings.push(`Proxy adjunto falló: ${e.message}`);
    }
  }

  // 2) Browser direct (Dropbox / public)
  const fetchUrl = toFetchablePdfUrl(url);
  let res;
  try {
    res = await fetch(fetchUrl);
  } catch (e) {
    return {
      paneles: [],
      accesorios: [],
      warnings: [...warnings, `No se pudo descargar el adjunto: ${e.message}`],
    };
  }
  if (!res.ok) {
    return {
      paneles: [],
      accesorios: [],
      warnings: [
        ...warnings,
        `Adjunto no accesible (${res.status}). Revisar permisos del PDF/Drive.`,
      ],
    };
  }

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("pdf") || /\.pdf(\?|$)/i.test(fetchUrl)) {
    const buffer = await res.arrayBuffer();
    const pdf = await extractTextFromPdfArrayBuffer(buffer, { maxPages: 20 });
    const parsed = parseLogisticaFromAdjuntoText(pdf.text || "");
    return {
      paneles: parsed.paneles,
      accesorios: parsed.accesorios,
      warnings: [...warnings, ...pdf.warnings, ...parsed.warnings],
      source: "adjunto_browser",
    };
  }

  const text = await res.text();
  const parsed = parseLogisticaFromAdjuntoText(text || "");
  return {
    paneles: parsed.paneles,
    accesorios: parsed.accesorios,
    warnings: [...warnings, ...parsed.warnings],
    source: "adjunto_browser",
  };
}

/** Ventas 2.0 map — see src/utils/logistica/ventasSheetMap.js */
function mapVentasRow(headers, row, sheetRow1Based) {
  return mapVentasRowV2(headers, row, sheetRow1Based, { gid: SH_GID });
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

  // 1) Filename / ENCARGO URL (works when Drive PDF is not downloadable from browser)
  const fromEncargo = inferCargoFromEncargoAndSheet(
    { pdf: pdfLink, pdfLink, rawSheetText },
    (text) => parseLogisticaFromAdjuntoText(text || ""),
  );
  if (fromEncargo.paneles.length || fromEncargo.accesorios.length) {
    // Prefer real PDF text when available (better qty); else filename lines.
    if (pdfLink) {
      const fromPdf = await inferPanelsAndAccessoriesFromPdf(pdfLink);
      if (fromPdf.paneles.length || fromPdf.accesorios.length) {
        return normalizeInferredCargo(fromPdf, "adjunto");
      }
      return normalizeInferredCargo(
        {
          paneles: fromEncargo.paneles,
          accesorios: fromEncargo.accesorios,
          warnings: [
            ...(fromPdf.warnings || []),
            ...fromEncargo.warnings,
          ],
        },
        "ENCARGO filename",
      );
    }
    return normalizeInferredCargo(fromEncargo, "ENCARGO filename");
  }

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
    return normalizeInferredCargo(
      {
        ...fromPdf,
        warnings: [
          ...(fromPdf.warnings || []),
          ...fromEncargo.warnings,
        ],
      },
      "adjunto",
    );
  }

  if (rawSheetText) {
    return normalizeInferredCargo(parseLogisticaFromAdjuntoText(rawSheetText), "Sheets");
  }

  return {
    paneles: [],
    accesorios: [],
    warnings: [
      "Sin PDF ni texto de respaldo en la búsqueda.",
      ...fromEncargo.warnings,
    ],
  };
}

function stopPackageCode(stop, index) {
  return `P${stop.orden}-B${index + 1}`;
}

function packageSummary(pkg) {
  if (pkg.kind === "accessory" || String(pkg.tipo || "").toUpperCase() === "ACCESORIOS") {
    const d = packagePhysicalDims(pkg);
    const contentH = Number(pkg.contentHeight);
    const hCm = Number.isFinite(contentH)
      ? (contentH * 100).toFixed(0)
      : ((d.H - (Number(pkg.foamMm) || 0) / 1000) * 100).toFixed(0);
    return `${pkg.tipo} ${d.L}m · ${(d.W * 100).toFixed(0)}×${hCm}cm + espuma ${pkg.foamMm ?? 50}mm`;
  }
  return `${pkg.n}x${pkg.tipo} ${pkg.esp}mm/${pkg.len}m`;
}

const detailToggleStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 6,
  width: "100%",
  textAlign: "left",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 8,
  padding: "8px 10px",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const detailBodyStyle = {
  background: "rgba(0,0,0,.2)",
  borderRadius: 8,
  padding: 10,
  fontSize: 12,
  lineHeight: 1.45,
  display: "grid",
  gap: 4,
};

/** Compact collapsible section for stop editor / package detail */
function FormSection({ title, summary, defaultOpen = false, children, tone }) {
  return (
    <details
      open={defaultOpen}
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        marginBottom: 10,
        background: tone === "success" ? "#f0fdf4" : tone === "warn" ? "#fffbeb" : T.surfaceAlt || "#f8fafc",
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          padding: "10px 12px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          fontWeight: 700,
          fontSize: 13,
          color: T.brand || T.text,
          userSelect: "none",
        }}
      >
        <span style={{ flex: "1 1 140px" }}>{title}</span>
        {summary ? (
          <span style={{ fontWeight: 500, fontSize: 11, color: T.muted, flex: "2 1 180px" }}>{summary}</span>
        ) : null}
      </summary>
      <div style={{ padding: "0 12px 12px", borderTop: `1px solid ${T.border}` }}>{children}</div>
    </details>
  );
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

function IsoBox({ x, y, z, dx, dy, dz, col, lbl, ox, oy, alpha = 1, selected = false, onClick }) {
  const c = (px, py, pz) => isoP(px, py, pz, ox, oy);
  const v = [c(x, y, z), c(x + dx, y, z), c(x + dx, y + dy, z), c(x, y + dy, z), c(x, y, z + dz), c(x + dx, y, z + dz), c(x + dx, y + dy, z + dz), c(x, y + dy, z + dz)];
  const tc = isoP(x + dx / 2, y + dy / 2, z + dz, ox, oy);
  const sw = selected ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.25)";
  return (
    <g opacity={alpha} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <polygon points={fp([v[3], v[2], v[6], v[7]])} fill={shd(col, 0.44)} stroke={sw} strokeWidth={selected ? 1.4 : 0.4} />
      <polygon points={fp([v[0], v[3], v[7], v[4]])} fill={shd(col, 0.58)} stroke={sw} strokeWidth={selected ? 1.2 : 0.4} />
      <polygon points={fp([v[1], v[2], v[6], v[5]])} fill={shd(col, 0.58)} stroke={sw} strokeWidth={selected ? 1.2 : 0.4} />
      <polygon points={fp([v[0], v[1], v[5], v[4]])} fill={shd(col, 0.74)} stroke={sw} strokeWidth={selected ? 1.2 : 0.4} />
      <polygon points={fp([v[4], v[5], v[6], v[7]])} fill={col} stroke={selected ? "#fff" : "rgba(255,255,255,.5)"} strokeWidth={selected ? 1.6 : 0.8} />
      {lbl && dz * ISZ > 11 ? (
        <text x={tc.px} y={tc.py + 3} textAnchor="middle" fontSize={6.5} fill="white" fontWeight="bold">
          {lbl}
        </text>
      ) : null}
    </g>
  );
}

function LoadPlanPrintSheet({ info, stops, cargo, truckL, loadWarnings = [] }) {
  const plan = buildLoadPlanPrintModel({ info, stops, cargo, truckL, loadWarnings });
  const maxX = Math.max(plan.maxX, truckL, 1);
  const scale = 280 / maxX;
  const sideH = 90;
  const topH = 70;

  return (
    <div className="load-plan-print" style={{ background: "#fff", color: "#1D1D1F", borderRadius: 8, padding: 12 }}>
      <style>{`@media print { .np { display: none !important; } .load-plan-print { box-shadow: none !important; } }`}</style>
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #003366", paddingBottom: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800, color: "#003366" }}>BMC URUGUAY · Plan de carga</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>{plan.header.numero} · {plan.header.fecha}</div>
        </div>
        <div style={{ fontSize: 11, textAlign: "right" }}>
          {plan.header.transportista || "—"} · {plan.header.patente || "—"} · camión {truckL}m
        </div>
      </div>

      {plan.warningLines?.length ? (
        <div
          style={{
            marginBottom: 12,
            padding: 10,
            borderRadius: 8,
            border: "1.5px solid #f59e0b",
            background: "#fffbeb",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", marginBottom: 6 }}>
            {plan.warningsSectionTitle || "Avisos de estiba (ISO operativa)"}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, lineHeight: 1.45, color: "#78350f" }}>
            {plan.warningLines.map((line) => (
              <li key={line}>{line.replace(/^\d+\.\s*/, "")}</li>
            ))}
          </ul>
          <div style={{ fontSize: 10, color: "#a16207", marginTop: 6 }}>
            Entregar esta sección al transportista / personal de carga.
          </div>
        </div>
      ) : null}

      <div style={{ fontSize: 12, fontWeight: 700, color: "#003366", marginBottom: 6 }}>Orden de descarga (físicamente viable)</div>
      <ol style={{ margin: "0 0 12px 18px", padding: 0, fontSize: 11, lineHeight: 1.45 }}>
        {plan.unloadSteps.map((s) => (
          <li key={`${s.step}-${s.stopId}`}>
            <b>Paso {s.step}:</b> {s.cliente || `Parada ${s.orden}`}
            {s.orderId ? ` · #${s.orderId}` : ""} — {s.note}
          </li>
        ))}
        {!plan.unloadSteps.length ? <li>Sin paradas</li> : null}
      </ol>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#003366", marginBottom: 4 }}>Vista superior</div>
      <svg width="100%" height={topH + 16} viewBox={`0 0 ${280 + 40} ${topH + 16}`} style={{ background: "#f8fafc", borderRadius: 6, marginBottom: 10 }}>
        <rect x={20} y={8} width={truckL * scale} height={TRUCK_W * (topH / TRUCK_W) * 0.85} fill="#0d2137" stroke="#3B82F6" />
        {plan.packages.map((p) => (
          <g key={`t-${p.id}`}>
            <rect
              x={20 + p.xStart * scale}
              y={8 + p.row * (topH / 2.4) * 0.9}
              width={Math.max(4, p.len * scale)}
              height={(topH / 2.4) * 0.85}
              fill={p.sCol || "#2563eb"}
              opacity={0.85}
              stroke="#fff"
              strokeWidth={0.5}
            />
            <text x={20 + p.xStart * scale + 2} y={8 + p.row * (topH / 2.4) * 0.9 + 10} fontSize={7} fill="#fff">{(p.sCli || p.sPed || p.label || "").slice(0, 12)}</text>
          </g>
        ))}
      </svg>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#003366", marginBottom: 4 }}>Vista lateral (altura)</div>
      <svg width="100%" height={sideH + 10} viewBox={`0 0 ${280 + 40} ${sideH + 10}`} style={{ background: "#f8fafc", borderRadius: 6, marginBottom: 10 }}>
        <rect x={20} y={sideH - MAX_H * (sideH / MAX_H) * 0.9} width={truckL * scale} height={MAX_H * (sideH / MAX_H) * 0.9} fill="none" stroke="#94a3b8" strokeDasharray="3,2" />
        {plan.packages.map((p) => {
          const sy = sideH - (p.zBase + p.h) * (sideH / MAX_H) * 0.9;
          return (
            <rect
              key={`s-${p.id}`}
              x={20 + p.xStart * scale}
              y={sy}
              width={Math.max(4, p.len * scale)}
              height={Math.max(3, p.h * (sideH / MAX_H) * 0.9)}
              fill={p.sCol || "#2563eb"}
              opacity={0.8}
              stroke="#fff"
              strokeWidth={0.4}
            />
          );
        })}
      </svg>

      <div style={{ fontSize: 11, color: "#64748b" }}>
        Paquetes: {plan.packages.length}. Usá vista 3D para cabina translúcida y etiquetas cliente+pedido. Imprimí con el navegador (Ctrl/Cmd+P).
      </div>
    </div>
  );
}

function DiagramPanel({
  cargo,
  truckL,
  remitoNumero,
  info,
  stops,
  onForcePackageRow,
  onForcePackageStack,
  onUpdateStop,
  freeDragEnabled = false,
  onFreeDragEnd = null,
  onGroupDragEnd = null,
  onClearFreeDrag = null,
  onToggleFreeDrag = null,
  freeDragCount = 0,
  multiSelectKeys = [],
  onMultiSelectChange = null,
  onBlocked = null,
  onUnloadTruck = null,
  yardMode = false,
  loadWarnings = [],
}) {
  const { placed, rowH, stopUnloadOrder, strategy, stacksByRow } = cargo;
  const { minXV, maxXV, placedView } = bedViewExtents(placed, truckL);
  const shiftX = -minXV;
  const totalLen = maxXV - minXV;
  const [diagramView, setDiagramView] = useState(() => {
    try {
      return localStorage.getItem("bmc-logistica-diagram-view") || "svg";
    } catch {
      return "svg";
    }
  });
  const [selectedPkgId, setSelectedPkgId] = useState(null);
  const [locExpanded, setLocExpanded] = useState(false);
  const [detailOpen, setDetailOpen] = useState({ cliente: false, entrega: false, confirm: false });
  const OX = 60;
  const OY = 85;
  const viewW = Math.max(420, OX + (totalLen * C30 + TRUCK_W * C30) * ISX + 80);
  const viewH = 240;
  const sorted = [...placedView].sort((a, b) => b.row - a.row || a.zBase - b.zBase);
  const bultoCounts = useMemo(() => packageBultoCounts(placed), [placed]);
  const selectedPkg = selectedPkgId
    ? placedView.find((p) => p.id === selectedPkgId) || placed.find((p) => p.id === selectedPkgId) || null
    : null;
  const highlightKeys = selectedPkg ? highlightKeysForPackage(placed, selectedPkg) : new Set();
  const selectedStop = (() => {
    if (!selectedPkg || !Array.isArray(stops)) return null;
    return (
      stops.find((s) => s.id === selectedPkg.sId) ||
      stops.find(
        (s) =>
          String(s.cliente || "").trim() === String(selectedPkg.sCli || "").trim() &&
          String(s.orderId || s.cotizacionId || "").trim() === String(selectedPkg.sPed || "").trim(),
      ) ||
      null
    );
  })();
  const stackNeighbors = selectedPkg
    ? findStackNeighbors(placed, selectedPkg)
    : { above: null, below: null };
  const tf = (x, y, z) => isoP(x, y, z, OX, OY);
  const trLine = (x1, y1, z1, x2, y2, z2, col = "#60A5FA", sw = 1, dash = "", k) => {
    const a = tf(x1, y1, z1);
    const b = tf(x2, y2, z2);
    return <line key={k} x1={a.px} y1={a.py} x2={b.px} y2={b.py} stroke={col} strokeWidth={sw} strokeDasharray={dash} />;
  };
  const pctA = Math.round((rowH[0] / MAX_H) * 100);
  const pctB = Math.round((rowH[1] / MAX_H) * 100);
  const barCol = (p) => (p > 95 ? "#ff3b30" : p > 70 ? "#ff9f0a" : "#34c759");
  const totalStacks = stacksByRow.reduce((acc, row) => acc + row.length, 0);
  const forceRow = (stableKey, row) => {
    if (onForcePackageRow && stableKey != null) onForcePackageRow(stableKey, row);
  };
  const forceStack = (stableKey, neighborKey, position) => {
    if (onForcePackageStack && stableKey && neighborKey) onForcePackageStack(stableKey, neighborKey, position);
  };
  const selectPkg = (pkg) => {
    setSelectedPkgId(pkg?.id || null);
    setLocExpanded(false);
    setDetailOpen({ cliente: false, entrega: false, confirm: false });
  };
  const clearSelect = () => {
    setSelectedPkgId(null);
    setLocExpanded(false);
    setDetailOpen({ cliente: false, entrega: false, confirm: false });
  };
  const toggleDetail = (key) => setDetailOpen((p) => ({ ...p, [key]: !p[key] }));

  useEffect(() => {
    try {
      localStorage.setItem("bmc-logistica-diagram-view", diagramView);
    } catch {
      /* ignore */
    }
  }, [diagramView]);

  const mapHref = safeHttpUrl(
    selectedStop?.mapLink ||
      (selectedStop?.geo ? mapsCoordsUrl(selectedStop.geo.lat, selectedStop.geo.lng, selectedStop.direccion) : "") ||
      (selectedStop?.direccion ? mapsSearchUrl(selectedStop.direccion) : ""),
  );

  return (
    <div
      className="envios-diagram-panel"
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
          <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "#fff" }}>
            {diagramView === "webgl" ? "Explorar carga (WebGL)" : diagramView === "plan" ? "Plan de carga (imprimible)" : "Vista isométrica (SVG)"}
          </h3>
          <p style={{ margin: 0, color: "rgba(255,255,255,.65)", fontSize: 12 }}>
            Clic bulto → ilumina cliente · fila A/B · arriba/abajo · estrategia: {DISTRIBUTION_MODES.find((m) => m.id === strategy)?.short || "Auto"}
          </p>
        </div>
        <div className="envios-diagram-toolbar" style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", alignItems: "center" }}>
          <Btn small variant="onDark" active={diagramView === "svg"} onClick={() => setDiagramView("svg")}>
            Isométrica
          </Btn>
          <Btn small variant="onDark" active={diagramView === "webgl"} onClick={() => setDiagramView("webgl")}>
            Explorar 3D
          </Btn>
          <Btn small variant="onDark" active={diagramView === "plan"} onClick={() => setDiagramView("plan")}>
            Plan carga
          </Btn>
          {typeof onToggleFreeDrag === "function" ? (
            <Btn
              small
              variant="onDark"
              active={freeDragEnabled}
              onClick={() => {
                if (!freeDragEnabled && diagramView !== "webgl") setDiagramView("webgl");
                onToggleFreeDrag(!freeDragEnabled);
              }}
              title="1 clic=detalle · Doble-clic+hold=arrastrar"
            >
              Free-Drag {freeDragEnabled ? "ON" : "OFF"}
              {freeDragCount > 0 ? ` (${freeDragCount})` : ""}
            </Btn>
          ) : null}
          {typeof onUnloadTruck === "function" ? (
            <Btn
              small
              variant="onDark"
              active={yardMode}
              onClick={() => {
                if (diagramView !== "webgl") setDiagramView("webgl");
                onUnloadTruck();
              }}
              title="Baja todos los pedidos a pilas separadas alrededor del camión"
            >
              {yardMode ? "Yard activo" : "Descargar camión"}
            </Btn>
          ) : null}
          <Btn
            small
            variant="onDark"
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
          >
            Exportar plan (JSON)
          </Btn>
        </div>
      </div>

      {selectedPkg ? (
        <div
          style={{
            background: "rgba(255,255,255,.08)",
            border: "1px solid rgba(255,255,255,.15)",
            borderRadius: 10,
            padding: "10px 12px",
            color: "#fff",
            fontSize: 12,
            display: "grid",
            gap: 8,
          }}
        >
          {/* Glance summary — always visible */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ minWidth: 0, flex: "1 1 200px" }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>
                {packageLabelCompact(selectedPkg, bultoCounts)}
              </div>
              <div style={{ color: "rgba(255,255,255,.75)", marginTop: 2, lineHeight: 1.35 }}>
                <b>{selectedPkg.tipo || "—"}</b>
                {" · "}Fila {selectedPkg.row === 0 ? "A" : "B"}
                {" · "}
                {formatPackageDimsLabel(selectedPkg, { includeVol: true })}
                {highlightKeys.size > 1 ? ` · ${highlightKeys.size} bultos del cliente` : ""}
              </div>
              <div style={{ color: "rgba(255,255,255,.55)", fontSize: 11, marginTop: 2 }}>
                {selectedStop?.cliente || selectedPkg.sCli || "—"}
                {" · #"}
                {selectedPkg.sPed || selectedStop?.orderId || "—"}
                {" · "}
                {selectedStop?.estado || "Pendiente"}
                {selectedStop?.zona ? ` · ${selectedStop.zona}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <Btn small variant="onDark" onClick={() => forceRow(selectedPkg.stableKey, 0)}>
                → Fila A
              </Btn>
              <Btn small variant="onDark" onClick={() => forceRow(selectedPkg.stableKey, 1)}>
                → Fila B
              </Btn>
              <Btn
                small
                variant="onDark"
                disabled={!stackNeighbors.above && !stackNeighbors.below}
                onClick={() => {
                  const peer = stackNeighbors.below || stackNeighbors.above;
                  if (peer?.stableKey) forceStack(selectedPkg.stableKey, peer.stableKey, "above");
                }}
                title="Apilar encima del bulto contiguo"
              >
                ↑ Encima
              </Btn>
              <Btn
                small
                variant="onDark"
                disabled={!stackNeighbors.above && !stackNeighbors.below}
                onClick={() => {
                  const peer = stackNeighbors.above || stackNeighbors.below;
                  if (peer?.stableKey) forceStack(selectedPkg.stableKey, peer.stableKey, "below");
                }}
                title="Colocar debajo del bulto contiguo"
              >
                ↓ Debajo
              </Btn>
              <Btn small variant="onDark" onClick={clearSelect}>
                Cerrar
              </Btn>
            </div>
          </div>

          {/* Collapsible detail sections */}
          <div style={{ display: "grid", gap: 6 }}>
            <button
              type="button"
              onClick={() => toggleDetail("cliente")}
              style={{
                ...detailToggleStyle,
                background: detailOpen.cliente ? "rgba(0,0,0,.22)" : "rgba(0,0,0,.12)",
              }}
            >
              <span>👤 Datos del cliente {detailOpen.cliente ? "▴" : "▾"}</span>
              <span style={{ opacity: 0.7, fontWeight: 500, fontSize: 11 }}>
                {selectedStop?.telefono || "sin tel"} · {truncate(selectedStop?.direccion || "sin dir", 28)}
              </span>
            </button>
            {detailOpen.cliente ? (
              <div style={detailBodyStyle}>
                <div style={{ fontWeight: 700 }}>{selectedStop?.cliente || selectedPkg.sCli || "—"}</div>
                <div>Pedido #{selectedPkg.sPed || selectedStop?.orderId || "—"}
                  {selectedStop?.cotizacionId ? ` · Cot ${selectedStop.cotizacionId}` : ""}
                  {selectedStop?.pickupId ? ` · Retiro ${selectedStop.pickupId}` : ""}
                </div>
                {safeTelUrl(selectedStop?.telefono) ? (
                  <a href={safeTelUrl(selectedStop.telefono)} style={{ color: "#93c5fd" }}>{selectedStop.telefono}</a>
                ) : (
                  <span style={{ opacity: 0.5 }}>Sin teléfono</span>
                )}
                <div>
                  <button
                    type="button"
                    onClick={() => setLocExpanded((v) => !v)}
                    style={{ background: "none", border: "none", color: "#fff", padding: 0, cursor: "pointer", fontWeight: 600 }}
                  >
                    {locExpanded ? selectedStop?.direccion || "Sin dirección" : truncate(selectedStop?.direccion || "Sin dirección", 48)}
                  </button>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => toggleDetail("entrega")}
              style={{
                ...detailToggleStyle,
                background: detailOpen.entrega ? "rgba(0,0,0,.22)" : "rgba(0,0,0,.12)",
              }}
            >
              <span>🚚 Datos de entrega {detailOpen.entrega ? "▴" : "▾"}</span>
              <span style={{ opacity: 0.7, fontWeight: 500, fontSize: 11 }}>
                {selectedStop?.zona || "sin zona"} · {selectedStop?.horarioEntrega || "sin horario"} · {selectedStop?.fechaEntrega || "sin fecha"}
              </span>
            </button>
            {detailOpen.entrega ? (
              <div style={detailBodyStyle}>
                <div>Zona: <b>{selectedStop?.zona || "—"}</b>
                  {" · "}Receptor: <b>{selectedStop?.contactoRecepcion || "—"}</b>
                </div>
                <div>Horario: {selectedStop?.horarioEntrega || "—"}
                  {" · "}Fecha: {selectedStop?.fechaEntrega || "—"}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {mapHref ? (
                    <a href={mapHref} target="_blank" rel="noopener noreferrer" style={{ color: "#93c5fd" }}>
                      Abrir mapa ↗
                    </a>
                  ) : (
                    <span style={{ opacity: 0.5 }}>Sin mapa</span>
                  )}
                  {safeHttpUrl(selectedStop?.pdfLink) ? (
                    <a href={safeHttpUrl(selectedStop.pdfLink)} target="_blank" rel="noopener noreferrer" style={{ color: "#93c5fd" }}>
                      PDF pedido ↗
                    </a>
                  ) : (
                    <span style={{ opacity: 0.5 }}>Sin PDF</span>
                  )}
                  <Btn
                    small
                    variant="onDark"
                    onClick={() => {
                      if (typeof window !== "undefined") window.print();
                    }}
                  >
                    Remito (imprimir)
                  </Btn>
                </div>
                <div style={{ opacity: 0.75, marginTop: 4 }}>
                  Estado: <b>{selectedStop?.estado || "—"}</b>
                  {" · "}Recepción: <b>{selectedStop?.recepcionEstado || "—"}</b>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => toggleDetail("confirm")}
              style={{
                ...detailToggleStyle,
                background: detailOpen.confirm ? "rgba(34,197,94,.2)" : "rgba(0,0,0,.12)",
                borderColor: selectedStop?.entregaConfirm?.confirmed ? "rgba(34,197,94,.5)" : "rgba(255,255,255,.12)",
              }}
            >
              <span>
                {selectedStop?.entregaConfirm?.confirmed ? "✅ Entrega confirmada" : "☑️ Confirmar entrega"}{" "}
                {detailOpen.confirm ? "▴" : "▾"}
              </span>
              <span style={{ opacity: 0.7, fontWeight: 500, fontSize: 11 }}>
                {selectedStop?.entregaConfirm?.proof ? "con comprobante" : "comprobante + comentarios"}
              </span>
            </button>
            {detailOpen.confirm && selectedStop && typeof onUpdateStop === "function" ? (
              <div style={detailBodyStyle}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(selectedStop.entregaConfirm?.confirmed)}
                    onChange={(e) => {
                      const confirmed = e.target.checked;
                      onUpdateStop(selectedStop.id, "entregaConfirm", {
                        ...(selectedStop.entregaConfirm || {}),
                        confirmed,
                        confirmedAt: confirmed ? new Date().toISOString() : null,
                      });
                      if (confirmed) {
                        onUpdateStop(selectedStop.id, "estado", "Entregada");
                        onUpdateStop(selectedStop.id, "recepcionEstado", selectedStop.recepcionEstado === "Pendiente" ? "Conforme" : selectedStop.recepcionEstado);
                      }
                    }}
                  />
                  <span>Marcar entrega confirmada</span>
                </label>
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>Comprobante (foto / PDF, máx ~1.5 MB)</div>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    style={{ fontSize: 11, color: "#fff", maxWidth: "100%" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 1.5 * 1024 * 1024) {
                        window.alert("Archivo demasiado grande (máx 1.5 MB). Comprimí la foto.");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        onUpdateStop(selectedStop.id, "entregaConfirm", {
                          ...(selectedStop.entregaConfirm || {}),
                          proof: {
                            name: file.name,
                            mime: file.type,
                            size: file.size,
                            dataUrl: String(reader.result || ""),
                            at: new Date().toISOString(),
                          },
                        });
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  {selectedStop.entregaConfirm?.proof?.name ? (
                    <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85 }}>
                      📎 {selectedStop.entregaConfirm.proof.name}
                      {" · "}
                      <button
                        type="button"
                        style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", padding: 0 }}
                        onClick={() =>
                          onUpdateStop(selectedStop.id, "entregaConfirm", {
                            ...(selectedStop.entregaConfirm || {}),
                            proof: null,
                          })
                        }
                      >
                        Quitar
                      </button>
                    </div>
                  ) : null}
                </div>
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>Comentarios de entrega</div>
                  <textarea
                    value={selectedStop.entregaConfirm?.comments || selectedStop.recepcionDetalle || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      onUpdateStop(selectedStop.id, "entregaConfirm", {
                        ...(selectedStop.entregaConfirm || {}),
                        comments: v,
                      });
                      onUpdateStop(selectedStop.id, "recepcionDetalle", v);
                    }}
                    placeholder="Receptor, faltantes, daño, acceso…"
                    rows={2}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,.2)",
                      background: "rgba(0,0,0,.25)",
                      color: "#fff",
                      fontSize: 12,
                      padding: 8,
                      resize: "vertical",
                    }}
                  />
                </div>
              </div>
            ) : detailOpen.confirm && !selectedStop ? (
              <div style={detailBodyStyle}>Sin parada vinculada a este bulto.</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 10, overflow: "hidden", width: "100%", maxWidth: "100%", minWidth: 0 }}>
        {diagramView === "plan" ? (
          <LoadPlanPrintSheet info={info} stops={stops} cargo={cargo} truckL={truckL} loadWarnings={loadWarnings} />
        ) : diagramView === "webgl" ? (
          <ViewerChrome
            toolbar={
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.65)" }}>
                {freeDragEnabled
                  ? "1 clic detalle · Doble-clic+hold arrastra · Shift+clic grupo"
                  : "Activá Free-Drag para armar a mano"}
                {yardMode ? " · YARD" : ""}
                {(multiSelectKeys || []).length ? ` · sel ${(multiSelectKeys || []).length}` : ""}
              </span>
            }
          >
            <Suspense
              fallback={
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.55)", fontSize: 13 }}>
                  Cargando vista 3D…
                </div>
              }
            >
              <LogisticaCargoScene3d
                placed={placedView}
                shiftX={shiftX}
                truckL={truckL}
                maxLen={maxXV}
                totalLen={Math.max(totalLen, truckL + 8)}
                onForceRow={forceRow}
                bultoCounts={bultoCounts}
                highlightKeys={highlightKeys}
                selectedPkgId={selectedPkgId}
                onSelectStableKey={(_key, pkg) => selectPkg(pkg)}
                freeDragEnabled={freeDragEnabled}
                onFreeDragEnd={onFreeDragEnd}
                onGroupDragEnd={onGroupDragEnd}
                onClearFreeDrag={onClearFreeDrag}
                multiSelectKeys={multiSelectKeys}
                onMultiSelectChange={onMultiSelectChange}
                onBlocked={onBlocked}
                fillParent
              />
            </Suspense>
          </ViewerChrome>
        ) : (
        <svg
          width="100%"
          viewBox={`0 -8 ${viewW} ${viewH}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block", maxWidth: "100%", height: "auto" }}
          onClick={clearSelect}
        >
          {maxXV > truckL ? (
            <polygon points={fp([tf(shiftX + truckL, 0, 0), tf(shiftX + maxXV, 0, 0), tf(shiftX + maxXV, TRUCK_W, 0), tf(shiftX + truckL, TRUCK_W, 0)])} fill="rgba(255,159,10,.12)" stroke="#ff9f0a" strokeWidth={1} strokeDasharray="4,3" />
          ) : null}
          <polygon points={fp([tf(shiftX, 0, 0), tf(shiftX + truckL, 0, 0), tf(shiftX + truckL, TRUCK_W, 0), tf(shiftX, TRUCK_W, 0)])} fill="#0d2137" stroke="#3B82F6" strokeWidth={1.2} />
          {trLine(shiftX, ROW_W, 0, shiftX + truckL, ROW_W, 0, "rgba(255,255,255,.2)", 0.8, "3,3")}
          {sorted.map((pkg) => {
            const inGroup = !selectedPkg || highlightKeys.has(pkg.stableKey);
            const isSeed = selectedPkgId === pkg.id;
            const dims = packagePhysicalDims(pkg);
            return (
            <IsoBox
              key={pkg.id}
              x={shiftX + pkg.xStart}
              y={packageRowYOffset(pkg)}
              z={pkg.zBase}
              dx={dims.L}
              dy={dims.W}
              dz={dims.H}
              col={pkg.ov ? "#ff3b30" : pkg.sCol}
              lbl={packageLabelTiny(pkg, bultoCounts, 22)}
              ox={OX}
              oy={OY}
              alpha={pkg.ov ? 0.65 : inGroup ? 1 : 0.22}
              selected={isSeed || (selectedPkg && highlightKeys.has(pkg.stableKey))}
              onClick={(e) => {
                e.stopPropagation();
                selectPkg(pkg);
              }}
            />
            );
          })}
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
          ].map(([x, y], i) => trLine(x, y, 0, x, y, MAX_H, "rgba(255,255,255,.25)", 1, i > 0 ? "3,3" : "", `truck-corner-${i}`))}
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

/** BMC navy — aligned with Presupuesto Simple (`src/pdf-templates/simple.js`). */
const REMITO_BRAND = "#003366";

/**
 * Ops UX F3b — remito print layout (Presupuesto Simple visual language).
 * Package rows: content, L×W×H, cuboid m³; stop/route material m³ via loadCharacteristics.
 */
function RemitoView({ info, stops, cargo, truckL, sendWA }) {
  const model = buildRemitoSimpleModel({
    info,
    stops,
    cargo,
    truckL,
    codeFn: (stop, index) => stopPackageCode(stop, index),
  });
  const { header, sections, totals } = model;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }} className="np">
        <Btn onClick={() => window.print()} color={T.success}>🖨️ Imprimir / PDF</Btn>
        <Btn onClick={sendWA} color="#25D366">📲 WhatsApp</Btn>
      </div>

      <style>{`
        @media print {
          .remito-simple-page { box-shadow: none !important; max-width: none !important; }
        }
        .remito-simple-page {
          font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
          color: #1D1D1F;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .remito-simple-page .bom { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px; }
        .remito-simple-page .bom th {
          background: #f1f5f9; padding: 5px 6px; font-weight: 600; text-transform: uppercase;
          letter-spacing: .02em; text-align: right; border-bottom: 0.5pt solid #cbd5e1; font-size: 10px;
        }
        .remito-simple-page .bom th:first-child, .remito-simple-page .bom td:first-child { text-align: left; }
        .remito-simple-page .bom td { padding: 4px 6px; border-bottom: 0.4pt solid #e2e8f0; text-align: right; font-variant-numeric: tabular-nums; }
        .remito-simple-page .bom .cat { background: ${REMITO_BRAND}; color: #fff; font-weight: 700; text-align: left; }
        .remito-simple-page .bom .cat td { border-bottom: none; color: #fff; text-align: left; }
      `}</style>

      <div
        className="remito-simple-page"
        style={{
          ...css.card,
          padding: "10mm 12mm",
          maxWidth: 794,
          margin: "0 auto",
          borderRadius: 4,
          boxShadow: "0 0 0 1px #ddd",
        }}
      >
        {/* Header — Presupuesto Simple pattern */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2pt solid ${REMITO_BRAND}`, paddingBottom: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: REMITO_BRAND, letterSpacing: "0.04em" }}>BMC URUGUAY</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>METALOG SAS · Paneles sándwich</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{
              display: "inline-block",
              background: REMITO_BRAND,
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              padding: "3px 12px",
              borderRadius: 999,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}>
              Remito / Hoja de ruta
            </span>
            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 6 }}>{header.numero || "—"}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{header.fecha || "—"}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12, marginBottom: 10 }}>
          <div><b style={{ color: REMITO_BRAND }}>Transportista:</b> {header.transportista || "—"}</div>
          <div><b style={{ color: REMITO_BRAND }}>Patente:</b> {header.patente || "—"}</div>
          <div><b style={{ color: REMITO_BRAND }}>Camión:</b> {header.truckL}m</div>
          <div><b style={{ color: REMITO_BRAND }}>Paradas / paquetes:</b> {totals.stops} / {totals.packages}</div>
        </div>

        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12, borderBottom: "0.5pt solid #e2e8f0", paddingBottom: 8 }}>
          Vol. estiba (cuboides) <b style={{ color: "#1D1D1F" }}>{formatM3(totals.cuboidVolumeM3)} m³</b>
          {" · "}
          Vol. material paneles <b style={{ color: "#1D1D1F" }}>{formatM3(totals.materialVolumeM3)} m³</b>
          {" · "}
          ≈{Math.round(totals.estWeightKg)} kg · m² {formatM3(totals.m2, 1)}
          {" · "}
          Fila A {(totals.rowH[0] * 100).toFixed(0)}cm · Fila B {(totals.rowH[1] * 100).toFixed(0)}cm
        </div>

        {header.notas ? (
          <div style={{ background: "#f1f5f9", padding: "6px 10px", borderRadius: 4, marginBottom: 12, fontSize: 12 }}>
            {header.notas}
          </div>
        ) : null}

        {sections.map((sec) => (
          <div key={sec.stopId} style={{ marginBottom: 16 }}>
            <table className="bom">
              <thead>
                <tr className="cat">
                  <td colSpan={6}>
                    PARADA {sec.orden} · {sec.cliente || "—"}
                    {sec.orderId ? ` · #${sec.orderId}` : ""}
                    {" · "}
                    {sec.packageCount} paquete{sec.packageCount === 1 ? "" : "s"}
                    {" · "}
                    cuboide {formatM3(sec.cuboidVolumeM3)} m³
                    {" · "}
                    material {formatM3(sec.materialVolumeM3)} m³
                  </td>
                </tr>
                <tr>
                  {["ID bulto", "Contenido", "L × Ancho × H", "Vol m³", "Fila", "Uds"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sec.packages.length ? (
                  sec.packages.map((row) => (
                    <tr key={row.packageId || row.code}>
                      <td style={{ fontWeight: 600 }}>{row.code}</td>
                      <td style={{ textAlign: "left" }}>{row.contenido}</td>
                      <td>{row.dimsLabel}</td>
                      <td>{formatM3(row.volumeM3)}</td>
                      <td style={{ fontWeight: 700, color: REMITO_BRAND }}>{row.fila}</td>
                      <td>{row.cantidad || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "left", color: "#64748b" }}>
                      Sin bultos colocados en camión para esta parada.
                      {sec.direccion ? ` Dir: ${sec.direccion}` : ""}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
              📍 {sec.direccion || "—"} · 📞 {sec.telefono || "—"}
              {sec.estado ? ` · Estado: ${sec.estado}` : ""}
              {" · "}Fila A {sec.filaA} · Fila B {sec.filaB}
            </div>
          </div>
        ))}

        {!sections.length ? (
          <div style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>Sin paradas en este envío.</div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", margin: "12px 0" }}>
          <div style={{ minWidth: 220, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", color: "#475569" }}>
              <span>Paquetes</span><b>{totals.packages}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", color: "#475569" }}>
              <span>Vol. estiba</span><b>{formatM3(totals.cuboidVolumeM3)} m³</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", color: "#475569" }}>
              <span>Vol. material</span><b>{formatM3(totals.materialVolumeM3)} m³</b>
            </div>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              fontWeight: 800,
              color: "#fff",
              background: REMITO_BRAND,
              padding: "6px 8px",
              borderRadius: 3,
              marginTop: 4,
            }}>
              <span>Peso est.</span><span>≈{Math.round(totals.estWeightKg)} kg</span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginTop: 20 }}>
          {["Entregado (BMC)", "Recibido (Transportista)", "Conforme (Cliente)"].map((l) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ height: 48, borderBottom: `1px solid ${REMITO_BRAND}`, marginBottom: 6 }} />
              <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: ".04em" }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 9, color: "#64748b", borderTop: "0.5pt solid #cbd5e1", paddingTop: 8, marginTop: 16, display: "flex", justifyContent: "space-between" }}>
          <span>Vol. estiba = L×Ancho×Alto por bulto (ancho fila {ROW_W}m). Vol. material = m²×espesor (estimación).</span>
          <span>BMC Envíos · remito simple</span>
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
  /** Free-Drag: toggle + per-package position overrides (bypass packer) */
  const [freeDragEnabled, setFreeDragEnabled] = useState(false);
  const [freePositions, setFreePositions] = useState({});
  const [loadWarnings, setLoadWarnings] = useState([]);
  const [multiSelectKeys, setMultiSelectKeys] = useState([]);
  const [yardMode, setYardMode] = useState(false);
  const [pendingLengthConfirm, setPendingLengthConfirm] = useState(null);
  /** Coordinación de reparto — En Coordinación hasta Confirmar */
  const [activeReparto, setActiveReparto] = useState(null);
  const [repartoBusy, setRepartoBusy] = useState(false);
  const [repartoHistoryOpen, setRepartoHistoryOpen] = useState(false);
  const [repartoHistory, setRepartoHistory] = useState([]);
  const [confirmCoordOpen, setConfirmCoordOpen] = useState(false);
  const [autoLoadMsg, setAutoLoadMsg] = useState("");
  const [retryingStopId, setRetryingStopId] = useState("");
  const [accProfiles, setAccProfiles] = useState({});
  const [transportistas, setTransportistas] = useState([]);
  const [camionesCat, setCamionesCat] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [tripCostLog, setTripCostLog] = useState([]);
  const [tripPriceInput, setTripPriceInput] = useState("");
  const [newCarrierName, setNewCarrierName] = useState("");
  /** Gate localStorage writes until draft restore + optional bridge import finish (avoid empty wipe). */
  const [hydrated, setHydrated] = useState(false);
  /** Ops UX F1: collapsed stop card ids */
  const [collapsedStopIds, setCollapsedStopIds] = useState([]);
  /** Ops UX F3a: HTML5 drag source */
  const [dragStopId, setDragStopId] = useState(null);
  /** P2 geocode in-flight stop id */
  const [geocodingStopId, setGeocodingStopId] = useState(null);
  /** P5 / P5b cloud sync */
  const [cloudSyncBusy, setCloudSyncBusy] = useState(false);
  const [cloudMeta, setCloudMeta] = useState(null);
  const [autosaveEnabled, setAutosaveEnabled] = useState(() => {
    try {
      return localStorage.getItem("bmc-envios-autosave") !== "0";
    } catch {
      return true;
    }
  });
  const [lastPushedFp, setLastPushedFp] = useState("");
  const [lastPushAt, setLastPushAt] = useState(0);
  const [cloudConflict, setCloudConflict] = useState(null);
  const [draftBrowserOpen, setDraftBrowserOpen] = useState(false);
  /** Setup wizard (SDD-ENVIO-WIZARD) */
  const [catalogPlaces, setCatalogPlaces] = useState(() => loadCatalogFromStorage());
  const [wizardUi, setWizardUi] = useState(() => createWizardUi({ enabled: false }));
  const [tripRoute, setTripRoute] = useState(null);
  const [newBaseLabel, setNewBaseLabel] = useState("");
  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [newPickupLabel, setNewPickupLabel] = useState("");
  const [newPickupUrl, setNewPickupUrl] = useState("");

  useEffect(() => {
    let restoredStops = [];
    let restoredProfiles = {};
    let restoredCollapsed = null;
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) raw = localStorage.getItem(STORAGE_KEY_LEGACY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.info) setInfo((prev) => ({ ...prev, ...parsed.info }));
        if (parsed.accProfiles && typeof parsed.accProfiles === "object") {
          restoredProfiles = parsed.accProfiles;
          setAccProfiles(parsed.accProfiles);
        }
        if (Array.isArray(parsed.stops)) {
          restoredStops = parsed.stops.map((stop, index) => ({
            ...mkStop(index),
            ...stop,
            orderId: stop.orderId ?? "",
            pickupId: stop.pickupId ?? "",
            checks: { ...mkStop(index).checks, ...(stop.checks || {}) },
            accPackage: buildAccessoryPackageConfig({ ...mkStop(index), ...stop }, parsed.accProfiles || {}),
          }));
          setStops(restoredStops);
        }
        if (Array.isArray(parsed.ui?.collapsedStopIds)) {
          restoredCollapsed = parsed.ui.collapsedStopIds.filter(Boolean);
          setCollapsedStopIds(restoredCollapsed);
        }
        if (parsed.truckL) setTruckL(parsed.truckL);
        if (parsed.view) setView(parsed.view);
        if (parsed.distributionMode) setDistributionMode(parsed.distributionMode);
        if (parsed.cargoLayoutMode === "manual" || parsed.cargoLayoutMode === "auto") setCargoLayoutMode(parsed.cargoLayoutMode);
        if (Array.isArray(parsed.manualPkgOrderKeys)) setManualPkgOrderKeys(parsed.manualPkgOrderKeys);
        if (parsed.rowOverrides && typeof parsed.rowOverrides === "object") setRowOverrides(parsed.rowOverrides);
        if (parsed.freePositions && typeof parsed.freePositions === "object") {
          setFreePositions(normalizeFreePositionsMap(parsed.freePositions));
          setYardMode(countYardPackages(parsed.freePositions) > 0);
        }
        if (parsed.freeDragEnabled === true) setFreeDragEnabled(true);
        if (Array.isArray(parsed.loadWarnings)) setLoadWarnings(normalizeLoadWarnings(parsed.loadWarnings));
        if (Array.isArray(parsed.transportistas)) setTransportistas(parsed.transportistas);
        if (Array.isArray(parsed.camionesCat)) setCamionesCat(parsed.camionesCat);
        if (Array.isArray(parsed.priceHistory)) setPriceHistory(parsed.priceHistory);
        if (Array.isArray(parsed.tripCostLog)) setTripCostLog(parsed.tripCostLog);
        if (parsed.route && typeof parsed.route === "object") setTripRoute(parsed.route);
        if (parsed.ui?.wizard) {
          setWizardUi(createWizardUi(parsed.ui.wizard));
        } else {
          setWizardUi(
            createWizardUi({
              enabled: shouldEnableWizard({ stops: restoredStops }),
            }),
          );
        }
      } else {
        // Fresh session: Detalle Completo + launcher "Configuración del envío"
        setWizardUi(createWizardUi({ enabled: false }));
      }
    } catch {
      // ignore persisted-state errors
    }

    if (restoredCollapsed == null && restoredStops.length > 3) {
      setCollapsedStopIds(defaultCollapsedStopIds(restoredStops, 3));
    }

    // U2: import quote→ops bridge after draft restore — never wipe a meaningful multi-stop draft.
    try {
      const bridge = loadBridgePayload({ clear: false });
      if (bridge?.panels?.length) {
        const { stops: bridgeStops, infoPatch } = bridgePayloadToStops(bridge, {
          uid: () => uid(),
          color: COLORS[0],
        });
        if (bridgeStops.length) {
          const enriched = bridgeStops.map((stop, index) => ({
            ...mkStop(index),
            ...stop,
            checks: { ...mkStop(index).checks, datosOk: Boolean(stop.direccion), bultosOk: stop.paneles?.length > 0 },
            accPackage: buildAccessoryPackageConfig({ ...mkStop(index), ...stop }, restoredProfiles),
          }));
          const merged = mergeBridgeIntoStops(restoredStops, enriched, { colors: COLORS });
          setStops(merged);
          if (infoPatch) {
            setInfo((prev) => {
              const note = infoPatch.notas || "";
              const mergedNotas =
                prev.notas && note && !String(prev.notas).includes(note)
                  ? `${prev.notas} · ${note}`
                  : prev.notas || note;
              return { ...prev, ...infoPatch, notas: mergedNotas };
            });
          }
          setAutoLoadMsg(
            `Importado desde Cotizar flete: ${bridge.panels.length} línea(s) de paneles · ${bridge.destino || "sin destino"}`
          );
          setView("form");
          clearBridgePayload();
        }
      }
    } catch {
      // ignore bridge import errors
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          schema: "bmc-envios-draft-v1",
          schemaVersion: 1,
          savedAt: new Date().toISOString(),
          info,
          stops,
          truckL,
          view,
          distributionMode,
          accProfiles,
          cargoLayoutMode,
          manualPkgOrderKeys,
          rowOverrides,
          freeDragEnabled,
          freePositions,
          loadWarnings,
          transportistas,
          camionesCat,
          priceHistory,
          tripCostLog,
          route: tripRoute,
          ui: { collapsedStopIds, wizard: wizardUi },
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [
    hydrated,
    info,
    stops,
    truckL,
    view,
    distributionMode,
    accProfiles,
    cargoLayoutMode,
    manualPkgOrderKeys,
    rowOverrides,
    freeDragEnabled,
    freePositions,
    loadWarnings,
    transportistas,
    camionesCat,
    priceHistory,
    tripCostLog,
    collapsedStopIds,
    wizardUi,
    tripRoute,
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
  const rmStop = (id) => {
    setStops((p) => renumberStops(p.filter((s) => s.id !== id), { colors: COLORS }));
    setCollapsedStopIds((c) => c.filter((x) => x !== id));
  };
  const updStop = (id, k, v) => setStops((p) => p.map((s) => (s.id === id ? { ...s, [k]: v } : s)));
  const moveStopBefore = (activeId, overId) => {
    setStops((p) => reorderStops(p, activeId, overId, { colors: COLORS }));
  };
  /** E2E hook: same reorderStops path as HTML5 onDrop (enable with ?e2e=1). */
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let enabled = false;
    try {
      enabled = new URLSearchParams(window.location.search).get("e2e") === "1";
    } catch {
      enabled = false;
    }
    if (!enabled) return undefined;
    window.__bmcLogisticaE2E = {
      getStopIds: () => stops.map((s) => s.id),
      reorder: (activeId, overId) => {
        moveStopBefore(activeId, overId);
      },
      getEstados: () =>
        stops.map((s) => ({ id: s.id, estado: s.estado || "Pendiente", orden: s.orden })),
    };
    return () => {
      try {
        delete window.__bmcLogisticaE2E;
      } catch {
        /* ignore */
      }
    };
  }, [stops]);
  const toggleStopCollapsed = (stopId) => {
    setCollapsedStopIds((c) => toggleCollapsedStopId(c, stopId));
  };
  /**
   * Preview placeCargo with proposed manual keys; reject if panel-on-profile remains.
   * Engine normally prevents it; this is a safety net + clear operator message.
   */
  const commitManualLayout = (nextKeys, nextRows, successMsg) => {
    const preview = placeCargo(stops, truckL, distributionMode || "balanced", {
      mode: "manual",
      manualOrderKeys: nextKeys,
      rowOverrides: nextRows,
    });
    if (preview.stackConstraintsOk === false) {
      setAutoLoadMsg(PANEL_ON_PROFILE_REJECT_ES);
      return false;
    }
    setCargoLayoutMode("manual");
    setManualPkgOrderKeys(nextKeys);
    setRowOverrides(nextRows);
    if (successMsg) setAutoLoadMsg(successMsg);
    return true;
  };

  /** Ops UX F5: force package onto fila A/B via packing overrides */
  const forcePackageRow = (stableKey, targetRow) => {
    if (!stableKey) return;
    const next = applyPackageLayoutChange({
      rowOverrides,
      manualPkgOrderKeys,
      stableKey,
      targetRow,
      placed: cargo.placed,
    });
    commitManualLayout(
      next.manualPkgOrderKeys,
      next.rowOverrides,
      `Layout manual: bulto → Fila ${Number(targetRow) === 1 ? "B" : "A"}`,
    );
  };
  const forcePackageStack = (stableKey, neighborKey, position) => {
    if (!stableKey || !neighborKey) return;
    const next = applyPackageLayoutChange({
      rowOverrides,
      manualPkgOrderKeys,
      stableKey,
      neighborKey,
      stackPosition: position === "below" ? "below" : "above",
      placed: cargo.placed,
    });
    commitManualLayout(
      next.manualPkgOrderKeys,
      next.rowOverrides,
      `Layout manual: bulto ${position === "below" ? "debajo" : "encima"} del contiguo`,
    );
  };
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

  function enviosAuthToken() {
    return typeof import.meta !== "undefined"
      ? String(import.meta.env?.VITE_BMC_API_AUTH_TOKEN || import.meta.env?.VITE_API_AUTH_TOKEN || "").trim()
      : "";
  }

  /** P2: geocode stop address via API (or parse coords from map link / paste). */
  async function geocodeStop(stopId) {
    const stop = stops.find((s) => s.id === stopId);
    if (!stop) return;
    const fromLink = parseLatLng(stop.mapLink) || parseLatLng(stop.direccion);
    if (fromLink) {
      setStops((p) =>
        p.map((s) =>
          s.id === stopId
            ? applyGeocodeToStop(s, {
                ...fromLink,
                label: s.direccion || s.cliente || "",
                source: "parsed",
              })
            : s,
        ),
      );
      setAutoLoadMsg(`Geocode: coords parseadas (${fromLink.lat.toFixed(5)}, ${fromLink.lng.toFixed(5)})`);
      return;
    }
    if (!stop.direccion?.trim()) {
      setAutoLoadMsg("Geocode: cargá una dirección o pegá lat,lng en link mapa.");
      return;
    }
    const token = enviosAuthToken();
    if (!token) {
      setAutoLoadMsg(
        "Geocode: falta VITE_BMC_API_AUTH_TOKEN (mismo valor que API_AUTH_TOKEN del servidor).",
      );
      return;
    }
    setGeocodingStopId(stopId);
    try {
      const base = getCalcApiBase();
      const res = await fetch(`${base}/api/envios/geocode`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address: stop.direccion }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false) throw new Error(j.error || res.statusText);
      if (!j.geo) {
        setAutoLoadMsg("Geocode: sin resultados en Uruguay para esa dirección.");
        return;
      }
      setStops((p) => p.map((s) => (s.id === stopId ? applyGeocodeToStop(s, j.geo) : s)));
      setAutoLoadMsg(
        `Geocode OK: ${j.geo.label || stop.direccion} (${Number(j.geo.lat).toFixed(5)}, ${Number(j.geo.lng).toFixed(5)})`,
      );
    } catch (e) {
      setAutoLoadMsg(`Geocode error: ${e.message}`);
    } finally {
      setGeocodingStopId(null);
    }
  }

  function currentDraftState() {
    return {
      info,
      stops,
      truckL,
      view,
      distributionMode,
      accProfiles,
      cargoLayoutMode,
      manualPkgOrderKeys,
      rowOverrides,
      freeDragEnabled,
      freePositions,
      loadWarnings,
      transportistas,
      camionesCat,
      priceHistory,
      tripCostLog,
      ui: { collapsedStopIds },
    };
  }

  /** P5/P5b: push draft to Postgres (multi-device). */
  async function saveDraftToCloud(opts = {}) {
    const silent = Boolean(opts.silent);
    const built = buildEnviosDraft(currentDraftState());
    if (!built.ok) {
      if (!silent) setAutoLoadMsg("Nube: asigná un Nº Envío (ENV-…) antes de guardar.");
      return { ok: false, error: built.error };
    }
    const token = enviosAuthToken();
    if (!token) {
      if (!silent) setAutoLoadMsg("Nube: falta VITE_BMC_API_AUTH_TOKEN para guardar en servidor.");
      return { ok: false, error: "no_token" };
    }
    setCloudSyncBusy(true);
    try {
      const base = getCalcApiBase();
      const body = {
        payload: built.payload,
        updatedBy: opts.updatedBy || "logistica-ui",
      };
      if (cloudMeta?.revision != null && !opts.force) {
        body.expectedRevision = cloudMeta.revision;
      }
      const res = await fetch(`${base}/api/envios/drafts/${encodeURIComponent(built.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      const parsed = parsePutDraftResponse(res.status, j);
      if (parsed.conflict) {
        setCloudConflict(parsed.draft);
        setCloudMeta((m) => ({
          ...(m || {}),
          status: "conflict",
          revision: parsed.draft?.revision ?? m?.revision,
        }));
        if (!silent) setAutoLoadMsg("Nube: conflicto de revisión — elegí mantener local o usar nube.");
        return { ok: false, conflict: true, draft: parsed.draft };
      }
      if (!parsed.ok) throw new Error(parsed.error || res.statusText);
      const fp = fingerprintDraft(currentDraftState());
      setLastPushedFp(fp);
      setLastPushAt(Date.now());
      setCloudConflict(null);
      setCloudMeta({
        id: parsed.draft?.id || built.id,
        revision: parsed.draft?.revision,
        updatedAt: parsed.draft?.updatedAt,
        status: "saved",
      });
      if (!silent) {
        setAutoLoadMsg(
          `Nube: guardado ${parsed.draft?.id || built.id} · rev ${parsed.draft?.revision ?? "—"} · ${built.stopCount} parada(s)`,
        );
      }
      return { ok: true, draft: parsed.draft };
    } catch (e) {
      setCloudMeta((m) => ({ ...(m || {}), status: "error" }));
      if (!silent) setAutoLoadMsg(`Nube: error al guardar — ${e.message}`);
      return { ok: false, error: e.message };
    } finally {
      setCloudSyncBusy(false);
    }
  }

  // P5b autosave (debounced)
  useEffect(() => {
    if (!hydrated) return undefined;
    const token = enviosAuthToken();
    const fp = fingerprintDraft(currentDraftState());
    const dirty = Boolean(fp && fp !== lastPushedFp);
    const gate = shouldAutosave({
      hydrated,
      envNo: info.numero,
      hasToken: Boolean(token),
      dirty,
      cloudBusy: cloudSyncBusy,
      autosaveEnabled,
      lastPushAt,
      now: Date.now(),
      minIntervalMs: AUTOSAVE_MIN_INTERVAL_MS,
    });
    if (!gate.ok) return undefined;
    const t = setTimeout(() => {
      saveDraftToCloud({ silent: true, updatedBy: "autosave" });
    }, gate.waitMs != null ? gate.waitMs + 50 : AUTOSAVE_MIN_INTERVAL_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional autosave deps
  }, [
    hydrated,
    info,
    stops,
    truckL,
    distributionMode,
    cargoLayoutMode,
    manualPkgOrderKeys,
    rowOverrides,
    autosaveEnabled,
    lastPushedFp,
    cloudSyncBusy,
    lastPushAt,
  ]);

  /** P5: pull draft from server into app state (+ localStorage via hydrate persist). */
  async function loadDraftFromCloud() {
    const id = draftIdFromEnvNo(info.numero);
    if (!id) {
      setAutoLoadMsg("Nube: poné el Nº Envío del draft a cargar.");
      return;
    }
    const token = enviosAuthToken();
    if (!token) {
      setAutoLoadMsg("Nube: falta VITE_BMC_API_AUTH_TOKEN para cargar del servidor.");
      return;
    }
    setCloudSyncBusy(true);
    try {
      const base = getCalcApiBase();
      const res = await fetch(`${base}/api/envios/drafts/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 404) {
        setAutoLoadMsg(`Nube: no hay draft para ${id}.`);
        return;
      }
      if (!res.ok || j.ok === false) throw new Error(j.error || res.statusText);
      const parsed = parseEnviosDraftPayload(j.draft?.payload);
      if (!parsed.ok) throw new Error(parsed.error || "invalid_payload");
      const p = parsed.payload;
      if (p.info) setInfo((prev) => ({ ...prev, ...p.info }));
      if (Array.isArray(p.stops)) {
        setStops(
          p.stops.map((stop, index) => ({
            ...mkStop(index),
            ...stop,
            orderId: stop.orderId ?? "",
            pickupId: stop.pickupId ?? "",
            geo: stop.geo ?? null,
            checks: { ...mkStop(index).checks, ...(stop.checks || {}) },
            accPackage: buildAccessoryPackageConfig({ ...mkStop(index), ...stop }, p.accProfiles || {}),
          })),
        );
      }
      if (p.accProfiles) setAccProfiles(p.accProfiles);
      if (p.truckL) setTruckL(p.truckL);
      if (p.view) setView(p.view);
      if (p.distributionMode) setDistributionMode(p.distributionMode);
      if (p.cargoLayoutMode === "manual" || p.cargoLayoutMode === "auto") setCargoLayoutMode(p.cargoLayoutMode);
      if (Array.isArray(p.manualPkgOrderKeys)) setManualPkgOrderKeys(p.manualPkgOrderKeys);
      if (p.rowOverrides) setRowOverrides(p.rowOverrides);
      if (p.freePositions && typeof p.freePositions === "object") {
        setFreePositions(normalizeFreePositionsMap(p.freePositions));
      }
      if (p.freeDragEnabled === true) setFreeDragEnabled(true);
      if (Array.isArray(p.transportistas)) setTransportistas(p.transportistas);
      if (Array.isArray(p.camionesCat)) setCamionesCat(p.camionesCat);
      if (Array.isArray(p.priceHistory)) setPriceHistory(p.priceHistory);
      if (Array.isArray(p.tripCostLog)) setTripCostLog(p.tripCostLog);
      if (Array.isArray(p.ui?.collapsedStopIds)) setCollapsedStopIds(p.ui.collapsedStopIds);
      setCloudMeta({
        id: j.draft?.id || id,
        revision: j.draft?.revision,
        updatedAt: j.draft?.updatedAt,
        status: "saved",
      });
      setCloudConflict(null);
      // After load, mark clean so autosave doesn't immediately re-push
      queueMicrotask(() => {
        setLastPushedFp(
          fingerprintDraft({
            info: p.info,
            stops: p.stops,
            truckL: p.truckL,
            distributionMode: p.distributionMode,
            cargoLayoutMode: p.cargoLayoutMode,
            manualPkgOrderKeys: p.manualPkgOrderKeys,
            rowOverrides: p.rowOverrides,
            freePositions: p.freePositions,
            freeDragEnabled: p.freeDragEnabled,
            ui: p.ui,
          }),
        );
        setLastPushAt(Date.now());
      });
      setAutoLoadMsg(
        `Nube: cargado ${j.draft?.id || id} · rev ${j.draft?.revision ?? "—"} · ${Array.isArray(p.stops) ? p.stops.length : 0} parada(s)`,
      );
    } catch (e) {
      setAutoLoadMsg(`Nube: error al cargar — ${e.message}`);
    } finally {
      setCloudSyncBusy(false);
    }
  }

  function reorderPackages(keys) {
    commitManualLayout(keys, rowOverrides, "Layout manual: orden de bultos actualizado (lista DnD)");
  }

  const tripDistance = useMemo(() => tripLegDistances(stops), [stops]);

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
          ancho: clamp(safeNum(next.accPackage.ancho, DEFAULT_ACC_W), 0.15, 0.6),
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
        cargo: applyFreePositionsToCargo(placeCargo(stops, truckL, mode.id, layoutOpts), freePositions),
      })),
    [stops, truckL, layoutOpts, freePositions]
  );
  const cargoBase =
    cargoVariants.find((variant) => variant.id === distributionMode)?.cargo ||
    cargoVariants[0]?.cargo ||
    applyFreePositionsToCargo(placeCargo(stops, truckL, "balanced", layoutOpts), freePositions);
  const cargo = cargoBase;
  const freeDragCount = cargo.freeDragCount || Object.keys(freePositions).length;

  const commitFreePosition = (stableKey, pos, extraWarning = null) => {
    setFreePositions((prev) =>
      setFreePosition(prev, stableKey, { ...pos, zone: pos.zone === "yard" ? "yard" : "truck" }, { truckL, maxH: MAX_H }),
    );
    setCargoLayoutMode("manual");
    if (extraWarning) setLoadWarnings((w) => appendLoadWarning(w, extraWarning));
    setAutoLoadMsg(`Free-Drag: posición guardada`);
  };

  const validateAndCommitFreeDrag = (stableKey, pos) => {
    if (!stableKey) return;
    const pkg = cargo.placed.find((p) => p.stableKey === stableKey);
    if (!pkg) {
      commitFreePosition(stableKey, pos);
      return;
    }
    const candidate = {
      ...pkg,
      xStart: pos.xStart,
      zBase: pos.zBase,
      row: pos.row,
      len: pos.len || pkg.len,
      stableKey,
    };
    // Hard: panel on profile
    const others = cargo.placed.filter((p) => p.stableKey !== stableKey);
    const { supportPkg } = findSupportUnder(others, candidate);
    if (supportPkg && !canPlaceOnTop(pkg, supportPkg)) {
      setAutoLoadMsg(PANEL_ON_PROFILE_RULE_ES);
      return;
    }
    const supportLen = supportPkg ? Number(supportPkg.len) || 0 : Number(pkg.len) || 0;
    const lenCheck = checkLengthOnShorter({ len: candidate.len }, supportLen);
    if (!lenCheck.ok && lenCheck.soft) {
      setPendingLengthConfirm({
        stableKey,
        pos,
        check: lenCheck,
        packageKeys: [stableKey, supportPkg?.stableKey].filter(Boolean),
      });
      return;
    }
    commitFreePosition(stableKey, pos);
  };

  const handleFreeDragEnd = (stableKey, pos) => {
    validateAndCommitFreeDrag(stableKey, pos);
  };

  const handleGroupDragEnd = (keys, delta) => {
    if (!keys?.length) return;
    setFreePositions((prev) => {
      // Seed missing free positions from current placed
      let base = { ...prev };
      for (const k of keys) {
        if (!base[k]) {
          const pkg = cargo.placed.find((p) => p.stableKey === k);
          if (pkg) {
            base = setFreePosition(base, k, {
              xStart: pkg.xStart,
              zBase: pkg.zBase,
              row: pkg.row,
              len: pkg.len,
              zone: pkg.zone,
              yardStopId: pkg.yardStopId,
            }, { truckL, maxH: MAX_H });
          }
        }
      }
      return applyGroupDelta(base, keys, delta, cargo.placed);
    });
    setCargoLayoutMode("manual");
    setAutoLoadMsg(`Free-Drag: grupo de ${keys.length} bultos movido`);
  };

  const handleClearFreeDrag = (stableKey) => {
    if (!stableKey) {
      setFreePositions({});
      setYardMode(false);
      setAutoLoadMsg("Free-Drag: todas las posiciones libres borradas — vuelve el motor");
      return;
    }
    setFreePositions((prev) => clearFreePosition(prev, stableKey));
    setAutoLoadMsg("Free-Drag: bulto vuelve al motor de estiba");
  };

  const handleToggleFreeDrag = (on) => {
    setFreeDragEnabled(Boolean(on));
    setAutoLoadMsg(
      on
        ? "Free-Drag ON — 1 clic = detalle · Doble-clic+hold = arrastrar · Shift+clic = grupo"
        : freeDragCount > 0
          ? `Free-Drag OFF — ${freeDragCount} posición(es) libre(s) siguen. “Limpiar free” para motor.`
          : "Free-Drag OFF — estiba solo con motor",
    );
  };

  const handleUnloadTruckToYard = () => {
    // place without free overrides first for source packages
    const baseCargo = placeCargo(stops, truckL, distributionMode || "balanced", layoutOpts);
    const dump = buildYardDump(stops, baseCargo.placed, truckL);
    setFreePositions(dump);
    setYardMode(true);
    setFreeDragEnabled(true);
    setCargoLayoutMode("manual");
    setLoadWarnings((w) =>
      appendLoadWarning(w, createLoadWarning({
        code: LOAD_WARNING_CODES.YARD_RELOAD,
        severity: "info",
        message: "Camión descargado a patio — pedidos en pilas separadas para reorganización",
        acknowledged: true,
        source: "yard_reload",
      })),
    );
    setAutoLoadMsg(
      `Camión descargado: ${Object.keys(dump).length} bultos en ${stops.length} pila(s) de pedido alrededor. Rearmá con Free-Drag.`,
    );
  };

  const handleConfirmLengthSoft = (accept) => {
    const pending = pendingLengthConfirm;
    setPendingLengthConfirm(null);
    if (!pending || !accept) {
      setAutoLoadMsg("Colocación cancelada — sin limitante forzada");
      return;
    }
    const warn = warningFromLengthCheck(pending.check, pending.packageKeys);
    commitFreePosition(pending.stableKey, pending.pos, warn);
    setAutoLoadMsg("Limitante física aceptada — registrada en plan de carga");
  };
  const totPan = stops.reduce((t, s) => t + s.paneles.reduce((tt, p) => tt + safeNum(p.cantidad), 0), 0);

  async function fetchVentasCsv() {
    const token = enviosAuthToken();
    const base = getCalcApiBase();
    // F11: prefer server proxy (avoids browser CORS / Failed to fetch), fallback direct gviz
    if (token) {
      try {
        const proxyUrl = `${base}/api/envios/ventas-csv?sheetId=${encodeURIComponent(SH_ID)}&gid=${encodeURIComponent(SH_GID)}`;
        const res = await fetch(proxyUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const txt = await res.text();
          return parseCsv(txt);
        }
      } catch {
        // fall through to direct
      }
    }
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
      const dataRows = rows.slice(1).filter((r) => r.some((c) => String(c || "").trim()));
      setVentasCache({ headers, rows: dataRows });
      // Ops UX F2: map → drop garbage rows → haystack filter (pedido/tel/dir/estado).
      const mapped = filterVentasLogisticaCandidates(
        dataRows.map((r, i) => mapVentasRow(headers, r, i + 2)),
      );
      const found = searchMappedVentasRows(mapped, search);
      if (!found.length) setShErr(`Sin resultados operativos para "${search}"`);
      else setResults(found);
    } catch (e) {
      const msg = String(e?.message || e || "error");
      const hint =
        /failed to fetch|network|cors|load failed/i.test(msg)
          ? " · Revisá red o usá token API (proxy /api/envios/ventas-csv)."
          : "";
      setShErr(`Error: ${msg}${hint}`);
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
      const mapped = filterVentasLogisticaCandidates(
        dataRows.map((r, i) => mapVentasRow(headers, r, i + 2)),
      );
      const found = mapped.map((r) => withCoordinationChip(r));
      if (!found.length) setShErr("No hay filas operativas (con cliente o pedido real) en esta pestaña.");
      else {
        setResults(found);
        setShErr("");
        setAutoLoadMsg(
          `Ventas: ${found.length} filas operativas (de ${dataRows.length} leídas; basura/encabezados filtrados).`,
        );
      }
    } catch (e) {
      setShErr(`Error: ${e.message}`);
    } finally {
      setLoadSh(false);
    }
  }

  /**
   * Phase C: try Admin /api/cotizaciones multi-key match (pedido/nombre/tel).
   * Returns { matchNote, pdfLink?, ambiguousMatches? }
   */
  async function tryAdminQuoteMatch(query) {
    const token = enviosAuthToken();
    const base = getCalcApiBase();
    if (!token || !base) {
      return { matchNote: "", pdfLink: "", ambiguousMatches: null };
    }
    try {
      const res = await fetch(`${base}/api/cotizaciones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false || !Array.isArray(j.data)) {
        return {
          matchNote: j.error ? `Admin cotiz.: ${j.error}` : "Admin cotiz. no disponible",
          pdfLink: "",
          ambiguousMatches: null,
        };
      }
      const quotes = j.data.map(normalizeAdminQuoteRow).filter(Boolean);
      const result = matchAdminQuotes(query, quotes);
      if (result.autoApply && result.best) {
        const q = result.best.quote;
        return {
          matchNote: `Admin match auto (score ${result.best.score}): ${result.best.reasons.join(", ")}`,
          pdfLink: q.pdfLink || q.raw?.LINK_COTIZACION || q.raw?.pdf || "",
          ambiguousMatches: null,
          best: result.best,
        };
      }
      if (result.ambiguous && result.matches.length) {
        return {
          matchNote: `Admin: ${result.matches.length} coincidencias ambiguas — no se aplicó ninguna (revisá pedido/tel).`,
          pdfLink: "",
          ambiguousMatches: result.matches.slice(0, 5),
        };
      }
      if (result.best) {
        return {
          matchNote: `Admin: mejor score ${result.best.score} sin auto-apply (${result.best.reasons.join(", ") || "débil"})`,
          pdfLink: "",
          ambiguousMatches: null,
        };
      }
      return { matchNote: "Admin: sin match", pdfLink: "", ambiguousMatches: null };
    } catch (e) {
      return { matchNote: `Admin match error: ${e.message}`, pdfLink: "", ambiguousMatches: null };
    }
  }

  /**
   * Ensure an active reparto in "En Coordinación" when organizing stops.
   * Tries API; falls back to local-only REP number.
   */
  async function ensureActiveReparto(nextStopCount) {
    if (activeReparto?.status === "en_coordinacion" || activeReparto?.status === "draft") {
      return activeReparto;
    }
    if (activeReparto?.status === "coordinado") {
      // start fresh batch after confirmed
    }
    const token = enviosAuthToken();
    const base = getCalcApiBase();
    const ymd = repartoDateKey();
    if (token && base) {
      try {
        setRepartoBusy(true);
        const res = await fetch(`${base}/api/repartos`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deliveryDate: ymd,
            truckL,
            transportista: info.transportista,
            patente: info.patente,
            payload: buildRepartoPayload({
              stops: [],
              truckL,
              distributionMode,
              cargoLayoutMode,
              manualPkgOrderKeys,
              rowOverrides,
              freePositions,
              loadWarnings,
              info,
            }),
            actor: "logistica-ui",
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok && j.ok && j.reparto) {
          const r = {
            id: j.reparto.id,
            repartoNo: j.reparto.repartoNo,
            status: j.reparto.status || "en_coordinacion",
            revision: j.reparto.revision || 1,
            local: false,
          };
          setActiveReparto(r);
          setAutoLoadMsg(`Reparto ${r.repartoNo} · ${repartoStatusLabel(r.status)}`);
          return r;
        }
      } catch (e) {
        /* local fallback */
      } finally {
        setRepartoBusy(false);
      }
    }
    const local = {
      id: `local-${Date.now()}`,
      repartoNo: allocateRepartoNo([], ymd),
      status: statusOnFirstStop("draft"),
      revision: 1,
      local: true,
    };
    setActiveReparto(local);
    setAutoLoadMsg(
      `Reparto local ${local.repartoNo} · En Coordinación${token ? " (API no disponible — solo local)" : " (sin token API)"}`,
    );
    return local;
  }

  async function saveRepartoDraft() {
    if (!activeReparto || activeReparto.status === "coordinado") return;
    const payload = buildRepartoPayload({
      stops,
      truckL,
      distributionMode,
      cargoLayoutMode,
      manualPkgOrderKeys,
      rowOverrides,
      freePositions,
      loadWarnings,
      info,
    });
    if (activeReparto.local || !enviosAuthToken()) {
      setActiveReparto((r) => (r ? { ...r, revision: (r.revision || 1) + 1, status: "en_coordinacion" } : r));
      setAutoLoadMsg(`Borrador local ${activeReparto.repartoNo} guardado (rev ${(activeReparto.revision || 1) + 1})`);
      return;
    }
    setRepartoBusy(true);
    try {
      const base = getCalcApiBase();
      const res = await fetch(`${base}/api/repartos/${encodeURIComponent(activeReparto.id)}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${enviosAuthToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload,
          truckL,
          transportista: info.transportista,
          patente: info.patente,
          expectedRevision: activeReparto.revision,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false) throw new Error(j.message || j.error || res.statusText);
      setActiveReparto((r) =>
        r
          ? {
              ...r,
              status: "en_coordinacion",
              revision: j.revision || (r.revision || 1) + 1,
            }
          : r,
      );
      setAutoLoadMsg(`Borrador ${activeReparto.repartoNo} en nube · rev ${j.revision}`);
    } catch (e) {
      setAutoLoadMsg(`Reparto: no se pudo guardar — ${e.message}`);
    } finally {
      setRepartoBusy(false);
    }
  }

  async function confirmRepartoCoordination() {
    if (!activeReparto || stops.length < 1) return;
    const payload = buildRepartoPayload({
      stops,
      truckL,
      distributionMode,
      cargoLayoutMode,
      manualPkgOrderKeys,
      rowOverrides,
      freePositions,
      loadWarnings,
      info,
    });
    if (activeReparto.local || !enviosAuthToken()) {
      setActiveReparto((r) =>
        r
          ? {
              ...r,
              status: "coordinado",
              confirmedAt: new Date().toISOString(),
              stopsSummary: stopSummariesForReparto(stops),
              drivePlan: {
                path: `_Repartos/${repartoDateKey()}/${r.repartoNo}`,
                note: "Local confirm — Drive al conectar API + DRIVE_REPARTOS_FOLDER_ID",
              },
            }
          : r,
      );
      setConfirmCoordOpen(false);
      setAutoLoadMsg(
        `✓ Coordinación confirmada ${activeReparto.repartoNo} · ${stops.length} parada(s) · registro local`,
      );
      return;
    }
    setRepartoBusy(true);
    try {
      // save latest first
      await saveRepartoDraft();
      const base = getCalcApiBase();
      const res = await fetch(`${base}/api/repartos/${encodeURIComponent(activeReparto.id)}/confirm`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${enviosAuthToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload, actor: "logistica-ui" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false) throw new Error(j.message || j.error || res.statusText);
      setActiveReparto((r) =>
        r
          ? {
              ...r,
              status: "coordinado",
              revision: j.reparto?.revision || r.revision,
              confirmedAt: j.reparto?.confirmedAt,
              drivePlan: j.reparto?.drivePlan,
              stopsSummary: j.reparto?.stopsSummary,
            }
          : r,
      );
      setConfirmCoordOpen(false);
      setAutoLoadMsg(
        `✓ Coordinación confirmada ${j.reparto?.repartoNo || activeReparto.repartoNo} · Drive path reservado · ver Historial`,
      );
    } catch (e) {
      setAutoLoadMsg(`Confirmar falló: ${e.message}`);
    } finally {
      setRepartoBusy(false);
    }
  }

  async function loadRepartoHistory() {
    setRepartoHistoryOpen(true);
    const token = enviosAuthToken();
    const base = getCalcApiBase();
    if (!token || !base) {
      setRepartoHistory(activeReparto ? [activeReparto] : []);
      return;
    }
    try {
      const res = await fetch(`${base}/api/repartos?limit=30`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) setRepartoHistory(j.repartos || []);
      else setRepartoHistory([]);
    } catch {
      setRepartoHistory([]);
    }
  }

  async function agregarStop(r) {
    await ensureActiveReparto((stops?.length || 0) + 1);
    const label = labelVentasCandidate(r);
    let pdfLink = r.pdf || "";
    const admin = await tryAdminQuoteMatch({
      orderId: r.orderId || "",
      nombre: r.nombre || "",
      telefono: r.tel || "",
    });
    if (admin.pdfLink && !pdfLink) pdfLink = admin.pdfLink;
    else if (admin.pdfLink && pdfLink && admin.pdfLink !== pdfLink) {
      // Prefer Admin PDF when auto-applied (more likely the quote BOM)
      if (admin.best) pdfLink = admin.pdfLink;
    }

    const baseStop = {
      ...mkStop(stops.length),
      cliente: r.nombre || "",
      direccion: r.dir,
      telefono: r.tel,
      pdfLink,
      mapLink: r.dir && !/drive\.google|docs\.google/i.test(r.dir) ? mapsUrl(r.dir) : (r.dir?.startsWith("http") ? r.dir : ""),
      carpetaDrive: r.carpetaDrive || "",
      rawSheetText: [r.encargoPlain, r.rawSheetText].filter(Boolean).join("\n") || r.rawSheetText || "",
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
        datosOk: Boolean((r.nombre || r.orderId) && (r.dir || r.tel)),
        mapaOk: Boolean(r.dir),
        adjuntoOk: Boolean(pdfLink),
      },
    };
    const hasInferSource = Boolean(pdfLink || r.rawSheetText || r.encargoPlain);
    setAutoLoadMsg(
      hasInferSource
        ? `Intentando autocompletar paneles para ${label}...`
        : `Parada agregada: ${label} (sin ENCARGO/PDF — cargá paneles a mano).${admin.matchNote ? ` · ${admin.matchNote}` : ""}`,
    );
    let enrichedStop = baseStop;
    if (hasInferSource) {
      const inferred = await inferStopCargo(baseStop);
      const adminSuffix = admin.matchNote ? ` · ${admin.matchNote}` : "";
      enrichedStop = {
        ...baseStop,
        paneles: inferred.paneles,
        accesorios: inferred.accesorios,
        accPackage: buildAccessoryPackageConfig({ ...baseStop, accesorios: inferred.accesorios, paneles: inferred.paneles }, accProfiles),
        observacionesLogistica: [inferred.warnings.filter(Boolean).join(" | "), admin.matchNote].filter(Boolean).join(" · "),
        recepcionDetalle: inferred.warnings.filter(Boolean).join(" | "),
        checks: {
          ...baseStop.checks,
          bultosOk: inferred.paneles.length > 0,
          accesoriosOk: inferred.accesorios.length > 0 || baseStop.checks.accesoriosOk,
        },
      };
      if (inferred.paneles.length || inferred.accesorios.length) {
        setAutoLoadMsg(
          `Autocarga OK: ${inferred.paneles.length} líneas de paneles y ${inferred.accesorios.length} accesorios para ${label}.${adminSuffix}`,
        );
      } else if (inferred.warnings.length) {
        setAutoLoadMsg(`No se pudo inferir carga automáticamente para ${label}. ${inferred.warnings[0]}${adminSuffix}`);
      } else {
        setAutoLoadMsg(`No se detectaron paneles automáticamente para ${label}.${adminSuffix}`);
      }
    } else if (admin.matchNote) {
      setAutoLoadMsg(`Parada ${label}: ${admin.matchNote}`);
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
    <div className="envios-app">
      <style>{`@media print{.np{display:none!important}}`}</style>

      <header className="envios-header envios-chrome np">
        <div>
          <h1 className="envios-header__title">BMC Uruguay — Logística de Carga</h1>
          <div className="envios-header__sub">{`2 filas máx · altura ${MAX_H}m · saliente 2m · pedidos no se mezclan`}</div>
        </div>
        <div className="envios-header__meta">
          <div className="envios-header__meta-strong">{info.numero} · {info.fecha}</div>
          <div style={{ marginTop: 4 }}>{totPan} paneles · {cargo.placed.length} pkgs · {stops.length} paradas</div>
        </div>
      </header>

      {cargo.warns.map((w, i) => (
        <div key={i} className="envios-alert-danger" style={{ marginBottom: 8 }}>⚠️ {w}</div>
      ))}

      {wizardUi.enabled ? (
        <div className="np" style={{ marginBottom: 12 }}>
          <EnvioWizardShell
            wizard={wizardUi}
            onWizardChange={(w) => {
              if (w.activeStep === "carga") setView("form");
              // when completing levantes single mode, apply default pickup
              if (w.done?.levantes && w.singlePickup !== false && w.defaultPickupPointId) {
                setStops((prev) => applyDefaultPickupToStops(prev, w.defaultPickupPointId));
              }
              setWizardUi(w);
            }}
            ctx={{ stops, info, truckL, wizard: wizardUi, route: tripRoute }}
            places={catalogPlaces}
            onClassic={() => {
              setWizardUi((p) => createWizardUi({ ...p, enabled: false }));
              setView("form");
            }}
            childrenByStep={{
              pedidos: (
                <StepPedidos
                  stops={stops}
                  search={search}
                  onSearchChange={setSearch}
                  onBuscar={buscarSheet}
                  onCargarActuales={cargarActuales}
                  loadSh={loadSh}
                  shErr={shErr}
                  autoLoadMsg={autoLoadMsg}
                  ventasRowCount={ventasCache.rows.length}
                  results={results}
                  onAddResult={agregarStop}
                  activeReparto={activeReparto}
                  onRemoveStop={(id) => {
                    setStops((p) => renumberStops(p.filter((s) => s.id !== id), { colors: COLORS }));
                  }}
                />
              ),
              flota: (
                <StepFlota
                  info={info}
                  truckL={truckL}
                  transportistas={transportistas}
                  places={catalogPlaces}
                  onChangeInfo={(k, v) => setInfo((p) => ({ ...p, [k]: v }))}
                  onTruckL={setTruckL}
                  newBaseLabel={newBaseLabel}
                  setNewBaseLabel={setNewBaseLabel}
                  newBaseUrl={newBaseUrl}
                  setNewBaseUrl={setNewBaseUrl}
                  onAddBase={() => {
                    const r = addUserPlace(catalogPlaces, {
                      kind: "base",
                      label: newBaseLabel,
                      mapUrl: newBaseUrl,
                      transportistaId: info.transportistaId || null,
                    });
                    if (!r.ok) {
                      setAutoLoadMsg("Base: nombre requerido");
                      return;
                    }
                    setCatalogPlaces(r.places);
                    saveCatalogToStorage(r.places);
                    setInfo((p) => ({ ...p, basePointId: r.place.id }));
                    setNewBaseLabel("");
                    setNewBaseUrl("");
                    setAutoLoadMsg(`Base guardada: ${r.place.label}`);
                  }}
                />
              ),
              levantes: (
                <StepLevantes
                  stops={stops}
                  wizard={wizardUi}
                  places={catalogPlaces}
                  onWizardPatch={(patch) => setWizardUi((p) => createWizardUi({ ...p, ...patch, routeStale: true }))}
                  onStopPickup={(sid, pid) => {
                    setStops((p) => p.map((s) => (s.id === sid ? { ...s, pickupPointId: pid } : s)));
                    setWizardUi((p) => createWizardUi({ ...p, routeStale: true }));
                  }}
                  newLabel={newPickupLabel}
                  setNewLabel={setNewPickupLabel}
                  newUrl={newPickupUrl}
                  setNewUrl={setNewPickupUrl}
                  onAddPickup={() => {
                    const r = addUserPlace(catalogPlaces, {
                      kind: "pickup",
                      label: newPickupLabel,
                      mapUrl: newPickupUrl,
                    });
                    if (!r.ok) {
                      setAutoLoadMsg("Levante: nombre requerido");
                      return;
                    }
                    setCatalogPlaces(r.places);
                    saveCatalogToStorage(r.places);
                    setWizardUi((p) =>
                      createWizardUi({
                        ...p,
                        defaultPickupPointId: r.place.id,
                        routeStale: true,
                      }),
                    );
                    setNewPickupLabel("");
                    setNewPickupUrl("");
                    setAutoLoadMsg(`Levante guardado: ${r.place.label}`);
                  }}
                />
              ),
              ruta: (
                <StepRuta
                  route={tripRoute}
                  routeStale={wizardUi.routeStale}
                  info={info}
                  onRecalcular={async () => {
                    // Best-effort: parse lat,lng from map links; Nominatim for addresses without geo
                    // Re-merge seed so Kingspan etc. pick up seed geo/address even if LS was stale
                    let placesForRoute = mergeCatalogPlaces(catalogPlaces);
                    setCatalogPlaces(placesForRoute);
                    saveCatalogToStorage(placesForRoute);
                    let stopsForRoute =
                      wizardUi.singlePickup !== false
                        ? applyDefaultPickupToStops(stops, wizardUi.defaultPickupPointId)
                        : stops;

                    // Parse coords from mapLink/mapUrl into stop.geo when possible
                    stopsForRoute = stopsForRoute.map((s) => {
                      if (s.geo && Number.isFinite(s.geo.lat)) return s;
                      const parsed = parseLatLng(s.mapLink) || parseLatLng(s.direccion);
                      if (!parsed) return s;
                      return applyGeocodeToStop(s, { ...parsed, label: s.direccion || s.cliente || "", source: "parsed" });
                    });
                    setStops((prev) =>
                      prev.map((s) => {
                        const next = stopsForRoute.find((x) => x.id === s.id);
                        return next?.geo && !s.geo ? next : s;
                      }),
                    );

                    // Geocode missing delivery addresses (max 5) via API if token present
                    const token = enviosAuthToken();
                    const baseApi = getCalcApiBase();
                    if (token && baseApi) {
                      const needGeo = stopsForRoute.filter((s) => !s.geo && String(s.direccion || "").trim()).slice(0, 5);
                      for (const s of needGeo) {
                        try {
                          const res = await fetch(`${baseApi}/api/envios/geocode`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ address: s.direccion }),
                          });
                          const j = await res.json().catch(() => ({}));
                          if (res.ok && j.geo) {
                            const enriched = applyGeocodeToStop(s, j.geo);
                            stopsForRoute = stopsForRoute.map((x) => (x.id === s.id ? enriched : x));
                            setStops((prev) => prev.map((x) => (x.id === s.id ? enriched : x)));
                          }
                        } catch {
                          /* skip */
                        }
                      }
                      // Geocode base place label if missing geo
                      const basePlace = placesForRoute.find((p) => p.id === info.basePointId);
                      if (basePlace && !basePlace.geo) {
                        const q = basePlace.addressText || basePlace.label;
                        if (q) {
                          try {
                            const res = await fetch(`${baseApi}/api/envios/geocode`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ address: q }),
                            });
                            const j = await res.json().catch(() => ({}));
                            if (res.ok && j.geo) {
                              placesForRoute = placesForRoute.map((p) =>
                                p.id === basePlace.id
                                  ? {
                                      ...p,
                                      geo: {
                                        lat: Number(j.geo.lat),
                                        lng: Number(j.geo.lng),
                                        source: "nominatim",
                                      },
                                      addressText: p.addressText || j.geo.label || p.label,
                                    }
                                  : p,
                              );
                              setCatalogPlaces(placesForRoute);
                              saveCatalogToStorage(placesForRoute);
                            }
                          } catch {
                            /* skip */
                          }
                        }
                      }
                    }

                    const r = suggestRoute({
                      basePointId: info.basePointId,
                      places: placesForRoute,
                      stops: stopsForRoute,
                      defaultPickupPointId: wizardUi.defaultPickupPointId,
                    });
                    setTripRoute(r);
                    setWizardUi((p) => createWizardUi({ ...p, routeStale: false, done: { ...p.done, ruta: true } }));
                    const withGeo = (r.orderedLegs || []).filter((l) => l.geo).length;
                    setAutoLoadMsg(
                      `Ruta: ${r.orderedLegs.length} tramos · ${withGeo} con geo${r.totalKm != null ? ` · ~${r.totalKm.toFixed(0)} km` : ""} — Maps/WA listos`,
                    );
                  }}
                />
              ),
              carga: (
                <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.45 }}>
                  Listo para estibar. Cerrá el wizard con <b>Detalle Completo</b> o usá las pestañas{" "}
                  <b>Detalle Completo</b>, <b>Remito</b> y <b>Diagrama 3D</b> para ver todo lo cargado, remito y WhatsApp al
                  transportista.
                </div>
              ),
            }}
          />
          <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
            Configurando envío · catálogo {listPlaces(catalogPlaces).length} lugares
          </div>
        </div>
      ) : (
        <div
          className="np"
          style={{
            marginBottom: 12,
            padding: "14px 16px",
            borderRadius: 14,
            border: `1px solid ${T.border}`,
            background: "linear-gradient(135deg,#eff6ff 0%,#fff 55%)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0, flex: "1 1 220px" }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: T.brand }}>Configuración del envío</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2, lineHeight: 1.4 }}>
              Armá el viaje por etapas: pedidos → flota → levantes → ruta → carga.
              {stops.length ? ` · ${stops.length} pedido(s) en Detalle Completo` : " · Empezá acá para un envío nuevo"}
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              setWizardUi((p) =>
                createWizardUi({
                  ...p,
                  enabled: true,
                  activeStep: "pedidos",
                }),
              )
            }
            style={{
              padding: "12px 18px",
              borderRadius: 12,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              minHeight: 48,
              boxShadow: "0 2px 8px rgba(37,99,235,.25)",
              whiteSpace: "nowrap",
            }}
          >
            Configurar envío →
          </button>
        </div>
      )}

      <div className="envios-tabbar np">
        {[["form", "📋 Detalle Completo"], ["remito", "📄 Remito"], ["carga", "🚛 Diagrama 3D"]].map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`envios-tab${view === v ? " envios-tab--active" : ""}`}
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
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Btn
            small
            color={freeDragEnabled ? "#f59e0b" : undefined}
            onClick={() => handleToggleFreeDrag(!freeDragEnabled)}
            title="Bypass del motor: acomodá bultos a mano en 3D"
          >
            Free-Drag {freeDragEnabled ? "ON" : "OFF"}
            {freeDragCount > 0 ? ` · ${freeDragCount}` : ""}
          </Btn>
          {freeDragEnabled ? (
            <span style={{ fontSize: 11, color: T.muted, alignSelf: "center", maxWidth: 220 }}>
              3D: long-press o doble-clic · Lista: arrastrá ⠿
            </span>
          ) : null}
          {freeDragCount > 0 ? (
            <Btn small outline onClick={() => handleClearFreeDrag(null)} title="Borrar todas las posiciones free-drag">
              Limpiar free
            </Btn>
          ) : null}
          <Btn
            small
            color={yardMode ? "#38bdf8" : undefined}
            onClick={handleUnloadTruckToYard}
            title="Descarga pedidos a pilas separadas alrededor del camión"
          >
            Descargar camión
          </Btn>
        </div>
        <Btn onClick={sendWA} color="#25D366">📲 WhatsApp</Btn>
      </div>

      {pendingLengthConfirm ? (
        <div
          role="dialog"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(15,23,42,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              maxWidth: 420,
              boxShadow: "0 20px 50px rgba(0,0,0,.25)",
            }}
          >
            <div style={{ fontWeight: 800, color: "#92400e", marginBottom: 8 }}>Limitante física</div>
            <p style={{ fontSize: 14, lineHeight: 1.45, color: "#334155", margin: "0 0 16px" }}>
              {pendingLengthConfirm.check?.message ||
                "Esto presenta una limitante física. ¿Lo colocamos igual?"}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn outline onClick={() => handleConfirmLengthSoft(false)}>
                Cancelar
              </Btn>
              <Btn color="#f59e0b" onClick={() => handleConfirmLengthSoft(true)}>
                Sí, colocar y registrar aviso
              </Btn>
            </div>
          </div>
        </div>
      ) : null}

      {confirmCoordOpen ? (
        <div
          role="dialog"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(15,23,42,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 20px 50px rgba(0,0,0,.25)",
            }}
          >
            <div style={{ fontWeight: 800, color: "#047857", marginBottom: 8 }}>
              Confirmar coordinación
            </div>
            <p style={{ fontSize: 13, color: "#475569", margin: "0 0 12px" }}>
              Se cierra el reparto <b>{activeReparto?.repartoNo || "—"}</b> como{" "}
              <b>Coordinado</b>, se guarda el snapshot y se registra el plan Drive (path).
            </p>
            <ul style={{ margin: "0 0 14px", paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
              {stops.map((s) => (
                <li key={s.id}>
                  <b>{s.cliente || "—"}</b>
                  {s.orderId ? ` · #${s.orderId}` : ""} · {s.direccion || "sin dir"}
                </li>
              ))}
            </ul>
            {loadWarnings.length ? (
              <div style={{ fontSize: 12, color: "#92400e", marginBottom: 12 }}>
                Incluye {loadWarnings.length} aviso(s) de estiba en el registro.
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn outline onClick={() => setConfirmCoordOpen(false)} disabled={repartoBusy}>
                Cancelar
              </Btn>
              <Btn color="#059669" onClick={confirmRepartoCoordination} disabled={repartoBusy}>
                {repartoBusy ? "Guardando…" : "Confirmar y guardar"}
              </Btn>
            </div>
          </div>
        </div>
      ) : null}

      {repartoHistoryOpen ? (
        <div
          role="dialog"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(15,23,42,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              maxWidth: 560,
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 20px 50px rgba(0,0,0,.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 800 }}>Historial de repartos</div>
              <Btn outline small onClick={() => setRepartoHistoryOpen(false)}>
                Cerrar
              </Btn>
            </div>
            {!repartoHistory.length ? (
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Sin historial en nube (o sin API). El reparto activo sigue en esta sesión.
              </div>
            ) : (
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: 6 }}>Nº</th>
                    <th style={{ padding: 6 }}>Estado</th>
                    <th style={{ padding: 6 }}>Paradas</th>
                    <th style={{ padding: 6 }}>Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {repartoHistory.map((row) => (
                    <tr key={row.id || row.reparto_no} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 6, fontWeight: 700 }}>{row.reparto_no || row.repartoNo}</td>
                      <td style={{ padding: 6 }}>{row.statusLabel || row.status}</td>
                      <td style={{ padding: 6 }}>{row.stop_count ?? "—"}</td>
                      <td style={{ padding: 6, color: "#64748b" }}>
                        {row.updated_at ? String(row.updated_at).slice(0, 16) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}

      {view === "remito" ? <RemitoView info={info} stops={stops} cargo={cargo} truckL={truckL} sendWA={sendWA} /> : null}

      {view === "carga" ? (
        <div>
          <DiagramPanel
            cargo={cargo}
            truckL={truckL}
            remitoNumero={info.numero}
            info={info}
            stops={stops}
            onForcePackageRow={forcePackageRow}
            onForcePackageStack={forcePackageStack}
            onUpdateStop={updStop}
            freeDragEnabled={freeDragEnabled}
            freeDragCount={freeDragCount}
            onFreeDragEnd={handleFreeDragEnd}
            onGroupDragEnd={handleGroupDragEnd}
            onClearFreeDrag={handleClearFreeDrag}
            onToggleFreeDrag={handleToggleFreeDrag}
            multiSelectKeys={multiSelectKeys}
            onMultiSelectChange={setMultiSelectKeys}
            onBlocked={(msg) => setAutoLoadMsg(msg || BURIED_TOAST_ES)}
            onUnloadTruck={handleUnloadTruckToYard}
            yardMode={yardMode}
            loadWarnings={loadWarnings}
          />
          <div style={{ ...css.card, padding: 14, marginTop: 12 }}>
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.4,
                color: T.warning || "#b45309",
                background: "#fff8ec",
                border: `1px solid ${T.warning || "#f0c36e"}`,
                borderRadius: 8,
                padding: "8px 10px",
                marginBottom: 10,
                fontWeight: 600,
              }}
            >
              {PANEL_ON_PROFILE_RULE_ES}
              {cargo.stackConstraintsOk === false ? (
                <div style={{ marginTop: 6, color: "#b91c1c" }}>
                  ⚠ Layout inválido: hay paneles sobre perfiles — reordená o mové el perfil a la otra fila.
                </div>
              ) : null}
            </div>
            {loadWarnings.length ? (
              <div
                style={{
                  fontSize: 12,
                  marginBottom: 10,
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #f59e0b",
                  background: "#fffbeb",
                  color: "#92400e",
                }}
              >
                <b>Avisos de estiba ({loadWarnings.length})</b>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {formatLoadWarningsForPlan(loadWarnings).map((line) => (
                    <li key={line}>{line.replace(/^\d+\.\s*/, "")}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <PackageLayoutList
              placed={cargo.placed}
              counts={packageBultoCounts(cargo.placed)}
              manualKeys={manualPkgOrderKeys}
              onReorder={reorderPackages}
              onForceRow={forcePackageRow}
            />
          </div>
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
                    <svg width="100%" viewBox={`0 0 ${tvW} ${tvH}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", maxWidth: "100%", height: "auto" }}>
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
                    <svg width="100%" viewBox={`0 0 ${svW} ${svH + 20}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", maxWidth: "100%", height: "auto" }}>
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
                    <svg width="100%" viewBox={`0 0 ${svW} ${svH + 20}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", maxWidth: "100%", height: "auto" }}>
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
            <RepartoBar
              reparto={
                activeReparto ||
                (stops.length
                  ? { status: "en_coordinacion", repartoNo: "…", revision: 0 }
                  : null)
              }
              stopCount={stops.length}
              truckL={truckL}
              busy={repartoBusy}
              onConfirm={() => setConfirmCoordOpen(true)}
              onSaveDraft={saveRepartoDraft}
              onOpenHistory={loadRepartoHistory}
              onNewReparto={() => {
                setActiveReparto(null);
                setAutoLoadMsg("Listo para nuevo reparto — agregá paradas");
              }}
            />
            <div style={{ ...css.card, padding: 16, background: "#e8f1fb", borderColor: "#bfdbfe" }}>
              <h3 style={css.sectionTitle}>🔍 Buscar cliente en Ventas</h3>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input id="log-search" name="log-search" aria-label="Buscar cliente" style={{ ...css.inp, flex: 1, minWidth: 160 }} placeholder="Nombre, pedido, tel, dirección..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscarSheet()} />
                <Btn onClick={buscarSheet} disabled={loadSh}>{loadSh ? "⏳" : "Buscar"}</Btn>
                <Btn onClick={cargarActuales} disabled={loadSh} outline>Cargar actuales</Btn>
              </div>
              {ventasCache.rows.length ? <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>Última lectura: {ventasCache.rows.length} filas en pestaña actual.</div> : null}
              {shErr ? <div style={{ color: "#b42318", fontSize: 12, padding: "7px 10px", background: "#ffeceb", borderRadius: 8, marginBottom: 8 }}>{shErr}</div> : null}
              {autoLoadMsg ? <div style={{ color: T.brand, fontSize: 12, padding: "7px 10px", background: "#ffffff", borderRadius: 8, marginBottom: 8, border: "1px solid #bfdbfe" }}>{autoLoadMsg}</div> : null}
              {results.map((r, i) => {
                const inReparto = stops.some(
                  (s) =>
                    (r.orderId && String(s.orderId) === String(r.orderId)) ||
                    (r.nombre && String(s.cliente || "").toLowerCase() === String(r.nombre || "").toLowerCase()),
                );
                const chipColor =
                  inReparto || activeReparto?.status === "en_coordinacion" && inReparto
                    ? "#c2410c"
                    : r.coordination?.status === "enviado"
                    ? "#16a34a"
                    : r.coordination?.status === "coordinado"
                      ? r.coordinationColor || "#2563eb"
                      : "#94a3b8";
                const chipBg =
                  inReparto
                    ? "#fff7ed"
                    : r.coordination?.status === "enviado"
                    ? "#dcfce7"
                    : r.coordination?.status === "coordinado"
                      ? "#eff6ff"
                      : "#f1f5f9";
                return (
                <div
                  key={`${r.orderId || r.nombre || "r"}-${r.ventasSheetRow1Based || i}`}
                  onClick={() => agregarStop(r)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.surface, border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 12px", cursor: "pointer", marginBottom: 6, transition: "background .15s", gap: 8 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#dbeafe"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = T.surface; }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <div style={{ fontWeight: 700, color: T.brand, fontSize: 13 }}>{r.nombre || "—"}</div>
                      {r.orderId || r.cotizacionId ? (
                        <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>#{r.orderId || r.cotizacionId}</span>
                      ) : null}
                      <span
                        title={r.estadoText || r.coordinationCaption || ""}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                          textTransform: "uppercase",
                          color: chipColor,
                          background: chipBg,
                          border: `1.5px solid ${chipColor}`,
                          borderRadius: 999,
                          padding: "2px 8px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {inReparto
                          ? "En este reparto"
                          : activeReparto?.status === "en_coordinacion" && stops.length
                            ? "Por coordinar"
                            : r.coordinationCaption || r.coordination?.label || "Por coordinar"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: T.muted }}>📍{r.dir || "—"} · 📞{r.tel || "—"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {r.pdf ? <Btn href={r.pdf} target="_blank" outline small>📄 PDF</Btn> : null}
                    <Btn color={T.success} small>+ Parada</Btn>
                  </div>
                </div>
                );
              })}
            </div>

            <div style={{ ...css.card, padding: 16 }}>
              <h3 style={css.sectionTitle}>Datos del Envío</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div><label htmlFor="log-numero" style={css.lbl}>Nº Envío</label><input id="log-numero" name="log-numero" style={css.inp} value={info.numero} onChange={(e) => updInfo("numero", e.target.value)} /></div>
                <div><label htmlFor="log-fecha" style={css.lbl}>Fecha</label><input id="log-fecha" name="log-fecha" style={css.inp} type="date" value={info.fecha} onChange={(e) => updInfo("fecha", e.target.value)} /></div>
                <div>
                  <label htmlFor="log-transportista" style={css.lbl}>Transportista</label>
                  <input id="log-transportista" name="log-transportista" style={css.inp} list="bmc-transportistas-list" value={info.transportista} onChange={(e) => updInfo("transportista", e.target.value)} placeholder="Nombre o elegí de la lista" />
                  <datalist id="bmc-transportistas-list">
                    {transportistas.map((t) => <option key={t.id} value={t.nombre} />)}
                  </datalist>
                </div>
                <div><label htmlFor="log-patente" style={css.lbl}>Patente</label><input id="log-patente" name="log-patente" style={css.inp} value={info.patente} onChange={(e) => updInfo("patente", e.target.value)} /></div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
                <Btn onClick={() => saveDraftToCloud()} disabled={cloudSyncBusy} color={T.brand} small>
                  {cloudSyncBusy ? "⏳ Nube…" : "☁ Guardar en nube"}
                </Btn>
                <Btn onClick={loadDraftFromCloud} disabled={cloudSyncBusy} outline small>
                  ☁ Cargar de nube
                </Btn>
                <Btn onClick={() => setDraftBrowserOpen(true)} outline small>
                  Borradores
                </Btn>
                <label style={{ fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={autosaveEnabled}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setAutosaveEnabled(on);
                      try {
                        localStorage.setItem("bmc-envios-autosave", on ? "1" : "0");
                      } catch {
                        /* ignore */
                      }
                    }}
                  />
                  Autosave nube
                </label>
                {cloudMeta?.revision != null ? (
                  <span style={{ fontSize: 11, color: cloudMeta.status === "conflict" ? T.danger : T.muted }}>
                    Cloud rev {cloudMeta.revision}
                    {cloudMeta.status === "saved" ? " · ✓" : ""}
                    {cloudMeta.status === "conflict" ? " · ⚠ conflicto" : ""}
                    {cloudMeta.updatedAt ? ` · ${new Date(cloudMeta.updatedAt).toLocaleString()}` : ""}
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: T.muted }}>
                    P5b multi-device · localStorage offline
                  </span>
                )}
                {tripDistance.geocodedCount >= 2 ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.brand }}>
                    ≈ {tripDistance.totalKm} km aire ({tripDistance.legs.length} tramos · {tripDistance.geocodedCount} geo)
                  </span>
                ) : tripDistance.geocodedCount === 1 ? (
                  <span style={{ fontSize: 11, color: T.muted }}>1 parada geocodificada · geocodificá otra para km</span>
                ) : null}
              </div>
              {cloudConflict ? (
                <div
                  style={{
                    marginBottom: 10,
                    padding: 10,
                    borderRadius: 10,
                    background: "#fff7ed",
                    border: "1px solid #fdba74",
                    fontSize: 12,
                  }}
                >
                  <b>Conflicto de nube</b> (rev remota {cloudConflict.revision}). Otro dispositivo guardó antes.
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <Btn
                      small
                      color={T.brand}
                      onClick={async () => {
                        await saveDraftToCloud({ force: true, silent: false });
                        setCloudConflict(null);
                      }}
                    >
                      Mantener el mío (forzar)
                    </Btn>
                    <Btn
                      small
                      outline
                      onClick={async () => {
                        setCloudConflict(null);
                        await loadDraftFromCloud();
                      }}
                    >
                      Usar versión de la nube
                    </Btn>
                    <Btn small outline onClick={() => setCloudConflict(null)}>
                      Cerrar
                    </Btn>
                  </div>
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
                <input id="log-new-carrier" name="log-new-carrier" aria-label="Nuevo transportista" style={{ ...css.inp, flex: 1, minWidth: 140 }} placeholder="Nuevo transportista" value={newCarrierName} onChange={(e) => setNewCarrierName(e.target.value)} />
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
                <div><label htmlFor="log-trip-price" style={css.lbl}>Precio viaje (UYU)</label><input id="log-trip-price" name="log-trip-price" style={css.inp} type="number" min={0} step="1" value={tripPriceInput} onChange={(e) => setTripPriceInput(e.target.value)} placeholder="Opcional" /></div>
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

            {stops.length > 1 ? (
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>
                Arrastrá el asa ⠿ para reordenar paradas · clic en el chevron para plegar/expandir.
              </div>
            ) : null}

            {stops.map((stop) => {
              const placed = cargo.placed.filter((p) => p.sId === stop.id);
              const rowA = placed.filter((p) => p.row === 0);
              const rowB = placed.filter((p) => p.row === 1);
              const badges = getStopBadges(stop);
              const totalAcc = stop.accesorios.reduce((t, a) => t + safeNum(a.cantidad), 0);
              const collapsed = collapsedStopIds.includes(stop.id);
              const panelCount = safeNum(stop.paneles.reduce((t, p) => t + safeNum(p.cantidad), 0));
              return (
                <div
                  key={stop.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const activeId =
                      e.dataTransfer.getData("text/plain") ||
                      e.dataTransfer.getData("application/x-bmc-stop-id") ||
                      dragStopId;
                    if (activeId) moveStopBefore(activeId, stop.id);
                    setDragStopId(null);
                  }}
                  style={{
                    ...css.card,
                    padding: 16,
                    borderLeft: `4px solid ${stop.color}`,
                    opacity: dragStopId === stop.id ? 0.55 : 1,
                    outline: dragStopId && dragStopId !== stop.id ? `1px dashed ${T.primary}55` : undefined,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: collapsed ? 0 : 12, paddingBottom: collapsed ? 0 : 10, borderBottom: collapsed ? "none" : `1px solid ${stop.color}22`, gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                      <span
                        draggable
                        data-stop-id={stop.id}
                        data-testid={`drag-stop-${stop.id}`}
                        title="Arrastrar para reordenar"
                        aria-label="Arrastrar parada"
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", stop.id);
                          e.dataTransfer.setData("application/x-bmc-stop-id", stop.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDragStopId(stop.id);
                        }}
                        onDragEnd={() => setDragStopId(null)}
                        style={{ cursor: "grab", color: T.muted, fontSize: 16, lineHeight: 1, userSelect: "none", padding: "2px 4px" }}
                      >
                        ⠿
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleStopCollapsed(stop.id)}
                        aria-expanded={!collapsed}
                        aria-label={collapsed ? "Expandir parada" : "Plegar parada"}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          padding: "2px 4px",
                          fontSize: 12,
                          color: T.muted,
                          flexShrink: 0,
                        }}
                      >
                        {collapsed ? "▶" : "▼"}
                      </button>
                      <strong style={{ color: stop.color, fontSize: 14, whiteSpace: "nowrap" }}>📍 P{stop.orden}</strong>
                      <span style={{ fontWeight: 700, fontSize: 13, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {stop.cliente || "Sin cliente"}
                      </span>
                      <span style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>#{orderDisplayId(stop)}</span>
                      {collapsed ? (
                        <span style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>
                          · {placed.length} bultos · {panelCount} paneles · {stop.estado || "Pendiente"}
                        </span>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {stop.pdfLink ? <Btn href={stop.pdfLink} target="_blank" outline small>📄 PDF</Btn> : null}
                      {stop.direccion || stop.geo ? (
                        <Btn
                          href={
                            stop.geo
                              ? mapsCoordsUrl(stop.geo.lat, stop.geo.lng, stop.direccion || stop.cliente)
                              : stop.mapLink || mapsUrl(stop.direccion)
                          }
                          target="_blank"
                          color={T.success}
                          small
                        >
                          🗺️ Mapa{stop.geo ? " ✓" : ""}
                        </Btn>
                      ) : null}
                      <Btn
                        onClick={() => geocodeStop(stop.id)}
                        outline
                        small
                        disabled={geocodingStopId === stop.id}
                      >
                        {geocodingStopId === stop.id ? "⏳ Geo…" : stop.geo ? "↻ Re-geo" : "📍 Geocodificar"}
                      </Btn>
                      {(stop.pdfLink || stop.rawSheetText) ? (
                        <Btn onClick={() => retryAutoLoadForStop(stop)} outline small>
                          {retryingStopId === stop.id ? "⏳ Reintentando" : "↻ Reintentar autocarga"}
                        </Btn>
                      ) : null}
                      <Btn onClick={() => rmStop(stop.id)} color={T.danger} small>✕</Btn>
                    </div>
                  </div>
                  {collapsed ? null : (
                  <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    <span style={badgeStyle("neutral")}>Pedido {orderDisplayId(stop)}</span>
                    <span style={badgeStyle("neutral")}>{placed.length} bultos · {panelCount} paneles · {totalAcc} acc.</span>
                    <span style={badgeStyle(stop.entregaConfirm?.confirmed ? "success" : "neutral")}>
                      {stop.entregaConfirm?.confirmed ? "Entrega OK" : stop.estado || "Pendiente"}
                    </span>
                    {badges.map((badge) => <span key={badge.label} style={badgeStyle(badge.tone)}>{badge.label}</span>)}
                  </div>

                  <FormSection
                    title="👤 Datos del cliente"
                    summary={[stop.cliente || "sin nombre", stop.telefono || "sin tel", truncate(stop.direccion || "sin dir", 32)].join(" · ")}
                    defaultOpen={!stop.cliente || !stop.telefono}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 8, marginTop: 10 }}>
                      <div><label htmlFor={`s-${stop.id}-cliente`} style={css.lbl}>Cliente</label><input id={`s-${stop.id}-cliente`} name={`s-${stop.id}-cliente`} style={css.inp} value={stop.cliente} onChange={(e) => updStop(stop.id, "cliente", e.target.value)} /></div>
                      <div><label htmlFor={`s-${stop.id}-telefono`} style={css.lbl}>Teléfono</label><input id={`s-${stop.id}-telefono`} name={`s-${stop.id}-telefono`} style={css.inp} value={stop.telefono} onChange={(e) => updStop(stop.id, "telefono", e.target.value)} /></div>
                      <div><label htmlFor={`s-${stop.id}-direccion`} style={css.lbl}>Dirección</label><input id={`s-${stop.id}-direccion`} name={`s-${stop.id}-direccion`} style={css.inp} value={stop.direccion} onChange={(e) => { updStop(stop.id, "direccion", e.target.value); updStop(stop.id, "mapLink", e.target.value ? mapsUrl(e.target.value) : ""); }} /></div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }}>
                      <div><label htmlFor={`s-${stop.id}-orderId`} style={css.lbl}>ID pedido</label><input id={`s-${stop.id}-orderId`} name={`s-${stop.id}-orderId`} style={css.inp} value={stop.orderId || ""} onChange={(e) => updStop(stop.id, "orderId", e.target.value)} placeholder="Desde Ventas / CRM" /></div>
                      <div><label htmlFor={`s-${stop.id}-cotizacionId`} style={css.lbl}>ID cotización</label><input id={`s-${stop.id}-cotizacionId`} name={`s-${stop.id}-cotizacionId`} style={css.inp} value={stop.cotizacionId || ""} onChange={(e) => updStop(stop.id, "cotizacionId", e.target.value)} placeholder="Remito / cotización" /></div>
                      <div><label htmlFor={`s-${stop.id}-pickupId`} style={css.lbl}>ID retiro</label><input id={`s-${stop.id}-pickupId`} name={`s-${stop.id}-pickupId`} style={css.inp} value={stop.pickupId || ""} onChange={(e) => updStop(stop.id, "pickupId", e.target.value)} placeholder="Proveedor / fábrica" /></div>
                    </div>
                  </FormSection>

                  <FormSection
                    title="🚚 Datos para la entrega"
                    summary={[stop.zona || "sin zona", stop.horarioEntrega || "sin horario", stop.fechaEntrega || "sin fecha", stop.estado || "Pendiente"].join(" · ")}
                    defaultOpen={false}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
                      <div><label htmlFor={`s-${stop.id}-zona`} style={css.lbl}>Zona</label><input id={`s-${stop.id}-zona`} name={`s-${stop.id}-zona`} style={css.inp} value={stop.zona || ""} onChange={(e) => updStop(stop.id, "zona", e.target.value)} placeholder="Barrio / zona" /></div>
                      <div><label htmlFor={`s-${stop.id}-contacto`} style={css.lbl}>Recepción (contacto)</label><input id={`s-${stop.id}-contacto`} name={`s-${stop.id}-contacto`} style={css.inp} value={stop.contactoRecepcion || ""} onChange={(e) => updStop(stop.id, "contactoRecepcion", e.target.value)} placeholder="Nombre receptor" /></div>
                      <div><label htmlFor={`s-${stop.id}-horario`} style={css.lbl}>Horario</label><input id={`s-${stop.id}-horario`} name={`s-${stop.id}-horario`} style={css.inp} value={stop.horarioEntrega || ""} onChange={(e) => updStop(stop.id, "horarioEntrega", e.target.value)} placeholder="Ej. 08:00-12:00" /></div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 220px) 1fr", gap: 8, marginTop: 8, alignItems: "end" }}>
                      <div>
                        <label htmlFor={`s-${stop.id}-fechaEntrega`} style={css.lbl}>Fecha De Entrega</label>
                        <input
                          id={`s-${stop.id}-fechaEntrega`}
                          name={`s-${stop.id}-fechaEntrega`}
                          style={css.inp}
                          type="date"
                          value={/^\d{4}-\d{2}-\d{2}$/.test(String(stop.fechaEntrega || "").trim()) ? stop.fechaEntrega : ""}
                          onChange={(e) => onFechaEntregaChange(stop.id, e.target.value)}
                        />
                      </div>
                      <div style={{ fontSize: 11, color: T.muted, paddingBottom: 8, lineHeight: 1.35 }}>
                        {stop.ventasSheetRow1Based
                          ? `Se guarda en Ventas col. G, fila ${stop.ventasSheetRow1Based}. Requiere API y token.`
                          : "Vinculá la parada desde Buscar / Cargar actuales para escribir fecha en la planilla."}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                      <div><label htmlFor={`s-${stop.id}-pdfLink`} style={css.lbl}>Link PDF pedido</label><input id={`s-${stop.id}-pdfLink`} name={`s-${stop.id}-pdfLink`} style={css.inp} value={stop.pdfLink || ""} onChange={(e) => updStop(stop.id, "pdfLink", e.target.value)} placeholder="https://drive.google.com/..." /></div>
                      <div>
                        <label htmlFor={`s-${stop.id}-mapLink`} style={css.lbl}>
                          Link mapa{stop.geo ? ` · ${Number(stop.geo.lat).toFixed(4)}, ${Number(stop.geo.lng).toFixed(4)}` : ""}
                        </label>
                        <input
                          id={`s-${stop.id}-mapLink`}
                          name={`s-${stop.id}-mapLink`}
                          style={{ ...css.inp, color: T.muted, fontSize: 11 }}
                          value={stop.mapLink || (stop.direccion ? mapsUrl(stop.direccion) : "")}
                          onChange={(e) => {
                            const v = e.target.value;
                            const parsed = parseLatLng(v);
                            if (parsed) {
                              setStops((p) =>
                                p.map((s) =>
                                  s.id === stop.id
                                    ? applyGeocodeToStop(s, {
                                        ...parsed,
                                        label: s.direccion || s.cliente || "",
                                        source: "parsed",
                                      })
                                    : s,
                                ),
                              );
                            } else {
                              updStop(stop.id, "mapLink", v);
                            }
                          }}
                          placeholder="URL Maps o lat,lng"
                        />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                      <div>
                        <label htmlFor={`s-${stop.id}-estado`} style={css.lbl}>Estado operativo</label>
                        <select
                          id={`s-${stop.id}-estado`}
                          name={`s-${stop.id}-estado`}
                          style={css.inp}
                          value={stop.estado || "Pendiente"}
                          title="Transiciones según FSM Envíos (G-U3)"
                          onChange={(e) => {
                            const cur = stop.estado || "Pendiente";
                            const next = e.target.value;
                            const listaOk = Boolean(stop.checks?.datosOk && stop.checks?.bultosOk);
                            const ctx = {
                              formValid: true,
                              ...(next === "Cargada" && cur === "Pendiente" && !listaOk
                                ? { listaParaCarga: false }
                                : {}),
                            };
                            const result = applyStatusTransition(cur, next, ctx);
                            if (result.changed) {
                              updStop(stop.id, "estado", result.status);
                            } else if (result.error) {
                              updStop(stop.id, "estado", cur);
                            }
                          }}
                        >
                          {statusSelectOptions(stop.estado || "Pendiente", { formValid: true }).map(
                            ({ value, disabled }) => (
                              <option key={value} value={value} disabled={disabled}>
                                {value}
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`s-${stop.id}-recepcion`} style={css.lbl}>Recepción</label>
                        <select id={`s-${stop.id}-recepcion`} name={`s-${stop.id}-recepcion`} style={css.inp} value={stop.recepcionEstado || "Pendiente"} onChange={(e) => updStop(stop.id, "recepcionEstado", e.target.value)}>
                          {RECEPCION_STATUS.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
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
                  </FormSection>

                  <FormSection
                    title="☑️ Confirmar entrega"
                    summary={
                      stop.entregaConfirm?.confirmed
                        ? `Confirmada${stop.entregaConfirm.proof ? " · con comprobante" : ""}`
                        : "Comprobante + comentarios"
                    }
                    defaultOpen={false}
                    tone={stop.entregaConfirm?.confirmed ? "success" : undefined}
                  >
                    <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(stop.entregaConfirm?.confirmed)}
                          onChange={(e) => {
                            const confirmed = e.target.checked;
                            updStop(stop.id, "entregaConfirm", {
                              ...(stop.entregaConfirm || {}),
                              confirmed,
                              confirmedAt: confirmed ? new Date().toISOString() : null,
                            });
                            if (confirmed) {
                              const result = applyStatusTransition(stop.estado || "Pendiente", "Entregada", { formValid: true });
                              if (result.changed) updStop(stop.id, "estado", result.status);
                              else updStop(stop.id, "estado", "Entregada");
                              if ((stop.recepcionEstado || "Pendiente") === "Pendiente") {
                                updStop(stop.id, "recepcionEstado", "Conforme");
                              }
                            }
                          }}
                        />
                        <span style={{ fontWeight: 600 }}>Marcar entrega confirmada</span>
                      </label>
                      <div>
                        <label style={css.lbl}>Comprobante de entrega (foto / PDF, máx 1.5 MB)</label>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          style={{ fontSize: 12, maxWidth: "100%" }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 1.5 * 1024 * 1024) {
                              window.alert("Archivo demasiado grande (máx 1.5 MB).");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = () => {
                              updStop(stop.id, "entregaConfirm", {
                                ...(stop.entregaConfirm || {}),
                                proof: {
                                  name: file.name,
                                  mime: file.type,
                                  size: file.size,
                                  dataUrl: String(reader.result || ""),
                                  at: new Date().toISOString(),
                                },
                              });
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                        {stop.entregaConfirm?.proof?.name ? (
                          <div style={{ fontSize: 12, marginTop: 4, color: T.muted }}>
                            📎 {stop.entregaConfirm.proof.name}
                            {" · "}
                            <button
                              type="button"
                              style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", padding: 0 }}
                              onClick={() =>
                                updStop(stop.id, "entregaConfirm", {
                                  ...(stop.entregaConfirm || {}),
                                  proof: null,
                                })
                              }
                            >
                              Quitar
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div>
                        <label style={css.lbl}>Comentarios de entrega</label>
                        <textarea
                          style={{ ...css.inp, resize: "vertical", minHeight: 56 }}
                          value={stop.entregaConfirm?.comments || stop.recepcionDetalle || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            updStop(stop.id, "entregaConfirm", {
                              ...(stop.entregaConfirm || {}),
                              comments: v,
                            });
                            updStop(stop.id, "recepcionDetalle", v);
                          }}
                          placeholder="Receptor, faltantes, daño, acceso, descarga parcial…"
                        />
                      </div>
                    </div>
                  </FormSection>

                  <FormSection
                    title="📦 Carga (paneles y accesorios)"
                    summary={`${panelCount} paneles · ${totalAcc} acc. · ${placed.length} bultos en camión`}
                    defaultOpen
                  >
                  <div style={{ marginTop: 10, marginBottom: 12 }}>
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
                              <input style={css.inp} type="number" min={0.15} max={0.6} step="0.01" value={accCfg.ancho} onChange={(e) => updAccPackage(stop.id, "ancho", Number(e.target.value))} />
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
                  </FormSection>
                  </>
                  )}
                </div>
              );
            })}

            <Btn onClick={addStop} color={T.success} style={{ width: "100%", padding: "12px 16px", fontSize: 14, borderRadius: 12 }}>
              + Agregar Parada
            </Btn>
          </div>

          <div style={{ position: "sticky", top: 16, alignSelf: "start" }}>
            <DiagramPanel
              cargo={cargo}
              truckL={truckL}
              remitoNumero={info.numero}
              info={info}
              freeDragEnabled={freeDragEnabled}
              freeDragCount={freeDragCount}
              onFreeDragEnd={handleFreeDragEnd}
              onGroupDragEnd={handleGroupDragEnd}
              onClearFreeDrag={handleClearFreeDrag}
              onToggleFreeDrag={handleToggleFreeDrag}
              multiSelectKeys={multiSelectKeys}
              onMultiSelectChange={setMultiSelectKeys}
              onBlocked={(msg) => setAutoLoadMsg(msg || BURIED_TOAST_ES)}
              onUnloadTruck={handleUnloadTruckToYard}
              yardMode={yardMode}
              loadWarnings={loadWarnings}
              stops={stops}
              onForcePackageRow={forcePackageRow}
              onForcePackageStack={forcePackageStack}
              onUpdateStop={updStop}
            />
            <div style={{ ...css.card, padding: 14, marginTop: 12 }}>
              <div
                style={{
                  fontSize: 12,
                  lineHeight: 1.4,
                  color: T.warning || "#b45309",
                  background: "#fff8ec",
                  border: `1px solid ${T.warning || "#f0c36e"}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  marginBottom: 10,
                  fontWeight: 600,
                }}
              >
                {PANEL_ON_PROFILE_RULE_ES}
              </div>
              <PackageLayoutList
                placed={cargo.placed}
                counts={packageBultoCounts(cargo.placed)}
                manualKeys={manualPkgOrderKeys}
                onReorder={reorderPackages}
                onForceRow={forcePackageRow}
              />
            </div>
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

      <EnviosDraftBrowser
        open={draftBrowserOpen}
        token={enviosAuthToken()}
        onClose={() => setDraftBrowserOpen(false)}
        onLoad={async (draftId) => {
          setDraftBrowserOpen(false);
          if (draftId) {
            const prev = info.numero;
            if (draftId && draftId !== prev) {
              setInfo((i) => ({ ...i, numero: draftId }));
            }
            // load uses info.numero — set then call after paint
            queueMicrotask(() => {
              if (draftId !== info.numero) {
                // force load by temporary set + fetch
                (async () => {
                  const token = enviosAuthToken();
                  if (!token) return;
                  setCloudSyncBusy(true);
                  try {
                    const base = getCalcApiBase();
                    const res = await fetch(`${base}/api/envios/drafts/${encodeURIComponent(draftId)}`, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    const j = await res.json().catch(() => ({}));
                    if (!res.ok || j.ok === false) throw new Error(j.error || res.statusText);
                    const parsed = parseEnviosDraftPayload(j.draft?.payload);
                    if (!parsed.ok) throw new Error(parsed.error);
                    const p = parsed.payload;
                    if (p.info) setInfo((prevI) => ({ ...prevI, ...p.info }));
                    if (Array.isArray(p.stops)) {
                      setStops(
                        p.stops.map((stop, index) => ({
                          ...mkStop(index),
                          ...stop,
                          orderId: stop.orderId ?? "",
                          pickupId: stop.pickupId ?? "",
                          geo: stop.geo ?? null,
                          checks: { ...mkStop(index).checks, ...(stop.checks || {}) },
                          accPackage: buildAccessoryPackageConfig({ ...mkStop(index), ...stop }, p.accProfiles || {}),
                        })),
                      );
                    }
                    if (p.truckL) setTruckL(p.truckL);
                    if (p.distributionMode) setDistributionMode(p.distributionMode);
                    if (p.cargoLayoutMode === "manual" || p.cargoLayoutMode === "auto") setCargoLayoutMode(p.cargoLayoutMode);
                    if (Array.isArray(p.manualPkgOrderKeys)) setManualPkgOrderKeys(p.manualPkgOrderKeys);
                    if (p.rowOverrides) setRowOverrides(p.rowOverrides);
                    if (p.freePositions && typeof p.freePositions === "object") {
                      setFreePositions(normalizeFreePositionsMap(p.freePositions));
                    }
                    if (p.freeDragEnabled === true) setFreeDragEnabled(true);
                    setCloudMeta({
                      id: j.draft?.id || draftId,
                      revision: j.draft?.revision,
                      updatedAt: j.draft?.updatedAt,
                      status: "saved",
                    });
                    setAutoLoadMsg(`Nube: cargado ${draftId}`);
                  } catch (e) {
                    setAutoLoadMsg(`Nube: ${e.message}`);
                  } finally {
                    setCloudSyncBusy(false);
                  }
                })();
              } else {
                loadDraftFromCloud();
              }
            });
          }
        }}
      />
    </div>
  );
}
