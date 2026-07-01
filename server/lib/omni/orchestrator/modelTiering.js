/**
 * server/lib/omni/orchestrator/modelTiering.js — dormant-by-default model
 * tiering for the "suggest" job (the AI-drafted, customer-facing reply).
 *
 * Mechanism only, not policy: this module decides WHICH task_key to look up in
 * the existing omni_model_registry (getEnabledModel(), aiRegistry.js) — it does
 * NOT decide which categories should route to a cheaper/weaker model. That's a
 * real quality trade-off for customer-facing drafts, left to the owner via
 * docs/team/runbooks/omni-ai-tiered-routing-enable.md, not invented here.
 *
 * With no tier-specific rows seeded in omni_model_registry (today's real
 * state), resolveSuggestModel() always falls through to the same "suggest"
 * row aiWorker.js already fetched before this module existed — zero behavior
 * change until the owner deliberately seeds a `suggest:<category>` row.
 */
import { getEnabledModel } from "./aiRegistry.js";

/**
 * Ordered list of task_keys to try, most-specific first, always ending in the
 * base "suggest" key (guaranteed to exist — it's the one row seeded today).
 * Pure, no I/O — the category can be null/undefined (e.g. the sibling
 * `classify` job for this message hasn't run yet; job ordering between
 * classify and suggest is NOT guaranteed) or an unrecognized string; both
 * degrade to trying only the base key.
 *
 * @param {string|null|undefined} category - omni_messages.body_ai_category
 * @returns {string[]}
 */
export function resolveSuggestTaskKeyCandidates(category) {
  const c = typeof category === "string" ? category.trim() : "";
  if (!c) return ["suggest"];
  return [`suggest:${c}`, "suggest"];
}

/**
 * Resolve the model registry row the "suggest" job should use, trying
 * tier-specific task_keys before the base "suggest" key. Reuses
 * getEnabledModel() unmodified — no new query shape, no schema change.
 *
 * @param {import('pg').PoolClient|import('pg').Pool} db
 * @param {string|null|undefined} category
 * @returns {Promise<{model: object|null, taskKey: string}>}
 */
export async function resolveSuggestModel(db, category) {
  const candidates = resolveSuggestTaskKeyCandidates(category);
  for (const taskKey of candidates) {
    const model = await getEnabledModel(db, taskKey);
    if (model) return { model, taskKey };
  }
  return { model: null, taskKey: candidates[candidates.length - 1] };
}
