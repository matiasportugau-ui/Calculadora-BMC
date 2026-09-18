// normalizeStorefrontPhone leftover shapes (#1198 identify / JSONL hash).
// Tip storefrontVoicePack pins "099 162 401" and "+598 99 123 456" only.
// Open #1133 is an E.164 production fix — pin current behavior, do not "fix".
// Run: node tests/storefrontPhoneNormalizeGates.test.js

import assert from "node:assert/strict";
import {
  normalizeStorefrontPhone,
  assertCaptureLead,
  assertIdentifyLead,
} from "../server/lib/voice/storefrontVoicePack.js";

assert.equal(normalizeStorefrontPhone(""), "");
assert.equal(normalizeStorefrontPhone(null), "");
assert.equal(normalizeStorefrontPhone("abc"), "");
assert.equal(normalizeStorefrontPhone("   "), "");

{
  assert.equal(
    normalizeStorefrontPhone("099 162 401"),
    "598099162401",
    "current: 9-digit 0-prefixed local keeps the 0 after 598 (pin, do not E.164-fix)",
  );
  assert.equal(normalizeStorefrontPhone("99123456"), "59899123456", "8-digit local gets 598");
  assert.equal(normalizeStorefrontPhone("099123456"), "598099123456", "9-digit local gets 598");
  assert.equal(
    normalizeStorefrontPhone("59899123456"),
    "59899123456",
    "already-598 11-digit is left alone",
  );
  assert.equal(normalizeStorefrontPhone("+598 99 123 456"), "59899123456");
  assert.equal(normalizeStorefrontPhone("598-99-123-456"), "59899123456");
}

{
  assert.equal(normalizeStorefrontPhone("099"), "099", "3 digits stay short (identify rejects)");
  const id = assertIdentifyLead({ cliente: "Ana", telefono: "099", consent: true });
  assert.equal(id.ok, false);
  assert.match(String(id.error), /celular/i);
}

{
  const captured = assertCaptureLead({
    cliente: "Ana",
    telefono: "99123456",
    consulta: "techo IsoDec 10x8",
    consent: true,
  });
  assert.equal(captured.ok, true);
  assert.equal(captured.lead.telefono, "59899123456");
}

console.log("storefrontPhoneNormalizeGates.test.js: ok");
