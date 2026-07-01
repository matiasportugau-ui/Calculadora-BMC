# Runbook — Enable tiered AI model routing for "suggest" (Wave 10)

**Goal:** route the AI orchestrator's `suggest` job (the one that drafts every
customer-facing reply) to a cheaper/faster model for some message categories, instead of
paying the current premium model's cost for every single suggestion. **Nothing about the
human-approval gate changes** — every draft still lands in `omni_suggestions` for an
operator to review in `/hub/canales` before anything goes out.

**Owner-run / human-gated — and a genuine product decision, not just a flag flip.**
Unlike most flags in this repo, this one has no single "on" switch: it's a policy choice
(*which categories, if any, get a weaker model*) that trades cost for reply quality. The
mechanism ships dormant and byte-identical to today's behavior; **you decide the policy**
by choosing which rows (if any) to seed below.

## How it works

`server/lib/omni/orchestrator/modelTiering.js` — `resolveSuggestModel(pool, category)` —
tries a category-specific `omni_model_registry` row (`task_key = "suggest:<category>"`)
before falling back to the base `task_key = "suggest"` row that's always been used. It
reuses `getEnabledModel()` (`aiRegistry.js`) unmodified — **no schema change**, `task_key`
has no CHECK constraint.

**Today, with zero tier rows seeded, this always resolves to the exact same `"suggest"`
row it did before this wave** — verified by `tests/omniModelTiering.test.js`. Nothing
changes in prod until you deliberately `INSERT` a tier row below.

### Which category?

`msg.body_ai_category` (stamped by the free, regex-based `classify` job, `CATEGORY_MAP` in
`aiWorker.js`) is one of: `cotizacion`, `product`, `inquiry`, `complaint`, `order`.

> **Ordering caveat:** `classify` and `suggest` are enqueued together but run as two
> independent jobs — `suggest` can occasionally run before its sibling `classify` job has
> stamped the category (retries, batch-boundary timing). When that happens,
> `body_ai_category` is still `null` and `resolveSuggestModel()` silently uses the base
> `"suggest"` tier. This is not a bug to fix — it's an inherent property of two
> independently-queued jobs, and it fails safe (falls back to the known-good tier).

## Steps — seeding a tier (example, adjust the category/model to your policy decision)

1. **Decide the policy first.** Which category is genuinely low-stakes enough for a
   cheaper model? `inquiry` (general chatter/follow-ups) is a plausible starting point —
   `complaint`/`order`/`cotizacion` (objections, closes, quotes) are probably NOT, since
   getting those wrong costs more in lost trust than the model savings are worth. This is
   your call, not a default this runbook picks for you.

2. **Add the model row** (owner-run SQL against the prod `omni_*` Postgres):
   ```sql
   INSERT INTO omni_model_registry
     (task_key, provider, model_id, version, max_tokens, temperature,
      cost_per_1k_input_usd, cost_per_1k_output_usd, enabled)
   VALUES
     ('suggest:inquiry', 'anthropic', 'claude-haiku-4-5', 1, 1024, 0.3,
      0.001, 0.005, true)
   ON CONFLICT (task_key, version) DO UPDATE SET enabled = EXCLUDED.enabled;
   ```
   (Provider/model/cost figures above are illustrative — check current pricing before
   using them for real budget math.)

3. **Optional — a tier-specific prompt.** If the cheaper model needs different
   instructions, insert into `omni_prompt_registry` the same way (`task_key =
   "suggest:inquiry"`). If you skip this, the `suggest` branch still uses the base
   `channel`-scoped prompt from `getEnabledPrompt(pool, "suggest", channel)` — tiering
   only changes which model answers, not which prompt is sent, unless you seed one.

4. **Verify.** Trigger (or wait for) an inbound customer message that classifies to your
   chosen category, then:
   ```sql
   SELECT job_type, status, output_json->>'model_task_key' AS model_task_key, cost_usd
   FROM omni_ai_jobs WHERE job_type = 'suggest' ORDER BY created_at DESC LIMIT 5;
   ```
   `model_task_key` should read `suggest:inquiry` for messages that classified to
   `inquiry` (once `classify` ran first — expect an occasional `suggest` on the base
   tier per the ordering caveat above, that's expected, not a failure).

## Rollback

Disable or delete the tier-specific row:
```sql
UPDATE omni_model_registry SET enabled = false WHERE task_key = 'suggest:inquiry';
```
`resolveSuggestModel()` falls straight back to the base `"suggest"` row on the very next
job — no code change, no redeploy needed.
