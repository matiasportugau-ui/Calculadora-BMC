// tests/resolveRealtimeModel.test.js
import assert from "node:assert/strict";
import {
  resolveRealtimeModel,
  buildRealtimeAllowlist,
  isAllowedRealtimeModel,
  REALTIME_MODEL_FALLBACKS,
} from "../server/lib/resolveRealtimeModel.js";

const def = "gpt-4o-realtime-preview";
const allow = buildRealtimeAllowlist(def);
assert.ok(allow.includes(def));
assert.ok(allow.includes("gpt-4o-mini-realtime-preview"));

assert.equal(resolveRealtimeModel("auto", "", def, allow), def);
assert.equal(resolveRealtimeModel("", "", def, allow), def);
assert.equal(resolveRealtimeModel("gemini", "gemini-2.5-flash", def, allow), def);
assert.equal(resolveRealtimeModel("claude", "claude-opus-4-7", def, allow), def);
assert.equal(resolveRealtimeModel("openai", "", def, allow), def);
assert.equal(resolveRealtimeModel("openai", "gpt-4o-mini", def, allow), def);
assert.equal(
  resolveRealtimeModel("openai", "gpt-4o-mini-realtime-preview", def, allow),
  "gpt-4o-mini-realtime-preview",
);
assert.equal(
  resolveRealtimeModel("openai", "gpt-4o-realtime-preview", def, allow),
  "gpt-4o-realtime-preview",
);

assert.equal(isAllowedRealtimeModel("gpt-4o-realtime-preview", allow), true);
assert.equal(isAllowedRealtimeModel("gpt-4o-mini", allow), false);
assert.equal(isAllowedRealtimeModel("", allow), false);

// custom default still wins for non-openai
const custom = "gpt-4o-mini-realtime-preview";
const allow2 = buildRealtimeAllowlist(custom);
assert.equal(resolveRealtimeModel("auto", "", custom, allow2), custom);
assert.ok(REALTIME_MODEL_FALLBACKS.length >= 1);

console.log("✅ resolveRealtimeModel tests OK");
