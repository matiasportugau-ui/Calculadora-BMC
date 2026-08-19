/**
 * Bug EQ — resolveTipoAguas must match live UI (zonas[].dosAguas) while
 * still honoring agent payloads that only set techo.tipoAguas.
 * Run: node tests/techoTipoAguas.test.js
 */
import assert from "node:assert/strict";
import { resolveTipoAguas } from "../src/utils/techoTipoAguas.js";
import { executeTool } from "../server/lib/agentTools.js";

let failures = 0;
let passed = 0;

function check(cond, label) {
  if (cond) {
    passed++;
  } else {
    failures++;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

await group("resolveTipoAguas — zone flags vs stale tipoAguas", () => {
  check(
    resolveTipoAguas({
      tipoAguas: "una_agua",
      zonas: [{ largo: 10, ancho: 8, dosAguas: true }],
    }) === "dos_aguas",
    "dosAguas:true wins over stale tipoAguas una_agua (Bug EQ trigger)",
  );
  check(
    resolveTipoAguas({
      tipoAguas: "dos_aguas",
      zonas: [{ largo: 10, ancho: 8, dosAguas: false }],
    }) === "una_agua",
    "explicit dosAguas:false wins over stale tipoAguas dos_aguas",
  );
  check(
    resolveTipoAguas({
      tipoAguas: "dos_aguas",
      zonas: [{ largo: 10, ancho: 8 }],
    }) === "dos_aguas",
    "agent path: tipoAguas used when zones omit dosAguas",
  );
  check(
    resolveTipoAguas({
      tipoAguas: "una_agua",
      zonas: [
        { largo: 10, ancho: 8, dosAguas: false },
        { largo: 3, ancho: 2, dosAguas: true, preview: { attachParentGi: 0 } },
      ],
    }) === "una_agua",
    "lateral annex dosAguas does not flip root tipoAguas",
  );
  check(resolveTipoAguas({}) === "una_agua", "empty techo → una_agua");
});

await group("get_calc_state liveResult — Bug EQ", async () => {
  const stale = {
    scenario: "solo_techo",
    listaPrecios: "web",
    techo: {
      familia: "ISODEC_EPS",
      espesor: 100,
      tipoAguas: "una_agua", // stale — UI toggle only sets zonas[].dosAguas
      zonas: [{ largo: 10, ancho: 8, dosAguas: true }],
      borders: { frente: "gotero_frontal", fondo: "cumbrera", latIzq: "gotero_lateral", latDer: "gotero_lateral" },
    },
  };
  const raw = await executeTool("get_calc_state", {}, stale);
  const parsed = JSON.parse(raw);
  const live = parsed.liveResult;
  check(live && !live.error, "liveResult computes");
  const subDos = live?.subtotalSinIVA;
  check(typeof subDos === "number" && subDos > 0, `subtotalSinIVA present (${subDos})`);

  const una = {
    ...stale,
    techo: {
      ...stale.techo,
      tipoAguas: "una_agua",
      zonas: [{ largo: 10, ancho: 8, dosAguas: false }],
      borders: { frente: "gotero_frontal", fondo: "gotero_lateral", latIzq: "gotero_lateral", latDer: "gotero_lateral" },
    },
  };
  const rawUna = await executeTool("get_calc_state", {}, una);
  const subUna = JSON.parse(rawUna).liveResult?.subtotalSinIVA;
  check(
    typeof subUna === "number" && subDos > subUna,
    `dos_aguas subtotal (${subDos}) > una_agua (${subUna}) — EQ undercount if stale tipoAguas won`,
  );

  // Regression: without resolve, stale tipoAguas would price as una_agua (~4427).
  check(
    subDos > 4500,
    `dos_aguas with stale tipoAguas must use cumbrera path (got ${subDos}, expect >4500)`,
  );
});

console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
