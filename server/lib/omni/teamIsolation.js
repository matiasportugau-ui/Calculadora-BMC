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
 * SQL + params for GET /omni/contacts/duplicates.
 * Non-admins only scan contacts that have ≥1 conversation visible to their
 * team(s) — same visibility rule as GET /omni/contacts. conversation_count
 * is also scoped so peer-team volume is not leaked via the cluster payload.
 *
 * @param {{ role?: string, id?: string }} user
 * @param {number} [scanLimit=5000]
 * @returns {{ sql: string, params: unknown[] }}
 */
export function buildDuplicateContactsScanQuery(user, scanLimit = 5000) {
  const params = [scanLimit];
  const filters = [];
  appendTeamIsolationFilter(user, filters, params);
  const teamPred = filters[0] || null;
  const visibility = teamPred
    ? `AND EXISTS (SELECT 1 FROM omni_conversations c WHERE c.contact_id = co.id AND ${teamPred})`
    : "";
  const countScope = teamPred ? `AND ${teamPred}` : "";

  const sql = `SELECT co.id, co.name, co.email, co.phone, co.wa_phone, co.ml_user_id, co.created_at,
                (SELECT COUNT(*)::int FROM omni_conversations c WHERE c.contact_id = co.id ${countScope}) AS conversation_count
           FROM omni_contacts co
          WHERE (co.email IS NOT NULL OR co.phone IS NOT NULL OR co.wa_phone IS NOT NULL)
            AND co.properties->>'merged_into' IS NULL
            ${visibility}
          ORDER BY co.updated_at DESC
          LIMIT $1`;

  return { sql, params };
}
