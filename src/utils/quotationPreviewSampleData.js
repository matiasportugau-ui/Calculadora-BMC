// ═══════════════════════════════════════════════════════════════════════════
// Datos de muestra para regenerar previews HTML estáticos (npm run quotation-preview:render).
// Editar aquí el contenido de ejemplo; el layout vive en quotationViews.js.
// ═══════════════════════════════════════════════════════════════════════════

/** @type {Parameters<import("./quotationViews.js").generateClientVisualHTML>[0]} */
export const sampleClientVisualData = {
  client: {
    nombre: "Cliente demo — preview HTML",
    telefono: "099 000 000",
    direccion: "Montevideo, Uruguay",
  },
  project: {
    fecha: "21 abr 2026",
    descripcion: "Galpón demo (vista previa editable)",
    refInterna: "DEMO-PREVIEW-001",
  },
  scenario: "techo_fachada",
  panel: {
    label: "ISODEC PIR",
    espesor: 50,
    color: "Blanco",
  },
  groups: [
    {
      title: "PANELES",
      items: [
        {
          label: "Panel techo ISODEC PIR 50 mm — m²",
          cant: 120.5,
          unidad: "m²",
          pu: 50.91,
          total: 6134.96,
        },
        {
          label: "Panel pared — m²",
          cant: 80,
          unidad: "m²",
          pu: 45.0,
          total: 3600.0,
        },
      ],
    },
    {
      title: "PERFILERÍA",
      items: [
        { label: "Cumbrera 2 m", cant: 4, unidad: "un", pu: 120.0, total: 480.0 },
      ],
    },
  ],
  totals: {
    subtotalSinIVA: 10214.96,
    iva: 2247.29,
    totalFinal: 12462.25,
  },
  appendix: {
    scenarioLabel: "Techo + Fachada",
    showBorders: true,
    borders: {
      fondo: "babeta_adosar",
      frente: "gotero_frontal",
      latIzq: "gotero_lateral",
      latDer: "none",
    },
    borderExtras: ["Canalón", "Gotero superior"],
    roofBlock: {
      largo: 18.5,
      ancho: 8.2,
      anchoTotal: 8.06,
      cantPaneles: 16,
      au: 1.12,
      label: "ISODEC PIR 50mm",
    },
    wallBlock: {
      alto: 6.0,
      perimetro: 52.0,
      cantPaneles: 28,
      au: 1.12,
      area: 168.5,
      label: "ISOWALL PIR 40mm",
    },
    kpi: {
      area: 285.4,
      paneles: 44,
      apoyosOrEsq: 6,
      ptsFij: 184,
      useApoyosLabel: true,
    },
    totals: {
      subtotalSinIVA: 10214.96,
      iva: 2247.29,
      totalFinal: 12462.25,
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
