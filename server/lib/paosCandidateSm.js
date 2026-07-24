/**
 * Learning Candidate state machine (pure) — SDD §7.3
 * Illegal: drafted → active without evaluating + pending_approval + canary path.
 */

export const PAOS_STATES = Object.freeze([
  "detected",
  "drafted",
  "evaluating",
  "pending_approval",
  "canary",
  "active",
  "rejected",
  "rolled_back",
]);

/** @type {Record<string, string[]>} */
const TRANSITIONS = {
  detected: ["drafted", "rejected"],
  drafted: ["evaluating", "rejected"],
  evaluating: ["pending_approval", "rejected"],
  pending_approval: ["canary", "active", "rejected"],
  canary: ["active", "rolled_back", "rejected"],
  active: ["rolled_back"],
  rejected: [],
  rolled_back: [],
};

/**
 * @param {string} from
 * @param {string} to
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function canTransition(from, to) {
  if (!PAOS_STATES.includes(from)) {
    return { ok: false, error: `invalid_from:${from}` };
  }
  if (!PAOS_STATES.includes(to)) {
    return { ok: false, error: `invalid_to:${to}` };
  }
  // Explicit ban: skip eval/approval
  if (from === "drafted" && to === "active") {
    return { ok: false, error: "illegal_drafted_to_active" };
  }
  if (from === "detected" && to === "active") {
    return { ok: false, error: "illegal_detected_to_active" };
  }
  if (from === "evaluating" && to === "active") {
    return { ok: false, error: "illegal_evaluating_to_active" };
  }
  const allowed = TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    return { ok: false, error: `illegal_transition:${from}->${to}` };
  }
  return { ok: true };
}

/**
 * @param {string} from
 * @param {string} to
 * @returns {string} next state
 */
export function transition(from, to) {
  const r = canTransition(from, to);
  if (!r.ok) {
    const err = new Error(r.error);
    err.code = "PAOS_ILLEGAL_TRANSITION";
    throw err;
  }
  return to;
}

/**
 * Eval fail-closed: only pending_approval if report.pass === true.
 * @param {{ pass?: boolean } | null | undefined} evalReport
 */
export function canEnterPendingApproval(evalReport) {
  return !!(evalReport && evalReport.pass === true);
}
