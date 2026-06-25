/**
 * omni_deals CRUD (WAVE 4 F1).
 */
import { canTransition, isTerminalStage, normalizeStage } from "./stageMachine.js";

/**
 * @param {import('pg').Pool} pool
 * @param {object} input
 */
export async function createDeal(pool, input) {
  const stage = normalizeStage(input.stage) || "lead";
  const { rows } = await pool.query(
    `INSERT INTO omni_deals
       (contact_id, title, value_usd, stage, source_channel, source_conversation_id,
        owner_agent_id, expected_close_date, properties)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING *`,
    [
      input.contact_id,
      String(input.title || "Oportunidad").slice(0, 512),
      input.value_usd ?? null,
      stage,
      input.source_channel ?? null,
      input.source_conversation_id ?? null,
      input.owner_agent_id ?? null,
      input.expected_close_date ?? null,
      JSON.stringify(input.properties || {}),
    ],
  );
  return rows[0];
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} dealId
 * @param {object} patch
 */
export async function updateDeal(pool, dealId, patch) {
  const { rows: existingRows } = await pool.query(`SELECT * FROM omni_deals WHERE id = $1`, [dealId]);
  const existing = existingRows[0];
  if (!existing) return { ok: false, error: "deal_not_found" };

  const nextStage = patch.stage != null ? normalizeStage(patch.stage) : existing.stage;
  if (patch.stage != null && !canTransition(existing.stage, nextStage)) {
    return { ok: false, error: "invalid_stage_transition", from: existing.stage, to: nextStage };
  }

  const closedAt =
    patch.closed_at ??
    (patch.stage && isTerminalStage(nextStage) ? new Date().toISOString() : existing.closed_at);

  const { rows } = await pool.query(
    `UPDATE omni_deals SET
       title = COALESCE($2, title),
       value_usd = COALESCE($3, value_usd),
       stage = COALESCE($4, stage),
       owner_agent_id = COALESCE($5, owner_agent_id),
       expected_close_date = COALESCE($6, expected_close_date),
       closed_at = $7,
       properties = COALESCE($8::jsonb, properties),
       updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      dealId,
      patch.title ?? null,
      patch.value_usd ?? null,
      patch.stage != null ? nextStage : null,
      patch.owner_agent_id ?? null,
      patch.expected_close_date ?? null,
      closedAt,
      patch.properties ? JSON.stringify(patch.properties) : null,
    ],
  );
  return { ok: true, deal: rows[0] };
}

/**
 * @param {import('pg').Pool} pool
 * @param {object} query
 */
export async function listDeals(pool, query = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 500);
  const offset = Math.max(Number(query.offset) || 0, 0);
  const params = [limit, offset];
  const filters = [];

  if (query.stage) {
    params.push(String(query.stage));
    filters.push(`d.stage = $${params.length}`);
  }
  if (query.contact_id) {
    params.push(query.contact_id);
    filters.push(`d.contact_id = $${params.length}`);
  }
  if (query.source_conversation_id) {
    params.push(query.source_conversation_id);
    filters.push(`d.source_conversation_id = $${params.length}`);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT d.*, co.name AS contact_name, co.email AS contact_email, co.wa_phone
     FROM omni_deals d
     JOIN omni_contacts co ON co.id = d.contact_id
     ${where}
     ORDER BY d.updated_at DESC
     LIMIT $1 OFFSET $2`,
    params,
  );
  return rows;
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} conversationId
 */
export async function findOpenDealForConversation(pool, conversationId) {
  const { rows } = await pool.query(
    `SELECT * FROM omni_deals
     WHERE source_conversation_id = $1
       AND stage NOT IN ('closed_won', 'closed_lost')
     ORDER BY updated_at DESC
     LIMIT 1`,
    [conversationId],
  );
  return rows[0] || null;
}
