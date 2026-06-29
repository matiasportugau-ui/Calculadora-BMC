// conversationPatch.js — pure validation for PATCH /api/omni/conversations/:id.
// Kept separate from the route so it is unit-testable without a DB/HTTP server.
import { ALLOWED_CONVERSATION_STATUSES } from "./conversationStatus.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate an operator conversation patch.
 * Accepts { status?, tags?, priority?, assigned_to_user_id?, team_id?, snoozed_until? }.
 * Returns either { error: "<code>" } or { fields: [{ col, value, cast? }] }
 * ready to be turned into a parameterized UPDATE. `tags` is a full replace
 * (de-duped, trimmed, blanks dropped) so the UI can add AND remove labels.
 *
 * Email-manager fields (009): `assigned_to_user_id` and `team_id` take a UUID
 * (or null to clear); assigning also stamps `assigned_at`. `snoozed_until` takes
 * an ISO timestamp (or null to un-snooze). User refs are validated as UUIDs but
 * not FK-checked here — that stays a DB/application concern.
 */
export function buildConversationPatch(body = {}) {
  const { status, tags, priority, assigned_to_user_id, team_id, snoozed_until } = body || {};
  const fields = [];

  if (status !== undefined) {
    if (!ALLOWED_CONVERSATION_STATUSES.includes(status)) return { error: "invalid_status" };
    fields.push({ col: "status", value: status });
  }

  if (tags !== undefined) {
    if (!Array.isArray(tags) || tags.some((t) => typeof t !== "string")) {
      return { error: "invalid_tags" };
    }
    const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
    fields.push({ col: "tags", value: clean, cast: "text[]" });
  }

  if (priority !== undefined) {
    const p = Number(priority);
    if (!Number.isInteger(p)) return { error: "invalid_priority" };
    fields.push({ col: "priority", value: p });
  }

  if (assigned_to_user_id !== undefined) {
    if (assigned_to_user_id === null) {
      fields.push({ col: "assigned_to_user_id", value: null, cast: "uuid" });
      fields.push({ col: "assigned_at", value: null, cast: "timestamptz" });
    } else if (typeof assigned_to_user_id === "string" && UUID_RE.test(assigned_to_user_id)) {
      fields.push({ col: "assigned_to_user_id", value: assigned_to_user_id, cast: "uuid" });
      fields.push({ col: "assigned_at", value: new Date(), cast: "timestamptz" });
    } else {
      return { error: "invalid_assignee" };
    }
  }

  if (team_id !== undefined) {
    if (team_id === null) {
      fields.push({ col: "team_id", value: null, cast: "uuid" });
    } else if (typeof team_id === "string" && UUID_RE.test(team_id)) {
      fields.push({ col: "team_id", value: team_id, cast: "uuid" });
    } else {
      return { error: "invalid_team" };
    }
  }

  if (snoozed_until !== undefined) {
    if (snoozed_until === null) {
      fields.push({ col: "snoozed_until", value: null, cast: "timestamptz" });
    } else {
      const d = new Date(snoozed_until);
      if (Number.isNaN(d.getTime())) return { error: "invalid_snooze" };
      fields.push({ col: "snoozed_until", value: d, cast: "timestamptz" });
    }
  }

  if (!fields.length) return { error: "no_fields" };
  return { fields };
}
