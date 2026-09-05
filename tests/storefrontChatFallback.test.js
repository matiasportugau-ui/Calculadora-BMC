// Shop /chat backend pick + shopper-safe errors (#1198 Gemini fallback).
// Happy-path grok+gemini order lives in storefrontVoicePack.test.js.
// Run: node tests/storefrontChatFallback.test.js

import assert from "node:assert/strict";
import { GEMINI_OPENAI_BASE, listStorefrontChatBackends } from "../server/lib/voice/storefrontChat.js";
import { shopperSafeChatError } from "../server/lib/voice/storefrontVoiceCredits.js";

const GROK = "xai-" + "k".repeat(40);
const GEMINI = "AQ." + "g".repeat(40);
const OPENAI = "sk-" + "A".repeat(40);

assert.deepEqual(
  listStorefrontChatBackends({
    grokApiKey: "",
    geminiApiKey: "",
    openaiApiKey: "",
  }),
  [],
  "no keys → no backends (503 path)",
);

assert.deepEqual(
  listStorefrontChatBackends({
    grokApiKey: "sk-your-openai-api-key-here",
    geminiApiKey: "REPLACE_ME",
    openaiApiKey: "changeme",
  }),
  [],
  "placeholders are not usable backends",
);

{
  const onlyGemini = listStorefrontChatBackends({
    grokApiKey: "",
    geminiApiKey: GEMINI,
    openaiApiKey: "",
  });
  assert.equal(onlyGemini.length, 1);
  assert.equal(onlyGemini[0].provider, "gemini");
  assert.equal(onlyGemini[0].baseURL, GEMINI_OPENAI_BASE);
  assert.equal(onlyGemini[0].model, "gemini-2.5-flash-lite");
}

{
  const onlyOpenAi = listStorefrontChatBackends({
    grokApiKey: "x",
    geminiApiKey: "",
    openaiApiKey: OPENAI,
  });
  assert.equal(onlyOpenAi.length, 1);
  assert.equal(onlyOpenAi[0].provider, "openai");
  assert.equal(onlyOpenAi[0].baseURL, "");
  assert.equal(onlyOpenAi[0].model, "gpt-4o-mini");
}

{
  const all = listStorefrontChatBackends({
    grokApiKey: GROK,
    geminiApiKey: GEMINI,
    openaiApiKey: OPENAI,
  });
  assert.deepEqual(
    all.map((b) => b.provider),
    ["grok", "gemini", "openai"],
    "failover order: Grok → Gemini → OpenAI",
  );
  assert.equal(all[0].baseURL, "https://api.x.ai/v1");
}

{
  const credits = shopperSafeChatError({
    status: 403,
    body: "Your team has used all available credits or reached monthly spending limit",
  });
  assert.equal(credits.status, 403);
  assert.match(credits.message, /no se pudo responder ahora/i);
  assert.ok(!/credits|spending limit|xai/i.test(credits.message));
}

{
  const net = shopperSafeChatError({ status: 0, message: "fetch failed" });
  assert.equal(net.status, 502);
  assert.match(net.message, /no se pudo responder/i);
  assert.ok(!/fetch failed/i.test(net.message));
}

{
  const reset = shopperSafeChatError({ message: "ECONNRESET" });
  assert.equal(reset.status, 502);
  assert.ok(!/ECONNRESET/i.test(reset.message));
}

{
  const generic = shopperSafeChatError({ status: 500, message: "upstream timeout from grok-3-mini" });
  assert.equal(generic.status, 500);
  assert.equal(generic.message, "No se pudo responder. Probá de nuevo.");
  assert.ok(!/grok-3-mini|timeout/i.test(generic.message));
}

console.log("storefrontChatFallback.test.js: ok");
