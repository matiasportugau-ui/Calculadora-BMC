/**
 * Run: node tests/aiVerifyStop.test.js
 */
import assert from "node:assert/strict";
import {
  applyAiVerifyProposal,
  buildAiVerifyEvidencePack,
  isStopIncompleteForAi,
  normalizeAiVerifyProposal,
} from "../src/utils/logistica/aiVerifyStop.js";

console.log("aiVerifyStop — incomplete detection");
assert.equal(isStopIncompleteForAi({ paneles: [], cliente: "A", telefono: "1", direccion: "x" }), true);
assert.equal(
  isStopIncompleteForAi({
    paneles: [{ tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 2 }],
    cliente: "A",
    telefono: "099",
    direccion: "Maldonado",
  }),
  false,
);
assert.equal(
  isStopIncompleteForAi({
    paneles: [{ tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 2 }],
    cliente: "A",
    telefono: "099",
    direccion: "Maldonado",
    adjuntoMeta: { ok: false },
  }),
  true,
);

console.log("aiVerifyStop — evidence pack");
const pack = buildAiVerifyEvidencePack({
  cliente: "Alvaro",
  orderId: "1345381",
  rawSheetText: "ENCARGO: Cotizacion-Isodec-100-mm.pdf",
  pdfLink: "",
  paneles: [],
});
assert.ok(pack.sources.some((s) => s.id === "ventas_row"));
assert.ok(pack.gaps.includes("sin_paneles"));

console.log("aiVerifyStop — normalize proposal");
const prop = normalizeAiVerifyProposal(`\`\`\`json
{
  "confidence": "alta",
  "notes": ["Desde filename"],
  "needsHuman": [],
  "fields": { "telefono": "099111222" },
  "paneles": [{ "tipo": "ISODEC", "espesor": 100, "longitud": 6, "cantidad": 12 }],
  "accesorios": [{ "descr": "Gotero", "cantidad": 2 }],
  "replacePaneles": true,
  "replaceAccesorios": true
}
\`\`\``);
assert.equal(prop.ok, true);
assert.equal(prop.confidence, "alta");
assert.equal(prop.paneles.length, 1);
assert.equal(prop.paneles[0].tipo, "ISODEC");
assert.equal(prop.paneles[0].cantidad, 12);
assert.equal(prop.accesorios[0].descr, "Gotero");
assert.equal(prop.fields.telefono, "099111222");
assert.equal(prop.replacePaneles, true);
assert.equal(prop.replaceAccesorios, true);

// Bug DN: omit replace* → must NOT default to true (schema echo used to wipe cargo)
const noReplaceFlag = normalizeAiVerifyProposal({
  confidence: "alta",
  paneles: [{ tipo: "ISOPANEL", espesor: 100, longitud: 6, cantidad: 3 }],
  accesorios: [{ descr: "Tornillo", cantidad: 10 }],
});
assert.equal(noReplaceFlag.replacePaneles, false);
assert.equal(noReplaceFlag.replaceAccesorios, false);

const badEsp = normalizeAiVerifyProposal({
  paneles: [{ tipo: "ISODEC", espesor: 99, longitud: 6, cantidad: 1 }],
});
assert.equal(badEsp.paneles.length, 0);

console.log("aiVerifyStop — apply (human confirmed)");
const stop = {
  id: "s1",
  cliente: "Alvaro",
  telefono: "",
  direccion: "Ciudad de Maldonado",
  paneles: [],
  accesorios: [],
  checks: {},
};
let n = 0;
const applied = applyAiVerifyProposal(stop, prop, { uid: () => `id-${++n}` });
assert.equal(applied.telefono, "099111222");
assert.equal(applied.paneles.length, 1);
assert.equal(applied.paneles[0].id, "id-1");
assert.equal(applied.accesorios.length, 1);
assert.ok(String(applied.observacionesLogistica).includes("IA verify"));
assert.equal(applied.checks.bultosOk, true);

// Does not overwrite existing cliente
const applied2 = applyAiVerifyProposal(
  { ...stop, cliente: "Keep Me", telefono: "1" },
  normalizeAiVerifyProposal({
    fields: { cliente: "Overwrite" },
    paneles: [],
    confidence: "media",
  }),
);
assert.equal(applied2.cliente, "Keep Me");

console.log("aiVerifyStop — Bug DN preserve existing cargo on Aplicar");
const stopWithCargo = {
  id: "s2",
  cliente: "Alvaro",
  telefono: "",
  direccion: "Maldonado",
  paneles: [{ id: "keep-p1", tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 12 }],
  accesorios: [{ id: "keep-a1", descr: "Gotero original", cantidad: 4 }],
  checks: { bultosOk: true },
};
// Model echoes schema replacePaneles:true (common) — must still preserve without forceReplaceCargo
const wipeAttempt = normalizeAiVerifyProposal({
  confidence: "alta",
  fields: { telefono: "099999999" },
  paneles: [{ tipo: "ISOPANEL", espesor: 50, longitud: 6, cantidad: 1 }],
  accesorios: [{ descr: "Wrong acc", cantidad: 99 }],
  replacePaneles: true,
  replaceAccesorios: true,
});
const preserved = applyAiVerifyProposal(stopWithCargo, wipeAttempt, { uid: () => "new-id" });
assert.equal(preserved.telefono, "099999999", "empty tel should fill");
assert.equal(preserved.paneles.length, 1);
assert.equal(preserved.paneles[0].id, "keep-p1", "existing paneles must not be wiped");
assert.equal(preserved.paneles[0].cantidad, 12);
assert.equal(preserved.accesorios[0].id, "keep-a1");
assert.equal(preserved.aiVerifyMeta.preservedPaneles, true);
assert.equal(preserved.aiVerifyMeta.preservedAccesorios, true);
assert.ok(String(preserved.observacionesLogistica).includes("preservado"));

// Empty cargo still filled (P0 incomplete path)
const filledEmpty = applyAiVerifyProposal(
  { ...stopWithCargo, paneles: [], accesorios: [] },
  wipeAttempt,
  { uid: () => "fill-1" },
);
assert.equal(filledEmpty.paneles.length, 1);
assert.equal(filledEmpty.paneles[0].tipo, "ISOPANEL");
assert.equal(filledEmpty.accesorios.length, 1);

// Explicit dual gate can replace when operator opts in
const forced = applyAiVerifyProposal(stopWithCargo, wipeAttempt, {
  uid: () => "force-1",
  forceReplaceCargo: true,
});
assert.equal(forced.paneles[0].tipo, "ISOPANEL");
assert.equal(forced.paneles[0].id, "force-1");

console.log("aiVerifyStop — OK");
