/**
 * Offline tests — envíos Drive document helpers.
 */
import assert from "node:assert/strict";
import {
  buildEnviosDriveDocument,
  enviosDriveFileName,
  isEnviosDriveDocument,
  normalizeCoordinationStatus,
} from "../src/utils/logistica/enviosDrive.js";
import { DRAFT_SCHEMA } from "../src/utils/logistica/enviosDraft.js";

assert.equal(normalizeCoordinationStatus("completed"), "completed");
assert.equal(normalizeCoordinationStatus("saved"), "saved");
assert.equal(normalizeCoordinationStatus("other"), "saved");

assert.equal(enviosDriveFileName("ENV-260810-001"), "ENV-260810-001.bmc-envios.json");
assert.equal(enviosDriveFileName("env 260810"), "ENV-260810.bmc-envios.json");

const draft = {
  schema: DRAFT_SCHEMA,
  info: { numero: "ENV-260810-001", fecha: "2026-08-10" },
  stops: [{ id: "s1", cliente: "Alvaro" }],
};
const doc = buildEnviosDriveDocument(draft, {
  status: "saved",
  repartoNo: "REP-2026-08-10-001",
});
assert.equal(doc.schema, DRAFT_SCHEMA);
assert.equal(doc.coordination.status, "saved");
assert.equal(doc.coordination.repartoNo, "REP-2026-08-10-001");
assert.ok(Array.isArray(doc.coordination.resumableFrom));
assert.ok(doc.coordination.resumableFrom.includes("calculadora"));
assert.ok(isEnviosDriveDocument(doc));
assert.equal(isEnviosDriveDocument({ scenario: "solo_techo" }), false);
assert.ok(isEnviosDriveDocument({ schema: DRAFT_SCHEMA, stops: [] }));

console.log("enviosDrive.test.js OK");
