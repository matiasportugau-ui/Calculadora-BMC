// ═══════════════════════════════════════════════════════════════════════════
// tests/aiProviderConfigKeys.test.js — usable-key gating for agent providers
//
// Drives the real shipped helpers (getApiKey / getAvailableProviders /
// buildAiOptionsResponse / getProviderChain) under controlled env so
// placeholders never appear as available agent providers.
//
// Run: node tests/aiProviderConfigKeys.test.js
// ═══════════════════════════════════════════════════════════════════════════

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { isUsableApiKey } from "../server/lib/apiKeyUtils.js";

const repoRoot = process.cwd();

const USABLE = {
  claude: "sk-ant-api03-" + "Xy9Zm2Qw8Rp4Lk7Hj".repeat(3),
  openai: "sk-proj-" + "AbCdEfGhIjKlMnOpQrSt".repeat(3),
  grok: "xai-" + "RealGrokKeyValue1234567890abcdef",
  gemini: "AIzaSy" + "RealLookingKeyValue1234567890abcd",
};

const PLACEHOLDERS = {
  openai: "sk-your-openai-api-key-here",
  claude: "sk-your-anthropic-api-key-here",
  grok: "your-grok-api-key-placeholder-xx",
  gemini: "REPLACE_ME_with_real_gemini_key",
  short: "changeme",
  empty: "",
};

// Sanity: fixture keys match isUsableApiKey (shared helper, no re-impl)
assert.equal(isUsableApiKey(USABLE.claude), true);
assert.equal(isUsableApiKey(USABLE.openai), true);
assert.equal(isUsableApiKey(USABLE.grok), true);
assert.equal(isUsableApiKey(USABLE.gemini), true);
assert.equal(isUsableApiKey(PLACEHOLDERS.openai), false);
assert.equal(isUsableApiKey(PLACEHOLDERS.claude), false);
assert.equal(isUsableApiKey(PLACEHOLDERS.grok), false);
assert.equal(isUsableApiKey(PLACEHOLDERS.gemini), false);
assert.equal(isUsableApiKey(PLACEHOLDERS.short), false);
assert.equal(isUsableApiKey(PLACEHOLDERS.empty), false);

function probe(envOverrides = {}) {
  const childEnv = {
    PATH: process.env.PATH || "",
    HOME: process.env.HOME || "",
    NODE_ENV: "production",
    APP_ENV: "production",
    DOTENV_CONFIG_QUIET: "true",
    REPO_ROOT: repoRoot,
    ANTHROPIC_API_KEY: "",
    OPENAI_API_KEY: "",
    GROK_API_KEY: "",
    GEMINI_API_KEY: "",
    OPENROUTER_API_KEY: "",
    OPENROUTER_FALLBACK_ENABLED: "",
    ...envOverrides,
  };
  const code = `
    const { pathToFileURL } = await import("node:url");
    const root = process.env.REPO_ROOT;
    const url = pathToFileURL(root + "/server/lib/aiProviderConfig.js").href + "?t=" + Date.now();
    const m = await import(url);
    const result = {
      available: m.getAvailableProviders(),
      chain: m.getProviderChain(),
      options: m.buildAiOptionsResponse(),
      keys: {
        claude: m.getApiKey("claude"),
        openai: m.getApiKey("openai"),
        grok: m.getApiKey("grok"),
        gemini: m.getApiKey("gemini"),
        openrouter: m.getApiKey("openrouter"),
      },
    };
    console.log("__RESULT__" + JSON.stringify(result));
  `;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: "/tmp",
    env: childEnv,
    encoding: "utf8",
  });
  assert.equal(child.status, 0, child.stderr || child.stdout || "probe exit non-zero");
  const line = child.stdout.split(/\r?\n/).find((e) => e.startsWith("__RESULT__"));
  assert.ok(line, "missing __RESULT__ in stdout: " + child.stdout);
  return JSON.parse(line.slice("__RESULT__".length));
}

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed++;
  console.log(`  ✓ ${label}`);
}

// (a) all empty → none available
{
  const r = probe();
  ok(r.available.length === 0, "empty env → no available providers");
  ok(r.chain.length === 0, "empty env → empty chain");
  ok(r.options.providers.length === 0, "empty env → empty ai-options providers");
  ok(r.options.autoOrder.length === 0, "empty env → empty autoOrder");
  ok(Object.values(r.keys).every((k) => k === ""), "empty env → all getApiKey empty");
}

// (a) placeholders only → none available
{
  const r = probe({
    ANTHROPIC_API_KEY: PLACEHOLDERS.claude,
    OPENAI_API_KEY: PLACEHOLDERS.openai,
    GROK_API_KEY: PLACEHOLDERS.grok,
    GEMINI_API_KEY: PLACEHOLDERS.gemini,
  });
  ok(r.available.length === 0, "placeholders only → no available providers");
  ok(r.chain.length === 0, "placeholders only → empty chain");
  ok(r.options.providers.length === 0, "placeholders only → empty options.providers");
  ok(r.keys.claude === "" && r.keys.openai === "" && r.keys.grok === "" && r.keys.gemini === "",
    "placeholders → getApiKey returns empty");
}

// (b) one usable gemini + openai placeholder → only gemini
{
  const r = probe({
    GEMINI_API_KEY: USABLE.gemini,
    OPENAI_API_KEY: PLACEHOLDERS.openai,
  });
  ok(JSON.stringify(r.available) === JSON.stringify(["gemini"]), "usable gemini only in available");
  ok(JSON.stringify(r.chain) === JSON.stringify(["gemini"]), "chain is gemini only");
  ok(r.options.providers.length === 1 && r.options.providers[0].id === "gemini",
    "ai-options exposes only gemini");
  ok(JSON.stringify(r.options.autoOrder) === JSON.stringify(["gemini"]), "autoOrder = [gemini]");
  ok(r.keys.gemini === USABLE.gemini, "getApiKey(gemini) returns usable key");
  ok(r.keys.openai === "", "getApiKey(openai) empty for placeholder");
}

// (b) claude + grok usable, others empty
{
  const r = probe({
    ANTHROPIC_API_KEY: USABLE.claude,
    GROK_API_KEY: USABLE.grok,
  });
  ok(r.available.includes("claude") && r.available.includes("grok"), "claude+grok available");
  ok(r.chain[0] === "claude" && r.chain.includes("grok"), "default order prefers claude then grok");
  ok(!r.available.includes("openai") && !r.available.includes("gemini"), "no phantom providers");
  ok(r.keys.claude.startsWith("sk-ant-"), "claude key returned");
  ok(r.keys.grok.startsWith("xai-"), "grok key returned");
}

// agentChat-style not-configured: zero usable → same signal as 503 path
{
  const r = probe({ OPENAI_API_KEY: PLACEHOLDERS.openai });
  const hasAny =
    !!r.keys.claude || !!r.keys.grok || !!r.keys.gemini || !!r.keys.openai;
  ok(!hasAny, "placeholder-only → not-configured (hasAny false)");
}

console.log(`\n✅ aiProviderConfigKeys: ${passed} assertions passed`);
