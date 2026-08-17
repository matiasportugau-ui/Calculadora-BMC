/**
 * Drive / plan-import / voice confirm apply path.
 * Pins type coercion so a .bmc.json or buildQuote payload cannot leave
 * espesor as a number, pendiente as a string, or wipe sibling fields.
 *
 * Run: node tests/applyQuoteSnapshot.test.js
 */
import { applyQuoteSnapshot } from "../src/utils/applyQuoteSnapshot.js";

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

function captureSetters() {
  const calls = {};
  const wrap = (key) => (arg) => {
    calls[key] = arg;
  };
  return {
    calls,
    setters: {
      setScenario: wrap("scenario"),
      setLP: wrap("lp"),
      setTecho: wrap("techo"),
      setPared: wrap("pared"),
      setCamara: wrap("camara"),
      setFlete: wrap("flete"),
      setProyecto: wrap("proyecto"),
    },
  };
}

function applyUpdate(fnOrVal, prev) {
  return typeof fnOrVal === "function" ? fnOrVal(prev) : fnOrVal;
}

group("partial payload does not touch other setters", () => {
  const { calls, setters } = captureSetters();
  applyQuoteSnapshot({ scenario: "solo_techo" }, setters);
  assert(calls.scenario === "solo_techo", "scenario applied");
  assert(calls.lp === undefined, "lista not touched");
  assert(calls.techo === undefined, "techo not touched");
  assert(calls.flete === undefined, "flete not touched");
});

group("techo coercion + merge", () => {
  const { calls, setters } = captureSetters();
  applyQuoteSnapshot(
    {
      techo: {
        familia: "ISODEC_EPS",
        espesor: 100,
        pendiente: "12",
        zonas: [{ largo: "8.5", ancho: "6" }],
      },
    },
    setters,
  );
  const next = applyUpdate(calls.techo, {
    familia: "KEEP",
    color: "Blanco",
    tipoAguas: "una_agua",
    espesor: "50",
  });
  assert(next.familia === "ISODEC_EPS", "familia overwritten");
  assert(next.color === "Blanco", "unspecified color kept");
  assert(next.espesor === "100", "espesor stored as string");
  assert(next.pendiente === 12, "pendiente string → number");
  assert(next.zonas[0].largo === 8.5 && next.zonas[0].ancho === 6, "zona dims coerced");
});

group("invalid numeric strings become 0", () => {
  const { calls, setters } = captureSetters();
  applyQuoteSnapshot(
    {
      techo: { pendiente: "nope" },
      flete: "abc",
      pared: { alto: "x", perimetro: "", numEsqExt: "4", numEsqInt: "bad" },
    },
    setters,
  );
  const techo = applyUpdate(calls.techo, {});
  const pared = applyUpdate(calls.pared, { familia: "ISOPANEL_EPS" });
  assert(techo.pendiente === 0, "bad pendiente → 0");
  assert(calls.flete === 0, "bad flete → 0");
  assert(pared.alto === 0 && pared.perimetro === 0, "bad pared dims → 0");
  assert(pared.numEsqExt === 4, "numEsqExt string 4");
  assert(pared.numEsqInt === 0, "bad numEsqInt → 0");
  assert(pared.familia === "ISOPANEL_EPS", "pared merge keeps familia");
});

group("flete 0 is applied; null flete is not", () => {
  const zero = captureSetters();
  applyQuoteSnapshot({ flete: 0 }, zero.setters);
  assert(zero.calls.flete === 0, "flete 0 applied");

  const missing = captureSetters();
  applyQuoteSnapshot({ scenario: "solo_fachada" }, missing.setters);
  assert(missing.calls.flete === undefined, "omitted flete not applied");
});

group("camara + proyecto merge", () => {
  const { calls, setters } = captureSetters();
  applyQuoteSnapshot(
    {
      listaPrecios: "venta",
      camara: { largo_int: "6", ancho_int: 4, alto_int: "3.2" },
      proyecto: { nombre: "Petinho" },
    },
    setters,
  );
  assert(calls.lp === "venta", "lista venta passed through");
  const cam = applyUpdate(calls.camara, { largo_int: 1, extra: true });
  assert(cam.largo_int === 6 && cam.ancho_int === 4 && cam.alto_int === 3.2, "camara dims coerced");
  assert(cam.extra === true, "camara merge keeps extra keys");
  const proyecto = applyUpdate(calls.proyecto, { telefono: "099" });
  assert(proyecto.nombre === "Petinho" && proyecto.telefono === "099", "proyecto merge");
});

group("empty / missing payload fields", () => {
  const { calls, setters } = captureSetters();
  applyQuoteSnapshot({}, setters);
  assert(Object.keys(calls).length === 0, "empty payload is a no-op");
});

console.log(`\napplyQuoteSnapshot: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
