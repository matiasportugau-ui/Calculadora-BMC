import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();

/** Real-looking keys that pass isUsableApiKey (len ≥ 20, no placeholder tokens). */
const USABLE_OR = "or-v1-" + "AbCdEfGhIjKlMnOpQrStUvWx".repeat(2); // ~54 chars
const USABLE_CLAUDE = "sk-ant-api03-" + "Xy9Zm2Qw8Rp4Lk7Hj".repeat(3); // long
const USABLE_GEMINI = "AIzaSy" + "RealLookingKeyValue1234567890abcd"; // ~40
const PLACEHOLDER_OPENAI = "sk-your-openai-api-key-here";
const PLACEHOLDER_SHORT = "test-openrouter-key"; // short + "test" token

function probeProviderConfig(envOverrides = {}) {
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
    const configUrl = pathToFileURL(root + "/server/lib/aiProviderConfig.js").href + "?t=" + Date.now();
    const m = await import(configUrl);
    const result = {
      available: m.getAvailableProviders(),
      chain: m.getProviderChain(),
      options: m.buildAiOptionsResponse(),
      getApiKeyClaude: m.getApiKey("claude"),
      getApiKeyOpenai: m.getApiKey("openai"),
      getApiKeyGrok: m.getApiKey("grok"),
      getApiKeyGemini: m.getApiKey("gemini"),
      getApiKeyOr: m.getApiKey("openrouter"),
    };
    console.log("__RESULT__" + JSON.stringify(result));
  `;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: "/tmp",
    env: childEnv,
    encoding: "utf8",
  });
  assert.equal(child.status, 0, child.stderr || child.stdout);
  const line = child.stdout.split(/\r?\n/).find((entry) => entry.startsWith("__RESULT__"));
  assert.ok(line, child.stdout);
  return JSON.parse(line.slice("__RESULT__".length));
}

{
  // Short / placeholder-style openrouter key must NOT count as available
  // even when fallback is enabled (isUsableApiKey rejects it).
  const result = probeProviderConfig({ OPENROUTER_API_KEY: PLACEHOLDER_SHORT });
  assert.deepEqual(result.available, []);
  assert.deepEqual(result.chain, []);
  assert.deepEqual(result.options.autoOrder, []);
  assert.equal(result.getApiKeyOr, "");
}

{
  const result = probeProviderConfig({
    OPENROUTER_API_KEY: USABLE_OR,
    OPENROUTER_FALLBACK_ENABLED: "1",
  });
  assert.deepEqual(result.available, ["openrouter"]);
  assert.deepEqual(result.chain, ["openrouter"]);
  assert.ok(result.getApiKeyOr.length > 0);
}

{
  const result = probeProviderConfig({
    ANTHROPIC_API_KEY: USABLE_CLAUDE,
    OPENROUTER_API_KEY: USABLE_OR,
  });
  assert.deepEqual(result.available, ["claude"]);
  assert.deepEqual(result.chain, ["claude"]);
}

// ── placeholder rejection via central getApiKey / availability ───────────────
{
  const result = probeProviderConfig({
    OPENAI_API_KEY: PLACEHOLDER_OPENAI,
    ANTHROPIC_API_KEY: "sk-your-anthropic-key-here-long",
    GROK_API_KEY: "your-grok-api-key-placeholder-xx",
    GEMINI_API_KEY: "REPLACE_ME_with_real_gemini_key",
  });
  assert.deepEqual(result.available, [], "placeholders must not appear as available");
  assert.deepEqual(result.chain, []);
  assert.deepEqual(result.options.providers, []);
  assert.deepEqual(result.options.autoOrder, []);
  assert.equal(result.getApiKeyClaude, "");
  assert.equal(result.getApiKeyOpenai, "");
  assert.equal(result.getApiKeyGrok, "");
  assert.equal(result.getApiKeyGemini, "");
}

{
  const result = probeProviderConfig({
    OPENAI_API_KEY: PLACEHOLDER_OPENAI,
    GEMINI_API_KEY: USABLE_GEMINI,
  });
  assert.deepEqual(result.available, ["gemini"]);
  assert.deepEqual(result.chain, ["gemini"]);
  assert.equal(result.options.providers.map((p) => p.id).join(","), "gemini");
  assert.deepEqual(result.options.autoOrder, ["gemini"]);
  assert.equal(result.getApiKeyOpenai, "", "openai placeholder → empty");
  assert.ok(result.getApiKeyGemini.length >= 20, "usable gemini key returned");
}

{
  const result = probeProviderConfig({
    ANTHROPIC_API_KEY: USABLE_CLAUDE,
    GEMINI_API_KEY: USABLE_GEMINI,
    OPENAI_API_KEY: PLACEHOLDER_OPENAI,
  });
  assert.ok(result.available.includes("claude"));
  assert.ok(result.available.includes("gemini"));
  assert.ok(!result.available.includes("openai"));
  assert.deepEqual(result.chain, ["claude", "gemini"]);
  assert.ok(result.options.autoOrder.includes("claude"));
  assert.ok(result.options.autoOrder.includes("gemini"));
  assert.ok(!result.options.autoOrder.includes("openai"));
}

console.log("aiProviderConfigOpenRouter tests OK");
