// src/pdf-templates/executive-dark.js — Layout A: Navy + Gold

const fmt = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:0}
:root{--nv:#0F1E33;--nv2:#1A3355;--gd:#C9A84C;--gdl:#E8D4A0;--wh:#fff;--muted:#64748B;--bdr:#E2E8F0}
body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;font-size:10pt}
.page{width:210mm;min-height:297mm;position:relative;overflow:hidden;background:#fff}
@media screen{body{background:#8a96a8;padding:24px 0}.page{margin:0 auto 32px;box-shadow:0 8px 44px rgba(0,0,0,.28);border-radius:2px;max-width:794px}}
@media print{.page{page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}}
.pc{background:var(--nv);color:var(--wh);display:flex;flex-direction:column;min-height:297mm}
.ch{padding:13mm 15mm 8mm;border-bottom:.5pt solid rgba(201,168,76,.3);display:flex;align-items:center;justify-content:space-between}
.cl{display:flex;align-items:center;gap:10px}
.clb{width:38px;height:38px;background:var(--gd);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:21pt;font-weight:900;color:var(--nv);line-height:1}
.cln{font-size:19pt;font-weight:800;letter-spacing:.04em}.cls{font-size:6.5pt;color:var(--gdl);letter-spacing:.18em;font-weight:600;text-transform:uppercase;margin-top:2px}
.cbdg{background:var(--gd);color:var(--nv);font-size:7.5pt;font-weight:800;letter-spacing:.08em;padding:5px 13px;border-radius:4px;text-transform:uppercase}
.cb{padding:9mm 15mm;flex:1}
.ch1{font-size:26pt;font-weight:900;letter-spacing:-.02em;line-height:1.1;margin-bottom:2mm}
.ch2{font-size:10pt;color:var(--gdl);font-weight:500;margin-bottom:5mm}
.cdiv{height:.6pt;background:linear-gradient(90deg,var(--gd),transparent);margin:4mm 0}
.cmeta{display:grid;grid-template-columns:1fr 1fr;gap:2mm 6mm;font-size:9pt;margin:4mm 0 5mm}
.cml{font-size:6pt;color:var(--gdl);text-transform:uppercase;letter-spacing:.12em;font-weight:700;margin-bottom:1mm}
.cmv{color:var(--wh);font-weight:600}
.ckpis{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:4mm 0}
.kpi{background:rgba(255,255,255,.06);border:.5pt solid rgba(201,168,76,.2);border-radius:8px;padding:8px 10px}
.kpil{font-size:6pt;color:var(--gdl);text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin-bottom:3px}
.kpiv{font-size:19pt;font-weight:900;font-variant-numeric:tabular-nums}
.kpiu{font-size:6.5pt;color:rgba(255,255,255,.4);margin-top:1px}
.cst{font-size:6.5pt;color:var(--gdl);text-transform:uppercase;letter-spacing:.14em;font-weight:800;margin:4mm 0 2mm}
.cgs{display:flex;flex-direction:column;gap:1.5mm}
.cgr{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;border-radius:5px;background:rgba(255,255,255,.05);font-size:9pt}
.cgn{color:rgba(255,255,255,.8);font-weight:600}.cgv{color:var(--gd);font-weight:700;font-variant-numeric:tabular-nums}
.ctot{margin:4mm 0 3mm;background:var(--gd);border-radius:10px;padding:11px 15px;display:flex;justify-content:space-between;align-items:center}
.ctl{display:flex;flex-direction:column;gap:1px}
.ctlbl{font-size:6.5pt;color:rgba(15,30,51,.55);text-transform:uppercase;letter-spacing:.12em;font-weight:700}
.ctsub{font-size:8pt;color:rgba(15,30,51,.65)}
.ctamt{font-size:24pt;font-weight:900;color:var(--nv);font-variant-numeric:tabular-nums}
.ccond{font-size:7.5pt;color:rgba(255,255,255,.5);line-height:1.55;padding-bottom:3mm}
.ccond strong{color:rgba(255,255,255,.78)}
.cftr{border-top:.5pt solid rgba(201,168,76,.18);padding:5mm 15mm;display:flex;justify-content:space-between;align-items:center}
.cft{font-size:7pt;color:rgba(255,255,255,.38)}.cpg{font-size:7pt;color:rgba(201,168,76,.6);font-weight:600}
.ph{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2pt solid var(--nv);padding-bottom:4mm;margin-bottom:5mm}
.phl{display:flex;align-items:center;gap:8px}
.phb{width:26px;height:26px;background:var(--nv);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:13pt;font-weight:900;color:#fff}
.pht{font-size:13pt;font-weight:800;color:var(--nv)}.phs{font-size:7.5pt;color:var(--muted);margin-top:1px}
.phr{text-align:right;font-size:8pt;color:var(--muted)}.phr strong{color:var(--nv)}
.sec{font-size:7.5pt;font-weight:800;color:var(--nv);text-transform:uppercase;letter-spacing:.12em;margin:4mm 0 2.5mm;padding-bottom:1.5mm;border-bottom:.5pt solid var(--bdr)}
.pgf{position:absolute;bottom:10mm;left:12mm;right:12mm;display:flex;justify-content:space-between;font-size:7pt;color:#94A3B8;border-top:.5pt solid var(--bdr);padding-top:2.5mm}
.p2{padding:12mm}.p3{padding:12mm}
.plan-card{border:.5pt solid var(--bdr);border-radius:8px;overflow:hidden;margin-bottom:4mm}
.plhdr{background:var(--nv);color:#fff;padding:5px 12px;font-size:7.5pt;font-weight:700;display:flex;justify-content:space-between}
.plbdy{padding:6px 8px;background:#F8FAFC}
.leg{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5mm 4mm;margin-bottom:3mm}
.li{display:flex;align-items:center;gap:6px;font-size:7.5pt;color:var(--muted)}.sw{width:20px;height:10px;border-radius:2px;flex-shrink:0}
.zt{width:100%;border-collapse:collapse;font-size:8.5pt;margin-bottom:3mm}
.zt th{background:var(--nv);color:#fff;padding:5px 7px;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:right}
.zt th:first-child,.zt th:nth-child(2){text-align:left}
.zt td{padding:4px 7px;border-bottom:.4pt solid var(--bdr);text-align:right;font-variant-numeric:tabular-nums}
.zt td:first-child,.zt td:nth-child(2){text-align:left}
.zt tr:nth-child(even) td{background:#F8FAFC}
.bom{width:100%;border-collapse:collapse;font-size:8.5pt}
.bom th{background:#EDEDED;padding:4px 6px;font-weight:700;font-size:7.5pt;text-transform:uppercase;letter-spacing:.04em;text-align:right}
.bom th:first-child{text-align:left}
.bom td{padding:3px 6px;border-bottom:.3pt solid #EBEBEB;text-align:right;font-variant-numeric:tabular-nums}
.bom td:first-child{text-align:left}
.bom .bg td{background:var(--nv)!important;color:#fff!important;font-weight:800!important;border:none!important;padding:5px 7px!important}
.bom tr:nth-child(even) td{background:#FAFAFA}
.tots{margin-top:4mm;display:flex;justify-content:flex-end}
.ti{min-width:220px;border:.5pt solid var(--bdr);padding:8px 10px}
.tr{display:flex;justify-content:space-between;padding:2px 0;font-size:9pt;font-variant-numeric:tabular-nums}
.trt{border-top:1.5pt solid var(--nv);margin-top:3px;padding-top:3px;font-size:14pt;font-weight:900;color:var(--nv)}
.cond{margin-top:3mm;font-size:7.5pt;color:var(--muted);line-height:1.55;padding:8px 10px;background:#F8FAFC;border-radius:6px;border-left:3pt solid var(--gd)}
.cond strong{color:#1D1D1F}
.bank{margin-top:2.5mm;font-size:7.5pt;display:grid;grid-template-columns:1fr 1fr;gap:2px 10px;padding:8px 10px;background:var(--nv);color:rgba(255,255,255,.65);border-radius:6px}
.bank strong{color:#fff}.bankt{grid-column:1/-1;font-size:6pt;color:var(--gdl);text-transform:uppercase;letter-spacing:.12em;font-weight:700;margin-bottom:2px}
`;

function renderBomGroups(g) { return g.map(x => `<div class="cgr"><span class="cgn">${esc(x.name)}</span><span class="cgv">USD ${fmt(x.totalUsd)}</span></div>`).join(''); }
function renderZoneRows(rows) {
  const r = rows.map(r => `<tr><td><strong>${esc(r.zona)}</strong></td><td>${esc(r.desc)}</td><td>${esc(r.largo)}</td><td>${esc(r.ancho)}</td><td>${r.paneles}</td><td>${esc(r.area)}</td><td>${esc(r.au)}</td></tr>`).join('');
  const tp = rows.reduce((s, r) => s + (Number(r.paneles) || 0), 0);
  const ta = rows.reduce((s, r) => s + parseFloat(r.area), 0);
  return r + `<tr style="font-weight:700;background:#F0F4F8"><td colspan="4"><strong>TOTAL</strong></td><td><strong>${tp}</strong></td><td><strong>${ta.toFixed(2)} m²</strong></td><td></td></tr>`;
}
function renderBomDetail(groups) {
  return groups.map(g => {
    const gh = `<tr class="bg"><td colspan="4">&#9658; ${esc(g.groupName)}</td><td>${fmt(g.groupTotal)}</td></tr>`;
    const ih = g.items.map(i => { const q = typeof i.qty === 'number' ? (i.qty % 1 === 0 ? i.qty : i.qty.toFixed(2)) : (i.qty ?? ''); return `<tr><td>${esc(i.desc)}</td><td style="text-align:right">${q}</td><td style="text-align:center">${esc(i.unit)}</td><td style="text-align:right">${fmt(i.pu)}</td><td>${fmt(i.total)}</td></tr>`; }).join('');
    return gh + ih;
  }).join('');
}
function planBlock(svgPlanHtml, planTitle, planSummary) {
  const inner = svgPlanHtml ? svgPlanHtml.replace(/width="[^"]*"/, 'width="100%"').replace(/height="[^"]*"/, '') : `<div style="padding:20px;text-align:center;color:#94A3B8;font-size:9pt">Plano 2D no disponible</div>`;
  return `<div class="plan-card"><div class="plhdr"><span>${esc(planTitle)}</span><span>${esc(planSummary)}</span></div><div class="plbdy">${inner}</div></div>`;
}

export function render(q) {
  const p1 = `<div class="page pc">
  <div class="ch"><div class="cl"><div class="clb">B</div><div><div class="cln">BMC</div><div class="cls">Uruguay</div></div></div><div class="cbdg">Propuesta Comercial</div></div>
  <div class="cb">
    <div class="ch1">Cotización de Cubierta<br>con Paneles Aislantes</div>
    <div class="ch2">${esc(q.panelDescLine)}</div>
    <div class="cdiv"></div>
    <div class="cmeta">
      <div><div class="cml">Referencia</div><div class="cmv">${esc(q.ref)}</div></div>
      <div><div class="cml">Fecha</div><div class="cmv">${esc(q.fecha)}</div></div>
      <div><div class="cml">Escenario</div><div class="cmv">${esc(q.escenario)}</div></div>
      <div><div class="cml">Validez</div><div class="cmv">${esc(q.validez)}</div></div>
    </div>
    <div class="ckpis">
      <div class="kpi"><div class="kpil">Área</div><div class="kpiv">${Number(q.areaTotalM2).toFixed(1)}</div><div class="kpiu">m²</div></div>
      <div class="kpi"><div class="kpil">Paneles</div><div class="kpiv">${q.panelCount}</div><div class="kpiu">unid.</div></div>
      <div class="kpi"><div class="kpil">Apoyos</div><div class="kpiv">${q.apoyoCount}</div><div class="kpiu">estruc.</div></div>
      <div class="kpi"><div class="kpil">Fijaciones</div><div class="kpiv">${q.fijacionCount}</div><div class="kpiu">puntos</div></div>
    </div>
    <div class="cst">Resumen por partida</div>
    <div class="cgs">${renderBomGroups(q.bomGroups)}</div>
    <div class="ctot"><div class="ctl"><span class="ctlbl">Total con IVA 22%</span><span class="ctsub">Subtotal s/IVA: USD ${fmt(q.subtotalSinIva)} · IVA: USD ${fmt(q.ivaAmount)}</span></div><div class="ctamt">USD ${fmt(q.totalConIva)}</div></div>
    <div class="ccond"><strong>Condiciones:</strong> ${esc(q.conditionsText)}</div>
  </div>
  <div class="cftr"><span class="cft">bmcuruguay.com.uy · 092 663 245 · Metalog SAS</span><span class="cpg">1 / 3</span></div>
</div>`;

  const p2 = `<div class="page p2">
  <div class="ph"><div class="phl"><div class="phb">B</div><div><div class="pht">BMC Uruguay</div><div class="phs">Panelin · planta de cubierta</div></div></div><div class="phr"><div><strong>Ref:</strong> ${esc(q.ref)}</div><div><strong>Fecha:</strong> ${esc(q.fecha)}</div></div></div>
  <div class="sec">Visualización 2D · Planta de Cubierta</div>
  ${planBlock(q.svgPlanHtml, q.planTitle, q.planSummary)}
  ${q.zoneRows.length ? `<div class="sec">Leyenda</div>
  <div class="leg">
    <div class="li"><div class="sw" style="background:#E8EEF5;border:1px solid #1a3a6b"></div><span>Panel impar</span></div>
    <div class="li"><div class="sw" style="background:#D0DEEE;border:1px solid #1a3a6b"></div><span>Panel par</span></div>
    <div class="li"><div class="sw" style="background:#C9A84C;height:6px;margin-top:2px"></div><span>Gotero perimetral</span></div>
    <div class="li"><div class="sw" style="background:none;border:1.5px dashed #94A3B8"></div><span>Encuentro</span></div>
    <div class="li" style="gap:8px"><span style="font-size:11pt">&#8595;</span><span>Pendiente</span></div>
    <div class="li"><div class="sw" style="background:#1a3a6b"></div><span>Borde sellado</span></div>
  </div>
  <div class="sec">Resumen de Zonas</div>
  <table class="zt"><thead><tr><th style="text-align:left">Zona</th><th style="text-align:left">Descripción</th><th>Largo</th><th>Ancho útil</th><th>Pan.</th><th>Área</th><th>AU</th></tr></thead><tbody>${renderZoneRows(q.zoneRows)}</tbody></table>` : ''}
  <div class="pgf"><span>BMC Uruguay · Metalog SAS · bmcuruguay.com.uy</span><span style="color:#C9A84C;font-weight:600">2 / 3</span></div>
</div>`;

  const p3 = `<div class="page p3">
  <div class="ph"><div class="phl"><div class="phb">B</div><div><div class="pht">BMC Uruguay</div><div class="phs">Cotización detallada · BOM completo</div></div></div><div class="phr"><div><strong>Ref:</strong> ${esc(q.ref)}</div><div><strong>Fecha:</strong> ${esc(q.fecha)}</div></div></div>
  <div class="sec">Presupuesto Detallado</div>
  <table class="bom"><thead><tr><th style="text-align:left;width:44%">Descripción</th><th style="width:11%">Cant.</th><th style="width:9%;text-align:center">Unid.</th><th style="width:17%">P.U. USD</th><th style="width:19%">Total USD</th></tr></thead><tbody>${renderBomDetail(q.bomDetailGroups)}</tbody></table>
  <div class="tots"><div class="ti">
    <div class="tr"><span>Subtotal sin IVA</span><span>USD ${fmt(q.subtotalSinIva)}</span></div>
    <div class="tr"><span>IVA 22%</span><span>USD ${fmt(q.ivaAmount)}</span></div>
    <div class="tr trt"><span>TOTAL USD</span><span>${fmt(q.totalConIva)}</span></div>
  </div></div>
  <div class="cond"><strong>Condiciones:</strong> ${esc(q.conditionsText)}</div>
  <div class="bank"><div class="bankt">Datos para depósito bancario</div><div>Titular: <strong>Metalog SAS</strong></div><div>RUT: <strong>120403430012</strong></div><div>BROU · Cta. Dólares: <strong>110520638-00002</strong></div><div>Consultas: <strong>092 663 245</strong></div></div>
  <div class="pgf"><span>BMC Uruguay · Metalog SAS · bmcuruguay.com.uy</span><span style="color:#C9A84C;font-weight:600">3 / 3</span></div>
</div>`;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cotización BMC Uruguay</title><style>${CSS}</style></head><body>${p1}${p2}${p3}</body></html>`;
}
