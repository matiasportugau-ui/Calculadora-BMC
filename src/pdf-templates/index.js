// src/pdf-templates/index.js
// Dispatcher + shared helpers for PDF layout templates.
// Each template receives a QuotationModel and returns a complete HTML string.

export const LAYOUT_OPTIONS = [
  { id: 'bmc-pdf',           label: 'BMC PDF — Blueprint Técnico' },
  { id: 'soft-modern',       label: 'E — Soft Modern' },
  { id: 'executive-dark',    label: 'A — Executive Dark' },
  { id: 'blueprint',         label: 'B — Blueprint' },
  { id: 'minimalist',        label: 'C — Minimalist' },
  { id: 'construction-bold', label: 'D — Construction Bold' },
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
  const { project, scenario, panel, groups, totals, appendix, snapshotImages } = data;
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
    items: g.items.map(i => ({
      desc: i.label, qty: i.cant, unit: i.unidad, pu: i.pu, total: i.total,
    })),
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
  };
}

const TEMPLATE_MAP = {
  'bmc-pdf':           () => import('./bmc-pdf.js'),
  'soft-modern':       () => import('./soft-modern.js'),
  'executive-dark':    () => import('./executive-dark.js'),
  'blueprint':         () => import('./blueprint.js'),
  'minimalist':        () => import('./minimalist.js'),
  'construction-bold': () => import('./construction-bold.js'),
};

export async function renderPdfLayout(layout, q) {
  const loader = TEMPLATE_MAP[layout] ?? TEMPLATE_MAP['soft-modern'];
  const mod = await loader();
  return mod.render(q);
}
