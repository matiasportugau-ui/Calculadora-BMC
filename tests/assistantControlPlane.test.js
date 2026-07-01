// ═══════════════════════════════════════════════════════════════════════════
// tests/assistantControlPlane.test.js — AI Assistant control plane
//
// Covers the master switch (isAssistantEnabled), assistant-level failover
// (dispatchAssistant), and health classification (checkAssistant). Deterministic:
// mutates the exported `config` object rather than touching the network.
//
// Run: node tests/assistantControlPlane.test.js
// ═══════════════════════════════════════════════════════════════════════════

import { config } from "../server/config.js";
import { isAssistantEnabled, dispatchAssistant, ASSISTANTS, getAssistant } from "../server/lib/assistantRegistry.js";
import { checkAssistant, _clearAssistantHealthCache } from "../server/lib/assistantHealth.js";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ ${label}`); }
}

// Snapshot to restore between blocks.
function setProviders({ claude = "", grok = "", gemini = "", openai = "" }) {
  config.anthropicApiKey = claude;
  config.grokApiKey = grok;
  config.geminiApiKey = gemini;
  config.openaiApiKey = openai;
}

await (async () => {
  // ── Registry integrity: every non-terminal assistant chains to `seam` ───────
  for (const a of ASSISTANTS) {
    if (a.terminal) continue;
    let cur = a;
    let hops = 0;
    while (cur && !cur.terminal && hops < 10) { cur = getAssistant(cur.fallbackTo); hops += 1; }
    assert(cur && cur.terminal, `${a.key} fallback chain reaches terminal seam`);
  }
  assert(getAssistant("seam")?.terminal === true, "seam is terminal");

  // ── Master switch (isAssistantEnabled) ──────────────────────────────────────
  config.assistantsActive = ["canales"];
  assert(isAssistantEnabled("canales"), "canales enabled when in allowlist");
  assert(!isAssistantEnabled("panelin"), "panelin disabled when not in allowlist");
  assert(isAssistantEnabled("seam"), "seam always enabled (terminal safety net)");

  config.assistantsActive = [];
  assert(isAssistantEnabled("seam"), "seam stays enabled even with empty allowlist");
  assert(!isAssistantEnabled("canales"), "canales disabled when allowlist empty");

  // ── dispatchAssistant: disabled short-circuit ───────────────────────────────
  config.assistantsActive = ["canales"];
  const disabled = await dispatchAssistant("panelin", [{ role: "user", content: "hola" }], {
    handler: async () => ({ text: "should not run" }),
  });
  assert(disabled.ok === false && disabled.reason === "assistant_disabled", "disabled assistant short-circuits");

  // ── dispatchAssistant: happy path served by primary handler ─────────────────
  config.assistantsActive = ["panelin"];
  const ok = await dispatchAssistant("panelin", [{ role: "user", content: "hola" }], {
    handler: async () => ({ text: "primary ok" }),
  });
  assert(ok.ok === true && ok.servedBy === "panelin", "primary handler serves when healthy");
  assert(ok.failovers.length === 0, "no failovers on happy path");

  // ── dispatchAssistant: handler throws → walks fallback to seam ───────────────
  // With no provider keys, the terminal seam (callAgentOnce) also fails, so the
  // dispatch surfaces ASSISTANT_DISPATCH_FAILED — proving the chain was walked.
  setProviders({});
  let threw = null;
  try {
    await dispatchAssistant("panelin", [{ role: "user", content: "hola" }], {
      handler: async () => { throw new Error("primary down"); },
    });
  } catch (e) {
    threw = e;
  }
  assert(threw?.code === "ASSISTANT_DISPATCH_FAILED", "handler failure walks chain to seam then fails cleanly");

  // ── Health classification ───────────────────────────────────────────────────
  _clearAssistantHealthCache();
  config.assistantsActive = ["panelin"];

  setProviders({ claude: "sk-test-claude-key" });
  const live = await checkAssistant("panelin", { force: true });
  assert(live.status === "live", "enabled + primary provider present → live");
  assert(live.activeProvider === "claude", "activeProvider is claude when available");

  setProviders({ grok: "sk-test-grok-key" }); // claude key gone, only fallback provider
  const degraded = await checkAssistant("panelin", { force: true });
  assert(degraded.status === "degraded", "enabled + only fallback provider → degraded");
  assert(degraded.activeProvider === "grok", "activeProvider falls to grok");

  setProviders({});
  const down = await checkAssistant("panelin", { force: true });
  assert(down.status === "down", "enabled + no providers → down");

  config.assistantsActive = [];
  const off = await checkAssistant("panelin", { force: true });
  assert(off.status === "disabled", "not in allowlist → disabled");
})();

console.log(`\n${failed === 0 ? "✅" : "❌"} assistantControlPlane: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
