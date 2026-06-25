/**
 * Prompt / model registry helpers (WAVE 3 E3).
 */

/**
 * @param {import('pg').PoolClient|import('pg').Pool} db
 * @param {string} taskKey
 * @param {string|null} channel
 */
export async function getEnabledPrompt(db, taskKey, channel = null) {
  const { rows } = await db.query(
    `SELECT version, system_prompt, user_template FROM omni_prompt_registry
     WHERE task_key = $1 AND enabled = true
       AND (channel IS NULL OR channel = $2)
     ORDER BY CASE WHEN channel IS NOT NULL THEN 0 ELSE 1 END, version DESC
     LIMIT 1`,
    [taskKey, channel],
  );
  return rows[0] || null;
}

/**
 * @param {import('pg').PoolClient|import('pg').Pool} db
 * @param {string} taskKey
 */
export async function getEnabledModel(db, taskKey) {
  const { rows } = await db.query(
    // pg returns NUMERIC as JS strings; cast to float8 so temperature/costs are
    // numbers. A string temperature ("0.30") is rejected by the AI providers
    // (claude 400, grok 422 "temperature: invalid") when forwarded in the request.
    `SELECT version, provider, model_id, max_tokens,
            temperature::double precision AS temperature,
            cost_per_1k_input_usd::double precision AS cost_per_1k_input_usd,
            cost_per_1k_output_usd::double precision AS cost_per_1k_output_usd
     FROM omni_model_registry
     WHERE task_key = $1 AND enabled = true
     ORDER BY version DESC LIMIT 1`,
    [taskKey],
  );
  return rows[0] || null;
}

/**
 * @param {import('pg').Pool} pool
 */
export async function listPromptRegistry(pool) {
  const { rows } = await pool.query(
    `SELECT id, task_key, channel, version, enabled, created_at
     FROM omni_prompt_registry ORDER BY task_key, version DESC`,
  );
  return rows;
}

/**
 * @param {import('pg').Pool} pool
 */
export async function listModelRegistry(pool) {
  const { rows } = await pool.query(
    `SELECT id, task_key, provider, model_id, version, enabled, created_at
     FROM omni_model_registry ORDER BY task_key, version DESC`,
  );
  return rows;
}

/**
 * Public contract for Agents squad (H1 → I2).
 * @param {import('pg').Pool} pool
 * @param {string} taskKey
 * @param {string|null} [channel]
 */
export async function getActivePromptContract(pool, taskKey, channel = null) {
  const prompt = await getEnabledPrompt(pool, taskKey, channel);
  const model = await getEnabledModel(pool, taskKey);
  return {
    task_key: taskKey,
    channel,
    prompt_version: prompt?.version ?? null,
    model_version: model?.version ?? null,
    enabled: Boolean(prompt && model),
    // system_prompt intentionally omitted — it contains internal business
    // logic and this contract is returned over HTTP (/internal/omni/prompts/...).
    model: model
      ? { provider: model.provider, model_id: model.model_id, max_tokens: model.max_tokens }
      : null,
  };
}
