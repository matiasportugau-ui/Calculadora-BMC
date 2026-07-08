import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();

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
  const result = probeProviderConfig({ OPENROUTER_API_KEY: "test-openrouter-key" });
  assert.deepEqual(result.available, []);
  assert.deepEqual(result.chain, []);
  assert.deepEqual(result.options.autoOrder, []);
}

{
  const result = probeProviderConfig({
    OPENROUTER_API_KEY: "test-openrouter-key",
    OPENROUTER_FALLBACK_ENABLED: "1",
  });
  assert.deepEqual(result.available, ["openrouter"]);
  assert.deepEqual(result.chain, ["openrouter"]);
}

{
  const result = probeProviderConfig({
    ANTHROPIC_API_KEY: "test-anthropic-key",
    OPENROUTER_API_KEY: "test-openrouter-key",
  });
  assert.deepEqual(result.available, ["claude"]);
  assert.deepEqual(result.chain, ["claude"]);
}

console.log("aiProviderConfigOpenRouter tests OK");
