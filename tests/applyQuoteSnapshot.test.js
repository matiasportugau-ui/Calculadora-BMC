/**
 * Bug EM — applyQuoteSnapshot must not wipe zonas[].dosAguas.
 * Live UI derives dos_aguas from that flag; buildQuote confirm previously
 * stripped zones to {largo, ancho} → silent una_agua (~2× panels/price).
 *
 * Run: node tests/applyQuoteSnapshot.test.js
 */
import {
  applyQuoteSnapshot,
  normalizeSnapshotZonas,
} from "../src/utils/applyQuoteSnapshot.js";

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

group("normalizeSnapshotZonas preserves and stamps dosAguas", () => {
  const kept = normalizeSnapshotZonas(
    [{ largo: "10", ancho: 8, dosAguas: true, preview: { mark: "A" } }],
    "una_agua",
  );
  assert(kept[0].dosAguas === true, "explicit dosAguas wins over tipoAguas");
  assert(kept[0].preview?.mark === "A", "annex/preview markers preserved");
  assert(kept[0].largo === 10 && kept[0].ancho === 8, "dims coerced");

  const stamped = normalizeSnapshotZonas([{ largo: 12, ancho: 9 }], "dos_aguas");
  assert(stamped[0].dosAguas === true, "tipoAguas dos_aguas stamps missing flag");

  const una = normalizeSnapshotZonas([{ largo: 6, ancho: 5 }], "una_agua");
  assert(una[0].dosAguas === false, "tipoAguas una_agua stamps false");
});

group("applyQuoteSnapshot stamps dosAguas from tipoAguas (Bug EM)", () => {
  const { calls, setters } = captureSetters();
  applyQuoteSnapshot(
    {
      techo: {
        familia: "ISODEC_EPS",
        espesor: 100,
        tipoAguas: "dos_aguas",
        zonas: [{ largo: "8.5", ancho: "6" }],
      },
    },
    setters,
  );
  const next = applyUpdate(calls.techo, {
    familia: "KEEP",
    color: "Blanco",
    espesor: "50",
  });
  assert(next.familia === "ISODEC_EPS", "familia overwritten");
  assert(next.color === "Blanco", "unspecified color kept");
  assert(next.espesor === "100", "espesor stored as string");
  assert(next.tipoAguas === "dos_aguas", "tipoAguas passed through");
  assert(next.zonas[0].largo === 8.5 && next.zonas[0].ancho === 6, "zona dims coerced");
  assert(next.zonas[0].dosAguas === true, "dosAguas stamped for live derivedTipoAguas");
});

group("applyQuoteSnapshot keeps explicit dosAguas on zones", () => {
  const { calls, setters } = captureSetters();
  applyQuoteSnapshot(
    {
      techo: {
        tipoAguas: "una_agua",
        zonas: [{ largo: 10, ancho: 8, dosAguas: true }],
      },
    },
    setters,
  );
  const next = applyUpdate(calls.techo, {});
  assert(next.zonas[0].dosAguas === true, "explicit zone dosAguas not overwritten");
});

group("partial payload does not touch other setters", () => {
  const { calls, setters } = captureSetters();
  applyQuoteSnapshot({ scenario: "solo_techo" }, setters);
  assert(calls.scenario === "solo_techo", "scenario applied");
  assert(calls.lp === undefined, "lista not touched");
  assert(calls.techo === undefined, "techo not touched");
  assert(calls.flete === undefined, "flete not touched");
});

group("flete 0 is applied; omitted flete is not", () => {
  const zero = captureSetters();
  applyQuoteSnapshot({ flete: 0 }, zero.setters);
  assert(zero.calls.flete === 0, "flete 0 applied");

  const missing = captureSetters();
  applyQuoteSnapshot({ scenario: "solo_fachada" }, missing.setters);
  assert(missing.calls.flete === undefined, "omitted flete not applied");
});

console.log(`\napplyQuoteSnapshot: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
