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
import { isAssistantEnabled, dispatchAssistant, buildFallbackLine, ASSISTANTS, getAssistant } from "../server/lib/assistantRegistry.js";
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

  // ── buildFallbackLine: enabled-only ordered line, always ends at seam ────────
  const keysOf = (line) => line.map((n) => n.key);
  config.assistantsActive = ["canales"];
  assert(
    JSON.stringify(keysOf(buildFallbackLine("canales"))) === JSON.stringify(["canales", "seam"]),
    "canales-only line = [canales, seam]",
  );
  config.assistantsActive = ["canales", "panelin"];
  assert(
    JSON.stringify(keysOf(buildFallbackLine("canales"))) === JSON.stringify(["canales", "panelin", "seam"]),
    "line adds the other enabled assistant in priority order",
  );
  assert(
    JSON.stringify(keysOf(buildFallbackLine("panelin"))) === JSON.stringify(["panelin", "canales", "seam"]),
    "primary goes first, remaining enabled follow priority order",
  );
  config.assistantsActive = ["panelin"]; // canales disabled
  assert(
    JSON.stringify(keysOf(buildFallbackLine("panelin"))) === JSON.stringify(["panelin", "seam"]),
    "disabled assistants are excluded from the line (honors master switch)",
  );

  // ── dispatchAssistant: disabled short-circuit ───────────────────────────────
  config.assistantsActive = ["canales"];
  const disabled = await dispatchAssistant("panelin", [{ role: "user", content: "hola" }], {
    handler: async () => ({ text: "should not run" }),
  });
  assert(disabled.ok === false && disabled.reason === "assistant_disabled", "disabled assistant short-circuits");

  // ── dispatchAssistant: happy path served by primary handler ─────────────────
  // Availability requires a provider key present, so set one before dispatch.
  config.assistantsActive = ["panelin"];
  setProviders({ claude: "sk-test-claude-key" });
  const ok = await dispatchAssistant("panelin", [{ role: "user", content: "hola" }], {
    handler: async () => ({ text: "primary ok" }),
  });
  assert(ok.ok === true && ok.servedBy === "panelin", "primary handler serves when healthy");
  assert(ok.failovers.length === 0, "no failovers on happy path");

  // ── dispatchAssistant: no providers → no available agent (deterministic) ─────
  // With zero provider keys every node (incl. seam) is unavailable, so dispatch
  // skips the whole line WITHOUT running the handler and fails cleanly. Proves the
  // availability guard fires before any LLM call.
  setProviders({});
  let handlerRan = false;
  let threw = null;
  try {
    await dispatchAssistant("panelin", [{ role: "user", content: "hola" }], {
      handler: async () => { handlerRan = true; return { text: "x" }; },
    });
  } catch (e) {
    threw = e;
  }
  assert(threw?.code === "ASSISTANT_DISPATCH_FAILED", "no available agent → ASSISTANT_DISPATCH_FAILED");
  assert(handlerRan === false, "unavailable primary is skipped without spending a call");

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

  // ── email deps probe mirrors isChatwootConfigured (base+token+accountId) ─────
  // Regression: probing the token alone reported a false "live" when base or
  // accountId were missing, while every Chatwoot tool still threw. The probe now
  // uses the same gate the route/tools use. isChatwootConfigured() reads
  // process.env directly, so we drive it via env here.
  const envSnapshot = {
    base: process.env.CHATWOOT_API_BASE,
    token: process.env.CHATWOOT_API_TOKEN,
    account: process.env.CHATWOOT_ACCOUNT_ID,
  };
  const setChatwootEnv = ({ base = "", token = "", account = "" }) => {
    if (base) process.env.CHATWOOT_API_BASE = base; else delete process.env.CHATWOOT_API_BASE;
    if (token) process.env.CHATWOOT_API_TOKEN = token; else delete process.env.CHATWOOT_API_TOKEN;
    if (account) process.env.CHATWOOT_ACCOUNT_ID = account; else delete process.env.CHATWOOT_ACCOUNT_ID;
  };

  config.assistantsActive = ["email"];
  setProviders({ claude: "sk-test-claude-key" }); // isolate: deps, not providers, drive status

  setChatwootEnv({ token: "cw-token-only" }); // token but no base/accountId → NOT configured
  const emailPartial = await checkAssistant("email", { force: true });
  assert(emailPartial.status === "down", "email with only CHATWOOT_API_TOKEN → down (no false-green)");
  assert(/chatwoot not configured/i.test(emailPartial.detail), "email down detail explains chatwoot deps");

  setChatwootEnv({ base: "https://cw.example.com", token: "cw-token", account: "7" }); // fully configured
  const emailLive = await checkAssistant("email", { force: true });
  assert(emailLive.status === "live", "email fully configured (base+token+accountId) → live");

  // restore env so later suites see the original process.env
  setChatwootEnv({ base: envSnapshot.base, token: envSnapshot.token, account: envSnapshot.account });
})();

console.log(`\n${failed === 0 ? "✅" : "❌"} assistantControlPlane: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
