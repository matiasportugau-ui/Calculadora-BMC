// /chat skips to the next LLM only on quota/credits — not auth or generic 5xx.
// Tip storefrontVoiceCredits pins 429 shopper copy. Open #1203 pins shopperSafe
// 403/502 strings. This file pins the failover predicate those do not.
// Run: node tests/storefrontTextQuotaFailoverGates.test.js

import assert from "node:assert/strict";
import {
  isGrokCreditsError,
  isStorefrontTextQuotaError,
} from "../server/lib/voice/storefrontVoiceCredits.js";

{
  assert.equal(
    isStorefrontTextQuotaError({
      status: 403,
      body: "Your team has used all available credits or reached monthly spending limit",
    }),
    true,
    "Grok credits 403 is a skip-to-Gemini error",
  );
  assert.equal(
    isGrokCreditsError({ status: 402, body: "payment required" }),
    true,
  );
  assert.equal(
    isStorefrontTextQuotaError({ status: 402, message: "Payment Required" }),
    true,
    "HTTP 402 is always a credits skip",
  );
}

{
  assert.equal(
    isStorefrontTextQuotaError({ status: 429, message: "too many requests" }),
    true,
  );
  assert.equal(
    isStorefrontTextQuotaError({ status: 500, message: "status code (no body)" }),
    true,
    "OpenAI-SDK 'no body' blob is treated as quota even without HTTP 429 (pin, do not tighten)",
  );
}

{
  assert.equal(
    isStorefrontTextQuotaError({ status: 403, message: "forbidden" }),
    false,
    "plain 403 is not a credits skip",
  );
  assert.equal(
    isStorefrontTextQuotaError({ status: 401, message: "invalid api key" }),
    false,
    "auth failure must not failover (would burn the next provider)",
  );
  assert.equal(
    isStorefrontTextQuotaError({ status: 500, message: "upstream timeout from grok-3-mini" }),
    false,
    "generic 5xx is not quota — throw, do not silently skip",
  );
}

console.log("storefrontTextQuotaFailoverGates.test.js: ok");
