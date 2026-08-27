// tests/grokRealtimeTransport.test.js
// Pure Grok WebSocket transport helpers — no network.
// Run: node tests/grokRealtimeTransport.test.js

import assert from "node:assert/strict";
import {
  GROK_VOICE_SAMPLE_RATE,
  buildGrokRealtimeWsUrl,
  buildGrokWsProtocols,
  usesGrokWebSocketTransport,
  float32ToBase64Pcm16,
  base64Pcm16ToFloat32,
  resampleFloat32Linear,
  buildGrokSessionUpdate,
  XAI_CLIENT_SECRET_PROTOCOL_PREFIX,
} from "../src/utils/grokRealtimeTransport.js";

console.log("\n— grokRealtimeTransport\n");

// URL
assert.equal(
  buildGrokRealtimeWsUrl({
    realtime_base: "https://api.x.ai/v1/realtime",
    model: "grok-voice-latest",
  }),
  "wss://api.x.ai/v1/realtime?model=grok-voice-latest",
);
assert.equal(
  buildGrokRealtimeWsUrl({
    realtime_base: "wss://api.x.ai/v1/realtime",
    model: "grok-voice-think-fast-1.0",
  }),
  "wss://api.x.ai/v1/realtime?model=grok-voice-think-fast-1.0",
);
assert.throws(() => buildGrokRealtimeWsUrl({ realtime_base: "ftp://x" }), /http/);

// Protocols
assert.deepEqual(
  buildGrokWsProtocols("xai-realtime-client-secret-ABC"),
  [`${XAI_CLIENT_SECRET_PROTOCOL_PREFIX}xai-realtime-client-secret-ABC`],
);
assert.deepEqual(
  buildGrokWsProtocols(`${XAI_CLIENT_SECRET_PROTOCOL_PREFIX}tok`),
  [`${XAI_CLIENT_SECRET_PROTOCOL_PREFIX}tok`],
);
assert.deepEqual(buildGrokWsProtocols("Bearer ek_test"), [
  `${XAI_CLIENT_SECRET_PROTOCOL_PREFIX}ek_test`,
]);
assert.throws(() => buildGrokWsProtocols(""), /ephemeral/);

// Transport choice
assert.equal(usesGrokWebSocketTransport("grok"), true);
assert.equal(usesGrokWebSocketTransport("xai"), true);
assert.equal(usesGrokWebSocketTransport("openai"), false);
assert.equal(usesGrokWebSocketTransport("auto"), false);

// PCM round-trip
const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
const b64 = float32ToBase64Pcm16(samples);
const back = base64Pcm16ToFloat32(b64);
assert.equal(back.length, samples.length);
assert.ok(Math.abs(back[1] - 0.5) < 0.01, "0.5 round-trip");
assert.ok(Math.abs(back[2] + 0.5) < 0.01, "-0.5 round-trip");

// Resample length roughly halves when rate doubles
const in48 = new Float32Array(480);
for (let i = 0; i < in48.length; i++) in48[i] = Math.sin(i / 10);
const out24 = resampleFloat32Linear(in48, 48000, GROK_VOICE_SAMPLE_RATE);
assert.ok(out24.length >= 230 && out24.length <= 250, `resample len=${out24.length}`);

// Session update shape
const upd = buildGrokSessionUpdate({
  instructions: "hola",
  tools: [
    { type: "file_search", vector_store_ids: ["collection_abc"], max_num_results: 10 },
    { type: "function", name: "setScenario" },
  ],
  tool_choice: "auto",
});
assert.equal(upd.type, "session.update");
assert.equal(upd.session.instructions, "hola");
assert.equal(upd.session.audio.input.format.rate, GROK_VOICE_SAMPLE_RATE);
assert.equal(upd.session.tools.length, 2);
assert.equal(upd.session.tools[0].type, "file_search");
assert.equal(upd.session.tools[0].vector_store_ids[0], "collection_abc");
assert.equal(upd.session.turn_detection.type, "server_vad");

const updEs = buildGrokSessionUpdate({
  instructions: "hola",
  language_hint: "es-ES",
  keyterms: ["IsoDec"],
  replace: { IsoDec: "Iso-dec" },
});
assert.equal(updEs.session.audio.input.transcription.language_hint, "es-ES");
assert.deepEqual(updEs.session.audio.input.transcription.keyterms, ["IsoDec"]);
assert.equal(updEs.session.replace.IsoDec, "Iso-dec");

const updStore = buildGrokSessionUpdate({
  instructions: "hola",
  turn_detection: { threshold: 0.75, idle_timeout_ms: 20000 },
  reasoning: { effort: "high" },
  resumption: { enabled: true },
});
assert.equal(updStore.session.turn_detection.threshold, 0.75);
assert.equal(updStore.session.turn_detection.idle_timeout_ms, 20000);
assert.equal(updStore.session.reasoning.effort, "high");
assert.equal(updStore.session.resumption.enabled, true);

console.log("  ✅ all grokRealtimeTransport asserts passed\n");
