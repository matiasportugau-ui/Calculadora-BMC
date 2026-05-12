/**
 * Soft per-session / per-IP budget for the Panelin agent chat.
 *
 * In-memory windowed counter. Cold-start wipes it (Cloud Run): acceptable
 * because the goal is "stop runaway loops within a session", not long-term
 * accounting (long-term lives in pino logs / future Langfuse).
 *
 * Activated by env BUDGET_ENABLED=true. Default OFF so this module is a
 * no-op in current production until explicitly turned on.
 *
 * Identity: prefer conversationId (stable per chat tab); fall back to IP.
 *
 * Three windows are tracked simultaneously (1 min, 5 min, 24 h). Any one
 * exceeded → reject with 429 + retryAfterSec. Caller decides shape.
 */

const records = new Map(); // identity -> { ts, kind: "turn"|"token", value }[]
const MAX_RECORDS_PER_IDENTITY = 5000; // safety cap, rotates oldest first
const MAX_IDENTITIES = 10000;          // safety cap on map size, evicts oldest

const WINDOWS = Object.freeze({
  m1: 60 * 1000,
  m5: 5 * 60 * 1000,
  h24: 24 * 60 * 60 * 1000,
});

function now() {
  return Date.now();
}

function getList(identity) {
  let list = records.get(identity);
  if (!list) {
    if (records.size >= MAX_IDENTITIES) {
      // Evict the oldest identity (Map preserves insertion order).
      const oldest = records.keys().next().value;
      if (oldest != null) records.delete(oldest);
    }
    list = [];
    records.set(identity, list);
  }
  return list;
}

function pruneOlderThan(list, cutoff) {
  let i = 0;
  while (i < list.length && list[i].ts < cutoff) i += 1;
  if (i > 0) list.splice(0, i);
}

function sumIn(list, kind, since) {
  let total = 0;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const r = list[i];
    if (r.ts < since) break;
    if (r.kind === kind) total += r.value;
  }
  return total;
}

/**
 * Atomically check + record one chat turn (and optional token estimate).
 *
 * @param {object} args
 * @param {string} args.identity            Conversation id, IP, or "anon".
 * @param {object} args.caps                { turnsPerMin, turnsPer5Min, turnsPer24h, tokensPer24h }
 * @param {number} [args.tokensEstimate=0]  Tokens this turn is expected to add (input+output estimate).
 * @returns {{ ok: true } | { ok: false, reason: string, retryAfterSec: number, scope: string }}
 */
export function checkAndCount({ identity, caps, tokensEstimate = 0 }) {
  if (!identity || typeof identity !== "string") identity = "anon";
  const t = now();
  const list = getList(identity);

  // Prune anything outside the largest window we care about.
  pruneOlderThan(list, t - WINDOWS.h24);

  const turnsM1 = sumIn(list, "turn", t - WINDOWS.m1);
  const turnsM5 = sumIn(list, "turn", t - WINDOWS.m5);
  const turnsH24 = sumIn(list, "turn", t - WINDOWS.h24);
  const tokensH24 = sumIn(list, "token", t - WINDOWS.h24);

  if (Number.isFinite(caps.turnsPerMin) && turnsM1 + 1 > caps.turnsPerMin) {
    return { ok: false, reason: "turn_cap_1min", retryAfterSec: 60, scope: "1min" };
  }
  if (Number.isFinite(caps.turnsPer5Min) && turnsM5 + 1 > caps.turnsPer5Min) {
    return { ok: false, reason: "turn_cap_5min", retryAfterSec: 300, scope: "5min" };
  }
  if (Number.isFinite(caps.turnsPer24h) && turnsH24 + 1 > caps.turnsPer24h) {
    return { ok: false, reason: "turn_cap_24h", retryAfterSec: 24 * 60 * 60, scope: "24h" };
  }
  if (Number.isFinite(caps.tokensPer24h) && tokensH24 + tokensEstimate > caps.tokensPer24h) {
    return { ok: false, reason: "token_cap_24h", retryAfterSec: 24 * 60 * 60, scope: "24h" };
  }

  list.push({ ts: t, kind: "turn", value: 1 });
  if (tokensEstimate > 0) {
    list.push({ ts: t, kind: "token", value: tokensEstimate });
  }
  if (list.length > MAX_RECORDS_PER_IDENTITY) {
    list.splice(0, list.length - MAX_RECORDS_PER_IDENTITY);
  }
  return { ok: true };
}

/**
 * Read-only stats for a given identity (used by ops endpoints / tests).
 */
export function getStats(identity) {
  const list = records.get(identity) || [];
  const t = now();
  return {
    identity,
    turns_1min: sumIn(list, "turn", t - WINDOWS.m1),
    turns_5min: sumIn(list, "turn", t - WINDOWS.m5),
    turns_24h: sumIn(list, "turn", t - WINDOWS.h24),
    tokens_24h: sumIn(list, "token", t - WINDOWS.h24),
    records: list.length,
  };
}

/** Test-only. */
export function _resetBudgetForTests() {
  records.clear();
}

export const BUDGET_WINDOWS_MS = WINDOWS;
