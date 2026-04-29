// src/pdf-templates/construction-bold.js — Layout D: Yellow + Black Industrial

const fmt = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:0}
:root{--yw:#F5C800;--bk:#1A1A1A;--wh:#fff;--dg:#2D2D2D;--mg:#555;--lt:#FEFCE8}
body{font-family:'Arial Black','Arial','Helvetica Neue',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;font-size:10pt;color:var(--bk);background:var(--lt)}
.page{width:210mm;min-height:297mm;position:relative;overflow:hidden;background:var(--lt)}
@media screen{body{background:#444;padding:24px 0}.page{margin:0 auto 32px;box-shadow:0 4px 24px rgba(0,0,0,.4);max-width:794px;border-radius:2px}}
@media print{.page{page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}}
.cover{display:flex;flex-direction:column;min-height:297mm}
.band{background:var(--yw);padding:10mm 14mm;display:flex;justify-content:space-between;align-items:flex-start}
.band-logo{display:flex;flex-direction:column}
.band-bmc{font-size:36pt;font-weight:900;color:var(--bk);letter-spacing:-.02em;line-height:1}
.band-sub{font-size:7pt;font-weight:900;letter-spacing:.22em;text-transform:uppercase;color:rgba(0,0,0,.55);margin-top:2px}
.band-right{text-align:right}
.band-doc{font-size:9pt;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:rgba(0,0,0,.7)}
.band-ref{font-size:13pt;font-weight:900;color:var(--bk)}
.stripe-bar{height:8px;background:repeating-linear-gradient(45deg,var(--bk) 0px,var(--bk) 6px,var(--yw) 6px,var(--yw) 12px)}
.cbody{padding:8mm 14mm;flex:1}
.ctag{display:inline-block;background:var(--bk);color:var(--yw);font-size:7pt;font-weight:900;letter-spacing:.14em;padding:3px 10px;text-transform:uppercase;margin-bottom:5mm}
.ch1{font-size:28pt;font-weight:900;letter-spacing:-.02em;line-height:1.0;margin-bottom:1mm;color:var(--bk);text-transform:uppercase}
.csub{font-size:9.5pt;font-weight:700;color:var(--mg);margin-bottom:6mm}
.cmeta{display:grid;grid-template-columns:1fr 1fr;gap:0;margin-bottom:5mm;border:2pt solid var(--bk)}
.cm{padding:5px 8px;border-right:1pt solid var(--bk);border-bottom:1pt solid var(--bk)}
.cm:nth-child(even){border-right:none}
.cm:nth-last-child(-n+2){border-bottom:none}
.cml{font-size:6pt;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:var(--mg);margin-bottom:1mm}
.cmv{font-size:9.5pt;font-weight:900;color:var(--bk)}
.ckpis{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:2pt solid var(--bk);margin-bottom:5mm}
.ck{padding:8px;border-right:1pt solid var(--bk)}.ck:last-child{border-right:none}
.ckl{font-size:5.5pt;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:var(--mg);margin-bottom:3px}
.ckv{font-size:20pt;font-weight:900;line-height:1;color:var(--bk)}
.cku{font-size:6.5pt;color:var(--mg);margin-top:1px}
.cgroups{display:flex;flex-direction:column;gap:0;border:2pt solid var(--bk);margin-bottom:5mm}
.cgr{display:flex;justify-content:space-between;align-items:center;padding:5px 8px;border-bottom:1pt solid rgba(0,0,0,.15);font-size:9.5pt}
.cgr:last-child{border-bottom:none}
.cgn{font-weight:700;color:var(--bk)}.cgv{font-weight:900;color:var(--dg);font-variant-numeric:tabular-nums}
.ctot{background:var(--bk);color:var(--yw);padding:10px 14px;display:flex;justify-content:space-between;align-items:center;margin-bottom:5mm}
.ctlbl{font-size:7pt;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(245,200,0,.7);margin-bottom:2px}
.ctsub{font-size:8pt;color:rgba(245,200,0,.7)}
.ctamt{font-size:24pt;font-weight:900;font-variant-numeric:tabular-nums;color:var(--yw)}
.ccond{font-size:8pt;line-height:1.55;color:var(--mg)}.ccond strong{color:var(--bk)}
.cftr{border-top:2pt solid var(--bk);padding:5mm 14mm;display:flex;justify-content:space-between;align-items:center;background:var(--yw)}
.cft{font-size:7.5pt;font-weight:700;color:rgba(0,0,0,.6)}.cpg{font-size:8pt;font-weight:900;color:var(--bk)}
.pband{background:var(--bk);color:var(--yw);padding:8mm 12mm 5mm;display:flex;justify-content:space-between;align-items:flex-end}
.pbml{font-size:15pt;font-weight:900;letter-spacing:-.01em}
.pbmr{text-align:right;font-size:8pt;color:rgba(245,200,0,.75);font-weight:700}
.pbmr strong{color:var(--yw)}
.pstripe{height:5px;background:repeating-linear-gradient(45deg,var(--yw) 0px,var(--yw) 4px,var(--bk) 4px,var(--bk) 8px)}
.pbody{padding:8mm 12mm}
.sec{font-size:7pt;font-weight:900;text-transform:uppercase;letter-spacing:.16em;color:var(--bk);margin:4mm 0 2.5mm;padding-bottom:1.5mm;border-bottom:2pt solid var(--bk)}
.pgf{position:absolute;bottom:0;left:0;right:0;background:var(--bk);padding:4mm 12mm;display:flex;justify-content:space-between;align-items:center}
.pgft{font-size:7pt;font-weight:700;color:rgba(245,200,0,.6)}.pgn{font-size:8pt;font-weight:900;color:var(--yw)}
.pplan{border:2pt solid var(--bk);margin-bottom:4mm;overflow:hidden}
.pplhdr{background:var(--bk);color:var(--yw);padding:5px 10px;font-size:7pt;font-weight:900;letter-spacing:.08em;text-transform:uppercase;display:flex;justify-content:space-between}
.pplbdy{padding:4px;background:#FEFCE8}
.leg{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5mm 4mm;margin-bottom:3mm}
.li{display:flex;align-items:center;gap:6px;font-size:7.5pt;color:var(--mg)}.sw{width:20px;height:10px;flex-shrink:0}
.zt{width:100%;border-collapse:collapse;font-size:8.5pt;margin-bottom:3mm;border:1pt solid var(--bk)}
.zt th{background:var(--bk);color:var(--yw);padding:5px 7px;font-size:7pt;font-weight:900;text-transform:uppercase;letter-spacing:.06em;text-align:right}
.zt th:first-child,.zt th:nth-child(2){text-align:left}
.zt td{padding:4px 7px;border-bottom:.5pt solid rgba(0,0,0,.15);text-align:right;font-variant-numeric:tabular-nums;font-weight:700}
.zt td:first-child,.zt td:nth-child(2){text-align:left;font-weight:900}
.zt tr:nth-child(even) td{background:rgba(0,0,0,.04)}
.bom{width:100%;border-collapse:collapse;font-size:8.5pt;border:1pt solid var(--bk)}
.bom th{background:var(--bk);color:var(--yw);padding:4px 6px;font-weight:900;font-size:7pt;text-transform:uppercase;letter-spacing:.06em;text-align:right}
.bom th:first-child{text-align:left}
.bom td{padding:3px 6px;border-bottom:.4pt solid rgba(0,0,0,.12);text-align:right;font-variant-numeric:tabular-nums;font-weight:700}
.bom td:first-child{text-align:left;font-weight:700}
.bom .bg td{background:var(--yw)!important;color:var(--bk)!important;font-weight:900!important;border:none!important;border-bottom:1pt solid var(--bk)!important;padding:5px 7px!important}
.bom tr:nth-child(even) td{background:rgba(0,0,0,.03)}
.tots{margin-top:4mm;display:flex;justify-content:flex-end}
.ti{min-width:220px;border:2pt solid var(--bk)}
.tr{display:flex;justify-content:space-between;padding:3px 8px;font-size:9pt;font-variant-numeric:tabular-nums;border-bottom:.5pt solid rgba(0,0,0,.15);font-weight:700}
.trt{background:var(--bk);color:var(--yw);padding:5px 8px;font-size:13pt;font-weight:900;border:none!important}
.cond{margin-top:3mm;font-size:8pt;color:var(--mg);line-height:1.6;padding:6px 10px;background:rgba(0,0,0,.05);border-left:4pt solid var(--yw)}
.cond strong{color:var(--bk)}
.bank{margin-top:2.5mm;font-size:7.5pt;display:grid;grid-template-columns:1fr 1fr;gap:2px 10px;padding:8px 10px;background:var(--bk);color:rgba(245,200,0,.7)}
.bank strong{color:var(--yw)}.bankt{grid-column:1/-1;font-size:6pt;color:rgba(245,200,0,.55);text-transform:uppercase;letter-spacing:.14em;font-weight:900;margin-bottom:2px}
`;

function planD(svg, title, sum) {
  const inner = svg ? svg.replace(/width="[^"]*"/, 'width="100%"').replace(/height="[^"]*"/, '') : `<div style="padding:20px;text-align:center;color:var(--mg);font-size:9pt">Plano 2D no disponible</div>`;
  return `<div class="pplan"><div class="pplhdr"><span>${esc(title.toUpperCase())}</span><span>${esc(sum.toUpperCase())}</span></div><div class="pplbdy">${inner}</div></div>`;
}
function zoneRowsD(rows) {
  const r = rows.map(r => `<tr><td><strong>${esc(r.zona.toUpperCase())}</strong></td><td>${esc(r.desc)}</td><td>${esc(r.largo)}</td><td>${esc(r.ancho)}</td><td>${r.paneles}</td><td>${esc(r.area)}</td><td>${esc(r.au)}</td></tr>`).join('');
  const tp = rows.reduce((s, r) => s + (Number(r.paneles) || 0), 0);
  const ta = rows.reduce((s, r) => s + parseFloat(r.area), 0);
  return r + `<tr style="font-weight:900"><td colspan="4">TOTAL</td><td>${tp}</td><td>${ta.toFixed(2)} m²</td><td></td></tr>`;
}
function bomD(groups) {
  return groups.map(g => {
    const gh = `<tr class="bg"><td colspan="4">&#9658; ${esc(g.groupName.toUpperCase())}</td><td>${fmt(g.groupTotal)}</td></tr>`;
    const ih = g.items.map(i => { const q = typeof i.qty === 'number' ? (i.qty % 1 === 0 ? i.qty : i.qty.toFixed(2)) : (i.qty ?? ''); return `<tr><td>${esc(i.desc)}</td><td style="text-align:right">${q}</td><td style="text-align:center">${esc(i.unit)}</td><td style="text-align:right">${fmt(i.pu)}</td><td>${fmt(i.total)}</td></tr>`; }).join('');
    return gh + ih;
  }).join('');
}

export function render(q) {
  const p1 = `<div class="page cover">
  <div class="band">
    <div class="band-logo"><div class="band-bmc">BMC</div><div class="band-sub">Uruguay · Panelin</div></div>
    <div class="band-right"><div class="band-doc">Propuesta Comercial</div><div class="band-ref">${esc(q.ref)}</div></div>
  </div>
  <div class="stripe-bar"></div>
  <div class="cbody">
    <div class="ctag">Cotización de Cubierta</div>
    <div class="ch1">Paneles<br>Aislantes</div>
    <div class="csub">${esc(q.panelDescLine)}</div>
    <div class="cmeta">
      <div class="cm"><div class="cml">Referencia</div><div class="cmv">${esc(q.ref)}</div></div>
      <div class="cm"><div class="cml">Fecha</div><div class="cmv">${esc(q.fecha)}</div></div>
      <div class="cm"><div class="cml">Escenario</div><div class="cmv">${esc(q.escenario)}</div></div>
      <div class="cm"><div class="cml">Validez</div><div class="cmv">${esc(q.validez)}</div></div>
    </div>
    <div class="ckpis">
      <div class="ck"><div class="ckl">Área</div><div class="ckv">${Number(q.areaTotalM2).toFixed(1)}</div><div class="cku">m²</div></div>
      <div class="ck"><div class="ckl">Paneles</div><div class="ckv">${q.panelCount}</div><div class="cku">unid</div></div>
      <div class="ck"><div class="ckl">Apoyos</div><div class="ckv">${q.apoyoCount}</div><div class="cku">estruct</div></div>
      <div class="ck"><div class="ckl">Fijaciones</div><div class="ckv">${q.fijacionCount}</div><div class="cku">puntos</div></div>
    </div>
    <div class="cgroups">${q.bomGroups.map(g => `<div class="cgr"><span class="cgn">${esc(g.name)}</span><span class="cgv">USD ${fmt(g.totalUsd)}</span></div>`).join('')}</div>
    <div class="ctot"><div><div class="ctlbl">Total con IVA 22%</div><div class="ctsub">s/IVA: ${fmt(q.subtotalSinIva)} · IVA: ${fmt(q.ivaAmount)}</div></div><div class="ctamt">USD ${fmt(q.totalConIva)}</div></div>
    <div class="ccond"><strong>Cond:</strong> ${esc(q.conditionsText)}</div>
  </div>
  <div class="cftr"><span class="cft">bmcuruguay.com.uy · 092 663 245 · Metalog SAS</span><span class="cpg">1 / 3</span></div>
</div>`;

  const p2 = `<div class="page">
  <div class="pband"><span class="pbml">BMC Uruguay · Planta de Cubierta</span><div class="pbmr"><div><strong>Ref:</strong> ${esc(q.ref)}</div><div><strong>Fecha:</strong> ${esc(q.fecha)}</div></div></div>
  <div class="pstripe"></div>
  <div class="pbody">
    <div class="sec">Visualización 2D · Planta de Cubierta</div>
    ${planD(q.svgPlanHtml, q.planTitle, q.planSummary)}
    ${q.zoneRows.length ? `<div class="sec">Leyenda</div>
    <div class="leg">
      <div class="li"><div class="sw" style="background:#FFFDE7;border:1.5px solid #1A1A1A"></div><span>Panel impar</span></div>
      <div class="li"><div class="sw" style="background:#FFF3C4;border:1.5px solid #1A1A1A"></div><span>Panel par</span></div>
      <div class="li"><div class="sw" style="background:#F5C800;height:6px;margin-top:2px"></div><span>Gotero perimetral</span></div>
      <div class="li"><div class="sw" style="background:none;border:1.5px dashed #888"></div><span>Encuentro de zonas</span></div>
      <div class="li" style="gap:8px"><span style="font-size:11pt;font-weight:900">&#8595;</span><span>Dirección pendiente</span></div>
      <div class="li"><div class="sw" style="background:#1A1A1A"></div><span>Borde sellado</span></div>
    </div>
    <div class="sec">Resumen de Zonas</div>
    <table class="zt"><thead><tr><th style="text-align:left">Zona</th><th style="text-align:left">Descripción</th><th>Largo</th><th>Ancho útil</th><th>Pan.</th><th>Área</th><th>AU</th></tr></thead><tbody>${zoneRowsD(q.zoneRows)}</tbody></table>` : ''}
  </div>
  <div class="pgf"><span class="pgft">bmcuruguay.com.uy · 092 663 245 · Metalog SAS</span><span class="pgn">2 / 3</span></div>
</div>`;

  const p3 = `<div class="page">
  <div class="pband"><span class="pbml">BMC Uruguay · Cotización Detallada</span><div class="pbmr"><div><strong>Ref:</strong> ${esc(q.ref)}</div><div><strong>Fecha:</strong> ${esc(q.fecha)}</div></div></div>
  <div class="pstripe"></div>
  <div class="pbody">
    <div class="sec">Presupuesto Detallado</div>
    <table class="bom"><thead><tr><th style="text-align:left;width:44%">Descripción</th><th style="width:11%">Cant.</th><th style="width:9%;text-align:center">Unid.</th><th style="width:17%">P.U. USD</th><th style="width:19%">Total USD</th></tr></thead><tbody>${bomD(q.bomDetailGroups)}</tbody></table>
    <div class="tots"><div class="ti">
      <div class="tr"><span>Subtotal sin IVA</span><span>USD ${fmt(q.subtotalSinIva)}</span></div>
      <div class="tr"><span>IVA 22%</span><span>USD ${fmt(q.ivaAmount)}</span></div>
      <div class="tr trt"><span>TOTAL USD</span><span>${fmt(q.totalConIva)}</span></div>
    </div></div>
    <div class="cond"><strong>Cond:</strong> ${esc(q.conditionsText)}</div>
    <div class="bank"><div class="bankt">Depósito bancario</div><div>Titular: <strong>Metalog SAS</strong></div><div>RUT: <strong>120403430012</strong></div><div>BROU Cta USD: <strong>110520638-00002</strong></div><div>Tel: <strong>092 663 245</strong></div></div>
  </div>
  <div class="pgf"><span class="pgft">bmcuruguay.com.uy · 092 663 245 · Metalog SAS</span><span class="pgn">3 / 3</span></div>
</div>`;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cotización BMC Uruguay</title><style>${CSS}</style></head><body>${p1}${p2}${p3}</body></html>`;
}
