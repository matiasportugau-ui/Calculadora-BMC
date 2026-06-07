// Unit tests for server/lib/aiGatewayClient.js — covers the feature-flag
// detection (isAiGatewayEnabled) under the auth precedence specified in the
// helper docstring (OIDC preferred, static API key fallback).
//
// Does NOT exercise generateText/generateObjectViaGateway because those would
// require a live AI Gateway endpoint. Those calls are smoke-tested at deploy
// time via the existing /crm/suggest-response endpoint.
//
// Run: node tests/aiGatewayClient.test.js

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

const ORIGINAL = {
  AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
  VERCEL_OIDC_TOKEN: process.env.VERCEL_OIDC_TOKEN,
};

function restoreEnv() {
  if (ORIGINAL.AI_GATEWAY_API_KEY === undefined) delete process.env.AI_GATEWAY_API_KEY;
  else process.env.AI_GATEWAY_API_KEY = ORIGINAL.AI_GATEWAY_API_KEY;
  if (ORIGINAL.VERCEL_OIDC_TOKEN === undefined) delete process.env.VERCEL_OIDC_TOKEN;
  else process.env.VERCEL_OIDC_TOKEN = ORIGINAL.VERCEL_OIDC_TOKEN;
}

/**
 * The helper reads `config.aiGatewayApiKey` (resolved at module load) for the
 * static API key, but reads `process.env.VERCEL_OIDC_TOKEN` lazily inside
 * isAiGatewayEnabled(). That asymmetry is intentional: in Vercel runtimes
 * the OIDC token rotates and is re-read each call.
 *
 * To exercise both branches we re-import the module fresh per scenario via
 * a cache-busting query string.
 */
async function loadFresh(envOverrides = {}) {
  // Rewrite the env *before* import so config.js picks up the latest value.
  for (const k of Object.keys(envOverrides)) {
    if (envOverrides[k] === undefined) delete process.env[k];
    else process.env[k] = envOverrides[k];
  }
  // Use a cache-buster so each scenario gets a fresh module instance.
  const url = new URL("../server/lib/aiGatewayClient.js", import.meta.url);
  url.search = `t=${Date.now()}-${Math.random()}`;
  return await import(url.href);
}

await group("Defaults", async () => {
  const m = await loadFresh({ AI_GATEWAY_API_KEY: "", VERCEL_OIDC_TOKEN: "" });
  assert(typeof m.isAiGatewayEnabled === "function", "isAiGatewayEnabled exported");
  assert(typeof m.generateTextViaGateway === "function", "generateTextViaGateway exported");
  assert(typeof m.generateObjectViaGateway === "function", "generateObjectViaGateway exported");
  assert(m.DEFAULT_MODEL_SLUG === "anthropic/claude-haiku-4.5", "default model slug uses dot format");
  assert(Array.isArray(m.DEFAULT_PROVIDER_ORDER), "default provider order is array");
  assert(m.DEFAULT_PROVIDER_ORDER[0] === "anthropic", "first provider is anthropic");
  assert(m.DEFAULT_PROVIDER_ORDER.includes("openai"), "includes openai");
  assert(m.DEFAULT_PROVIDER_ORDER.includes("xai"), "includes xai (grok mapped)");
  assert(m.DEFAULT_PROVIDER_ORDER.includes("google"), "includes google (gemini mapped)");
});

await group("isAiGatewayEnabled — env truth table", async () => {
  // Both unset → disabled.
  let m = await loadFresh({ AI_GATEWAY_API_KEY: "", VERCEL_OIDC_TOKEN: "" });
  assert(m.isAiGatewayEnabled() === false, "no env → disabled");

  // OIDC alone → enabled (preferred path).
  m = await loadFresh({ AI_GATEWAY_API_KEY: "", VERCEL_OIDC_TOKEN: "oidc-token-xyz" });
  assert(m.isAiGatewayEnabled() === true, "OIDC alone → enabled");

  // Static API key alone → enabled.
  m = await loadFresh({ AI_GATEWAY_API_KEY: "static-key", VERCEL_OIDC_TOKEN: "" });
  assert(m.isAiGatewayEnabled() === true, "static key alone → enabled");

  // Both set → enabled.
  m = await loadFresh({ AI_GATEWAY_API_KEY: "static-key", VERCEL_OIDC_TOKEN: "oidc-token-xyz" });
  assert(m.isAiGatewayEnabled() === true, "both set → enabled");
});

await group("generateText/Object throw when gateway disabled", async () => {
  const m = await loadFresh({ AI_GATEWAY_API_KEY: "", VERCEL_OIDC_TOKEN: "" });
  // Should reject synchronously-as-a-promise because we throw before awaiting any SDK call.
  let textErr = null;
  try { await m.generateTextViaGateway({ system: "x", prompt: "y" }); }
  catch (e) { textErr = e; }
  assert(textErr instanceof Error, "generateTextViaGateway throws when disabled");
  assert(/AI Gateway not configured/.test(String(textErr?.message)), "error message names the cause");

  let objErr = null;
  try { await m.generateObjectViaGateway({ system: "x", prompt: "y", schema: {} }); }
  catch (e) { objErr = e; }
  assert(objErr instanceof Error, "generateObjectViaGateway throws when disabled");
  assert(/AI Gateway not configured/.test(String(objErr?.message)), "error message names the cause");
});

restoreEnv();

console.log(`\naiGatewayClient: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
