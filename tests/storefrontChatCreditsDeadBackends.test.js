// /chat backend pick when the shop voice bubble is credits-dead (#1170 / #1198).
// listStorefrontChatBackends order lives in storefrontVoicePack / open #1203.
// This file pins the bubble filter those suites never call.
// Run: node tests/storefrontChatCreditsDeadBackends.test.js

import assert from "node:assert/strict";
import { pickStorefrontChatBackends } from "../server/lib/voice/storefrontChat.js";
import {
  __resetStorefrontVoiceCredits,
  __setStorefrontCreditsDeadUntil,
} from "../server/lib/voice/storefrontVoiceCredits.js";

const GROK = "xai-" + "k".repeat(40);
const GEMINI = "AQ." + "g".repeat(40);
const OPENAI = "sk-" + "A".repeat(40);
const ALL = { grokApiKey: GROK, geminiApiKey: GEMINI, openaiApiKey: OPENAI };

__resetStorefrontVoiceCredits();

{
  const live = pickStorefrontChatBackends(ALL);
  assert.deepEqual(
    live.map((b) => b.provider),
    ["grok", "gemini", "openai"],
    "live bubble keeps Grok first",
  );
}

__setStorefrontCreditsDeadUntil(Date.now() + 60_000);

{
  const dead = pickStorefrontChatBackends(ALL);
  assert.deepEqual(
    dead.map((b) => b.provider),
    ["gemini", "openai"],
    "credits-dead /chat skips Grok when a fallback exists (text stays up)",
  );
  assert.ok(!dead.some((b) => b.provider === "grok"));
}

{
  const grokOnly = pickStorefrontChatBackends({
    grokApiKey: GROK,
    geminiApiKey: "",
    openaiApiKey: "",
  });
  assert.deepEqual(
    grokOnly.map((b) => b.provider),
    ["grok"],
    "Grok-only + dead bubble still tries Grok (pin: do not empty the list)",
  );
}

{
  const none = pickStorefrontChatBackends({
    grokApiKey: "",
    geminiApiKey: "",
    openaiApiKey: "",
  });
  assert.deepEqual(none, [], "no usable keys → empty (503 path)");
}

__resetStorefrontVoiceCredits();
console.log("storefrontChatCreditsDeadBackends.test.js: ok");
