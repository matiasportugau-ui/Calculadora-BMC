// Hub live + JSONL turn-log must hash the same shopper phone the same way.
// Open #1183 pins live short→"" and list/detail PII drop. Open #1224 pins
// JSONL short→null. This file pins cross-module parity those do not.
// Run: node tests/storefrontPhoneHashParityGates.test.js

import assert from "node:assert/strict";
import { hashStorefrontPhone as hashLivePhone } from "../server/lib/voice/storefrontLive.js";
import { hashStorefrontPhone as hashLogPhone } from "../server/lib/voice/storefrontConversationLog.js";

const PHONE = "099 888 777";
const E164 = "+598 99 888 777";

{
  const live = hashLivePhone(PHONE);
  const log = hashLogPhone(PHONE);
  assert.equal(String(live).length, 16);
  assert.equal(live, log, "same digits → same sha256[:16] on Hub live and JSONL");
  assert.equal(hashLivePhone(E164), hashLogPhone(E164));
  assert.equal(
    hashLivePhone(PHONE),
    hashLivePhone("099888777"),
    "punctuation does not change the live hash",
  );
  assert.equal(hashLogPhone(PHONE), hashLogPhone("099888777"));
  assert.notEqual(live, hashLivePhone("099888778"), "different numbers do not collide");
}

{
  assert.equal(hashLivePhone("099"), "", "live short phone is empty string (SQL text)");
  assert.equal(hashLogPhone("099"), null, "JSONL short phone is null (omit field)");
  assert.equal(hashLivePhone(""), "");
  assert.equal(hashLogPhone(""), null);
  assert.notEqual(
    hashLivePhone("099"),
    hashLogPhone("099"),
    "pin the live-vs-JSONL empty divergence — do not silently unify",
  );
}

console.log("storefrontPhoneHashParityGates.test.js: ok");
