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
 * Also owns the PATCH /omni/conversations/:id team_id authorization rule:
 * non-admins may only assign a conversation to a team they belong to, and
 * may not clear team_id (NULL = visible to every canales operator).
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
 * Authorize a team_id mutation on PATCH /omni/conversations/:id.
 *
 * Admins may set any team_id (including null). Non-admins:
 * - may NOT clear team_id to null (that publishes the thread to every operator)
 * - may only set team_id to a team they are a member of
 *
 * Fail-closed on membership lookup errors.
 *
 * @param {import('pg').Pool} pool
 * @param {{ role?: string, id?: string }} user
 * @param {string|null|undefined} teamId - undefined = not in patch
 * @returns {Promise<{ ok: true } | { ok: false, error: string, status?: number }>}
 */
export async function authorizeConversationTeamAssignment(pool, user, teamId) {
  if (teamId === undefined) return { ok: true };
  if (isOmniAdmin(user)) return { ok: true };

  if (teamId === null) {
    return { ok: false, error: "team_clear_forbidden", status: 403 };
  }

  try {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM omni_team_members
        WHERE team_id = $1::uuid AND user_id = $2::uuid`,
      [teamId, user?.id],
    );
    if (!rowCount) {
      return { ok: false, error: "team_membership_required", status: 403 };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: "team_membership_check_failed",
      status: 503,
      cause: e?.message,
    };
  }
}
