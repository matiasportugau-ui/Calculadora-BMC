// Shop-facing error sanitizer — never leak Sheets/service-account material.
// Complementary to publicVoiceAdmin (lead row) and googleSheetsAuth (operator redact).
// Run: node tests/storefrontPublicError.test.js

import assert from "node:assert/strict";
import {
  sanitizeStorefrontPublicError,
  parseStorefrontToolJson,
  evaluateStorefrontLead,
} from "../server/routes/publicVoice.js";

const PEM = "-----BEGIN PRIVATE KEY-----\nMIIEvFAKESECRET_k1l2m3\n-----END PRIVATE KEY-----";
const SA_JSON = '{"type":"service_account","private_key":"' + PEM + '","client_email":"sa@x.iam.gserviceaccount.com"}';

assert.equal(
  sanitizeStorefrontPublicError(PEM),
  "No se pudo guardar en Admin 2.0 (Sheets auth).",
  "PEM blob must not reach the shopper",
);
assert.equal(
  sanitizeStorefrontPublicError(SA_JSON),
  "No se pudo guardar en Admin 2.0 (Sheets auth).",
  "service_account JSON must not reach the shopper",
);
assert.equal(
  sanitizeStorefrontPublicError("The file at " + SA_JSON + " does not exist"),
  "No se pudo guardar en Admin 2.0 (Sheets auth).",
  "Sheets path error wrapping a key is still redacted",
);

const ordinary = sanitizeStorefrontPublicError("fila ocupada");
assert.equal(ordinary, "fila ocupada");
assert.ok(!ordinary.includes("PRIVATE KEY"));

const empty = sanitizeStorefrontPublicError("");
assert.equal(empty, "No se pudo guardar en Admin 2.0.");

const long = sanitizeStorefrontPublicError("x".repeat(500));
assert.equal(long.length, 300, "ordinary errors are truncated, not dumped");

const fromPemJson = parseStorefrontToolJson(JSON.stringify({ error: PEM }));
assert.equal(fromPemJson.ok, false);
assert.equal(fromPemJson.error, "No se pudo guardar en Admin 2.0 (Sheets auth).");
assert.ok(!JSON.stringify(fromPemJson).includes("BEGIN PRIVATE KEY"));
assert.ok(!JSON.stringify(fromPemJson).includes("MIIEvFAKESECRET"));

const fromSaObject = parseStorefrontToolJson({ error: SA_JSON });
assert.equal(fromSaObject.ok, false);
assert.ok(!JSON.stringify(fromSaObject).includes("client_email"));
assert.ok(!JSON.stringify(fromSaObject).includes("service_account"));

const lead = evaluateStorefrontLead(JSON.stringify({ error: PEM }));
assert.equal(lead.ok, false);
assert.equal(lead.httpStatus, 502);
assert.equal(lead.recordMetrics, false);
assert.equal(lead.error, "No se pudo guardar en Admin 2.0 (Sheets auth).");
assert.ok(!JSON.stringify(lead).includes("BEGIN PRIVATE KEY"));

console.log("storefrontPublicError.test.js ok");
