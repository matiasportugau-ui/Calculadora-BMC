// ═══════════════════════════════════════════════════════════════════════════
// Engine Calculation Tests — Panelin Calculadora BMC v3.0
// Tests the REAL calculation functions from src/utils/calculations.js
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from "vitest";

import {
  setListaPrecios, p, IVA,
  PANELS_TECHO, PANELS_PARED, FIJACIONES, SELLADORES,
} from "../src/data/constants.js";

import {
  calcPanelesTecho,
  calcPanelesPared,
  calcAutoportancia,
  calcFijacionesVarilla,
  calcFijacionesCaballete,
  calcFijacionesPared,
  calcPerfileriaTecho,
  calcSelladoresTecho,
  calcSelladorPared,
  calcPerfilesParedExtra,
  calcTotalesSinIVA,
  calcTechoCompleto,
  calcParedCompleto,
} from "../src/utils/calculations.js";

// ── Helpers ──────────────────────────────────────────────────────────────────
const approx = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;

// ═══════════════════════════════════════════════════════════════════════════
// §1  PRICING ENGINE  — p() and IVA
// ═══════════════════════════════════════════════════════════════════════════

describe("Pricing engine — p()", () => {
  beforeEach(() => setListaPrecios("web"));

  it("returns web price when LISTA_ACTIVA=web", () => {
    const item = { venta: 37.76, web: 45.97 };
    expect(p(item)).toBe(45.97);
  });

  it("returns venta price when LISTA_ACTIVA=venta", () => {
    setListaPrecios("venta");
    const item = { venta: 37.76, web: 45.97 };
    expect(p(item)).toBe(37.76);
  });

  it("falls back to web when venta missing (lista=venta)", () => {
    setListaPrecios("venta");
    expect(p({ web: 10.0 })).toBe(10.0);
  });

  it("falls back to venta when web missing (lista=web)", () => {
    expect(p({ venta: 7.5 })).toBe(7.5);
  });

  it("returns 0 for null/undefined item", () => {
    expect(p(null)).toBe(0);
    expect(p(undefined)).toBe(0);
  });

  it("returns 0 for empty object", () => {
    expect(p({})).toBe(0);
  });
});

describe("IVA constant", () => {
  it("IVA is 22%", () => {
    expect(IVA).toBe(0.22);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §2  PANEL TECHO CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

describe("calcPanelesTecho", () => {
  const panel = PANELS_TECHO.ISODEC_EPS;
  beforeEach(() => setListaPrecios("web"));

  it("calculates correct quantity for 5.6m width (au=1.12)", () => {
    const r = calcPanelesTecho(panel, 100, 6.5, 5.6);
    expect(r.cantPaneles).toBe(5); // ceil(5.6 / 1.12) = 5
  });

  it("calculates correct area", () => {
    const r = calcPanelesTecho(panel, 100, 6.5, 5.6);
    expect(r.areaTotal).toBeCloseTo(5 * 6.5 * 1.12, 1); // 36.40
  });

  it("calculates cost using web price", () => {
    const r = calcPanelesTecho(panel, 100, 6.5, 5.6);
    const expectedCost = +(45.97 * r.areaTotal).toFixed(2);
    expect(r.costoPaneles).toBeCloseTo(expectedCost, 0);
  });

  it("returns null for unknown espesor", () => {
    const r = calcPanelesTecho(panel, 999, 6.5, 5.6);
    expect(r).toBeNull();
  });

  it("handles very small ancho (single panel)", () => {
    const r = calcPanelesTecho(panel, 100, 5.0, 0.5);
    expect(r.cantPaneles).toBe(1);
    expect(r.areaTotal).toBeCloseTo(1 * 5.0 * 1.12, 2);
  });

  it("calculates correctly with venta prices", () => {
    setListaPrecios("venta");
    const r = calcPanelesTecho(panel, 100, 6.5, 5.6);
    expect(r.precioM2).toBe(37.76);
    expect(r.costoPaneles).toBeCloseTo(37.76 * r.areaTotal, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §3  PANEL PARED CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

describe("calcPanelesPared", () => {
  const panel = PANELS_PARED.ISOPANEL_EPS;
  beforeEach(() => setListaPrecios("web"));

  it("calculates correct panel count for 40m perimeter (au=1.14)", () => {
    const r = calcPanelesPared(panel, 100, 3.5, 40, []);
    expect(r.cantPaneles).toBe(Math.ceil(40 / 1.14)); // 36
  });

  it("calculates correct areaBruta", () => {
    const r = calcPanelesPared(panel, 100, 3.5, 40, []);
    expect(r.areaBruta).toBeCloseTo(36 * 3.5 * 1.14, 1); // ~143.64
  });

  it("subtracts aperture area correctly", () => {
    const aberturas = [
      { ancho: 0.9, alto: 2.1, cant: 1 },
      { ancho: 1.2, alto: 1.0, cant: 2 },
    ];
    const r = calcPanelesPared(panel, 100, 3.5, 40, aberturas);
    const expectedAberturas = 0.9 * 2.1 * 1 + 1.2 * 1.0 * 2; // 4.29
    expect(r.areaAberturas).toBeCloseTo(expectedAberturas, 2);
    expect(r.areaNeta).toBeCloseTo(r.areaBruta - expectedAberturas, 1);
  });

  it("areaNeta never goes negative", () => {
    const hugeAperture = [{ ancho: 100, alto: 100, cant: 1 }];
    const r = calcPanelesPared(panel, 100, 3.5, 4, hugeAperture);
    expect(r.areaNeta).toBeGreaterThanOrEqual(0);
  });

  it("handles empty aberturas array", () => {
    const r = calcPanelesPared(panel, 100, 3.5, 40, []);
    expect(r.areaAberturas).toBe(0);
    expect(r.areaNeta).toBe(r.areaBruta);
  });

  it("returns null for unknown espesor", () => {
    const r = calcPanelesPared(panel, 999, 3.5, 40, []);
    expect(r).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §4  AUTOPORTANCIA — boundary conditions
// ═══════════════════════════════════════════════════════════════════════════

describe("calcAutoportancia", () => {
  const panel = PANELS_TECHO.ISODEC_EPS; // esp[100].ap = 5.5

  it("ok=true when largo <= maxSpan (exactly at limit)", () => {
    const r = calcAutoportancia(panel, 100, 5.5);
    expect(r.ok).toBe(true);
    expect(r.maxSpan).toBe(5.5);
  });

  it("ok=false when largo > maxSpan (just over)", () => {
    const r = calcAutoportancia(panel, 100, 5.6);
    expect(r.ok).toBe(false);
  });

  it("calculates correct number of apoyos when exceeding", () => {
    const r = calcAutoportancia(panel, 100, 6.5);
    // ceil(6.5/5.5 + 1) = ceil(2.18) = 3
    expect(r.apoyos).toBe(3);
  });

  it("handles panel without autoportancia (ap=null)", () => {
    const paredPanel = PANELS_PARED.ISOPANEL_EPS;
    const r = calcAutoportancia(paredPanel, 100, 50);
    expect(r.ok).toBe(true);
    expect(r.maxSpan).toBeNull();
    expect(r.apoyos).toBeNull();
  });

  it("checks largoMinOK boundary", () => {
    const r = calcAutoportancia(panel, 100, 2.0); // lmin=2.3
    expect(r.largoMinOK).toBe(false);
  });

  it("checks largoMaxOK boundary", () => {
    const r = calcAutoportancia(panel, 100, 15); // lmax=14
    expect(r.largoMaxOK).toBe(false);
  });

  it("largo within [lmin, lmax] passes both checks", () => {
    const r = calcAutoportancia(panel, 100, 5.0);
    expect(r.largoMinOK).toBe(true);
    expect(r.largoMaxOK).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §5  FIJACIONES TECHO — varilla/tuerca system
// ═══════════════════════════════════════════════════════════════════════════

describe("calcFijacionesVarilla", () => {
  beforeEach(() => setListaPrecios("web"));

  it("calculates puntos de fijación correctly", () => {
    // cantP=5, apoyos=3, largo=6.5, metal
    const r = calcFijacionesVarilla(5, 3, 6.5, "metal", 0);
    const expected = Math.ceil(((5 * 3) * 2) + (6.5 * 2 / 2.5)); // ceil(30 + 5.2) = 36
    expect(r.puntosFijacion).toBe(expected);
  });

  it("produces expected varilla count", () => {
    const r = calcFijacionesVarilla(5, 3, 6.5, "metal", 0);
    expect(Math.ceil(r.puntosFijacion / 4)).toBe(9);
  });

  it("all items have positive totals", () => {
    const r = calcFijacionesVarilla(5, 3, 6.5, "metal", 0);
    for (const item of r.items) {
      expect(item.total).toBeGreaterThanOrEqual(0);
      expect(item.cant).toBeGreaterThan(0);
    }
  });

  it("includes taco_expansivo only for hormigón", () => {
    const metal = calcFijacionesVarilla(5, 3, 6.5, "metal", 0);
    const horm = calcFijacionesVarilla(5, 3, 6.5, "hormigon", 0);
    expect(metal.items.some(i => i.sku === "taco_expansivo")).toBe(false);
    expect(horm.items.some(i => i.sku === "taco_expansivo")).toBe(true);
  });

  it("mixto: distributes points between metal and hormigon", () => {
    const r = calcFijacionesVarilla(5, 3, 6.5, "mixto", 10);
    expect(r.items.some(i => i.sku === "taco_expansivo")).toBe(true);
    const tacoItem = r.items.find(i => i.sku === "taco_expansivo");
    expect(tacoItem.cant).toBe(10); // ptsHorm capped at puntosFijacion
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §6  FIJACIONES TECHO — caballete system (ISOROOF)
// ═══════════════════════════════════════════════════════════════════════════

describe("calcFijacionesCaballete", () => {
  beforeEach(() => setListaPrecios("web"));

  it("produces positive integer caballete count", () => {
    const r = calcFijacionesCaballete(5, 6.5);
    expect(r.puntosFijacion).toBeGreaterThan(0);
    expect(Number.isInteger(r.puntosFijacion)).toBe(true);
  });

  it("tornillos aguja = caballetes × 2, packaged in x100", () => {
    const r = calcFijacionesCaballete(5, 6.5);
    const agujaItem = r.items.find(i => i.sku === "tornillo_aguja");
    expect(agujaItem).toBeDefined();
    expect(agujaItem.cant).toBe(Math.ceil(r.puntosFijacion * 2 / 100));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §7  FIJACIONES PARED — anclaje+T2+remache system (NO varilla)
// ═══════════════════════════════════════════════════════════════════════════

describe("calcFijacionesPared", () => {
  const panel = PANELS_PARED.ISOPANEL_EPS;
  beforeEach(() => setListaPrecios("web"));

  it("produces anclajes, tornillos T2, and remaches — no varilla/tuerca", () => {
    const r = calcFijacionesPared(panel, 100, 36, 3.5, 40, "metal");
    const skus = r.items.map(i => i.sku);
    expect(skus).toContain("anclaje_h");
    expect(skus).toContain("tornillo_t2");
    expect(skus).toContain("remache_pop");
    expect(skus).not.toContain("varilla_38");
    expect(skus).not.toContain("tuerca_38");
  });

  it("anclajes = ceil(anchoTotal / 0.30)", () => {
    const r = calcFijacionesPared(panel, 100, 36, 3.5, 40, "metal");
    const anchoTotal = 36 * panel.au;
    const expected = Math.ceil(anchoTotal / 0.30);
    const anclajeItem = r.items.find(i => i.sku === "anclaje_h");
    expect(anclajeItem.cant).toBe(expected);
  });

  it("does not include T2 for non-metal structure", () => {
    const r = calcFijacionesPared(panel, 100, 36, 3.5, 40, "hormigon");
    const skus = r.items.map(i => i.sku);
    expect(skus).not.toContain("tornillo_t2");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §8  PERFILERÍA TECHO — soporte canalón corrected formula
// ═══════════════════════════════════════════════════════════════════════════

describe("calcPerfileriaTecho — soporte canalón", () => {
  beforeEach(() => setListaPrecios("web"));

  it("soporte canalón barras for 5 panels: ml=(5+1)*0.30=1.80, barras=ceil(1.80/3.0)=1", () => {
    const borders = { frente: "none", fondo: "none", latIzq: "none", latDer: "none" };
    const opciones = { inclCanalon: true, inclGotSup: false, inclSell: true };
    const r = calcPerfileriaTecho(borders, 5, 6.5, 5 * 1.12, "ISODEC", 100, opciones);
    const sopItem = r.items.find(i => i.tipo === "soporte_canalon");
    expect(sopItem).toBeDefined();
    expect(sopItem.cant).toBe(1);
  });

  it("soporte canalón barras for 20 panels: ml=(20+1)*0.30=6.30, barras=ceil(6.30/3.0)=3", () => {
    const borders = { frente: "none", fondo: "none", latIzq: "none", latDer: "none" };
    const opciones = { inclCanalon: true, inclGotSup: false, inclSell: true };
    const r = calcPerfileriaTecho(borders, 20, 6.5, 20 * 1.12, "ISODEC", 100, opciones);
    const sopItem = r.items.find(i => i.tipo === "soporte_canalon");
    expect(sopItem).toBeDefined();
    expect(sopItem.cant).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §9  SELLADORES TECHO
// ═══════════════════════════════════════════════════════════════════════════

describe("calcSelladoresTecho", () => {
  beforeEach(() => setListaPrecios("web"));

  it("siliconas = ceil(cantP * 0.5)", () => {
    const r = calcSelladoresTecho(10);
    const silItem = r.items.find(i => i.sku === "silicona");
    expect(silItem.cant).toBe(5);
  });

  it("cintas = ceil(cantP / 10)", () => {
    const r = calcSelladoresTecho(10);
    const cintaItem = r.items.find(i => i.sku === "cinta_butilo");
    expect(cintaItem.cant).toBe(1);
  });

  it("20 panels: 10 siliconas, 2 cintas", () => {
    const r = calcSelladoresTecho(20);
    expect(r.items.find(i => i.sku === "silicona").cant).toBe(10);
    expect(r.items.find(i => i.sku === "cinta_butilo").cant).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §10  SELLADOR PARED
// ═══════════════════════════════════════════════════════════════════════════

describe("calcSelladorPared", () => {
  beforeEach(() => setListaPrecios("web"));

  it("membrana rollos = ceil(perimetro / 10)", () => {
    const r = calcSelladorPared(40, 36, 3.5);
    const memItem = r.items.find(i => i.sku === "membrana");
    expect(memItem.cant).toBe(4); // ceil(40/10)
  });

  it("espuma PU = rollosMembrana × 2", () => {
    const r = calcSelladorPared(40, 36, 3.5);
    const memItem = r.items.find(i => i.sku === "membrana");
    const espItem = r.items.find(i => i.sku === "espuma_pu");
    expect(espItem.cant).toBe(memItem.cant * 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §11  PERFILES PARED EXTRA — K2, G2
// ═══════════════════════════════════════════════════════════════════════════

describe("calcPerfilesParedExtra — K2 and G2", () => {
  const panel = PANELS_PARED.ISOPANEL_EPS;
  beforeEach(() => setListaPrecios("web"));

  it("K2 juntas for 36 panels, 3.5m alto: (36-1)*ceil(3.5/3.0) = 35*2 = 70", () => {
    const r = calcPerfilesParedExtra(panel, 100, 36, 3.5, {});
    const k2Item = r.items.find(i => i.sku === "K2");
    expect(k2Item.cant).toBe(70);
  });

  it("G2 juntas for 36 panels, 3.5m alto: (36-1)*ceil(3.5/3.0) = 70", () => {
    const r = calcPerfilesParedExtra(panel, 100, 36, 3.5, {});
    const g2Item = r.items.find(i => i.label.includes("G2"));
    expect(g2Item.cant).toBe(70);
  });

  it("no K2/G2 for single panel (no joints)", () => {
    const r = calcPerfilesParedExtra(panel, 100, 1, 3.5, {});
    expect(r.items.length).toBe(0);
    expect(r.total).toBe(0);
  });

  it("5852 aluminio only included when opts.incl5852=true", () => {
    const without = calcPerfilesParedExtra(panel, 100, 10, 3.5, {});
    const with5852 = calcPerfilesParedExtra(panel, 100, 10, 3.5, { incl5852: true });
    expect(without.items.some(i => i.sku === "PLECHU98")).toBe(false);
    expect(with5852.items.some(i => i.sku === "PLECHU98")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §12  TOTALES SIN IVA
// ═══════════════════════════════════════════════════════════════════════════

describe("calcTotalesSinIVA", () => {
  it("sums totals, applies 22% IVA", () => {
    const items = [
      { total: 500 },
      { total: 300 },
      { total: 200 },
    ];
    const r = calcTotalesSinIVA(items);
    expect(r.subtotalSinIVA).toBe(1000);
    expect(r.iva).toBeCloseTo(220, 1);
    expect(r.totalFinal).toBeCloseTo(1220, 1);
  });

  it("handles empty array", () => {
    const r = calcTotalesSinIVA([]);
    expect(r.subtotalSinIVA).toBe(0);
    expect(r.iva).toBe(0);
    expect(r.totalFinal).toBe(0);
  });

  it("handles items with undefined total", () => {
    const items = [{ total: 100 }, { total: undefined }, { total: 50 }];
    const r = calcTotalesSinIVA(items);
    expect(r.subtotalSinIVA).toBe(150);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §13  INTEGRATION — calcTechoCompleto
// ═══════════════════════════════════════════════════════════════════════════

describe("calcTechoCompleto — integration", () => {
  beforeEach(() => setListaPrecios("web"));

  it("returns error for unknown familia", () => {
    const r = calcTechoCompleto({
      familia: "NONEXISTENT", espesor: 100,
      largo: 5, ancho: 5, tipoEst: "metal",
    });
    expect(r.error).toMatch(/no encontrada/i);
  });

  it("returns error for unknown espesor", () => {
    const r = calcTechoCompleto({
      familia: "ISODEC_EPS", espesor: 999,
      largo: 5, ancho: 5, tipoEst: "metal",
    });
    expect(r.error).toMatch(/no disponible/i);
  });

  it("ISODEC EPS 100mm, 5.0×5.6m: correct panels and area", () => {
    const r = calcTechoCompleto({
      familia: "ISODEC_EPS", espesor: 100,
      largo: 5.0, ancho: 5.6, tipoEst: "metal", ptsHorm: 0,
      borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
      opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
      color: "Blanco",
    });
    expect(r.error).toBeUndefined();
    expect(r.paneles.cantPaneles).toBe(5);
    expect(r.paneles.areaTotal).toBeCloseTo(28.0, 0);
    expect(r.autoportancia.ok).toBe(true);
  });

  it("allItems is a non-empty array with valid totals", () => {
    const r = calcTechoCompleto({
      familia: "ISODEC_EPS", espesor: 100,
      largo: 5.0, ancho: 5.6, tipoEst: "metal",
      borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
      opciones: { inclSell: true },
    });
    expect(Array.isArray(r.allItems)).toBe(true);
    expect(r.allItems.length).toBeGreaterThan(0);
    for (const item of r.allItems) {
      expect(typeof item.total).toBe("number");
      expect(item.total).toBeGreaterThanOrEqual(0);
    }
  });

  it("totales has positive subtotalSinIVA", () => {
    const r = calcTechoCompleto({
      familia: "ISODEC_EPS", espesor: 100,
      largo: 5.0, ancho: 5.6, tipoEst: "metal",
      borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
      opciones: { inclSell: true },
    });
    expect(r.totales.subtotalSinIVA).toBeGreaterThan(0);
  });

  it("warns when color is not available", () => {
    const r = calcTechoCompleto({
      familia: "ISODEC_EPS", espesor: 100,
      largo: 5.0, ancho: 5.6, tipoEst: "metal",
      borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
      opciones: { inclSell: true },
      color: "Azul",
    });
    expect(r.warnings.some(w => w.includes("Azul"))).toBe(true);
  });

  it("warns when largo exceeds autoportancia", () => {
    const r = calcTechoCompleto({
      familia: "ISODEC_EPS", espesor: 100,
      largo: 12.0, ancho: 5.6, tipoEst: "metal",
      borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
      opciones: { inclSell: true },
    });
    expect(r.warnings.some(w => w.includes("excede") || w.includes("autoportancia"))).toBe(true);
  });

  it("selladores omitted when inclSell=false", () => {
    const r = calcTechoCompleto({
      familia: "ISODEC_EPS", espesor: 100,
      largo: 5.0, ancho: 5.6, tipoEst: "metal",
      borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
      opciones: { inclSell: false },
    });
    expect(r.selladores.items.length).toBe(0);
    expect(r.allItems.some(i => i.sku === "silicona")).toBe(false);
  });

  it("uses caballete system for ISOROOF (not varilla)", () => {
    const r = calcTechoCompleto({
      familia: "ISOROOF_3G", espesor: 50,
      largo: 5.0, ancho: 5.0, tipoEst: "metal",
      borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
      opciones: { inclSell: true },
    });
    expect(r.allItems.some(i => i.sku === "caballete")).toBe(true);
    expect(r.allItems.some(i => i.sku === "varilla_38")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §14  INTEGRATION — calcParedCompleto
// ═══════════════════════════════════════════════════════════════════════════

describe("calcParedCompleto — integration", () => {
  beforeEach(() => setListaPrecios("web"));

  it("returns error for unknown familia", () => {
    const r = calcParedCompleto({
      familia: "NONEXISTENT", espesor: 100,
      alto: 3.5, perimetro: 40,
    });
    expect(r.error).toMatch(/no encontrada/i);
  });

  it("returns error for unknown espesor", () => {
    const r = calcParedCompleto({
      familia: "ISOPANEL_EPS", espesor: 777,
      alto: 3.5, perimetro: 40,
    });
    expect(r.error).toMatch(/no disponible/i);
  });

  it("ISOPANEL EPS 100mm, 3.5m × 40m: correct calculation", () => {
    const r = calcParedCompleto({
      familia: "ISOPANEL_EPS", espesor: 100,
      alto: 3.5, perimetro: 40,
      numEsqExt: 4, numEsqInt: 0,
      aberturas: [
        { ancho: 0.9, alto: 2.1, cant: 1 },
        { ancho: 1.2, alto: 1.0, cant: 2 },
      ],
      tipoEst: "metal", inclSell: true, incl5852: false,
    });
    expect(r.error).toBeUndefined();
    expect(r.paneles.cantPaneles).toBe(36);
    expect(r.paneles.areaBruta).toBeCloseTo(143.64, 0);
    expect(r.paneles.areaAberturas).toBeCloseTo(4.29, 1);
    expect(r.paneles.areaNeta).toBeCloseTo(139.35, 0);
  });

  it("allItems is non-empty and totales positive", () => {
    const r = calcParedCompleto({
      familia: "ISOPANEL_EPS", espesor: 100,
      alto: 3.5, perimetro: 40,
      numEsqExt: 4, numEsqInt: 0,
      aberturas: [],
      tipoEst: "metal", inclSell: true,
    });
    expect(r.allItems.length).toBeGreaterThan(0);
    expect(r.totales.subtotalSinIVA).toBeGreaterThan(0);
  });

  it("warns for 50mm panel (interior only)", () => {
    const r = calcParedCompleto({
      familia: "ISOPANEL_EPS", espesor: 50,
      alto: 3.5, perimetro: 20,
      numEsqExt: 4, tipoEst: "metal",
    });
    expect(r.warnings.some(w => w.includes("50mm") || w.includes("subdivisiones"))).toBe(true);
  });

  it("warns when alto exceeds lmax", () => {
    const r = calcParedCompleto({
      familia: "ISOPANEL_EPS", espesor: 100,
      alto: 15, perimetro: 20,
      numEsqExt: 4, tipoEst: "metal",
    });
    expect(r.warnings.some(w => w.includes("máximo"))).toBe(true);
  });

  it("BOM includes perfiles U (base + coronación)", () => {
    const r = calcParedCompleto({
      familia: "ISOPANEL_EPS", espesor: 100,
      alto: 3.5, perimetro: 40,
      numEsqExt: 4, tipoEst: "metal", inclSell: true,
    });
    expect(r.perfilesU.items.length).toBe(2); // base + coronación
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §15  CROSS-SCENARIO CONSISTENCY — same panel, same price
// ═══════════════════════════════════════════════════════════════════════════

describe("Cross-scenario consistency", () => {
  beforeEach(() => setListaPrecios("web"));

  it("ISODEC_EPS 100mm precioM2 is identical regardless of dimensions", () => {
    const r1 = calcTechoCompleto({
      familia: "ISODEC_EPS", espesor: 100,
      largo: 5.0, ancho: 5.0, tipoEst: "metal",
      borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
      opciones: { inclSell: false },
    });
    const r2 = calcTechoCompleto({
      familia: "ISODEC_EPS", espesor: 100,
      largo: 10.0, ancho: 10.0, tipoEst: "metal",
      borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
      opciones: { inclSell: false },
    });
    expect(r1.paneles.precioM2).toBe(r2.paneles.precioM2);
    expect(r1.paneles.precioM2).toBe(45.97);
  });

  it("venta vs web price ratio is consistent across panels", () => {
    setListaPrecios("web");
    const webPrice = p(PANELS_TECHO.ISODEC_EPS.esp[100]);
    setListaPrecios("venta");
    const ventaPrice = p(PANELS_TECHO.ISODEC_EPS.esp[100]);
    expect(ventaPrice).toBeLessThan(webPrice);
    expect(ventaPrice).toBe(37.76);
    expect(webPrice).toBe(45.97);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §16  REGRESSION — LISTA_ACTIVA module-level mutable state
// ═══════════════════════════════════════════════════════════════════════════

describe("Regression — LISTA_ACTIVA side-effect", () => {
  it("setListaPrecios changes p() behavior globally", () => {
    setListaPrecios("web");
    const webP = p(PANELS_TECHO.ISODEC_EPS.esp[100]);

    setListaPrecios("venta");
    const ventaP = p(PANELS_TECHO.ISODEC_EPS.esp[100]);

    expect(webP).not.toBe(ventaP);
    expect(webP).toBe(45.97);
    expect(ventaP).toBe(37.76);
  });

  it("calculations use the LISTA_ACTIVA set before they run", () => {
    setListaPrecios("venta");
    const rVenta = calcTechoCompleto({
      familia: "ISODEC_EPS", espesor: 100,
      largo: 5, ancho: 5, tipoEst: "metal",
      borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
      opciones: { inclSell: false },
    });

    setListaPrecios("web");
    const rWeb = calcTechoCompleto({
      familia: "ISODEC_EPS", espesor: 100,
      largo: 5, ancho: 5, tipoEst: "metal",
      borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
      opciones: { inclSell: false },
    });

    expect(rVenta.totales.subtotalSinIVA).toBeLessThan(rWeb.totales.subtotalSinIVA);
  });
});
