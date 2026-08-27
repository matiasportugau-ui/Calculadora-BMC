/**
 * Run: node tests/logisticaVoiceBootstrap.test.js
 */
import assert from "node:assert/strict";
import {
  buildLogisticaVoiceBootstrap,
  isLogisticaVoiceSurface,
  LOGISTICA_TRUCKER_VOICE_INSTRUCTIONS,
  LOGISTICA_VOICE_FUNCTION_TOOLS,
} from "../server/lib/voice/logisticaTruckerInstructions.js";
import { buildGrokSessionUpdate, buildGrokRealtimeWsUrl } from "../src/utils/grokRealtimeTransport.js";

console.log("logisticaVoiceBootstrap");

assert.equal(isLogisticaVoiceSurface("logistica", {}), true);
assert.equal(isLogisticaVoiceSurface("", { logistica: true }), true);
assert.equal(isLogisticaVoiceSurface("", { module: "calc" }), false);

assert.match(LOGISTICA_TRUCKER_VOICE_INSTRUCTIONS, /El Transportador/);
assert.match(LOGISTICA_TRUCKER_VOICE_INSTRUCTIONS, /## Role & Persona/);
assert.match(LOGISTICA_TRUCKER_VOICE_INSTRUCTIONS, /## CRITICAL INSTRUCTIONS/);
assert.match(LOGISTICA_TRUCKER_VOICE_INSTRUCTIONS, /Never call setTecho/);

const names = LOGISTICA_VOICE_FUNCTION_TOOLS.map((t) => t.name);
assert.ok(names.includes("setStopField"));
assert.ok(!names.includes("setTecho"));
assert.ok(!names.includes("calcular_cotizacion"));

const pack = buildLogisticaVoiceBootstrap({ envNo: "ENV-1", logistica: true });
assert.match(pack.instructions, /El Transportador/);
assert.match(pack.instructions, /ENV-1/);
assert.ok(!pack.tools.some((t) => t.name === "setTecho"));
assert.equal(pack.voice, "rex");
assert.equal(pack.language_hint, "es-MX");
assert.equal(pack.turn_detection.type, "server_vad");
assert.equal(pack.reasoning.effort, "high");

const upd = buildGrokSessionUpdate(pack);
assert.equal(upd.type, "session.update");
assert.equal(upd.session.voice, "rex");
assert.ok(!(upd.session.tools || []).some((t) => t.name === "setTecho"));
assert.equal(upd.session.audio.input.format.rate, 24000);

const ws = buildGrokRealtimeWsUrl({ realtime_base: "https://api.x.ai/v1/realtime", model: "grok-voice-latest" });
assert.equal(ws, "wss://api.x.ai/v1/realtime?model=grok-voice-latest");

console.log("logisticaVoiceBootstrap: ok");
