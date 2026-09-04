// src/pdf-templates/bc.js
// Layout white-label BC — presupuesto A4 para el deploy paralelo.
//
// Identidad: la marca comercial es BC (logo arriba). La razón social, el RUT y
// la dirección viven únicamente en el pie legal, que se repite en todas las
// páginas. En el cuerpo del documento no aparece la razón social como si fuera
// el nombre de la empresa.
//
// Paleta derivada del logo (oro profundo + oro del plano de techo) con neutros
// cálidos. Display: Charter (serif pensada para impresión a cuerpo chico) con
// caída a Georgia; datos en sans con cifras tabulares.
//
// El pipeline de producción (server/lib/quotePdf.js) imprime con
// preferCSSPageSize:true y sin header/footer de Chromium, así que los márgenes
// se declaran en @page y el pie legal es un elemento fijo que repite por página.

import { QUOTE_TERMS } from '../utils/helpers.js';
import { WHITELABEL_BRAND, WHITELABEL_BRANDS, mergeBranding } from '../config/whitelabel.js';
import { BC_LOGO_DATA_URL, bcLogoImg, isBcLogoDataUrl } from '../branding/bcLogo.js';
import { lamLogoSvg } from '../branding/lamLogo.js';
import { smartbuildingLogoImg } from '../branding/smartbuildingLogo.js';

const fmt = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Los insumos sub-centavo (remaches, tornillos) necesitan 4 decimales: con 2,
// cant. × P.U. no reproduce el total y el presupuesto parece mal sumado.
const fmtPu = (n) => {
  const v = Number(n);
  return Math.round(v * 100) / 100 !== v
    ? v.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
    : fmt(v);
};

// Escapa también comillas: el branding es dato cargado por el socio y acá se
// interpola dentro de atributos (src/alt del logo), no sólo en texto.
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
const nl2br = s => esc(s).replace(/\n/g, '<br>');

const GOLD_DEEP = '#C6A02A';
const GOLD_SOFT = '#DCC384';

/** Fallback vectorial si el PNG oficial no está en el bundle. */
function logoSvg(height) {
  return `<svg viewBox="0 0 880 560" height="${height}" role="img" aria-label="BC"
  xmlns="http://www.w3.org/2000/svg" style="display:block">
  <path fill="${GOLD_DEEP}" fill-rule="evenodd" d="
    M60,60 H235 C300,60 340,100 340,158 C340,196 320,222 288,234
    C328,244 355,276 355,326 C355,390 310,430 240,430 H60 Z
    M135,125 V205 H222 C252,205 268,190 268,165 C268,140 252,125 222,125 Z
    M135,275 V365 H232 C265,365 283,348 283,320 C283,292 265,275 232,275 Z"/>
  <path fill="${GOLD_DEEP}" d="
    M767.5,121.2 A185,185 0 1,0 767.5,368.8
    L713.2,319.9 A112,112 0 1,1 713.2,170.1 Z"/>
  <path fill="${GOLD_SOFT}" d="M30,510 L600,175 L855,360 L827,399 L620,222 L54,551 Z"/>
  <path fill="${GOLD_SOFT}" d="M782,262 L806,262 L806,320 L782,306 Z"/>
  <g fill="${GOLD_SOFT}">
    <rect x="598" y="258" width="30" height="30"/>
    <rect x="636" y="258" width="30" height="30"/>
    <rect x="598" y="296" width="30" height="30"/>
    <rect x="636" y="296" width="30" height="30"/>
  </g>
</svg>`;
}

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:12mm 13mm}

:root{
  --gold-deep:#A88420;
  --gold:#C6A02A;
  --gold-soft:#DCC384;
  --wash:#FBF6E9;
  --rule:#E7DFC9;
  --ink:#211E17;
  --ink-soft:#6E6656;
  --paper:#FFFFFF;
}

html,body{background:var(--paper);color:var(--ink)}
body{
  font-family:'Liberation Sans','Helvetica Neue',Arial,sans-serif;
  font-size:8.6pt;line-height:1.34;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}
.bc-doc ol,.bc-doc ul{list-style:none;margin:0;padding:0}
.bc-doc li::before{content:none}

@media screen{
  body{background:#E8E4DA;padding:24px 0}
  .bc-doc{width:210mm;min-height:283mm;padding:12mm 13mm;margin:0 auto;
    background:var(--paper);box-shadow:0 1px 3px rgba(0,0,0,.18)}
}

/* ── Pie legal ───────────────────────────────────────────────
   Va al final del flujo, no fijo: Chromium no repite position:fixed por
   página en este pipeline (lo dibuja una sola vez, encima del contenido). */
.bc-legal{margin-top:6mm;padding-top:2mm;border-top:.5pt solid var(--rule);
  font-size:6.4pt;color:var(--ink-soft);text-align:center;
  letter-spacing:.04em;break-inside:avoid}

/* ── Encabezado ─────────────────────────────────────────────── */
.bc-hdr{display:flex;justify-content:space-between;align-items:flex-end;gap:12mm;
  padding-bottom:3.5mm;border-bottom:1.6pt solid var(--gold);margin-bottom:1.2mm}
.bc-brand{display:flex;align-items:center;gap:4mm}
.bc-tag{font-family:Charter,'Bitstream Charter',Georgia,serif;
  font-size:7.4pt;color:var(--ink-soft);letter-spacing:.13em;text-transform:uppercase;
  border-left:1pt solid var(--gold-soft);padding-left:4mm;line-height:1.5}
.bc-logo-img{display:block;max-height:18mm;max-width:58mm;width:auto;height:auto;object-fit:contain;background:transparent}
.bc-doc-kind{font-family:Charter,'Bitstream Charter',Georgia,serif;
  font-size:15pt;font-weight:700;color:var(--gold-deep);letter-spacing:.06em;line-height:1}
.bc-doc-ref{font-size:8pt;color:var(--ink-soft);margin-top:1.4mm;font-variant-numeric:tabular-nums}
.bc-doc-ref b{color:var(--ink);font-weight:700}
.bc-hair{height:.6pt;background:var(--gold-soft);margin-bottom:4.5mm}

/* ── Rótulos ────────────────────────────────────────────────── */
.bc-lbl{font-family:Charter,'Bitstream Charter',Georgia,serif;
  font-size:7.6pt;font-weight:700;color:var(--gold-deep);
  letter-spacing:.16em;text-transform:uppercase;
  padding-bottom:1mm;margin-bottom:2mm;border-bottom:.7pt solid var(--rule)}
.bc-lbl.plain{border:0;padding:0;margin-bottom:2.4mm}

/* ── Cliente / obra ─────────────────────────────────────────── */
.bc-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:2.6mm 7mm;margin-bottom:4.5mm}
.bc-k{display:block;font-size:6.6pt;color:var(--ink-soft);
  letter-spacing:.11em;text-transform:uppercase;margin-bottom:.3mm}
.bc-v{font-weight:700;color:var(--ink)}

.bc-scope{background:var(--wash);border-left:2.2pt solid var(--gold);
  padding:2.4mm 3.2mm;margin-bottom:2.2mm;border-radius:0 2px 2px 0}
.bc-kpi{display:flex;gap:6mm;font-size:7.6pt;color:var(--ink-soft);margin-bottom:5mm}
.bc-kpi b{color:var(--gold-deep);font-weight:700;font-variant-numeric:tabular-nums}

/* ── Tablas ─────────────────────────────────────────────────── */
.bc-doc table{width:100%;border-collapse:collapse}
.bc-doc th{font-size:6.7pt;font-weight:700;color:var(--ink-soft);
  letter-spacing:.1em;text-transform:uppercase;text-align:right;
  padding:0 3px 1.4mm;border-bottom:.8pt solid var(--gold-soft)}
.bc-doc th:first-child{text-align:left}
.bc-doc td{padding:1.5mm 3px;border-bottom:.4pt solid var(--rule);
  text-align:right;font-variant-numeric:tabular-nums}
.bc-doc td:first-child{text-align:left}
.bc-cen{text-align:center}

.bc-zonas{margin-bottom:5mm}
.bc-zonas td:first-child{font-weight:700;color:var(--gold-deep)}
.bc-zonas .bc-sub{color:var(--ink-soft);font-weight:400}

.bc-bom{margin-bottom:3mm}
.bc-bom .bc-cat td{background:var(--wash);
  font-family:Charter,'Bitstream Charter',Georgia,serif;
  font-weight:700;font-size:8pt;color:var(--gold-deep);letter-spacing:.04em;
  border-top:.6pt solid var(--gold-soft);border-bottom:.6pt solid var(--gold-soft);
  padding:1.7mm 3px}
.bc-bom .bc-cat td:first-child{box-shadow:inset 2.2pt 0 0 var(--gold)}
.bc-paneles{color:var(--gold-deep);font-weight:700;white-space:nowrap}

/* ── Totales ────────────────────────────────────────────────── */
.bc-totals{display:flex;justify-content:flex-end;margin-bottom:5mm;break-inside:avoid}
.bc-tbox{width:76mm}
.bc-trow{display:flex;justify-content:space-between;padding:1.3mm 0;
  color:var(--ink-soft);font-variant-numeric:tabular-nums}
.bc-trow.bc-sub{border-bottom:.5pt solid var(--rule)}
.bc-trow.bc-grand{background:var(--gold);color:#fff;margin-top:1.6mm;
  padding:2.6mm 3.4mm;border-radius:2px;align-items:baseline}
.bc-t-lbl{font-family:Charter,'Bitstream Charter',Georgia,serif;
  font-size:8pt;font-weight:700;letter-spacing:.13em;text-transform:uppercase}
.bc-t-val{font-family:Charter,'Bitstream Charter',Georgia,serif;
  font-size:14pt;font-weight:700;font-variant-numeric:tabular-nums}

/* ── Condiciones ────────────────────────────────────────────── */
.bc-terms{background:var(--wash);padding:3.2mm 4mm;margin-bottom:4mm;
  border-radius:2px;break-inside:avoid}
.bc-terms ol{counter-reset:t;font-size:7.4pt;line-height:1.42;
  column-count:2;column-gap:6mm}
.bc-terms li{counter-increment:t;padding-left:5.2mm;margin-bottom:1mm;
  position:relative;break-inside:avoid}
/* Va después del reset de li::before de arriba, misma especificidad ⇒ gana. */
.bc-terms li::before{content:counter(t);position:absolute;left:0;top:0;
  font-size:6.4pt;font-weight:700;color:var(--gold);font-variant-numeric:tabular-nums}
.bc-terms .bl{font-weight:700;color:var(--ink)}
.bc-terms .hl{font-weight:700;color:#9A3412}

/* ── Banco / firmas ─────────────────────────────────────────── */
.bc-bank{border:.7pt solid var(--gold-soft);border-radius:2px;
  padding:3mm 4mm;margin-bottom:4mm;break-inside:avoid}
.bc-bank-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1.6mm 8mm;font-size:7.6pt}
.bc-todo{color:#9A3412;font-weight:700}
.bc-sign{display:grid;grid-template-columns:1fr 1fr;gap:14mm;margin-top:6mm;break-inside:avoid}
.bc-sign div{border-top:.7pt solid var(--ink-soft);padding-top:1.6mm;
  font-size:7pt;color:var(--ink-soft);letter-spacing:.08em;text-transform:uppercase}
`;

function renderZonas(rows) {
  if (!rows?.length) return '';
  const body = rows.map(z => `<tr>
  <td>${esc(z.zona)} <span class="bc-sub">· ${esc(z.desc)}</span></td>
  <td class="bc-cen">${esc(z.largo)}</td>
  <td class="bc-cen">${esc(z.ancho)}</td>
  <td class="bc-cen">${esc(z.paneles)}</td>
  <td class="bc-cen">${esc(z.au)}</td>
  <td>${esc(z.area)}</td>
</tr>`).join('');
  return `<div class="bc-lbl">Detalle por zona</div>
<table class="bc-zonas"><thead><tr>
  <th>Zona</th><th class="bc-cen">Largo</th><th class="bc-cen">Ancho</th>
  <th class="bc-cen">Paneles</th><th class="bc-cen">Ancho útil</th><th>Área</th>
</tr></thead><tbody>${body}</tbody></table>`;
}

function renderBom(groups) {
  return (groups || []).map(g => {
    const isPanel = g.groupName.toUpperCase().includes('PANEL');
    const cat = `<tr class="bc-cat"><td colspan="4">${esc(g.groupName)}</td><td>${fmt(g.groupTotal)}</td></tr>`;
    const rows = g.items.map(i => {
      const qty = typeof i.qty === 'number'
        ? (i.qty % 1 === 0 ? i.qty : i.qty.toFixed(2))
        : (i.qty ?? '');
      // La descripción puede venir con el detalle de paneles ya incrustado
      // desde bomToGroups; lo sacamos para no repetirlo.
      let desc = esc(i.desc).replace(/ · \d+ paneles × [\d.]+ m/i, '').trim();
      if (isPanel && (i.cantPaneles != null || i.largoPanel != null)) {
        const bits = [];
        if (i.cantPaneles != null) bits.push(`${i.cantPaneles} paneles`);
        if (i.largoPanel != null) bits.push(`${Number(i.largoPanel).toFixed(2)} m`);
        if (bits.length) desc += ` <span class="bc-paneles">(${bits.join(' × ')})</span>`;
      }
      return `<tr><td>${desc}</td><td>${qty}</td><td class="bc-cen">${esc(i.unit)}</td>`
        + `<td>${fmtPu(i.pu)}</td><td>${fmt(i.total)}</td></tr>`;
    }).join('');
    return cat + rows;
  }).join('');
}

function renderTerms(marca) {
  const items = QUOTE_TERMS.map(t => {
    const cls = t.highlight ? 'hl' : (t.bold ? 'bl' : '');
    // Las condiciones son compartidas y nombran a BMC ("BMC no asume
    // responsabilidad…"). En el PDF del socio eso es una fuga de marca: va la
    // suya. `Bromyros` queda como está, es la planta real de retiro.
    const text = t.text.replace(/\bBMC\b/g, marca);
    return `<li${cls ? ` class="${cls}"` : ''}>${esc(text)}</li>`;
  }).join('');
  return `<div class="bc-terms">
  <div class="bc-lbl plain">Condiciones comerciales</div>
  <ol>${items}</ol>
</div>`;
}

export function render(q) {
  const cl = q.bmcExtra?.client ?? {};
  const brand = mergeBranding(WHITELABEL_BRAND || WHITELABEL_BRANDS.bc, q.branding);

  // Socio override: sólo data: de imagen. URL remota / javascript: se rechazan
  // y caen al logo oficial BC (PNG con fondo transparente), no a un tercero.
  const logoOk = isBcLogoDataUrl(brand.logoDataUrl);
  const logo = logoOk
    ? `<img class="bc-logo-img" src="${esc(brand.logoDataUrl)}" alt="${esc(brand.marca)}">`
    : (brand.marca === 'LAM'
      ? lamLogoSvg(62)
      : (brand.layout === 'smartbuilding' || brand.marca === 'SMARTBUILDING'
        ? smartbuildingLogoImg(62)
        : (isBcLogoDataUrl(BC_LOGO_DATA_URL) ? bcLogoImg(62) : logoSvg(62))));

  const kpi = [
    q.areaTotalM2 > 0 ? ['Área total', `${Number(q.areaTotalM2).toFixed(2)} m²`] : null,
    q.panelCount > 0 ? ['Paneles', q.panelCount] : null,
    q.apoyoCount > 0 ? ['Apoyos', q.apoyoCount] : null,
    q.fijacionCount > 0 ? ['Puntos de fijación', q.fijacionCount] : null,
  ].filter(Boolean);

  const legal = [brand.razonSocial, brand.rut ? `RUT ${brand.rut}` : null, brand.direccion]
    .filter(Boolean).map(esc).join(' · ');

  const theme = brand.theme;
  const themeOverride = theme ? `
:root{
  --gold-deep:${theme.ink || '#101114'};
  --gold:${theme.accent || '#E4E7EB'};
  --gold-soft:${theme.accentSoft || '#9AA3AD'};
  --wash:${theme.wash || '#EEF2F5'};
  --rule:${theme.rule || '#C5CCD3'};
  --ink:${theme.ink || '#101114'};
  --ink-soft:${theme.accentSoft || '#9AA3AD'};
  --paper:${theme.paper || '#FFFFFF'};
}
.bc-hdr{border-bottom-color:var(--ink)}
.bc-doc-kind{color:var(--ink)}
` : '';

  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><title>Presupuesto ${esc(q.ref)}</title>
<style>${CSS}${themeOverride}</style>
</head><body>
<div class="bc-doc">

  <div class="bc-hdr">
    <div class="bc-brand">
      ${logo}
      <div class="bc-tag">${nl2br(brand.descriptor)}</div>
    </div>
    <div style="text-align:right">
      <div class="bc-doc-kind">PRESUPUESTO</div>
      <div class="bc-doc-ref"><b>${esc(q.ref)}</b> · ${esc(q.fecha)}</div>
    </div>
  </div>
  <div class="bc-hair"></div>

  <div class="bc-lbl">Cliente y obra</div>
  <div class="bc-meta">
    <div><span class="bc-k">Cliente</span><span class="bc-v">${esc(cl.nombre || '—')}</span></div>
    <div><span class="bc-k">RUT</span><span class="bc-v">${esc(cl.rut || '—')}</span></div>
    <div><span class="bc-k">Contacto</span><span class="bc-v">${esc(cl.nombreRefCliente || '—')}</span></div>
    <div><span class="bc-k">Dirección de obra</span><span class="bc-v">${esc(cl.direccion || '—')}</span></div>
    <div><span class="bc-k">Teléfono</span><span class="bc-v">${esc(cl.telefono || '—')}</span></div>
    <div><span class="bc-k">Validez</span><span class="bc-v">${esc(q.validez || '10 días')}</span></div>
  </div>

  <div class="bc-scope">
    <span class="bc-k">Alcance — ${esc(q.escenario)}</span>
    <span class="bc-v">${esc(q.panelDescLine)}</span>
  </div>
  ${kpi.length ? `<div class="bc-kpi">${kpi.map(([k, v]) => `<span>${esc(k)} <b>${esc(v)}</b></span>`).join('')}</div>` : ''}

  ${renderZonas(q.zoneRows)}

  <div class="bc-lbl">Detalle de materiales</div>
  <table class="bc-bom"><thead><tr>
    <th>Descripción</th><th>Cant.</th><th class="bc-cen">Unid.</th>
    <th>P. unit. USD</th><th>Total USD</th>
  </tr></thead><tbody>${renderBom(q.bomDetailGroups)}</tbody></table>

  <div class="bc-totals"><div class="bc-tbox">
    <div class="bc-trow bc-sub"><span>Subtotal sin IVA</span><span>USD ${fmt(q.subtotalSinIva)}</span></div>
    <div class="bc-trow bc-sub"><span>IVA 22%</span><span>USD ${fmt(q.ivaAmount)}</span></div>
    <div class="bc-trow bc-grand"><span class="bc-t-lbl">Total USD</span><span class="bc-t-val">${fmt(q.totalConIva)}</span></div>
  </div></div>

  ${renderTerms(brand.marca)}

  <div class="bc-bank">
    <div class="bc-lbl plain">Datos para depósito bancario</div>
    <div class="bc-bank-grid">
      <div><span class="bc-k">Titular</span><span class="bc-v">${esc(brand.razonSocial)}</span></div>
      <div><span class="bc-k">RUT</span><span class="bc-v">${esc(brand.rut)}</span></div>
      <div><span class="bc-k">Cuenta USD</span><span class="bc-v${brand.banco ? '' : ' bc-todo'}">${esc(brand.banco || 'A completar')}</span></div>
      <div><span class="bc-k">Consultas</span><span class="bc-v${brand.telefono ? '' : ' bc-todo'}">${esc(brand.telefono || 'A completar')}</span></div>
    </div>
  </div>

  <div class="bc-sign">
    <div>Firma y aclaración — Cliente</div>
    <div>Firma — ${esc(brand.marca)}</div>
  </div>

  <div class="bc-legal">${legal}</div>

</div>
</body></html>`;
}
