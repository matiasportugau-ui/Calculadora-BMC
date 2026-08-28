// Storefront voice credits dead-mark — hide orb on billing/auth mint failures.
// Run: node tests/storefrontVoiceCredits.test.js

import assert from "node:assert/strict";
import {
  clearStorefrontCreditsDeadMark,
  isStorefrontCreditsError,
  markStorefrontCreditsDead,
  markStorefrontCreditsLive,
  storefrontCreditsDenyBody,
  storefrontVoiceBubbleOn,
  storefrontVoiceStatus,
} from "../server/lib/voice/storefrontVoiceCredits.js";

clearStorefrontCreditsDeadMark();

assert.equal(storefrontVoiceBubbleOn(), true);
assert.deepEqual(storefrontVoiceStatus(), { ok: true, bubble: true });

const deny = storefrontCreditsDenyBody();
assert.equal(deny.ok, false);
assert.equal(deny.code, "credits");
assert.ok(!/crédito|credit|billing|cuota/i.test(deny.error), "shopper deny must not mention credits");

assert.equal(isStorefrontCreditsError({ status: 402, message: "Payment Required" }), true);
assert.equal(isStorefrontCreditsError({ status: 401 }), true);
assert.equal(isStorefrontCreditsError({ status: 403, body: "insufficient credits" }), true);
assert.equal(isStorefrontCreditsError({ status: 502, message: "bad gateway" }), false);
assert.equal(isStorefrontCreditsError({ status: 0, message: "network timeout" }), false);
assert.equal(
  isStorefrontCreditsError({ status: 429, message: "spending limit exceeded" }),
  true,
  "429 + billing wording counts",
);
assert.equal(isStorefrontCreditsError({ status: 429, message: "rate limit" }), false);

assert.equal(markStorefrontCreditsDead({ status: 502 }), false);
assert.equal(storefrontVoiceBubbleOn(), true);

assert.equal(markStorefrontCreditsDead({ status: 402, message: "credits exhausted" }), true);
assert.equal(storefrontVoiceBubbleOn(), false);
assert.deepEqual(storefrontVoiceStatus(), { ok: true, bubble: false });

markStorefrontCreditsLive();
assert.equal(storefrontVoiceBubbleOn(), true);

clearStorefrontCreditsDeadMark();
console.log("storefrontVoiceCredits.test.js ok");
