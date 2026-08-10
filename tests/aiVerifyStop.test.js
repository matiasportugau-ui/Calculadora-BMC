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

console.log("aiVerifyStop — OK");
