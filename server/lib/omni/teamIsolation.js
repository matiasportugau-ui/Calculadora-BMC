/**
 * server/lib/omni/teamIsolation.js — shared SQL-fragment builder for the
 * non-admin team-isolation predicate used by every Omni list endpoint that
 * filters `omni_conversations` (GET /omni/conversations, GET
 * /omni/actions/urgent). Previously this WHERE-fragment was copy-pasted at
 * each call site; a future change to the rule (e.g. a "team admin" role, or a
 * different join) only needs to land here once instead of being hunted down
 * across every route that lists conversations.
 *
 * Non-admins see conversations with no team plus those in teams they belong
 * to; admin/superadmin see everything (safe before any teams exist — all
 * conversations start with team_id NULL). Mirrors the single-conversation
 * check in conversationVisibleTo() (server/routes/omni.js) for the same rule
 * applied to one row instead of a list.
 *
 * Deals inherit visibility from `source_conversation_id` (LEFT JOIN alias `c`).
 * Deals with no source conversation are treated like team_id NULL — visible
 * to every canales operator (single-team deploys stay intact).
 */

export function isOmniAdmin(user) {
  const role = user?.role;
  return role === "admin" || role === "superadmin";
}

/**
 * Appends the team-isolation filter (if the role requires one) to `filters`,
 * pushing its parameter onto `params` in place — mirrors how every other
 * dynamic filter in these list routes is built, so callers can keep using
 * `$${params.length}` positional placeholders without restructuring.
 *
 * @param {{ role?: string, id?: string }} user - req.user
 * @param {string[]} filters - mutated in place
 * @param {Array} params - mutated in place
 */
export function appendTeamIsolationFilter(user, filters, params) {
  if (isOmniAdmin(user)) return;
  params.push(user.id);
  filters.push(
    `(c.team_id IS NULL OR c.team_id IN (SELECT team_id FROM omni_team_members WHERE user_id = $${params.length}::uuid))`,
  );
}

/**
 * Deal list filter: same team rule via the deal's source conversation.
 * Requires `LEFT JOIN omni_conversations c ON c.id = d.source_conversation_id`.
 *
 * @param {{ role?: string, id?: string }} user
 * @param {string[]} filters
 * @param {Array} params
 */
export function appendDealTeamIsolationFilter(user, filters, params) {
  if (isOmniAdmin(user)) return;
  params.push(user.id);
  filters.push(
    `(d.source_conversation_id IS NULL
      OR (c.id IS NOT NULL
          AND (c.team_id IS NULL
               OR c.team_id IN (SELECT team_id FROM omni_team_members WHERE user_id = $${params.length}::uuid))))`,
  );
}

/**
 * Single-deal visibility (PATCH/stage). Admins see any existing deal.
 * Non-admins see unteamed / no-conversation deals plus deals whose source
 * conversation is in their teams. Broken FK (missing conversation) → deny.
 *
 * @param {import('pg').Pool} pool
 * @param {string} dealId
 * @param {{ role?: string, id?: string }} user
 */
export async function dealVisibleTo(pool, dealId, user) {
  if (isOmniAdmin(user)) {
    const { rowCount } = await pool.query(`SELECT 1 FROM omni_deals WHERE id = $1`, [dealId]);
    return rowCount > 0;
  }
  const { rowCount } = await pool.query(
    `SELECT 1 FROM omni_deals d
       LEFT JOIN omni_conversations c ON c.id = d.source_conversation_id
      WHERE d.id = $1
        AND (
          d.source_conversation_id IS NULL
          OR (
            c.id IS NOT NULL
            AND (c.team_id IS NULL
                 OR c.team_id IN (SELECT team_id FROM omni_team_members WHERE user_id = $2::uuid))
          )
        )`,
    [dealId, user?.id],
  );
  return rowCount > 0;
}
