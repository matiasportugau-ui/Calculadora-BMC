// src/pdf-templates/bmc-pdf.js
// Layout G — BMC PDF (Blueprint Técnico)
// Paleta: navy #022255 + warm neutral #dad8d2 + perimeter green #2cba48
// Tipografía: JetBrains Mono + Archivo (fall-back system-ui)
// Estructura: 2 páginas A4 — Pg1: Rótulo + KPIs + Planta + Resumen / Pg2: BOM + Totales

const fmt = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const T = {
  ink:       '#022255',
  accent:    '#dad8d2',
  perimeter: '#2cba48',
  paper:     '#F5F7FA',
  paperAlt:  '#E8EBF0',
  soft:      '#5b6577',
  rule:      '#c9d3e2',
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Archivo:wght@400;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:0}
body{font-family:'JetBrains Mono',ui-monospace,monospace;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;font-size:9pt;color:${T.ink};background:${T.paper}}
.page{width:210mm;min-height:297mm;position:relative;overflow:hidden;background:${T.paper}}
@media screen{body{background:#2a2a2a;padding:24px 0}.page{margin:0 auto 32px;box-shadow:0 8px 40px rgba(0,0,0,.45);max-width:794px}}
@media print{.page{page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}}
.inner{position:absolute;top:36px;left:36px;right:36px;bottom:36px;display:flex;flex-direction:column}
.frame{position:absolute;top:32px;left:32px;right:32px;bottom:32px;border:.6px solid ${T.ink};pointer-events:none}
/* Registration marks */
.reg{position:absolute;width:20px;height:20px}
.reg svg{position:absolute;top:0;left:0}
/* Rótulo / title block */
.rotulo{display:grid;grid-template-columns:auto 1fr 1fr 1fr 1fr;border:1px solid ${T.ink};font-size:7.5pt}
.rot-logo{padding:10px 14px;border-right:1px solid ${T.ink};background:${T.ink};display:flex;flex-direction:column;justify-content:center;min-width:90px}
.rot-logo-mark{font-family:'Archivo',sans-serif;font-size:22pt;font-weight:800;color:${T.accent};letter-spacing:-.02em;line-height:1}
.rot-logo-sub{font-size:5.5pt;color:rgba(218,216,210,.55);letter-spacing:.2em;font-weight:700;margin-top:2px;text-transform:uppercase}
.rot-cell{padding:6px 10px;border-right:1px solid ${T.ink};border-top:1px solid ${T.rule}}
.rot-cell:last-child{border-right:none}
.rot-label{font-size:5.5pt;letter-spacing:.22em;color:${T.soft};font-weight:700;text-transform:uppercase;margin-bottom:2px}
.rot-value{font-size:8.5pt;font-weight:600}
/* Header rule */
.page-rule{height:1.2px;background:${T.ink};margin:10px 0 8px}
/* Section label */
.sec-label{font-size:6pt;letter-spacing:.24em;font-weight:700;color:${T.ink};text-transform:uppercase;margin-bottom:6px}
/* KPI strip */
.kpi-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid ${T.ink};margin-bottom:10px}
.kpi{padding:8px 10px;border-right:1px solid ${T.ink}}
.kpi:last-child{border-right:none}
.kpi-l{font-size:5.5pt;letter-spacing:.22em;color:${T.soft};font-weight:700;text-transform:uppercase;margin-bottom:3px}
.kpi-v{font-family:'Archivo',sans-serif;font-size:20pt;font-weight:900;line-height:1;color:${T.ink}}
.kpi-u{font-size:6pt;color:${T.soft};margin-top:1px}
/* Main columns layout */
.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px;flex:1;min-height:0}
.col{display:flex;flex-direction:column;gap:8px;min-height:0;overflow:hidden}
/* Plan container */
.plan-box{border:1px solid ${T.ink};flex:1;display:flex;flex-direction:column;min-height:0}
.plan-hdr{background:${T.ink};color:${T.accent};padding:4px 8px;font-size:6.5pt;font-weight:700;letter-spacing:.08em;display:flex;justify-content:space-between}
.plan-body{padding:4px;background:${T.paperAlt};flex:1;overflow:hidden}
.plan-body svg{display:block;width:100%;height:100%}
/* Zone table (compact) */
.zt{width:100%;border-collapse:collapse;font-size:7.5pt}
.zt th{padding:4px 6px;background:${T.ink};color:${T.accent};font-weight:700;font-size:6pt;letter-spacing:.1em;text-transform:uppercase;text-align:right}
.zt th:first-child,.zt th:nth-child(2){text-align:left}
.zt td{padding:3px 6px;border-bottom:.4px solid ${T.rule};text-align:right;font-variant-numeric:tabular-nums}
.zt td:first-child,.zt td:nth-child(2){text-align:left}
.zt tr:nth-child(even) td{background:${T.paperAlt}}
/* BOM groups summary */
.bom-summary{border:.6px solid ${T.ink};flex:1}
.bom-summary-hdr{padding:4px 8px;background:${T.ink};color:${T.accent};font-size:6pt;letter-spacing:.2em;font-weight:700;text-transform:uppercase}
.bom-row{display:flex;justify-content:space-between;padding:4px 8px;border-bottom:.4px solid ${T.rule};font-size:8pt}
.bom-row:last-child{border-bottom:none}
.bom-row-n{font-weight:600}
.bom-row-v{font-variant-numeric:tabular-nums;font-weight:700}
/* Total block */
.total-block{border:2px solid ${T.ink};background:${T.ink};color:${T.accent};padding:10px 12px;display:flex;justify-content:space-between;align-items:center}
.total-labels{}
.total-lbl{font-size:6pt;letter-spacing:.2em;font-weight:700;color:rgba(218,216,210,.55);text-transform:uppercase}
.total-sub{font-size:7pt;color:rgba(218,216,210,.55);margin-top:2px}
.total-amt{font-family:'Archivo',sans-serif;font-size:24pt;font-weight:900;font-variant-numeric:tabular-nums;color:${T.accent};letter-spacing:-.02em}
/* Page 2 */
.pg2-hdr{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.2px solid ${T.ink};padding-bottom:6px;margin-bottom:10px}
.pg2-logo-area{display:flex;align-items:center;gap:12px}
.pg2-bmc{font-family:'Archivo',sans-serif;font-size:20pt;font-weight:900;color:${T.ink};letter-spacing:-.02em}
.pg2-bmc-sub{font-size:6pt;letter-spacing:.22em;color:${T.soft};font-weight:700;margin-top:2px}
.pg2-divider{width:1px;height:32px;background:${T.ink};margin:0 4px}
.pg2-co{font-size:8pt;font-weight:700;letter-spacing:.04em}
.pg2-co-sub{font-size:6pt;letter-spacing:.2em;color:${T.soft}}
.pg2-meta{text-align:right;font-size:7.5pt}
.pg2-meta span.l{color:${T.soft}}
/* Full BOM table */
.bom-full{width:100%;border-collapse:collapse;font-size:8pt;margin-bottom:10px}
.bom-full th{padding:5px 8px;background:${T.ink};color:${T.accent};font-weight:700;font-size:6.5pt;letter-spacing:.08em;text-transform:uppercase;text-align:right}
.bom-full th:first-child{text-align:left}
.bom-full td{padding:4px 8px;border-bottom:.3px solid ${T.rule};text-align:right;font-variant-numeric:tabular-nums}
.bom-full td:first-child{text-align:left}
.bom-full tr:nth-child(even) td{background:${T.paperAlt}}
.bom-full .bom-gh td{background:${T.accent}!important;color:${T.ink}!important;font-weight:800!important;font-size:7pt!important;letter-spacing:.1em!important;border-top:1px solid ${T.ink}!important;border-bottom:none!important;padding:5px 8px!important}
/* Bottom grid (totals + conditions) */
.bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px}
.totals-box{border:.6px solid ${T.ink};padding:8px 12px;display:flex;flex-direction:column;gap:4px}
.tot-row{display:flex;justify-content:space-between;font-size:8.5pt;font-variant-numeric:tabular-nums}
.tot-row.soft{color:${T.soft}}
.tot-final{background:${T.ink};color:${T.accent};padding:6px 10px;display:flex;justify-content:space-between;align-items:center;margin-top:4px;font-family:'Archivo',sans-serif;font-size:14pt;font-weight:900}
.tot-final-lbl{font-size:7pt;font-family:'JetBrains Mono',monospace;color:rgba(218,216,210,.55);letter-spacing:.12em}
.cond-box{border:.6px solid ${T.ink};padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.cond-lbl{font-size:5.5pt;letter-spacing:.24em;font-weight:700;color:${T.soft};text-transform:uppercase;margin-bottom:4px}
.cond-text{font-size:7.5pt;line-height:1.65;color:${T.ink}}
.bank-row{font-size:7.5pt;line-height:1.6}
.pg-num{position:absolute;right:44px;bottom:22px;font-size:7pt;letter-spacing:.18em;font-weight:700}
.pg-foot{position:absolute;left:44px;bottom:22px;font-size:7pt;letter-spacing:.12em;color:${T.soft}}
`;

// Registration mark SVG
const regMark = (x, y) => {
  const rot = x < 400 ? (y < 400 ? '' : 'transform="rotate(90,10,10)"') : (y < 400 ? 'transform="rotate(270,10,10)"' : 'transform="rotate(180,10,10)"');
  return `<svg width="20" height="20" style="position:absolute;left:${x - 10}px;top:${y - 10}px"><g ${rot}>
    <line x1="0" y1="10" x2="20" y2="10" stroke="${T.ink}" stroke-width="0.6"/>
    <line x1="10" y1="0" x2="10" y2="20" stroke="${T.ink}" stroke-width="0.6"/>
    <circle cx="10" cy="10" r="4" fill="none" stroke="${T.ink}" stroke-width="0.6"/>
  </g></svg>`;
};

function renderZoneRows(zoneRows) {
  const rows = zoneRows.map((r, i) =>
    `<tr${i % 2 ? '' : ''}>
      <td style="font-weight:700">Z${i + 1}</td>
      <td>${esc(r.desc)}</td>
      <td>${esc(r.largo)}</td>
      <td>${esc(r.ancho)}</td>
      <td>${r.paneles}</td>
      <td>${esc(r.area)}</td>
      <td>${esc(r.au)}</td>
    </tr>`
  ).join('');
  const tp = zoneRows.reduce((s, r) => s + (Number(r.paneles) || 0), 0);
  const ta = zoneRows.reduce((s, r) => s + parseFloat(r.area), 0);
  return rows + `<tr style="border-top:1px solid ${T.ink};font-weight:800;font-size:7pt;letter-spacing:.1em">
    <td colspan="4" style="text-transform:uppercase">Total</td>
    <td>${tp}</td><td>${ta.toFixed(2)} m²</td><td></td>
  </tr>`;
}

function renderBomDetail(bomDetailGroups) {
  return bomDetailGroups.map(g => {
    const gh = `<tr class="bom-gh"><td colspan="4">&#9658; ${esc(g.groupName.toUpperCase())}</td><td style="text-align:right">${fmt(g.groupTotal)}</td></tr>`;
    const ih = g.items.map((i, idx) => {
      const qty = typeof i.qty === 'number' ? (i.qty % 1 === 0 ? i.qty : i.qty.toFixed(2)) : (i.qty ?? '');
      return `<tr${idx % 2 ? '' : ''}>
        <td>${esc(i.desc)}</td>
        <td style="text-align:right">${qty}</td>
        <td style="text-align:center;color:${T.soft}">${esc(i.unit)}</td>
        <td style="text-align:right">${fmt(i.pu)}</td>
        <td>${fmt(i.total)}</td>
      </tr>`;
    }).join('');
    return gh + ih;
  }).join('');
}

function planBlock(svgPlanHtml, planTitle, planSummary) {
  const inner = svgPlanHtml
    ? svgPlanHtml.replace(/width="[^"]*"/, 'width="100%"').replace(/height="[^"]*"/, 'style="display:block;width:100%"')
    : `<div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:120px;color:${T.soft};font-size:8pt">Plano 2D no disponible</div>`;
  return `<div class="plan-box">
  <div class="plan-hdr"><span>${esc(planTitle.toUpperCase())}</span><span>${esc(planSummary)}</span></div>
  <div class="plan-body">${inner}</div>
</div>`;
}

export function render(q) {
  const page1 = `<div class="page">
  ${regMark(18, 18)}${regMark(776, 18)}${regMark(18, 1105)}${regMark(776, 1105)}
  <div class="frame"></div>
  <div class="inner">

    <!-- Rótulo -->
    <div class="rotulo">
      <div class="rot-logo">
        <div class="rot-logo-mark">BMC</div>
        <div class="rot-logo-sub">Uruguay</div>
      </div>
      <div class="rot-cell">
        <div class="rot-label">Proyecto</div>
        <div class="rot-value">${esc(q.panelDescLine)}</div>
      </div>
      <div class="rot-cell">
        <div class="rot-label">Referencia</div>
        <div class="rot-value">${esc(q.ref)}</div>
      </div>
      <div class="rot-cell">
        <div class="rot-label">Fecha</div>
        <div class="rot-value">${esc(q.fecha)}</div>
      </div>
      <div class="rot-cell" style="border-right:none">
        <div class="rot-label">Escenario</div>
        <div class="rot-value">${esc(q.escenario)}</div>
      </div>
    </div>

    <div class="page-rule"></div>

    <!-- KPI strip -->
    <div class="kpi-strip">
      <div class="kpi"><div class="kpi-l">Área total</div><div class="kpi-v">${Number(q.areaTotalM2).toFixed(1)}</div><div class="kpi-u">m²</div></div>
      <div class="kpi"><div class="kpi-l">Paneles</div><div class="kpi-v">${q.panelCount}</div><div class="kpi-u">unid.</div></div>
      <div class="kpi"><div class="kpi-l">Apoyos</div><div class="kpi-v">${q.apoyoCount}</div><div class="kpi-u">estruct.</div></div>
      <div class="kpi" style="border-right:none"><div class="kpi-l">Fijaciones</div><div class="kpi-v">${q.fijacionCount}</div><div class="kpi-u">puntos</div></div>
    </div>

    <!-- Two columns: plan + data -->
    <div class="cols">

      <!-- LEFT: planta de cubierta -->
      <div class="col">
        <div class="sec-label">&#9635; planta de cubierta</div>
        ${planBlock(q.svgPlanHtml, q.planTitle, q.planSummary)}
        ${q.zoneRows.length ? `
        <div class="sec-label" style="margin-top:6px">&#9635; zonificación</div>
        <table class="zt"><thead><tr>
          <th style="text-align:left">Zona</th><th style="text-align:left">Descripción</th>
          <th>Largo</th><th>Ancho útil</th><th>Pan.</th><th>Área m²</th><th>AU</th>
        </tr></thead><tbody>${renderZoneRows(q.zoneRows)}</tbody></table>` : ''}
      </div>

      <!-- RIGHT: resumen + totales -->
      <div class="col">
        <div class="sec-label">&#9635; resumen por partida</div>
        <div class="bom-summary">
          <div class="bom-summary-hdr">Partidas · cotización ${esc(q.ref)}</div>
          ${q.bomGroups.map(g =>
            `<div class="bom-row"><span class="bom-row-n">${esc(g.name)}</span><span class="bom-row-v">USD ${fmt(g.totalUsd)}</span></div>`
          ).join('')}
        </div>
        <div class="total-block">
          <div class="total-labels">
            <div class="total-lbl">Total con IVA 22%</div>
            <div class="total-sub">s/IVA: USD ${fmt(q.subtotalSinIva)} · IVA: USD ${fmt(q.ivaAmount)}</div>
          </div>
          <div class="total-amt">USD ${fmt(q.totalConIva)}</div>
        </div>
        <div style="font-size:6pt;color:${T.soft};margin-top:6px;line-height:1.5;letter-spacing:.04em">
          Detalle completo de materiales en hoja 2/2
        </div>
        <div style="margin-top:auto;padding-top:8px;border-top:.5px solid ${T.rule};font-size:7pt;color:${T.soft};line-height:1.6">
          <strong style="color:${T.ink}">Condiciones:</strong> ${esc(q.conditionsText)}
        </div>
      </div>

    </div>

  </div>
  <div class="pg-foot">bmcuruguay.com.uy · Metalog SAS · 092 663 245</div>
  <div class="pg-num" style="color:${T.ink}">SHEET 1/2</div>
</div>`;

  const page2 = `<div class="page">
  ${regMark(18, 18)}${regMark(776, 18)}${regMark(18, 1105)}${regMark(776, 1105)}
  <div class="frame"></div>
  <div class="inner">

    <div class="pg2-hdr">
      <div class="pg2-logo-area">
        <div>
          <div class="pg2-bmc">BMC</div>
          <div class="pg2-bmc-sub">Uruguay · Panelin</div>
        </div>
        <div class="pg2-divider"></div>
        <div>
          <div class="pg2-co">METALOG SAS</div>
          <div class="pg2-co-sub">DESARROLLO DE COTIZACIÓN</div>
        </div>
      </div>
      <div class="pg2-meta">
        <div><span class="l">REF</span> &nbsp; <strong>${esc(q.ref)}</strong></div>
        <div><span class="l">FECHA</span> &nbsp; <strong>${esc(q.fecha)}</strong></div>
        <div><span class="l">VALIDEZ</span> &nbsp; <strong>${esc(q.validez)}</strong></div>
      </div>
    </div>

    <div class="sec-label">&#9635; 02 · desarrollo del presupuesto</div>
    <table class="bom-full"><thead><tr>
      <th style="text-align:left;width:44%">Descripción</th>
      <th style="width:10%">Cant.</th>
      <th style="width:9%;text-align:center">Unid.</th>
      <th style="width:18%">P.U. USD</th>
      <th style="width:19%">Total USD</th>
    </tr></thead><tbody>${renderBomDetail(q.bomDetailGroups)}</tbody></table>

    <div class="bottom-grid">
      <!-- Conditions + bank -->
      <div class="cond-box">
        <div>
          <div class="cond-lbl">Condiciones comerciales</div>
          <div class="cond-text">${esc(q.conditionsText)}</div>
        </div>
        <div style="padding-top:8px;border-top:.5px solid ${T.rule}">
          <div class="cond-lbl">Datos para depósito bancario</div>
          <div class="bank-row">Titular: <strong>Metalog SAS</strong> · RUT: <strong>120403430012</strong></div>
          <div class="bank-row">BROU · Cta. Dólares: <strong>110520638-00002</strong></div>
          <div class="bank-row">Consultas: <strong>092 663 245</strong></div>
        </div>
        <div style="padding-top:8px;border-top:.5px dashed ${T.rule};font-size:7pt;color:${T.soft};line-height:1.6">
          <strong style="color:${T.ink}">Aceptación:</strong> Esta cotización se considera aceptada con la entrega de la seña según condiciones.<br>
          Firma: _____________________________ &nbsp; Fecha: _______________
        </div>
      </div>

      <!-- Totals -->
      <div style="display:flex;flex-direction:column;gap:6px">
        <div class="totals-box">
          <div class="tot-row soft"><span>Subtotal sin IVA</span><span>USD ${fmt(q.subtotalSinIva)}</span></div>
          <div class="tot-row soft"><span>IVA 22%</span><span>USD ${fmt(q.ivaAmount)}</span></div>
        </div>
        <div class="tot-final">
          <div>
            <div class="tot-final-lbl">Total con IVA</div>
          </div>
          <span>USD ${fmt(q.totalConIva)}</span>
        </div>
        <div style="border:.6px dashed ${T.ink};padding:8px 12px;font-size:7pt;color:${T.soft};line-height:1.6;margin-top:auto">
          Oferta válida <strong style="color:${T.ink}">${esc(q.validez)}</strong>.<br>
          Precios en USD. IVA incluido en el total indicado.
        </div>
      </div>
    </div>

  </div>
  <div class="pg-foot">bmcuruguay.com.uy · Metalog SAS · 092 663 245</div>
  <div class="pg-num" style="color:${T.ink}">SHEET 2/2</div>
</div>`;

  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><title>Cotización BMC Uruguay</title>
<style>${CSS}</style>
</head><body>${page1}${page2}</body></html>`;
}
