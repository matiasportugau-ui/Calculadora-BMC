// ═══════════════════════════════════════════════════════════════════════════
// Helper / BOM / Override Tests — Panelin Calculadora BMC v3.0
// Tests bomToGroups, applyOverrides, flete regression, and output generators
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from "vitest";

import { setListaPrecios, SERVICIOS } from "../src/data/constants.js";
import { calcTechoCompleto, calcParedCompleto, calcTotalesSinIVA } from "../src/utils/calculations.js";
import {
  bomToGroups,
  applyOverrides,
  createLineId,
  fmtPrice,
  generatePrintHTML,
  buildWhatsAppText,
} from "../src/utils/helpers.js";

// ═══════════════════════════════════════════════════════════════════════════
// §1  bomToGroups
// ═══════════════════════════════════════════════════════════════════════════

describe("bomToGroups", () => {
  beforeEach(() => setListaPrecios("web"));

  it("returns empty array for null result", () => {
    expect(bomToGroups(null)).toEqual([]);
  });

  it("returns empty array for error result", () => {
    expect(bomToGroups({ error: "bad" })).toEqual([]);
  });

  it("techo result produces PANELES and FIJACIONES groups", () => {
    const r = calcTechoCompleto({
      familia: "ISODEC_EPS", espesor: 100,
      largo: 5.0, ancho: 5.6, tipoEst: "metal",
      borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
      opciones: { inclSell: true },
    });
    const groups = bomToGroups(r);
    const titles = groups.map(g => g.title);
    expect(titles).toContain("PANELES");
    expect(titles).toContain("FIJACIONES");
    expect(titles).toContain("SELLADORES");
  });

  it("pared result produces PERFILES U and ESQUINEROS groups", () => {
    const r = calcParedCompleto({
      familia: "ISOPANEL_EPS", espesor: 100,
      alto: 3.5, perimetro: 40,
      numEsqExt: 4, numEsqInt: 0,
      aberturas: [], tipoEst: "metal", inclSell: true,
    });
    const groups = bomToGroups(r);
    const titles = groups.map(g => g.title);
    expect(titles).toContain("PANELES");
    expect(titles).toContain("PERFILES U");
    expect(titles).toContain("ESQUINEROS");
    expect(titles).toContain("PERFILERÍA PARED");
    expect(titles).toContain("FIJACIONES");
    expect(titles).toContain("SELLADORES");
  });

  it("every group has non-empty items array", () => {
    const r = calcTechoCompleto({
      familia: "ISODEC_EPS", espesor: 100,
      largo: 5.0, ancho: 5.6, tipoEst: "metal",
      borders: { frente: "gotero_frontal", fondo: "gotero_frontal", latIzq: "gotero_lateral", latDer: "gotero_lateral" },
      opciones: { inclCanalon: true, inclGotSup: false, inclSell: true },
    });
    const groups = bomToGroups(r);
    for (const g of groups) {
      expect(g.items.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §2  applyOverrides
// ═══════════════════════════════════════════════════════════════════════════

describe("applyOverrides", () => {
  const sampleGroups = [
    {
      title: "PANELES",
      items: [
        { label: "Panel A", cant: 10, pu: 50, total: 500 },
        { label: "Panel B", cant: 5, pu: 30, total: 150 },
      ],
    },
  ];

  it("passes through unchanged when no overrides", () => {
    const result = applyOverrides(sampleGroups, {});
    expect(result[0].items[0].total).toBe(500);
    expect(result[0].items[0].isOverridden).toBe(false);
  });

  it("overrides cant and recalculates total", () => {
    const lineId = createLineId("PANELES", 0);
    const overrides = { [lineId]: { field: "cant", value: 20 } };
    const result = applyOverrides(sampleGroups, overrides);
    expect(result[0].items[0].cant).toBe(20);
    expect(result[0].items[0].total).toBeCloseTo(20 * 50, 2);
    expect(result[0].items[0].isOverridden).toBe(true);
  });

  it("overrides pu and recalculates total", () => {
    const lineId = createLineId("PANELES", 0);
    const overrides = { [lineId]: { field: "pu", value: 100 } };
    const result = applyOverrides(sampleGroups, overrides);
    expect(result[0].items[0].pu).toBe(100);
    expect(result[0].items[0].total).toBeCloseTo(10 * 100, 2);
    expect(result[0].items[0].isOverridden).toBe(true);
  });

  it("non-overridden items preserve lineId", () => {
    const result = applyOverrides(sampleGroups, {});
    expect(result[0].items[0].lineId).toBe(createLineId("PANELES", 0));
    expect(result[0].items[1].lineId).toBe(createLineId("PANELES", 1));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §3  REGRESSION — Flete BOM uses user value, not price-list (BUG-01)
// ═══════════════════════════════════════════════════════════════════════════

describe("Regression — Flete uses user-supplied value (BUG-01)", () => {
  beforeEach(() => setListaPrecios("web"));

  it("flete BOM item uses the user-entered value, not SERVICIOS.flete price", () => {
    const userFlete = 280;
    const r = calcTechoCompleto({
      familia: "ISODEC_EPS", espesor: 100,
      largo: 5.0, ancho: 5.6, tipoEst: "metal",
      borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
      opciones: { inclSell: true },
    });

    let groups = bomToGroups(r);
    if (userFlete > 0) {
      groups.push({
        title: "SERVICIOS",
        items: [{
          label: SERVICIOS.flete.label,
          sku: "FLETE",
          cant: 1,
          unidad: "servicio",
          pu: userFlete,
          total: userFlete,
        }],
      });
    }
    groups = applyOverrides(groups, {});

    const serviciosGroup = groups.find(g => g.title === "SERVICIOS");
    expect(serviciosGroup).toBeDefined();
    const fleteItem = serviciosGroup.items.find(i => i.sku === "FLETE");
    expect(fleteItem.pu).toBe(userFlete);
    expect(fleteItem.total).toBe(userFlete);
    expect(fleteItem.pu).not.toBe(SERVICIOS.flete.web);
    expect(fleteItem.total).not.toBe(SERVICIOS.flete.web);
  });

  it("flete=0 means no SERVICIOS group added (guard)", () => {
    const userFlete = 0;
    const r = calcTechoCompleto({
      familia: "ISODEC_EPS", espesor: 100,
      largo: 5.0, ancho: 5.6, tipoEst: "metal",
      borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
      opciones: { inclSell: true },
    });
    let groups = bomToGroups(r);
    if (userFlete > 0) {
      groups.push({
        title: "SERVICIOS",
        items: [{ label: "Flete", sku: "FLETE", cant: 1, unidad: "servicio", pu: userFlete, total: userFlete }],
      });
    }
    expect(groups.some(g => g.title === "SERVICIOS")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §4  fmtPrice
// ═══════════════════════════════════════════════════════════════════════════

describe("fmtPrice", () => {
  it("formats with 2 decimal places", () => {
    expect(fmtPrice(1234.5)).toMatch(/1.*234\.50/);
  });

  it("formats zero", () => {
    expect(fmtPrice(0)).toBe("0.00");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §5  PDF output — generatePrintHTML
// ═══════════════════════════════════════════════════════════════════════════

describe("generatePrintHTML — PDF output", () => {
  beforeEach(() => setListaPrecios("web"));

  function buildPDFData() {
    const r = calcTechoCompleto({
      familia: "ISODEC_EPS", espesor: 100,
      largo: 5.0, ancho: 5.6, tipoEst: "metal",
      borders: { frente: "gotero_frontal", fondo: "none", latIzq: "gotero_lateral", latDer: "none" },
      opciones: { inclSell: true },
    });
    const groups = bomToGroups(r);
    return {
      client: { nombre: "Test Client", rut: "123456", telefono: "099123456", direccion: "Maldonado" },
      project: { fecha: "01/01/2026", refInterna: "REF-001", descripcion: "Galpón" },
      scenario: "solo_techo",
      panel: { label: "ISODEC EPS", espesor: 100, color: "Blanco" },
      autoportancia: r.autoportancia,
      groups: groups.map(g => ({
        title: g.title,
        items: g.items,
        subtotal: g.items.reduce((s, i) => s + (i.total || 0), 0),
      })),
      totals: r.totales,
      warnings: r.warnings,
    };
  }

  it("contains 'BMC Uruguay' header", () => {
    const html = generatePrintHTML(buildPDFData());
    expect(html).toContain("BMC Uruguay");
  });

  it("contains 'COTIZACIÓN' header", () => {
    const html = generatePrintHTML(buildPDFData());
    expect(html).toContain("COTIZACIÓN");
  });

  it("contains client name", () => {
    const html = generatePrintHTML(buildPDFData());
    expect(html).toContain("Test Client");
  });

  it("contains panel info", () => {
    const html = generatePrintHTML(buildPDFData());
    expect(html).toContain("ISODEC EPS");
    expect(html).toContain("100mm");
    expect(html).toContain("Blanco");
  });

  it("contains scenario label", () => {
    const html = generatePrintHTML(buildPDFData());
    expect(html).toContain("Techo");
  });

  it("contains subtotal and IVA rows", () => {
    const html = generatePrintHTML(buildPDFData());
    expect(html).toContain("Subtotal s/IVA");
    expect(html).toContain("IVA 22%");
    expect(html).toContain("TOTAL USD");
  });

  it("contains bank details", () => {
    const html = generatePrintHTML(buildPDFData());
    expect(html).toContain("Metalog SAS");
    expect(html).toContain("110520638-00002");
  });

  it("contains commercial conditions", () => {
    const html = generatePrintHTML(buildPDFData());
    expect(html).toContain("10 a 15 días");
    expect(html).toContain("Seña 60%");
    expect(html).toContain("10 días");
  });

  it("is valid HTML with DOCTYPE", () => {
    const html = generatePrintHTML(buildPDFData());
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain("</html>");
  });

  it("renders BOM line items with correct structure", () => {
    const html = generatePrintHTML(buildPDFData());
    expect(html).toContain("PANELES");
    expect(html).toContain("FIJACIONES");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §6  WhatsApp text — buildWhatsAppText
// ═══════════════════════════════════════════════════════════════════════════

describe("buildWhatsAppText — WhatsApp output", () => {
  beforeEach(() => setListaPrecios("web"));

  function buildWAData() {
    const r = calcTechoCompleto({
      familia: "ISODEC_EPS", espesor: 100,
      largo: 5.0, ancho: 5.6, tipoEst: "metal",
      borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
      opciones: { inclSell: true },
    });
    return {
      client: { nombre: "Juan Pérez", rut: "12345678", telefono: "099111222", direccion: "Punta del Este" },
      project: { fecha: "15/03/2026", refInterna: "WA-TEST", descripcion: "Barbacoa" },
      scenario: "solo_techo",
      panel: { label: "ISODEC EPS", espesor: 100, color: "Blanco" },
      totals: r.totales,
      listaLabel: "Web",
    };
  }

  it("contains WhatsApp bold markers for title", () => {
    const txt = buildWhatsAppText(buildWAData());
    expect(txt).toContain("*Cotización BMC Uruguay*");
  });

  it("contains client name", () => {
    const txt = buildWhatsAppText(buildWAData());
    expect(txt).toContain("Juan Pérez");
  });

  it("contains panel description", () => {
    const txt = buildWhatsAppText(buildWAData());
    expect(txt).toContain("ISODEC EPS");
    expect(txt).toContain("100mm");
    expect(txt).toContain("Blanco");
  });

  it("contains scenario label", () => {
    const txt = buildWhatsAppText(buildWAData());
    expect(txt).toContain("Solo techo");
  });

  it("contains totals with USD prefix", () => {
    const txt = buildWhatsAppText(buildWAData());
    expect(txt).toContain("USD");
    expect(txt).toContain("Subtotal s/IVA");
    expect(txt).toContain("IVA 22%");
    expect(txt).toContain("TOTAL USD");
  });

  it("contains lista label", () => {
    const txt = buildWhatsAppText(buildWAData());
    expect(txt).toContain("Web");
  });

  it("contains contact info", () => {
    const txt = buildWhatsAppText(buildWAData());
    expect(txt).toContain("092 663 245");
    expect(txt).toContain("bmcuruguay.com.uy");
  });

  it("contains delivery/payment terms", () => {
    const txt = buildWhatsAppText(buildWAData());
    expect(txt).toContain("10-15d");
    expect(txt).toContain("Seña 60%");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §7  BOM completeness — all expected line items
// ═══════════════════════════════════════════════════════════════════════════

describe("BOM completeness", () => {
  beforeEach(() => setListaPrecios("web"));

  it("techo with all borders + canalón: BOM has gotero, canalón, soporte, T1 fijaciones", () => {
    const r = calcTechoCompleto({
      familia: "ISODEC_EPS", espesor: 100,
      largo: 6.5, ancho: 5.6, tipoEst: "metal",
      borders: {
        frente: "gotero_frontal",
        fondo: "gotero_frontal",
        latIzq: "gotero_lateral",
        latDer: "gotero_lateral",
      },
      opciones: { inclCanalon: true, inclGotSup: false, inclSell: true },
    });

    const labels = r.allItems.map(i => i.label || "");
    const skus = r.allItems.map(i => i.sku || "");

    expect(labels.some(l => l.includes("Frente"))).toBe(true);
    expect(labels.some(l => l.includes("Fondo"))).toBe(true);
    expect(labels.some(l => l.includes("Lat.Izq"))).toBe(true);
    expect(labels.some(l => l.includes("Lat.Der"))).toBe(true);
    expect(labels.some(l => l.includes("Canalón"))).toBe(true);
    expect(labels.some(l => l.includes("Soporte canalón"))).toBe(true);
    expect(skus.some(s => s === "tornillo_t1")).toBe(true);
  });

  it("pared BOM has perfiles U, esquineros, K2, G2, fijaciones, selladores", () => {
    const r = calcParedCompleto({
      familia: "ISOPANEL_EPS", espesor: 100,
      alto: 3.5, perimetro: 40,
      numEsqExt: 4, numEsqInt: 2,
      aberturas: [],
      tipoEst: "metal", inclSell: true, incl5852: true,
    });

    const labels = r.allItems.map(i => i.label || "");
    const skus = r.allItems.map(i => i.sku || "");

    expect(labels.some(l => l.includes("Perfil U base"))).toBe(true);
    expect(labels.some(l => l.includes("Perfil U coronación"))).toBe(true);
    expect(labels.some(l => l.includes("Esquinero exterior"))).toBe(true);
    expect(labels.some(l => l.includes("Esquinero interior"))).toBe(true);
    expect(skus).toContain("K2");
    expect(labels.some(l => l.includes("G2"))).toBe(true);
    expect(skus).toContain("anclaje_h");
    expect(skus).toContain("tornillo_t2");
    expect(skus).toContain("remache_pop");
    expect(skus).toContain("silicona");
    expect(skus).toContain("membrana");
    expect(skus).toContain("PLECHU98"); // 5852 aluminio
  });
});
