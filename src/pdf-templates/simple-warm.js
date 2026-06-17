// src/pdf-templates/simple-warm.js
// Production PDF Template v2 - Refactored 2026-06-16 (scoped, cat-row dark headers, no bullets, clean header)
// Layout: Simple Warm — Terracotta/earth tones, left accent stripe. Single A4 page.

import { QUOTE_TERMS } from '../utils/helpers.js';

const fmt = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;font-size:8.5pt;color:#2D2D2D;background:#F5EFE6}
.page{width:210mm;min-height:297mm;display:flex;flex-direction:row;position:relative;overflow:hidden;background:#F5EFE6}
@media screen{body{background:#a09080;padding:24px 0}.page{margin:0 auto 32px;box-shadow:0 8px 40px rgba(0,0,0,.2);border-radius:2px;max-width:794px}}
.stripe{width:8mm;background:linear-gradient(180deg,#C2662D 0%,#A0522D 100%);flex-shrink:0;position:relative}
.stripe::after{content:'B';position:absolute;top:12mm;left:50%;transform:translateX(-50%) rotate(-90deg);font-size:9pt;font-weight:900;color:rgba(255,255,255,.35);letter-spacing:.15em;white-space:nowrap}
.main{flex:1;display:flex;flex-direction:column;min-width:0}
.hdr{background:linear-gradient(135deg,#C2662D 0%,#A84E20 100%);padding:4mm 6mm 3.5mm;position:relative;overflow:hidden}
.hdr::before{content:'';position:absolute;top:-20px;right:-20px;width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,.07)}
.hdr-row{display:flex;justify-content:space-between;align-items:center;position:relative;z-index:1}
.hdr-left{display:flex;align-items:center;gap:8px}
.hdr-logo{height:26px;width:auto;opacity:0.95;flex-shrink:0}
.hdr-name{font-size:11pt;font-weight:800;color:#fff}
.hdr-sub{font-size:6pt;color:rgba(255,255,255,.55);letter-spacing:.15em;text-transform:uppercase;margin-top:1px}
.hdr-ref{text-align:right;font-size:7.5pt;color:rgba(255,255,255,.7);line-height:1.7}
.hdr-ref strong{color:#fff}
.body{padding:3mm 6mm 0;flex:1}
.sidebar-section{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.5mm 8mm;padding:3px 6px;background:rgba(194,102,45,.07);border-radius:4px;margin-bottom:2.5mm;border:.4pt solid rgba(194,102,45,.18)}
.sf{font-size:7.5pt;color:#6B4226}
.sf strong{color:#2D2D2D;font-weight:600}
.prod{background:#fff;border-left:3pt solid #C2662D;padding:3px 8px;border-radius:0 4px 4px 0;margin-bottom:2mm;font-size:8pt;box-shadow:0 1px 3px rgba(194,102,45,.1)}
.prod strong{color:#C2662D}
.kpi-line{font-size:7pt;color:#9A7060;margin-bottom:2mm;padding:2px 0;border-bottom:.4pt solid rgba(194,102,45,.2)}
.bom{width:100%;border-collapse:collapse;font-size:8pt;margin-bottom:2mm}
.bom th{background:rgba(194,102,45,.15);padding:2.5px 5px;font-weight:700;font-size:7pt;text-transform:uppercase;letter-spacing:.04em;color:#7A3D18;text-align:right;border:.3pt solid rgba(194,102,45,.2)}
.bom th:first-child{text-align:left}
.bom td{padding:2px 5px;border:.3pt solid rgba(194,102,45,.12);text-align:right;font-variant-numeric:tabular-nums}
.bom td:first-child{text-align:left}
/* v2 */
.presupuesto-container ul,.presupuesto-container li,.presupuesto-container .cat-row,
.page ul,.page li,.page .cat-row{list-style:none!important;margin:0;padding:0}
.presupuesto-container .cat-row::before,.page .cat-row::before{content:none!important;display:none!important}
.bom .cat-row td,.bom tr.cat-row td{background:#1e2937!important;color:#fff!important;font-weight:700!important;border-left:3.5pt solid #2563eb!important;padding:4px 6px!important}
.bom tr:nth-child(even) td{background:rgba(194,102,45,.04)}
.tots{display:flex;justify-content:flex-end;margin-bottom:2mm}
.ti{min-width:200px;border:1.5pt solid #C2662D;border-radius:5px;padding:5px 9px;background:#fff}
.tr{display:flex;justify-content:space-between;padding:1.5px 0;font-size:8pt;font-variant-numeric:tabular-nums;color:#9A7060}
.trt{border-top:.5pt solid #C2662D;margin-top:3px;padding-top:3px;font-size:11pt;font-weight:800;color:#C2662D}
.terms{margin-bottom:2mm;padding:4px 6px;background:#fff;border-radius:5px;border:.4pt solid rgba(194,102,45,.2);box-shadow:0 1px 3px rgba(194,102,45,.07)}
.terms-title{font-size:6.5pt;font-weight:700;color:#C2662D;text-transform:uppercase;letter-spacing:.1em;margin-bottom:2.5px}
.term-cats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px 6mm}
.term-cat-hdr{font-size:6.5pt;font-weight:700;color:#C2662D;text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px;padding-bottom:1px;border-bottom:.5pt solid rgba(194,102,45,.3)}
.term-item{display:flex;align-items:flex-start;gap:3px;padding:1px 0;font-size:6.5pt;line-height:1.4;color:#444}
.term-bull{color:#C2662D;font-weight:700;flex-shrink:0;margin-top:.5px}
.term-text.hl{color:#C2662D;font-weight:600}
.term-text.bl{font-weight:600}
.bank{background:#2D2D2D;padding:3.5px 7px;border-radius:4px;display:flex;align-items:center;gap:8mm;font-size:7pt;color:rgba(255,255,255,.6);margin-bottom:2mm}
.bank strong{color:#fff}
.bank-lbl{font-size:6pt;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.35);flex-shrink:0}
.ftr{border-top:.4pt solid rgba(194,102,45,.25);padding:2px 6mm;display:flex;justify-content:space-between;font-size:6.5pt;color:#9A7060}
`;

// Categorize terms for grouped display
const TERM_GROUPS = [
  { label: 'Fabricación y Entrega', indices: [0, 4, 6, 7] },
  { label: 'Pago y Facturación', indices: [1, 2, 3, 11] },
  { label: 'Responsabilidades', indices: [5, 8, 9, 10] },
];

function renderTerms() {
  const cats = TERM_GROUPS.map(cat => {
    const items = cat.indices.map(idx => {
      const t = QUOTE_TERMS[idx];
      if (!t) return '';
      const textCls = t.highlight ? 'hl' : (t.bold ? 'bl' : '');
      return `<div class="term-item"><span class="term-bull">›</span><span class="term-text ${textCls}">${esc(t.text)}</span></div>`;
    }).join('');
    return `<div><div class="term-cat-hdr">${esc(cat.label)}</div>${items}</div>`;
  }).join('');
  return `<div class="terms"><div class="terms-title">Condiciones Comerciales</div><div class="term-cats">${cats}</div></div>`;
}

function renderBomDetailRows(bomDetailGroups) {
  return bomDetailGroups.map(g => {
    const groupRow = `<tr class="cat-row"><td colspan="4">${esc(g.groupName)}</td><td style="text-align:right">${fmt(g.groupTotal)}</td></tr>`;
    const itemRows = g.items.map(i => {
      const qty = typeof i.qty === 'number' ? (i.qty % 1 === 0 ? i.qty : i.qty.toFixed(2)) : (i.qty ?? '');
      return `<tr><td>${esc(i.desc)}</td><td style="text-align:right">${qty}</td><td style="text-align:center">${esc(i.unit)}</td><td style="text-align:right">${fmt(i.pu)}</td><td>${fmt(i.total)}</td></tr>`;
    }).join('');
    return groupRow + itemRows;
  }).join('');
}

export function render(q) {
  const cl = q.bmcExtra?.client ?? {};
  const kpiParts = [
    q.areaTotalM2 > 0 ? `${Number(q.areaTotalM2).toFixed(1)} m²` : null,
    q.panelCount > 0 ? `${q.panelCount} paneles` : null,
    q.apoyoCount > 0 ? `${q.apoyoCount} apoyos` : null,
    q.fijacionCount > 0 ? `${q.fijacionCount} fijaciones` : null,
  ].filter(Boolean).join(' · ');

  const sidebarFields = [
    cl.nombre ? `<div class="sf"><strong>Cliente:</strong> ${esc(cl.nombre)}</div>` : '<div></div>',
    `<div class="sf"><strong>Fecha:</strong> ${esc(q.fecha)}</div>`,
    cl.direccion ? `<div class="sf"><strong>Dir:</strong> ${esc(cl.direccion)}</div>` : '<div></div>',
    `<div class="sf"><strong>Ref:</strong> ${esc(q.ref)}</div>`,
    cl.rut ? `<div class="sf"><strong>RUT:</strong> ${esc(cl.rut)}</div>` : '<div></div>',
    cl.telefono ? `<div class="sf"><strong>Tel:</strong> ${esc(cl.telefono)}</div>` : '<div></div>',
  ].join('');

  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><title>Presupuesto BMC Uruguay</title>
<!-- Production PDF Template v2 - Refactored 2026-06-16 -->
<style>${CSS}</style>
</head><body>
<div class="page presupuesto-container" id="presupuesto">
  <div class="stripe"></div>
  <div class="main">
    <div class="hdr">
      <div class="hdr-row">
        <div class="hdr-left">
          <img src="/bmc-pdf/assets/bmc-logo.png" alt="BMC Uruguay" class="hdr-logo" />
          <div><div class="hdr-name">BMC Uruguay</div><div class="hdr-sub">Metalog SAS</div></div>
        </div>
        <div class="hdr-ref">
          <div><strong>Ref:</strong> ${esc(q.ref)} &nbsp;·&nbsp; <strong>Fecha:</strong> ${esc(q.fecha)}</div>
          <div><strong>Escenario:</strong> ${esc(q.escenario)}</div>
        </div>
      </div>
    </div>
    <div class="body">
      <div class="sidebar-section">${sidebarFields}</div>
      <div class="prod"><strong>Producto / alcance:</strong> ${esc(q.panelDescLine)}</div>
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
        <span class="bank-lbl">Depósito bancario</span>
        <span>Titular: <strong>Metalog SAS</strong></span>
        <span>RUT: <strong>120403430012</strong></span>
        <span>BROU Dólares: <strong>110520638-00002</strong></span>
        <span>Consultas: <strong>092 663 245</strong></span>
      </div>
    </div>
    <div class="ftr"><span>bmcuruguay.com.uy · 092 663 245 · Metalog SAS</span><span style="color:#C2662D;font-weight:700">${esc(q.escenario)}</span></div>
  </div>
</div>
</body></html>`;
}
