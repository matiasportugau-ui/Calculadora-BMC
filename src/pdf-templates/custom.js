// src/pdf-templates/custom.js
// Layout F — Custom (user-defined)
//
// HOW TO INTEGRATE:
// 1. Edit public/pdf-designs/F-custom-template.html in your browser
// 2. Copy your final CSS into the CSS constant below
// 3. Adapt the 3 page() functions with your HTML structure
// 4. The q.* variables are automatically replaced with real quote data
//
// AVAILABLE DATA (q = QuotationModel):
//   q.ref              "BMC-2026-0112"
//   q.fecha            "28/04/2026"
//   q.escenario        "Solo Techo"
//   q.validez          "10 días hábiles"
//   q.panelDescLine    "ISODEC EPS 100mm · Color Blanco · Techo · 3 Zonas"
//   q.areaTotalM2      138.88  (number)
//   q.panelCount       18      (number)
//   q.apoyoCount       3       (number)
//   q.fijacionCount    95      (number)
//   q.bomGroups        [{ name, totalUsd }]
//   q.subtotalSinIva   7655.06 (number)
//   q.ivaAmount        1684.11 (number)
//   q.totalConIva      9339.17 (number)
//   q.svgPlanHtml      "<svg>...</svg>"  (full roof plan SVG, may be "")
//   q.planTitle        "Planta Cubierta — Única Agua · 3 Zonas"
//   q.planSummary      "138.88 m² · 18 paneles · AU 1.12 m"
//   q.zoneRows         [{ zona, desc, largo, ancho, paneles, area, au }]
//   q.bomDetailGroups  [{ groupName, groupTotal, items:[{desc,qty,unit,pu,total}] }]
//   q.conditionsText   "Fabricación y entrega..."

const fmt = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── Paste your CSS from F-custom-template.html here ─────────────────────────
const CSS = `
/* PASTE YOUR CSS HERE */
`;

// ── BOM helpers (keep as-is, or adapt to your CSS class names) ──────────────

function renderBomGroups(bomGroups) {
  return bomGroups.map(g =>
    `<div class="cov-group-row"><span class="group-name">${esc(g.name)}</span><span class="group-total">USD ${fmt(g.totalUsd)}</span></div>`
  ).join('');
}

function renderZoneRows(zoneRows) {
  const rows = zoneRows.map(r =>
    `<tr><td><strong>${esc(r.zona)}</strong></td><td>${esc(r.desc)}</td><td>${esc(r.largo)}</td><td>${esc(r.ancho)}</td><td>${r.paneles}</td><td>${esc(r.area)}</td><td>${esc(r.au)}</td></tr>`
  ).join('');
  const tp = zoneRows.reduce((s, r) => s + (Number(r.paneles) || 0), 0);
  const ta = zoneRows.reduce((s, r) => s + parseFloat(r.area), 0);
  return rows + `<tr style="font-weight:700"><td colspan="4"><strong>TOTAL</strong></td><td><strong>${tp}</strong></td><td><strong>${ta.toFixed(2)} m²</strong></td><td></td></tr>`;
}

function renderBomDetail(bomDetailGroups) {
  return bomDetailGroups.map(g => {
    const gh = `<tr class="bom-group"><td colspan="4">&#9658; ${esc(g.groupName)}</td><td style="text-align:right">${fmt(g.groupTotal)}</td></tr>`;
    const ih = g.items.map(i => {
      const qty = typeof i.qty === 'number' ? (i.qty % 1 === 0 ? i.qty : i.qty.toFixed(2)) : (i.qty ?? '');
      return `<tr><td>${esc(i.desc)}</td><td style="text-align:right">${qty}</td><td style="text-align:center">${esc(i.unit)}</td><td style="text-align:right">${fmt(i.pu)}</td><td style="text-align:right">${fmt(i.total)}</td></tr>`;
    }).join('');
    return gh + ih;
  }).join('');
}

function renderSvgPlan(svgPlanHtml, planTitle, planSummary) {
  const inner = svgPlanHtml
    ? svgPlanHtml.replace(/width="[^"]*"/, 'width="100%"').replace(/height="[^"]*"/, '')
    : `<div style="padding:20px;text-align:center;color:#999;font-size:9pt">Plano 2D no disponible</div>`;
  return `<div class="plan-container">
  <div class="plan-header"><span>${esc(planTitle)}</span><span>${esc(planSummary)}</span></div>
  <div class="plan-body">${inner}</div>
</div>`;
}

// ── Page renderers — adapt HTML structure to match your design ───────────────

function page1(q) {
  return `<div class="page cover">
  <div class="cov-header">
    <div class="cov-logo">
      <div class="cov-logo-mark">B</div>
      <div><div class="cov-logo-name">BMC Uruguay</div><div class="cov-logo-sub">Panelin</div></div>
    </div>
    <div class="cov-badge">Propuesta Comercial</div>
  </div>
  <div class="cov-body">
    <div class="cov-title">Cotización de Cubierta<br>con Paneles Aislantes</div>
    <div class="cov-subtitle">${esc(q.panelDescLine)}</div>
    <div class="cov-divider"></div>
    <div class="cov-meta">
      <div class="meta-item"><div class="meta-label">Referencia</div><div class="meta-value">${esc(q.ref)}</div></div>
      <div class="meta-item"><div class="meta-label">Fecha</div><div class="meta-value">${esc(q.fecha)}</div></div>
      <div class="meta-item"><div class="meta-label">Escenario</div><div class="meta-value">${esc(q.escenario)}</div></div>
      <div class="meta-item"><div class="meta-label">Validez</div><div class="meta-value">${esc(q.validez)}</div></div>
    </div>
    <div class="cov-kpis">
      <div class="kpi-card"><div class="kpi-label">Área</div><div class="kpi-value">${Number(q.areaTotalM2).toFixed(1)}</div><div class="kpi-unit">m²</div></div>
      <div class="kpi-card"><div class="kpi-label">Paneles</div><div class="kpi-value">${q.panelCount}</div><div class="kpi-unit">unid.</div></div>
      <div class="kpi-card"><div class="kpi-label">Apoyos</div><div class="kpi-value">${q.apoyoCount}</div><div class="kpi-unit">estruct.</div></div>
      <div class="kpi-card"><div class="kpi-label">Fijaciones</div><div class="kpi-value">${q.fijacionCount}</div><div class="kpi-unit">puntos</div></div>
    </div>
    <div class="cov-section-label">Resumen por partida</div>
    <div class="cov-groups">${renderBomGroups(q.bomGroups)}</div>
    <div class="cov-total">
      <div class="total-label-block">
        <div class="total-label">Total con IVA 22%</div>
        <div class="total-sub">Subtotal s/IVA: USD ${fmt(q.subtotalSinIva)} · IVA: USD ${fmt(q.ivaAmount)}</div>
      </div>
      <div class="total-amount">USD ${fmt(q.totalConIva)}</div>
    </div>
    <div class="cov-conditions"><strong>Condiciones:</strong> ${esc(q.conditionsText)}</div>
  </div>
  <div class="cov-footer"><span>bmcuruguay.com.uy · 092 663 245 · Metalog SAS</span><span class="cov-footer-pg">1 / 3</span></div>
</div>`;
}

function page2(q) {
  return `<div class="page p2">
  <div class="page-header">
    <div class="ph-left"><div class="ph-mark">B</div><div><div class="ph-title">BMC Uruguay</div><div class="ph-sub">Panelin · planta de cubierta</div></div></div>
    <div class="ph-right"><div><strong>Ref:</strong> ${esc(q.ref)}</div><div><strong>Fecha:</strong> ${esc(q.fecha)}</div></div>
  </div>
  <div class="section-label">Visualización 2D · Planta de Cubierta</div>
  ${renderSvgPlan(q.svgPlanHtml, q.planTitle, q.planSummary)}
  ${q.zoneRows.length ? `
  <div class="section-label">Leyenda</div>
  <div class="legend">
    <div class="legend-item"><div class="legend-swatch" style="background:#e0e7f0;border:1px solid var(--primary)"></div><span>Panel impar</span></div>
    <div class="legend-item"><div class="legend-swatch" style="background:#c8d8ee;border:1px solid var(--primary)"></div><span>Panel par</span></div>
    <div class="legend-item"><div class="legend-swatch" style="background:var(--accent);height:6px;margin-top:2px"></div><span>Gotero perimetral</span></div>
    <div class="legend-item"><div class="legend-swatch" style="background:none;border:1.5px dashed var(--accent)"></div><span>Encuentro</span></div>
    <div class="legend-item" style="gap:8px"><span style="font-size:11pt">&#8595;</span><span>Pendiente</span></div>
    <div class="legend-item"><div class="legend-swatch" style="background:var(--primary)"></div><span>Borde</span></div>
  </div>
  <div class="section-label">Resumen de Zonas</div>
  <table class="zone-table"><thead><tr>
    <th style="text-align:left">Zona</th><th style="text-align:left">Descripción</th>
    <th>Largo</th><th>Ancho útil</th><th>Pan.</th><th>Área</th><th>AU</th>
  </tr></thead><tbody>${renderZoneRows(q.zoneRows)}</tbody></table>` : ''}
  <div class="page-footer"><span>BMC Uruguay · Metalog SAS · bmcuruguay.com.uy</span><span class="page-footer-pg">2 / 3</span></div>
</div>`;
}

function page3(q) {
  return `<div class="page p3">
  <div class="page-header">
    <div class="ph-left"><div class="ph-mark">B</div><div><div class="ph-title">BMC Uruguay</div><div class="ph-sub">Cotización detallada · BOM completo</div></div></div>
    <div class="ph-right"><div><strong>Ref:</strong> ${esc(q.ref)}</div><div><strong>Fecha:</strong> ${esc(q.fecha)}</div></div>
  </div>
  <div class="section-label">Presupuesto Detallado</div>
  <table class="bom-table"><thead><tr>
    <th style="text-align:left;width:44%">Descripción</th>
    <th style="width:11%">Cant.</th><th style="width:9%;text-align:center">Unid.</th>
    <th style="width:17%">P.U. USD</th><th style="width:19%">Total USD</th>
  </tr></thead><tbody>${renderBomDetail(q.bomDetailGroups)}</tbody></table>
  <div class="bom-totals"><div class="totals-card">
    <div class="total-row"><span>Subtotal sin IVA</span><span>USD ${fmt(q.subtotalSinIva)}</span></div>
    <div class="total-row"><span>IVA 22%</span><span>USD ${fmt(q.ivaAmount)}</span></div>
    <div class="total-row final"><span>Total USD</span><span>${fmt(q.totalConIva)}</span></div>
  </div></div>
  <div class="bom-conditions"><strong>Condiciones:</strong> ${esc(q.conditionsText)}</div>
  <div class="bank-data">
    <div class="bank-title">Datos para depósito bancario</div>
    <div>Titular: <strong>Metalog SAS</strong></div><div>RUT: <strong>120403430012</strong></div>
    <div>BROU · Cta. Dólares: <strong>110520638-00002</strong></div><div>Consultas: <strong>092 663 245</strong></div>
  </div>
  <div class="page-footer"><span>BMC Uruguay · Metalog SAS · bmcuruguay.com.uy</span><span class="page-footer-pg">3 / 3</span></div>
</div>`;
}

// ── Entry point ──────────────────────────────────────────────────────────────
export function render(q) {
  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><title>Cotización BMC Uruguay</title>
<style>${CSS}</style>
</head><body>${page1(q)}${page2(q)}${page3(q)}</body></html>`;
}
