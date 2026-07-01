/**
 * requireAssistantEnabled(key) — master-switch gate for AI-generation routes.
 *
 * Returns 503 { ok:false, reason:"assistant_disabled" } when an assistant is not
 * in config.assistantsActive. Mount it ONLY in front of AI-generation endpoints
 * (the paths that make the model answer). Inbound ingest/webhooks must stay
 * ungated so disabled assistants keep RECEIVING messages (no data loss) — they
 * just stop ANSWERING.
 *
 * Ordering: register this before the channel router so it runs first. It is a
 * no-op for `seam` and for any assistant listed in the allowlist.
 */
import { isAssistantEnabled } from "../lib/assistantRegistry.js";

/** @param {string} key */
export function requireAssistantEnabled(key) {
  return (_req, res, next) => {
    if (isAssistantEnabled(key)) return next();
    return res.status(503).json({
      ok: false,
      reason: "assistant_disabled",
      assistant: key,
      hint: "Habilitá este asistente agregando su key a ASSISTANTS_ACTIVE.",
    });
  };
}

export default requireAssistantEnabled;
