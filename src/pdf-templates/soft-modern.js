// src/pdf-templates/soft-modern.js
// Layout E — Soft Modern (verde pizarra + beige cálido)

const fmt = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:0}
:root{--bg:#FAFAF8;--slate:#2C4A3E;--sage:#5D8AA8;--warm:#E8DDD0;--muted:#7A8C82;--text:#2D3A35;--bdr:#DDD5CC;--lt:#EBF3EE;--lt2:#D9EBE0}
body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;font-size:10pt;color:var(--text);background:var(--bg)}
.page{width:210mm;min-height:297mm;position:relative;overflow:hidden;background:var(--bg)}
@media screen{body{background:#c5bdb5;padding:24px 0}.page{margin:0 auto 32px;box-shadow:0 8px 40px rgba(44,74,62,.22);border-radius:3px;max-width:794px}}
@media print{.page{page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}}
.cover{display:flex;flex-direction:column;min-height:297mm;padding:0}
.cov-top{background:var(--slate);padding:12mm 14mm;position:relative;overflow:hidden}
.cov-top::before{content:'';position:absolute;top:-40px;right:-40px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.04)}
.cov-top::after{content:'';position:absolute;bottom:-60px;right:40px;width:280px;height:280px;border-radius:50%;background:rgba(93,138,168,.12)}
.ctop-logo{display:flex;align-items:center;gap:10px;margin-bottom:10mm}
.ctop-mark{width:40px;height:40px;background:rgba(255,255,255,.12);border:1.5pt solid rgba(255,255,255,.25);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18pt;font-weight:900;color:#fff}
.ctop-name{font-size:14pt;font-weight:700;color:#fff;letter-spacing:.04em}
.ctop-sub{font-size:6.5pt;color:rgba(255,255,255,.5);letter-spacing:.18em;text-transform:uppercase;margin-top:1px}
.ctop-badge{display:inline-flex;align-items:center;background:rgba(255,255,255,.1);border:1pt solid rgba(255,255,255,.2);border-radius:20px;padding:4px 12px;font-size:7pt;font-weight:600;color:rgba(255,255,255,.8);letter-spacing:.1em;text-transform:uppercase;margin-bottom:4mm}
.ctop-h1{font-size:24pt;font-weight:800;color:#fff;letter-spacing:-.01em;line-height:1.1;margin-bottom:2mm}
.ctop-h2{font-size:9.5pt;color:rgba(255,255,255,.65);font-weight:500}
.cov-body{padding:8mm 14mm;flex:1;background:var(--bg)}
.cov-meta{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin:5mm 0 6mm}
.cm{background:var(--warm);border-radius:8px;padding:7px 10px}
.cml{font-size:6pt;color:var(--muted);text-transform:uppercase;letter-spacing:.14em;font-weight:700;margin-bottom:2px}
.cmv{font-size:9pt;font-weight:700;color:var(--slate)}
.ckpis{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin-bottom:6mm}
.ck{background:#fff;border:1pt solid var(--bdr);border-radius:10px;padding:8px 10px;box-shadow:0 1px 4px rgba(44,74,62,.07)}
.ckl{font-size:5.5pt;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;font-weight:700;margin-bottom:3px}
.ckv{font-size:19pt;font-weight:800;color:var(--slate);font-variant-numeric:tabular-nums;line-height:1}
.cku{font-size:6pt;color:var(--muted);margin-top:1px}
.csec{font-size:6.5pt;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.16em;margin:4mm 0 2mm;padding-bottom:1.5mm;border-bottom:.5pt solid var(--bdr)}
.cgroups{display:flex;flex-direction:column;gap:1.5mm;margin-bottom:5mm}
.cgr{display:flex;justify-content:space-between;align-items:center;padding:5px 10px;border-radius:8px;background:#fff;border:1pt solid var(--bdr);font-size:9pt}
.cgn{color:var(--text);font-weight:500}.cgv{color:var(--slate);font-weight:700;font-variant-numeric:tabular-nums}
.ctot{background:var(--slate);border-radius:12px;padding:12px 15px;display:flex;justify-content:space-between;align-items:center;margin-bottom:4mm}
.ctlbl{font-size:6.5pt;font-weight:700;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.12em;margin-bottom:1px}
.ctsub{font-size:7.5pt;color:rgba(255,255,255,.5)}
.ctamt{font-size:22pt;font-weight:800;color:#fff;font-variant-numeric:tabular-nums}
.ccond{font-size:7.5pt;color:var(--muted);line-height:1.6;padding:8px 10px;background:var(--warm);border-radius:8px;border-left:3pt solid var(--sage)}
.ccond strong{color:var(--text)}
.cftr{border-top:1pt solid var(--bdr);padding:5mm 14mm;display:flex;justify-content:space-between;font-size:7pt;color:var(--muted)}
.cpg{font-weight:700;color:var(--slate)}
.ph{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1.5pt solid var(--slate);padding-bottom:4mm;margin-bottom:5mm}
.phl{display:flex;align-items:center;gap:8px}
.phb{width:26px;height:26px;background:var(--slate);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12pt;font-weight:800;color:#fff}
.pht{font-size:12pt;font-weight:800;color:var(--slate)}.phs{font-size:7.5pt;color:var(--muted);margin-top:1px}
.phr{text-align:right;font-size:8pt;color:var(--muted)}.phr strong{color:var(--slate)}
.sec{font-size:7pt;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.14em;margin:4mm 0 2.5mm;padding-bottom:1.5mm;border-bottom:.5pt solid var(--bdr)}
.pgf{position:absolute;bottom:10mm;left:12mm;right:12mm;display:flex;justify-content:space-between;font-size:7pt;color:var(--muted);border-top:.5pt solid var(--bdr);padding-top:2.5mm}
.p2{padding:12mm}
.planc{border:1pt solid var(--bdr);border-radius:10px;overflow:hidden;margin-bottom:4mm;box-shadow:0 2px 8px rgba(44,74,62,.08)}
.plh{background:var(--slate);color:#fff;padding:6px 12px;font-size:7.5pt;font-weight:700;display:flex;justify-content:space-between}
.plb{padding:6px 8px;background:#F4F0EC}
.leg{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5mm 4mm;margin-bottom:3mm}
.li{display:flex;align-items:center;gap:6px;font-size:7.5pt;color:var(--muted)}.sw{width:20px;height:10px;border-radius:2px;flex-shrink:0}
.zt{width:100%;border-collapse:collapse;font-size:8.5pt;margin-bottom:3mm}
.zt th{background:var(--slate);color:#fff;padding:5px 7px;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:right}
.zt th:first-child,.zt th:nth-child(2){text-align:left}
.zt td{padding:4px 7px;border-bottom:.4pt solid var(--bdr);text-align:right;font-variant-numeric:tabular-nums}
.zt td:first-child,.zt td:nth-child(2){text-align:left}
.zt tr:nth-child(even) td{background:rgba(44,74,62,.03)}
.p3{padding:12mm}
.bom{width:100%;border-collapse:collapse;font-size:8.5pt}
.bom th{background:var(--slate);color:#fff;padding:4px 6px;font-weight:700;font-size:7.5pt;text-transform:uppercase;letter-spacing:.04em;text-align:right}
.bom th:first-child{text-align:left}
.bom td{padding:3px 6px;border-bottom:.3pt solid var(--bdr);text-align:right;font-variant-numeric:tabular-nums}
.bom td:first-child{text-align:left}
.bom .bg td{background:var(--lt)!important;color:var(--slate)!important;font-weight:700!important;border-top:.5pt solid var(--lt2)!important;border-bottom:.5pt solid var(--lt2)!important;padding:5px 7px!important;border-left:3pt solid var(--slate)!important}
.bom tr:nth-child(even) td{background:rgba(44,74,62,.02)}
.tots{margin-top:4mm;display:flex;justify-content:flex-end}
.ti{min-width:220px;background:#fff;border:1pt solid var(--bdr);border-radius:8px;padding:8px 12px;box-shadow:0 2px 6px rgba(44,74,62,.07)}
.tr{display:flex;justify-content:space-between;padding:2px 0;font-size:9pt;font-variant-numeric:tabular-nums;color:var(--muted)}
.trt{border-top:1.5pt solid var(--slate);margin-top:4px;padding-top:4px;font-size:14pt;font-weight:800;color:var(--slate)}
.cond{margin-top:3mm;font-size:7.5pt;color:var(--muted);line-height:1.6;padding:8px 10px;background:var(--warm);border-radius:8px;border-left:3pt solid var(--sage)}
.cond strong{color:var(--text)}
.bank{margin-top:2.5mm;font-size:7.5pt;display:grid;grid-template-columns:1fr 1fr;gap:2px 10px;padding:8px 12px;background:var(--slate);color:rgba(255,255,255,.65);border-radius:8px}
.bank strong{color:#fff}.bankt{grid-column:1/-1;font-size:6pt;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.12em;font-weight:700;margin-bottom:2px}
`;

function renderBomGroups(bomGroups) {
  return bomGroups.map(g =>
    `<div class="cgr"><span class="cgn">${esc(g.name)}</span><span class="cgv">USD ${fmt(g.totalUsd)}</span></div>`
  ).join('');
}

function renderZoneRows(zoneRows) {
  if (!zoneRows.length) return '';
  const rows = zoneRows.map(r =>
    `<tr><td><strong>${esc(r.zona)}</strong></td><td>${esc(r.desc)}</td><td>${esc(r.largo)}</td><td>${esc(r.ancho)}</td><td>${esc(String(r.paneles))}</td><td>${esc(r.area)}</td><td>${esc(r.au)}</td></tr>`
  ).join('');
  const totalPaneles = zoneRows.reduce((s, r) => s + (Number(r.paneles) || 0), 0);
  const totalArea = zoneRows.reduce((s, r) => s + parseFloat(r.area), 0);
  const totRow = `<tr style="font-weight:700;background:rgba(44,74,62,.05)"><td colspan="4"><strong>TOTAL</strong></td><td><strong>${totalPaneles}</strong></td><td><strong>${totalArea.toFixed(2)} m²</strong></td><td></td></tr>`;
  return rows + totRow;
}

function renderBomDetailRows(bomDetailGroups) {
  return bomDetailGroups.map(g => {
    const groupRow = `<tr class="bg"><td colspan="4">&#9658; ${esc(g.groupName)}</td><td style="text-align:right">${fmt(g.groupTotal)}</td></tr>`;
    const itemRows = g.items.map(i => {
      const qty = typeof i.qty === 'number'
        ? (i.qty % 1 === 0 ? i.qty : i.qty.toFixed(2))
        : (i.qty ?? '');
      return `<tr><td>${esc(i.desc)}</td><td style="text-align:right">${qty}</td><td style="text-align:center">${esc(i.unit)}</td><td style="text-align:right">${fmt(i.pu)}</td><td>${fmt(i.total)}</td></tr>`;
    }).join('');
    return groupRow + itemRows;
  }).join('');
}

function renderSvgPlan(svgPlanHtml, planTitle, planSummary) {
  if (svgPlanHtml) {
    const svg = svgPlanHtml.replace(/width="[^"]*"/, 'width="100%"').replace(/height="[^"]*"/, '');
    return `<div class="planc">
  <div class="plh"><span>${esc(planTitle)}</span><span>${esc(planSummary)}</span></div>
  <div class="plb">${svg}</div>
</div>`;
  }
  return `<div class="planc">
  <div class="plh"><span>${esc(planTitle)}</span><span>${esc(planSummary)}</span></div>
  <div class="plb" style="padding:24px;text-align:center;color:var(--muted);font-size:9pt">Plano 2D no disponible para este escenario</div>
</div>`;
}

export function render(q) {
  const page1 = `
<div class="page cover">
  <div class="cov-top">
    <div class="ctop-logo">
      <div class="ctop-mark">B</div>
      <div><div class="ctop-name">BMC Uruguay</div><div class="ctop-sub">Panelin</div></div>
    </div>
    <div class="ctop-badge">Propuesta Comercial</div>
    <div class="ctop-h1">Cotización de Cubierta<br>con Paneles Aislantes</div>
    <div class="ctop-h2">${esc(q.panelDescLine)}</div>
  </div>
  <div class="cov-body">
    <div class="cov-meta">
      <div class="cm"><div class="cml">Referencia</div><div class="cmv">${esc(q.ref)}</div></div>
      <div class="cm"><div class="cml">Fecha</div><div class="cmv">${esc(q.fecha)}</div></div>
      <div class="cm"><div class="cml">Escenario</div><div class="cmv">${esc(q.escenario)}</div></div>
      <div class="cm"><div class="cml">Validez</div><div class="cmv">${esc(q.validez)}</div></div>
    </div>
    <div class="ckpis">
      <div class="ck"><div class="ckl">Área</div><div class="ckv">${Number(q.areaTotalM2).toFixed(1)}</div><div class="cku">m²</div></div>
      <div class="ck"><div class="ckl">Paneles</div><div class="ckv">${esc(String(q.panelCount))}</div><div class="cku">unid.</div></div>
      <div class="ck"><div class="ckl">Apoyos</div><div class="ckv">${esc(String(q.apoyoCount))}</div><div class="cku">estruct.</div></div>
      <div class="ck"><div class="ckl">Fijaciones</div><div class="ckv">${esc(String(q.fijacionCount))}</div><div class="cku">puntos</div></div>
    </div>
    <div class="csec">Resumen por partida</div>
    <div class="cgroups">${renderBomGroups(q.bomGroups)}</div>
    <div class="ctot">
      <div>
        <div class="ctlbl">Total con IVA 22%</div>
        <div class="ctsub">Subtotal s/IVA: USD ${fmt(q.subtotalSinIva)} · IVA: USD ${fmt(q.ivaAmount)}</div>
      </div>
      <div class="ctamt">USD ${fmt(q.totalConIva)}</div>
    </div>
    <div class="ccond"><strong>Condiciones:</strong> ${esc(q.conditionsText)}</div>
  </div>
  <div class="cftr"><span>bmcuruguay.com.uy · 092 663 245 · Metalog SAS</span><span class="cpg">1 / 3</span></div>
</div>`;

  const page2 = `
<div class="page p2">
  <div class="ph">
    <div class="phl"><div class="phb">B</div><div><div class="pht">BMC Uruguay</div><div class="phs">Panelin · planta de cubierta</div></div></div>
    <div class="phr"><div><strong>Ref:</strong> ${esc(q.ref)}</div><div><strong>Fecha:</strong> ${esc(q.fecha)}</div><div style="font-size:7pt;margin-top:2px;color:#94A3B8">Sin escala</div></div>
  </div>
  <div class="sec">Visualización 2D · Planta de Cubierta</div>
  ${renderSvgPlan(q.svgPlanHtml, q.planTitle, q.planSummary)}
  ${q.zoneRows.length ? `
  <div class="sec">Leyenda</div>
  <div class="leg">
    <div class="li"><div class="sw" style="background:#EBF3EE;border:1px solid #2C4A3E"></div><span>Panel impar</span></div>
    <div class="li"><div class="sw" style="background:#D9EBE0;border:1px solid #2C4A3E"></div><span>Panel par</span></div>
    <div class="li"><div class="sw" style="background:#5D8AA8;height:6px;margin-top:2px"></div><span>Gotero perimetral</span></div>
    <div class="li"><div class="sw" style="background:none;border:1.5px dashed #94A3B8"></div><span>Encuentro de zonas</span></div>
    <div class="li" style="gap:8px"><span style="font-size:11pt;line-height:1">&#8595;</span><span>Dirección pendiente</span></div>
    <div class="li"><div class="sw" style="background:#2C4A3E"></div><span>Borde sellado</span></div>
  </div>
  <div class="sec">Resumen de Zonas</div>
  <table class="zt"><thead><tr>
    <th style="text-align:left">Zona</th><th style="text-align:left">Descripción</th>
    <th>Largo</th><th>Ancho útil</th><th>Pan.</th><th>Área</th><th>AU</th>
  </tr></thead><tbody>${renderZoneRows(q.zoneRows)}</tbody></table>` : ''}
  <div class="pgf"><span>BMC Uruguay · Metalog SAS · bmcuruguay.com.uy</span><span style="color:#2C4A3E;font-weight:700">2 / 3</span></div>
</div>`;

  const page3 = `
<div class="page p3">
  <div class="ph">
    <div class="phl"><div class="phb">B</div><div><div class="pht">BMC Uruguay</div><div class="phs">Cotización detallada · BOM completo</div></div></div>
    <div class="phr"><div><strong>Ref:</strong> ${esc(q.ref)}</div><div><strong>Fecha:</strong> ${esc(q.fecha)}</div></div>
  </div>
  <div class="sec">Presupuesto Detallado</div>
  <table class="bom"><thead><tr>
    <th style="text-align:left;width:44%">Descripción</th>
    <th style="width:11%">Cant.</th><th style="width:9%;text-align:center">Unid.</th>
    <th style="width:17%">P.U. USD</th><th style="width:19%">Total USD</th>
  </tr></thead><tbody>${renderBomDetailRows(q.bomDetailGroups)}</tbody></table>
  <div class="tots"><div class="ti">
    <div class="tr"><span>Subtotal sin IVA</span><span>USD ${fmt(q.subtotalSinIva)}</span></div>
    <div class="tr"><span>IVA 22%</span><span>USD ${fmt(q.ivaAmount)}</span></div>
    <div class="tr trt"><span>Total USD</span><span>${fmt(q.totalConIva)}</span></div>
  </div></div>
  <div class="cond"><strong>Condiciones:</strong> ${esc(q.conditionsText)}</div>
  <div class="bank">
    <div class="bankt">Datos para depósito bancario</div>
    <div>Titular: <strong>Metalog SAS</strong></div><div>RUT: <strong>120403430012</strong></div>
    <div>BROU · Cta. Dólares: <strong>110520638-00002</strong></div><div>Consultas: <strong>092 663 245</strong></div>
  </div>
  <div class="pgf"><span>BMC Uruguay · Metalog SAS · bmcuruguay.com.uy</span><span style="color:#2C4A3E;font-weight:700">3 / 3</span></div>
</div>`;

  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><title>Cotización BMC Uruguay</title>
<style>${CSS}</style>
</head><body>${page1}${page2}${page3}</body></html>`;
}
