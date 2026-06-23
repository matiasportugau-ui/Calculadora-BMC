/**
 * HITL suggestions store (WAVE 4 I1).
 */

/**
 * @param {import('pg').Pool} pool
 * @param {object} query
 */
export async function listSuggestions(pool, query = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const params = [limit];
  const filters = ["s.approval_state = 'pending'"];

  if (query.conversation_id) {
    params.push(query.conversation_id);
    filters.push(`s.conversation_id = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT s.*, m.body AS customer_message
     FROM omni_suggestions s
     JOIN omni_messages m ON m.id = s.message_id
     WHERE ${filters.join(" AND ")}
     ORDER BY s.created_at DESC
     LIMIT $1`,
    params,
  );
  return rows;
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} suggestionId
 * @param {'accept'|'reject'} action
 * @param {object} opts
 */
export async function resolveSuggestion(pool, suggestionId, action, opts = {}) {
  const nextState = action === "accept" ? "accepted" : "rejected";
  const { rows } = await pool.query(
    `UPDATE omni_suggestions SET approval_state = $2
     WHERE id = $1 AND approval_state = 'pending'
     RETURNING *`,
    [suggestionId, nextState],
  );
  const suggestion = rows[0];
  if (!suggestion) return { ok: false, error: "suggestion_not_found_or_resolved" };

  await pool.query(
    `UPDATE omni_ai_jobs SET approval_state = $2 WHERE id = $1`,
    [suggestion.job_id, nextState],
  ).catch(() => {});

  return {
    ok: true,
    suggestion,
    action,
    actor: opts.actor || "operator",
  };
}
