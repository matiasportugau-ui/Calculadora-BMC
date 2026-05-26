// src/pdf-templates/simple-ocean.js
// Layout: Simple Ocean — Gradient teal/aqua tones, pill-badge terms. Single A4 page.

import { QUOTE_TERMS } from '../utils/helpers.js';

const fmt = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:8mm 10mm}
body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;font-size:8.5pt;color:#0F3D3D;background:linear-gradient(180deg,#F0FDFA 0%,#CCFBF1 100%)}
.page{width:210mm;min-height:277mm;position:relative;background:linear-gradient(180deg,#F0FDFA 0%,#E6FAF5 100%)}
@media screen{body{background:#5FA8A8;padding:24px 0}.page{margin:0 auto 32px;box-shadow:0 8px 40px rgba(13,79,79,.25);border-radius:4px;max-width:794px;padding:8mm 10mm}}
@media print{.page{padding:0}}
.hdr{background:linear-gradient(135deg,#0D4F4F 0%,#0A3E3E 100%);border-radius:8px;padding:5mm 6mm;margin-bottom:3mm;display:flex;justify-content:space-between;align-items:center;position:relative;overflow:hidden}
.hdr::before{content:'';position:absolute;top:-25px;right:-25px;width:120px;height:120px;border-radius:50%;background:rgba(45,212,191,.1)}
.hdr::after{content:'';position:absolute;bottom:-35px;left:30%;width:160px;height:160px;border-radius:50%;background:rgba(45,212,191,.06)}
.hdr-left{display:flex;align-items:center;gap:10px;z-index:1}
.hdr-mark{width:32px;height:32px;background:linear-gradient(135deg,#2DD4BF,#14B8A6);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16pt;font-weight:900;color:#0D4F4F;box-shadow:0 3px 10px rgba(45,212,191,.4)}
.hdr-name{font-size:11pt;font-weight:800;color:#fff}
.hdr-sub{font-size:6pt;color:rgba(255,255,255,.45);letter-spacing:.15em;text-transform:uppercase;margin-top:1px}
.hdr-badge{background:linear-gradient(135deg,#2DD4BF,#14B8A6);color:#0D4F4F;font-size:7pt;font-weight:800;padding:4px 14px;border-radius:20px;letter-spacing:.06em;text-transform:uppercase;z-index:1;box-shadow:0 2px 8px rgba(45,212,191,.35)}
.client-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.5mm 8mm;padding:4px 8px;background:rgba(255,255,255,.7);border:1pt solid rgba(13,79,79,.15);border-radius:6px;margin-bottom:2.5mm;backdrop-filter:blur(2px)}
.client-grid div{font-size:7.5pt;color:#0F3D3D}
.client-grid b{color:#0D4F4F}
.prod{background:rgba(45,212,191,.12);border-left:3pt solid #2DD4BF;padding:3px 8px;border-radius:0 5px 5px 0;margin-bottom:2mm;font-size:8pt}
.prod strong{color:#0D4F4F}
.kpi-line{font-size:7pt;color:#5F9EA0;margin-bottom:2mm;padding-bottom:2px;border-bottom:.4pt solid rgba(13,79,79,.15)}
.bom{width:100%;border-collapse:collapse;font-size:8pt;margin-bottom:2mm}
.bom th{background:#0D4F4F;color:#fff;padding:2.5px 5px;font-weight:700;font-size:7pt;text-transform:uppercase;letter-spacing:.04em;text-align:right}
.bom th:first-child{text-align:left}
.bom td{padding:2px 5px;border-bottom:.3pt solid rgba(13,79,79,.1);text-align:right;font-variant-numeric:tabular-nums}
.bom td:first-child{text-align:left}
.bom .bg td{background:rgba(45,212,191,.18)!important;color:#0D4F4F!important;font-weight:700!important;border-bottom:.5pt solid rgba(13,79,79,.2)!important;padding:3px 5px!important}
.bom tr:nth-child(even) td{background:rgba(240,253,250,.8)}
.tots{display:flex;justify-content:flex-end;margin-bottom:2mm}
.ti{min-width:200px;background:linear-gradient(135deg,#0D4F4F,#2DD4BF);border-radius:7px;padding:6px 10px}
.tr{display:flex;justify-content:space-between;padding:1.5px 0;font-size:8pt;font-variant-numeric:tabular-nums;color:rgba(255,255,255,.75)}
.trt{background:rgba(255,255,255,.15);border-radius:4px;padding:3px 6px;margin-top:3px;font-size:11pt;font-weight:800;color:#fff}
.terms{margin-bottom:2mm;padding:4px 8px;background:rgba(255,255,255,.6);border-radius:6px;border:1pt solid rgba(13,79,79,.15)}
.terms-title{font-size:6.5pt;font-weight:700;color:#0D4F4F;text-transform:uppercase;letter-spacing:.12em;margin-bottom:3px}
.terms-pills{display:flex;flex-wrap:wrap;gap:2px 3px}
.pill{display:inline-flex;align-items:center;padding:1.5px 6px;border-radius:20px;border:1pt solid #2DD4BF;font-size:6.5pt;line-height:1.45;color:#0D4F4F;background:rgba(255,255,255,.5)}
.pill.hl{background:#0D4F4F;color:#2DD4BF;border-color:#0D4F4F;font-weight:700}
.pill.bl{background:rgba(13,79,79,.08);font-weight:600}
.bank{padding:3.5px 8px;background:rgba(255,255,255,.65);border:1pt solid rgba(45,212,191,.4);border-radius:6px;display:flex;gap:8mm;font-size:7pt;color:#0F3D3D;margin-bottom:2mm;align-items:center;border-left:3pt solid #2DD4BF}
.bank strong{color:#0D4F4F}
.bank-lbl{font-size:6pt;text-transform:uppercase;letter-spacing:.1em;color:#2DD4BF;font-weight:700;flex-shrink:0}
.ftr{border-top:.4pt solid rgba(13,79,79,.2);padding-top:2mm;display:flex;justify-content:space-between;font-size:6.5pt;color:#5F9EA0}
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
  const pills = QUOTE_TERMS.map(t => {
    const cls = t.highlight ? 'hl' : (t.bold ? 'bl' : '');
    return `<span class="pill ${cls}">${esc(t.text)}</span>`;
  }).join('');
  return `<div class="terms"><div class="terms-title">Condiciones Comerciales</div><div class="terms-pills">${pills}</div></div>`;
}

export function render(q) {
  const cl = q.bmcExtra?.client ?? {};
  const kpiParts = [
    q.areaTotalM2 > 0 ? `${Number(q.areaTotalM2).toFixed(1)} m²` : null,
    q.panelCount > 0 ? `${q.panelCount} paneles` : null,
    q.apoyoCount > 0 ? `${q.apoyoCount} apoyos` : null,
    q.fijacionCount > 0 ? `${q.fijacionCount} fijaciones` : null,
  ].filter(Boolean).join(' · ');

  const clientFields = [
    cl.nombre ? `<div><b>Cliente:</b> ${esc(cl.nombre)}</div>` : '<div></div>',
    `<div><b>Fecha:</b> ${esc(q.fecha)}</div>`,
    cl.direccion ? `<div><b>Dir:</b> ${esc(cl.direccion)}</div>` : '<div></div>',
    `<div><b>Ref:</b> ${esc(q.ref)}</div>`,
    cl.rut ? `<div><b>RUT:</b> ${esc(cl.rut)}</div>` : '<div></div>',
    cl.telefono ? `<div><b>Tel:</b> ${esc(cl.telefono)}</div>` : '<div></div>',
  ].join('');

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
  <div class="client-grid">${clientFields}</div>
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
    <span class="bank-lbl">Depósito</span>
    <span>Titular: <strong>Metalog SAS</strong></span>
    <span>RUT: <strong>120403430012</strong></span>
    <span>BROU Dólares: <strong>110520638-00002</strong></span>
    <span>Consultas: <strong>092 663 245</strong></span>
  </div>
  <div class="ftr"><span>bmcuruguay.com.uy · 092 663 245 · Metalog SAS</span><span style="color:#0D4F4F;font-weight:700">${esc(q.escenario)}</span></div>
</div>
</body></html>`;
}
