/**
 * Omni trace / correlation IDs (WAVE 3 K1).
 */
import crypto from "node:crypto";

export function generateTraceId() {
  return crypto.randomUUID();
}

/**
 * @param {import('express').Request} req
 * @param {object} [extra]
 */
export function omniLogContext(req, extra = {}) {
  const traceId =
    req?.headers?.["x-trace-id"] ||
    req?.headers?.["x-request-id"] ||
    extra.trace_id ||
    generateTraceId();
  return { trace_id: traceId, ...extra };
}

/**
 * @param {object} logger — pino logger
 * @param {object} fields
 */
export function childOmniLogger(logger, fields) {
  if (!logger?.child) return logger || { info() {}, warn() {}, error() {} };
  return logger.child(fields);
}
