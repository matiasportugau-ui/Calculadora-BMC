// src/pdf-templates/simple.js
// Layout G — Presupuesto Simple (single A4 page, full terms)
// *** R3-C / REFINED IS THE PRODUCTION THEME (primary BMC-theme) ***
// - Brand header: "BMC URUGUAY" + "METALOG SAS" on left, PRESUPUESTO badge + ref/date on right
// - Full original 12 QUOTE_TERMS (with .bl / .hl classes)
// - Refined styling: .cat navy rows, light th, strong .trow.total, scoped, A4 print-ready
// This file is the real production renderer. Visual BASE is generated from it + real model for iteration.
// Changes here = changes in production PDFs (PDF Cliente, WA, Drive, etc.).

import { QUOTE_TERMS, COMPANY } from '../utils/helpers.js';

const fmt = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const BRAND = COMPANY?.brandColor || '#003366'; // Official BMC navy from website + COMPANY (bmcuruguay.com.uy identity)

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
/* REFINED SIMPLE — adopted as preferred after parallel visual comparison */
@page{size:A4;margin:0}
.presupuesto-container,.page{font-size:9pt;line-height:1.25;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.presupuesto-container ul,.presupuesto-container li,.presupuesto-container .cat-row,
.page ul,.page li,.page .cat-row{list-style:none!important;margin:0;padding:0}
.presupuesto-container .cat-row::before,.presupuesto-container [class*="header"]::before,
.page .cat-row::before,.page [class*="header"]::before{content:none!important;display:none!important}
body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;margin:0;font-size:9pt;color:#1D1D1F;background:#fff}
.page{width:210mm;min-height:277mm;position:relative;background:#fff;padding:7mm 8mm}
@media screen{body{background:#e5e2dd;padding:24px 0}.page{margin:0 auto 32px;box-shadow:0 0 0 1px #ddd;max-width:794px}}
@media print{.page{padding:7mm 8mm}}
.hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:2pt solid ${BRAND};padding-bottom:3mm;margin-bottom:3mm}
.badge{background:${BRAND};color:#fff;font-size:7pt;font-weight:700;padding:3px 10px;border-radius:9999px;letter-spacing:.08em;text-transform:uppercase}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:2mm;font-size:8pt;margin-bottom:2mm}
.meta b{color:${BRAND}}
.scope{background:#f1f5f9;padding:3px 6px;border-radius:3px;margin-bottom:2mm;font-size:8pt}
.kpi{font-size:7pt;color:#64748b;margin-bottom:2mm;border-bottom:0.5pt solid #e2e8f0;padding-bottom:1mm}
.bom{width:100%;border-collapse:collapse;font-size:8pt;margin-bottom:2mm}
.bom th{background:#f1f5f9;padding:3px 4px;font-weight:600;text-transform:uppercase;letter-spacing:.02em;text-align:right;border-bottom:0.5pt solid #cbd5e1}
.bom th:first-child{text-align:left}
.bom td{padding:2.5px 4px;border-bottom:0.4pt solid #e2e8f0;text-align:right;font-variant-numeric:tabular-nums}
.bom td:first-child{text-align:left}
.num{text-align:right}
.cen{text-align:center}
.cat{background:${BRAND};color:#fff;font-weight:700}
.totals{display:flex;justify-content:flex-end;margin:2mm 0}
.tbox{min-width:210px;font-size:8.5pt}
.trow{display:flex;justify-content:space-between;padding:1.5px 0;color:#475569}
.trow.total{font-size:11pt;font-weight:800;color:#fff;background:${BRAND};padding:4px 6px;border-radius:3px;margin-top:2px}
.terms{background:#f8fafc;border-left:2.5pt solid ${BRAND};padding:3px 6px;margin-bottom:2mm;font-size:7pt}
.terms-title{font-weight:700;color:${BRAND};text-transform:uppercase;letter-spacing:.06em;margin-bottom:1px;font-size:6.5pt}
.terms li{margin:1px 0 1px 12px}
.terms .hl{color:#b91c1c;font-weight:600}
.terms .bl{font-weight:600}
.bank{background:${BRAND};color:#fff;padding:3px 6px;border-radius:3px;font-size:7pt;margin-bottom:2mm}
.bank-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px 6px}
.ftr{font-size:6.5pt;color:#64748b;border-top:0.5pt solid #cbd5e1;padding-top:2mm;margin-top:2mm;display:flex;justify-content:space-between}
`;

function renderBomDetailRows(bomDetailGroups) {
  return bomDetailGroups.map(g => {
    const isPanelGroup = g.groupName.toUpperCase().includes("PANELES");
    const groupRow = `<tr class="cat"><td colspan="4">${esc(g.groupName)}</td><td class="num">${fmt(g.groupTotal)}</td></tr>`;
    const itemRows = g.items.map(i => {
      const qty = typeof i.qty === 'number'
        ? (i.qty % 1 === 0 ? i.qty : i.qty.toFixed(2))
        : (i.qty ?? '');

      let desc = esc(i.desc);

      // Explicitly surface quantity and length of panels (user request)
      if (isPanelGroup) {
        const np = i.cantPaneles != null ? i.cantPaneles : null;
        const lp = i.largoPanel ? Number(i.largoPanel).toFixed(2) : null;
        if (np != null || lp) {
          const extra = [];
          if (np != null) extra.push(`${np} paneles`);
          if (lp) extra.push(`${lp} m`);
          if (extra.length) {
            desc += ` <span style="color:#003366;font-weight:600">(${extra.join(" × ")})</span>`;
          }
        }
      }

      return `<tr><td>${desc}</td><td class="num">${qty}</td><td class="cen">${esc(i.unit)}</td><td class="num">${fmt(i.pu)}</td><td class="num">${fmt(i.total)}</td></tr>`;
    }).join('');
    return groupRow + itemRows;
  }).join('');
}

function renderTerms() {
  const items = QUOTE_TERMS.map(t => {
    const cls = t.highlight ? 'hl' : (t.bold ? 'bl' : '');
    return `<li${cls ? ` class="${cls}"` : ''}>${esc(t.text)}</li>`;
  }).join('');
  return `<div class="terms">
  <div class="terms-title">Condiciones Comerciales</div>
  <ol>${items}</ol>
</div>`;
}

export function render(q) {
  const cl = q.bmcExtra?.client ?? {};

  const kpiParts = [
    q.areaTotalM2 > 0 ? `${Number(q.areaTotalM2).toFixed(1)} m²` : null,
    q.panelCount > 0 ? `${q.panelCount} paneles` : null,
    q.apoyoCount > 0 ? `${q.apoyoCount} apoyos` : null,
    q.fijacionCount > 0 ? `${q.fijacionCount} fijaciones` : null,
  ].filter(Boolean).join(' · ');

  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><title>Presupuesto BMC Uruguay</title>
<!-- REFINED SIMPLE — production template -->
<style>${CSS}</style>
</head><body>
<div class="page presupuesto-container" id="presupuesto">
  <div class="hdr">
    <div>
      <div style="font-weight:700;color:${BRAND}">BMC URUGUAY</div>
      <div style="font-size:6pt;color:#64748b">METALOG SAS</div>
    </div>
    <div style="text-align:right">
      <div class="badge">PRESUPUESTO</div>
      <div style="font-size:6.5pt;color:#64748b">${esc(q.ref)} — ${esc(q.fecha)}</div>
    </div>
  </div>

  <div class="meta">
    <div><b>Cliente:</b> ${esc(cl.nombre || '')}</div>
    <div><b>Fecha:</b> ${esc(q.fecha)}</div>
    <div><b>Dirección:</b> ${esc(cl.direccion || '')}</div>
    <div><b>Tel:</b> ${esc(cl.telefono || '')}</div>
    <div><b>Ref:</b> ${esc(q.ref)}</div>
    <div><b>Validez:</b> 10 días</div>
  </div>

  <div class="scope"><b>Alcance:</b> ${esc(q.panelDescLine)}</div>
  ${kpiParts ? `<div class="kpi">${esc(kpiParts)}</div>` : ''}

  <table class="bom"><thead><tr>
    <th style="text-align:left">Descripción</th>
    <th>Cant.</th><th>Unid.</th>
    <th>P.U. USD</th><th>Total USD</th>
  </tr></thead><tbody>${renderBomDetailRows(q.bomDetailGroups)}</tbody></table>

  <div class="totals"><div class="tbox">
    <div class="trow"><span>Subtotal sin IVA</span><span>USD ${fmt(q.subtotalSinIva)}</span></div>
    <div class="trow"><span>IVA 22%</span><span>USD ${fmt(q.ivaAmount)}</span></div>
    <div class="trow total"><span>Total USD</span><span>${fmt(q.totalConIva)}</span></div>
  </div></div>

  ${renderTerms()}

  <div class="bank">
    <div style="font-size:6pt;opacity:0.7;margin-bottom:1px;text-transform:uppercase;letter-spacing:.05em">Datos para depósito bancario</div>
    <div class="bank-grid">
      <div>Titular: <strong>Metalog SAS</strong></div>
      <div>RUT: <strong>120403430012</strong></div>
      <div>BROU Cta. Dólares: <strong>110520638-00002</strong></div>
      <div>Consultas: <strong>092 663 245</strong></div>
    </div>
  </div>

  <div class="ftr">
    <span>bmcuruguay.com.uy · 092 663 245 · Metalog SAS</span>
    <span style="color:${BRAND};font-weight:700">
      ${esc(q.escenario)}
      ${q.quoteId || q.ref ? ` · ${esc(q.quoteId || q.ref)}` : ''}
      ${q.version ? `v${q.version}` : ''}
    </span>
  </div>
</div>
</body></html>`;
}
