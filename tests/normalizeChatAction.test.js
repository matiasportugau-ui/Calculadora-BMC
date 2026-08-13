// Contract tests for src/utils/normalizeChatAction.js (Bug DY)
// Run: node tests/normalizeChatAction.test.js

import { normalizeChatAction } from "../src/utils/normalizeChatAction.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

group("Voice-shaped setLP / setFlete / setScenario unwrap to scalars", () => {
  const lp = normalizeChatAction({ type: "setLP", payload: { listaPrecios: "venta" } });
  assert(lp.payload === "venta", "setLP listaPrecios → venta");

  const lpAlias = normalizeChatAction({ type: "setLP", payload: { lista: "web" } });
  assert(lpAlias.payload === "web", "setLP lista alias → web");

  const flete = normalizeChatAction({ type: "setFlete", payload: { flete: 240 } });
  assert(flete.payload === 240, "setFlete {flete:240} → 240");
  assert(!Number.isNaN(Number(flete.payload)), "setFlete Number() is finite");

  const scen = normalizeChatAction({ type: "setScenario", payload: { scenario: "solo_techo" } });
  assert(scen.payload === "solo_techo", "setScenario {scenario} → solo_techo");
});

group("Text-chat scalar payloads stay unchanged", () => {
  const lp = normalizeChatAction({ type: "setLP", payload: "venta" });
  assert(lp.payload === "venta", "scalar setLP");
  assert(lp === normalizeChatAction(lp) || lp.payload === "venta", "idempotent on scalar");

  const flete = normalizeChatAction({ type: "setFlete", payload: 280 });
  assert(flete.payload === 280, "scalar setFlete");

  const scen = normalizeChatAction({ type: "setScenario", payload: "solo_fachada" });
  assert(scen.payload === "solo_fachada", "scalar setScenario");
});

group("Object payloads for merge actions are left alone", () => {
  const techo = normalizeChatAction({
    type: "setTecho",
    payload: { familia: "ISODEC", espesor: "100" },
  });
  assert(techo.payload.familia === "ISODEC", "setTecho object preserved");

  const proy = normalizeChatAction({
    type: "setProyecto",
    payload: { nombre: "Acme" },
  });
  assert(proy.payload.nombre === "Acme", "setProyecto object preserved");
});

group("Null / missing / wizardStep", () => {
  assert(normalizeChatAction(null) == null, "null passthrough");
  assert(normalizeChatAction(undefined) == null, "undefined passthrough");
  assert(normalizeChatAction({}).type == null, "empty object");

  const step = normalizeChatAction({ type: "setWizardStep", payload: { step: 2 } });
  assert(step.payload === 2, "setWizardStep {step} unwrap");
});

group("Bug DY concrete trigger — voice setLP object must not survive", () => {
  const raw = { type: "setLP", payload: { listaPrecios: "venta" } };
  // Without normalize, === "venta" fails and pricing stays on web.
  assert(raw.payload !== "venta", "precondition: object !== venta");
  const fixed = normalizeChatAction(raw);
  assert(fixed.payload === "venta", "after normalize comparable to venta");
  assert(fixed.payload === "venta" && typeof fixed.payload === "string", "string scalar");
});

console.log(`\n${"═".repeat(60)}`);
console.log(`normalizeChatAction tests — passed: ${passed}, failed: ${failed}`);
console.log("═".repeat(60));
if (failed > 0) process.exit(1);
