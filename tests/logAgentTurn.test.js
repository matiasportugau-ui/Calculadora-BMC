/**
 * IMP-02 — logAgentTurn schema presence (offline).
 */
import assert from "node:assert/strict";
import { logAgentTurn } from "../server/lib/logAgentTurn.js";

const logs = [];
const fakeLogger = {
  info(obj, msg) {
    logs.push({ obj, msg });
  },
};

const { turn, cost } = logAgentTurn(
  {
    path: "sse",
    provider: "claude",
    model: "claude-haiku-4-5-20251001",
    channel: "panelin_chat",
    latency_ms: 900,
    ttft_ms: 220,
    input_tokens: 100,
    output_tokens: 50,
    conversation_id: "conv-test",
  },
  fakeLogger,
);

assert.equal(turn.event, "agent_turn");
assert.equal(turn.path, "sse");
assert.equal(turn.provider, "claude");
assert.equal(turn.latency_ms, 900);
assert.equal(turn.ttft_ms, 220);
assert.equal(turn.input_tokens, 100);
assert.equal(turn.output_tokens, 50);
assert.ok(typeof turn.estimated_cost_usd === "number" || turn.estimated_cost_usd === null);
assert.equal(cost.event, "chat_turn_cost");
assert.equal(cost.source, "agentChat");
assert.equal(logs.length, 2);
assert.equal(logs[0].msg, "chat_turn_cost");
assert.equal(logs[1].msg, "agent_turn");

const core = logAgentTurn(
  {
    path: "agentCore",
    provider: "gemini",
    model: "gemini-2.5-flash",
    channel: "whatsapp",
    latency_ms: 400,
    input_tokens: 80,
    output_tokens: 120,
    task_key: "wa:suggest",
  },
  null,
);
assert.equal(core.cost.event, "agent_core_call");
assert.equal(core.cost.source, "agentCore");
assert.equal(core.turn.path, "agentCore");

console.log("logAgentTurn.test.js: ok");
