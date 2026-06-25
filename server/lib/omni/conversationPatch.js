// conversationPatch.js — pure validation for PATCH /api/omni/conversations/:id.
// Kept separate from the route so it is unit-testable without a DB/HTTP server.
import { ALLOWED_CONVERSATION_STATUSES } from "./conversationStatus.js";

/**
 * Validate an operator conversation patch ({ status?, tags?, priority? }).
 * Returns either { error: "<code>" } or { fields: [{ col, value, cast? }] }
 * ready to be turned into a parameterized UPDATE. `tags` is a full replace
 * (de-duped, trimmed, blanks dropped) so the UI can add AND remove labels.
 */
export function buildConversationPatch(body = {}) {
  const { status, tags, priority } = body || {};
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

  if (!fields.length) return { error: "no_fields" };
  return { fields };
}
