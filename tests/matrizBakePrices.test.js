/**
 * Coverage for the MATRIZ → constants bake (#1054) and the quote paths that bill those leaves.
 * Run: node tests/matrizBakePrices.test.js
 */
import {
  applyPriceEdits,
  collectConstantsPriceEdits,
  parseBakeNumber,
  wantedPricesFromCsvText,
} from "../scripts/bake-matriz-to-constants.mjs";
import {
  FIJACIONES,
  PERFIL_PARED,
  PERFIL_TECHO,
  SELLADORES,
  p,
  setListaPrecios,
} from "../src/data/constants.js";
import {
  calcFijacionesVarilla,
  calcPerfilesParedExtra,
  calcPerfilesU,
  calcSelladorPared,
  resolvePerfilPared,
  resolveSKU_techo,
} from "../src/utils/calculations.js";

let passed = 0;
let failed = 0;
function check(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}
function group(name, fn) {
  console.log(`\n— ${name}`);
  fn();
}

const prevLista = "web";

group("parseBakeNumber — coma decimal / US / vacío", () => {
  check(parseBakeNumber("32,84") === 32.84, '"32,84" → 32.84');
  check(parseBakeNumber("1.025,50") === 1025.5, '"1.025,50" → 1025.50 (europeo)');
  check(parseBakeNumber("1025.50") === 1025.5, '"1025.50" → 1025.50 (punto, sin miles)');
  check(parseBakeNumber(" 7.11 ") === 7.11, "trim + punto decimal");
  check(parseBakeNumber("-3") === -3, "negativo preservado (no se descarta)");
  check(parseBakeNumber("") === null, "vacío → null");
  check(parseBakeNumber("abc") === null, "no-número → null");
});

group("wantedPricesFromCsvText — aliases de columna", () => {
  const { wanted, error } = wantedPricesFromCsvText(
    "path,venta_local,venta_web,costo\nFIJACIONES.arandela_carrocero,2,\"0,66\",0.47\n",
  );
  check(error === null, "CSV con path ok");
  const row = wanted.get("FIJACIONES.arandela_carrocero");
  check(row?.venta === 2 && row?.web === 0.66 && row?.costo === 0.47, "venta_local + coma web");

  const missing = wantedPricesFromCsvText("sku,venta\nX,1\n");
  check(missing.error === "csv_missing_path", "sin columna path → error");
});

group("collectConstantsPriceEdits — path, campo independiente, comentarios", () => {
  const src = `
export const FIJACIONES = {
  arandela_carrocero: { venta: 0.7, web: 0.66, costo: 0.47 },
};
export const PERFIL_PARED = {
  perfil_u: { ISOPANEL: { 250: { sku: "PU200MM", venta: 17.68, web: 20.62, costo: 14.73 } } },
  perfil_5852: { _all: { sku: "PA5852", venta: 64.19, web: 64.19, costo: 53.49 } },
};
export const C = { primary: 5 };
// venta: 999 comment must not bake
`;
  const wanted = new Map([
    ["FIJACIONES.arandela_carrocero", { venta: 2, web: 0.66, costo: 0.47 }],
    ["PERFIL_PARED.perfil_u.ISOPANEL.250", { venta: 21.25, web: 24.79, costo: 17.71 }],
    ["PERFIL_PARED.perfil_5852._all", { venta: 64.19, web: 74.89, costo: 53.49 }],
    ["C.primary", { venta: 9, web: 9, costo: 9 }],
  ]);
  const { edits, notFound } = collectConstantsPriceEdits(src, wanted);
  const by = (path, field) => edits.find((e) => e.path === path && e.field === field);

  check(by("FIJACIONES.arandela_carrocero", "venta")?.to === 2, "venta 0.7→2");
  check(!by("FIJACIONES.arandela_carrocero", "web"), "web ya igual → sin edit");
  check(by("PERFIL_PARED.perfil_u.ISOPANEL.250", "venta")?.from === 17.68, "path numérico 250");
  check(by("PERFIL_PARED.perfil_5852._all", "web")?.to === 74.89, "_all web independiente de venta");
  check(!edits.some((e) => e.from === 999), "comentario // venta: 999 no se edita");
  check(notFound.includes("C.primary"), "root no-precio no se ve (C queda notFound)");

  const out = applyPriceEdits(src, edits);
  check(out.includes("venta: 2") && out.includes("web: 74.89"), "apply escribe ambos campos");
  check(out.includes('sku: "PU200MM"') && out.includes('sku: "PA5852"'), "sku / label intactos");
});

group("#1054 baked leaves — constants.js", () => {
  const ac = FIJACIONES.arandela_carrocero;
  check(ac.venta === 2 && ac.web === 0.66 && ac.costo === 0.47, "AC38G arandela_carrocero venta 2 / web 0.66");
  const ap = FIJACIONES.arandela_plana;
  check(ap.venta === 0.24 && ap.web === 0.12 && ap.costo === 0.09, "APHG38 arandela_plana venta 0.24 / web 0.12");
  const sn = SELLADORES.silicona_300_neutra;
  check(sn.venta === 7.11 && sn.web === 7.11 && sn.costo === 3, "SN300B silicona_300_neutra web=venta 7.11");
  const gl = PERFIL_TECHO.gotero_lateral_camara.ISODEC[250];
  check(gl.sku === "GLDCAM250" && gl.venta === 37.3 && gl.web === 43.51 && gl.costo === 31.08, "PGLC250 / GLDCAM250 37.3 / 43.51 / 31.08");
  const u200 = PERFIL_PARED.perfil_u.ISOPANEL[200];
  const u250 = PERFIL_PARED.perfil_u.ISOPANEL[250];
  check(u200.sku === "PU200MM" && u250.sku === "PU200MM", "PU250 conserva SKU de catálogo PU200MM");
  check(u200.venta === 17.68 && u200.web === 20.62, "PU200MM 200 mm no se movió");
  check(u250.venta === 21.25 && u250.web === 24.79 && u250.costo === 17.71, "PU250MM precios en hoja 250");
  check(Math.abs(u250.venta - u200.venta) > 1, "250 mm ya no comparte precio con 200 mm");
  const a5852 = PERFIL_PARED.perfil_5852._all;
  check(a5852.sku === "PA5852" && a5852.venta === 64.19 && a5852.web === 74.89 && a5852.costo === 53.49, "PA5852 venta 64.19 / web 74.89");
});

group("p() lista activa — venta ≠ web no se mezclan", () => {
  setListaPrecios("venta");
  check(p(FIJACIONES.arandela_carrocero) === 2, "lista venta → arandela_carrocero 2");
  check(p(PERFIL_PARED.perfil_5852._all) === 64.19, "lista venta → PA5852 64.19");
  setListaPrecios("web");
  check(p(FIJACIONES.arandela_carrocero) === 0.66, "lista web → arandela_carrocero 0.66");
  check(p(PERFIL_PARED.perfil_5852._all) === 74.89, "lista web → PA5852 74.89");
  check(p(SELLADORES.silicona_300_neutra) === 7.11, "lista web → silicona_300 7.11 (ya no 4.20)");
});

group("quote engine bills baked unit prices", () => {
  setListaPrecios("venta");
  const fijV = calcFijacionesVarilla(2, 3, 6, "metal", 0, 0, 0, { overridePuntosFijacion: 4 });
  const arandV = fijV.items.find((i) => i.sku === "arandela_carrocero");
  const planaV = fijV.items.find((i) => i.sku === "arandela_plana");
  check(arandV?.pu === 2 && arandV?.total === 8, "calcFijacionesVarilla venta: carrocero pu 2 × 4");
  check(planaV?.pu === 0.24 && planaV?.total === 0.96, "calcFijacionesVarilla venta: plana pu 0.24 × 4");

  setListaPrecios("web");
  const fijW = calcFijacionesVarilla(2, 3, 6, "metal", 0, 0, 0, { overridePuntosFijacion: 4 });
  const arandW = fijW.items.find((i) => i.sku === "arandela_carrocero");
  check(arandW?.pu === 0.66 && arandW?.total === 2.64, "calcFijacionesVarilla web: carrocero pu 0.66 × 4");

  const camara = resolveSKU_techo("gotero_lateral_camara", "ISODEC", 250);
  check(camara?.sku === "GLDCAM250" && camara.web === 43.51 && camara.venta === 37.3, "resolveSKU_techo ISODEC 250 → GLDCAM250 bake");

  const u200 = resolvePerfilPared("perfil_u", "ISOPANEL", 200);
  const u250 = resolvePerfilPared("perfil_u", "ISOPANEL", 250);
  check(u200?.sku === "PU200MM" && u250?.sku === "PU200MM", "resolvePerfilPared 200/250 mismo SKU");
  check(u250?.web === 24.79 && u200?.web === 20.62, "resolvePerfilPared 250 usa precio PU250MM");

  setListaPrecios("web");
  const u200b = calcPerfilesU({ fam: "ISOPANEL" }, 200, 6);
  const u250b = calcPerfilesU({ fam: "ISOPANEL" }, 250, 6);
  check(u200b.items[0]?.pu === 20.62 && u200b.items[0]?.cant === 2, "calcPerfilesU 200 mm web 20.62 × 2");
  check(u250b.items[0]?.sku === "PU200MM" && u250b.items[0]?.pu === 24.79 && u250b.items[0]?.total === 49.58, "calcPerfilesU 250 mm web 24.79 × 2 (no copia 200 mm)");

  setListaPrecios("web");
  const extraW = calcPerfilesParedExtra({ au: 1.14, fam: "ISOPANEL" }, 100, 6, 3, { incl5852: true });
  const a5852w = extraW.items.find((i) => i.sku === "PA5852");
  check(a5852w?.pu === 74.89, "calcPerfilesParedExtra web → PA5852 74.89");
  setListaPrecios("venta");
  const extraV = calcPerfilesParedExtra({ au: 1.14, fam: "ISOPANEL" }, 100, 6, 3, { incl5852: true });
  const a5852v = extraV.items.find((i) => i.sku === "PA5852");
  check(a5852v?.pu === 64.19, "calcPerfilesParedExtra venta → PA5852 64.19 (web no pisa venta)");

  setListaPrecios("web");
  const sell = calcSelladorPared(10, 3, 3);
  const sil300 = sell.items.find((i) => i.sku === "silicona_300_neutra");
  check(sil300?.pu === 7.11, "calcSelladorPared web → silicona_300_neutra 7.11");
});

setListaPrecios(prevLista);

console.log(`\nmatrizBakePrices: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
