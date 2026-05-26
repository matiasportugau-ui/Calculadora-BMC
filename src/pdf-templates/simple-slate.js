// src/pdf-templates/simple-slate.js
// Layout: Simple Slate — Modern dark header, sky-blue accent, clean body. Single A4 page.

import { QUOTE_TERMS } from '../utils/helpers.js';

const fmt = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;font-size:8.5pt;color:#1E293B;background:#fff}
.page{width:210mm;min-height:297mm;position:relative;overflow:hidden;background:#fff}
@media screen{body{background:#8a96a8;padding:24px 0}.page{margin:0 auto 32px;box-shadow:0 8px 40px rgba(0,0,0,.22);border-radius:2px;max-width:794px}}
.hdr{background:linear-gradient(135deg,#1E293B 0%,#0F172A 100%);padding:7mm 8mm 5mm;position:relative;overflow:hidden}
.hdr::before{content:'';position:absolute;top:-30px;right:-30px;width:130px;height:130px;border-radius:50%;background:rgba(14,165,233,.08)}
.hdr::after{content:'';position:absolute;bottom:-40px;left:40%;width:160px;height:160px;border-radius:50%;background:rgba(14,165,233,.05)}
.hdr-row{display:flex;justify-content:space-between;align-items:center;z-index:1;position:relative}
.hdr-left{display:flex;align-items:center;gap:10px}
.hdr-mark{width:32px;height:32px;background:linear-gradient(135deg,#0EA5E9,#0284C7);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16pt;font-weight:900;color:#fff;box-shadow:0 2px 8px rgba(14,165,233,.4)}
.hdr-name{font-size:12pt;font-weight:800;color:#fff;letter-spacing:.02em}
.hdr-sub{font-size:6pt;color:rgba(255,255,255,.45);letter-spacing:.15em;text-transform:uppercase;margin-top:1px}
.hdr-right{text-align:right;z-index:1}
.hdr-badge{display:inline-block;background:#0EA5E9;color:#fff;font-size:7pt;font-weight:800;padding:3px 11px;border-radius:3px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}
.hdr-meta{font-size:7pt;color:rgba(255,255,255,.55);line-height:1.7}
.hdr-meta strong{color:rgba(255,255,255,.85)}
.body{padding:4mm 8mm 0}
.client-row{display:flex;gap:6mm;margin-bottom:2.5mm;padding-bottom:2.5mm;border-bottom:.4pt solid #E2E8F0}
.client-field{font-size:7.5pt;color:#64748B;white-space:nowrap}
.client-field strong{color:#1E293B;font-weight:600}
.prod{background:rgba(14,165,233,.06);border-left:2.5pt solid #0EA5E9;padding:3px 8px;border-radius:0 4px 4px 0;margin-bottom:2mm;font-size:8pt}
.prod strong{color:#0EA5E9}
.kpi-line{font-size:7pt;color:#94A3B8;margin-bottom:2.5mm;letter-spacing:.01em}
.bom{width:100%;border-collapse:collapse;font-size:8pt;margin-bottom:2mm}
.bom th{padding:2.5px 5px;font-weight:700;font-size:7pt;text-transform:uppercase;letter-spacing:.04em;color:#64748B;text-align:right;border-bottom:.5pt solid #E2E8F0;border-top:.5pt solid #E2E8F0}
.bom th:first-child{text-align:left}
.bom td{padding:2px 5px;border-bottom:.3pt solid #F1F5F9;text-align:right;font-variant-numeric:tabular-nums;color:#334155}
.bom td:first-child{text-align:left}
.bom .bg td{background:#0EA5E9!important;color:#fff!important;font-weight:700!important;font-size:7.5pt;padding:3px 5px!important;border:none!important}
.tots{display:flex;justify-content:flex-end;margin-bottom:2.5mm}
.ti{min-width:210px;border-right:3pt solid #1E293B;padding:5px 10px;background:#F8FAFC}
.tr{display:flex;justify-content:space-between;padding:1.5px 0;font-size:8pt;font-variant-numeric:tabular-nums;color:#64748B}
.trt{border-top:.5pt solid #1E293B;margin-top:3px;padding-top:4px;font-size:12pt;font-weight:800;color:#1E293B}
.terms{margin-bottom:2mm;padding:4px 8px;background:#F8FAFC;border-radius:4px;border:.4pt solid #E2E8F0}
.terms-title{font-size:6.5pt;font-weight:700;color:#0EA5E9;text-transform:uppercase;letter-spacing:.12em;margin-bottom:3px}
.terms-flow{font-size:7pt;color:#64748B;line-height:1.6;text-align:justify}
.terms-flow .sep{color:#CBD5E1;font-weight:400;padding:0 2px}
.terms-flow .bold{font-weight:600;color:#334155}
.terms-flow .hl{font-weight:700;color:#0EA5E9}
.bank{background:#1E293B;padding:4px 8px;display:flex;gap:10mm;align-items:center;font-size:7pt;color:rgba(255,255,255,.55);margin-bottom:2mm;border-radius:4px}
.bank strong{color:#fff}
.bank-label{font-size:6pt;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.3);font-weight:700;flex-shrink:0}
.ftr{padding:0 8mm 3mm;display:flex;justify-content:space-between;font-size:6.5pt;color:#94A3B8}
.ftr-acc{color:#0EA5E9;font-weight:600}
`;

function renderBomDetailRows(bomDetailGroups) {
  return bomDetailGroups.map(g => {
    const groupRow = `<tr class="bg"><td colspan="4">&#9656; ${esc(g.groupName)}</td><td style="text-align:right">$${fmt(g.groupTotal)}</td></tr>`;
    const itemRows = g.items.map(i => {
      const qty = typeof i.qty === 'number' ? (i.qty % 1 === 0 ? i.qty : i.qty.toFixed(2)) : (i.qty ?? '');
      return `<tr><td>${esc(i.desc)}</td><td style="text-align:right">${qty}</td><td style="text-align:center">${esc(i.unit)}</td><td style="text-align:right">${fmt(i.pu)}</td><td>${fmt(i.total)}</td></tr>`;
    }).join('');
    return groupRow + itemRows;
  }).join('');
}

function renderTerms() {
  const parts = QUOTE_TERMS.map(t => {
    if (t.highlight) return `<span class="hl">${esc(t.text)}</span>`;
    if (t.bold) return `<span class="bold">${esc(t.text)}</span>`;
    return `<span>${esc(t.text)}</span>`;
  });
  const joined = parts.map((p, i) => i < parts.length - 1 ? p + `<span class="sep">·</span>` : p).join(' ');
  return `<div class="terms"><div class="terms-title">Condiciones Comerciales</div><div class="terms-flow">${joined}</div></div>`;
}

export function render(q) {
  const cl = q.bmcExtra?.client ?? {};
  const kpiParts = [
    q.areaTotalM2 > 0 ? `${Number(q.areaTotalM2).toFixed(1)} m²` : null,
    q.panelCount > 0 ? `${q.panelCount} paneles` : null,
    q.apoyoCount > 0 ? `${q.apoyoCount} apoyos` : null,
    q.fijacionCount > 0 ? `${q.fijacionCount} fijaciones` : null,
  ].filter(Boolean).join('  ·  ');

  const clientFields = [
    cl.nombre ? `<div class="client-field"><strong>Cliente:</strong> ${esc(cl.nombre)}</div>` : '',
    cl.razonSocial && cl.razonSocial !== cl.nombre ? `<div class="client-field"><strong>Razón social:</strong> ${esc(cl.razonSocial)}</div>` : '',
    cl.rut ? `<div class="client-field"><strong>RUT:</strong> ${esc(cl.rut)}</div>` : '',
    cl.direccion ? `<div class="client-field"><strong>Dir:</strong> ${esc(cl.direccion)}</div>` : '',
    cl.telefono ? `<div class="client-field"><strong>Tel:</strong> ${esc(cl.telefono)}</div>` : '',
    `<div class="client-field"><strong>Validez:</strong> ${esc(q.validez)}</div>`,
  ].filter(Boolean).join('');

  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><title>Presupuesto BMC Uruguay</title>
<style>${CSS}</style>
</head><body>
<div class="page">
  <div class="hdr">
    <div class="hdr-row">
      <div class="hdr-left">
        <div class="hdr-mark">B</div>
        <div><div class="hdr-name">BMC Uruguay</div><div class="hdr-sub">Metalog SAS</div></div>
      </div>
      <div class="hdr-right">
        <div class="hdr-badge">Presupuesto</div>
        <div class="hdr-meta"><strong>Ref:</strong> ${esc(q.ref)} &nbsp;·&nbsp; <strong>Fecha:</strong> ${esc(q.fecha)}</div>
        <div class="hdr-meta"><strong>Escenario:</strong> ${esc(q.escenario)}</div>
      </div>
    </div>
  </div>
  <div class="body">
    <div class="client-row">${clientFields}</div>
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
      <span class="bank-label">Depósito bancario</span>
      <span>Titular: <strong>Metalog SAS</strong></span>
      <span>RUT: <strong>120403430012</strong></span>
      <span>BROU Dólares: <strong>110520638-00002</strong></span>
      <span>Consultas: <strong>092 663 245</strong></span>
    </div>
  </div>
  <div class="ftr"><span>bmcuruguay.com.uy · 092 663 245 · Metalog SAS</span><span class="ftr-acc">${esc(q.escenario)}</span></div>
</div>
</body></html>`;
}
