// ═══════════════════════════════════════════════════════════════════════════
// src/utils/quotationViews.js
// Generadores de HTML para salidas de cotización: Cotización completa,
// Hoja Visual Cliente, Costeo Interno, y helpers de PDF/SVG.
// Extraído de PanelinCalculadoraV3.jsx para uso compartido entre componentes.
//
// Previews HTML editables: npm run quotation-preview:render → public/quotation-preview/
// (datos de ejemplo: src/utils/quotationPreviewSampleData.js)
// ═══════════════════════════════════════════════════════════════════════════

import { BORDER_OPTIONS } from "../data/constants.js";
import { COMPANY, buildLogo } from "./helpers.js";
import { zonasToPlantRectsWithAutoGap, formatZonaDisplayTitle } from "./roofLateralAnnexLayout.js";
import { findEncounters, encounterPairKey } from "./roofPlanGeometry.js";
import { buildZoneBorderExteriorLines } from "./roofPlanEdgeSegments.js";
import { buildAnchoStripsPlanta } from "./roofPanelStripsPlanta.js";
import { normalizeEncounter } from "./roofEncounterModel.js";

export const fmtPrice = n => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Etiqueta legible para una opción de borde por su id. */
export function borderOptionLabel(side, id) {
  const opts = BORDER_OPTIONS[side] || [];
  const hit = opts.find((o) => o.id === id);
  return hit ? hit.label : id || "—";
}

/** Resuelve los objetos paneles techo/pared desde results según escenario. */
export function resolveRoofWallPaneles(scenario, results) {
  if (!results || results.error) return { roof: null, wall: null };
  if (scenario === "solo_techo") return { roof: results.paneles, wall: null };
  if (scenario === "solo_fachada") return { roof: null, wall: results.paneles };
  if (scenario === "techo_fachada") return { roof: results.paneles, wall: results.paredResult?.paneles || null };
  if (scenario === "camara_frig") return { roof: results.techoResult?.paneles || null, wall: results.paneles };
  return { roof: null, wall: null };
}

/**
 * Construye el payload para la página 2 del PDF (diagramas + resumen).
 * Retorna null para presupuesto_libre o sin resultados.
 */
export function buildPdfAppendixPayload({
  scenario,
  scenarioDef,
  vis,
  techo,
  pared,
  camara,
  results,
  grandTotal,
  kpiArea,
  kpiPaneles,
  kpiApoyos,
  kpiFij,
  PANELS_TECHO,
  PANELS_PARED,
}) {
  if (scenario === "presupuesto_libre" || !results || results.error || !scenarioDef || scenarioDef.isLibre) return null;
  const { roof, wall } = resolveRoofWallPaneles(scenario, results);
  const roofFam = PANELS_TECHO[techo.familia];
  const wallFam = PANELS_PARED[pared.familia];
  /** Techo multi-zona: `techo.largo` suele ir vacío; derivar de zonas o de área/ancho útil. */
  const resolveRoofLargoM = () => {
    const direct = Number(techo.largo);
    if (direct > 0) return direct;
    const zonas = Array.isArray(techo.zonas) ? techo.zonas : [];
    if (zonas.length > 0) {
      const maxL = Math.max(0, ...zonas.map((z) => Number(z?.largo) || 0));
      if (maxL > 0) return maxL;
    }
    const au = Number(roof?.anchoTotal) || 0;
    const area = Number(roof?.areaTotal ?? roof?.areaNeta) || 0;
    if (au > 0 && area > 0) return area / au;
    return 0;
  };
  let roofBlock = null;
  if (roof && roofFam && scenarioDef.hasTecho && techo.familia && techo.espesor) {
    roofBlock = {
      largo: resolveRoofLargoM(),
      ancho: Number(techo.ancho) || 0,
      anchoTotal: roof.anchoTotal,
      cantPaneles: roof.cantPaneles,
      au: roofFam.au,
      label: `${roofFam.label} ${techo.espesor}mm`,
    };
  }
  let wallBlock = null;
  const wallAlto = scenario === "camara_frig" ? Number(camara?.alto_int) || 0 : Number(pared.alto) || 0;
  const wallPerim = scenario === "camara_frig"
    ? 2 * ((Number(camara?.largo_int) || 0) + (Number(camara?.ancho_int) || 0))
    : Number(pared.perimetro) || 0;
  if (wall && wallFam && scenarioDef.hasPared && pared.familia && pared.espesor) {
    wallBlock = {
      alto: wallAlto,
      perimetro: wallPerim,
      cantPaneles: wall.cantPaneles,
      au: wallFam.au,
      area: wall.areaNeta ?? wall.areaTotal,
      label: `${wallFam.label} ${pared.espesor}mm`,
    };
  }
  const borderExtras = [];
  if (vis.canalGot && techo.opciones?.inclCanalon) borderExtras.push("Canalón");
  if (vis.canalGot && techo.opciones?.inclGotSup) borderExtras.push("Gotero superior");

  // Gap A — derive tipoAguas from per-zone dosAguas flags (same logic as derivedTipoAguas
  // in the component; techo.tipoAguas field is @deprecated and stored as "" in saved state).
  const validZonasArr = Array.isArray(techo.zonas) ? techo.zonas : [];
  const tipoAguasDerived = validZonasArr
    .filter(z => !Number.isFinite(Number(z?.preview?.attachParentGi)) || Number(z?.preview?.attachParentGi) < 0)
    .some(z => z?.dosAguas)
    ? "dos_aguas" : "una_agua";
  const is2A = tipoAguasDerived === "dos_aguas";

  // Gap B — per-zone roofBlocks for individual strip diagrams.
  // Reconstructed from zone dimensions + panelAu (no access to per-zone BOM results here).
  const au = roofFam?.au || 0;
  const panelLabel = (roofFam && techo.familia && techo.espesor)
    ? `${roofFam.label} ${techo.espesor}mm` : null;
  const zonaRoofBlocks = (roofFam && scenarioDef.hasTecho && panelLabel && au > 0)
    ? validZonasArr
        .filter(z => z?.largo > 0 && z?.ancho > 0)
        .map((z) => {
          const anchoPlanta = is2A ? z.ancho / 2 : z.ancho;
          const n = Math.max(1, Math.ceil(anchoPlanta / au - 1e-9));
          return { largo: z.largo, ancho: anchoPlanta, anchoTotal: anchoPlanta, cantPaneles: n, au, label: panelLabel };
        })
    : null;

  // Gap B (fallback) — keep the merged roofBlock for single-zone or legacy paths.
  const effectiveRoofBlocks = (zonaRoofBlocks && zonaRoofBlocks.length > 0)
    ? zonaRoofBlocks
    : (roofBlock ? [roofBlock] : []);

  // encounterByPair stored per-zone: zonas[low].preview.encounterByPair[pairKey]
  const encounterByPairMerged = {};
  for (const z of validZonasArr) {
    const ebp = z?.preview?.encounterByPair;
    if (ebp && typeof ebp === "object") Object.assign(encounterByPairMerged, ebp);
  }

  return {
    scenarioLabel: { solo_techo: "Techo", solo_fachada: "Fachada", techo_fachada: "Techo + Fachada", camara_frig: "Cámara Frigorífica", presupuesto_libre: "Presupuesto libre" }[scenario] || scenario,
    showBorders: !!vis.borders,
    borders: techo.borders,
    borderExtras,
    roofBlock,
    roofBlocks: effectiveRoofBlocks,
    wallBlock,
    zonas: validZonasArr,
    tipoAguas: tipoAguasDerived,
    panelAu: au,
    encounterByPair: encounterByPairMerged,
    globalBorders: techo.borders && typeof techo.borders === "object" ? techo.borders : {},
    kpi: {
      area: kpiArea,
      paneles: kpiPaneles,
      apoyosOrEsq: kpiApoyos,
      ptsFij: kpiFij,
      useApoyosLabel: !!vis.autoportancia,
    },
    totals: grandTotal,
  };
}

/** Diagrama SVG de paneles de techo en planta. */
export function svgTechoStrip(roofBlock) {
  const { largo, anchoTotal, cantPaneles, au } = roofBlock;
  const n = Math.max(1, Math.min(40, Number(cantPaneles) || 1));
  const vW = 1000;
  const vH = 480;
  const capH = 40;
  const stripe = vW / n;
  let rects = "";
  for (let i = 0; i < n; i += 1) {
    const x = +(i * stripe + 0.5).toFixed(2);
    const sw = +(Math.max(stripe - 1.5, 1)).toFixed(2);
    const fill = i % 2 ? "#E8EEF5" : "#F5F8FC";
    rects += `<rect x="${x}" y="0.5" width="${sw}" height="${vH - 1}" fill="${fill}" stroke="#003366" stroke-width="1.2"/>`;
  }
  const totalH = vH + capH;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 ${vW} ${totalH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Esquema techo" style="display:block"><rect x="0" y="0" width="${vW}" height="${vH}" fill="none" stroke="#ccc" stroke-width="1"/>${rects}<text x="6" y="${vH + 28}" font-size="24" fill="#444">Largo ${Number(largo).toFixed(2)} m · Ancho útil ${Number(anchoTotal).toFixed(2)} m · ${n} paneles × AU ${au} m</text></svg>`;
}

/** Diagrama SVG de paneles de pared/cerramiento. */
export function svgParedStrip(wallBlock) {
  const { alto, perimetro, cantPaneles, au } = wallBlock;
  const n = Math.max(1, Math.min(40, Number(cantPaneles) || 1));
  const vW = 1000;
  const vH = 200;
  const capH = 40;
  const stripe = vW / n;
  let rects = "";
  for (let i = 0; i < n; i += 1) {
    const x = +(i * stripe + 0.5).toFixed(2);
    const sw = +(Math.max(stripe - 1.5, 1)).toFixed(2);
    const fill = i % 2 ? "#E8EEF5" : "#F5F8FC";
    rects += `<rect x="${x}" y="0.5" width="${sw}" height="${vH - 1}" fill="${fill}" stroke="#003366" stroke-width="1.2"/>`;
  }
  const totalH = vH + capH;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 ${vW} ${totalH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Esquema fachada" style="display:block"><rect x="0" y="0" width="${vW}" height="${vH}" fill="none" stroke="#ccc" stroke-width="1"/>${rects}<text x="6" y="${vH + 28}" font-size="18" fill="#444">Alto ${Number(alto).toFixed(2)} m · Perímetro ${Number(perimetro).toFixed(2)} m · ${n} paneles × AU ${au} m</text></svg>`;
}

/**
 * Plano en planta SVG — siempre vectorial, siempre nítido en PDF.
 * Cuando zonas[] está disponible usa el motor geométrico completo (posiciones reales,
 * encuentros semánticos, juntas de panel, flechas de pendiente).
 * Fallback a layout simple cuando solo hay roofBlocks (legacy).
 *
 * @param {object[]} roofBlocks — bloques simplificados (fallback)
 * @param {object[]} [zonas]    — techo.zonas con preview.x/y (render geométrico)
 * @param {string}  [tipoAguas] — "una_agua" | "dos_aguas"
 * @param {object}  [encounterByPair] — techo.preview.encounterByPair
 * @param {number}  [panelAu]   — ancho útil del panel en metros
 */
export function svgFloorPlan(roofBlocks, zonas, tipoAguas = "una_agua", encounterByPair = {}, panelAu = 0, globalBorders = {}) {
  // Geometric path: requires valid zonas
  if (Array.isArray(zonas) && zonas.some(z => z?.largo > 0 && z?.ancho > 0)) {
    try {
      return _svgFloorPlanGeometric(zonas, tipoAguas, encounterByPair, panelAu, globalBorders);
    } catch { /* fall through to legacy */ }
  }
  // Legacy path: simple side-by-side blocks
  if (!Array.isArray(roofBlocks) || roofBlocks.length === 0) return "";
  const blocks = roofBlocks.filter(rb => (rb.anchoTotal || rb.ancho || 0) > 0 && (rb.largo || 0) > 0);
  if (!blocks.length) return "";
  return _svgFloorPlanLegacy(blocks);
}

function _escSvg(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function _fmtM(n) {
  const v = Number(n);
  return Math.abs(v - Math.round(v)) < 1e-4 ? `${Math.round(v)} m` : `${v.toFixed(2)} m`;
}

function _fmtDimLabel(h, w) {
  const fmt = x => Math.abs(x - Math.round(x)) < 1e-4 ? String(Math.round(x)) : Number(x).toFixed(2).replace(/\.?0+$/, "");
  return `${fmt(h)} × ${fmt(w)} m`;
}

/** Shortened zone title for small zones in the floor plan. */
function _fpZoneTitle(zonas, gi, rhPx) {
  const full = formatZonaDisplayTitle(zonas, gi);
  if (rhPx >= 58 || full.length <= 20) return full;
  // "Zona N · extensión lateral (2ª en cadena)" → "Z.N ext.lat.#2"
  const m = full.match(/^Zona\s+(\d+)\s+·\s+extensión lateral(?:\s+\((\d+))?/);
  if (m) return m[2] ? `Z${m[1]} ext.lat.#${m[2]}` : `Z${m[1]} ext.lat.`;
  return full.length > 20 ? full.slice(0, 19) + "…" : full;
}

/** Determine the semantic side of an exterior segment relative to its zone rect. */
function _segSide(seg, r) {
  const EPS = 0.01;
  if (Math.abs(seg.y1 - seg.y2) < EPS) {
    if (Math.abs(seg.y1 - r.y) < EPS) return "fondo";
    if (Math.abs(seg.y1 - (r.y + r.h)) < EPS) return "frente";
  } else {
    if (Math.abs(seg.x1 - r.x) < EPS) return "latIzq";
    if (Math.abs(seg.x1 - (r.x + r.w)) < EPS) return "latDer";
  }
  return null;
}

// Border-type color coding (matches RoofPreview semantic colors)
const _BORDER_COLOR = {
  gotero_frontal: "#0ea5e9", gotero_frontal_greca: "#0ea5e9",
  gotero_lateral: "#0ea5e9", gotero_lateral_camara: "#06b6d4",
  babeta_adosar: "#8b5cf6", babeta_empotrar: "#7c3aed",
  canalon: "#0284c7", cumbrera: "#3b82f6", pretil: "#f97316",
};
const _BORDER_ABBREV = {
  gotero_frontal: "Gotero", gotero_frontal_greca: "Greca",
  gotero_lateral: "Got.lat.", gotero_lateral_camara: "Cámara",
  babeta_adosar: "Bab.↗", babeta_empotrar: "Bab.↙",
  canalon: "Canalón", cumbrera: "Cumbrera", pretil: "Pretil",
};

function _svgFloorPlanGeometric(zonas, tipoAguas, encounterByPair, panelAu, globalBorders = {}) {
  // ── Geometry ──────────────────────────────────────────────────────────────
  const rects = zonasToPlantRectsWithAutoGap(zonas, tipoAguas);
  if (!rects.length) return "";

  const encounters  = findEncounters(rects);
  const extLines    = buildZoneBorderExteriorLines(rects, zonas);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rects) {
    if (r.x       < minX) minX = r.x;
    if (r.y       < minY) minY = r.y;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  const bW = maxX - minX;
  const bH = maxY - minY;
  if (!(bW > 0) || !(bH > 0)) return "";

  // ── Viewport ──────────────────────────────────────────────────────────────
  const VW     = 1000;
  const PAD_L  = 78;   // Y-axis labels
  const PAD_R  = 92;   // right-side height dim + title block
  const PAD_T  = 38;
  const PAD_B  = 112;  // X dims + span + legend + scale bar
  const DRAW_W = VW - PAD_L - PAD_R;
  const DRAW_H_MAX = 480;

  const scale  = Math.min(DRAW_W / bW, DRAW_H_MAX / bH);
  const DRAW_H = bH * scale;
  const SVG_H  = Math.ceil(PAD_T + DRAW_H + PAD_B);

  const DX1 = PAD_L;
  const DX2 = PAD_L + DRAW_W;
  const DY1 = PAD_T;
  const DY2 = PAD_T + DRAW_H;

  const sx = m => DX1 + (m - minX) * scale;
  const sy = m => DY1 + (m - minY) * scale;

  // ── Design tokens ─────────────────────────────────────────────────────────
  const C_BG         = "#F8FAFC";
  const C_DRAW_BG    = "#FFFFFF";
  const C_BORDER     = "#1e3a5f";
  const C_PANEL_EVEN = "#EBF5FC";
  const C_PANEL_ODD  = "#D6E9F8";
  const C_JOINT      = "#4A7FB5";
  const C_HATCH      = "#4A7FB5";
  const C_GRID       = "#CBD5E1";
  const C_DIM        = "#5c6470";
  const C_DIM_DARK   = "#374151";
  const C_LABEL_Z    = "#003366";
  const C_LABEL_DIM  = "#64748B";
  const C_LABEL_AREA = "#475569";
  const C_CONTINUO   = "#94A3B8";
  const C_PRETIL     = "#f97316";
  const C_CUMBRERA   = "#3b82f6";
  const C_DESNIVEL   = "#ef4444";
  const LW_BORDER    = 3.4;
  const LW_ENC       = 2.2;
  const LW_JOINT     = 0.9;
  const LW_DIM       = 1.1;

  // ── Encounter lookup ──────────────────────────────────────────────────────
  const encPairs = (encounterByPair && typeof encounterByPair === "object") ? encounterByPair : {};
  const getMode  = (a, b) => {
    const raw = encPairs[encounterPairKey(a, b)];
    return raw ? (normalizeEncounter(raw).modo || "continuo") : "continuo";
  };
  const encCol = m => ({ cumbrera: C_CUMBRERA, pretil: C_PRETIL, desnivel: C_DESNIVEL }[m] || C_CONTINUO);

  let out = "";

  // ══════════════════════════════════════════════════════════════════════════
  // ITERATION 1 — <defs>: hatch pattern + ISO closed-arrow markers
  // ══════════════════════════════════════════════════════════════════════════
  out += `<defs>
    <pattern id="fp-hatch" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
      <line x1="0" y1="10" x2="10" y2="0" stroke="${C_HATCH}" stroke-width="0.55" opacity="0.2"/>
    </pattern>
    <marker id="fp-arr" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
      <polygon points="0,0 10,3.5 0,7" fill="${C_DIM}"/>
    </marker>
    <marker id="fp-arr-r" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
      <polygon points="0,0 10,3.5 0,7" fill="${C_DIM}"/>
    </marker>
  </defs>`;

  // ── Outer + drawing area backgrounds ─────────────────────────────────────
  out += `<rect x="0" y="0" width="${VW}" height="${SVG_H}" fill="${C_BG}"/>`;
  out += `<rect x="${DX1 - 6}" y="${DY1 - 6}" width="${DRAW_W + 12}" height="${DRAW_H + 12}" fill="${C_DRAW_BG}" stroke="#E2E8F0" stroke-width="0.8" rx="2"/>`;

  // ══════════════════════════════════════════════════════════════════════════
  // ITERATION 2 — 1 m × 1 m metric grid (before fills, very subtle)
  // ══════════════════════════════════════════════════════════════════════════
  for (let gx = Math.ceil(minX); gx < maxX; gx++) {
    const gxs = sx(gx);
    if (gxs <= DX1 + 1 || gxs >= DX2 - 1) continue;
    out += `<line x1="${gxs.toFixed(1)}" y1="${DY1}" x2="${gxs.toFixed(1)}" y2="${DY2}" stroke="${C_GRID}" stroke-width="0.5" opacity="0.38"/>`;
  }
  for (let gy = Math.ceil(minY); gy < maxY; gy++) {
    const gys = sy(gy);
    if (gys <= DY1 + 1 || gys >= DY2 - 1) continue;
    out += `<line x1="${DX1}" y1="${gys.toFixed(1)}" x2="${DX2}" y2="${gys.toFixed(1)}" stroke="${C_GRID}" stroke-width="0.5" opacity="0.38"/>`;
  }

  // ── Panel strips per zone ─────────────────────────────────────────────────
  for (const r of rects) {
    const rx0 = sx(r.x);
    const ry0 = sy(r.y);
    const rw  = r.w * scale;
    const rh  = r.h * scale;

    if (panelAu > 0 && r.w > 0) {
      const strips = buildAnchoStripsPlanta(r.w, panelAu);
      for (let i = 0; i < strips.length; i++) {
        const s  = strips[i];
        const sx0 = rx0 + s.x0 * scale;
        const sw  = s.width * scale;
        out += `<rect x="${sx0.toFixed(2)}" y="${ry0.toFixed(2)}" width="${sw.toFixed(2)}" height="${rh.toFixed(2)}" fill="${i % 2 === 0 ? C_PANEL_EVEN : C_PANEL_ODD}"/>`;
      }
      for (let i = 1; i < strips.length; i++) {
        const jx = (rx0 + strips[i].x0 * scale).toFixed(2);
        out += `<line x1="${jx}" y1="${ry0.toFixed(2)}" x2="${jx}" y2="${(ry0 + rh).toFixed(2)}" stroke="${C_JOINT}" stroke-width="${LW_JOINT}" opacity="0.5"/>`;
      }
    } else {
      out += `<rect x="${rx0.toFixed(2)}" y="${ry0.toFixed(2)}" width="${rw.toFixed(2)}" height="${rh.toFixed(2)}" fill="${C_PANEL_EVEN}"/>`;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ITERATION 3 — Architectural diagonal hatch overlay (ISO roof convention)
    // ══════════════════════════════════════════════════════════════════════════
    out += `<rect x="${rx0.toFixed(2)}" y="${ry0.toFixed(2)}" width="${rw.toFixed(2)}" height="${rh.toFixed(2)}" fill="url(#fp-hatch)" pointer-events="none"/>`;
  }

  // ── Encounter lines ───────────────────────────────────────────────────────
  const usedModes  = new Set();
  const encCache   = [];
  for (const enc of encounters) {
    const [giA, giB] = enc.zoneIndices;
    const modo = getMode(giA, giB);
    if (modo !== "continuo") usedModes.add(modo);
    const col = encCol(modo);

    const ex1 = sx(enc.x1);
    const ey1 = sy(enc.y1);
    const ex2 = sx(enc.x2);
    const ey2 = sy(enc.y2);

    let dash, lw;
    if (modo === "cumbrera") { dash = "none"; lw = LW_ENC + 0.7; }
    else if (modo === "pretil")   { dash = "9,5";  lw = LW_ENC; }
    else if (modo === "desnivel") { dash = "5,3";  lw = LW_ENC; }
    else                          { dash = "7,4";  lw = LW_ENC - 0.5; }

    const da = dash === "none" ? "" : ` stroke-dasharray="${dash}"`;
    out += `<line x1="${ex1.toFixed(2)}" y1="${ey1.toFixed(2)}" x2="${ex2.toFixed(2)}" y2="${ey2.toFixed(2)}" stroke="${col}" stroke-width="${lw}" stroke-linecap="round"${da}/>`;

    if (modo === "cumbrera") {
      const off = 3;
      if (enc.orientation === "vertical") {
        out += `<line x1="${(ex1+off).toFixed(2)}" y1="${ey1.toFixed(2)}" x2="${(ex2+off).toFixed(2)}" y2="${ey2.toFixed(2)}" stroke="${C_CUMBRERA}" stroke-width="1.2" opacity="0.4"/>`;
      } else {
        out += `<line x1="${ex1.toFixed(2)}" y1="${(ey1+off).toFixed(2)}" x2="${ex2.toFixed(2)}" y2="${(ey2+off).toFixed(2)}" stroke="${C_CUMBRERA}" stroke-width="1.2" opacity="0.4"/>`;
      }
    }
    encCache.push({ enc, ex1, ey1, ex2, ey2, modo, col });
  }

  // ── Exterior zone borders ─────────────────────────────────────────────────
  for (const r of rects) {
    for (const seg of extLines[r.gi] || []) {
      out += `<line x1="${sx(seg.x1).toFixed(2)}" y1="${sy(seg.y1).toFixed(2)}" x2="${sx(seg.x2).toFixed(2)}" y2="${sy(seg.y2).toFixed(2)}" stroke="${C_BORDER}" stroke-width="${LW_BORDER}" stroke-linecap="square"/>`;
    }
  }

  // ── Gap D — Border profile stripes on exterior edges (colored inside-edge) ──
  // Merges techo-level globalBorders with per-zone preview.borders (zone wins).
  {
    const STRIPE = 5; // SVG units wide, drawn inside the zone edge
    for (const r of rects) {
      const gbl = (globalBorders && typeof globalBorders === "object") ? globalBorders : {};
      const bords = { ...gbl, ...(r.z?.preview?.borders ?? {}) };
      for (const seg of extLines[r.gi] || []) {
        const side = _segSide(seg, r);
        if (!side) continue;
        const bval = bords[side];
        if (!bval || bval === "none") continue;
        const col = _BORDER_COLOR[bval];
        if (!col) continue;
        const abbr = _BORDER_ABBREV[bval] ?? bval;
        const ax1 = sx(seg.x1);
        const ay1 = sy(seg.y1);
        const ax2 = sx(seg.x2);
        const ay2 = sy(seg.y2);
        if (side === "fondo" || side === "frente") {
          const iny  = side === "fondo" ? ay1 : ay1 - STRIPE;
          const segW = Math.abs(ax2 - ax1);
          const x0   = Math.min(ax1, ax2);
          out += `<rect x="${x0.toFixed(2)}" y="${iny.toFixed(2)}" width="${segW.toFixed(2)}" height="${STRIPE}" fill="${col}" opacity="0.5"/>`;
          out += `<text x="${(x0 + segW / 2).toFixed(1)}" y="${(iny + STRIPE / 2 + 3.5).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="7" font-weight="600" fill="white" paint-order="stroke" stroke="white" stroke-width="1.5" font-family="system-ui,sans-serif">${_escSvg(abbr)}</text>`;
        } else {
          const inx  = side === "latIzq" ? ax1 : ax1 - STRIPE;
          const segH = Math.abs(ay2 - ay1);
          const y0   = Math.min(ay1, ay2);
          const my   = (y0 + segH / 2).toFixed(1);
          const mx   = (inx + STRIPE / 2).toFixed(1);
          out += `<rect x="${inx.toFixed(2)}" y="${y0.toFixed(2)}" width="${STRIPE}" height="${segH.toFixed(2)}" fill="${col}" opacity="0.5"/>`;
          out += `<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="middle" font-size="7" font-weight="600" fill="white" paint-order="stroke" stroke="white" stroke-width="1.5" font-family="system-ui,sans-serif" transform="rotate(-90,${mx},${my})">${_escSvg(abbr)}</text>`;
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ITERATION 6 — Encounter inline labels with halo (mid-segment, rotated)
  // ══════════════════════════════════════════════════════════════════════════
  const ENC_SHORT = { pretil: "Pretil", cumbrera: "Cumbrera", desnivel: "Desnivel" };
  for (const { enc, ex1, ey1, ex2, ey2, modo, col } of encCache) {
    const label = ENC_SHORT[modo];
    if (!label) continue;
    const mx = ((ex1 + ex2) / 2).toFixed(1);
    const my = ((ey1 + ey2) / 2).toFixed(1);
    const rot = enc.orientation === "vertical" ? ` transform="rotate(-90,${mx},${my})"` : "";
    out += `<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="middle" font-size="8.5" font-weight="700" fill="white" stroke="white" stroke-width="3.5" paint-order="stroke"${rot}>${_escSvg(label)}</text>`;
    out += `<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="middle" font-size="8.5" font-weight="700" fill="${col}"${rot}>${_escSvg(label)}</text>`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ITERATION 5 — Zone labels: title + dims + area (m²) + panel count
  // ══════════════════════════════════════════════════════════════════════════
  for (const r of rects) {
    const rx0   = sx(r.x);
    const ry0   = sy(r.y);
    const rw    = r.w * scale;
    const rh    = r.h * scale;
    const cxs   = (rx0 + rw / 2).toFixed(1);
    const midY  = ry0 + rh / 2;

    const title    = _fpZoneTitle(zonas, r.gi, rh);
    const dimLabel = _fmtDimLabel(r.h, r.w);
    const fs1      = Math.min(18, Math.max(9,   rh * 0.13));
    const fs2      = Math.min(12, Math.max(7,   rh * 0.085));
    const fs3      = Math.min(10, Math.max(6.5, rh * 0.07));

    const declaredAncho = Number(r.z?.ancho) || r.w;
    const areaM2  = (r.h * declaredAncho).toFixed(2);
    const nPan    = panelAu > 0 ? Math.ceil(r.w / panelAu) : null;
    const hasExtra = rh > 72;

    const y1 = hasExtra ? midY - fs1 * 0.65 : midY - fs1 * 0.2;
    const y2 = y1 + fs1 * 0.95;
    const y3 = y2 + fs2 * 1.15;
    const y4 = y3 + fs3 * 1.25;

    out += `<text x="${cxs}" y="${y1.toFixed(1)}" text-anchor="middle" font-size="${fs1.toFixed(1)}" font-weight="800" fill="${C_LABEL_Z}" font-family="system-ui,sans-serif">${_escSvg(title)}</text>`;
    out += `<text x="${cxs}" y="${y2.toFixed(1)}" text-anchor="middle" font-size="${fs2.toFixed(1)}" fill="${C_LABEL_DIM}" font-family="system-ui,sans-serif">${_escSvg(dimLabel)}</text>`;
    if (hasExtra) {
      out += `<text x="${cxs}" y="${y3.toFixed(1)}" text-anchor="middle" font-size="${fs3.toFixed(1)}" fill="${C_LABEL_AREA}" font-family="system-ui,sans-serif">Área ${areaM2} m²</text>`;
      if (nPan) {
        out += `<text x="${cxs}" y="${y4.toFixed(1)}" text-anchor="middle" font-size="${fs3.toFixed(1)}" fill="${C_LABEL_DIM}" font-family="system-ui,sans-serif">${nPan} pan · AU ${panelAu} m</text>`;
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ITERATION 8 — Slope direction arrows with "↓ pendiente" annotation
  // ══════════════════════════════════════════════════════════════════════════
  for (const r of rects) {
    const slopeMark = r.z?.preview?.slopeMark;
    if (!slopeMark || slopeMark === "off") continue;
    const rx0   = sx(r.x);
    const ry0   = sy(r.y);
    const rw    = r.w * scale;
    const rh    = r.h * scale;
    const isPos = slopeMark === "along_largo_pos";
    const cx    = rx0 + rw * 0.76;
    const cy    = ry0 + rh / 2;
    const aLen  = Math.min(rh * 0.32, 46, rw * 0.3);
    const dy    = aLen / 2;
    const hs    = Math.min(9, aLen * 0.32);
    const y1    = cy - dy;
    const y2    = cy + dy;
    const tipY  = isPos ? y2 : y1;
    const bY    = isPos ? tipY - hs : tipY + hs;
    out += `<line x1="${cx.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${cx.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${C_DIM_DARK}" stroke-width="1.8" stroke-linecap="round" opacity="0.6"/>`;
    out += `<polygon points="${cx.toFixed(2)},${tipY.toFixed(2)} ${(cx-hs*0.6).toFixed(2)},${bY.toFixed(2)} ${(cx+hs*0.6).toFixed(2)},${bY.toFixed(2)}" fill="${C_DIM_DARK}" opacity="0.6"/>`;
    const lblY = isPos ? tipY + 11 : bY - 3;
    out += `<text x="${cx.toFixed(1)}" y="${lblY.toFixed(1)}" text-anchor="middle" font-size="7" fill="${C_DIM_DARK}" opacity="0.5" font-family="system-ui,sans-serif">${isPos ? "↓" : "↑"} pendiente</text>`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ITERATION 4 — ISO closed-arrow dimension lines (X-axis, per zone)
  // ══════════════════════════════════════════════════════════════════════════
  const baseY = DY2;
  const dimLY = baseY + 24;

  for (const r of rects) {
    const x0 = sx(r.x);
    const x1 = sx(r.x + r.w);
    const cx  = ((x0 + x1) / 2).toFixed(1);
    const dy  = baseY + 9;
    // Extension lines
    out += `<line x1="${x0.toFixed(2)}" y1="${baseY}" x2="${x0.toFixed(2)}" y2="${dy + 4}" stroke="${C_DIM}" stroke-width="0.8" opacity="0.5"/>`;
    out += `<line x1="${x1.toFixed(2)}" y1="${baseY}" x2="${x1.toFixed(2)}" y2="${dy + 4}" stroke="${C_DIM}" stroke-width="0.8" opacity="0.5"/>`;
    // Dim line with ISO arrows
    out += `<line x1="${x0.toFixed(2)}" y1="${dy}" x2="${x1.toFixed(2)}" y2="${dy}" stroke="${C_DIM}" stroke-width="${LW_DIM}" marker-start="url(#fp-arr-r)" marker-end="url(#fp-arr)"/>`;
    out += `<text x="${cx}" y="${dimLY.toFixed(1)}" text-anchor="middle" font-size="12" fill="${C_DIM}" font-family="system-ui,sans-serif">${_escSvg(_fmtM(r.w))}</text>`;
  }

  // Y-axis: leftmost column only, deduplicate heights, ISO arrows
  {
    const lx    = DX1 - 9;
    const seenH = new Set();
    for (const r of rects) {
      if (Math.abs(r.x - minX) > 0.002) continue;
      const hKey = r.h.toFixed(4);
      if (seenH.has(hKey)) continue;
      seenH.add(hKey);
      const y0 = sy(r.y);
      const y1 = sy(r.y + r.h);
      const cy = ((y0 + y1) / 2).toFixed(1);
      out += `<line x1="${lx}" y1="${y0.toFixed(2)}" x2="${lx}" y2="${y1.toFixed(2)}" stroke="${C_DIM}" stroke-width="${LW_DIM}" marker-start="url(#fp-arr-r)" marker-end="url(#fp-arr)"/>`;
      out += `<text x="${(lx - 6).toFixed(1)}" y="${cy}" dominant-baseline="middle" text-anchor="end" font-size="12" fill="${C_DIM}" font-family="system-ui,sans-serif">${_escSvg(_fmtM(r.h))}</text>`;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ITERATION 7 — Right-side total-height dimension (ISO arrows, rotated label)
  // ══════════════════════════════════════════════════════════════════════════
  {
    const rdx  = DX2 + 18;
    const ry0  = sy(minY);
    const ry1  = sy(maxY);
    const rcy  = ((ry0 + ry1) / 2).toFixed(1);
    out += `<line x1="${DX2}" y1="${ry0.toFixed(2)}" x2="${rdx + 3}" y2="${ry0.toFixed(2)}" stroke="${C_DIM}" stroke-width="0.8" opacity="0.5"/>`;
    out += `<line x1="${DX2}" y1="${ry1.toFixed(2)}" x2="${rdx + 3}" y2="${ry1.toFixed(2)}" stroke="${C_DIM}" stroke-width="0.8" opacity="0.5"/>`;
    out += `<line x1="${rdx}" y1="${ry0.toFixed(2)}" x2="${rdx}" y2="${ry1.toFixed(2)}" stroke="${C_DIM}" stroke-width="${LW_DIM}" marker-start="url(#fp-arr-r)" marker-end="url(#fp-arr)"/>`;
    out += `<text x="${(rdx + 14).toFixed(1)}" y="${rcy}" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="${C_DIM}" font-family="system-ui,sans-serif" transform="rotate(90,${(rdx+14).toFixed(1)},${rcy})">${_escSvg(_fmtM(bH))}</text>`;
  }

  // ── Orientation labels ────────────────────────────────────────────────────
  const midX = ((DX1 + DX2) / 2).toFixed(1);
  out += `<text x="${midX}" y="24" text-anchor="middle" font-size="10" fill="${C_DIM}" font-family="system-ui,sans-serif" opacity="0.6">▲ fondo</text>`;
  out += `<text x="${midX}" y="${(DY2 + 38).toFixed(1)}" text-anchor="middle" font-size="10" fill="${C_DIM}" font-family="system-ui,sans-serif" opacity="0.6">▼ frente</text>`;

  // N compass (inside draw area, top-right to avoid right margin)
  const nx = DX2 - 18;
  const ny = DY1 + 18;
  out += `<circle cx="${nx}" cy="${ny}" r="12" fill="${C_DRAW_BG}" stroke="${C_DIM}" stroke-width="0.9" opacity="0.45"/>`;
  out += `<text x="${nx}" y="${(ny + 4.5).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="${C_DIM}" font-family="system-ui,sans-serif" opacity="0.6">N</text>`;

  // Total-width span dim (multi-zone)
  if (rects.length > 1) {
    const txL = sx(minX);
    const txR = sx(maxX);
    const spY = DY2 + 52;
    out += `<line x1="${txL.toFixed(2)}" y1="${spY}" x2="${txR.toFixed(2)}" y2="${spY}" stroke="${C_DIM}" stroke-width="${LW_DIM}" opacity="0.55" marker-start="url(#fp-arr-r)" marker-end="url(#fp-arr)"/>`;
    out += `<text x="${((txL + txR) / 2).toFixed(1)}" y="${(spY + 15).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="600" fill="${C_DIM}" font-family="system-ui,sans-serif">${_escSvg(_fmtM(bW))} total</text>`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ITERATION 9 — Professional title block (bottom-right margin)
  // ══════════════════════════════════════════════════════════════════════════
  {
    const tbW = PAD_R - 12;
    const tbH = 64;
    const tbX = VW - PAD_R + 6;
    const tbY = SVG_H - tbH - 6;
    const tcx = (tbX + tbW / 2).toFixed(1);
    out += `<rect x="${tbX}" y="${tbY}" width="${tbW}" height="${tbH}" fill="${C_DRAW_BG}" stroke="${C_DIM}" stroke-width="0.8" rx="1"/>`;
    out += `<line x1="${tbX}" y1="${(tbY + 22).toFixed(2)}" x2="${tbX + tbW}" y2="${(tbY + 22).toFixed(2)}" stroke="${C_DIM}" stroke-width="0.5" opacity="0.5"/>`;
    out += `<line x1="${tbX}" y1="${(tbY + 44).toFixed(2)}" x2="${tbX + tbW}" y2="${(tbY + 44).toFixed(2)}" stroke="${C_DIM}" stroke-width="0.5" opacity="0.5"/>`;
    out += `<text x="${tcx}" y="${(tbY + 14).toFixed(1)}" text-anchor="middle" font-size="8.5" font-weight="800" fill="${C_LABEL_Z}" font-family="system-ui,sans-serif">PLANTA CUBIERTA</text>`;
    out += `<text x="${tcx}" y="${(tbY + 34).toFixed(1)}" text-anchor="middle" font-size="7" fill="${C_DIM}" font-family="system-ui,sans-serif">Vista esquemática · sin escala</text>`;
    out += `<text x="${tcx}" y="${(tbY + 56).toFixed(1)}" text-anchor="middle" font-size="7.5" font-weight="600" fill="${C_LABEL_Z}" font-family="system-ui,sans-serif">BMC Uruguay · Panelin</text>`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ITERATION 10 — ISO surveying scale bar (alternating filled segments)
  // ══════════════════════════════════════════════════════════════════════════
  {
    const barM  = scale >= 50 ? 1 : scale >= 24 ? 2 : 5;
    const barPx = barM * scale;
    const sbX2  = DX2;
    const sbX1  = sbX2 - barPx;
    const sbY   = SVG_H - 30;
    const half  = barPx / 2;
    // Alternating filled + empty halves (ISO land surveying convention)
    out += `<rect x="${sbX1.toFixed(2)}" y="${sbY - 3}" width="${half.toFixed(2)}" height="6" fill="${C_DIM_DARK}" opacity="0.75"/>`;
    out += `<rect x="${(sbX1 + half).toFixed(2)}" y="${sbY - 3}" width="${half.toFixed(2)}" height="6" fill="white" stroke="${C_DIM_DARK}" stroke-width="0.7"/>`;
    out += `<rect x="${sbX1.toFixed(2)}" y="${sbY - 3}" width="${barPx.toFixed(2)}" height="6" fill="none" stroke="${C_DIM_DARK}" stroke-width="0.9"/>`;
    out += `<text x="${sbX1.toFixed(1)}" y="${(sbY - 7)}" text-anchor="start" font-size="9" fill="${C_DIM}" font-family="system-ui,sans-serif">0</text>`;
    out += `<text x="${sbX2.toFixed(1)}" y="${(sbY - 7)}" text-anchor="end" font-size="9" fill="${C_DIM}" font-family="system-ui,sans-serif">${barM} m</text>`;
  }

  // ── Legend (encounter types present in drawing) ───────────────────────────
  const LEGEND = { pretil: ["Pretil", C_PRETIL, "8,4"], cumbrera: ["Cumbrera", C_CUMBRERA, "none"], desnivel: ["Desnivel", C_DESNIVEL, "5,3"] };
  const modesInPlan = [...usedModes].filter(m => LEGEND[m]);
  if (encounters.length > 0) {
    let lx = DX1;
    const ly = SVG_H - 28;
    out += `<line x1="${lx}" y1="${ly}" x2="${lx + 18}" y2="${ly}" stroke="${C_CONTINUO}" stroke-width="1.5" stroke-dasharray="6,4"/>`;
    out += `<text x="${lx + 24}" y="${(ly + 4).toFixed(1)}" font-size="10" fill="${C_DIM}" font-family="system-ui,sans-serif">Continuo</text>`;
    lx += 88;
    for (const modo of modesInPlan) {
      const [label, col, dash] = LEGEND[modo];
      const da = dash === "none" ? "" : ` stroke-dasharray="${dash}"`;
      out += `<line x1="${lx}" y1="${ly}" x2="${lx + 18}" y2="${ly}" stroke="${col}" stroke-width="2"${da}/>`;
      out += `<text x="${lx + 24}" y="${(ly + 4).toFixed(1)}" font-size="10" fill="${C_DIM}" font-family="system-ui,sans-serif">${label}</text>`;
      lx += 88;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 ${VW} ${SVG_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Planta 2D cubierta" style="display:block">${out}</svg>`;
}

function _svgFloorPlanLegacy(blocks) {
  const vW = 1000;
  const GAP_M = 0.5;
  const LABEL_H = 52;
  const totalW_m = blocks.reduce((s, rb) => s + (rb.anchoTotal || rb.ancho || 0), 0) + GAP_M * (blocks.length - 1);
  const scale = vW / totalW_m;
  const maxH_coord = Math.round(Math.max(...blocks.map(rb => rb.largo * scale)));
  const totalH = maxH_coord + LABEL_H;
  let inner = "";
  let curX = 0;
  blocks.forEach((rb, idx) => {
    const ancho = rb.anchoTotal || rb.ancho || 0;
    const largo = rb.largo || 0;
    const n = Math.max(1, Math.min(40, Number(rb.cantPaneles) || 1));
    const zW = Math.round(ancho * scale);
    const zH = Math.round(largo * scale);
    const zY = maxH_coord - zH;
    const stripe = zW / n;
    for (let i = 0; i < n; i++) {
      const rx = +(curX + i * stripe + 0.5).toFixed(1);
      const rw = +(Math.max(stripe - 1, 1)).toFixed(1);
      inner += `<rect x="${rx}" y="${zY}" width="${rw}" height="${zH}" fill="${i % 2 ? "#D6E9F8" : "#EBF4FC"}" stroke="#4A7FB5" stroke-width="0.8"/>`;
    }
    inner += `<rect x="${curX}" y="${zY}" width="${zW}" height="${zH}" fill="none" stroke="#003366" stroke-width="2.2"/>`;
    const cx = (curX + zW / 2).toFixed(0);
    const y1 = maxH_coord + 20;
    const y2 = maxH_coord + 37;
    if (blocks.length > 1) {
      inner += `<text x="${cx}" y="${y1}" font-size="15" font-weight="800" fill="#003366" text-anchor="middle">Z${idx + 1}</text>`;
      inner += `<text x="${cx}" y="${y2}" font-size="12" fill="#64748B" text-anchor="middle">${largo.toFixed(1)}m × ${ancho.toFixed(2)}m · ${n}p</text>`;
    } else {
      inner += `<text x="${cx}" y="${y1 + 4}" font-size="12" fill="#64748B" text-anchor="middle">${largo.toFixed(1)}m × ${ancho.toFixed(2)}m · ${n} paneles</text>`;
    }
    curX += zW + Math.round(GAP_M * scale);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 ${vW} ${totalH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Planta 2D cubierta" style="display:block">${inner}</svg>`;
}

/** Sección HTML con capturas/snapshots para incluir en PDF. */
export function buildSnapshotSectionHtml(snapshots, clientMode = false) {
  if (!snapshots || typeof snapshots !== "object") return "";
  const L = clientMode
    ? { a: "Resumen de obra (indicadores)", b: "Totales de la propuesta", c: "Esquema de bordes y accesorios", foot: "Vistas para acompañar la propuesta al cliente." }
    : { a: "Captura — KPI y alertas (calculadora)", b: "Captura — totales del presupuesto", c: "Captura — bordes y perfilería (pantalla)", foot: "Imágenes generadas automáticamente al exportar." };
  const blocks = [];
  const row = (title, dataUrl) => {
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return;
    const t = String(title).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    blocks.push(`<div style="margin-bottom:12px"><div style="font-size:9pt;font-weight:700;color:#003366;margin-bottom:4px">${t}</div><img src="${dataUrl}" style="max-width:100%;height:auto;border:1pt solid #E5E5EA;border-radius:6px;display:block" alt="" /></div>`);
  };
  row(L.a, snapshots.summary);
  row(L.b, snapshots.totals);
  row(L.c, snapshots.borders);
  // For roof plan: prefer vectorial SVG over raster PNG
  if (snapshots.roofPlan2dSvg && typeof snapshots.roofPlan2dSvg === "string") {
    const t = clientMode ? "Plano 2D de cubierta" : "Captura — plano 2D de cubierta";
    const tEsc = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    blocks.push(`<div style="margin-bottom:12px"><div style="font-size:9pt;font-weight:700;color:#003366;margin-bottom:4px">${tEsc}</div>${snapshots.roofPlan2dSvg}</div>`);
  } else {
    row(clientMode ? "Plano 2D de cubierta" : "Captura — plano 2D de cubierta", snapshots.roofPlan2d);
  }
  row(clientMode ? "Vista 3D de cubierta" : "Captura — vista 3D de cubierta", snapshots.roof3d);
  if (!blocks.length) return "";
  return `<div style="margin-bottom:14px;padding-bottom:8px;border-bottom:1pt solid #E5E5EA">${blocks.join("")}<p style="margin:6px 0 0;font-size:8pt;color:#777">${L.foot}</p></div>`;
}

/** HTML del apéndice (página 2) del PDF: diagramas SVG + KPIs + bordes. */
export function buildPdfAppendixHtml(esc, ap, snapshots = {}, clientMode = false) {
  if (!ap) return "";
  const { roofBlock, wallBlock, showBorders, borders, borderExtras, kpi, totals, scenarioLabel } = ap;
  const snapBlock = buildSnapshotSectionHtml(snapshots, clientMode);
  if (!roofBlock && !wallBlock && !showBorders) {
    const rows = [
      ["Área paneles (m²)", typeof kpi.area === "number" ? kpi.area.toFixed(1) : "—"],
      ["Cant. paneles", kpi.paneles ?? "—"],
      [kpi.useApoyosLabel ? "Apoyos" : "Esquinas", kpi.apoyosOrEsq ?? "—"],
      ["Pts. fijación", kpi.ptsFij ?? "—"],
    ];
    const rowHtml = rows.map(([k, v]) => `<tr><td style="padding:4px 8px;border:0.4pt solid #D0D0D0">${esc(k)}</td><td style="padding:4px 8px;border:0.4pt solid #D0D0D0;text-align:right;font-weight:600">${esc(String(v))}</td></tr>`).join("");
    return `<div class="pdf-page2" style="page-break-before:always;break-before:page;padding-top:8px">
<h2 class="pdf-h2" style="font-size:13pt;font-weight:800;color:#003366;margin:0 0 8px">Resumen y esquemas</h2>
<p style="margin:0 0 10px;font-size:9pt;color:#555">Escenario: <b>${esc(scenarioLabel)}</b></p>
${snapBlock}
<table style="font-size:10pt;max-width:360px;margin-bottom:12px"><tbody>${rowHtml}</tbody></table>
<div style="margin-top:8px;font-size:10pt"><b>Subtotal s/IVA</b> USD ${fmtPrice(totals.subtotalSinIVA)} · <b>IVA 22%</b> USD ${fmtPrice(totals.iva)} · <b>TOTAL</b> USD ${fmtPrice(totals.totalFinal)}</div>
</div>`;
  }
  let body = "";
  if (roofBlock) {
    body += `<div style="margin-bottom:14px"><div style="font-size:10pt;font-weight:700;color:#003366;margin-bottom:6px">Diagrama de paneles — cubierta</div><div style="font-size:8.5pt;color:#666;margin-bottom:4px">${esc(roofBlock.label)} · esquema en planta (${esc(String(roofBlock.cantPaneles))} paneles)</div>${svgTechoStrip(roofBlock)}</div>`;
  }
  if (wallBlock) {
    body += `<div style="margin-bottom:14px"><div style="font-size:10pt;font-weight:700;color:#003366;margin-bottom:6px">Diagrama de paneles — cerramiento</div><div style="font-size:8.5pt;color:#666;margin-bottom:4px">${esc(wallBlock.label)}${wallBlock.area != null ? ` · área neta ${Number(wallBlock.area).toFixed(2)} m²` : ""}</div>${svgParedStrip(wallBlock)}</div>`;
  }
  if (showBorders && borders) {
    const sides = [
      ["Fondo ▲", borderOptionLabel("fondo", borders.fondo)],
      ["Frente ▼", borderOptionLabel("frente", borders.frente)],
      ["Lateral izq. ◀", borderOptionLabel("latIzq", borders.latIzq)],
      ["Lateral der. ▶", borderOptionLabel("latDer", borders.latDer)],
    ];
    const cells = sides.map(([t, v]) => `<div style="border:0.4pt solid #D0D0D0;border-radius:4px;padding:6px 8px;background:#FAFAFA"><div style="font-size:8pt;font-weight:700;color:#003366">${esc(t)}</div><div style="font-size:9pt;margin-top:2px">${esc(v)}</div></div>`).join("");
    const extras = (borderExtras || []).length
      ? `<div style="margin-top:8px;font-size:9pt"><b>Opciones perimetrales:</b> ${esc(borderExtras.join(", "))}</div>`
      : "";
    body += `<div style="margin-bottom:14px"><div style="font-size:10pt;font-weight:700;color:#003366;margin-bottom:6px">Accesorios y perfiles de borde (cubierta)</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${cells}</div>${extras}</div>`;
  }
  const rows = [
    ["Área paneles (m²)", typeof kpi.area === "number" ? kpi.area.toFixed(1) : "—"],
    ["Cant. paneles (principal)", kpi.paneles ?? "—"],
    [kpi.useApoyosLabel ? "Apoyos / esquinas" : "Esquinas", kpi.apoyosOrEsq ?? "—"],
    ["Pts. fijación", kpi.ptsFij ?? "—"],
  ];
  const rowHtml = rows.map(([k, v]) => `<tr><td style="padding:4px 8px;border:0.4pt solid #D0D0D0">${esc(k)}</td><td style="padding:4px 8px;border:0.4pt solid #D0D0D0;text-align:right;font-weight:600">${esc(String(v))}</td></tr>`).join("");
  body += `<div style="margin-top:6px"><div style="font-size:10pt;font-weight:700;color:#003366;margin-bottom:6px">Resumen de obra</div><table style="font-size:10pt;max-width:400px;margin-bottom:10px"><tbody>${rowHtml}</tbody></table><div style="font-size:10pt"><b>Subtotal s/IVA</b> USD ${fmtPrice(totals.subtotalSinIVA)} · <b>IVA 22%</b> USD ${fmtPrice(totals.iva)} · <b>TOTAL USD</b> ${fmtPrice(totals.totalFinal)}</div></div>`;
  return `<div class="pdf-page2" style="page-break-before:always;break-before:page;padding-top:8px">
<h2 class="pdf-h2" style="font-size:13pt;font-weight:800;color:#003366;margin:0 0 8px">Paneles, accesorios y resumen</h2>
<p style="margin:0 0 12px;font-size:9pt;color:#555">Escenario: <b>${esc(scenarioLabel)}</b> · Vista esquemática para obra (no escala de plano).</p>
${snapBlock}
${body}
</div>`;
}

const PDF_PLANTA_BRAND = COMPANY.brandColor || "#003366";

/**
 * Página extra PDF (diseño hero marca + Planta en card + resumen de partidas).
 * Usada en export PDF+ cuando `includePlantaResumenPage` está activo.
 */
export function buildPdfPlantaResumenPageHtml(esc, ap, snapshots = {}, clientMode = false, quoteCtx = {}) {
  if (!ap) return "";
  const { groups = [], totals, client, project, scenarioLabel: sl } = quoteCtx;
  const scenarioLabel = sl || ap.scenarioLabel || "—";
  const { roofBlock, wallBlock, showBorders, borders, borderExtras, kpi, totals: apTotals } = ap;
  const t = totals || apTotals;
  const snaps = snapshots && typeof snapshots === "object" ? snapshots : {};
  const snapsNoRoof = { ...snaps };
  delete snapsNoRoof.roofPlan2d;
  delete snapsNoRoof.roofPlan2dSvg;
  const snapBlock = buildSnapshotSectionHtml(snapsNoRoof, clientMode);

  // Prefer vectorial SVG (serialized from React DOM) — perfect quality in PDF.
  // Fall back to rasterized PNG if SVG not available.
  const roofPlanImg = (() => {
    const wrapper = (inner) =>
      `<div style="margin-bottom:12px;padding:12px;background:#F8FAFC;border-radius:10px;border:0.5pt solid #E2E8F0;box-shadow:0 2px 10px rgba(0,51,102,0.07)">
        <div style="font-size:9.5pt;font-weight:800;color:${PDF_PLANTA_BRAND};margin-bottom:8px;letter-spacing:0.02em">Planta 2D · cubierta</div>
        ${inner}
      </div>`;
    if (snaps.roofPlan2dSvg && typeof snaps.roofPlan2dSvg === "string") {
      return wrapper(snaps.roofPlan2dSvg);
    }
    if (snaps.roofPlan2d && typeof snaps.roofPlan2d === "string" && snaps.roofPlan2d.startsWith("data:")) {
      return wrapper(`<img src="${snaps.roofPlan2d}" style="width:100%;height:auto;display:block;border-radius:6px;min-height:60px;background:#F8FAFC" alt="" />`);
    }
    return "";
  })();

  let diagrams = "";
  const roofBlocks = ap.roofBlocks && ap.roofBlocks.length > 0 ? ap.roofBlocks : (roofBlock ? [roofBlock] : []);
  if (roofBlocks.length > 0) {
    roofBlocks.forEach((rb, idx) => {
      const zoneLabel = roofBlocks.length > 1 ? `Zona ${idx + 1}` : "Esquema en planta · cubierta";
      diagrams += `<div style="margin-bottom:12px;padding:12px;background:#fff;border-radius:10px;border:0.5pt solid #E2E8F0;box-shadow:0 2px 10px rgba(0,51,102,0.06)">
      <div style="font-size:9.5pt;font-weight:800;color:${PDF_PLANTA_BRAND};margin-bottom:4px">${esc(zoneLabel)}</div>
      <div style="font-size:8pt;color:#64748B;margin-bottom:8px">${esc(rb.label)} · ${esc(String(rb.cantPaneles))} paneles</div>
      ${svgTechoStrip(rb)}
    </div>`;
    });
  }
  if (wallBlock) {
    diagrams += `<div style="margin-bottom:12px;padding:12px;background:#fff;border-radius:10px;border:0.5pt solid #E2E8F0;box-shadow:0 2px 10px rgba(0,51,102,0.06)">
      <div style="font-size:9.5pt;font-weight:800;color:${PDF_PLANTA_BRAND};margin-bottom:4px">Esquema · cerramiento</div>
      <div style="font-size:8pt;color:#64748B;margin-bottom:8px">${esc(wallBlock.label)}${wallBlock.area != null ? ` · área neta ${Number(wallBlock.area).toFixed(2)} m²` : ""}</div>
      ${svgParedStrip(wallBlock)}
    </div>`;
  }
  if (showBorders && borders) {
    const sides = [
      ["Fondo ▲", borderOptionLabel("fondo", borders.fondo)],
      ["Frente ▼", borderOptionLabel("frente", borders.frente)],
      ["Lateral izq. ◀", borderOptionLabel("latIzq", borders.latIzq)],
      ["Lateral der. ▶", borderOptionLabel("latDer", borders.latDer)],
    ];
    const allEmpty = sides.every(([, v]) => v === "—");
    if (!allEmpty) {
      const cells = sides.map(([a, b]) => `<div style="border:0.4pt solid #E2E8F0;border-radius:6px;padding:6px 8px;background:#FAFAFA"><div style="font-size:7.5pt;font-weight:700;color:${PDF_PLANTA_BRAND}">${esc(a)}</div><div style="font-size:8.5pt;margin-top:2px">${esc(b)}</div></div>`).join("");
      const extras = (borderExtras || []).length
        ? `<div style="margin-top:8px;font-size:8.5pt;color:#475467"><b>Perimetral:</b> ${esc(borderExtras.join(", "))}</div>`
        : "";
      diagrams += `<div style="margin-bottom:12px;padding:12px;background:#fff;border-radius:10px;border:0.5pt solid #E2E8F0;box-shadow:0 2px 10px rgba(0,51,102,0.06)">
      <div style="font-size:9.5pt;font-weight:800;color:${PDF_PLANTA_BRAND};margin-bottom:8px">Bordes y accesorios (cubierta)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${cells}</div>${extras}
    </div>`;
    }
  }

  const kpiChips = [
    ["Área paneles", typeof kpi.area === "number" ? `${kpi.area.toFixed(1)} m²` : "—"],
    ["Paneles", kpi.paneles ?? "—"],
    [kpi.useApoyosLabel ? "Apoyos" : "Esquinas", kpi.apoyosOrEsq ?? "—"],
    ["Pts. fijación", kpi.ptsFij ?? "—"],
  ];
  const kpiHtml = `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;page-break-inside:avoid;break-inside:avoid">${kpiChips.map(([a, b]) => `<div style="flex:1;min-width:100px;padding:8px 10px;background:#F1F5F9;border-radius:8px;border:0.5pt solid #E2E8F0"><div style="font-size:7.5pt;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.04em">${esc(a)}</div><div style="font-size:11pt;font-weight:800;color:${PDF_PLANTA_BRAND};margin-top:2px">${esc(String(b))}</div></div>`).join("")}</div>`;

  const MAX_LINES = 22;
  let lineCount = 0;
  let truncated = false;
  let compactRows = "";
  const groupList = groups || [];
  outer: for (let gi = 0; gi < groupList.length; gi += 1) {
    const g = groupList[gi];
    if (lineCount >= MAX_LINES) {
      truncated = true;
      break outer;
    }
    compactRows += `<tr style="background:#E4EDF8"><td colspan="2" style="padding:5px 8px;font-size:8.5pt;font-weight:800;color:${PDF_PLANTA_BRAND};border-left:3pt solid ${PDF_PLANTA_BRAND}">${esc(g.title)}</td></tr>`;
    lineCount += 1;
    const items = g.items || [];
    for (let ii = 0; ii < items.length; ii += 1) {
      if (lineCount >= MAX_LINES) {
        truncated = true;
        break outer;
      }
      const item = items[ii];
      const lab = String(item.label ?? "");
      const shortLabel = lab.length > 58 ? `${lab.slice(0, 55)}…` : lab;
      compactRows += `<tr><td style="padding:5px 8px;font-size:8.5pt;border-bottom:0.5pt solid #ECECEC;color:#1D1D1F">${esc(shortLabel)}</td><td style="padding:5px 8px;font-size:8.5pt;text-align:right;font-weight:700;border-bottom:0.5pt solid #ECECEC;font-variant-numeric:tabular-nums">$${fmtPrice(item.total)}</td></tr>`;
      lineCount += 1;
    }
  }
  if (truncated) {
    compactRows += `<tr><td colspan="2" style="padding:6px 8px;font-size:8pt;color:#64748B;font-style:italic">… líneas adicionales en la cotización principal</td></tr>`;
  }

  const clientLine = client && project
    ? `<div style="padding:10px 0 12px;font-size:9pt;color:#475467;border-bottom:0.5pt solid #E2E8F0;line-height:1.45">
        <b style="color:${PDF_PLANTA_BRAND}">Cliente:</b> ${esc(client.nombre)} · <b>Obra:</b> ${esc(project.descripcion)} · <b>Ref:</b> ${esc(project.refInterna)}
      </div>`
    : "";

  const hero = `<div style="background:linear-gradient(115deg, ${PDF_PLANTA_BRAND} 0%, #0a4c78 52%, #0c5a8f 100%);color:#fff;padding:16px 18px;border-radius:10px 10px 0 0;box-shadow:0 4px 14px rgba(0,51,102,0.2)">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div>
        <div style="font-size:17pt;font-weight:800;letter-spacing:0.03em">${esc(COMPANY.name)}</div>
        <div style="font-size:8.5pt;opacity:0.95;margin-top:6px;font-weight:600">Panelin · resumen visual de obra</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10pt;font-weight:800">${esc(scenarioLabel)}</div>
        <div style="font-size:8.5pt;opacity:0.9;margin-top:4px">${esc(COMPANY.website)} · ${esc(COMPANY.phone)}</div>
      </div>
    </div>
  </div>`;

  const shellOpen = `<div class="pdf-page2 pdf-planta-resumen" style="page-break-before:always;break-before:page;padding-top:6px">`;
  const shellCard = `<div style="border:0.5pt solid #E2E8F0;border-top:none;border-radius:0 0 10px 10px;padding:14px 16px 16px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,0.06)">`;

  const noDiagramFallback = !roofPlanImg && !diagrams
    ? `<div style="padding:12px;background:#FFF8ED;border-radius:8px;border:0.5pt solid #F5D78E;font-size:9pt;color:#6E4B00;margin-bottom:12px">Sin esquema de paneles en este escenario. Indicadores de obra y resumen de partidas a continuación.</div>`
    : "";

  const totalsBar = t
    ? `<div style="margin-top:14px;padding:12px 14px;background:linear-gradient(180deg,#F8FAFC 0%,#F1F5F9 100%);border-radius:10px;border:0.5pt solid #E2E8F0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;page-break-inside:avoid;break-inside:avoid">
        <div style="font-size:9pt;color:#64748B">
          <div><b style="color:${PDF_PLANTA_BRAND}">Subtotal s/IVA</b> USD ${fmtPrice(t.subtotalSinIVA)} · <b>IVA 22%</b> USD ${fmtPrice(t.iva)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:8.5pt;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.06em">Total USD</div>
          <div style="font-size:18pt;font-weight:900;color:${PDF_PLANTA_BRAND};font-variant-numeric:tabular-nums">$${fmtPrice(t.totalFinal)}</div>
        </div>
      </div>`
    : "";

  const footNote = `<p style="margin:12px 0 0;font-size:7.5pt;color:#94A3B8;line-height:1.4">Vista esquemática para obra (no escala de plano). ${clientMode ? "Propuesta comercial BMC Uruguay." : ""}</p>`;

  return `${shellOpen}${hero}${shellCard}
    ${clientLine}
    ${roofPlanImg}
    ${noDiagramFallback}
    ${diagrams}
    ${snapBlock ? `<div style="margin-bottom:12px">${snapBlock}</div>` : ""}
    ${kpiHtml}
    <div style="margin-top:4px;margin-bottom:8px;font-size:10.5pt;font-weight:900;color:${PDF_PLANTA_BRAND};letter-spacing:0.02em">Resumen de partidas</div>
    <table style="width:100%;border-collapse:collapse;font-size:9pt"><tbody>${compactRows || `<tr><td colspan="2" style="padding:8px;color:#94A3B8">Sin líneas en el presupuesto.</td></tr>`}</tbody></table>
    ${totalsBar}
    ${footNote}
  </div></div>`;
}

/**
 * Hoja visual cliente — HTML A4 imprimible.
 * No incluye SKU ni datos internos de costo.
 */
export function generateClientVisualHTML(data) {
  const {
    client, project, scenario, panel, groups, totals, appendix, snapshotImages,
    includePlantaResumenPage = true,
  } = data;
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const scenarioLabel = { solo_techo: "Techo", solo_fachada: "Fachada", techo_fachada: "Techo + Fachada", camara_frig: "Cámara Frigorífica", presupuesto_libre: "Presupuesto libre" }[scenario] || scenario;
  let tableBody = "";
  groups.forEach((g) => {
    const sub = g.items.reduce((s, i) => s + (i.total || 0), 0);
    tableBody += `<tr style="background:#EAF0F8"><td colspan="4" style="font-weight:700;padding:5px 8px;color:#003366;border-left:3pt solid #003366">&#9656; ${esc(g.title)}</td><td style="text-align:right;font-weight:700;padding:5px 8px;color:#003366">$${fmtPrice(sub)}</td></tr>`;
    g.items.forEach((item, idx) => {
      tableBody += `<tr style="background:${idx % 2 ? "#FAFAFA" : "#fff"}"><td style="padding:3px 6px">${esc(item.label)}</td><td style="text-align:right;padding:3px 6px">${typeof item.cant === "number" ? (item.cant % 1 === 0 ? item.cant : item.cant.toFixed(2)) : item.cant}</td><td style="text-align:center;padding:3px 6px">${esc(item.unidad)}</td><td style="text-align:right;padding:3px 6px">${fmtPrice(item.pu)}</td><td style="text-align:right;padding:3px 6px">$${fmtPrice(item.total)}</td></tr>`;
    });
  });
  const snaps = snapshotImages && typeof snapshotImages === "object" ? snapshotImages : {};
  let appendixHtml = "";
  if (appendix) {
    appendixHtml = includePlantaResumenPage
      ? buildPdfPlantaResumenPageHtml(esc, appendix, snaps, true, {
        groups,
        totals,
        client,
        project,
        scenarioLabel,
      })
      : buildPdfAppendixHtml(esc, appendix, snaps, true);
  }
  if (!appendixHtml && (snaps.summary || snaps.totals || snaps.borders)) {
    appendixHtml = `<div class="pdf-page2" style="page-break-before:always;break-before:page;padding-top:8px"><h2 class="pdf-h2" style="font-size:13pt;font-weight:800;color:#003366;margin:0 0 8px">Vistas de la propuesta</h2><p style="margin:0 0 12px;font-size:9pt;color:#555">Escenario: <b>${esc(scenarioLabel)}</b></p>${buildSnapshotSectionHtml(snaps, true)}</div>`;
  }
  const productoCliente = scenario === "presupuesto_libre"
    ? `Líneas cotizadas · ${esc(scenarioLabel)}`
    : `${esc(panel.label)} · ${panel.espesor}mm · Color: ${esc(panel.color)} · ${esc(scenarioLabel)}`;
  const _fpBlocks = appendix?.roofBlocks?.length > 0 ? appendix.roofBlocks : (appendix?.roofBlock ? [appendix.roofBlock] : []);
  const _fpSvg = svgFloorPlan(
    _fpBlocks,
    appendix?.zonas,
    appendix?.tipoAguas || "una_agua",
    appendix?.encounterByPair || {},
    appendix?.panelAu || 0,
    appendix?.globalBorders || {},
  );
  const floorPlanHtml = _fpSvg
    ? `<div style="margin-bottom:8px;padding:8px 10px;background:#F8FAFC;border-radius:6px;border:0.5pt solid #E2E8F0;page-break-inside:avoid;break-inside:avoid"><div style="font-size:8pt;font-weight:700;color:#003366;margin-bottom:5px">Planta 2D · cubierta</div><div style="max-height:260px;overflow:hidden">${_fpSvg}</div></div>`
    : "";
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Hoja visual cliente — BMC Uruguay</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;font-size:10pt;color:#1D1D1F;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}table{border-collapse:collapse;width:100%}th,td{border:0.4pt solid #D0D0D0}.pdf-page2{page-break-before:always;break-before:page}@media screen{html{background:#dce3ec;min-height:100%}body{max-width:794px;margin:40px auto 60px;padding:32px 36px;background:#fff;box-shadow:0 4px 28px rgba(0,0,0,0.14);border-radius:3px}.pdf-page2{margin-top:48px;padding-top:20px;border-top:2pt solid #003366}}@media print{a{color:inherit!important;text-decoration:none!important}}</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">${buildLogo()}<div style="background:#003366;color:#fff;font-size:11pt;font-weight:800;padding:4px 12px;border-radius:4px;letter-spacing:0.04em">HOJA VISUAL CLIENTE</div></div>
<div style="border-bottom:2.5pt solid #003366;margin-bottom:4px"></div>
<div style="font-size:8.5pt;color:#6E6E73;margin-bottom:8px">Propuesta comercial · bmcuruguay.com.uy · 092 663 245</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:10pt;margin-bottom:8px">
${client.nombre ? `<div><b>Cliente:</b> ${esc(client.nombre)}</div>` : "<div></div>"}<div><b>Fecha:</b> ${esc(project.fecha)}</div>
${project.descripcion ? `<div><b>Obra:</b> ${esc(project.descripcion)}</div>` : "<div></div>"}<div><b>Ref:</b> ${esc(project.refInterna)}</div>
${client.telefono ? `<div><b>Tel:</b> ${esc(client.telefono)}</div>` : "<div></div>"}${client.direccion ? `<div><b>Dir:</b> ${esc(client.direccion)}</div>` : "<div></div>"}
</div>
<div style="background:#F0F4F8;padding:6px 10px;border-radius:4px;margin-bottom:6px"><b style="color:#003366">Producto / alcance:</b> ${productoCliente}</div>
${floorPlanHtml}
<table style="font-size:9pt;margin-bottom:6px"><thead><tr style="background:#EDEDED;font-weight:700"><th style="text-align:left;width:42%;padding:3px 6px">Descripción</th><th style="text-align:right;width:12%;padding:3px 6px">Cant.</th><th style="text-align:center;width:10%;padding:3px 6px">Unid.</th><th style="text-align:right;width:16%;padding:3px 6px">P.U. USD</th><th style="text-align:right;width:20%;padding:3px 6px">Total USD</th></tr></thead><tbody>${tableBody}</tbody></table>
<div style="display:flex;justify-content:flex-end;margin-bottom:6px"><table style="min-width:260px;font-size:10pt"><tr><td style="padding:2px 8px">Subtotal s/IVA</td><td style="text-align:right;padding:2px 8px">$${fmtPrice(totals.subtotalSinIVA)}</td></tr><tr><td style="padding:2px 8px">IVA 22%</td><td style="text-align:right;padding:2px 8px">$${fmtPrice(totals.iva)}</td></tr><tr style="border-top:1pt solid #000;font-size:14pt;font-weight:800"><td style="padding:2px 8px">TOTAL USD</td><td style="text-align:right;color:#003366;padding:2px 8px">$${fmtPrice(totals.totalFinal)}</td></tr></table></div>
<div style="font-size:8pt;line-height:1.4;margin-bottom:6px"><b>Condiciones comerciales:</b><ul style="margin:0;padding-left:14px"><li style="font-weight:700">Fabricación y entrega 10 a 45 días (depende producción).</li><li style="color:#FF3B30;font-weight:600">Oferta válida 10 días.</li><li style="font-weight:700;color:#FF3B30">Seña 60% al confirmar. Saldo 40% previo a retiro de fábrica.</li><li>Precios en USD; IVA incluido en el total indicado.</li></ul></div>
<table style="font-size:8.5pt;margin-top:6px"><thead><tr><th colspan="2" style="background:#EDEDED;font-weight:700;text-align:left;padding:3px 8px">Depósito Bancario</th></tr></thead><tbody><tr><td style="padding:3px 8px">Titular: <b>Metalog SAS</b></td><td style="padding:3px 8px">RUT: 120403430012</td></tr><tr><td style="padding:3px 8px">BROU · Cta. Dólares: <b>110520638-00002</b></td><td style="padding:3px 8px">Consultas: <b>092 663 245</b></td></tr></tbody></table>
${appendixHtml}
</body></html>`;
}

/** Costeo interno — HTML A4 imprimible con márgenes. No enviar al cliente. */
export function generateCosteoHTML(data) {
  const { client, project, listaLabel, report } = data;
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let body = "";
  report.rows.forEach((r, idx) => {
    const cU = r.unitCost != null ? fmtPrice(r.unitCost) : "—";
    const cT = r.costTotal != null ? fmtPrice(r.costTotal) : "—";
    const mP = r.marginPct != null ? `${r.marginPct}%` : "—";
    const mU = r.margin != null ? fmtPrice(r.margin) : "—";
    const mark = r.isFlete && report.fleteMissingCost ? " *" : "";
    body += `<tr style="background:${idx % 2 ? "#FAFAFA" : "#fff"}"><td style="padding:3px 5px;font-size:8pt;color:#555">${esc(r.group)}</td><td style="padding:3px 6px">${esc(r.label)}${mark}</td><td style="text-align:center;padding:3px 6px;font-size:8pt">${esc(r.sku)}</td><td style="text-align:right;padding:3px 6px">${typeof r.cant === "number" ? (r.cant % 1 === 0 ? r.cant : r.cant.toFixed(2)) : r.cant}</td><td style="text-align:center;padding:3px 6px;font-size:8pt">${esc(r.unidad)}</td><td style="text-align:right;padding:3px 6px">${cU}</td><td style="text-align:right;padding:3px 6px">${cT}</td><td style="text-align:right;padding:3px 6px">${fmtPrice(r.pu)}</td><td style="text-align:right;padding:3px 6px">$${fmtPrice(r.saleTotal)}</td><td style="text-align:right;padding:3px 6px">${mP}</td><td style="text-align:right;padding:3px 6px;color:#1B7A2E;font-weight:600">${mU}</td></tr>`;
  });
  const foot = report.fleteMissingCost
    ? `<div style="margin-top:10px;padding:8px 10px;background:#FFF5E6;border:0.5pt solid #FF9F0A;border-radius:4px;font-size:9pt;color:#6E4B00"><b>Flete:</b> no se ingresó <b>costo de flete</b> (interno). El <b>precio de venta del flete no se incluye</b> en el <b>margen consolidado</b> hasta cargar ese costo. La línea aparece marcada con *.</div>`
    : "";
  const marginPctStr = report.totalMarginPct != null ? `${report.totalMarginPct}%` : "—";
  const coverageStr = report.coveredSalePct != null ? `${report.coveredSalePct}%` : "—";
  const groupSummaryRows = (report.byGroup || []).map((g, idx) => {
    const bg = idx % 2 ? "#FAFAFA" : "#fff";
    const margin = g.marginPct != null ? `${g.marginPct}%` : "—";
    return `<tr style="background:${bg}">
      <td style="padding:5px 6px;border:0.4pt solid #ccc;font-weight:600">${esc(g.group)}</td>
      <td style="padding:5px 6px;border:0.4pt solid #ccc;text-align:right">${g.items}</td>
      <td style="padding:5px 6px;border:0.4pt solid #ccc;text-align:right">$${fmtPrice(g.saleTotal)}</td>
      <td style="padding:5px 6px;border:0.4pt solid #ccc;text-align:right">$${fmtPrice(g.costTotal)}</td>
      <td style="padding:5px 6px;border:0.4pt solid #ccc;text-align:right;color:#1B7A2E;font-weight:700">$${fmtPrice(g.marginTotal)}</td>
      <td style="padding:5px 6px;border:0.4pt solid #ccc;text-align:right">${margin}</td>
      <td style="padding:5px 6px;border:0.4pt solid #ccc;text-align:right">${g.missingCostItems}</td>
    </tr>`;
  }).join("");
  const missingRows = (report.missingCostRows || []).map((r, idx) => {
    const bg = idx % 2 ? "#FFF8ED" : "#FFFDF7";
    return `<tr style="background:${bg}">
      <td style="padding:5px 6px;border:0.4pt solid #ccc">${esc(r.group)}</td>
      <td style="padding:5px 6px;border:0.4pt solid #ccc">${esc(r.label)}</td>
      <td style="padding:5px 6px;border:0.4pt solid #ccc;text-align:center">${esc(r.sku)}</td>
      <td style="padding:5px 6px;border:0.4pt solid #ccc;text-align:right">${typeof r.cant === "number" ? (r.cant % 1 === 0 ? r.cant : r.cant.toFixed(2)) : r.cant}</td>
      <td style="padding:5px 6px;border:0.4pt solid #ccc;text-align:center">${esc(r.unidad)}</td>
      <td style="padding:5px 6px;border:0.4pt solid #ccc;text-align:right">$${fmtPrice(r.saleTotal)}</td>
    </tr>`;
  }).join("");
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Costeo interno — BMC</title><style>
  @page{size:A4 landscape;margin:10mm}
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;font-size:9pt;color:#1D1D1F;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  table{width:100%;border-collapse:collapse}
  .card-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0 14px}
  .card{border:0.5pt solid #D7DEE8;border-radius:8px;padding:10px 12px;background:#F8FAFC}
  .card .k{font-size:8pt;color:#667085;text-transform:uppercase;letter-spacing:.05em;font-weight:700}
  .card .v{font-size:15pt;color:#003366;font-weight:800;margin-top:4px}
  .section-title{font-size:10pt;font-weight:800;color:#003366;margin:14px 0 8px}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><div style="font-size:18pt;font-weight:800;color:#003366">BMC Uruguay</div><div style="font-size:12pt;font-weight:800">COSTEO INTERNO · ANÁLISIS A4</div></div>
<div style="font-size:8pt;color:#666;margin-bottom:10px">Lista activa cotización: <b>${esc(listaLabel)}</b> · Uso administración · No enviar al cliente</div>
<div style="display:grid;grid-template-columns:1.3fr 1fr 1fr 1.6fr;gap:8px 14px;font-size:9pt;margin-bottom:8px;padding:10px 12px;background:#F7F8FA;border:0.5pt solid #E5E7EB;border-radius:8px">
  <div><b>Cliente:</b> ${esc(client.nombre)}</div>
  <div><b>Ref:</b> ${esc(project.refInterna)}</div>
  <div><b>Fecha:</b> ${esc(project.fecha)}</div>
  <div><b>Obra:</b> ${esc(project.descripcion)}</div>
</div>
<div class="card-grid">
  <div class="card"><div class="k">Venta total cotizada</div><div class="v">$${fmtPrice(report.sumSaleAll)}</div></div>
  <div class="card"><div class="k">Costo conocido total</div><div class="v">$${fmtPrice(report.sumCostAll)}</div></div>
  <div class="card"><div class="k">Margen consolidado</div><div class="v">$${fmtPrice(report.totalMargin)}</div></div>
  <div class="card"><div class="k">Cobertura del margen</div><div class="v">${coverageStr}</div></div>
</div>
<div style="display:grid;grid-template-columns:1.15fr .85fr;gap:12px;align-items:start">
  <div>
    <div class="section-title">Analítica por grupo</div>
    <table style="font-size:8.4pt"><thead><tr style="background:#EDEDED;font-weight:700">
      <th style="text-align:left;padding:5px 6px;border:0.4pt solid #ccc">Grupo</th>
      <th style="text-align:right;padding:5px 6px;border:0.4pt solid #ccc">Items</th>
      <th style="text-align:right;padding:5px 6px;border:0.4pt solid #ccc">Venta</th>
      <th style="text-align:right;padding:5px 6px;border:0.4pt solid #ccc">Costo</th>
      <th style="text-align:right;padding:5px 6px;border:0.4pt solid #ccc">Margen</th>
      <th style="text-align:right;padding:5px 6px;border:0.4pt solid #ccc">% margen</th>
      <th style="text-align:right;padding:5px 6px;border:0.4pt solid #ccc">Sin costo</th>
    </tr></thead><tbody>${groupSummaryRows || `<tr><td colspan="7" style="padding:8px;border:0.4pt solid #ccc;text-align:center;color:#667085">Sin datos</td></tr>`}</tbody></table>
    <div class="section-title">Detalle por línea</div>
    <table style="width:100%;border-collapse:collapse;font-size:7.8pt"><thead><tr style="background:#EDEDED;font-weight:700"><th style="text-align:left;padding:4px 5px;border:0.4pt solid #ccc">Grupo</th><th style="text-align:left;padding:4px 5px;border:0.4pt solid #ccc">Descripción</th><th style="text-align:center;padding:4px 5px;border:0.4pt solid #ccc">SKU</th><th style="text-align:right;padding:4px 5px;border:0.4pt solid #ccc">Cant.</th><th style="text-align:center;padding:4px 5px;border:0.4pt solid #ccc">Unid.</th><th style="text-align:right;padding:4px 5px;border:0.4pt solid #ccc">C.U. costo</th><th style="text-align:right;padding:4px 5px;border:0.4pt solid #ccc">Costo total</th><th style="text-align:right;padding:4px 5px;border:0.4pt solid #ccc">P.U. venta</th><th style="text-align:right;padding:4px 5px;border:0.4pt solid #ccc">Venta total</th><th style="text-align:right;padding:4px 5px;border:0.4pt solid #ccc">% margen</th><th style="text-align:right;padding:4px 5px;border:0.4pt solid #ccc">Ganancia</th></tr></thead><tbody>${body}</tbody></table>
  </div>
  <div>
    <div class="section-title">Resumen consolidado</div>
    <table style="font-size:9pt;border-collapse:collapse"><tr><td style="padding:5px 8px;border:0.4pt solid #ccc"><b>Venta incluida en margen</b></td><td style="text-align:right;padding:5px 8px;border:0.4pt solid #ccc">$${fmtPrice(report.sumSaleForMargin)}</td></tr><tr><td style="padding:5px 8px;border:0.4pt solid #ccc"><b>Costo incluido en margen</b></td><td style="text-align:right;padding:5px 8px;border:0.4pt solid #ccc">$${fmtPrice(report.sumCostForMargin)}</td></tr><tr><td style="padding:5px 8px;border:0.4pt solid #ccc"><b>Margen consolidado</b></td><td style="text-align:right;padding:5px 8px;border:0.4pt solid #ccc;color:#003366;font-weight:800">$${fmtPrice(report.totalMargin)}</td></tr><tr><td style="padding:5px 8px;border:0.4pt solid #ccc"><b>Margen % sobre costo</b></td><td style="text-align:right;padding:5px 8px;border:0.4pt solid #ccc;font-weight:700">${marginPctStr}</td></tr></table>
    <div class="section-title">Líneas sin costo conocido</div>
    <table style="font-size:8pt"><thead><tr style="background:#FFF1D6"><th style="text-align:left;padding:5px 6px;border:0.4pt solid #ccc">Grupo</th><th style="text-align:left;padding:5px 6px;border:0.4pt solid #ccc">Descripción</th><th style="text-align:center;padding:5px 6px;border:0.4pt solid #ccc">SKU</th><th style="text-align:right;padding:5px 6px;border:0.4pt solid #ccc">Cant.</th><th style="text-align:center;padding:5px 6px;border:0.4pt solid #ccc">Unid.</th><th style="text-align:right;padding:5px 6px;border:0.4pt solid #ccc">Venta</th></tr></thead><tbody>${missingRows || `<tr><td colspan="6" style="padding:8px;border:0.4pt solid #ccc;text-align:center;color:#667085">Todas las líneas tienen costo conocido</td></tr>`}</tbody></table>
    ${foot}
    <div style="margin-top:10px;padding:10px 12px;background:#F7F8FA;border:0.5pt solid #E5E7EB;border-radius:8px;font-size:8.5pt;line-height:1.55;color:#475467">
      <b style="color:#003366">Lectura del análisis</b><br/>
      1. La hoja separa <b>venta total cotizada</b> de la porción que entra al <b>margen consolidado</b>.<br/>
      2. Las líneas sin costo conocido quedan listadas aparte y no distorsionan el margen.<br/>
      3. Si falta costo de flete, la venta de flete tampoco entra al cálculo consolidado hasta completar ese dato.
    </div>
  </div>
</div>
<p style="margin-top:12px;font-size:8pt;color:#888">Líneas sin costo en catálogo no entran en el margen consolidado. Revisar MATRIZ / catálogo para completar costos y mejorar la cobertura del análisis.</p>
</body></html>`;
}

/** Abre ventana de impresión con el HTML dado. */
export function openPrintWindow(html) {
  const w = window.open("", "_blank", "width=800,height=1100");
  if (!w) { alert("Habilitá popups para imprimir."); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
}
