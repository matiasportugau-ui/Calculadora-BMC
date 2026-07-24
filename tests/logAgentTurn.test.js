/**
 * IMP-02 — shared turn logger for SSE agentChat and callAgentOnce.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeAgentTurn,
  logAgentTurn,
  hasCoreAgentTurnFields,
  AGENT_TURN_CORE_FIELDS,
} from "../server/lib/logAgentTurn.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Pure normalizer
const n = normalizeAgentTurn({
  channel: "ml",
  provider: "gemini",
  model: "gemini-2.5-flash",
  input_tokens: 10,
  output_tokens: 20,
  estimated_cost_usd: 0.001,
  latency_ms: 500,
  source: "agentCore",
});
assert.equal(n.event, "agent_turn");
assert.equal(n.channel, "ml");
assert.equal(n.provider, "gemini");
assert.equal(n.input_tokens, 10);
assert.equal(n.output_tokens, 20);
assert.equal(n.estimated_cost_usd, 0.001);
assert.equal(n.latency_ms, 500);
assert.equal(n.source, "agentCore");
assert.ok(n.ts);
assert.equal(hasCoreAgentTurnFields(n), true);
for (const k of AGENT_TURN_CORE_FIELDS) {
  assert.ok(Object.prototype.hasOwnProperty.call(n, k), `missing ${k}`);
}

// Emitter with fake logger
const logs = [];
const fakeLogger = {
  info(obj, msg) {
    logs.push({ obj, msg });
  },
};
const emitted = logAgentTurn(
  {
    channel: "chat",
    assistant: "panelin",
    provider: "claude",
    latency_ms: 100,
    source: "agentChat",
  },
  fakeLogger,
);
assert.equal(logs.length, 1);
assert.equal(logs[0].obj.event, "agent_turn");
assert.equal(logs[0].obj.source, "agentChat");
assert.equal(emitted.provider, "claude");
assert.equal(hasCoreAgentTurnFields(emitted), true);

// SSE-shaped vs core-shaped same core keys
const sseShape = normalizeAgentTurn({
  channel: "chat",
  assistant: "panelin",
  provider: "gemini",
  model: "x",
  input_tokens: 1,
  output_tokens: 2,
  estimated_cost_usd: 0.01,
  latency_ms: 200,
  source: "agentChat",
});
const coreShape = normalizeAgentTurn({
  channel: "wa",
  provider: "gemini",
  model: "x",
  input_tokens: 1,
  output_tokens: 2,
  estimated_cost_usd: 0.01,
  latency_ms: 200,
  source: "agentCore",
});
for (const k of AGENT_TURN_CORE_FIELDS) {
  assert.ok(k in sseShape && k in coreShape, `parity field ${k}`);
}

// Production call sites import logAgentTurn
const agentCore = fs.readFileSync(path.join(ROOT, "server/lib/agentCore.js"), "utf8");
const agentChat = fs.readFileSync(path.join(ROOT, "server/routes/agentChat.js"), "utf8");
assert.match(agentCore, /from ["']\.\/logAgentTurn\.js["']/);
assert.match(agentCore, /logAgentTurn\s*\(/);
assert.match(agentChat, /from ["']\.\.\/lib\/logAgentTurn\.js["']/);
assert.match(agentChat, /logAgentTurn\s*\(/);

console.log("logAgentTurn.test.js: ok");
