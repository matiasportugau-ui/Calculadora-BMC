// AUTO-GENERATED — do not edit by hand.
// Source: bmc-pdf-template.html (BMC Uruguay quote PDF template)
// Regenerate when the template changes.

export const BMC_PDF_TEMPLATE_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>BMC Quote</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=block" rel="stylesheet">
<style>
  :root {
    --ink: #022255;
    --ink-2: #0a1638;
    --accent: #dad8d2;
    --accent-2: #c9a26b;
    --perimeter: #2cba48;
    --paper: #F5F7FA;
    --paper-alt: #E8EBF0;
    --soft: #5b6577;
    --rule: #c9d3e2;
    --display: 'Archivo', system-ui, sans-serif;
    --mono: 'JetBrains Mono', ui-monospace, monospace;
    --c-paneles:    #022255;
    --c-perfileria: #5A7BB8;
    --c-fijaciones: #c9a26b;
    --c-selladores: #2cba48;
    --c-servicios:  #5b6577;
  }
  @page { size: A4 portrait; margin: 12mm; }
  html, body { margin: 0; padding: 0; background: #e9ecef; }
  body { font-family: var(--display); color: var(--ink); }
  .page {
    width: 186mm; min-height: 273mm;
    background: var(--paper);
    margin: 8mm auto; padding: 0;
    box-sizing: border-box;
    page-break-after: always; break-after: page;
    position: relative;
    box-shadow: 0 0 0 1px #d8dde3;
  }
  .page:last-child { page-break-after: auto; break-after: auto; }
  @media print {
    body { background: white; }
    .page { margin: 0; box-shadow: none; min-height: auto; }
  }
  .pad { padding: 14px 18px 32px; }

  /* ===================================================================
     P1 · HEADER BLOCK — single solid block (logo + panel + fecha + ref)
     =================================================================== */
  .pp-header {
    display: grid;
    grid-template-columns: 130px 1fr 170px;
    background: var(--ink);
    color: var(--paper);
    border: 1px solid var(--ink);
  }
  .pp-header .h-logo {
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    border-right: 1px solid rgba(255,255,255,0.18);
  }
  .pp-header .h-logo img {
    width: 96px; height: auto;
    filter: brightness(0) invert(1);
  }
  .pp-header .h-main {
    padding: 16px 20px;
    display: flex; flex-direction: column; justify-content: center;
  }
  .pp-header .h-main .eyebrow {
    font-family: var(--mono);
    font-size: 7pt;
    letter-spacing: 0.18em;
    color: rgba(255,255,255,0.6);
  }
  .pp-header .h-main .product {
    font-family: var(--display);
    font-weight: 800;
    font-size: 17pt;
    line-height: 1.1;
    letter-spacing: 0.01em;
    margin-top: 4px;
  }
  .pp-header .h-main .escenario {
    font-family: var(--mono);
    font-size: 8pt;
    color: var(--accent);
    margin-top: 4px;
    letter-spacing: 0.08em;
  }
  .pp-header .h-meta {
    border-left: 1px solid rgba(255,255,255,0.18);
    display: grid;
    grid-template-rows: 1fr 1fr;
    font-family: var(--mono);
  }
  .pp-header .h-meta .cell {
    padding: 10px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.18);
  }
  .pp-header .h-meta .cell:last-child { border-bottom: none; }
  .pp-header .h-meta .k {
    font-size: 6.5pt;
    letter-spacing: 0.16em;
    color: rgba(255,255,255,0.55);
  }
  .pp-header .h-meta .v {
    font-size: 11pt;
    font-weight: 700;
    color: var(--paper);
    margin-top: 2px;
    font-variant-numeric: tabular-nums;
  }

  /* ---------------- KPI strip ---------------- */
  .kpis {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    margin: 10px 0 0;
    border: 1px solid var(--ink);
    background: var(--paper);
  }
  .kpi {
    padding: 12px 14px 10px;
    border-right: 1px solid var(--ink);
    position: relative;
  }
  .kpi:last-child { border-right: none; }
  .kpi .ico {
    position: absolute; top: 10px; right: 10px;
    width: 18px; height: 18px;
    color: var(--accent-2);
    opacity: 0.55;
  }
  .kpi .label {
    font-family: var(--mono);
    font-size: 6.5pt;
    color: var(--soft);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .kpi .value {
    font-family: var(--display);
    font-weight: 800;
    font-size: 22pt;
    color: var(--ink);
    line-height: 1;
    margin-top: 6px;
    font-variant-numeric: tabular-nums;
  }
  .kpi .unit {
    font-family: var(--mono);
    font-size: 7pt;
    color: var(--soft);
    margin-top: 3px;
    letter-spacing: 0.06em;
  }

  /* ---------------- Section head ---------------- */
  .sh {
    margin: 18px 0 6px;
    font-family: var(--mono);
    font-size: 8pt; font-weight: 700;
    color: var(--ink);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    display: flex; align-items: center; gap: 8px;
  }
  .sh::before { content: ""; width: 14px; height: 1px; background: var(--ink); }
  .sh::after { content: ""; flex: 1; height: 1px; background: var(--rule); }
  .sh .sub {
    font-weight: 400; letter-spacing: 0.06em;
    color: var(--soft);
    text-transform: none;
    font-size: 7pt;
  }

  /* ---------------- Cost breakdown bar ---------------- */
  .breakdown { display: grid; gap: 6px; margin-top: 8px; }
  .breakdown .legend {
    display: flex; flex-wrap: wrap; gap: 4px 14px;
    font-family: var(--mono); font-size: 7pt; color: var(--ink);
  }
  .breakdown .legend .item { display: inline-flex; align-items: center; gap: 5px; }
  .breakdown .legend .sw { width: 10px; height: 10px; border: 1px solid var(--ink); }
  .breakdown .bar {
    display: flex; height: 22px;
    border: 1px solid var(--ink); overflow: hidden;
    font-family: var(--mono); font-size: 6.5pt; color: var(--paper);
  }
  .breakdown .seg {
    display: flex; align-items: center; justify-content: center;
    border-right: 1px solid rgba(255,255,255,0.4);
    font-weight: 700; letter-spacing: 0.04em;
    overflow: hidden; white-space: nowrap;
  }
  .breakdown .seg:last-child { border-right: none; }
  .breakdown .scale {
    display: flex; justify-content: space-between;
    font-family: var(--mono); font-size: 6.5pt;
    color: var(--soft); letter-spacing: 0.06em;
  }

  /* ---------------- BOM table + product card row ---------------- */
  .bom-row { display: grid; grid-template-columns: 1fr 200px; gap: 14px; margin-top: 8px; align-items: stretch; }
  table.bom { width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: 7.5pt; }
  table.bom th, table.bom td { padding: 5px 8px; text-align: left; vertical-align: top; }
  table.bom thead th {
    background: var(--ink); color: var(--paper);
    font-weight: 700; font-size: 7pt; text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  table.bom tbody tr { border-bottom: 1px solid var(--rule); }
  table.bom .num { text-align: right; font-variant-numeric: tabular-nums; }
  .group-head td {
    font-weight: 800; font-size: 7pt; text-transform: uppercase;
    letter-spacing: 0.12em; color: var(--paper) !important;
    padding: 5px 8px !important;
  }

  /* Product card (panel photo) */
  .prod-card {
    border: 1px solid var(--ink);
    background: var(--paper);
    display: flex; flex-direction: column;
    height: 100%;
  }
  .prod-card .photo {
    aspect-ratio: 4 / 3;
    background: var(--paper-alt);
    border-bottom: 1px solid var(--ink);
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
    position: relative;
  }
  .prod-card .photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .prod-card .photo svg { width: 100%; height: 100%; display: block; }
  .prod-card .photo .badge {
    position: absolute; top: 8px; left: 8px;
    background: var(--ink); color: var(--paper);
    font-family: var(--mono); font-size: 6.5pt;
    padding: 3px 7px; letter-spacing: 0.12em;
    font-weight: 700;
  }
  .prod-card .meta { padding: 10px 12px; }
  .prod-card .meta .name {
    font-family: var(--display); font-weight: 800;
    font-size: 11pt; color: var(--ink);
  }
  .prod-card .meta .specs {
    margin-top: 6px;
    display: grid; grid-template-columns: 1fr 1fr; gap: 3px 10px;
    font-family: var(--mono); font-size: 6.5pt;
    color: var(--ink);
  }
  .prod-card .meta .specs .k { color: var(--soft); letter-spacing: 0.08em; text-transform: uppercase; font-size: 5.5pt; }
  .prod-card .meta .specs .v { font-weight: 700; }

  /* ---------------- Totals card ---------------- */
  .totals {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 18px; margin-top: 14px; align-items: stretch;
  }
  .totals .terms {
    font-family: var(--mono); font-size: 7pt;
    color: var(--soft); line-height: 1.55;
    border: 1px solid var(--rule);
    background: var(--paper); padding: 10px 12px;
  }
  .totals .terms strong {
    display: block; color: var(--ink); font-size: 7pt;
    letter-spacing: 0.14em; text-transform: uppercase;
    margin-bottom: 4px;
  }
  .totals .card {
    border: 1px solid var(--ink); min-width: 230px;
    font-family: var(--mono); font-size: 8pt;
  }
  .totals .card .row {
    display: flex; justify-content: space-between;
    padding: 7px 14px; border-bottom: 1px solid var(--rule);
  }
  .totals .card .row:last-child { border-bottom: none; }
  .totals .card .row.total {
    background: var(--ink); color: var(--paper);
    font-family: var(--display); font-size: 13pt;
    font-weight: 800; padding: 12px 14px;
  }
  .totals .card .row .v { font-variant-numeric: tabular-nums; }

  /* ===================================================================
     P2 · TECHNICAL ARCHITECTURAL SHEET
     =================================================================== */
  .tech-head {
    border: 1px solid var(--ink);
    display: grid;
    grid-template-columns: 110px 1fr 200px;
    background: var(--paper);
    margin-bottom: 10px;
  }
  .tech-head .left { background: var(--ink); display: flex; align-items: center; justify-content: center; }
  .tech-head .left img { width: 80px; filter: brightness(0) invert(1); }
  .tech-head .mid { padding: 10px 14px; border-right: 1px solid var(--ink); }
  .tech-head .mid .eyebrow {
    font-family: var(--mono); font-size: 6.5pt;
    letter-spacing: 0.16em; color: var(--soft);
  }
  .tech-head .mid .ttl {
    font-weight: 800; font-size: 13pt; margin-top: 2px;
  }
  .tech-head .mid .sub {
    font-family: var(--mono); font-size: 7pt;
    color: var(--soft); margin-top: 4px;
  }
  .tech-head .right {
    padding: 8px 12px; font-family: var(--mono); font-size: 7pt;
    display: grid; grid-template-rows: 1fr 1fr 1fr;
  }
  .tech-head .right div { display: flex; justify-content: space-between; }
  .tech-head .right .k { color: var(--soft); letter-spacing: 0.1em; }
  .tech-head .right .v { font-weight: 700; }

  .plan-frame {
    border: 1px solid var(--ink);
    background: var(--paper);
    padding: 0;
    position: relative;
  }
  .plan-frame svg { width: 100%; display: block; }

  .perimeter-strip {
    margin-top: 10px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .peri-card {
    border: 1px solid var(--ink);
    background: var(--paper);
    display: grid;
    grid-template-rows: auto 1fr auto;
  }
  .peri-card .head {
    background: var(--ink);
    color: var(--paper);
    font-family: var(--mono);
    font-size: 6.5pt;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 4px 8px;
    display: flex;
    justify-content: space-between;
  }
  .peri-card .photo {
    aspect-ratio: 16 / 9;
    background: var(--paper-alt);
    border-bottom: 1px solid var(--rule);
    display: flex; align-items: center; justify-content: center;
    overflow: hidden; position: relative;
  }
  .peri-card .photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .peri-card .photo .ph-fallback {
    font-family: var(--mono);
    font-size: 6pt; color: var(--soft);
    letter-spacing: 0.1em; text-align: center;
    padding: 0 8px;
  }
  .peri-card .body { padding: 6px 8px; }
  .peri-card .body .name {
    font-family: var(--display);
    font-weight: 700;
    font-size: 8pt;
    color: var(--ink);
    line-height: 1.15;
  }
  .peri-card .body .meta {
    font-family: var(--mono);
    font-size: 6.5pt;
    color: var(--soft);
    margin-top: 3px;
    letter-spacing: 0.04em;
  }

  .legend-strip {
    margin-top: 10px;
    border: 1px solid var(--ink);
    background: var(--paper);
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .legend-strip .col {
    padding: 10px 14px;
    border-right: 1px solid var(--rule);
  }
  .legend-strip .col:last-child { border-right: none; }
  .legend-strip h4 {
    margin: 0 0 6px; font-family: var(--mono);
    font-size: 7pt; letter-spacing: 0.14em;
    color: var(--ink); text-transform: uppercase;
  }
  .legend-strip .row {
    display: grid; grid-template-columns: 24px 1fr;
    gap: 8px; padding: 4px 0;
    font-family: var(--mono); font-size: 7pt;
    color: var(--ink);
    border-top: 1px dotted var(--rule);
  }
  .legend-strip .row:first-of-type { border-top: none; }
  .legend-strip .row .num {
    background: var(--ink); color: var(--paper);
    font-weight: 800; text-align: center; padding: 2px 0;
    font-family: var(--display); font-size: 8pt;
  }
  .legend-strip .row .desc strong { font-weight: 700; }
  .legend-strip .row .desc .sub {
    color: var(--soft); font-size: 6.5pt; margin-top: 1px;
  }

  .registration {
    position: absolute;
    bottom: 6mm; left: 0; right: 0;
    padding: 0 18px;
    display: flex; justify-content: space-between;
    font-family: var(--mono);
    font-size: 6.5pt; color: var(--soft);
    letter-spacing: 0.1em;
  }
</style>
</head>
<body>
  <div id="root"></div>

  <script>
  async function resolveData() {
    if (window.QUOTE_DATA) return window.QUOTE_DATA;
    const params = new URLSearchParams(location.search);
    if (params.has('data')) { try { return JSON.parse(atob(params.get('data'))); } catch (e) {} }
    if (params.has('src')) { const r = await fetch(params.get('src')); if (r.ok) return await r.json(); }
    throw new Error('No quote data');
  }

  const fmt = (n) => Number(n).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt0 = (n) => Number(n).toLocaleString('es-UY', { maximumFractionDigits: 2 });
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const h = (tag, attrs = {}, ...children) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === 'class') el.className = v; else el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  };
  const svg = (tag, attrs = {}, ...children) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  };
  const CAT_COLOR = {
    'PANELES': 'var(--c-paneles)', 'PERFILERÍA': 'var(--c-perfileria)',
    'PERFILERIA': 'var(--c-perfileria)', 'FIJACIONES': 'var(--c-fijaciones)',
    'SELLADORES': 'var(--c-selladores)', 'SERVICIOS': 'var(--c-servicios)',
  };
  const catColor = g => CAT_COLOR[g] || 'var(--ink)';

  /* ============================================================
     PANEL CROSS-SECTION ILLUSTRATION (used when no photo provided)
     Sandwich panel: top steel skin / EPS core / bottom steel skin
     ============================================================ */
  function renderPanelIllustration(pd, color) {
    const root = svg('svg', { viewBox: '0 0 240 180', preserveAspectRatio: 'xMidYMid meet' });
    // background
    root.append(svg('rect', { x: 0, y: 0, width: 240, height: 180, fill: '#E8EBF0' }));
    // perspective sandwich panel
    const x = 35, y = 50, w = 170, hgt = 70, depth = 32;
    const skinClr = color || '#F5F7FA';
    // bottom (perspective rear)
    root.append(svg('polygon', { points: \`\${x},\${y+hgt} \${x+depth},\${y+hgt-depth} \${x+w+depth},\${y+hgt-depth} \${x+w},\${y+hgt}\`, fill: '#022255', opacity: 0.5 }));
    // back face (skin)
    root.append(svg('polygon', { points: \`\${x+depth},\${y-depth} \${x+w+depth},\${y-depth} \${x+w+depth},\${y+hgt-depth} \${x+depth},\${y+hgt-depth}\`, fill: skinClr, stroke: '#022255', 'stroke-width': 0.5 }));
    // ribs on top skin (trapezoidal panel feel)
    for (let i = 0; i < 6; i++) {
      const rx = x + 12 + i*26;
      root.append(svg('line', { x1: rx, y1: y, x2: rx+depth, y2: y-depth, stroke: '#022255', 'stroke-width': 0.4, opacity: 0.4 }));
    }
    // top face (panel surface — color)
    root.append(svg('polygon', { points: \`\${x},\${y} \${x+w},\${y} \${x+w+depth},\${y-depth} \${x+depth},\${y-depth}\`, fill: skinClr, stroke: '#022255', 'stroke-width': 0.7 }));
    // front face — sandwich layers
    const layerH = hgt;
    // top steel skin (3px equivalent)
    root.append(svg('rect', { x, y, width: w, height: 4, fill: '#022255' }));
    // EPS core (hatched yellow-cream)
    root.append(svg('pattern', { id: 'eps', patternUnits: 'userSpaceOnUse', width: 4, height: 4, patternTransform: 'rotate(45)' },
      svg('line', { x1: 0, y1: 0, x2: 0, y2: 4, stroke: '#c9a26b', 'stroke-width': 0.7 })));
    root.append(svg('rect', { x, y: y+4, width: w, height: layerH-8, fill: '#f0e6d2' }));
    root.append(svg('rect', { x, y: y+4, width: w, height: layerH-8, fill: 'url(#eps)' }));
    // bottom steel skin
    root.append(svg('rect', { x, y: y+layerH-4, width: w, height: 4, fill: '#022255' }));
    // outline
    root.append(svg('rect', { x, y, width: w, height: hgt, fill: 'none', stroke: '#022255', 'stroke-width': 0.7 }));

    // Annotation: layer leaders
    const caraSup = pd.cara_sup || 'Acero prepintado';
    const caraInf = pd.cara_inf || 'Acero prepintado';
    const nucleo = \`\${pd.nucleo || 'EPS'} · \${pd.espesor_mm || 100}mm\`;
    // top skin leader
    root.append(svg('line', { x1: x+w+6, y1: y+2, x2: x+w+30, y2: y-12, stroke: '#022255', 'stroke-width': 0.5 }));
    root.append(svg('text', { x: x+w+32, y: y-10, 'font-family': 'JetBrains Mono', 'font-size': 6, fill: '#022255' }, 'CARA SUP.'));
    root.append(svg('text', { x: x+w+32, y: y-3, 'font-family': 'JetBrains Mono', 'font-size': 5.5, fill: '#5b6577' }, caraSup));
    // core leader
    root.append(svg('line', { x1: x+w+6, y1: y+layerH/2, x2: x+w+30, y2: y+layerH/2, stroke: '#022255', 'stroke-width': 0.5 }));
    root.append(svg('text', { x: x+w+32, y: y+layerH/2-2, 'font-family': 'JetBrains Mono', 'font-size': 6, fill: '#022255' }, 'NÚCLEO'));
    root.append(svg('text', { x: x+w+32, y: y+layerH/2+5, 'font-family': 'JetBrains Mono', 'font-size': 5.5, fill: '#5b6577' }, nucleo));
    // bottom leader
    root.append(svg('line', { x1: x+w+6, y1: y+layerH-2, x2: x+w+30, y2: y+layerH+12, stroke: '#022255', 'stroke-width': 0.5 }));
    root.append(svg('text', { x: x+w+32, y: y+layerH+10, 'font-family': 'JetBrains Mono', 'font-size': 6, fill: '#022255' }, 'CARA INF.'));
    root.append(svg('text', { x: x+w+32, y: y+layerH+17, 'font-family': 'JetBrains Mono', 'font-size': 5.5, fill: '#5b6577' }, caraInf));

    // Width dimension at bottom
    const dy = y + layerH + 30;
    root.append(svg('line', { x1: x, y1: dy, x2: x+w, y2: dy, stroke: '#022255', 'stroke-width': 0.4 }));
    root.append(svg('line', { x1: x, y1: dy-4, x2: x, y2: dy+4, stroke: '#022255', 'stroke-width': 0.4 }));
    root.append(svg('line', { x1: x+w, y1: dy-4, x2: x+w, y2: dy+4, stroke: '#022255', 'stroke-width': 0.4 }));
    root.append(svg('text', { x: x+w/2, y: dy+12, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono', 'font-size': 7, 'font-weight': 700, fill: '#022255' },
      \`ANCHO ÚTIL \${fmt0(pd.ancho_util_m || 1.12)} m\`));

    return root;
  }

  /* ============================================================
     PAGE 1 — COMMERCIAL
     ============================================================ */
  function renderPage1(q) {
    const page = h('section', { class: 'page' });
    const inner = h('div', { class: 'pad' });
    page.append(inner);

    // Single solid header block
    const head = h('div', { class: 'pp-header' });
    head.innerHTML = \`
      <div class="h-logo"><img src="assets/bmc-logo.png" alt="BMC"></div>
      <div class="h-main">
        <div class="eyebrow">BMC URUGUAY · METALOG SAS · COTIZACIÓN COMERCIAL</div>
        <div class="product">\${esc(q.panel)}</div>
        <div class="escenario">ESCENARIO · \${esc(q.escenario)}</div>
      </div>
      <div class="h-meta">
        <div class="cell">
          <div class="k">FECHA</div>
          <div class="v">\${esc(q.fecha)}</div>
        </div>
        <div class="cell">
          <div class="k">N° COTIZACIÓN</div>
          <div class="v">\${esc(q.ref)}</div>
        </div>
      </div>
    \`;
    inner.append(head);

    // KPIs
    const kpis = h('div', { class: 'kpis' });
    const au = (q.panel_detalle && q.panel_detalle.ancho_util_m) || (q.zonas[0] && q.zonas[0].au) || 1.12;
    kpis.innerHTML = \`
      <div class="kpi">
        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
        <div class="label">Área total</div>
        <div class="value">\${fmt0(q.area)}</div>
        <div class="unit">m² · superficie de cubierta</div>
      </div>
      <div class="kpi">
        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="6" width="18" height="12"/><path d="M9 6v12M15 6v12"/></svg>
        <div class="label">Paneles</div>
        <div class="value">\${q.paneles}</div>
        <div class="unit">unid · ancho útil \${fmt0(au)} m</div>
      </div>
      <div class="kpi">
        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 20V8M12 20V4M20 20V12M2 20h20"/></svg>
        <div class="label">Apoyos</div>
        <div class="value">\${q.apoyos}</div>
        <div class="unit">estructuras de apoyo</div>
      </div>
      <div class="kpi">
        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><circle cx="12" cy="12" r="2"/></svg>
        <div class="label">Fijaciones</div>
        <div class="value">\${q.fijaciones}</div>
        <div class="unit">puntos de anclaje</div>
      </div>
    \`;
    inner.append(kpis);

    // Cost breakdown
    const subtotal = q.bom.reduce((s, g) => s + g.total, 0);
    const sh1 = h('div', { class: 'sh' });
    sh1.innerHTML = \`<span>Distribución del presupuesto</span><span class="sub">\${q.bom.length} partidas · proporcional al subtotal</span>\`;
    inner.append(sh1);
    const breakdown = h('div', { class: 'breakdown' });
    const segs = q.bom.map(g => {
      const pct = (g.total / subtotal) * 100;
      return \`<div class="seg" style="flex:\${g.total} 0 0;background:\${catColor(g.group)}">\${pct >= 6 ? esc(g.group) + ' · ' + pct.toFixed(0) + '%' : ''}</div>\`;
    }).join('');
    breakdown.innerHTML = \`
      <div class="legend">\${q.bom.map(g => \`<span class="item"><span class="sw" style="background:\${catColor(g.group)}"></span>\${esc(g.group)} · USD \${fmt(g.total)}</span>\`).join('')}</div>
      <div class="bar">\${segs}</div>
      <div class="scale"><span>USD 0</span><span>SUBTOTAL · USD \${fmt(subtotal)}</span></div>
    \`;
    inner.append(breakdown);

    // Materials & services + product card side-by-side
    const sh2 = h('div', { class: 'sh' });
    sh2.innerHTML = \`<span>Detalle de materiales y servicios</span><span class="sub">Precios USD · sin IVA · Producto principal a la derecha</span>\`;
    inner.append(sh2);

    const bomRow = h('div', { class: 'bom-row' });

    const t = h('table', { class: 'bom' });
    let body = '';
    for (const g of q.bom) {
      body += \`<tr class="group-head" style="background:\${catColor(g.group)}">
        <td colspan="4">\${esc(g.group)}</td>
        <td class="num">USD \${fmt(g.total)}</td>
      </tr>\`;
      for (const it of g.items) {
        body += \`<tr>
          <td>\${esc(it.d)}</td>
          <td class="num">\${fmt0(it.q)}</td>
          <td>\${esc(it.u)}</td>
          <td class="num">\${fmt(it.pu)}</td>
          <td class="num">\${fmt(it.t)}</td>
        </tr>\`;
      }
    }
    t.innerHTML = \`
      <thead><tr>
        <th>Descripción</th>
        <th class="num" style="width:60px">Cant.</th>
        <th style="width:60px">Unid.</th>
        <th class="num" style="width:80px">P. Unit</th>
        <th class="num" style="width:90px">Total</th>
      </tr></thead>
      <tbody>\${body}</tbody>
    \`;
    bomRow.append(t);

    // Product card
    const pd = q.panel_detalle || {};
    const prod = h('div', { class: 'prod-card' });
    const photo = h('div', { class: 'photo' });
    photo.innerHTML = \`<div class="badge">PRODUCTO PRINCIPAL</div>\`;
    if (q.product_photo) {
      const img = h('img', { src: q.product_photo, alt: 'Panel',
        onerror: "this.style.display='none';this.parentNode.dataset.fallback='1'" });
      photo.append(img);
      // illustration fallback if image fails to load
      const fallback = renderPanelIllustration(pd, '#F5F7FA');
      fallback.style.display = 'none';
      photo.append(fallback);
      // poll once after load
      setTimeout(() => { if (photo.dataset.fallback === '1') fallback.style.display = 'block'; }, 100);
    } else {
      photo.append(renderPanelIllustration(pd, '#F5F7FA'));
    }
    prod.append(photo);
    const meta = h('div', { class: 'meta' });
    const urlSnippet = q.product_url
      ? \`<div style="margin-top:6px;font-family:var(--mono);font-size:5.5pt;color:var(--soft);letter-spacing:0.06em;border-top:1px dotted var(--rule);padding-top:5px">\${esc(q.product_url.replace(/^https?:\\/\\//,''))}</div>\`
      : '';
    const descBlock = pd.descripcion
      ? \`<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--rule);font-family:var(--display);font-size:7pt;line-height:1.4;color:var(--ink);text-align:justify">\${esc(pd.descripcion)}</div>\`
      : '';
    const ventajasBlock = (pd.ventajas && pd.ventajas.length)
      ? \`<div style="margin-top:8px"><div style="font-family:var(--mono);font-size:5.5pt;color:var(--soft);letter-spacing:0.14em;text-transform:uppercase;margin-bottom:4px">Ventajas</div>
         <ul style="margin:0;padding:0;list-style:none;font-family:var(--mono);font-size:6.5pt;color:var(--ink);line-height:1.5">
         \${pd.ventajas.map(v => \`<li style="display:grid;grid-template-columns:8px 1fr;gap:4px"><span style="color:var(--accent-2)">▸</span><span>\${esc(v)}</span></li>\`).join('')}
         </ul></div>\`
      : '';
    const techBlock = (pd.datos_tecnicos && pd.datos_tecnicos.length)
      ? \`<div style="margin-top:8px"><div style="font-family:var(--mono);font-size:5.5pt;color:var(--soft);letter-spacing:0.14em;text-transform:uppercase;margin-bottom:4px">Datos técnicos</div>
         <table style="width:100%;border-collapse:collapse;font-family:var(--mono);font-size:6.5pt">
         \${pd.datos_tecnicos.map(d => \`<tr style="border-bottom:1px dotted var(--rule)"><td style="padding:2px 0;color:var(--soft)">\${esc(d.k)}</td><td style="padding:2px 0;text-align:right;font-weight:700;color:var(--ink)">\${esc(d.v)}</td></tr>\`).join('')}
         </table></div>\`
      : '';
    const dsBlock = pd.datasheet_url
      ? \`<a href="\${esc(pd.datasheet_url)}" style="display:block;margin-top:10px;padding:7px 10px;background:var(--ink);color:var(--paper);text-decoration:none;font-family:var(--mono);font-size:6.5pt;font-weight:700;letter-spacing:0.1em;text-align:center;text-transform:uppercase">▸ Ficha técnica completa · bmcuruguay.com.uy</a>\`
      : '';
    meta.innerHTML = \`
      <div class="name">\${esc(pd.modelo || 'ISODEC')} · \${pd.espesor_mm || 100}mm</div>
      <div class="specs">
        <div><div class="k">Núcleo</div><div class="v">\${esc(pd.nucleo || 'EPS')}</div></div>
        <div><div class="k">Color</div><div class="v">\${esc(pd.color || 'Blanco')}</div></div>
        <div><div class="k">Ancho útil</div><div class="v">\${fmt0(pd.ancho_util_m || au)} m</div></div>
        <div><div class="k">Ancho total</div><div class="v">\${fmt0(pd.ancho_total_m || 1.15)} m</div></div>
        <div><div class="k">Cara sup.</div><div class="v">\${esc((pd.cara_sup || 'Acero prepintado').replace(/Acero prepintado/, 'Ac. prepint.'))}</div></div>
        <div><div class="k">Cara inf.</div><div class="v">\${esc((pd.cara_inf || 'Acero prepintado').replace(/Acero prepintado/, 'Ac. prepint.'))}</div></div>
      </div>
      \${descBlock}
      \${ventajasBlock}
      \${techBlock}
      \${dsBlock}
      \${urlSnippet}
    \`;
    prod.append(meta);
    bomRow.append(prod);

    inner.append(bomRow);

    // Totals
    const tot = h('div', { class: 'totals' });
    tot.innerHTML = \`
      <div class="terms">
        <strong>Condiciones</strong>
        \${esc(q.conditions)}
      </div>
      <div class="card">
        <div class="row"><span>Subtotal</span><span class="v">USD \${fmt(q.subtotal)}</span></div>
        <div class="row"><span>IVA 22%</span><span class="v">USD \${fmt(q.iva)}</span></div>
        <div class="row total"><span>TOTAL</span><span class="v">USD \${fmt(q.total)}</span></div>
      </div>
    \`;
    inner.append(tot);

    const reg = h('div', { class: 'registration' });
    reg.innerHTML = \`<span>BMC URUGUAY · \${esc(q.ref)}</span><span>HOJA 1 / 2 · COMERCIAL</span>\`;
    page.append(reg);
    return page;
  }

  /* ============================================================
     PAGE 2 — TECHNICAL ARCHITECTURAL SHEET
     ============================================================ */
  function renderPage2(q) {
    const page = h('section', { class: 'page' });
    const inner = h('div', { class: 'pad' });
    page.append(inner);

    // Tech header
    const head = h('div', { class: 'tech-head' });
    head.innerHTML = \`
      <div class="left"><img src="assets/bmc-logo.png" alt="BMC"></div>
      <div class="mid">
        <div class="eyebrow">PLANTA TÉCNICA · DETALLE CONSTRUCTIVO</div>
        <div class="ttl">DWG-01 · CUBIERTA</div>
        <div class="sub">\${esc(q.panel)} · \${q.zonas.length} zona(s) · \${fmt(q.area)} m²</div>
      </div>
      <div class="right">
        <div><span class="k">REF</span><span class="v">\${esc(q.ref)}</span></div>
        <div><span class="k">FECHA</span><span class="v">\${esc(q.fecha)}</span></div>
        <div><span class="k">ESCALA</span><span class="v">S/E · cotas en m</span></div>
      </div>
    \`;
    inner.append(head);

    // Plan frame
    const frame = h('div', { class: 'plan-frame' });
    frame.append(renderArchPlanta(q));
    inner.append(frame);

    // Perimeter perfiles — mini-card strip with photos
    const peri = q.perimetro || {};
    const sideOrder = ['sup', 'der', 'inf', 'izq'];
    const sideLabel = { sup: 'FRENTE SUP.', inf: 'FRENTE INF.', izq: 'LAT. IZQ.', der: 'LAT. DER.' };
    const sideTag = { sup: '02·1', der: '02·2', inf: '02·3', izq: '02·4' };
    const periStrip = h('div', { class: 'perimeter-strip' });
    sideOrder.forEach(k => {
      const v = peri[k]; if (!v) return;
      const card = h('div', { class: 'peri-card' });
      const photoHTML = v.image
        ? \`<img src="\${esc(v.image)}" alt="\${esc(v.perfil)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
           <div class="ph-fallback" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center">\${esc(v.perfil).toUpperCase()}</div>\`
        : \`<div class="ph-fallback">\${esc(v.perfil).toUpperCase()}</div>\`;
      card.innerHTML = \`
        <div class="head"><span>\${sideTag[k]}</span><span>\${sideLabel[k]}</span></div>
        <div class="photo">\${photoHTML}</div>
        <div class="body">
          <div class="name">\${esc(v.perfil)}</div>
          <div class="meta">\${v.cant} unid · \${fmt0(v.long_m)} m c/u</div>
        </div>\`;
      periStrip.append(card);
    });
    inner.append(periStrip);

    // Legend strip — two columns: callouts + materials
    const legend = h('div', { class: 'legend-strip' });

    const calloutItems = [
      { n: '①', t: 'PANEL DE CUBIERTA', s: \`\${esc(q.panel)} · \${q.paneles} unid · AU \${fmt0((q.panel_detalle&&q.panel_detalle.ancho_util_m)||1.12)} m · \${fmt(q.area)} m²\` },
    ];
    Object.entries(peri).forEach(([k, v], i) => {
      const sideName = { sup: 'Frente Sup.', inf: 'Frente Inf.', izq: 'Lat. Izq.', der: 'Lat. Der.' }[k] || k;
      calloutItems.push({ n: \`②\${'·'.repeat(0)}\${i+1}\`, t: \`\${sideName} — \${esc(v.perfil)}\`, s: \`\${v.cant} unid × \${fmt0(v.long_m)} m\` });
    });
    (q.fijacion_tipos || []).forEach((f, i) => {
      calloutItems.push({ n: \`③\${i>0? '·'+(i+1):''}\`, t: esc(f.etiqueta), s: \`\${f.puntos} puntos · \${f.componentes.map(esc).join(' + ')}\` });
    });
    calloutItems.push({ n: '④', t: 'PENDIENTE', s: \`\${q.pendiente_pct || 5}% · sentido indicado en planta\` });

    const colA = h('div', { class: 'col' });
    colA.innerHTML = \`<h4>① ② ③ ④ · LLAMADAS DE PLANO</h4>\` +
      calloutItems.map(c => \`
        <div class="row">
          <div class="num">\${c.n.replace(/[^0-9·]/g,'')||'·'}</div>
          <div class="desc"><strong>\${c.t}</strong><div class="sub">\${c.s}</div></div>
        </div>\`).join('');
    legend.append(colA);

    const colB = h('div', { class: 'col' });
    const pd = q.panel_detalle || {};
    colB.innerHTML = \`
      <h4>FICHA TÉCNICA · PANEL</h4>
      <div class="row"><div class="num" style="background:#F5F7FA;color:#022255;border:1px solid #022255">P</div>
        <div class="desc"><strong>\${esc(pd.modelo || 'ISODEC')} · \${pd.espesor_mm || 100}mm</strong>
          <div class="sub">Núcleo \${esc(pd.nucleo||'EPS')} · Color \${esc(pd.color||'Blanco')}</div></div></div>
      <div class="row"><div class="num" style="background:#F5F7FA;color:#022255;border:1px solid #022255">↔</div>
        <div class="desc"><strong>Anchos</strong>
          <div class="sub">Total \${fmt0(pd.ancho_total_m||1.15)} m · Útil \${fmt0(pd.ancho_util_m||1.12)} m</div></div></div>
      <div class="row"><div class="num" style="background:#F5F7FA;color:#022255;border:1px solid #022255">▤</div>
        <div class="desc"><strong>Caras</strong>
          <div class="sub">Sup: \${esc(pd.cara_sup||'Ac. prepintado')} · Inf: \${esc(pd.cara_inf||'Ac. prepintado')}</div></div></div>
      <div class="row"><div class="num" style="background:#2cba48">P</div>
        <div class="desc"><strong>Sellado perimetral</strong>
          <div class="sub">Cinta butilo 2mm × 15mm + silicona neutra Bromplast</div></div></div>
    \`;
    legend.append(colB);

    inner.append(legend);

    const reg = h('div', { class: 'registration' });
    reg.innerHTML = \`<span>BMC URUGUAY · \${esc(q.ref)}</span><span>HOJA 2 / 2 · TÉCNICO</span>\`;
    page.append(reg);
    return page;
  }

  /* ============================================================
     ARCHITECTURAL PLANTA — full annotated drawing
     ============================================================ */
  function renderArchPlanta(q) {
    const VW = 820, VH = 740;
    const root = svg('svg', { viewBox: \`0 0 \${VW} \${VH}\` });

    // defs
    const defs = svg('defs');
    defs.append(svg('pattern', { id: 'p-hatch', patternUnits: 'userSpaceOnUse', width: 7, height: 7, patternTransform: 'rotate(45)' },
      svg('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: '#022255', 'stroke-width': 0.4, opacity: 0.22 })));
    defs.append(svg('marker', { id: 'p-arr', markerWidth: 12, markerHeight: 12, refX: 10, refY: 6, orient: 'auto' },
      svg('path', { d: 'M0,1 L11,6 L0,11 Z', fill: '#022255' })));
    defs.append(svg('marker', { id: 'p-tick', markerWidth: 8, markerHeight: 8, refX: 4, refY: 4, orient: 'auto' },
      svg('path', { d: 'M0,0 L8,8 M8,0 L0,8', stroke: '#022255', 'stroke-width': 0.7 })));
    // Soft halo filter for translucent callout boxes
    const halo = svg('filter', { id: 'calloutHalo', x: '-20%', y: '-20%', width: '140%', height: '140%' });
    halo.append(svg('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '2.2' }));
    defs.append(halo);
    root.append(defs);

    // border
    root.append(svg('rect', { x: 0.5, y: 0.5, width: VW-1, height: VH-1, fill: 'none', stroke: '#022255', 'stroke-width': 0.6 }));

    // Layout: drawing area centered, callout strips around
    const margin = { top: 130, right: 230, bottom: 200, left: 110 };
    const drawW = VW - margin.left - margin.right;
    const drawH = VH - margin.top - margin.bottom;

    const totalLargo = q.zonas.reduce((s, z) => s + z.largo, 0);
    const maxAncho = Math.max(...q.zonas.map(z => z.ancho));
    const s = Math.min(drawW / totalLargo, drawH / maxAncho);
    const drawingW = totalLargo * s;
    const drawingH = maxAncho * s;
    const ox = margin.left + (drawW - drawingW) / 2;
    const oy = margin.top + (drawH - drawingH) / 2;

    // === ZONES ===
    let cx = ox;
    const rects = [];
    q.zonas.forEach((z, i) => {
      const w = z.largo * s, hgt = z.ancho * s;
      // hatched fill
      root.append(svg('rect', { x: cx, y: oy, width: w, height: hgt, fill: 'url(#p-hatch)', stroke: '#022255', 'stroke-width': 1.6 }));

      // panel parallels (along largo, dividing into z.pan strips)
      const panW = w / z.pan;
      for (let p = 1; p < z.pan; p++) {
        root.append(svg('line', {
          x1: cx + p * panW, y1: oy + 2, x2: cx + p * panW, y2: oy + hgt - 2,
          stroke: '#022255', 'stroke-width': 0.5, opacity: 0.55
        }));
      }
      // panel labels in each strip
      for (let p = 0; p < z.pan; p++) {
        root.append(svg('text', {
          x: cx + p*panW + panW/2, y: oy + 12,
          'text-anchor': 'middle', 'font-family': 'JetBrains Mono', 'font-size': 6, fill: '#5b6577'
        }, \`P\${p+1}\`));
      }

      // apoyos (dashed lines perpendicular to panel direction)
      const apoyos = q.apoyos || 3;
      for (let a = 1; a <= apoyos; a++) {
        root.append(svg('line', {
          x1: cx + 2, y1: oy + (a*hgt)/(apoyos+1),
          x2: cx + w - 2, y2: oy + (a*hgt)/(apoyos+1),
          stroke: '#5b6577', 'stroke-width': 0.6, 'stroke-dasharray': '4 3', opacity: 0.7
        }));
      }
      // fixing dots — at intersections of panel parallels and apoyo lines (+ edges)
      const dotsG = svg('g', { fill: '#c9a26b' });
      const cols = z.pan + 1;
      for (let r = 1; r <= apoyos; r++) {
        for (let c = 0; c < cols; c++) {
          dotsG.append(svg('circle', {
            cx: cx + (c*w)/(cols-1), cy: oy + (r*hgt)/(apoyos+1),
            r: 2.4, stroke: '#022255', 'stroke-width': 0.5
          }));
        }
      }
      root.append(dotsG);

      // slope arrow (centered, large)
      const sx = cx + w*0.5, sy1 = oy + 30, sy2 = oy + hgt - 30;
      root.append(svg('line', { x1: sx, y1: sy1, x2: sx, y2: sy2, stroke: '#022255', 'stroke-width': 1.4, 'marker-end': 'url(#p-arr)' }));
      root.append(svg('rect', { x: sx-22, y: sy2-7, width: 44, height: 12, fill: '#F5F7FA' }));
      root.append(svg('text', { x: sx, y: sy2+1.5, 'text-anchor': 'middle',
        'font-family': 'JetBrains Mono', 'font-size': 7, 'font-weight': 700, fill: '#022255' }, \`\${q.pendiente_pct||5}%\`));

      // zone label
      root.append(svg('text', {
        x: cx + 8, y: oy + hgt - 8,
        'font-family': 'Archivo', 'font-weight': 800, 'font-size': 13, fill: '#022255'
      }, \`Z\${z.id}\`));
      root.append(svg('text', {
        x: cx + 22, y: oy + hgt - 8,
        'font-family': 'JetBrains Mono', 'font-size': 7, fill: '#5b6577'
      }, \`\${esc(z.desc.toUpperCase())} · \${fmt(z.area)} m²\`));

      rects.push({ x: cx, y: oy, w, h: hgt, z });
      cx += w;
    });

    // === PERIMETER PROFILES (colored strips on each side) ===
    const peri = q.perimetro || {};
    const periColor = '#2cba48';
    const r0 = rects[0]; const rL = rects[rects.length-1];
    const top = oy, bot = oy + drawingH;
    const left = ox, right = ox + drawingW;
    // strips
    if (peri.sup) root.append(svg('rect', { x: left, y: top - 5, width: drawingW, height: 4, fill: periColor }));
    if (peri.inf) root.append(svg('rect', { x: left, y: bot + 1, width: drawingW, height: 4, fill: periColor }));
    if (peri.izq) root.append(svg('rect', { x: left - 5, y: top, width: 4, height: drawingH, fill: periColor }));
    if (peri.der) root.append(svg('rect', { x: right + 1, y: top, width: 4, height: drawingH, fill: periColor }));

    // === DIMENSION LINES (top largo, right ancho) ===
    const dyTop = oy - 28;
    rects.forEach((r) => {
      root.append(svg('line', { x1: r.x, y1: dyTop, x2: r.x + r.w, y2: dyTop, stroke: '#022255', 'stroke-width': 0.4 }));
      root.append(svg('line', { x1: r.x, y1: dyTop-4, x2: r.x, y2: dyTop+4, stroke: '#022255', 'stroke-width': 0.4 }));
      root.append(svg('line', { x1: r.x+r.w, y1: dyTop-4, x2: r.x+r.w, y2: dyTop+4, stroke: '#022255', 'stroke-width': 0.4 }));
      root.append(svg('rect', { x: r.x + r.w/2 - 22, y: dyTop - 7, width: 44, height: 12, fill: '#F5F7FA' }));
      root.append(svg('text', { x: r.x + r.w/2, y: dyTop+1.5, 'text-anchor': 'middle',
        'font-family': 'JetBrains Mono', 'font-size': 7, 'font-weight': 700, fill: '#022255' }, \`\${fmt0(r.z.largo)} m\`));
    });
    // Right ancho
    const dxR = right + 30;
    root.append(svg('line', { x1: dxR, y1: top, x2: dxR, y2: bot, stroke: '#022255', 'stroke-width': 0.4 }));
    root.append(svg('line', { x1: dxR-4, y1: top, x2: dxR+4, y2: top, stroke: '#022255', 'stroke-width': 0.4 }));
    root.append(svg('line', { x1: dxR-4, y1: bot, x2: dxR+4, y2: bot, stroke: '#022255', 'stroke-width': 0.4 }));
    root.append(svg('rect', { x: dxR-7, y: (top+bot)/2 - 22, width: 14, height: 44, fill: '#F5F7FA' }));
    root.append(svg('text', { x: dxR, y: (top+bot)/2, 'text-anchor': 'middle',
      transform: \`rotate(-90, \${dxR}, \${(top+bot)/2})\`,
      'font-family': 'JetBrains Mono', 'font-size': 7, 'font-weight': 700, fill: '#022255' }, \`\${fmt0(maxAncho)} m\`));

    // ===========================================================
    // CALLOUTS — anchored to specific features, distributed around
    // ===========================================================

    // Build callout objects — each has anchor (x,y) and gets a tag position
    // assigned by a slot-based layout that GUARANTEES no overlap.
    const cTagW = 178, cLineH = 9;
    const padY = 5, titleH = 10, lineHfn = (n) => padY*2 + titleH + 8.5*n;

    // Helper: compute box height from line count
    const hOf = (lines) => lineHfn((lines || []).length);

    // Build callout list (anchor + content). Tag positions assigned later.
    const periEntries = Object.entries(peri);
    const sideAnchors = {
      sup: [(left+right)/2, top - 2],
      inf: [(left+right)/2, bot + 2],
      izq: [left - 2, (top+bot)/2],
      der: [right + 2, (top+bot)/2],
    };
    const sideName = { sup: 'FRENTE SUP.', inf: 'FRENTE INF.', izq: 'LAT. IZQ.', der: 'LAT. DER.' };

    const items = [];

    // ① PANEL — left column
    items.push({
      side: 'L',
      n: '01',
      anchor: [r0.x + r0.w*0.18, r0.y + r0.h*0.32],
      title: 'PANEL ' + (q.panel_detalle?.modelo || 'ISODEC'),
      lines: [
        \`\${q.panel_detalle?.espesor_mm||100}mm · \${q.panel_detalle?.nucleo||'EPS'}\`,
        \`Color \${q.panel_detalle?.color || 'Blanco'}\`,
        \`AU \${fmt0(q.panel_detalle?.ancho_util_m||1.12)} m · \${q.paneles} unid\`,
      ]
    });

    // ② PERIMETER — sup→TOP center, inf→BOTTOM center, izq→LEFT col, der→RIGHT col
    const periSideToCol = { sup: 'T', inf: 'B', izq: 'L', der: 'R' };
    let pIdx = 1;
    periEntries.forEach(([k, v]) => {
      items.push({
        side: periSideToCol[k] || 'L',
        n: \`02·\${pIdx++}\`,
        anchor: sideAnchors[k],
        title: \`\${sideName[k]} — \${esc(v.perfil).toUpperCase()}\`,
        lines: [
          \`\${v.cant} unid × \${fmt0(v.long_m)} m\`,
          'Sellado: butilo + silicona neutra',
        ]
      });
    });

    // ③ FIXING — right column
    const fixAnchor = [r0.x + r0.w * (1/(q.zonas[0].pan+1)) * 2, r0.y + r0.h * 2/((q.apoyos||3)+1)];
    (q.fijacion_tipos || []).forEach((f, i) => {
      items.push({
        side: 'R',
        n: \`03\${i>0?'·'+(i+1):''}\`,
        anchor: fixAnchor,
        title: f.etiqueta,
        lines: [
          \`\${f.puntos} puntos de anclaje\`,
          ...f.componentes.map(c => \`· \${c}\`),
        ]
      });
    });

    // ④ PENDIENTE — left column
    items.push({
      side: 'L',
      n: '04',
      anchor: [rL.x + rL.w*0.5, rL.y + rL.h - 50],
      title: 'PENDIENTE DE EVACUACIÓN',
      lines: [
        \`\${q.pendiente_pct||5}% · sentido único\`,
        'Caída hacia frente inferior',
      ]
    });

    // SLOT LAYOUT — stack each side's items vertically with guaranteed gap.
    // Vertical columns (L,R) span between yTop..yBot. Horizontal rows (T,B) span xLeft..xRight.
    const GAP = 6;
    const bySide = { L: [], R: [], T: [], B: [] };
    items.forEach(it => bySide[it.side].push(it));

    // LEFT column: x = 16, stack from y=110 downward
    {
      const x = 16, yStart = 110, yEnd = VH - 60;
      const totalH = bySide.L.reduce((s, it) => s + hOf(it.lines), 0) + GAP * Math.max(0, bySide.L.length - 1);
      let y = Math.max(yStart, Math.min(yStart, yEnd - totalH));
      bySide.L.forEach(it => { it.tag = [x, y]; y += hOf(it.lines) + GAP; });
    }
    // RIGHT column: x = VW - cTagW - 16
    {
      const x = VW - cTagW - 16, yStart = 110, yEnd = VH - 60;
      const totalH = bySide.R.reduce((s, it) => s + hOf(it.lines), 0) + GAP * Math.max(0, bySide.R.length - 1);
      let y = Math.max(yStart, Math.min(yStart, yEnd - totalH));
      bySide.R.forEach(it => { it.tag = [x, y]; y += hOf(it.lines) + GAP; });
    }
    // TOP row: centered horizontally, stacked rows at y=24
    {
      const yStart = 24;
      const totalW = bySide.T.length * cTagW + GAP * Math.max(0, bySide.T.length - 1);
      let x = (VW - totalW) / 2;
      bySide.T.forEach(it => { it.tag = [x, yStart]; x += cTagW + GAP; });
    }
    // BOTTOM row: centered, y near bottom
    {
      const totalW = bySide.B.length * cTagW + GAP * Math.max(0, bySide.B.length - 1);
      const yBase = VH - 100;
      let x = (VW - totalW) / 2;
      bySide.B.forEach(it => { it.tag = [x, yBase - hOf(it.lines)]; x += cTagW + GAP; });
    }

    items.forEach(c => drawArchCallout(root, c));

    // North arrow — top-left
    const nx = 50, ny = 50;
    const nG = svg('g', { transform: \`translate(\${nx}, \${ny})\` });
    nG.append(svg('circle', { cx: 0, cy: 0, r: 14, fill: 'none', stroke: '#022255', 'stroke-width': 0.7 }));
    nG.append(svg('path', { d: 'M0,-11 L5,9 L0,5 L-5,9 Z', fill: '#022255' }));
    nG.append(svg('text', { x: 0, y: 28, 'text-anchor': 'middle',
      'font-family': 'JetBrains Mono', 'font-size': 7, 'font-weight': 700, fill: '#022255' }, 'N'));
    root.append(nG);

    // Scale bar — top-right
    const sbx = VW - 130, sby = 50;
    const sg = svg('g', { 'font-family': 'JetBrains Mono', 'font-size': 6.5, fill: '#022255' });
    sg.append(svg('text', { x: sbx, y: sby - 8, 'font-size': 6, fill: '#5b6577' }, 'ESCALA GRÁFICA'));
    sg.append(svg('rect', { x: sbx, y: sby, width: 30, height: 6, fill: '#022255' }));
    sg.append(svg('rect', { x: sbx+30, y: sby, width: 30, height: 6, fill: 'none', stroke: '#022255', 'stroke-width': 0.5 }));
    sg.append(svg('rect', { x: sbx+60, y: sby, width: 30, height: 6, fill: '#022255' }));
    sg.append(svg('text', { x: sbx, y: sby+16 }, '0'));
    sg.append(svg('text', { x: sbx+26, y: sby+16 }, '2'));
    sg.append(svg('text', { x: sbx+56, y: sby+16 }, '4'));
    sg.append(svg('text', { x: sbx+86, y: sby+16 }, '6 m'));
    root.append(sg);

    return root;
  }

  function drawArchCallout(root, c) {
    const [ax, ay] = c.anchor;
    const [tx, ty] = c.tag;
    const w = 178;
    const padY = 5;
    const lineH = 8.5;
    const titleH = 10;
    const hgt = padY*2 + titleH + lineH * (c.lines?.length || 0);

    // Determine anchor direction
    const tagCenterX = tx + w/2;
    const tagCenterY = ty + hgt/2;
    // Pick connection point on tag closest to anchor
    let cxConn, cyConn;
    if (Math.abs(ax - tagCenterX) > Math.abs(ay - tagCenterY) + 20) {
      // horizontal connect
      cxConn = ax > tagCenterX ? tx + w : tx;
      cyConn = ty + hgt/2;
    } else {
      // vertical connect
      cxConn = tx + w/2;
      cyConn = ay > tagCenterY ? ty + hgt : ty;
    }
    // Orthogonal leader: from anchor to (mid), then to connection
    const midX = (ax + cxConn) / 2;
    const midY = ay; // simple L-shape
    root.append(svg('polyline', {
      points: \`\${ax},\${ay} \${cxConn},\${ay} \${cxConn},\${cyConn}\`,
      fill: 'none', stroke: '#022255', 'stroke-width': 0.55
    }));
    // anchor dot
    root.append(svg('circle', { cx: ax, cy: ay, r: 3.5, fill: '#dad8d2', stroke: '#022255', 'stroke-width': 0.7 }));
    root.append(svg('circle', { cx: ax, cy: ay, r: 1.2, fill: '#022255' }));

    // Tag box — TRANSLUCENT FROSTED GLASS (macOS Terminal Pro vibe)
    const numW = 30;
    const r = 2.5;

    // Outer soft halo — gives the box depth against the plan
    root.append(svg('rect', {
      x: tx - 1.5, y: ty - 1.5, width: w + 3, height: hgt + 3, rx: r + 1.5,
      fill: 'rgba(2, 34, 85, 0.06)', filter: 'url(#calloutHalo)'
    }));

    // Glass body — translucent navy. Plan lines beneath show through.
    root.append(svg('rect', {
      x: tx, y: ty, width: w, height: hgt, rx: r,
      fill: 'rgba(2, 34, 85, 0.62)',
      stroke: 'rgba(255,255,255,0.18)', 'stroke-width': 0.5
    }));

    // Inner top highlight — the signature glass sheen
    root.append(svg('rect', {
      x: tx + 0.6, y: ty + 0.6, width: w - 1.2, height: 0.7, rx: 0.3,
      fill: 'rgba(255,255,255,0.35)'
    }));

    // Number chip — slightly more opaque, accent-tinted
    root.append(svg('rect', {
      x: tx, y: ty, width: numW, height: hgt, rx: r,
      fill: 'rgba(201, 162, 107, 0.85)'
    }));
    // Re-corner the right side of number chip (square against body)
    root.append(svg('rect', {
      x: tx + numW - r, y: ty, width: r, height: hgt,
      fill: 'rgba(201, 162, 107, 0.85)'
    }));
    // Number chip top sheen
    root.append(svg('rect', {
      x: tx + 0.6, y: ty + 0.6, width: numW - 1.2, height: 0.7, rx: 0.3,
      fill: 'rgba(255,255,255,0.45)'
    }));

    root.append(svg('text', {
      x: tx + numW/2, y: ty + hgt/2 + 3.5,
      'text-anchor': 'middle', 'font-family': 'Archivo',
      'font-weight': 800, 'font-size': 9, fill: '#022255'
    }, c.n));

    // Title
    root.append(svg('text', {
      x: tx + numW + 7, y: ty + padY + 7,
      'font-family': 'JetBrains Mono', 'font-size': 6.8,
      'font-weight': 700, fill: '#F5F7FA',
      'letter-spacing': '0.03em'
    }, c.title));

    // Lines
    (c.lines || []).forEach((ln, i) => {
      root.append(svg('text', {
        x: tx + numW + 7, y: ty + padY + 7 + titleH + i*lineH,
        'font-family': 'JetBrains Mono', 'font-size': 6.2,
        fill: 'rgba(245, 247, 250, 0.78)'
      }, ln));
    });
  }

  /* ============================================================
     Boot
     ============================================================ */
  (async () => {
    try {
      const q = await resolveData();
      const root = document.getElementById('root');
      root.append(renderPage1(q));
      root.append(renderPage2(q));
      window.__BMC_READY = true;
      window.parent && window.parent.postMessage({ type: 'BMC_READY' }, '*');
      const _params = new URLSearchParams(location.search);
      if (_params.get('autoprint') === '1') {
        // dejar que las imágenes terminen de cargar
        await Promise.all([...document.images].map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
        setTimeout(() => window.print(), 200);
      }
    } catch (e) {
      document.body.innerHTML = \`<pre style="padding:24px;color:#a00;font-family:monospace">\${e.message}</pre>\`;
      console.error(e);
    }
  })();
  </script>
</body>
</html>
`;
