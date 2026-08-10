/**
 * Offline tests — envíos Drive document helpers.
 */
import assert from "node:assert/strict";
import {
  buildEnviosDriveDocument,
  enviosDriveFileName,
  formatCoordinationSaveMessage,
  isEnviosDriveDocument,
  normalizeCoordinationStatus,
  sessionPointersAfterCoordinationOpen,
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

// Bug DE: opening Drive/draft must drop prior reparto + cloudMeta unless replaced
const cleared = sessionPointersAfterCoordinationOpen({});
assert.equal(cleared.activeReparto, null);
assert.equal(cleared.cloudMeta, null);
const withReparto = sessionPointersAfterCoordinationOpen({
  reparto: { id: "r1", repartoNo: "REP-1", status: "en_coordinacion" },
});
assert.equal(withReparto.activeReparto?.id, "r1");
assert.equal(withReparto.cloudMeta, null);
const withCloud = sessionPointersAfterCoordinationOpen({
  cloudMeta: { id: "ENV-1", revision: 3 },
});
assert.equal(withCloud.activeReparto, null);
assert.equal(withCloud.cloudMeta?.revision, 3);

assert.match(
  formatCoordinationSaveMessage({
    envNo: "ENV-1",
    status: "saved",
    stopCount: 2,
    cloudOk: true,
  }),
  /Drive \+ nube/,
);
assert.match(
  formatCoordinationSaveMessage({
    envNo: "ENV-1",
    status: "completed",
    stopCount: 2,
    cloudOk: false,
    cloudError: "revision_conflict",
  }),
  /nube: revision_conflict/,
);
assert.equal(
  formatCoordinationSaveMessage({
    envNo: "ENV-1",
    status: "saved",
    stopCount: 1,
    cloudOk: false,
    cloudError: "no_token",
  }).includes("Drive + nube"),
  false,
);

console.log("enviosDrive.test.js OK");
