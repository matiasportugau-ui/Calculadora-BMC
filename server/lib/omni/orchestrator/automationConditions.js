/**
 * Automation condition DSL evaluator (WAVE 3 F2).
 */

/**
 * @param {object} conditions — { all?, any?, none? }
 * @param {object} ctx — event context
 */
export function evaluateConditions(conditions, ctx) {
  if (!conditions || typeof conditions !== "object") return false;
  const all = Array.isArray(conditions.all) ? conditions.all : [];
  const any = Array.isArray(conditions.any) ? conditions.any : [];
  const none = Array.isArray(conditions.none) ? conditions.none : [];

  if (all.length === 0 && any.length === 0 && none.length === 0) return false;

  if (all.length && !all.every((c) => evalClause(c, ctx))) return false;
  if (any.length && !any.some((c) => evalClause(c, ctx))) return false;
  if (none.length && none.some((c) => evalClause(c, ctx))) return false;
  return true;
}

function evalClause(clause, ctx) {
  if (!clause?.field || !clause?.op) return false;
  const actual = resolveField(clause.field, ctx);
  const expected = clause.value;

  switch (clause.op) {
    case "eq":
      return actual === expected;
    case "ne":
      return actual !== expected;
    case "in":
      return Array.isArray(expected) && expected.includes(actual);
    case "nin":
      return Array.isArray(expected) && !expected.includes(actual);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "contains":
      return String(actual || "").toLowerCase().includes(String(expected || "").toLowerCase());
    case "matches":
      try {
        return new RegExp(String(expected), "i").test(String(actual || ""));
      } catch {
        return false;
      }
    case "exists":
      return actual != null && actual !== "";
    default:
      return false;
  }
}

function resolveField(field, ctx) {
  const parts = String(field).split(".");
  let cur = ctx;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

/**
 * Build evaluation context from message.ingested payload.
 */
export function buildAutomationContext(payload) {
  return {
    channel: payload.channel,
    sender: payload.message?.sender,
    body: payload.message?.body,
    body_ai_category: payload.body_ai_category,
    conversation: {
      id: payload.conversation_id,
      status: payload.conversation_status || "open",
      priority: payload.conversation_priority ?? 0,
    },
    contact: payload.contact || {},
    side_effects: payload.side_effects || {},
  };
}
