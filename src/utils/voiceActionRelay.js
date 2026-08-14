/**
 * Decide whether a voice realtime function-call may be applied after
 * POST /api/agent/voice/action.
 *
 * Bug EC: the browser used to fail-open (apply raw args + tell the model
 * `{ok:true}`) when the relay returned non-OK HTTP, threw, or returned
 * `{ok:false}` without `rejected`. That skipped buildQuote validation /
 * preview and let setLP/setFlete mutate money state on 401/429/5xx.
 */

/**
 * @param {{
 *   fnName: string,
 *   rawArgs?: object,
 *   relayOk?: boolean,
 *   relayStatus?: number,
 *   relayData?: object | null,
 *   networkError?: unknown,
 * }} input
 * @returns {{
 *   apply: boolean,
 *   action?: { type: string, payload?: unknown, preview?: unknown, warnings?: unknown },
 *   modelOutput: object,
 *   reason: string,
 * }}
 */
export function decideVoiceActionRelay(input = {}) {
  const fnName = String(input.fnName || "").trim() || "unknown";
  const rawArgs = input.rawArgs && typeof input.rawArgs === "object" ? input.rawArgs : {};
  const rawAction = { type: fnName, payload: rawArgs };

  if (input.networkError) {
    return {
      apply: false,
      modelOutput: {
        ok: false,
        error: "relay_network_error",
        message: String(input.networkError?.message || input.networkError),
      },
      reason: "network_error",
    };
  }

  if (!input.relayOk) {
    return {
      apply: false,
      modelOutput: {
        ok: false,
        error: "relay_http_error",
        status: Number(input.relayStatus) || 0,
      },
      reason: "http_error",
    };
  }

  const relayData = input.relayData && typeof input.relayData === "object" ? input.relayData : {};

  if (relayData.rejected) {
    return {
      apply: false,
      modelOutput: { ok: false, errors: relayData.errors || ["rejected"] },
      reason: "rejected",
    };
  }

  if (relayData.ok && relayData.action && typeof relayData.action === "object" && relayData.action.type) {
    return {
      apply: true,
      action: relayData.action,
      modelOutput: { ok: true },
      reason: "validated",
    };
  }

  // ok:false without rejected, or ok:true without a usable action — never fail-open.
  return {
    apply: false,
    modelOutput: {
      ok: false,
      error: relayData.error || "relay_validation_failed",
      errors: relayData.errors,
    },
    reason: "unvalidated",
    // Expose raw only for diagnostics — callers must not apply it.
    rawAction,
  };
}
