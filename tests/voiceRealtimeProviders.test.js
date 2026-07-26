// tests/voiceRealtimeProviders.test.js
import assert from "node:assert/strict";
import {
  resolveVoiceProvider,
  resolveSessionModel,
  GROK_VOICE_MODELS,
  getVoiceProviderConfig,
} from "../server/lib/voiceRealtimeProviders.js";

assert.equal(resolveVoiceProvider("auto"), "openai");
assert.equal(resolveVoiceProvider("openai"), "openai");
assert.equal(resolveVoiceProvider("grok"), "grok");
assert.equal(resolveVoiceProvider("claude"), "openai");
assert.equal(resolveVoiceProvider("gemini"), "openai");
assert.equal(resolveVoiceProvider("auto", "grok"), "grok");
assert.equal(resolveVoiceProvider("openai", "grok"), "grok");

const grokModel = resolveSessionModel("grok", "grok", "grok-3-mini", null);
assert.ok(GROK_VOICE_MODELS.includes(grokModel) || grokModel.startsWith("grok-voice"));

const grokExplicit = resolveSessionModel("grok", "grok", "", "grok-voice-think-fast-1.0");
assert.equal(grokExplicit, "grok-voice-think-fast-1.0");

let threw = false;
try {
  resolveSessionModel("openai", "openai", "", "not-a-realtime-model");
} catch (e) {
  threw = true;
  assert.equal(e.status, 400);
}
assert.ok(threw, "invalid openai realtime model throws");

const cfgG = getVoiceProviderConfig("grok");
assert.equal(cfgG.voiceProvider, "grok");
assert.ok(cfgG.realtimeBase.includes("api.x.ai"));
assert.ok(cfgG.clientSecretsUrl.includes("client_secrets"));

const cfgO = getVoiceProviderConfig("openai");
assert.equal(cfgO.voiceProvider, "openai");
assert.ok(cfgO.realtimeBase.includes("openai.com"));

console.log("✅ voiceRealtimeProviders tests OK");
