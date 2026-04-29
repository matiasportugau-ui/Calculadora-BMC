// src/pdf-templates/minimalist.js — Layout C: Black & White Minimalist

const fmt = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;font-size:10pt;color:#000;background:#fff}
.page{width:210mm;min-height:297mm;position:relative;overflow:hidden;background:#fff;padding:14mm}
@media screen{body{background:#ddd;padding:24px 0}.page{margin:0 auto 32px;box-shadow:0 2px 20px rgba(0,0,0,.18);max-width:794px}}
@media print{.page{page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}}
.logo-line{display:flex;align-items:baseline;gap:8px;margin-bottom:14mm}
.logo-mark{font-size:28pt;font-weight:900;color:#000;letter-spacing:-.02em}
.logo-sub{font-size:8pt;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:#888}
.rule{height:.5pt;background:#000;margin:0 0 10mm}
.cover-label{font-size:7pt;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#999;margin-bottom:3mm}
.cover-h1{font-size:32pt;font-weight:900;letter-spacing:-.02em;line-height:1.0;margin-bottom:3mm;color:#000}
.cover-product{font-size:10pt;color:#555;margin-bottom:12mm}
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;margin-bottom:10mm;border-top:.5pt solid #000;border-left:.5pt solid #000}
.mg{border-right:.5pt solid #000;border-bottom:.5pt solid #000;padding:5px 8px}
.mgl{font-size:6.5pt;color:#999;text-transform:uppercase;letter-spacing:.12em;font-weight:700;margin-bottom:1mm}
.mgv{font-size:9.5pt;font-weight:700}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-top:.5pt solid #000;border-left:.5pt solid #000;margin-bottom:10mm}
.kk{border-right:.5pt solid #000;border-bottom:.5pt solid #000;padding:8px}
.kkl{font-size:6pt;color:#999;text-transform:uppercase;letter-spacing:.12em;font-weight:700}
.kkv{font-size:22pt;font-weight:900;letter-spacing:-.02em;line-height:1}
.kku{font-size:7pt;color:#888;margin-top:1px}
.groups{margin-bottom:8mm}
.gr{display:flex;justify-content:space-between;align-items:baseline;padding:4px 0;border-bottom:.3pt solid #E8E8E8;font-size:9.5pt}
.gn{color:#333}.gv{font-weight:700;font-variant-numeric:tabular-nums}
.total-block{border-top:2pt solid #000;border-bottom:.5pt solid #000;padding:6px 0;display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6mm}
.total-label{font-size:8pt;color:#555;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.total-sub{font-size:7.5pt;color:#888;margin-top:1px}
.total-amount{font-size:30pt;font-weight:900;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:#FF3B30}
.cond{font-size:7.5pt;color:#888;line-height:1.6}.cond strong{color:#000}
.pg-line{position:absolute;bottom:14mm;left:14mm;right:14mm;display:flex;justify-content:space-between;font-size:7pt;color:#aaa;border-top:.3pt solid #E8E8E8;padding-top:2.5mm}
.pg-n{font-weight:700;color:#000}
.ph{display:flex;justify-content:space-between;align-items:baseline;border-bottom:.5pt solid #000;padding-bottom:4mm;margin-bottom:6mm}
.ph-left{font-size:13pt;font-weight:900;letter-spacing:-.01em}
.ph-right{font-size:8pt;color:#555;text-align:right}.ph-right strong{color:#000}
.sec{font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.18em;color:#aaa;margin:4mm 0 3mm;padding-bottom:2mm;border-bottom:.3pt solid #E8E8E8}
.plan-wrap{border:.5pt solid #000;margin-bottom:5mm}
.plan-hdr{padding:4px 8px;font-size:7pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border-bottom:.5pt solid #000;display:flex;justify-content:space-between}
.plan-body{padding:4px;background:#fff}
.leg{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5mm 4mm;margin-bottom:3mm}
.li{display:flex;align-items:center;gap:6px;font-size:7.5pt;color:#666}.sw{width:20px;height:10px;border-radius:0;flex-shrink:0}
.zt{width:100%;border-collapse:collapse;font-size:8.5pt;margin-bottom:3mm}
.zt th{padding:4px 6px;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:.5pt solid #000;border-top:.5pt solid #000;text-align:right}
.zt th:first-child,.zt th:nth-child(2){text-align:left}
.zt td{padding:4px 6px;border-bottom:.3pt solid #E8E8E8;text-align:right;font-variant-numeric:tabular-nums}
.zt td:first-child,.zt td:nth-child(2){text-align:left}
.bom{width:100%;border-collapse:collapse;font-size:8.5pt}
.bom th{padding:4px 6px;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:.5pt solid #000;border-top:.5pt solid #000;text-align:right}
.bom th:first-child{text-align:left}
.bom td{padding:3px 6px;border-bottom:.3pt solid #EBEBEB;text-align:right;font-variant-numeric:tabular-nums}
.bom td:first-child{text-align:left}
.bom .bg td{font-weight:800!important;border-bottom:.5pt solid #000!important;border-top:.5pt solid #000!important;padding-top:5px!important;padding-bottom:5px!important;background:#fff!important;color:#000!important}
.bom .bg td:first-child{color:#FF3B30!important}
.tots{margin-top:4mm;display:flex;justify-content:flex-end}
.ti{min-width:220px;border-top:.5pt solid #000}
.tr{display:flex;justify-content:space-between;padding:2px 0;font-size:9pt;font-variant-numeric:tabular-nums;border-bottom:.3pt solid #E8E8E8}
.trt{border-top:2pt solid #000;border-bottom:none;padding-top:4px;font-size:14pt;font-weight:900}
.cond-q{margin-top:4mm;font-size:7.5pt;color:#666;line-height:1.6;padding-top:3mm;border-top:.3pt solid #E8E8E8}
.cond-q strong{color:#000}
.bank{margin-top:3mm;font-size:7.5pt;display:grid;grid-template-columns:1fr 1fr;gap:2px 10px;padding:8px;background:#F5F5F5;border-left:2pt solid #FF3B30}
.bank strong{color:#000;font-weight:700}.bankt{grid-column:1/-1;font-size:6pt;text-transform:uppercase;letter-spacing:.14em;font-weight:700;color:#999;margin-bottom:2px}
`;

function planC(svg, title, sum) {
  const inner = svg ? svg.replace(/width="[^"]*"/, 'width="100%"').replace(/height="[^"]*"/, '') : `<div style="padding:20px;text-align:center;color:#aaa;font-size:9pt">Plano 2D no disponible</div>`;
  return `<div class="plan-wrap"><div class="plan-hdr"><span>${esc(title)}</span><span>${esc(sum)}</span></div><div class="plan-body">${inner}</div></div>`;
}
function zoneRowsC(rows) {
  const r = rows.map(r => `<tr><td><strong>${esc(r.zona)}</strong></td><td>${esc(r.desc)}</td><td>${esc(r.largo)}</td><td>${esc(r.ancho)}</td><td>${r.paneles}</td><td>${esc(r.area)}</td><td>${esc(r.au)}</td></tr>`).join('');
  const tp = rows.reduce((s, r) => s + (Number(r.paneles) || 0), 0);
  const ta = rows.reduce((s, r) => s + parseFloat(r.area), 0);
  return r + `<tr style="font-weight:700"><td colspan="4"><strong>TOTAL</strong></td><td><strong>${tp}</strong></td><td><strong>${ta.toFixed(2)} m²</strong></td><td></td></tr>`;
}
function bomC(groups) {
  return groups.map(g => {
    const gh = `<tr class="bg"><td colspan="4">&#9658; ${esc(g.groupName)}</td><td style="text-align:right">${fmt(g.groupTotal)}</td></tr>`;
    const ih = g.items.map(i => { const q = typeof i.qty === 'number' ? (i.qty % 1 === 0 ? i.qty : i.qty.toFixed(2)) : (i.qty ?? ''); return `<tr><td>${esc(i.desc)}</td><td style="text-align:right">${q}</td><td style="text-align:center">${esc(i.unit)}</td><td style="text-align:right">${fmt(i.pu)}</td><td style="text-align:right">${fmt(i.total)}</td></tr>`; }).join('');
    return gh + ih;
  }).join('');
}

export function render(q) {
  const p1 = `<div class="page">
  <div class="logo-line"><span class="logo-mark">BMC</span><span class="logo-sub">Uruguay</span></div>
  <div class="rule"></div>
  <div class="cover-label">Propuesta Comercial</div>
  <div class="cover-h1">Cotización</div>
  <div class="cover-product">${esc(q.panelDescLine)}</div>
  <div class="meta-grid">
    <div class="mg"><div class="mgl">Referencia</div><div class="mgv">${esc(q.ref)}</div></div>
    <div class="mg"><div class="mgl">Fecha</div><div class="mgv">${esc(q.fecha)}</div></div>
    <div class="mg"><div class="mgl">Escenario</div><div class="mgv">${esc(q.escenario)}</div></div>
    <div class="mg"><div class="mgl">Validez</div><div class="mgv">${esc(q.validez)}</div></div>
  </div>
  <div class="kpis">
    <div class="kk"><div class="kkl">Área</div><div class="kkv">${Number(q.areaTotalM2).toFixed(1)}</div><div class="kku">m²</div></div>
    <div class="kk"><div class="kkl">Paneles</div><div class="kkv">${q.panelCount}</div><div class="kku">unid</div></div>
    <div class="kk"><div class="kkl">Apoyos</div><div class="kkv">${q.apoyoCount}</div><div class="kku">estruct</div></div>
    <div class="kk"><div class="kkl">Fijaciones</div><div class="kkv">${q.fijacionCount}</div><div class="kku">puntos</div></div>
  </div>
  <div class="groups">${q.bomGroups.map(g => `<div class="gr"><span class="gn">${esc(g.name)}</span><span class="gv">USD ${fmt(g.totalUsd)}</span></div>`).join('')}</div>
  <div class="total-block">
    <div><div class="total-label">Total con IVA 22%</div><div class="total-sub">Subtotal s/IVA: USD ${fmt(q.subtotalSinIva)} · IVA: USD ${fmt(q.ivaAmount)}</div></div>
    <div class="total-amount">${fmt(q.totalConIva)}</div>
  </div>
  <div class="cond"><strong>Condiciones:</strong> ${esc(q.conditionsText)}</div>
  <div class="pg-line"><span>bmcuruguay.com.uy · 092 663 245 · Metalog SAS</span><span class="pg-n">1 / 3</span></div>
</div>`;

  const p2 = `<div class="page">
  <div class="ph"><span class="ph-left">BMC Uruguay</span><div class="ph-right"><div><strong>Ref:</strong> ${esc(q.ref)}</div><div><strong>Fecha:</strong> ${esc(q.fecha)}</div></div></div>
  <div class="sec">Visualización 2D · Planta de Cubierta</div>
  ${planC(q.svgPlanHtml, q.planTitle, q.planSummary)}
  ${q.zoneRows.length ? `<div class="sec">Leyenda</div>
  <div class="leg">
    <div class="li"><div class="sw" style="background:#F5F5F5;border:1px solid #000"></div><span>Panel impar</span></div>
    <div class="li"><div class="sw" style="background:#E8E8E8;border:1px solid #000"></div><span>Panel par</span></div>
    <div class="li"><div class="sw" style="background:#000;height:6px;margin-top:2px"></div><span>Gotero perimetral</span></div>
    <div class="li"><div class="sw" style="background:none;border:1.5px dashed #888"></div><span>Encuentro de zonas</span></div>
    <div class="li" style="gap:8px"><span style="font-size:11pt">&#8595;</span><span>Dirección pendiente</span></div>
    <div class="li"><div class="sw" style="background:#000"></div><span>Borde sellado</span></div>
  </div>
  <div class="sec">Resumen de Zonas</div>
  <table class="zt"><thead><tr><th style="text-align:left">Zona</th><th style="text-align:left">Descripción</th><th>Largo</th><th>Ancho útil</th><th>Pan.</th><th>Área</th><th>AU</th></tr></thead><tbody>${zoneRowsC(q.zoneRows)}</tbody></table>` : ''}
  <div class="pg-line"><span>bmcuruguay.com.uy · 092 663 245 · Metalog SAS</span><span class="pg-n">2 / 3</span></div>
</div>`;

  const p3 = `<div class="page">
  <div class="ph"><span class="ph-left">BMC Uruguay</span><div class="ph-right"><div><strong>Ref:</strong> ${esc(q.ref)}</div><div><strong>Fecha:</strong> ${esc(q.fecha)}</div></div></div>
  <div class="sec">Presupuesto Detallado</div>
  <table class="bom"><thead><tr><th style="text-align:left;width:44%">Descripción</th><th style="width:11%">Cant.</th><th style="width:9%;text-align:center">Unid.</th><th style="width:17%">P.U. USD</th><th style="width:19%">Total USD</th></tr></thead><tbody>${bomC(q.bomDetailGroups)}</tbody></table>
  <div class="tots"><div class="ti">
    <div class="tr"><span>Subtotal sin IVA</span><span>USD ${fmt(q.subtotalSinIva)}</span></div>
    <div class="tr"><span>IVA 22%</span><span>USD ${fmt(q.ivaAmount)}</span></div>
    <div class="tr trt"><span>Total USD</span><span>${fmt(q.totalConIva)}</span></div>
  </div></div>
  <div class="cond-q"><strong>Condiciones:</strong> ${esc(q.conditionsText)}</div>
  <div class="bank"><div class="bankt">Datos para depósito bancario</div><div>Titular: <strong>Metalog SAS</strong></div><div>RUT: <strong>120403430012</strong></div><div>BROU · Cta. Dólares: <strong>110520638-00002</strong></div><div>Consultas: <strong>092 663 245</strong></div></div>
  <div class="pg-line"><span>bmcuruguay.com.uy · 092 663 245 · Metalog SAS</span><span class="pg-n">3 / 3</span></div>
</div>`;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cotización BMC Uruguay</title><style>${CSS}</style></head><body>${p1}${p2}${p3}</body></html>`;
}
