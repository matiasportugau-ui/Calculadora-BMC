// src/pdf-templates/blueprint.js — Layout B: Dark Technical / Blueprint

const fmt = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:0}
:root{--bg:#0D2140;--bg2:#122952;--blue:#60A5FA;--muted:#7BA8CC;--wh:#fff;--panel1:#1E3F73;--panel2:#162F5E}
body{font-family:'Courier New',Courier,'Lucida Console',monospace;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;font-size:9pt;color:var(--wh);background:var(--bg)}
.page{width:210mm;min-height:297mm;position:relative;overflow:hidden;background:var(--bg);background-image:radial-gradient(circle,rgba(255,255,255,.06) 1px,transparent 1px);background-size:20px 20px}
@media screen{body{background:#060e1a;padding:24px 0}.page{margin:0 auto 32px;box-shadow:0 0 60px rgba(96,165,250,.18);border-radius:2px;max-width:794px}}
@media print{.page{page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}}
.frame{margin:10mm;border:1pt solid rgba(96,165,250,.35);min-height:277mm;display:flex;flex-direction:column;padding:8mm}
.corner{position:absolute;width:12px;height:12px;border-color:var(--blue)}
.tl{top:9mm;left:9mm;border-top:1.5pt solid;border-left:1.5pt solid}
.tr2{top:9mm;right:9mm;border-top:1.5pt solid;border-right:1.5pt solid}
.bl{bottom:9mm;left:9mm;border-bottom:1.5pt solid;border-left:1.5pt solid}
.br{bottom:9mm;right:9mm;border-bottom:1.5pt solid;border-right:1.5pt solid}
.bph{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1pt solid var(--blue);padding-bottom:4mm;margin-bottom:5mm}
.bphl{display:flex;align-items:center;gap:10px}
.bphlb{font-size:22pt;font-weight:900;color:var(--blue);letter-spacing:.05em;border-bottom:2pt solid var(--blue);padding-bottom:1px}
.bphls{font-size:6.5pt;color:var(--muted);letter-spacing:.14em;text-transform:uppercase;font-weight:700;margin-top:3px}
.bphr{text-align:right;font-size:7.5pt;color:var(--muted)}.bphr strong{color:var(--blue)}
.bsec{font-size:6.5pt;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:.16em;margin:4mm 0 2.5mm;padding-bottom:1.5mm;border-bottom:.5pt solid rgba(96,165,250,.3)}
.btitle{font-size:22pt;font-weight:900;color:var(--wh);letter-spacing:-.01em;line-height:1.1;margin-bottom:2mm}
.bsub{font-size:9pt;color:var(--muted);font-weight:400;margin-bottom:5mm}
.bdiv{height:.5pt;background:linear-gradient(90deg,var(--blue),transparent);margin:4mm 0}
.bmeta{display:grid;grid-template-columns:1fr 1fr;gap:2.5mm 6mm;font-size:8.5pt;margin:4mm 0 5mm}
.bml{font-size:6pt;color:var(--blue);text-transform:uppercase;letter-spacing:.14em;font-weight:700;margin-bottom:1mm}
.bmv{color:var(--wh);font-weight:700}
.bkpis{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:4mm 0}
.bkpi{border:1pt solid rgba(96,165,250,.35);border-radius:2px;padding:8px 10px;background:rgba(96,165,250,.06)}
.bkpil{font-size:5.5pt;color:var(--blue);text-transform:uppercase;letter-spacing:.12em;font-weight:700;margin-bottom:3px}
.bkpiv{font-size:18pt;font-weight:900;color:var(--wh);font-variant-numeric:tabular-nums}
.bkpiu{font-size:6pt;color:var(--muted);margin-top:1px}
.bgroups{display:flex;flex-direction:column;gap:1.5mm}
.bgr{display:flex;justify-content:space-between;align-items:center;padding:5px 8px;border-left:2pt solid rgba(96,165,250,.4);background:rgba(255,255,255,.04);font-size:8.5pt}
.bgn{color:var(--wh);font-weight:700}.bgv{color:var(--blue);font-weight:700;font-variant-numeric:tabular-nums}
.btot{margin:4mm 0 3mm;border:1.5pt solid var(--blue);border-radius:2px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center}
.btlbl{font-size:6pt;color:var(--blue);text-transform:uppercase;letter-spacing:.14em;font-weight:700;margin-bottom:1px}
.btsub{font-size:7.5pt;color:var(--muted)}
.btamt{font-size:22pt;font-weight:900;color:var(--wh);font-variant-numeric:tabular-nums}
.bcond{font-size:7.5pt;color:var(--muted);line-height:1.55;padding:2mm 0;border-top:.5pt solid rgba(96,165,250,.2);margin-top:3mm}
.bcond strong{color:var(--wh)}
.bftr{border-top:.5pt solid rgba(96,165,250,.2);padding:4mm 0 0;display:flex;justify-content:space-between;font-size:7pt;color:var(--muted);margin-top:auto}
.bpg{font-size:7pt;color:var(--blue);font-weight:700}
.bplan{border:1pt solid rgba(96,165,250,.35);border-radius:2px;overflow:hidden;margin-bottom:4mm}
.bplhdr{background:rgba(96,165,250,.12);color:var(--blue);padding:5px 10px;font-size:7pt;font-weight:700;display:flex;justify-content:space-between;border-bottom:.5pt solid rgba(96,165,250,.3);letter-spacing:.06em;text-transform:uppercase}
.bplbdy{padding:6px;background:var(--bg2)}
.bleg{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5mm 4mm;margin-bottom:3mm}
.bli{display:flex;align-items:center;gap:6px;font-size:7.5pt;color:var(--muted)}.bsw{width:20px;height:10px;border-radius:1px;flex-shrink:0}
.bzt{width:100%;border-collapse:collapse;font-size:8.5pt;margin-bottom:3mm}
.bzt th{background:rgba(96,165,250,.12);color:var(--blue);padding:5px 7px;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-bottom:.5pt solid rgba(96,165,250,.3)}
.bzt th,.bzt td:last-child{text-align:right}
.bzt th:first-child,.bzt th:nth-child(2),.bzt td:first-child,.bzt td:nth-child(2){text-align:left}
.bzt td{padding:4px 7px;border-bottom:.4pt solid rgba(255,255,255,.08);text-align:right;font-variant-numeric:tabular-nums;color:var(--wh)}
.bzt td:first-child,.bzt td:nth-child(2){color:var(--muted)}
.bzt tr:nth-child(even) td{background:rgba(255,255,255,.03)}
.bbom{width:100%;border-collapse:collapse;font-size:8.5pt}
.bbom th{background:rgba(96,165,250,.1);color:var(--blue);padding:4px 6px;font-weight:700;font-size:7pt;text-transform:uppercase;letter-spacing:.06em;border-bottom:.5pt solid rgba(96,165,250,.3);text-align:right}
.bbom th:first-child{text-align:left}
.bbom td{padding:3px 6px;border-bottom:.3pt solid rgba(255,255,255,.07);text-align:right;font-variant-numeric:tabular-nums;color:var(--muted)}
.bbom td:first-child{text-align:left;color:var(--wh)}
.bbom .bg td{background:rgba(96,165,250,.12)!important;color:var(--blue)!important;font-weight:800!important;border:none!important;border-left:2pt solid var(--blue)!important;padding:5px 7px!important}
.bbom tr:nth-child(even) td{background:rgba(255,255,255,.025)}
.btots{margin-top:4mm;display:flex;justify-content:flex-end}
.bti{min-width:220px;border:1pt solid rgba(96,165,250,.35);padding:8px 10px}
.btr{display:flex;justify-content:space-between;padding:2px 0;font-size:9pt;font-variant-numeric:tabular-nums;color:var(--muted)}
.btrt{border-top:1pt solid var(--blue);margin-top:3px;padding-top:3px;font-size:13pt;font-weight:900;color:var(--wh)}
.bcondq{margin-top:3mm;font-size:7.5pt;color:var(--muted);line-height:1.55;padding:8px 10px;background:rgba(96,165,250,.06);border-left:2pt solid var(--blue)}
.bcondq strong{color:var(--wh)}
.bbank{margin-top:2.5mm;font-size:7.5pt;display:grid;grid-template-columns:1fr 1fr;gap:2px 10px;padding:8px 10px;border:1pt solid rgba(96,165,250,.3);color:var(--muted)}
.bbank strong{color:var(--wh)}.bbankt{grid-column:1/-1;font-size:6pt;color:var(--blue);text-transform:uppercase;letter-spacing:.14em;font-weight:700;margin-bottom:2px}
`;

const H = (t, s) => `<div class="bph"><div class="bphl"><div><div class="bphlb">BMC</div><div class="bphls">Uruguay · ${esc(s)}</div></div></div><div class="bphr">${t}</div></div>`;
function planB(svg, title, sum) {
  const inner = svg ? svg.replace(/width="[^"]*"/, 'width="100%"').replace(/height="[^"]*"/, '') : `<div style="padding:20px;text-align:center;font-size:9pt;color:var(--muted)">Plano 2D no disponible</div>`;
  return `<div class="bplan"><div class="bplhdr"><span>${esc(title)}</span><span>${esc(sum)}</span></div><div class="bplbdy">${inner}</div></div>`;
}
function zoneRowsB(rows) {
  const r = rows.map(r => `<tr><td>${esc(r.zona)}</td><td>${esc(r.desc)}</td><td>${esc(r.largo)}</td><td>${esc(r.ancho)}</td><td>${r.paneles}</td><td>${esc(r.area)}</td><td>${esc(r.au)}</td></tr>`).join('');
  const tp = rows.reduce((s, r) => s + (Number(r.paneles) || 0), 0);
  const ta = rows.reduce((s, r) => s + parseFloat(r.area), 0);
  return r + `<tr style="color:var(--blue);font-weight:700"><td colspan="4">TOTAL</td><td>${tp}</td><td>${ta.toFixed(2)} m²</td><td></td></tr>`;
}
function bomB(groups) {
  return groups.map(g => {
    const gh = `<tr class="bg"><td colspan="4">&#9658; ${esc(g.groupName)}</td><td>${fmt(g.groupTotal)}</td></tr>`;
    const ih = g.items.map(i => { const q = typeof i.qty === 'number' ? (i.qty % 1 === 0 ? i.qty : i.qty.toFixed(2)) : (i.qty ?? ''); return `<tr><td>${esc(i.desc)}</td><td style="text-align:right">${q}</td><td style="text-align:center">${esc(i.unit)}</td><td style="text-align:right">${fmt(i.pu)}</td><td>${fmt(i.total)}</td></tr>`; }).join('');
    return gh + ih;
  }).join('');
}

export function render(q) {
  const refFecha = `<div><strong>Ref:</strong> ${esc(q.ref)}</div><div><strong>Fecha:</strong> ${esc(q.fecha)}</div>`;

  const p1 = `<div class="page"><div class="corner tl"></div><div class="corner tr2"></div><div class="corner bl"></div><div class="corner br"></div>
<div class="frame">
  ${H('PROPUESTA COMERCIAL<div style="font-size:6pt;letter-spacing:.1em">REF: ' + esc(q.ref) + '</div>', 'Uruguay · Panelin')}
  <div class="btitle">COTIZACIÓN_CUBIERTA<br>PANELES_AISLANTES.pdf</div>
  <div class="bsub">${esc(q.panelDescLine)}</div>
  <div class="bdiv"></div>
  <div class="bmeta">
    <div><div class="bml">Referencia</div><div class="bmv">${esc(q.ref)}</div></div>
    <div><div class="bml">Fecha</div><div class="bmv">${esc(q.fecha)}</div></div>
    <div><div class="bml">Escenario</div><div class="bmv">${esc(q.escenario.toUpperCase().replace(/ /g,'_'))}</div></div>
    <div><div class="bml">Validez</div><div class="bmv">${esc(q.validez)}</div></div>
  </div>
  <div class="bkpis">
    <div class="bkpi"><div class="bkpil">area_m2</div><div class="bkpiv">${Number(q.areaTotalM2).toFixed(1)}</div><div class="bkpiu">m²</div></div>
    <div class="bkpi"><div class="bkpil">paneles</div><div class="bkpiv">${q.panelCount}</div><div class="bkpiu">unid</div></div>
    <div class="bkpi"><div class="bkpil">apoyos</div><div class="bkpiv">${q.apoyoCount}</div><div class="bkpiu">estruc</div></div>
    <div class="bkpi"><div class="bkpil">fij_pts</div><div class="bkpiv">${q.fijacionCount}</div><div class="bkpiu">puntos</div></div>
  </div>
  <div class="bsec">Partidas</div>
  <div class="bgroups">${q.bomGroups.map(g => `<div class="bgr"><span class="bgn">${esc(g.name.toUpperCase().replace(/ /g,'_'))}</span><span class="bgv">USD ${fmt(g.totalUsd)}</span></div>`).join('')}</div>
  <div class="btot"><div><div class="btlbl">total_con_IVA_22pct</div><div class="btsub">s/IVA: ${fmt(q.subtotalSinIva)} · IVA: ${fmt(q.ivaAmount)}</div></div><div class="btamt">USD ${fmt(q.totalConIva)}</div></div>
  <div class="bcond"><strong>Cond:</strong> ${esc(q.conditionsText)}</div>
  <div class="bftr"><span>bmcuruguay.com.uy · 092 663 245 · Metalog SAS</span><span class="bpg">01 / 03</span></div>
</div></div>`;

  const p2 = `<div class="page"><div class="corner tl"></div><div class="corner tr2"></div><div class="corner bl"></div><div class="corner br"></div>
<div class="frame">
  ${H(refFecha, 'Uruguay · planta_cubierta.svg')}
  <div class="bsec">Visualización 2D · Planta de Cubierta</div>
  ${planB(q.svgPlanHtml, q.planTitle, q.planSummary)}
  ${q.zoneRows.length ? `<div class="bsec">Leyenda</div>
  <div class="bleg">
    <div class="bli"><div class="bsw" style="background:#1E3F73;border:1px solid #fff"></div><span>Panel impar</span></div>
    <div class="bli"><div class="bsw" style="background:#162F5E;border:1px solid #fff"></div><span>Panel par</span></div>
    <div class="bli"><div class="bsw" style="background:#60A5FA;height:6px;margin-top:2px"></div><span>Gotero</span></div>
    <div class="bli"><div class="bsw" style="background:none;border:1.5px dashed #60A5FA"></div><span>Encuentro</span></div>
    <div class="bli" style="gap:8px"><span style="font-size:11pt;color:#A8C4E0">&#8595;</span><span>Pendiente</span></div>
    <div class="bli"><div class="bsw" style="background:#fff"></div><span>Borde</span></div>
  </div>
  <div class="bsec">Zonas</div>
  <table class="bzt"><thead><tr><th style="text-align:left">Zona</th><th style="text-align:left">Desc</th><th>Largo</th><th>Ancho útil</th><th>Pan.</th><th>Área</th><th>AU</th></tr></thead><tbody>${zoneRowsB(q.zoneRows)}</tbody></table>` : ''}
  <div class="bftr"><span>bmcuruguay.com.uy · 092 663 245 · Metalog SAS</span><span class="bpg">02 / 03</span></div>
</div></div>`;

  const p3 = `<div class="page"><div class="corner tl"></div><div class="corner tr2"></div><div class="corner bl"></div><div class="corner br"></div>
<div class="frame">
  ${H(refFecha, 'Uruguay · presupuesto_detallado')}
  <div class="bsec">Presupuesto Detallado</div>
  <table class="bbom"><thead><tr><th style="text-align:left;width:44%">Descripción</th><th style="width:11%">Cant.</th><th style="width:9%;text-align:center">Unid.</th><th style="width:17%">P.U. USD</th><th style="width:19%">Total USD</th></tr></thead><tbody>${bomB(q.bomDetailGroups)}</tbody></table>
  <div class="btots"><div class="bti">
    <div class="btr"><span>Subtotal sin IVA</span><span>USD ${fmt(q.subtotalSinIva)}</span></div>
    <div class="btr"><span>IVA 22%</span><span>USD ${fmt(q.ivaAmount)}</span></div>
    <div class="btr btrt"><span>TOTAL_USD</span><span>${fmt(q.totalConIva)}</span></div>
  </div></div>
  <div class="bcondq"><strong>Cond:</strong> ${esc(q.conditionsText)}</div>
  <div class="bbank"><div class="bbankt">Depósito bancario</div><div>Titular: <strong>Metalog SAS</strong></div><div>RUT: <strong>120403430012</strong></div><div>BROU Cta USD: <strong>110520638-00002</strong></div><div>Tel: <strong>092 663 245</strong></div></div>
  <div class="bftr"><span>bmcuruguay.com.uy · 092 663 245 · Metalog SAS</span><span class="bpg">03 / 03</span></div>
</div></div>`;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cotización BMC Uruguay</title><style>${CSS}</style></head><body>${p1}${p2}${p3}</body></html>`;
}
