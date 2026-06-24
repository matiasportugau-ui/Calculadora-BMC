/**
 * Prompt eval + HITL feedback loop (WAVE 4 H4).
 */
import { saveFeedback } from "../../responseFeedback.js";

/**
 * @param {import('pg').Pool} pool
 * @param {object} event
 */
export async function recordOmniPromptEval(pool, event) {
  const { rows } = await pool.query(
    `INSERT INTO omni_prompt_eval (task_key, prompt_version, suggestion_id, rating, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id`,
    [
      event.task_key || "suggest",
      event.prompt_version ?? 1,
      event.suggestion_id ?? null,
      event.rating,
      JSON.stringify(event.metadata || {}),
    ],
  );

  if (event.question && event.generated_text) {
    saveFeedback({
      channel: event.channel || "chat",
      question: event.question,
      generatedText: event.generated_text,
      rating: event.rating === "accepted" ? "good" : event.rating === "rejected" ? "bad" : event.rating,
      correction: event.correction,
      convId: event.conversation_id,
    });
  }

  return { ok: true, eval_id: rows[0]?.id };
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} [taskKey]
 */
export async function getPromptEvalStats(pool, taskKey = "suggest") {
  const { rows } = await pool.query(
    `SELECT prompt_version, rating, COUNT(*)::int AS count
     FROM omni_prompt_eval
     WHERE task_key = $1
     GROUP BY prompt_version, rating
     ORDER BY prompt_version DESC, rating`,
    [taskKey],
  );
  return rows;
}
