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
  return {
    scenarioLabel: { solo_techo: "Techo", solo_fachada: "Fachada", techo_fachada: "Techo + Fachada", camara_frig: "Cámara Frigorífica", presupuesto_libre: "Presupuesto libre" }[scenario] || scenario,
    showBorders: !!vis.borders,
    borders: techo.borders,
    borderExtras,
    roofBlock,
    wallBlock,
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
 * Plano en planta SVG desde datos de zonas — siempre vectorial, siempre nítido en PDF.
 * Reemplaza el screenshot rasterizado. Todas las zonas se dibujan a la misma escala.
 */
export function svgFloorPlan(roofBlocks) {
  if (!Array.isArray(roofBlocks) || roofBlocks.length === 0) return "";
  const vW = 1000;
  const GAP_M = 0.5;
  const LABEL_H = 52;
  const blocks = roofBlocks.filter(rb => (rb.anchoTotal || rb.ancho || 0) > 0 && (rb.largo || 0) > 0);
  if (blocks.length === 0) return "";
  const totalW_m = blocks.reduce((s, rb) => s + (rb.anchoTotal || rb.ancho || 0), 0)
    + GAP_M * (blocks.length - 1);
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
      const fill = i % 2 ? "#D6E9F8" : "#EBF4FC";
      inner += `<rect x="${rx}" y="${zY}" width="${rw}" height="${zH}" fill="${fill}" stroke="#4A7FB5" stroke-width="0.8"/>`;
    }
    inner += `<rect x="${curX}" y="${zY}" width="${zW}" height="${zH}" fill="none" stroke="#003366" stroke-width="2.2"/>`;
    const cx = (curX + zW / 2).toFixed(0);
    const multiZona = blocks.length > 1;
    const y1 = maxH_coord + 20;
    const y2 = maxH_coord + 37;
    if (multiZona) {
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
  const _fpSvg = svgFloorPlan(_fpBlocks);
  const floorPlanHtml = _fpSvg
    ? `<div style="margin-bottom:8px;padding:8px 10px;background:#F8FAFC;border-radius:6px;border:0.5pt solid #E2E8F0;page-break-inside:avoid;break-inside:avoid"><div style="font-size:8pt;font-weight:700;color:#003366;margin-bottom:5px">Planta 2D · cubierta</div>${_fpSvg}</div>`
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
