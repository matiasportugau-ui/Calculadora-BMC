// ═══════════════════════════════════════════════════════════════════════════
// Datos de muestra para regenerar previews HTML estáticos (npm run quotation-preview:render).
// Editar aquí el contenido de ejemplo; el layout vive en quotationViews.js.
// ═══════════════════════════════════════════════════════════════════════════

// Caso base: BMC-2026-0112 · ISODEC EPS 100mm · 3 zonas · sin bordes · solo techo
// BOM generado con executeScenario("solo_techo") sobre el snapshot real del JSON guardado.

/** @type {Parameters<import("./quotationViews.js").generateClientVisualHTML>[0]} */
export const sampleClientVisualData = {
  client: {
    nombre: "",
    telefono: "",
    direccion: "",
  },
  project: {
    fecha: "25/04/2026",
    descripcion: "",
    refInterna: "BMC-2026-0112",
  },
  scenario: "solo_techo",
  panel: {
    label: "ISODEC EPS",
    espesor: 100,
    color: "Blanco",
  },
  groups: [
    {
      title: "PANELES",
      items: [
        { label: "ISODEC EPS 100mm · 18 paneles", cant: 138.88, unidad: "m²", pu: 47.26, total: 6564.02 },
      ],
    },
    {
      title: "FIJACIONES",
      items: [
        { label: "Varilla roscada 3/8\" (1m)",  cant: 20,  unidad: "unid", pu: 3.68,  total: 73.64  },
        { label: "Tuerca 3/8\" galv.",           cant: 190, unidad: "unid", pu: 0.08,  total: 15.96  },
        { label: "Arandela carrocero 3/8\"",     cant: 95,  unidad: "unid", pu: 0.66,  total: 62.51  },
        { label: "Arandela plana 3/8\"",         cant: 95,  unidad: "unid", pu: 0.10,  total: 9.04   },
        { label: "Tortuga PVC (arand. PP)",      cant: 95,  unidad: "unid", pu: 1.51,  total: 143.64 },
      ],
    },
    {
      title: "SELLADORES",
      items: [
        { label: "Silicona Bromplast 8 x600",                    cant: 16, unidad: "unid", pu: 11.24, total: 179.88 },
        { label: "Silicona neutra 300 ml (Silva / lista MATRIZ)", cant: 32, unidad: "unid", pu: 8.40,  total: 268.80 },
        { label: "Cinta Butilo 2mm×15mm×22.5m",                  cant: 3,  unidad: "unid", pu: 19.19, total: 57.57  },
      ],
    },
    {
      title: "SERVICIOS",
      items: [
        { label: "Flete con entrega en obra", cant: 1, unidad: "servicio", pu: 280.00, total: 280.00 },
      ],
    },
  ],
  totals: {
    subtotalSinIVA: 7655.06,
    iva: 1684.11,
    totalFinal: 9339.17,
  },
  appendix: {
    scenarioLabel: "Techo",
    showBorders: false,
    borders: { fondo: null, frente: null, latIzq: null, latDer: null },
    borderExtras: [],
    roofBlock: null,
    roofBlocks: [
      { largo: 8.00, ancho: 8.96, anchoTotal: 8.96, cantPaneles: 8, au: 1.12, label: "ISODEC EPS 100mm" },
      { largo: 6.00, ancho: 5.60, anchoTotal: 5.60, cantPaneles: 5, au: 1.12, label: "ISODEC EPS 100mm" },
      { largo: 6.00, ancho: 5.60, anchoTotal: 5.60, cantPaneles: 5, au: 1.12, label: "ISODEC EPS 100mm" },
    ],
    wallBlock: null,
    zonas: [
      { largo: 8.00, ancho: 8.96, preview: {} },
      { largo: 6.00, ancho: 5.60, preview: {} },
      { largo: 6.00, ancho: 5.60, preview: {} },
    ],
    tipoAguas: "una_agua",
    panelAu: 1.12,
    encounterByPair: {},
    kpi: {
      area: 138.88,
      paneles: 18,
      apoyosOrEsq: 3,
      ptsFij: 95,
      useApoyosLabel: true,
    },
    totals: {
      subtotalSinIVA: 7655.06,
      iva: 1684.11,
      totalFinal: 9339.17,
    },
  },
  snapshotImages: {},
  includePlantaResumenPage: true,
};

/** @type {Parameters<import("./quotationViews.js").generateCosteoHTML>[0]} */
export const sampleCosteoData = {
  client: { nombre: "Cliente demo — costeo interno" },
  project: {
    refInterna: "DEMO-COST-001",
    fecha: "21 abr 2026",
    descripcion: "Obra demo — análisis interno",
  },
  listaLabel: "web (MATRIZ · preview)",
  report: {
    rows: [
      {
        group: "PANELES",
        label: "Panel techo PIR 50 mm — m²",
        sku: "PIR50",
        cant: 100,
        unidad: "m²",
        unitCost: 37.58,
        costTotal: 3758.0,
        pu: 50.91,
        saleTotal: 5091.0,
        marginPct: 35.4,
        margin: 1333.0,
        isFlete: false,
      },
      {
        group: "PANELES",
        label: "Panel pared — m²",
        sku: "IW40",
        cant: 80,
        unidad: "m²",
        unitCost: 32.0,
        costTotal: 2560.0,
        pu: 45.0,
        saleTotal: 3600.0,
        marginPct: 40.6,
        margin: 1040.0,
        isFlete: false,
      },
      {
        group: "SERVICIOS",
        label: "Flete con entrega",
        sku: "FLETE",
        cant: 1,
        unidad: "servicio",
        unitCost: 186.03,
        costTotal: 186.03,
        pu: 252.0,
        saleTotal: 252.0,
        marginPct: 26.2,
        margin: 65.97,
        isFlete: true,
      },
    ],
    byGroup: [
      {
        group: "PANELES",
        items: 2,
        saleTotal: 8691.0,
        costTotal: 6318.0,
        marginTotal: 2373.0,
        marginPct: 37.6,
        missingCostItems: 0,
      },
      {
        group: "SERVICIOS",
        items: 1,
        saleTotal: 252.0,
        costTotal: 186.03,
        marginTotal: 65.97,
        marginPct: 35.4,
        missingCostItems: 0,
      },
    ],
    missingCostRows: [
      {
        group: "EXTRAORDINARIOS",
        label: "Ítem sin costo en catálogo (ejemplo)",
        sku: "—",
        cant: 2,
        unidad: "un",
        saleTotal: 150.0,
      },
    ],
    fleteMissingCost: false,
    totalMarginPct: 32.5,
    coveredSalePct: 94.0,
    sumSaleAll: 9093.0,
    sumCostAll: 6504.03,
    totalMargin: 2438.97,
    sumSaleForMargin: 8943.0,
    sumCostForMargin: 6504.03,
  },
};
