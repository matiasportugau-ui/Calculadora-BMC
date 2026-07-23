/**
 * IMP-12 — offline contract for SSE `done` payload shape (no network).
 * Mirrors sendDone() fields in agentChat.js.
 */
import assert from "node:assert/strict";

function buildDonePayload(meta = {}) {
  const payload = {
    type: "done",
    provider_used: meta.provider_used ?? null,
    model: meta.model ?? null,
    latency_ms: meta.latency_ms ?? null,
  };
  if (meta.ttft_ms != null && Number.isFinite(meta.ttft_ms)) {
    payload.ttft_ms = meta.ttft_ms;
  }
  return payload;
}

const ok = buildDonePayload({
  provider_used: "claude",
  model: "claude-opus-4-7",
  latency_ms: 1234,
  ttft_ms: 400,
});
assert.equal(ok.type, "done");
assert.equal(ok.provider_used, "claude");
assert.equal(ok.model, "claude-opus-4-7");
assert.equal(ok.latency_ms, 1234);
assert.equal(ok.ttft_ms, 400);

const fail = buildDonePayload({ provider_used: null, model: null, latency_ms: null });
assert.equal(fail.type, "done");
assert.equal(fail.provider_used, null);
assert.equal("ttft_ms" in fail, false);

// Source still has sendDone with provider_used
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "server/routes/agentChat.js"), "utf8");
assert.match(src, /sendDone\s*=/);
assert.match(src, /provider_used/);
assert.match(src, /latency_ms/);
assert.match(src, /ttft_ms/);
// no bare send({ type: "done" }) without helper for success path preference
assert.ok(
  !/send\(\{\s*type:\s*["']done["']\s*\}\)/.test(src),
  "bare send({ type: \"done\" }) should use sendDone helper",
);

console.log("agentChatDonePayload.test.js: ok");
