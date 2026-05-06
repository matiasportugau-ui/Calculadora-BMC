// ═══════════════════════════════════════════════════════════════════════════
// safeErr — wire-error scrubber for the identity routes.
//
// Maps known-sentinel error messages through (so 4xx callers get useful
// machine-readable codes), and masks every unexpected throw as
// "internal_error" — preventing raw pg driver messages (constraint names,
// schema names) from reaching authenticated callers. cursor[bot] round-5 LOW.
// ═══════════════════════════════════════════════════════════════════════════

const KNOWN_ERROR_CODES = new Set([
  // Generic
  "db_unavailable", "not_found", "internal_error",
  // /api/me/* + /api/access-requests
  "missing_quoteId", "missing_payload", "invalid_module", "invalid_decision",
  "invalid_level", "invalid_pdf_url", "invalid_gcs_uri",
  "userId_or_clientQuoteId_required", "quote_not_eligible", "quote_not_found",
  // /api/admin/export
  "missing_entities", "missing_formats", "pdf_not_available",
  "rate_limited",
]);

export function safeErr(e) {
  if (KNOWN_ERROR_CODES.has(e?.message)) return e.message;
  // Anything else (TypeError, pg constraint violation, etc.) is masked.
  return "internal_error";
}

export function isKnownErr(message) {
  return KNOWN_ERROR_CODES.has(message);
}
