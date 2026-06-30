// conversationStatus.js — single source of truth for omni conversation statuses.
// Intentionally dependency-free (no config/db imports) so route validators and
// unit tests can import it standalone. Seed default is 'open' (001_core.sql).
export const ALLOWED_CONVERSATION_STATUSES = ["open", "pending", "snoozed", "closed"];
