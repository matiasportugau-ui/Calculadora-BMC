// tests/voiceRealtimeProviders.test.js
import assert from "node:assert/strict";
import {
  resolveVoiceProvider,
  resolveSessionModel,
  isVoiceMintFallbackError,
  markVoiceProviderDead,
  isVoiceProviderDead,
  clearVoiceProviderDeadMarks,
  GROK_VOICE_MODELS,
  getVoiceProviderConfig,
} from "../server/lib/voiceRealtimeProviders.js";

// Seam determinista: ambas keys OK, sin pin — mapeo clásico aiProvider→engine.
const bothOk = { pin: "", openaiKeyOk: true, grokKeyOk: true };
assert.equal(resolveVoiceProvider("auto", null, bothOk), "openai");
assert.equal(resolveVoiceProvider("openai", null, bothOk), "openai");
assert.equal(resolveVoiceProvider("grok", null, bothOk), "grok");
assert.equal(resolveVoiceProvider("claude", null, bothOk), "openai");
assert.equal(resolveVoiceProvider("gemini", null, bothOk), "openai");
assert.equal(resolveVoiceProvider("auto", "grok", bothOk), "grok");
assert.equal(resolveVoiceProvider("openai", "grok", bothOk), "grok");

// Fallback: OpenAI key muerta/dead-marked y Grok viva → auto resuelve grok.
const openaiDead = { pin: "", openaiKeyOk: false, grokKeyOk: true };
assert.equal(resolveVoiceProvider("auto", null, openaiDead), "grok");
assert.equal(resolveVoiceProvider("claude", null, openaiDead), "grok");
// Elección explícita del usuario gana siempre, aunque la key esté muerta.
assert.equal(resolveVoiceProvider("auto", "openai", openaiDead), "openai");
// Ambas muertas → default openai (error claro en mint, no silencios).
assert.equal(
  resolveVoiceProvider("auto", null, { pin: "", openaiKeyOk: false, grokKeyOk: false }),
  "openai",
);

// Pin de ops (VOICE_PROVIDER) gana sobre el mapeo pero no sobre el usuario.
assert.equal(resolveVoiceProvider("auto", null, { ...bothOk, pin: "grok" }), "grok");
assert.equal(resolveVoiceProvider("claude", null, { ...bothOk, pin: "grok" }), "grok");
assert.equal(resolveVoiceProvider("auto", "openai", { ...bothOk, pin: "grok" }), "openai");

// Dead-marks en proceso.
clearVoiceProviderDeadMarks();
assert.equal(isVoiceProviderDead("openai"), false);
markVoiceProviderDead("openai");
assert.equal(isVoiceProviderDead("openai"), true);
assert.equal(isVoiceProviderDead("grok"), false);
clearVoiceProviderDeadMarks();
assert.equal(isVoiceProviderDead("openai"), false);

// Clasificación de errores que justifican fallback de mint.
for (const status of [401, 402, 403, 429, 500, 502, 503]) {
  assert.equal(isVoiceMintFallbackError({ status }), true, `status ${status} → fallback`);
}
assert.equal(isVoiceMintFallbackError(new Error("fetch failed")), true, "network error → fallback");
assert.equal(isVoiceMintFallbackError({ status: 400 }), false, "400 no es fallback");
assert.equal(isVoiceMintFallbackError({ status: 404 }), false, "404 no es fallback");

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
