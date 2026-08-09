/**
 * Promote approved Learning Candidate → Training KB (IMP remaining G2).
 * Only when PAOS_PROMOTE=1. Canary → pending KB entry; active → active permanent.
 */

import { addTrainingEntry } from "./trainingKB.js";
import { isPaosPromoteEnabled } from "./paosConfig.js";
import { appendPaosEvent } from "./paosEventLedger.js";

/**
 * @param {object} candidate — full candidate row
 * @param {"canary"|"active"} mode
 * @returns {{ ok: true, trainingEntry: object } | { ok: false, error: string }}
 */
export function promoteCandidateToTrainingKb(candidate, mode = "canary") {
  if (!isPaosPromoteEnabled()) {
    return { ok: false, error: "paos_promote_disabled" };
  }
  if (!candidate || !candidate.delta) {
    return { ok: false, error: "missing_delta" };
  }
  if (mode !== "canary" && mode !== "active") {
    return { ok: false, error: "invalid_mode" };
  }
  // Only after approval states
  if (candidate.state !== "canary" && candidate.state !== "active") {
    return { ok: false, error: "candidate_not_approved_state" };
  }

  const delta = candidate.delta || {};
  const question = String(delta.question || delta.q || "").trim();
  const goodAnswer = String(delta.goodAnswer || delta.answer || "").trim();
  if (!question || !goodAnswer) {
    return { ok: false, error: "question_and_goodAnswer_required" };
  }

  const isCanary = mode === "canary" || candidate.state === "canary";
  try {
    const entry = addTrainingEntry({
      category: delta.category || "general",
      question,
      goodAnswer,
      badAnswer: delta.badAnswer || "",
      context: [
        `paos_candidate:${candidate.id}`,
        isCanary ? "paos_canary" : "paos_active",
        delta.context || "",
      ]
        .filter(Boolean)
        .join(" | "),
      source: isCanary ? "paos_canary" : "paos_promote",
      // canary stays reviewable; active is permanent org knowledge
      permanent: !isCanary,
      status: isCanary ? "pending" : "active",
      convId: candidate.sessionId || null,
    });

    appendPaosEvent({
      type: "learning.promoted_to_kb",
      sessionId: candidate.sessionId,
      payload: {
        candidateId: candidate.id,
        trainingEntryId: entry.id,
        mode: isCanary ? "canary" : "active",
        status: entry.status,
      },
    });

    return { ok: true, trainingEntry: entry };
  } catch (e) {
    return { ok: false, error: e?.message || "promote_failed" };
  }
}
