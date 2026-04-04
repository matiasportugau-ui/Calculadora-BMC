// ═══════════════════════════════════════════════════════════════════════════
// src/utils/quotationViews.js
// Generadores de HTML para salidas de cotización: Cotización completa,
// Hoja Visual Cliente, Costeo Interno, y helpers de PDF/SVG.
// Extraído de PanelinCalculadoraV3.jsx para uso compartido entre componentes.
// ═══════════════════════════════════════════════════════════════════════════

import { BORDER_OPTIONS } from "../data/constants.js";

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
  let roofBlock = null;
  if (roof && roofFam && scenarioDef.hasTecho && techo.familia && techo.espesor) {
    roofBlock = {
      largo: Number(techo.largo) || 0,
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
  const maxW = 420;
  const maxH = 200;
  const ar = anchoTotal > 0 && largo > 0 ? largo / anchoTotal : 0.6;
  let w = maxW;
  let h = w * ar;
  if (h > maxH) { h = maxH; w = Math.min(maxW, h / ar); }
  const stripe = w / n;
  let rects = "";
  for (let i = 0; i < n; i += 1) {
    const x = i * stripe + 0.5;
    const fill = i % 2 ? "#E8EEF5" : "#F5F8FC";
    rects += `<rect x="${x}" y="0.5" width="${Math.max(stripe - 1, 2)}" height="${Math.max(h - 1, 2)}" fill="${fill}" stroke="#003366" stroke-width="0.8"/>`;
  }
  const capH = 28;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h + capH}" viewBox="0 0 ${w} ${h + capH}" role="img" aria-label="Esquema techo"><rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="#ccc" stroke-width="0.5"/>${rects}<text x="4" y="${h + 14}" font-size="9" fill="#444">Largo ${Number(largo).toFixed(2)} m · Ancho útil ${Number(anchoTotal).toFixed(2)} m · ${n} paneles × AU ${au} m</text></svg>`;
}

/** Diagrama SVG de paneles de pared/cerramiento. */
export function svgParedStrip(wallBlock) {
  const { alto, perimetro, cantPaneles, au } = wallBlock;
  const n = Math.max(1, Math.min(40, Number(cantPaneles) || 1));
  const maxW = 420;
  const stripe = maxW / n;
  const h = 72;
  let rects = "";
  for (let i = 0; i < n; i += 1) {
    const x = i * stripe + 0.5;
    const fill = i % 2 ? "#E8EEF5" : "#F5F8FC";
    rects += `<rect x="${x}" y="0.5" width="${Math.max(stripe - 1, 2)}" height="${h - 1}" fill="${fill}" stroke="#003366" stroke-width="0.8"/>`;
  }
  const capH = 28;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${maxW}" height="${h + capH}" viewBox="0 0 ${maxW} ${h + capH}" role="img" aria-label="Esquema fachada"><rect x="0" y="0" width="${maxW}" height="${h}" fill="none" stroke="#ccc" stroke-width="0.5"/>${rects}<text x="4" y="${h + 14}" font-size="9" fill="#444">Alto ${Number(alto).toFixed(2)} m · Perímetro ${Number(perimetro).toFixed(2)} m · ${n} paneles × AU ${au} m</text></svg>`;
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

/**
 * Hoja visual cliente — HTML A4 imprimible.
 * No incluye SKU ni datos internos de costo.
 */
export function generateClientVisualHTML(data) {
  const { client, project, scenario, panel, groups, totals, appendix, snapshotImages } = data;
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const scenarioLabel = { solo_techo: "Techo", solo_fachada: "Fachada", techo_fachada: "Techo + Fachada", camara_frig: "Cámara Frigorífica", presupuesto_libre: "Presupuesto libre" }[scenario] || scenario;
  let tableBody = "";
  groups.forEach((g) => {
    const sub = g.items.reduce((s, i) => s + (i.total || 0), 0);
    tableBody += `<tr style="background:#F0F4F8"><td colspan="4" style="font-weight:600;padding:4px 6px">▸ ${esc(g.title)}</td><td style="text-align:right;font-weight:600;padding:4px 6px">$${fmtPrice(sub)}</td></tr>`;
    g.items.forEach((item, idx) => {
      tableBody += `<tr style="background:${idx % 2 ? "#FAFAFA" : "#fff"}"><td style="padding:3px 6px">${esc(item.label)}</td><td style="text-align:right;padding:3px 6px">${typeof item.cant === "number" ? (item.cant % 1 === 0 ? item.cant : item.cant.toFixed(2)) : item.cant}</td><td style="text-align:center;padding:3px 6px">${esc(item.unidad)}</td><td style="text-align:right;padding:3px 6px">${fmtPrice(item.pu)}</td><td style="text-align:right;padding:3px 6px">$${fmtPrice(item.total)}</td></tr>`;
    });
  });
  const snaps = snapshotImages && typeof snapshotImages === "object" ? snapshotImages : {};
  let appendixHtml = appendix ? buildPdfAppendixHtml(esc, appendix, snaps, true) : "";
  if (!appendixHtml && (snaps.summary || snaps.totals || snaps.borders)) {
    appendixHtml = `<div class="pdf-page2" style="page-break-before:always;break-before:page;padding-top:8px"><h2 class="pdf-h2" style="font-size:13pt;font-weight:800;color:#003366;margin:0 0 8px">Vistas de la propuesta</h2><p style="margin:0 0 12px;font-size:9pt;color:#555">Escenario: <b>${esc(scenarioLabel)}</b></p>${buildSnapshotSectionHtml(snaps, true)}</div>`;
  }
  const productoCliente = scenario === "presupuesto_libre"
    ? `Líneas cotizadas · ${esc(scenarioLabel)}`
    : `${esc(panel.label)} · ${panel.espesor}mm · Color: ${esc(panel.color)} · ${esc(scenarioLabel)}`;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Hoja visual cliente — BMC Uruguay</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;font-size:10pt;color:#1D1D1F;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}table{border-collapse:collapse;width:100%}th,td{border:0.4pt solid #D0D0D0}.pdf-page2{page-break-before:always;break-before:page}</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px"><div style="font-size:18pt;font-weight:800;color:#003366">BMC Uruguay</div><div style="font-size:14pt;font-weight:800">HOJA VISUAL CLIENTE</div></div>
<div style="border-bottom:2pt solid #000;margin-bottom:4px"></div>
<div style="font-size:9pt;color:#444;margin-bottom:8px">Propuesta comercial · bmcuruguay.com.uy · 092 663 245</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:10pt;margin-bottom:8px">
<div><b>Cliente:</b> ${esc(client.nombre)}</div><div><b>Fecha:</b> ${esc(project.fecha)}</div>
<div><b>Obra:</b> ${esc(project.descripcion)}</div><div><b>Ref:</b> ${esc(project.refInterna)}</div>
<div><b>Tel:</b> ${esc(client.telefono)}</div><div><b>Dir:</b> ${esc(client.direccion)}</div>
</div>
<div style="background:#F0F4F8;padding:6px 10px;border-radius:4px;margin-bottom:6px"><b style="color:#003366">Producto / alcance:</b> ${productoCliente}</div>
<table style="font-size:10pt;margin-bottom:6px"><thead><tr style="background:#EDEDED;font-weight:700"><th style="text-align:left;width:42%;padding:5px 8px">Descripción</th><th style="text-align:right;width:12%;padding:5px 8px">Cant.</th><th style="text-align:center;width:10%;padding:5px 8px">Unid.</th><th style="text-align:right;width:16%;padding:5px 8px">P.U. USD</th><th style="text-align:right;width:20%;padding:5px 8px">Total USD</th></tr></thead><tbody>${tableBody}</tbody></table>
<div style="display:flex;justify-content:flex-end;margin-bottom:6px"><table style="min-width:260px;font-size:10pt"><tr><td style="padding:2px 8px">Subtotal s/IVA</td><td style="text-align:right;padding:2px 8px">$${fmtPrice(totals.subtotalSinIVA)}</td></tr><tr><td style="padding:2px 8px">IVA 22%</td><td style="text-align:right;padding:2px 8px">$${fmtPrice(totals.iva)}</td></tr><tr style="border-top:1pt solid #000;font-size:14pt;font-weight:800"><td style="padding:2px 8px">TOTAL USD</td><td style="text-align:right;color:#003366;padding:2px 8px">$${fmtPrice(totals.totalFinal)}</td></tr></table></div>
<div style="font-size:9pt;line-height:1.5;margin-bottom:6px"><b>Condiciones comerciales:</b><ul style="margin:4px 0 0;padding-left:14px"><li style="font-weight:700">Fabricación y entrega 10 a 45 días (depende producción).</li><li style="color:#FF3B30;font-weight:600">Oferta válida 10 días.</li><li style="font-weight:700;color:#FF3B30">Seña 60% al confirmar. Saldo 40% previo a retiro de fábrica.</li><li>Precios en USD; IVA incluido en el total indicado.</li></ul></div>
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
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Costeo interno — BMC</title><style>@page{size:A4;margin:10mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;font-size:9pt;color:#1D1D1F;margin:0;-webkit-print-color-adjust:exact}</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><div style="font-size:16pt;font-weight:800;color:#003366">BMC Uruguay</div><div style="font-size:12pt;font-weight:800">COSTEO INTERNO</div></div>
<div style="font-size:8pt;color:#666;margin-bottom:10px">Lista activa cotización: <b>${esc(listaLabel)}</b> · Uso administración · No enviar al cliente</div>
<div style="font-size:9pt;margin-bottom:10px"><b>Cliente:</b> ${esc(client.nombre)} · <b>Ref:</b> ${esc(project.refInterna)} · <b>Fecha:</b> ${esc(project.fecha)} · <b>Obra:</b> ${esc(project.descripcion)}</div>
<table style="width:100%;border-collapse:collapse;font-size:8pt"><thead><tr style="background:#EDEDED;font-weight:700"><th style="text-align:left;padding:4px 5px;border:0.4pt solid #ccc">Grupo</th><th style="text-align:left;padding:4px 5px;border:0.4pt solid #ccc">Descripción</th><th style="text-align:center;padding:4px 5px;border:0.4pt solid #ccc">SKU</th><th style="text-align:right;padding:4px 5px;border:0.4pt solid #ccc">Cant.</th><th style="text-align:center;padding:4px 5px;border:0.4pt solid #ccc">Unid.</th><th style="text-align:right;padding:4px 5px;border:0.4pt solid #ccc">C.U. costo</th><th style="text-align:right;padding:4px 5px;border:0.4pt solid #ccc">Costo total</th><th style="text-align:right;padding:4px 5px;border:0.4pt solid #ccc">P.U. venta</th><th style="text-align:right;padding:4px 5px;border:0.4pt solid #ccc">Venta total</th><th style="text-align:right;padding:4px 5px;border:0.4pt solid #ccc">% margen</th><th style="text-align:right;padding:4px 5px;border:0.4pt solid #ccc">Ganancia</th></tr></thead><tbody>${body}</tbody></table>
<div style="margin-top:12px;display:flex;justify-content:flex-end"><table style="min-width:280px;font-size:10pt;border-collapse:collapse"><tr><td style="padding:4px 8px"><b>Costo total (líneas con costo conocido)</b></td><td style="text-align:right;padding:4px 8px">$${fmtPrice(report.sumCostAll)}</td></tr><tr><td style="padding:4px 8px"><b>Venta incluida en margen</b></td><td style="text-align:right;padding:4px 8px">$${fmtPrice(report.sumSaleForMargin)}</td></tr><tr><td style="padding:4px 8px"><b>Costo incluido en margen</b></td><td style="text-align:right;padding:4px 8px">$${fmtPrice(report.sumCostForMargin)}</td></tr><tr style="border-top:1pt solid #000"><td style="padding:6px 8px;font-weight:800">Margen consolidado</td><td style="text-align:right;padding:6px 8px;font-weight:800;color:#003366">$${fmtPrice(report.totalMargin)}</td></tr><tr><td style="padding:4px 8px;font-size:9pt;color:#555">Margen % sobre costo (consolidado)</td><td style="text-align:right;padding:4px 8px;font-size:9pt;font-weight:700">${marginPctStr}</td></tr></table></div>
${foot}
<p style="margin-top:14px;font-size:8pt;color:#888">Líneas sin costo en catálogo no entran en el margen consolidado. Revisar MATRIZ / catálogo para completar costos.</p>
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
