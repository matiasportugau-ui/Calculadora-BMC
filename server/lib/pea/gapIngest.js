/**
 * Fire-and-forget gap emitters from Panelin fast loop.
 */
import { config } from "../../config.js";
import { getOmniPool } from "../omni/omniDb.js";
import { recordGapSignal } from "./gapEvents.js";
import { sanitizeGapMetadata } from "./piiDenylist.js";

const SKIP_TOOL_ERROR_CLASSES = new Set([
  "internal:non_json",
]);

/**
 * @param {object} args
 */
export async function maybeEmitToolGap(args) {
  if (!config.peaEnabled) return null;
  const { tool, ok, errorClass, input, opts = {} } = args;
  if (ok) return null;
  if (errorClass && SKIP_TOOL_ERROR_CLASSES.has(errorClass)) return null;

  const pool = getOmniPool(config.databaseUrl);
  if (!pool) return null;

  try {
    return await recordGapSignal(pool, config, {
      source: "panelin_fast",
      signal_type: "tool_fail",
      tool_id: tool,
      session_id: opts.sessionId || opts.conversationId || null,
      conversation_id: opts.conversationId || null,
      severity: opts.severity || "medium",
      title: `Tool fail: ${tool}`,
      summary: `${tool} → ${errorClass || "error"}`,
      message_template: `${tool}:${errorClass || "error"}`,
      errorClass,
      payload: sanitizeGapMetadata({
        tool,
        error_class: errorClass,
        input_keys: input && typeof input === "object" ? Object.keys(input).slice(0, 20) : [],
      }),
    });
  } catch (err) {
    opts.logger?.warn?.({ err: err.message, tool }, "pea tool gap emit failed");
    return null;
  }
}

/**
 * Emit only when **all** providers failed (not per-provider retry).
 */
export async function maybeEmitProviderFailGap(args) {
  if (!config.peaEnabled) return null;
  const { sessionId, conversationId, errors, opts = {} } = args;
  const pool = getOmniPool(config.databaseUrl);
  if (!pool) return null;

  try {
    return await recordGapSignal(pool, config, {
      source: "panelin_fast",
      signal_type: "provider_fail",
      session_id: sessionId || null,
      conversation_id: conversationId || null,
      severity: "high",
      title: "All providers failed",
      summary: (errors || []).slice(0, 3).join("; ").slice(0, 500),
      message_template: "provider_fail:all_failed",
      payload: { errors: (errors || []).slice(0, 5) },
    });
  } catch (err) {
    opts.logger?.warn?.({ err: err.message }, "pea provider gap emit failed");
    return null;
  }
}
