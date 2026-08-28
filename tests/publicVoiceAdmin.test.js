// Identify / Admin 2.0 persist helpers — no fake 200 without a real row.
// Run: node tests/publicVoiceAdmin.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseStorefrontToolJson,
  storefrontAdminRow,
  evaluateStorefrontLead,
  shouldRecordStorefrontLeadMetrics,
  storefrontActionLogPayload,
  storefrontSessionMax,
  skipStorefrontSessionLimit,
  shouldAttemptAdminColJ,
} from "../server/routes/publicVoice.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

assert.deepEqual(
  parseStorefrontToolJson('{"ok":true,"adminRow":42,"id":"MAN-1"}'),
  { ok: true, adminRow: 42, id: "MAN-1" },
  "ok true passes through",
);

const fromErrorOnly = parseStorefrontToolJson('{"error":"fetch failed"}');
assert.equal(fromErrorOnly.ok, false, "{error} without ok is failure (prod identify 200 bug)");
assert.match(String(fromErrorOnly.error), /fetch failed/);

const fromFalse = parseStorefrontToolJson('{"ok":false,"error":"Sheets auth"}');
assert.equal(fromFalse.ok, false);
assert.match(String(fromFalse.error), /Sheets auth/);

const fromGarbage = parseStorefrontToolJson("not-json");
assert.equal(fromGarbage.ok, false);

assert.equal(storefrontAdminRow({ ok: true, adminRow: 16 }), 16);
assert.equal(storefrontAdminRow({ ok: true, adminRow: 1 }), null, "header row is not a lead");
assert.equal(storefrontAdminRow({ ok: true, id: "MAN-1756344370753" }), null, "MAN-id is not adminRow");
assert.equal(storefrontAdminRow({ ok: true, adminRow: "MAN-1" }), null);
assert.equal(storefrontAdminRow({ ok: true, adminRow: parsedNaN() }), null);

function parsedNaN() {
  return Number("MAN-1");
}

const failError = evaluateStorefrontLead('{"error":"fetch failed"}');
assert.equal(failError.ok, false);
assert.equal(failError.httpStatus, 502);
assert.equal(failError.recordMetrics, false);
assert.equal(shouldRecordStorefrontLeadMetrics(failError), false);

const failHeader = evaluateStorefrontLead('{"ok":true,"adminRow":1}');
assert.equal(failHeader.ok, false);
assert.equal(failHeader.httpStatus, 502);
assert.equal(shouldRecordStorefrontLeadMetrics(failHeader), false);

const failMan = evaluateStorefrontLead('{"ok":true,"id":"MAN-1756344370753"}');
assert.equal(failMan.ok, false);
assert.equal(failMan.adminRow, null);
assert.equal(failMan.httpStatus, 502);

const okLead = evaluateStorefrontLead('{"ok":true,"adminRow":31,"id":"MAN-1"}');
assert.equal(okLead.ok, true);
assert.equal(okLead.adminRow, 31);
assert.equal(okLead.httpStatus, 200);
assert.equal(shouldRecordStorefrontLeadMetrics(okLead), true);

assert.deepEqual(storefrontActionLogPayload("shop_search", 400), { actionType: "shop_search", status: 400 });
assert.deepEqual(storefrontActionLogPayload("calcular_cotizacion", 200), {
  actionType: "calcular_cotizacion",
  status: 200,
});

const actionSrc = fs.readFileSync(path.join(ROOT, "server/routes/publicVoice.js"), "utf8");
assert.match(actionSrc, /storefrontActionLogPayload\(type, 400\)/, "400 path logs action.type");
assert.match(actionSrc, /storefrontActionLogPayload\(type, 200\)/, "200 path logs action.type");

assert.ok(storefrontSessionMax("production") > 3, "prod session cap must exceed 3/5min");
assert.equal(skipStorefrontSessionLimit({ method: "OPTIONS" }, "production"), true);
assert.equal(skipStorefrontSessionLimit({ method: "POST" }, "production"), false);
assert.equal(skipStorefrontSessionLimit({ method: "POST" }, "development"), true);

assert.equal(shouldAttemptAdminColJ(31), true);
assert.equal(shouldAttemptAdminColJ(1), false);
assert.equal(shouldAttemptAdminColJ("MAN-1"), false);

console.log("publicVoiceAdmin.test.js ok");
