/**
 * Simulated next Live rounds against coalesce + noise + store merge.
 * Run: node tests/voiceRoundSimulation.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "voice-rounds-"));
process.env.KERNEL_STORE_PATH = path.join(tmpDir, "store.json");

const { coalesceUserTranscript } = await import("../src/utils/voiceTranscriptCoalesce.js");
const { isNoiseUtterance } = await import("../src/utils/voiceNoiseFilter.js");
const {
  resetStore,
  ingestConversationTurn,
  resetLiveSession,
  loadStore,
  saveStore,
  readConversationLog,
} = await import("../server/lib/kernel/store.js");
const { seedPanelin } = await import("../server/lib/kernel/provision.js");

console.log("\n— voiceRoundSimulation (next rounds)\n");

function simChat(utterances, t0 = 1_700_000_000_000) {
  let lines = [];
  utterances.forEach((u, i) => {
    if (isNoiseUtterance(u)) return;
    lines = coalesceUserTranscript(lines, u, t0 + i * 700);
  });
  return lines;
}

// Round 1 — growing ASR, one spoken sentence
{
  const lines = simChat([
    "Hola, Kernel.",
    "Hola, Kernel. esto lo estoy diciendo una sola vez",
    "Hola, Kernel. esto lo estoy diciendo una sola vez. ¿cuántas veces?",
    "Hola, Kernel. esto lo estoy diciendo una sola vez. ¿cuántas veces?",
  ]);
  assert.equal(lines.length, 1, "R1: one bubble");
}

// Round 2 — shh loop must not reach the agent
{
  const lines = simChat(["Shh", "Shh.", "Sh", "ok", "Look"]);
  assert.equal(lines.length, 0, "R2: fillers never become bubbles");
}

// Round 3 — real request after noise
{
  const lines = simChat(["Shh", "cotizame un techo IsoDec 50"]);
  assert.equal(lines.length, 1, "R3: real request survives");
  assert.match(lines[0].text, /IsoDec/i);
}

// Round 4 — store merge + reset
{
  resetStore();
  seedPanelin();
  const st = loadStore();
  const noiseHit = ingestConversationTurn(st, {
    speaker: "operator",
    role: "operator",
    text: "Shh",
    addressed_to: "other_agent",
    timestamp: new Date().toISOString(),
  });
  assert.equal(noiseHit.ignored, true, "R4: shh ignored");
  ingestConversationTurn(st, {
    speaker: "operator",
    role: "operator",
    text: "Hola Panelin, cotizame fachada",
    addressed_to: "other_agent",
    timestamp: new Date().toISOString(),
  });
  saveStore(st);
  const after = loadStore();
  const noise = readConversationLog(after, { limit: 20 }).filter((t) => /shh/i.test(t.text));
  assert.equal(noise.length, 0, "R4: store drops shh");
  resetLiveSession(after);
  const fresh = loadStore();
  assert.equal(fresh.conversation.length, 0, "R4: reset wipes log");
  assert.equal(fresh.activeAgentId, "panelin", "R4: back to Panelin");
  assert.ok(fresh.agents.panelin, "R4: Panelin survives reset");
}

// Round 5 — exclusive mute policy (pure)
{
  function exclusiveUnmute(who, state) {
    if (who === "kernel") return { agentMuted: true, kernelMuted: false };
    if (who === "agent") return { agentMuted: false, kernelMuted: true };
    return state;
  }
  const s1 = exclusiveUnmute("kernel", { agentMuted: false, kernelMuted: true });
  assert.equal(s1.agentMuted, true);
  assert.equal(s1.kernelMuted, false);
  const s2 = exclusiveUnmute("agent", s1);
  assert.equal(s2.agentMuted, false);
  assert.equal(s2.kernelMuted, true);
}

console.log("  ✅ 5 simulated rounds passed\n");

try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch { /* ignore */ }
