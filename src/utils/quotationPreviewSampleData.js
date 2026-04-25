// ═══════════════════════════════════════════════════════════════════════════
// Datos de muestra para regenerar previews HTML estáticos (npm run quotation-preview:render).
// Editar aquí el contenido de ejemplo; el layout vive en quotationViews.js.
// ═══════════════════════════════════════════════════════════════════════════

/** @type {Parameters<import("./quotationViews.js").generateClientVisualHTML>[0]} */
export const sampleClientVisualData = {
  client: {
    nombre: "Frigorífico del Norte SRL",
    telefono: "098 123 456",
    direccion: "Ruta 8 km 42, Melo, Cerro Largo",
  },
  project: {
    fecha: "24/04/2026",
    descripcion: "Galpón industrial — techo nuevo",
    refInterna: "BMC-2026-0142",
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
        { label: "ISODEC EPS 100mm · 8 paneles × 10.00 m", cant: 89.60, unidad: "m²", pu: 38.82, total: 3478.27 },
        { label: "ISODEC EPS 100mm · 5 paneles × 6.00 m",  cant: 33.60, unidad: "m²", pu: 38.82, total: 1304.85 },
      ],
    },
    {
      title: "PERFILERÍA",
      items: [
        { label: "Frente Inf: Canalón", cant: 5, unidad: "unid", pu: 69.54, total: 347.70 },
        { label: "Soporte canalón", cant: 2, unidad: "unid", pu: 15.94, total: 31.88 },
        { label: "Frente Sup: Gotero frontal Superior", cant: 5, unidad: "unid", pu: 15.67, total: 78.35 },
        { label: "Lat.Izq: Gotero Lateral", cant: 6, unidad: "unid", pu: 20.77, total: 124.62 },
        { label: "Lat.Der: Gotero Lateral", cant: 2, unidad: "unid", pu: 20.77, total: 41.54 },
        { label: "Tornillo T1 (perfilería)", cant: 182, unidad: "unid", pu: 0.05, total: 8.95 },
      ],
    },
    {
      title: "FIJACIONES",
      items: [
        { label: "Varilla roscada 3/8\" (1m)", cant: 36, unidad: "unid", pu: 3.95, total: 142.02 },
        { label: "Tuerca 3/8\" galv.", cant: 252, unidad: "unid", pu: 0.09, total: 22.68 },
        { label: "Taco expansivo 3/8\"", cant: 32, unidad: "unid", pu: 1.23, total: 39.36 },
        { label: "Arandela carrocero 3/8\"", cant: 142, unidad: "unid", pu: 0.71, total: 100.10 },
        { label: "Arandela plana 3/8\"", cant: 110, unidad: "unid", pu: 0.10, total: 11.22 },
        { label: "Tortuga PVC (arand. PP)", cant: 142, unidad: "unid", pu: 1.62, total: 230.04 },
      ],
    },
    {
      title: "SELLADORES",
      items: [
        { label: "Silicona Bromplast 8 x600", cant: 13, unidad: "unid", pu: 9.64, total: 125.26 },
        { label: "Silicona neutra 300 ml (Silva / lista MATRIZ)", cant: 26, unidad: "unid", pu: 7.00, total: 182.00 },
        { label: "Cinta Butilo 2mm×15mm×22.5m", cant: 2, unidad: "unid", pu: 15.77, total: 31.54 },
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
    subtotalSinIVA: 6580.38,
    iva: 1447.68,
    totalFinal: 8028.06,
  },
  appendix: {
    scenarioLabel: "Techo",
    showBorders: true,
    borders: { fondo: null, frente: null, latIzq: null, latDer: null },
    borderExtras: ["Canalón", "Gotero superior"],
    roofBlock: null,
    roofBlocks: [
      { largo: 10.00, ancho: 8.96, anchoTotal: 8.96, cantPaneles: 8, au: 1.12, label: "ISODEC EPS 100mm" },
      { largo: 6.00,  ancho: 5.60, anchoTotal: 5.60, cantPaneles: 5, au: 1.12, label: "ISODEC EPS 100mm" },
    ],
    wallBlock: null,
    kpi: {
      area: 123.2,
      paneles: 13,
      apoyosOrEsq: 3,
      ptsFij: 142,
      useApoyosLabel: true,
    },
    totals: {
      subtotalSinIVA: 6580.38,
      iva: 1447.68,
      totalFinal: 8028.06,
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
