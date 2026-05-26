// src/pdf-templates/simple-sage.js
// Layout: Simple Sage — Warm sage/olive tones, single A4 page

import { QUOTE_TERMS } from '../utils/helpers.js';

const fmt = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:8mm 10mm}
body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;font-size:8.5pt;color:#2D3A2E;background:#FAF7F0}
.page{width:210mm;min-height:277mm;position:relative;background:#FAF7F0}
@media screen{body{background:#bfb9ae;padding:24px 0}.page{margin:0 auto 32px;box-shadow:0 8px 40px rgba(90,122,96,.22);border-radius:3px;max-width:794px;padding:8mm 10mm}}
@media print{.page{padding:0}}
.hdr{background:linear-gradient(135deg,#5A7A60 0%,#4A6850 100%);border-radius:6px;padding:5mm 6mm;margin-bottom:3mm;display:flex;justify-content:space-between;align-items:center;position:relative;overflow:hidden}
.hdr::before{content:'';position:absolute;top:-20px;right:-20px;width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,.06)}
.hdr::after{content:'';position:absolute;bottom:-30px;right:60px;width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,.04)}
.hdr-left{display:flex;align-items:center;gap:9px;z-index:1}
.hdr-mark{width:30px;height:30px;background:rgba(255,255,255,.15);border:1.5pt solid rgba(255,255,255,.3);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15pt;font-weight:900;color:#fff}
.hdr-name{font-size:11pt;font-weight:800;color:#fff;letter-spacing:.03em}
.hdr-sub{font-size:6pt;color:rgba(255,255,255,.6);letter-spacing:.12em;text-transform:uppercase;margin-top:1px}
.hdr-badge{background:rgba(255,255,255,.18);border:1pt solid rgba(255,255,255,.3);color:#fff;font-size:7pt;font-weight:700;padding:3px 10px;border-radius:12px;letter-spacing:.08em;text-transform:uppercase;z-index:1}
.client-card{background:#fff;border-radius:6px;border:1pt solid rgba(90,122,96,.18);padding:4px 8px;margin-bottom:2.5mm;display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.5mm 10mm;box-shadow:0 1px 4px rgba(90,122,96,.08)}
.client-card b{color:#5A7A60;font-size:7.5pt}
.client-card div{font-size:8pt}
.prod{background:rgba(90,122,96,.08);border-left:3pt solid #5A7A60;padding:3px 8px;border-radius:0 4px 4px 0;margin-bottom:2mm;font-size:8pt}
.prod b{color:#5A7A60}
.kpi-line{font-size:7pt;color:#7A8C7E;margin-bottom:2mm;padding:2px 0;border-bottom:.4pt solid rgba(90,122,96,.2)}
.bom{width:100%;border-collapse:collapse;font-size:8pt;margin-bottom:2mm}
.bom th{background:rgba(90,122,96,.12);padding:2.5px 5px;font-weight:700;font-size:7pt;text-transform:uppercase;letter-spacing:.04em;color:#5A7A60;text-align:right;border:.3pt solid rgba(90,122,96,.2)}
.bom th:first-child{text-align:left}
.bom td{padding:2px 5px;border:.3pt solid rgba(90,122,96,.15);text-align:right;font-variant-numeric:tabular-nums}
.bom td:first-child{text-align:left}
.bom .bg td{background:rgba(90,122,96,.1);color:#4A6850;font-weight:700;border-left:2.5pt solid #5A7A60;padding:3px 5px}
.bom tr:nth-child(even) td{background:rgba(90,122,96,.04)}
.tots{display:flex;justify-content:flex-end;margin-bottom:2mm}
.ti{min-width:200px;background:#fff;border:1pt solid rgba(90,122,96,.2);border-radius:6px;padding:6px 10px;box-shadow:0 1px 4px rgba(90,122,96,.08)}
.tr{display:flex;justify-content:space-between;padding:1.5px 0;font-size:8pt;font-variant-numeric:tabular-nums;color:#7A8C7E}
.trt{background:linear-gradient(90deg,rgba(90,122,96,.1),rgba(90,122,96,.15));border-radius:4px;padding:3px 6px;margin-top:3px;font-size:11pt;font-weight:800;color:#5A7A60}
.terms{margin-bottom:2mm;padding:4px 8px;background:#fff;border-radius:6px;border:1pt solid rgba(90,122,96,.18);box-shadow:0 1px 4px rgba(90,122,96,.07)}
.terms-title{font-size:7pt;font-weight:700;color:#5A7A60;text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px}
.terms-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px 10px}
.term-item{display:flex;align-items:flex-start;gap:4px;padding:1.5px 0;font-size:7pt;line-height:1.4;color:#444}
.term-dot{width:5px;height:5px;border-radius:50%;background:#5A7A60;flex-shrink:0;margin-top:2.5px}
.term-dot.hl{background:#C0392B}
.term-dot.bl{background:#4A6850}
.term-text.hl{color:#C0392B;font-weight:600}
.term-text.bl{font-weight:600}
.bank{display:grid;grid-template-columns:auto 1fr 1fr auto;gap:2px 10px;padding:4px 8px;background:linear-gradient(90deg,#5A7A60,#4A6850);color:rgba(255,255,255,.75);border-radius:5px;font-size:7.5pt;margin-bottom:2mm;align-items:center}
.bank strong{color:#fff}
.bankt{font-size:6pt;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.1em;font-weight:700;grid-column:1/-1;margin-bottom:1px}
.ftr{border-top:.5pt solid rgba(90,122,96,.25);padding-top:2mm;display:flex;justify-content:space-between;font-size:6.5pt;color:#7A8C7E}
`;

function renderBomDetailRows(bomDetailGroups) {
  return bomDetailGroups.map(g => {
    const groupRow = `<tr class="bg"><td colspan="4">&#9656; ${esc(g.groupName)}</td><td style="text-align:right">${fmt(g.groupTotal)}</td></tr>`;
    const itemRows = g.items.map(i => {
      const qty = typeof i.qty === 'number' ? (i.qty % 1 === 0 ? i.qty : i.qty.toFixed(2)) : (i.qty ?? '');
      return `<tr><td>${esc(i.desc)}</td><td style="text-align:right">${qty}</td><td style="text-align:center">${esc(i.unit)}</td><td style="text-align:right">${fmt(i.pu)}</td><td>${fmt(i.total)}</td></tr>`;
    }).join('');
    return groupRow + itemRows;
  }).join('');
}

function renderTerms() {
  const items = QUOTE_TERMS.map(t => {
    const dotCls = t.highlight ? 'hl' : (t.bold ? 'bl' : '');
    const textCls = t.highlight ? 'hl' : (t.bold ? 'bl' : '');
    return `<div class="term-item"><span class="term-dot ${dotCls}"></span><span class="term-text ${textCls}">${esc(t.text)}</span></div>`;
  }).join('');
  return `<div class="terms">
  <div class="terms-title">Condiciones Comerciales</div>
  <div class="terms-grid">${items}</div>
</div>`;
}

export function render(q) {
  const cl = q.bmcExtra?.client ?? {};
  const clientFields = [
    cl.nombre ? `<div><b>Cliente:</b> ${esc(cl.nombre)}</div>` : '<div></div>',
    `<div><b>Fecha:</b> ${esc(q.fecha)}</div>`,
    `<div><b>Ref:</b> ${esc(q.ref)}</div>`,
    cl.direccion ? `<div><b>Dir:</b> ${esc(cl.direccion)}</div>` : '<div></div>',
    cl.telefono ? `<div><b>Tel:</b> ${esc(cl.telefono)}</div>` : '<div></div>',
    `<div><b>Validez:</b> ${esc(q.validez)}</div>`,
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
      <div class="hdr-mark">B</div>
      <div><div class="hdr-name">BMC Uruguay</div><div class="hdr-sub">Metalog SAS</div></div>
    </div>
    <div class="hdr-badge">Presupuesto</div>
  </div>
  <div class="client-card">${clientFields}</div>
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
  <div class="ftr"><span>bmcuruguay.com.uy · 092 663 245 · Metalog SAS</span><span style="color:#5A7A60;font-weight:700">${esc(q.escenario)}</span></div>
</div>
</body></html>`;
}
