// src/pdf-templates/simple-previous.js
// Layout G — Presupuesto Simple (previous version, pre R3-C refinement) (single A4 page, full terms)

import { QUOTE_TERMS, COMPANY } from '../utils/helpers.js';

const fmt = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const BRAND = COMPANY?.brandColor || '#003366'; // Official BMC navy from website + COMPANY (bmcuruguay.com.uy identity)

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:8mm 10mm}
body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;font-size:8.5pt;color:#1D1D1F;background:#fff}
.page{width:210mm;min-height:277mm;position:relative;background:#fff}
@media screen{body{background:#c5bdb5;padding:24px 0}.page{margin:0 auto 32px;box-shadow:0 8px 40px rgba(0,0,0,.18);border-radius:3px;max-width:794px;padding:8mm 10mm}}
@media print{.page{padding:0}}
.hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:2pt solid ${BRAND};padding-bottom:4mm;margin-bottom:3mm}
.hdr-left{display:flex;align-items:center;gap:8px}
.hdr-logo{height:26px;width:auto;opacity:0.95;flex-shrink:0}
.hdr-name{font-size:11pt;font-weight:800;color:${BRAND};letter-spacing:.03em}
.hdr-sub{font-size:6pt;color:#667085;letter-spacing:.1em;text-transform:uppercase}
.hdr-badge{background:${BRAND};color:#fff;font-size:7pt;font-weight:700;padding:3px 10px;border-radius:12px;letter-spacing:.08em;text-transform:uppercase}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:1.5mm 10mm;font-size:8pt;margin-bottom:2.5mm}
.meta b{color:${BRAND}}
.prod{background:#F0F4F8;padding:4px 8px;border-radius:4px;margin-bottom:2.5mm;font-size:8pt}
.prod b{color:${BRAND}}
.kpi-line{font-size:7pt;color:#667085;margin-bottom:2.5mm;padding:2px 0;border-bottom:.4pt solid #E2E8F0}
.bom{width:100%;border-collapse:collapse;font-size:8pt;margin-bottom:2mm}
.bom th{background:#EDEDED;padding:2.5px 5px;font-weight:700;font-size:7pt;text-transform:uppercase;letter-spacing:.03em;text-align:right;border:.3pt solid #D0D0D0}
.bom th:first-child{text-align:left}
.bom td{padding:2px 5px;border:.3pt solid #D0D0D0;text-align:right;font-variant-numeric:tabular-nums}
.bom td:first-child{text-align:left}
.bom .bg td{background:#EAF0F8;color:${BRAND};font-weight:700;border-left:2.5pt solid ${BRAND};padding:3px 5px}
.bom tr:nth-child(even) td{background:rgba(0,51,102,.02)}
.tots{display:flex;justify-content:flex-end;margin-bottom:2mm}
.ti{min-width:200px;font-size:8.5pt}
.tr{display:flex;justify-content:space-between;padding:1.5px 0;font-variant-numeric:tabular-nums;color:#667085}
.trt{border-top:1.5pt solid ${BRAND};margin-top:2px;padding-top:2px;font-size:12pt;font-weight:800;color:${BRAND}}
.terms{margin-bottom:2mm;padding:4px 8px;background:#F8F9FA;border-radius:4px;border-left:2.5pt solid ${BRAND}}
.terms-title{font-size:7pt;font-weight:700;color:${BRAND};text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px}
.terms ol{margin:0;padding-left:12px;font-size:7pt;line-height:1.45;color:#444}
.terms li{margin-bottom:.5px}
.terms li.hl{color:#CC0000;font-weight:600}
.terms li.bl{font-weight:600}
.bank{display:grid;grid-template-columns:1fr 1fr;gap:1px 8px;padding:4px 8px;background:${BRAND};color:rgba(255,255,255,.7);border-radius:4px;font-size:7.5pt;margin-bottom:2mm}
.bank strong{color:#fff}
.bankt{grid-column:1/-1;font-size:6pt;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin-bottom:1px}
.ftr{border-top:.5pt solid #D0D0D0;padding-top:2mm;display:flex;justify-content:space-between;font-size:6.5pt;color:#667085}
`;

function renderBomDetailRows(bomDetailGroups) {
  return bomDetailGroups.map(g => {
    const groupRow = `<tr class="bg"><td colspan="4">&#9656; ${esc(g.groupName)}</td><td style="text-align:right">${fmt(g.groupTotal)}</td></tr>`;
    const itemRows = g.items.map(i => {
      const qty = typeof i.qty === 'number'
        ? (i.qty % 1 === 0 ? i.qty : i.qty.toFixed(2))
        : (i.qty ?? '');
      return `<tr><td>${esc(i.desc)}</td><td style="text-align:right">${qty}</td><td style="text-align:center">${esc(i.unit)}</td><td style="text-align:right">${fmt(i.pu)}</td><td>${fmt(i.total)}</td></tr>`;
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
  const clientRows = [
    cl.nombre ? `<div><b>Cliente:</b> ${esc(cl.nombre)}</div>` : '<div></div>',
    `<div><b>Fecha:</b> ${esc(q.fecha)}</div>`,
    cl.direccion ? `<div><b>Dir:</b> ${esc(cl.direccion)}</div>` : '<div></div>',
    `<div><b>Ref:</b> ${esc(q.ref)}</div>`,
    cl.telefono ? `<div><b>Tel:</b> ${esc(cl.telefono)}</div>` : '<div></div>',
    cl.rut ? `<div><b>RUT:</b> ${esc(cl.rut)}</div>` : '<div></div>',
  ].join('');

  const kpiParts = [
    q.areaTotalM2 > 0 ? `${Number(q.areaTotalM2).toFixed(1)} m²` : null,
    q.panelCount > 0 ? `${q.panelCount} paneles` : null,
    q.apoyoCount > 0 ? `${q.apoyoCount} apoyos` : null,
    q.fijacionCount > 0 ? `${q.fijacionCount} fijaciones` : null,
  ].filter(Boolean).join(' · ');

  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><title>Presupuesto BMC Uruguay</title>
<style>${CSS}</style>
</head><body>
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <img src="/bmc-pdf/assets/bmc-logo.png" alt="BMC Uruguay" class="hdr-logo" />
      <div><div class="hdr-name">BMC Uruguay</div><div class="hdr-sub">Metalog SAS</div></div>
    </div>
    <div class="hdr-badge">Presupuesto</div>
  </div>
  <div class="meta">${clientRows}</div>
  <div class="prod"><b>Producto / alcance:</b> ${esc(q.panelDescLine)}</div>
  ${kpiParts ? `<div class="kpi-line">${esc(kpiParts)}</div>` : ''}
  <table class="bom"><thead><tr>
    <th style="text-align:left;width:42%">Descripción</th>
    <th style="width:11%">Cant.</th><th style="width:9%;text-align:center">Unid.</th>
    <th style="width:17%">P.U. USD</th><th style="width:21%">Total USD</th>
  </tr></thead><tbody>${renderBomDetailRows(q.bomDetailGroups)}</tbody></table>
  <div class="tots"><div class="ti">
    <div class="tr"><span>Subtotal sin IVA</span><span>USD ${fmt(q.subtotalSinIva)}</span></div>
    <div class="tr"><span>IVA 22%</span><span>USD ${fmt(q.ivaAmount)}</span></div>
    <div class="tr trt"><span>Total USD</span><span>${fmt(q.totalConIva)}</span></div>
  </div></div>
  ${renderTerms()}
  <div class="bank">
    <div class="bankt">Datos para depósito bancario</div>
    <div>Titular: <strong>Metalog SAS</strong></div><div>RUT: <strong>120403430012</strong></div>
    <div>BROU · Cta. Dólares: <strong>110520638-00002</strong></div><div>Consultas: <strong>092 663 245</strong></div>
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
