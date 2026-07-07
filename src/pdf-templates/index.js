// src/pdf-templates/index.js
// Dispatcher + shared helpers for PDF layout templates.
// Each template receives a QuotationModel and returns a complete HTML string.
// v2 templates (simple family + others) refactored 2026-06-16 for clean cat rows, no ►, scoped CSS, prominent styling.
//
// 'simple' (Presupuesto Simple) is the preferred production template for client PDF quotes.
// The previous (pre-R3-C) version is available as 'simple-previous'.

export const LAYOUT_OPTIONS = [
  // Modern lightweight family — "Presupuesto Simple" (plain) is the most faithful to bmcuruguay.com.uy visual language.
  // Preferred production default.
  { id: 'simple',            label: 'Presupuesto Simple', recommended: true },
  { id: 'simple-previous',   label: 'Presupuesto Simple (previous)' },
  { id: 'simple-carbon',     label: 'Simple — Carbon (premium dark)' },
  { id: 'simple-sage',       label: 'Simple — Sage' },
  { id: 'simple-slate',      label: 'Simple — Slate' },
  { id: 'simple-warm',       label: 'Simple — Warm' },
  { id: 'simple-ocean',      label: 'Simple — Ocean' },

  // Legacy / heavy technical styles (kept for compatibility). The "BMC PDF — Blueprint Técnico" is close to brand navy + technical detail.
  // 'classic' is the original HOJA VISUAL CLIENTE (generateClientVisualHTML) used before
  // the template system — recovered as a selectable option; renders from q.raw.
  { id: 'classic',           label: 'Clásico — Hoja Visual Cliente (formato anterior)', legacy: true },
  { id: 'bmc-pdf',           label: 'BMC PDF — Blueprint Técnico', legacy: true },
  { id: 'soft-modern',       label: 'E — Soft Modern', legacy: true },
  { id: 'executive-dark',    label: 'A — Executive Dark', legacy: true },
  { id: 'blueprint',         label: 'B — Blueprint', legacy: true },
  { id: 'minimalist',        label: 'C — Minimalist', legacy: true },
  { id: 'construction-bold', label: 'D — Construction Bold', legacy: true },
];

export const PDF_LAYOUT_KEY = 'bmc.pdfLayout';

export function getThemeTokens(layout) {
  const themes = {
    'soft-modern': {
      bg: '#FAFAF8', slate: '#2C4A3E', sage: '#5D8AA8',
      warm: '#E8DDD0', muted: '#7A8C82', text: '#2D3A35',
      bdr: '#DDD5CC', lt: '#EBF3EE', lt2: '#D9EBE0',
    },
  };
  return themes[layout] ?? themes['soft-modern'];
}

const SCENARIO_LABELS = {
  solo_techo: 'Solo Techo',
  solo_fachada: 'Solo Fachada',
  techo_fachada: 'Techo + Fachada',
  camara_frig: 'Cámara Frigorífica',
  presupuesto_libre: 'Presupuesto libre',
};

const ZONE_DESCS = ['Principal', 'Ext. lateral der.', 'Ext. lateral izq.', 'Ext. adicional'];

export function buildQuotationModel(data) {
  const {
    client,
    project,
    scenario,
    panel,
    groups,
    totals,
    appendix,
    snapshotImages,
    bmcExtra: bmcExtraUser,
    quoteId,           // NEW: stable identifier for the quote
    version = 1,       // NEW: version number for iterations
    createdBy,         // NEW: operator who generated it
  } = data;
  const clienteSrc = client ?? project;
  const scenarioLabel = appendix?.scenarioLabel || SCENARIO_LABELS[scenario] || scenario;
  const zonas = appendix?.zonas || [];
  const roofBlocks = appendix?.roofBlocks || [];
  const kpi = appendix?.kpi || {};
  const au = appendix?.panelAu || 0;

  const validZonas = zonas.filter(z => z?.largo > 0 && z?.ancho > 0);
  const zonaCount = Math.max(1, validZonas.length || roofBlocks.length);

  const panelDescLine = [
    panel?.label,
    panel?.espesor ? `${panel.espesor}mm` : null,
    panel?.color ? `Color ${panel.color}` : null,
    scenarioLabel,
    zonaCount > 1 ? `${zonaCount} Zonas` : null,
  ].filter(Boolean).join(' · ');

  const bomGroups = groups.map(g => ({
    name: g.title,
    totalUsd: g.items.reduce((s, i) => s + (Number(i.total) || 0), 0),
  }));

  const bomDetailGroups = groups.map(g => ({
    groupName: g.title,
    groupTotal: g.items.reduce((s, i) => s + (Number(i.total) || 0), 0),
    items: g.items.map(i => {
      const base = { desc: i.label, qty: i.cant, unit: i.unidad, pu: i.pu, total: i.total };
      // Pass panel quantity & length so the preferred template can display them explicitly
      if (i.cantPaneles != null) base.cantPaneles = i.cantPaneles;
      if (i.largoPanel != null) base.largoPanel = i.largoPanel;
      return base;
    }),
  }));

  const totalArea = kpi.area != null
    ? Number(kpi.area)
    : roofBlocks.reduce((s, rb) => s + Number(rb.largo) * Number(rb.ancho || rb.anchoTotal || 0), 0);

  const zoneRows = roofBlocks.map((rb, idx) => {
    const ancho = Number(rb.ancho || rb.anchoTotal || 0);
    return {
      zona: `Zona ${idx + 1}`,
      desc: ZONE_DESCS[idx] ?? `Ext. ${idx + 1}`,
      largo: `${Number(rb.largo).toFixed(2)} m`,
      ancho: `${ancho.toFixed(2)} m`,
      paneles: rb.cantPaneles,
      area: `${(Number(rb.largo) * ancho).toFixed(2)} m²`,
      au: au > 0 ? `${au.toFixed(2)} m` : '—',
    };
  });

  const tipoAguas = appendix?.tipoAguas || 'una_agua';
  const aguasLabel = tipoAguas === 'dos_aguas' ? 'Dos Aguas' : 'Única Agua';
  const planTitle = `Planta Cubierta — ${aguasLabel} · ${zonaCount} Zona${zonaCount !== 1 ? 's' : ''}`;
  const planSummary = `${totalArea.toFixed(2)} m² · ${kpi.paneles ?? '—'} paneles${au > 0 ? ` · AU ${au.toFixed(2)} m` : ''}`;

  /** BMC PDF técnico: cliente, perímetro y extras no expuestos en raíz del modelo */
  const bmcExtra = {
    client: {
      nombre: clienteSrc?.nombre || clienteSrc?.razonSocial,
      razonSocial: clienteSrc?.razonSocial || clienteSrc?.nombre,
      rut: clienteSrc?.rut,
      direccion: clienteSrc?.direccion,
      telefono: clienteSrc?.telefono,
      nombreRefCliente: clienteSrc?.nombreRefCliente,
    },
    globalBorders: appendix?.globalBorders,
    panelAu: appendix?.panelAu ?? au,
    panel: panel && (panel.url || panel.photo || panel.detalle)
      ? { url: panel.url, photo: panel.photo, detalle: panel.detalle }
      : undefined,
    ...(bmcExtraUser && typeof bmcExtraUser === 'object' ? bmcExtraUser : {}),
  };

  return {
    ref: project?.refInterna || '—',
    fecha: project?.fecha || '—',
    escenario: scenarioLabel,
    validez: '10 días hábiles',
    panelDescLine,
    areaTotalM2: totalArea,
    panelCount: kpi.paneles ?? 0,
    apoyoCount: kpi.apoyosOrEsq ?? 0,
    fijacionCount: kpi.ptsFij ?? 0,
    bomGroups,
    subtotalSinIva: totals?.subtotalSinIVA ?? 0,
    ivaAmount: totals?.iva ?? 0,
    totalConIva: totals?.totalFinal ?? 0,
    svgPlanHtml: snapshotImages?.roofPlan2dSvg || '',
    planTitle,
    planSummary,
    zoneRows,
    bomDetailGroups,
    conditionsText: 'Fabricación y entrega 10 a 45 días. Seña 60% al confirmar · saldo 40% previo a retiro de fábrica. Oferta válida 10 días. Precios en USD · IVA incluido.',
    bmcExtra,

    // NEW — versioning & audit fields (2026-05-27 PDF improvements)
    quoteId: quoteId || null,
    version: Number(version) || 1,
    createdBy: createdBy || null,
    generatedAt: new Date().toISOString(),

    // Raw quotation inputs — the 'classic' layout (generateClientVisualHTML)
    // consumes the original data shape, not the flattened model above.
    raw: { client: clienteSrc, project, scenario, panel, groups, totals, appendix, snapshotImages },
  };
}

const TEMPLATE_MAP = {
  'simple':            () => import('./simple.js'),
  'simple-previous':   () => import('./simple-previous.js'),
  'simple-sage':       () => import('./simple-sage.js'),
  'simple-slate':      () => import('./simple-slate.js'),
  'simple-warm':       () => import('./simple-warm.js'),
  'simple-ocean':      () => import('./simple-ocean.js'),
  'simple-carbon':     () => import('./simple-carbon.js'),
  'bmc-pdf':           () => import('./bmc-pdf.js'),
  'soft-modern':       () => import('./soft-modern.js'),
  'executive-dark':    () => import('./executive-dark.js'),
  'blueprint':         () => import('./blueprint.js'),
  'minimalist':        () => import('./minimalist.js'),
  'construction-bold': () => import('./construction-bold.js'),
};

export async function renderPdfLayout(layout, q) {
  // 'classic' — the original HOJA VISUAL CLIENTE; needs the raw inputs preserved
  // by buildQuotationModel. Models without q.raw fall through to the default map.
  if (layout === 'classic' && q?.raw) {
    const { generateClientVisualHTML } = await import('../utils/quotationViews.js');
    // includePlantaResumenPage:false matches the pre-existing classic fallback in buildClientePdfHtml
    return generateClientVisualHTML({ ...q.raw, includePlantaResumenPage: false });
  }
  const loader = TEMPLATE_MAP[layout] ?? TEMPLATE_MAP['soft-modern'];
  const mod = await loader();
  return mod.render(q);
}
