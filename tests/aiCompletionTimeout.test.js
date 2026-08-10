/**
 * tests/aiCompletionTimeout.test.js — callAiCompletion must not hang forever
 * on a stalled first provider (regression from teamAssist #1012 dropping the
 * 30s AbortController when switching to callAiCompletion).
 *
 * Run: node tests/aiCompletionTimeout.test.js
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(
  path.join(__dirname, "../server/lib/aiCompletion.js"),
  "utf8",
);

let pass = 0;
let fail = 0;
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    fail++;
    console.error(`  ❌ ${name}\n     ${err.message}`);
  }
}

console.log("aiCompletion — per-provider timeout");

t("imports PROVIDER_TIMEOUT_MS from circuit breaker", () => {
  assert.match(src, /PROVIDER_TIMEOUT_MS/);
  assert.match(src, /providerCircuitBreaker/);
});

t("wraps provider SDK calls with withProviderTimeout", () => {
  assert.match(src, /withProviderTimeout/);
  assert.match(src, /AbortController/);
  assert.match(src, /PROVIDER_TIMEOUT/);
});

t("forwards AbortSignal to claude/openai/grok/gemini calls", () => {
  assert.match(src, /anthropic\.messages\.create\([\s\S]*\{\s*signal\s*\}/);
  assert.match(src, /openai\.chat\.completions\.create\([\s\S]*\{\s*signal\s*\}/);
  assert.match(src, /grok\.chat\.completions\.create\([\s\S]*\{\s*signal\s*\}/);
  assert.match(src, /generateContent\([\s\S]*\{\s*signal\s*\}/);
});

t("times out via Promise.race so hung SDKs cannot block failover", () => {
  assert.match(src, /Promise\.race/);
  assert.match(src, /timed out after/);
});

console.log(
  `\n════════════════════════════════════════\nRESULTADOS: ${pass} passed, ${fail} failed, ${pass + fail} total\n════════════════════════════════════════`,
);
process.exit(fail === 0 ? 0 : 1);
