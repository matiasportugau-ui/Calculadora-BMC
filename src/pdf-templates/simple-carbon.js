// src/pdf-templates/simple-carbon.js
// Layout: Simple Carbon — Premium dark/carbon header, amber accents, warm gray body. Single A4 page.
// Customer-facing default. Uses real BMC logo from /bmc-pdf/assets/ + CSS color tokens (see :root) for easy branding tweaks.
// Production PDF Template v2 - Refactored 2026-06-16 (scoped, cat-row dark headers, no bullets, clean header)

import { QUOTE_TERMS, COMPANY } from '../utils/helpers.js';

const fmt = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const BRAND = COMPANY?.brandColor || '#003366'; // Keep customer PDFs on official BMC navy identity (bmcuruguay.com.uy + COMPANY)

const CSS = `
/* === BMC CUSTOMER PDF THEME (simple-carbon) — premium dark variant.
   Anchored to official identity: BRAND navy from COMPANY.brandColor (#003366) + bmcuruguay.com.uy.
   Header stays rich dark for "premium" feel; accents and key highlights use BRAND where appropriate for consistency. */
:root {
  --bmc-header: #111827;
  --bmc-header-2: #1F2937;
  --bmc-brand: ${BRAND}; /* Official BMC navy (#003366) — bmcuruguay.com.uy + COMPANY.brandColor identity */
  --bmc-accent: #F59E0B;      /* warm amber accent (premium touch on top of brand) */
  --bmc-accent-2: #D97706;
  --bmc-text: #1F2937;
  --bmc-muted: #6B7280;
  --bmc-totals-bg: #F59E0B;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
/* Production PDF Template v2 - Refactored 2026-06-16 */
@page{size:A4;margin:7mm 8mm}
.presupuesto-container,.page{-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:9pt;line-height:1.25}
.presupuesto-container ul,.presupuesto-container li,.presupuesto-container .cat-row,
.page ul,.page li,.page .cat-row{list-style:none!important;margin:0;padding:0}
.presupuesto-container .cat-row::before,.page .cat-row::before{content:none!important;display:none!important}
body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;font-size:8.5pt;color:#1F2937;background:#F9FAFB}
.page{width:210mm;min-height:297mm;display:flex;flex-direction:column;overflow:hidden;background:#F9FAFB}
@media screen{body{background:#606060;padding:24px 0}.page{margin:0 auto 32px;box-shadow:0 10px 50px rgba(0,0,0,.35);border-radius:3px;max-width:794px}}
.hdr{background:linear-gradient(135deg,var(--bmc-header) 0%,var(--bmc-header-2) 100%);padding:7mm 8mm 5.5mm;position:relative;overflow:hidden;flex-shrink:0}
.hdr::before{content:'';position:absolute;top:-40px;right:-40px;width:150px;height:150px;border-radius:50%;background:rgba(245,158,11,.06)}
.hdr::after{content:'';position:absolute;bottom:-50px;left:20%;width:180px;height:180px;border-radius:50%;background:rgba(245,158,11,.04)}
.hdr-row{display:flex;justify-content:space-between;align-items:center;position:relative;z-index:1}
.hdr-left{display:flex;align-items:center;gap:10px}
.hdr-logo{height:30px;width:auto;filter:brightness(0) invert(1);opacity:0.95;flex-shrink:0}
.hdr-name{font-size:12pt;font-weight:800;color:#fff;letter-spacing:.02em}
.hdr-sub{font-size:6pt;color:rgba(255,255,255,.4);letter-spacing:.18em;text-transform:uppercase;margin-top:1px}
.hdr-right{text-align:right;z-index:1}
.hdr-badge{display:inline-block;background:var(--bmc-accent);color:#111827;font-size:7.5pt;font-weight:900;padding:3px 12px;border-radius:3px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px}
.hdr-meta{font-size:7pt;color:rgba(255,255,255,.5);line-height:1.7}
.hdr-meta strong{color:rgba(255,255,255,.8)}
.body{padding:4mm 8mm 0;flex:1;display:flex;flex-direction:column}
.client-card{background:#fff;border-left:4pt solid var(--bmc-accent);border-radius:0 6px 6px 0;padding:4px 10px;margin-bottom:2.5mm;display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.5mm 8mm;box-shadow:0 2px 8px rgba(0,0,0,.07)}
.client-card div{font-size:7.5pt;color:#6B7280}
.client-card b{color:#1F2937;font-weight:600}
.prod{background:#fff;border-bottom:2pt solid var(--bmc-accent);padding:3px 8px;margin-bottom:2mm;font-size:8pt;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.prod strong{color:var(--bmc-accent-2)}
.kpi-line{font-size:7pt;color:#9CA3AF;margin-bottom:2mm;padding:2px 0;border-bottom:.4pt solid #E5E7EB}
.bom{width:100%;border-collapse:collapse;font-size:8pt;margin-bottom:2mm}
.bom th{background:#1F2937;color:#fff;padding:2.5px 5px;font-weight:700;font-size:7pt;text-transform:uppercase;letter-spacing:.04em;text-align:right}
.bom th:first-child{text-align:left}
.bom td{padding:2px 5px;border-bottom:.3pt solid #F3F4F6;text-align:right;font-variant-numeric:tabular-nums;color:#374151}
.bom td:first-child{text-align:left}
.bom .cat-row td,.bom tr.cat-row td{background:#1e2937!important;color:#fff!important;font-weight:700!important;border-left:3.5pt solid #2563eb!important;padding:4px 6px!important}
.bom tr:nth-child(even) td{background:rgba(249,250,251,1)}
.tots{display:flex;justify-content:flex-end;margin-bottom:2mm}
.ti{min-width:200px;background:var(--bmc-totals-bg);border-radius:6px;padding:6px 10px}
.tr{display:flex;justify-content:space-between;padding:1.5px 0;font-size:8pt;font-variant-numeric:tabular-nums;color:rgba(17,24,39,.65)}
.trt{border-top:1.5pt solid rgba(17,24,39,.3);margin-top:3px;padding-top:3px;font-size:12pt;font-weight:900;color:#111827}
.body-main{flex:1}
.dark-footer{background:linear-gradient(180deg,#111827 0%,#0D1117 100%);padding:4mm 8mm 3mm;margin-top:auto;position:relative;overflow:hidden}
.dark-footer::before{content:'';position:absolute;top:0;left:0;right:0;height:.5pt;background:linear-gradient(90deg,var(--bmc-accent),rgba(245,158,11,0))}
.terms-title{font-size:6.5pt;font-weight:700;color:var(--bmc-accent);text-transform:uppercase;letter-spacing:.12em;margin-bottom:3px}
.terms-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.5px 5mm}
.term-item{display:flex;align-items:flex-start;gap:3px;padding:1px 0;font-size:6.5pt;line-height:1.4;color:rgba(255,255,255,.55)}
.term-dot{width:4px;height:4px;border-radius:50%;background:rgba(245,158,11,.4);flex-shrink:0;margin-top:2.5px}
.term-dot.hl{background:var(--bmc-accent)}
.term-dot.bl{background:rgba(245,158,11,.65)}
.term-text.hl{color:rgba(245,158,11,.95);font-weight:600}
.term-text.bl{color:rgba(255,255,255,.78);font-weight:600}
.bank-strip{border-top:.5pt solid rgba(245,158,11,.2);margin-top:3mm;padding-top:2.5mm;display:flex;gap:8mm;align-items:center;font-size:7pt;color:rgba(255,255,255,.5)}
.bank-strip strong{color:rgba(255,255,255,.85)}
.bank-lbl{font-size:6pt;text-transform:uppercase;letter-spacing:.1em;color:rgba(245,158,11,.6);flex-shrink:0;font-weight:700}
.ftr-line{border-top:.4pt solid rgba(245,158,11,.15);margin-top:2.5mm;padding-top:2mm;display:flex;justify-content:space-between;font-size:6.5pt;color:rgba(255,255,255,.3)}
.ftr-acc{color:rgba(245,158,11,.6);font-weight:600}
`;

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

function renderTerms() {
  const items = QUOTE_TERMS.map(t => {
    const dotCls = t.highlight ? 'hl' : (t.bold ? 'bl' : '');
    const textCls = t.highlight ? 'hl' : (t.bold ? 'bl' : '');
    return `<div class="term-item"><span class="term-dot ${dotCls}"></span><span class="term-text ${textCls}">${esc(t.text)}</span></div>`;
  }).join('');
  return `<div class="terms-title">Condiciones Comerciales</div><div class="terms-grid">${items}</div>`;
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
<!-- Production PDF Template v2 - Refactored 2026-06-16 -->
<style>${CSS}</style>
</head><body>
<div class="page presupuesto-container" id="presupuesto">
  <div class="hdr">
    <div class="hdr-row">
      <div class="hdr-left">
        <img src="/bmc-pdf/assets/bmc-logo.png" alt="BMC" class="hdr-logo" />
      </div>
      <div class="hdr-right">
        <div class="hdr-badge">Presupuesto</div>
        <div class="hdr-meta"><strong>Ref:</strong> ${esc(q.ref)} &nbsp;·&nbsp; <strong>Fecha:</strong> ${esc(q.fecha)}</div>
        <div class="hdr-meta"><strong>Escenario:</strong> ${esc(q.escenario)}</div>
      </div>
    </div>
  </div>
  <div class="body">
    <div class="body-main">
      <div class="client-card">${clientFields}</div>
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
    </div>
    <div class="dark-footer">
      ${renderTerms()}
      <div class="bank-strip">
        <span class="bank-lbl">Depósito bancario</span>
        <span>Titular: <strong>Metalog SAS</strong></span>
        <span>RUT: <strong>120403430012</strong></span>
        <span>BROU Dólares: <strong>110520638-00002</strong></span>
        <span>Consultas: <strong>092 663 245</strong></span>
      </div>
      <div class="ftr-line">
        <span>bmcuruguay.com.uy · 092 663 245 · Metalog SAS</span>
        <span class="ftr-acc">
          ${esc(q.escenario)}
          ${q.quoteId || q.ref ? ` · ${esc(q.quoteId || q.ref)}` : ''}
          ${q.version ? `v${q.version}` : ''}
        </span>
      </div>
    </div>
  </div>
</div>
</body></html>`;
}
