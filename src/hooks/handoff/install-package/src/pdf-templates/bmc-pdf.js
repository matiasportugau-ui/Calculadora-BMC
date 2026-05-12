// ═══════════════════════════════════════════════════════════════════════════
// src/pdf-templates/bmc-pdf.js — BMC Blueprint Técnico (cliente)
// ═══════════════════════════════════════════════════════════════════════════
//
// Activado desde el dropdown "BMC PDF — Blueprint Técnico" en
// PanelinCalculadoraV3 (estado pdfLayout === 'bmc-pdf').
//
// Tu TEMPLATE_MAP ya importa este archivo:
//   'bmc-pdf': () => import('./bmc-pdf.js'),
//
// Recibe `q` (modelo armado por buildQuotationModel en index.js) y
// devuelve un string HTML self-contained, listo para print/preview con
// la misma pipeline que las otras plantillas.
//
// IMPORTANTE — el modelo `q` que produce buildQuotationModel YA está
// pre-procesado: no expone `q.client`, `q.scenario`, `q.totals` ni
// `q.appendix` directamente. Trabajamos con los campos que sí tiene:
//   q.ref, q.fecha, q.escenario (label),
//   q.panelDescLine, q.areaTotalM2, q.panelCount, q.apoyoCount, q.fijacionCount,
//   q.bomDetailGroups, q.bomGroups,
//   q.subtotalSinIva, q.ivaAmount, q.totalConIva,
//   q.zoneRows, q.planTitle, q.planSummary, q.svgPlanHtml,
//   q.conditionsText.
//
// Para datos que `buildQuotationModel` NO expone (cliente, perímetro
// detallado, fotos, ficha técnica del panel), aceptamos un passthrough
// opcional `q.bmcExtra` — si el dev lo agrega más adelante, lo usamos;
// si no, fallback a "—" / vacío.
//
// Assets externos (logo + product photos) se sirven desde `/bmc-pdf/`
// — pegar la carpeta `public/bmc-pdf/` que viene en el handoff.
// ═══════════════════════════════════════════════════════════════════════════

import { BMC_PDF_TEMPLATE_HTML } from './bmc-pdf-template.html.js';

/** Base pública donde viven los assets del template (logo + product photos). */
const ASSETS_BASE = '/bmc-pdf/';

/**
 * Adapta el modelo `q` (de buildQuotationModel) al schema que espera
 * el template (sample-quote.json). Defensivo — si tu modelo agrega
 * campos extra, ajustar acá; el template no necesita tocarse.
 */
export function adaptQuotationModelToBmcPdf(q) {
  const extra = q.bmcExtra || {};

  // ── BOM ────────────────────────────────────────────────────────────────
  // q.bomDetailGroups viene de buildQuotationModel:
  //   { groupName, groupTotal, items:[{desc,qty,unit,pu,total}] }
  const sourceGroups = Array.isArray(q.bomDetailGroups) ? q.bomDetailGroups : [];

  const bom = sourceGroups.map((g) => {
    const items = (g.items || []).map((i) => ({
      d: i.desc ?? '',
      q: numOrZero(i.qty),
      u: i.unit ?? '',
      pu: numOrZero(i.pu),
      t: numOrZero(i.total),
    }));
    const total = numOrZero(
      g.groupTotal ?? items.reduce((s, it) => s + it.t, 0),
    );
    return { group: g.groupName ?? '', total, items };
  });

  // ── Totales ────────────────────────────────────────────────────────────
  const subtotal = numOrZero(q.subtotalSinIva);
  const iva      = numOrZero(q.ivaAmount);
  const total    = numOrZero(q.totalConIva || subtotal + iva);

  // ── Zonas ──────────────────────────────────────────────────────────────
  // q.zoneRows viene formateado como strings ("6.00 m"). Re-parseamos a
  // números porque el template usa toFixed(2) internamente.
  const zonasSrc = Array.isArray(q.zoneRows) ? q.zoneRows : [];
  const zonas = zonasSrc.map((zr, i) => {
    const largo = parseFloatLoose(zr.largo);
    const ancho = parseFloatLoose(zr.ancho);
    const au    = parseFloatLoose(zr.au);
    return {
      id: i + 1,
      desc: zr.desc || (zonasSrc.length === 1 ? 'Principal' : `Zona ${i + 1}`),
      largo,
      ancho,
      pan: numOrZero(zr.paneles),
      area: +(largo * ancho).toFixed(2),
      au: au || (extra.panelAu ?? 1.12),
    };
  });

  // ── Perímetro ──────────────────────────────────────────────────────────
  // buildQuotationModel NO expone borders. Tomamos del passthrough
  // bmcExtra.globalBorders si existe; si no, derivamos del BOM.
  const SIDE_KEYS = ['sup', 'inf', 'izq', 'der'];
  const SIDE_TO_INTERNAL = {
    sup: 'fondo',
    inf: 'frente',
    izq: 'latIzq',
    der: 'latDer',
  };
  const globalBorders = extra.globalBorders || {};
  const perimetro = {};
  for (const sideKey of SIDE_KEYS) {
    const internal = SIDE_TO_INTERNAL[sideKey];
    const perfilId = globalBorders[internal];
    perimetro[sideKey] = {
      perfil: (perfilId && perfilId !== 'none') ? humanizePerfilId(perfilId) : '',
      cant: 0,
      long_m: 0,
    };
  }
  enrichPerimetroFromBom(perimetro, bom);

  // ── Fijaciones ─────────────────────────────────────────────────────────
  // bmcExtra.ptsHorm/ptsMetal/ptsMadera si está; si no, total agregado.
  const fijacionTipos = buildFijacionTipos(extra, bom, q.fijacionCount);

  // ── Cliente ────────────────────────────────────────────────────────────
  // bmcExtra.client si está; sino "—".
  const cli = extra.client || {};
  const cliente = {
    nombre: cli.razonSocial || cli.nombre || '—',
    direccion: cli.direccion || '—',
    contacto: [cli.nombreRefCliente, cli.telefono].filter(Boolean).join(' · ') || '—',
  };

  // ── Panel detalle ──────────────────────────────────────────────────────
  // q.panelDescLine ya viene armado como string. Lo usamos como
  // resumen del panel; ficha técnica detallada usa bmcExtra.panel si
  // está disponible, sino el template usa fallbacks genéricos.
  const panelInfo = extra.panel || {};

  return {
    ref: q.ref || generateRef(),
    fecha: q.fecha || new Date().toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    validez: q.validez || '10 días hábiles',
    escenario: q.escenario || 'Cotización',
    cliente,
    panel: q.panelDescLine || '—',
    product_url: panelInfo.url || '',
    product_photo: panelInfo.photo ? rebaseAsset(panelInfo.photo) : '',
    panel_detalle: panelInfo.detalle || null,
    pendiente_pct: numOrZero(extra.pendientePct ?? 0),
    perimetro,
    fijacion_tipos: fijacionTipos,
    area: +numOrZero(q.areaTotalM2).toFixed(2),
    paneles: numOrZero(q.panelCount),
    apoyos: numOrZero(q.apoyoCount),
    fijaciones: numOrZero(q.fijacionCount),
    zonas,
    bom,
    subtotal,
    iva,
    total,
    conditions: q.conditionsText
      || 'Fabricación y entrega 10 a 45 días. Seña 60% al confirmar · saldo 40% previo a retiro de fábrica. '
      +  'Oferta válida 10 días. Precios en USD · IVA incluido.',
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function numOrZero(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

/** Acepta "6.00 m", "6,00", 6, "—" → number (NaN→0). */
function parseFloatLoose(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v).replace(',', '.').replace(/[^\d.-]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function humanizePerfilId(id) {
  return String(id)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Enriquece perímetro buscando el ítem correspondiente en el grupo
 * PERFILERÍA del BOM. Si globalBorders no se proveyó, también deriva
 * el nombre del perfil desde la descripción del item.
 */
function enrichPerimetroFromBom(perimetro, bom) {
  const perfileria = bom.find((g) => /perfiler/i.test(g.group));
  if (!perfileria) return;

  const SIDE_RX = {
    sup: /(frente\s*sup|fondo\b|cumbrera)/i,
    inf: /(frente\s*inf|frente\b)/i,
    izq: /(lat\.?\s*izq|latera.*izq)/i,
    der: /(lat\.?\s*der|latera.*der)/i,
  };

  for (const [sideKey, rx] of Object.entries(SIDE_RX)) {
    const hit = perfileria.items.find((it) => rx.test(it.d) && /unid/i.test(it.u));
    if (hit) {
      perimetro[sideKey].cant = hit.q;
      if (!perimetro[sideKey].perfil) {
        perimetro[sideKey].perfil = hit.d.replace(/^[^:]*:\s*/, '');
      }
    }
  }
}

function buildFijacionTipos(extra, bom, fijacionTotalFallback) {
  const ptsHorm   = numOrZero(extra.ptsHorm);
  const ptsMetal  = numOrZero(extra.ptsMetal);
  const ptsMadera = numOrZero(extra.ptsMadera);
  const totalDesglosado = ptsHorm + ptsMetal + ptsMadera;

  // Caso A: bmcExtra trae el desglose por estructura
  if (totalDesglosado > 0) {
    const tipos = [];
    if (ptsMetal > 0) {
      tipos.push({
        etiqueta: 'FIJACIÓN A ESTRUCTURA METÁLICA',
        puntos: ptsMetal,
        componentes: extractFijacionComponentes(bom, /metal|autoperforante|autorroscante/i),
      });
    }
    if (ptsHorm > 0) {
      tipos.push({
        etiqueta: 'FIJACIÓN A HORMIGÓN',
        puntos: ptsHorm,
        componentes: extractFijacionComponentes(bom, /tarugo|hormig|expansiv|taco/i),
      });
    }
    if (ptsMadera > 0) {
      tipos.push({
        etiqueta: 'FIJACIÓN A MADERA',
        puntos: ptsMadera,
        componentes: extractFijacionComponentes(bom, /madera|tirafondo/i),
      });
    }
    return tipos;
  }

  // Caso B: solo tenemos el total agregado (q.fijacionCount)
  const fij = bom.find((g) => /fijac/i.test(g.group));
  if (fij && fij.items.length > 0 && numOrZero(fijacionTotalFallback) > 0) {
    return [{
      etiqueta: 'FIJACIÓN',
      puntos: numOrZero(fijacionTotalFallback),
      componentes: fij.items.slice(0, 6).map((it) => it.d),
    }];
  }

  return [];
}

function extractFijacionComponentes(bom, rx) {
  const fij = bom.find((g) => /fijac/i.test(g.group));
  if (!fij) return [];
  const matches = fij.items.filter((it) => rx.test(it.d));
  const list = matches.length ? matches : fij.items.slice(0, 5);
  return list.map((it) => it.d);
}

function generateRef() {
  const yr = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 9000 + 1000);
  return `BMC-${yr}-${seq}`;
}

function rebaseAsset(p) {
  if (!p) return '';
  if (/^(https?:|data:|blob:)/i.test(p)) return p;
  if (p.startsWith('/')) return p;
  return ASSETS_BASE + p.replace(/^\.?\//, '');
}

// ─── Render entry ───────────────────────────────────────────────────────────

/**
 * Llamado por renderPdfLayout('bmc-pdf', q) en src/pdf-templates/index.js.
 * Devuelve un string HTML completo, self-contained, listo para print/preview.
 */
export function render(q) {
  const data = adaptQuotationModelToBmcPdf(q);

  const baseTag = `<base href="${ASSETS_BASE}">`;
  const dataTag = `<script>window.QUOTE_DATA = ${
    JSON.stringify(data).replace(/</g, '\\u003c')
  };</script>`;

  let html = BMC_PDF_TEMPLATE_HTML;

  // <base> justo después de <head> para que assets/bmc-logo.png resuelva
  html = html.replace(/<head([^>]*)>/i, (m) => `${m}\n  ${baseTag}`);

  // Inyectar QUOTE_DATA antes del primer <script> del template
  html = html.replace(
    /<script>\s*async function resolveData/,
    `${dataTag}\n  <script>\n  async function resolveData`,
  );

  return html;
}

export default { render, adaptQuotationModelToBmcPdf };
