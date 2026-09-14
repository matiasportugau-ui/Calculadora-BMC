// Identify / capture_lead parse leftovers after publicVoiceAdmin happy path.
// `{ok:"true"}` / `{ok:1}` used to look like a saved Admin row. Pin exact
// `ok === true` plus object (not only JSON-string) tool results.
// Run: node tests/storefrontLeadParseOkGates.test.js

import assert from "node:assert/strict";
import {
  evaluateStorefrontLead,
  parseStorefrontToolJson,
  sanitizeStorefrontPublicError,
  shouldRecordStorefrontLeadMetrics,
  storefrontAdminRow,
} from "../server/routes/publicVoice.js";

{
  const obj = parseStorefrontToolJson({ ok: true, adminRow: 42, id: "MAN-1" });
  assert.deepEqual(obj, { ok: true, adminRow: 42, id: "MAN-1" });
}

{
  const asString = parseStorefrontToolJson('{"ok":"true","adminRow":31}');
  assert.equal(asString.ok, false, "string ok is not success");
  assert.equal(storefrontAdminRow(asString), null);

  const asObj = parseStorefrontToolJson({ ok: "true", adminRow: 31 });
  assert.equal(asObj.ok, false);

  const asOne = parseStorefrontToolJson({ ok: 1, adminRow: 31 });
  assert.equal(asOne.ok, false);
}

{
  const parsed = parseStorefrontToolJson({ ok: true });
  assert.equal(parsed.ok, true, "parse does not require adminRow");
  assert.equal(storefrontAdminRow(parsed), null);
  const ev = evaluateStorefrontLead({ ok: true });
  assert.equal(ev.ok, false);
  assert.equal(ev.httpStatus, 502);
  assert.equal(ev.adminRow, null);
  assert.equal(ev.recordMetrics, false);
  assert.equal(shouldRecordStorefrontLeadMetrics(ev), false);
}

{
  const ev = evaluateStorefrontLead({ ok: "true", adminRow: 31 });
  assert.equal(ev.ok, false);
  assert.equal(ev.httpStatus, 502);
  assert.equal(shouldRecordStorefrontLeadMetrics(ev), false);
}

{
  const ev = evaluateStorefrontLead({ ok: true, adminRow: 31, id: "MAN-1" });
  assert.equal(ev.ok, true);
  assert.equal(ev.adminRow, 31);
  assert.equal(ev.httpStatus, 200);
  assert.equal(shouldRecordStorefrontLeadMetrics(ev), true);
}

{
  const leaked = parseStorefrontToolJson({
    error: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
  });
  assert.equal(leaked.ok, false);
  assert.equal(String(leaked.error).includes("BEGIN PRIVATE KEY"), false);
  assert.equal(String(leaked.error).includes("abc"), false);
  assert.match(String(leaked.error), /Admin 2\.0/);
}

{
  assert.equal(parseStorefrontToolJson(null).ok, false);
  assert.equal(parseStorefrontToolJson(undefined).ok, false);
  assert.equal(parseStorefrontToolJson(42).ok, false);
}

{
  const redacted = sanitizeStorefrontPublicError("service_account private_key boom");
  assert.match(redacted, /Sheets auth/);
  assert.equal(redacted.includes("private_key"), false);
}

console.log("storefrontLeadParseOkGates.test.js: ok");
