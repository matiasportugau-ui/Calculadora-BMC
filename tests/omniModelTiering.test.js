// tests/omniModelTiering.test.js — standalone (no real DB) unit test for the
// dormant-by-default "suggest" model tiering mechanism.
// Run: `node tests/omniModelTiering.test.js`.
import assert from "node:assert/strict";
import {
  resolveSuggestTaskKeyCandidates,
  resolveSuggestModel,
} from "../server/lib/omni/orchestrator/modelTiering.js";

let passed = 0;
function check(name, fn) {
  return Promise.resolve(fn()).then(() => {
    passed += 1;
    console.log(`  ok ${name}`);
  });
}

// ── resolveSuggestTaskKeyCandidates (pure) ──────────────────────────────────

check("null/undefined category → only the base key", () => {
  assert.deepEqual(resolveSuggestTaskKeyCandidates(null), ["suggest"]);
  assert.deepEqual(resolveSuggestTaskKeyCandidates(undefined), ["suggest"]);
});

check("empty/whitespace-only category → only the base key", () => {
  assert.deepEqual(resolveSuggestTaskKeyCandidates(""), ["suggest"]);
  assert.deepEqual(resolveSuggestTaskKeyCandidates("   "), ["suggest"]);
});

check("known category → tier-specific key first, base key as guaranteed fallback", () => {
  assert.deepEqual(resolveSuggestTaskKeyCandidates("complaint"), ["suggest:complaint", "suggest"]);
});

check("unrecognized/garbage category string never throws, still ends in base key", () => {
  const candidates = resolveSuggestTaskKeyCandidates("!!not_a_real_category??");
  assert.equal(candidates[candidates.length - 1], "suggest");
});

// ── resolveSuggestModel (thin wrapper over a mock registry lookup) ─────────

/** Mock db whose query() answers getEnabledModel()'s exact SQL shape by task_key. */
function makeMockDb(modelsByTaskKey) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push(params[0]);
      const taskKey = params[0];
      const row = modelsByTaskKey[taskKey];
      return { rows: row ? [row] : [] };
    },
  };
}

await check("no tier row seeded (today's real registry state) → falls back to the base 'suggest' row, one query", async () => {
  const baseModel = { version: 1, provider: "anthropic", model_id: "claude-sonnet-4-6" };
  const db = makeMockDb({ suggest: baseModel });
  const { model, taskKey } = await resolveSuggestModel(db, "complaint");
  assert.equal(taskKey, "suggest");
  assert.equal(model.model_id, "claude-sonnet-4-6");
  // Tries "suggest:complaint" first (miss), then "suggest" (hit) — 2 queries,
  // never more, never skips the tier check.
  assert.deepEqual(db.calls, ["suggest:complaint", "suggest"]);
});

await check("tier row present and enabled → resolves to the tier, not the base", async () => {
  const db = makeMockDb({
    "suggest:complaint": { version: 1, provider: "openai", model_id: "gpt-4o-mini" },
    suggest: { version: 1, provider: "anthropic", model_id: "claude-sonnet-4-6" },
  });
  const { model, taskKey } = await resolveSuggestModel(db, "complaint");
  assert.equal(taskKey, "suggest:complaint");
  assert.equal(model.model_id, "gpt-4o-mini");
});

await check("null category → exactly one query (the base key only, no wasted tier lookup)", async () => {
  const db = makeMockDb({ suggest: { version: 1, provider: "anthropic", model_id: "claude-sonnet-4-6" } });
  const { taskKey } = await resolveSuggestModel(db, null);
  assert.equal(taskKey, "suggest");
  assert.deepEqual(db.calls, ["suggest"]);
});

await check("registry fully disabled (no rows anywhere) → model is null, same shape aiWorker.js expects", async () => {
  const db = makeMockDb({});
  const { model, taskKey } = await resolveSuggestModel(db, "complaint");
  assert.equal(model, null);
  assert.equal(taskKey, "suggest", "still reports the base key it ultimately tried");
});

console.log(`\nomni modelTiering: ${passed} checks passed`);
