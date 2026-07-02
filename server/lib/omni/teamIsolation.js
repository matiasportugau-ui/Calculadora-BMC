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
  const role = user?.role;
  if (role === "admin" || role === "superadmin") return;
  params.push(user.id);
  filters.push(
    `(c.team_id IS NULL OR c.team_id IN (SELECT team_id FROM omni_team_members WHERE user_id = $${params.length}::uuid))`,
  );
}
