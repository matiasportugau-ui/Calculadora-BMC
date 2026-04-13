// ═══════════════════════════════════════════════════════════════════════════
// src/utils/helpers.js — BOM override helpers, print/PDF utilities
// ═══════════════════════════════════════════════════════════════════════════

// ── Override helpers ─────────────────────────────────────────────────────────

export function createLineId(groupTitle, idx) { return groupTitle.toUpperCase().replace(/\s/g, "_") + "-" + idx; }

export function applyOverrides(groups, overrides) {
  return groups.map(g => ({ ...g, items: g.items.map((item, idx) => {
    const lid = createLineId(g.title, idx);
    const ovr = overrides && overrides[lid];
    if (!ovr) return { ...item, isOverridden: false, lineId: lid };
    const patched = { ...item, isOverridden: true, lineId: lid };
    if (ovr.field === "cant") { patched.cant = ovr.value; patched.total = +((ovr.value || 0) * (patched.pu || 0)).toFixed(2); }
    else if (ovr.field === "pu") { patched.pu = ovr.value; patched.total = +((patched.cant || 0) * (ovr.value || 0)).toFixed(2); }
    return patched;
  }) }));
}

export function bomToGroups(result) {
  if (!result || result.error) return [];

  if (result.presupuestoLibre === true && Array.isArray(result.allItems) && result.allItems.length > 0) {
    return [{ title: "PRESUPUESTO LIBRE", items: result.allItems.map((i) => ({ ...i })) }];
  }

  const panelItems = [];
  const perfilItems = [];
  const fijacionItems = [];
  const selladorItems = [];

  if (result.allItems) {
    result.allItems.filter(i => i.unidad === "m²").forEach(i => panelItems.push({ ...i }));
  }

  const perfilKeys = ["perfileria", "perfilesU", "esquineros", "perfilesExtra"];
  const fijacionKeys = ["fijaciones"];
  const selladorKeys = ["selladores", "sellador"];

  const extractFrom = (src) => {
    const mergeInto = (targetArr, keys) => {
      keys.forEach(key => {
        if (src[key]?.items?.length > 0) {
          src[key].items.forEach(item => {
            const match = targetArr.find(ei => ei.sku === item.sku && ei.label === item.label);
            if (match) {
              match.cant += item.cant;
              match.total = +(match.total + item.total).toFixed(2);
              if (match.costo == null && item.costo != null) match.costo = item.costo;
            } else {
              targetArr.push({ ...item });
            }
          });
        }
      });
    };
    mergeInto(perfilItems, perfilKeys);
    mergeInto(fijacionItems, fijacionKeys);
    mergeInto(selladorItems, selladorKeys);
  };

  extractFrom(result);
  if (result.paredResult) extractFrom(result.paredResult);
  if (result.techoResult) extractFrom(result.techoResult);

  const groups = [];
  if (panelItems.length > 0) groups.push({ title: "PANELES", items: panelItems });
  if (perfilItems.length > 0) groups.push({ title: "PERFILERÍA", items: perfilItems });
  if (fijacionItems.length > 0) groups.push({ title: "FIJACIONES", items: fijacionItems });
  if (selladorItems.length > 0) groups.push({ title: "SELLADORES", items: selladorItems });
  return groups;
}

// ── Company configuration ─────────────────────────────────────────────────────

export const COMPANY = {
  name: "BMC Uruguay",
  legalName: "Metalog SAS",
  rut: "120403430012",
  phone: "092 663 245",
  location: "Maldonado, Uruguay",
  website: "bmcuruguay.com.uy",
  bank: {
    name: "BROU",
    accountType: "Cta. Dólares",
    accountNumber: "110520638-00002",
  },
  brandColor: "#003366",
};

export const QUOTE_TERMS = [
  { text: "Fabricación y entrega de 10 a 45 días, dependemos de producción.", bold: true },
  { text: "Oferta válida por 10 días a partir de la fecha.", bold: true, highlight: true },
  { text: "Seña del 60% (al confirmar). Saldo del 40% (previo a retiro de fábrica).", bold: true, highlight: true },
  { text: "Con tarjeta de crédito y en cuotas, sería en $ y a través de Mercado Pago con un recargo de 11,9% (comisión MP)." },
  { text: "Retiro sin cargo en Planta Industrial de Bromyros S.A. (Colonia Nicolich, Can.)." },
  { text: "NO INCLUYE MONTAJE.", bold: true, highlight: true },
  { text: "El traslado no incluye descarga, se requieren 2 peones mínimo." },
  { text: "BMC no asume responsabilidad por fallas producidas por no respetar la autoportancia sugerida." },
  { text: "Al aceptar esta cotización confirma haber revisado el contenido de la misma en cuanto a medidas, cantidades, colores, valores y tipo de producto." },
  { text: "Nuestro asesoramiento es una guía, en ningún caso sustituye el trabajo profesional de Arq. o Ing." },
  { text: "Al momento de recibir el material corroborar el estado del mismo. Una vez recibido, no aceptamos devolución.", bold: true },
  { text: "Sujeto a cambios según fábrica." },
];

// ── Shared utilities ──────────────────────────────────────────────────────────

export const fmtPrice = n => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SCENARIO_LABELS = {
  solo_techo: "Techo",
  solo_fachada: "Fachada",
  techo_fachada: "Techo + Fachada",
  camara_frig: "Cámara Frigorífica",
};

const GOOGLE_FONT_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
const PDF_FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

// ── PDF Section Builders ──────────────────────────────────────────────────────

function buildPdfHead(title) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${GOOGLE_FONT_URL}" rel="stylesheet">
<style>
  @page { size: A4; margin: 11mm 10mm 18mm 10mm; }
  * { box-sizing: border-box; }
  body {
    font-family: ${PDF_FONT};
    font-size: 9.4pt;
    color: #1D1D1F;
    margin: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  th, td { border: 0.4pt solid #D0D0D0; }
  thead { display: table-header-group; }
  .section { page-break-inside: avoid; }
  .totals-block { page-break-inside: avoid; }
  .terms-block { page-break-inside: avoid; }
  .bank-block { page-break-inside: avoid; }
  .muted { color: #667085; }
  .num { font-variant-numeric: tabular-nums; }
  .pdf-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 7pt;
    color: #AEAEB2;
    padding: 3mm 12mm 2mm;
    border-top: 0.5pt solid #E5E5EA;
  }
</style>
</head><body>`;
}

function buildLogo() {
  return `<svg width="140" height="32" viewBox="0 0 140 32" xmlns="http://www.w3.org/2000/svg" style="display:block">
  <rect width="32" height="32" rx="5" fill="${COMPANY.brandColor}"/>
  <text x="16" y="23" text-anchor="middle" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="900">B</text>
  <text x="40" y="21" fill="${COMPANY.brandColor}" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="800" letter-spacing="-0.5">BMC</text>
  <text x="40" y="30" fill="#8C8C8C" font-family="Arial,Helvetica,sans-serif" font-size="7" font-weight="600" letter-spacing="2.5">URUGUAY</text>
</svg>`;
}

function buildQuoteHeader(data) {
  const { quotationId, listaPrecios } = data;
  const listaInfo = listaPrecios === "venta" ? "Lista: BMC Directo" : "Lista: Web";
  return `
<div class="section" style="margin-bottom:16px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div>${buildLogo()}</div>
    <div style="text-align:right">
      <div style="font-size:20pt;font-weight:800;color:${COMPANY.brandColor};letter-spacing:-0.5px">COTIZACIÓN</div>
      ${quotationId ? `<div style="font-size:9pt;font-weight:600;color:#6E6E73;margin-top:2px;font-variant-numeric:tabular-nums">${esc(quotationId)}</div>` : ""}
    </div>
  </div>
  <div style="border-bottom:2.5pt solid ${COMPANY.brandColor};margin-bottom:6px"></div>
  <div style="display:flex;justify-content:space-between;font-size:8.5pt;color:#6E6E73">
    <span>${esc(COMPANY.website)} · ${esc(COMPANY.phone)} · ${esc(COMPANY.location)}</span>
    <span>${listaInfo}</span>
  </div>
</div>`;
}

function buildClientGrid(data) {
  const { client, project, validityDays = 10 } = data;
  return `
<div class="section" style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:10pt;margin-bottom:14px;padding:10px 14px;background:#F8F9FA;border-radius:6px;border:0.5pt solid #E5E5EA">
  <div><b>Cliente:</b> ${esc(client.nombre)}</div>
  <div><b>Fecha:</b> ${esc(project.fecha)}</div>
  <div><b>RUT:</b> ${esc(client.rut)}</div>
  <div><b>Ref:</b> ${esc(project.refInterna)}</div>
  <div><b>Obra:</b> ${esc(project.descripcion)}</div>
  <div><b>Validez:</b> ${validityDays} días</div>
  <div><b>Tel:</b> ${esc(client.telefono)}</div>
  <div><b>Dir:</b> ${esc(client.direccion)}</div>
</div>`;
}

function buildProductBadge(data) {
  const { scenario, panel, autoportancia } = data;
  const scenarioLabel = SCENARIO_LABELS[scenario] || scenario;
  const panelStr = panel.espesor ? `${panel.label} · ${panel.espesor}mm · Color: ${esc(panel.color)}` : esc(panel.label);

  const specParts = [];
  if (panel.au) specParts.push(`AU: ${panel.au}m`);
  if (autoportancia?.maxSpan) specParts.push(`Autoportancia: ${autoportancia.maxSpan}m`);
  if (autoportancia?.apoyos) specParts.push(`Apoyos: ${autoportancia.apoyos}`);
  const specsLine = specParts.length > 0 ? specParts.join(" · ") : "";

  const statusStr = autoportancia?.ok === true
    ? "Autoportante ✓"
    : autoportancia?.ok === false ? "⚠ Requiere estructura adicional" : "";

  return `
<div class="section" style="background:#EEF3F8;padding:10px 14px;border-radius:6px;margin-bottom:10px;border-left:4px solid ${COMPANY.brandColor}">
  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
    <b style="color:${COMPANY.brandColor}">PRODUCTO:</b>
    <span>${panelStr}</span>
    <span style="background:${COMPANY.brandColor};color:#fff;font-size:7.5pt;font-weight:700;padding:2px 8px;border-radius:3px">${esc(scenarioLabel)}</span>
  </div>
  ${specsLine || statusStr ? `<div style="font-size:8.5pt;color:#6E6E73;margin-top:4px">${specsLine}${statusStr && specsLine ? " · " : ""}${statusStr}</div>` : ""}
</div>`;
}

function buildDimensionsSection(data) {
  const { dimensions } = data;
  if (!dimensions) return "";
  const items = [];
  if (dimensions.zonas?.length) {
    if (dimensions.zonas.length === 1) {
      items.push(`${dimensions.zonas[0].largo}m × ${dimensions.zonas[0].ancho}m`);
    } else {
      const zonasStr = dimensions.zonas.map((z, i) => `Zona ${i + 1}: ${z.largo}×${z.ancho}m`).join(", ");
      items.push(zonasStr);
    }
  }
  if (dimensions.alto) items.push(`Alto: ${dimensions.alto}m`);
  if (dimensions.perimetro) items.push(`Perímetro: ${dimensions.perimetro}m`);
  if (dimensions.area) items.push(`Área: ${dimensions.area}m²`);
  if (dimensions.cantPaneles) items.push(`Paneles: ${dimensions.cantPaneles} pzas`);
  if (items.length === 0) return "";
  return `<div class="section" style="background:#E8F4FD;padding:8px 14px;border-radius:6px;margin-bottom:10px;font-size:9pt"><b>DIMENSIONES:</b> ${items.join(" · ")}</div>`;
}

function buildDescarteSection(data) {
  const { descarte, dimensions } = data;
  if (!descarte || descarte.anchoM <= 0) return "";
  const largoRef = dimensions?.zonas?.[0]?.largo || "—";
  return `<div class="section" style="background:#FFF3CD;padding:8px 14px;border-radius:6px;margin-bottom:10px;font-size:9pt;color:#856404"><b>DESCARTE:</b> ${descarte.anchoM}m × ${largoRef}m = ${descarte.areaM2}m² (${descarte.porcentaje}%)</div>`;
}

function buildBomTable(data) {
  const { groups, showSKU = true, showUnitPrices = true } = data;

  const cols = [];
  cols.push({ label: "Descripción", align: "left", width: showSKU ? "32%" : (showUnitPrices ? "45%" : "55%") });
  if (showSKU) cols.push({ label: "SKU", align: "center", width: "10%" });
  cols.push({ label: "Cant.", align: "right", width: showSKU ? "8%" : "10%" });
  cols.push({ label: "Unid.", align: "center", width: "8%" });
  if (showUnitPrices) cols.push({ label: "P.U. USD", align: "right", width: showSKU ? "13%" : "15%" });
  cols.push({ label: "Total USD", align: "right", width: showSKU ? "14%" : (showUnitPrices ? "17%" : "22%") });

  const colCount = cols.length;

  let thead = `<tr style="background:#EDEDED;font-weight:700">`;
  cols.forEach(c => {
    thead += `<th style="text-align:${c.align};width:${c.width};padding:5px 8px">${c.label}</th>`;
  });
  thead += `</tr>`;

  let tbody = "";
  groups.forEach(g => {
    const sub = g.items.reduce((s, i) => s + (i.total || 0), 0);
    tbody += `<tr style="background:#EEF3F8;page-break-after:avoid"><td colspan="${colCount - 1}" style="font-weight:600;padding:6px 8px;color:${COMPANY.brandColor}">&#9656; ${esc(g.title)}</td><td style="text-align:right;font-weight:600;padding:6px 8px">$${fmtPrice(sub)}</td></tr>`;
    g.items.forEach((item, idx) => {
      const bg = idx % 2 ? "#FAFAFA" : "#fff";
      const cantDisplay = typeof item.cant === "number" ? (item.cant % 1 === 0 ? item.cant : item.cant.toFixed(2)) : item.cant;
      tbody += `<tr style="background:${bg}">`;
      const largoHint = item.largoBarra ? ` <span style="color:#6E6E73;font-size:9pt">(${item.largoBarra}m c/u)</span>` : "";
      const panelDetail = item.cantPaneles
        ? `<div style="color:#6E6E73;font-size:9pt;margin-top:1px">${item.cantPaneles} paneles${item.largoPanel ? ` × ${item.largoPanel}m largo` : ""}</div>`
        : "";
      tbody += `<td style="padding:5px 8px">${esc(item.label)}${largoHint}${panelDetail}</td>`;
      if (showSKU) tbody += `<td style="text-align:center;color:#6E6E73;padding:5px 8px;font-size:8.5pt">${esc(item.sku || "—")}</td>`;
      tbody += `<td style="text-align:right;padding:5px 8px;font-variant-numeric:tabular-nums">${cantDisplay}</td>`;
      tbody += `<td style="text-align:center;padding:5px 8px">${esc(item.unidad)}</td>`;
      if (showUnitPrices) tbody += `<td style="text-align:right;padding:5px 8px;font-variant-numeric:tabular-nums">${fmtPrice(item.pu)}</td>`;
      tbody += `<td style="text-align:right;padding:5px 8px;font-variant-numeric:tabular-nums">$${fmtPrice(item.total)}</td>`;
      tbody += `</tr>`;
    });
  });

  return `
<table style="font-size:10pt;margin-bottom:12px">
  <thead>${thead}</thead>
  <tbody>${tbody}</tbody>
</table>`;
}

function buildTotalsBlock(data) {
  const { totals } = data;
  return `
<div class="totals-block" style="display:flex;justify-content:flex-end;margin-bottom:14px">
  <table style="width:320px;font-size:10pt;border:none;table-layout:auto">
    <tr><td style="padding:4px 10px;border:none">Subtotal s/IVA</td><td style="text-align:right;padding:4px 10px;border:none;font-variant-numeric:tabular-nums">$${fmtPrice(totals.subtotalSinIVA)}</td></tr>
    <tr><td style="padding:4px 10px;border:none">IVA 22%</td><td style="text-align:right;padding:4px 10px;border:none;font-variant-numeric:tabular-nums">$${fmtPrice(totals.iva)}</td></tr>
    <tr style="border-top:1.5pt solid #1D1D1F">
      <td style="padding:6px 10px;font-size:14pt;font-weight:800;border:none">TOTAL USD</td>
      <td style="text-align:right;padding:6px 10px;font-size:14pt;font-weight:800;color:${COMPANY.brandColor};border:none;font-variant-numeric:tabular-nums">$${fmtPrice(totals.totalFinal)}</td>
    </tr>
  </table>
</div>`;
}

function buildTermsSection(data) {
  const { warnings, terms = QUOTE_TERMS } = data;
  const warnHTML = (warnings || []).map(w =>
    `<li style="color:#FF9500;font-weight:600;margin-bottom:2px">${esc(w)}</li>`
  ).join("");

  let termsHTML = "";
  terms.forEach(t => {
    const parts = ["margin-bottom:2px"];
    if (t.bold) parts.push("font-weight:600");
    if (t.highlight) parts.push("color:#FF3B30");
    termsHTML += `<li style="${parts.join(";")}">${esc(t.text)}</li>`;
  });

  return `
<div class="terms-block" style="font-size:8.5pt;line-height:1.5;margin-bottom:12px;padding:10px 14px;background:#F8F9FA;border-radius:6px">
  <b style="color:${COMPANY.brandColor};font-size:9pt">TÉRMINOS Y CONDICIONES</b>
  <ul style="margin:6px 0 0;padding-left:16px">
    ${termsHTML}
    ${warnHTML}
  </ul>
</div>`;
}

function buildBankBlock() {
  const c = COMPANY;
  return `
<div class="bank-block" style="margin-bottom:10px">
  <table style="font-size:8.5pt">
    <thead><tr><th colspan="2" style="background:#EDEDED;font-weight:700;text-align:left;padding:5px 10px;color:${c.brandColor}">Datos para Depósito Bancario</th></tr></thead>
    <tbody>
      <tr>
        <td style="padding:5px 10px">Titular: <b>${esc(c.legalName)}</b></td>
        <td style="padding:5px 10px">RUT: ${esc(c.rut)}</td>
      </tr>
      <tr>
        <td style="padding:5px 10px">${esc(c.bank.name)} · ${esc(c.bank.accountType)}: <b>${esc(c.bank.accountNumber)}</b></td>
        <td style="padding:5px 10px">Consultas: <b>${esc(c.phone)}</b></td>
      </tr>
    </tbody>
  </table>
</div>`;
}

function buildPageFooter() {
  return `<div class="pdf-footer">${esc(COMPANY.name)} · ${esc(COMPANY.website)} · ${esc(COMPANY.phone)}</div>`;
}

// ── Customer Quotation PDF ────────────────────────────────────────────────────

export function generatePrintHTML(data) {
  const {
    client, project, scenario, panel, autoportancia, groups, totals,
    warnings, dimensions, listaPrecios,
    quotationId, showSKU = false, showUnitPrices = true, terms,
  } = data;

  const sections = [
    buildPdfHead("Cotización BMC Uruguay"),
    buildPageFooter(),
    buildQuoteHeader({ quotationId, listaPrecios }),
    buildClientGrid({ client, project }),
    buildProductBadge({ scenario, panel, autoportancia }),
    buildDimensionsSection({ dimensions }),
    // Descarte intentionally omitted from customer quotation
    buildBomTable({ groups, showSKU, showUnitPrices }),
    buildTotalsBlock({ totals }),
    buildTermsSection({ warnings, terms }),
    buildBankBlock(),
    "</body></html>",
  ];

  return sections.join("\n");
}

// ── Internal Report PDF ───────────────────────────────────────────────────────

export function generateInternalHTML(data) {
  const {
    client, project, scenario, panel, groups, totals, warnings,
    dimensions, descarte, listaPrecios, autoportancia,
    excludedItems, categoriasDesactivadas, formulas
  } = data;
  const scenarioLabel = SCENARIO_LABELS[scenario] || scenario;
  const timestamp = new Date().toLocaleString("es-UY");

  let inputsHTML = `<h3 style="margin:12px 0 6px;color:${COMPANY.brandColor};font-size:11pt">INPUTS DEL USUARIO</h3><ul style="font-size:10pt;margin:0;padding-left:20px;line-height:1.7">`;
  inputsHTML += `<li>Escenario: ${esc(scenarioLabel)}</li>`;
  inputsHTML += `<li>Lista precios: ${listaPrecios === "venta" ? "BMC Directo" : "Web"}</li>`;
  inputsHTML += `<li>Panel: ${esc(panel.label)} ${panel.espesor || ""}mm · Color: ${esc(panel.color || "—")}</li>`;
  if (dimensions) {
    if (dimensions.zonas?.length) {
      dimensions.zonas.forEach((z, i) => {
        inputsHTML += `<li>Zona ${i + 1}: ${z.largo}m × ${z.ancho}m = ${(z.largo * z.ancho).toFixed(2)}m²</li>`;
      });
    }
    if (dimensions.alto) inputsHTML += `<li>Alto: ${dimensions.alto}m</li>`;
    if (dimensions.perimetro) inputsHTML += `<li>Perímetro: ${dimensions.perimetro}m</li>`;
  }
  inputsHTML += `</ul>`;

  let formulasHTML = "";
  if (formulas && formulas.length > 0) {
    formulasHTML = `<h3 style="margin:12px 0 6px;color:${COMPANY.brandColor};font-size:11pt">FÓRMULAS APLICADAS</h3><ul style="font-size:9pt;margin:0;padding-left:20px;font-family:monospace;line-height:1.7">`;
    formulas.forEach(f => { formulasHTML += `<li>${esc(f)}</li>`; });
    formulasHTML += `</ul>`;
  }

  let excludedHTML = "";
  if (excludedItems && Object.keys(excludedItems).length > 0) {
    excludedHTML = `<h3 style="margin:12px 0 6px;color:#C0392B;font-size:11pt">ITEMS EXCLUIDOS</h3><ul style="font-size:10pt;margin:0;padding-left:20px;line-height:1.7">`;
    Object.entries(excludedItems).forEach(([id, label]) => { excludedHTML += `<li>${esc(label)} (${esc(id)})</li>`; });
    excludedHTML += `</ul>`;
  }

  let categoriasHTML = "";
  if (categoriasDesactivadas && categoriasDesactivadas.length > 0) {
    categoriasHTML = `<h3 style="margin:12px 0 6px;color:#FF9500;font-size:11pt">CATEGORÍAS DESACTIVADAS</h3><ul style="font-size:10pt;margin:0;padding-left:20px;line-height:1.7">`;
    categoriasDesactivadas.forEach(c => { categoriasHTML += `<li>${esc(c)}</li>`; });
    categoriasHTML += `</ul>`;
  }

  let tableBody = "";
  groups.forEach(g => {
    const sub = g.items.reduce((s, i) => s + (i.total || 0), 0);
    tableBody += `<tr style="background:#E8F4FD"><td colspan="6" style="font-weight:600;padding:6px 8px;color:${COMPANY.brandColor}">${esc(g.title)}</td><td style="text-align:right;font-weight:600;padding:6px 8px">$${fmtPrice(sub)}</td></tr>`;
    g.items.forEach((item, idx) => {
      const overrideNote = item.isOverridden ? ' (MODIFICADO)' : '';
      tableBody += `<tr style="background:${item.isOverridden ? "#FFF3CD" : idx % 2 ? "#FAFAFA" : "#fff"}">`;
      tableBody += `<td style="padding:5px 8px">${esc(item.label)}${overrideNote}</td>`;
      tableBody += `<td style="text-align:center;color:#6E6E73;padding:5px 8px;font-size:8.5pt">${esc(item.sku || "—")}</td>`;
      tableBody += `<td style="text-align:center;color:#AEAEB2;padding:5px 8px;font-size:8pt">${esc(item.tipo || "—")}</td>`;
      tableBody += `<td style="text-align:right;padding:5px 8px;font-variant-numeric:tabular-nums">${typeof item.cant === "number" ? item.cant.toFixed(2) : item.cant}</td>`;
      tableBody += `<td style="text-align:center;padding:5px 8px">${esc(item.unidad)}</td>`;
      tableBody += `<td style="text-align:right;padding:5px 8px;font-variant-numeric:tabular-nums">${fmtPrice(item.pu)}</td>`;
      tableBody += `<td style="text-align:right;padding:5px 8px;font-variant-numeric:tabular-nums">$${fmtPrice(item.total)}</td>`;
      tableBody += `</tr>`;
    });
  });

  const warnHTML = (warnings || []).map(w => `<li style="color:#FF9500">${esc(w)}</li>`).join("");

  return `${buildPdfHead("Informe Interno BMC")}
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
  <div style="font-size:16pt;font-weight:800;color:${COMPANY.brandColor}">INFORME INTERNO — ${esc(COMPANY.name)}</div>
  <div style="font-size:10pt;color:#6E6E73">${timestamp}</div>
</div>
<div style="border-bottom:2.5pt solid ${COMPANY.brandColor};margin-bottom:12px"></div>
<div class="section" style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:10pt;margin-bottom:12px;background:#F8F9FA;padding:10px 14px;border-radius:6px">
  <div><b>Cliente:</b> ${esc(client.nombre)}</div><div><b>Fecha:</b> ${esc(project.fecha)}</div>
  <div><b>RUT:</b> ${esc(client.rut)}</div><div><b>Ref:</b> ${esc(project.refInterna)}</div>
  <div><b>Obra:</b> ${esc(project.descripcion)}</div><div><b>Dir:</b> ${esc(client.direccion)}</div>
</div>
${inputsHTML}
${formulasHTML}
${descarte && descarte.anchoM > 0 ? buildDescarteSection({ descarte, dimensions }) : ""}
${autoportancia ? `<div class="section" style="background:${autoportancia.ok ? "#D4EDDA" : "#F8D7DA"};padding:8px 14px;border-radius:6px;margin:10px 0;font-size:9pt"><b>AUTOPORTANCIA:</b> ${autoportancia.ok ? "OK" : "EXCEDE"} · Vano máx: ${autoportancia.maxSpan}m · Apoyos: ${autoportancia.apoyos}</div>` : ""}
${excludedHTML}
${categoriasHTML}
<h3 style="margin:12px 0 6px;color:${COMPANY.brandColor};font-size:11pt">BOM DETALLADO</h3>
<table style="font-size:9pt;margin-bottom:12px">
  <thead><tr style="background:#EDEDED;font-weight:700">
    <th style="text-align:left;width:28%;padding:5px 8px">Descripción</th>
    <th style="text-align:center;width:10%;padding:5px 8px">SKU</th>
    <th style="text-align:center;width:10%;padding:5px 8px">Tipo</th>
    <th style="text-align:right;width:10%;padding:5px 8px">Cant.</th>
    <th style="text-align:center;width:8%;padding:5px 8px">Unid.</th>
    <th style="text-align:right;width:12%;padding:5px 8px">P.U.</th>
    <th style="text-align:right;width:12%;padding:5px 8px">Total</th>
  </tr></thead>
  <tbody>${tableBody}</tbody>
</table>
<div class="totals-block" style="display:flex;justify-content:flex-end;margin:12px 0">
  <table style="min-width:240px;font-size:10pt;border:none">
    <tr><td style="padding:4px 10px;border:none">Subtotal s/IVA</td><td style="text-align:right;padding:4px 10px;border:none;font-variant-numeric:tabular-nums">$${fmtPrice(totals.subtotalSinIVA)}</td></tr>
    <tr><td style="padding:4px 10px;border:none">IVA 22%</td><td style="text-align:right;padding:4px 10px;border:none;font-variant-numeric:tabular-nums">$${fmtPrice(totals.iva)}</td></tr>
    <tr style="border-top:1.5pt solid #1D1D1F">
      <td style="padding:6px 10px;font-size:12pt;font-weight:800;border:none">TOTAL USD</td>
      <td style="text-align:right;padding:6px 10px;font-size:12pt;font-weight:800;color:${COMPANY.brandColor};border:none;font-variant-numeric:tabular-nums">$${fmtPrice(totals.totalFinal)}</td>
    </tr>
  </table>
</div>
${warnHTML ? `<h3 style="margin:12px 0 6px;color:#FF9500;font-size:11pt">ADVERTENCIAS</h3><ul style="font-size:9pt;margin:0;padding-left:20px;line-height:1.7">${warnHTML}</ul>` : ""}
<div style="margin-top:16px;padding:10px 14px;background:#F0F0F0;border-radius:6px;font-size:8pt;color:#6E6E73;line-height:1.6">
  <b>Origen datos:</b> src/data/constants.js · Lista: ${listaPrecios === "venta" ? "BMC Directo (venta)" : "Web"}<br>
  <b>Generado:</b> ${timestamp} · Calculadora BMC v3.1.0
</div>
</body></html>`;
}

// ── Print / preview utilities ─────────────────────────────────────────────────

export function openPrintWindow(html) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "width=800,height=1100");
  if (!w) {
    URL.revokeObjectURL(url);
    alert("Habilitá popups para imprimir.");
    return;
  }
  w.addEventListener("afterprint", () => URL.revokeObjectURL(url));
  w.addEventListener("load", () => {
    setTimeout(() => w.print(), 400);
  });
}

export function createPreviewUrl(html) {
  return URL.createObjectURL(new Blob([html], { type: "text/html" }));
}

export function revokePreviewUrl(url) {
  if (url) URL.revokeObjectURL(url);
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────

export function buildWhatsAppText(data) {
  const { client, project, scenario, panel, totals, listaLabel } = data;
  const scenarioLabel = { solo_techo: "Solo techo", solo_fachada: "Solo fachada", techo_fachada: "Techo + Fachada", camara_frig: "Cámara Frigorífica" }[scenario] || scenario;
  const panelStr = panel.espesor ? `${panel.label} ${panel.espesor}mm · Color: ${panel.color}` : panel.label;
  let txt = `*Cotización ${COMPANY.name}*\n📅 ${project.fecha} · Ref: ${project.refInterna || "—"}\n🏗 Cliente: ${client.nombre}${client.rut ? " · " + client.rut : ""}\n📐 Obra: ${project.descripcion || "—"} · ${client.direccion || "—"}\n💲 Lista: ${listaLabel}\n\n*Escenario:* ${scenarioLabel}\n*Panel:* ${panelStr}\n`;
  txt += `\n💰 *Subtotal s/IVA:* USD ${fmtPrice(totals.subtotalSinIVA)}\n💰 *IVA 22%:* USD ${fmtPrice(totals.iva)}\n✅ *TOTAL USD: ${fmtPrice(totals.totalFinal)}*\n\n_Entrega 10-15d · Seña 60%_\n_${COMPANY.phone} · ${COMPANY.website}_`;
  return txt;
}
