/**
 * Agent/voice buildQuote gate: validateAndPreviewQuote must reject bad
 * payloads before they reach the calculator, and preview money must stay
 * internally consistent (IVA, lista web vs venta).
 *
 * Run: node tests/quotePayloadValidator.test.js
 */
import { validateAndPreviewQuote } from "../server/lib/quotePayloadValidator.js";
import { LISTA_ACTIVA, setListaPrecios } from "../src/data/constants.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
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

const TECHO_OK = {
  familia: "ISODEC_EPS",
  espesor: 100,
  largo: 20,
  ancho: 10,
  tipoEst: "metal",
};

const PARED_OK = {
  familia: "ISOPANEL_EPS",
  espesor: 100,
  alto: 3,
  perimetro: 40,
};

const prevLista = LISTA_ACTIVA;
setListaPrecios("web");

group("reject invalid envelope", () => {
  const none = validateAndPreviewQuote(null);
  assert(none.valid === false && none.errors.some((e) => /scenario inválido/.test(e)), "null payload");

  const badSc = validateAndPreviewQuote({ scenario: "presupuesto_libre", techo: TECHO_OK });
  assert(badSc.valid === false && badSc.errors.some((e) => /presupuesto_libre/.test(e)), "presupuesto_libre is not a buildQuote scenario");

  const badLp = validateAndPreviewQuote({ scenario: "solo_techo", listaPrecios: "WEB", techo: TECHO_OK });
  assert(badLp.valid === false && badLp.errors.some((e) => /listaPrecios inválida/.test(e)), "lista WEB (wrong case)");

  const both = validateAndPreviewQuote({ scenario: "nope", listaPrecios: "lista_costo" });
  assert(
    both.valid === false && both.errors.length >= 2,
    "invalid scenario + lista both reported",
  );
});

group("reject empty / uncomputable BOM", () => {
  const noFam = validateAndPreviewQuote({ scenario: "solo_techo", techo: { largo: 20, ancho: 10 } });
  assert(noFam.valid === false && !noFam.preview, "solo_techo without familia/espesor");

  const zero = validateAndPreviewQuote({
    scenario: "solo_techo",
    techo: { familia: "ISODEC_EPS", espesor: 100, largo: 0, ancho: 0 },
  });
  assert(zero.valid === false && zero.errors.some((e) => /BOM resultó vacío|null/.test(e)), "zero dimensions → empty BOM");

  const unknown = validateAndPreviewQuote({
    scenario: "solo_techo",
    techo: { familia: "NO_EXISTE", espesor: 100, largo: 20, ancho: 10 },
  });
  assert(unknown.valid === false, "unknown familia rejected");
});

group("solo_techo preview is money-safe", () => {
  const web = validateAndPreviewQuote({
    scenario: "solo_techo",
    listaPrecios: "web",
    techo: TECHO_OK,
  });
  assert(web.valid === true, "ISODEC EPS 100 20×10 web valid");
  assert(web.preview.totalItems > 0, "has BOM lines");
  assert(web.preview.subtotalUSD > 0, "subtotal > 0");
  assert(web.preview.totalConIVA > web.preview.subtotalUSD, "IVA applied once on total");
  const ivaRatio = web.preview.totalConIVA / web.preview.subtotalUSD;
  assert(ivaRatio > 1.21 && ivaRatio < 1.23, "total ≈ subtotal × 1.22");

  const pir = { familia: "ISODEC_PIR", espesor: 50, largo: 20, ancho: 10, tipoEst: "metal" };
  const pirWeb = validateAndPreviewQuote({ scenario: "solo_techo", listaPrecios: "web", techo: pir });
  const pirVenta = validateAndPreviewQuote({ scenario: "solo_techo", listaPrecios: "venta", techo: pir });
  assert(pirWeb.valid && pirVenta.valid, "ISODEC PIR 50 computes on both listas");
  assert(
    pirVenta.preview.subtotalUSD < pirWeb.preview.subtotalUSD,
    "venta cheaper than web on PIR 50 (panel web≠venta)",
  );
});

group("solo_fachada + techo_fachada + camara_frig", () => {
  const wall = validateAndPreviewQuote({
    scenario: "solo_fachada",
    listaPrecios: "web",
    pared: PARED_OK,
  });
  assert(wall.valid === true && wall.preview.subtotalUSD > 0, "solo_fachada ISOPANEL 100");

  const both = validateAndPreviewQuote({
    scenario: "techo_fachada",
    listaPrecios: "web",
    techo: TECHO_OK,
    pared: PARED_OK,
  });
  assert(both.valid === true, "techo_fachada valid");
  assert(
    both.preview.subtotalUSD > webFloor(wall, "solo_fachada") &&
      both.preview.subtotalUSD > 0,
    "combined roof+wall bills more than wall-only",
  );

  const cam = validateAndPreviewQuote({
    scenario: "camara_frig",
    listaPrecios: "web",
    pared: { familia: "ISOFRIG_PIR", espesor: 100, color: "Blanco" },
    camara: { largo_int: 6, ancho_int: 4, alto_int: 3 },
  });
  assert(cam.valid === true && cam.preview.subtotalUSD > 0, "camara_frig ISOFRIG 100");
  assert(
    Array.isArray(cam.preview.warnings),
    "camara_frig returns warnings array (espesor map may warn)",
  );
});

function webFloor(prev, _label) {
  return prev.preview?.subtotalUSD || 0;
}

setListaPrecios(prevLista || "web");

console.log(`\nquotePayloadValidator: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
