/**
 * Server-side AI verify for Logística stops (P0).
 * Uses callAiCompletion + pure normalize from src/utils/logistica/aiVerifyStop.js
 */
import { callAiCompletion } from "./aiCompletion.js";
import {
  buildAiVerifyEvidencePack,
  buildAiVerifySystemPrompt,
  buildAiVerifyUserMessage,
  normalizeAiVerifyProposal,
} from "../../src/utils/logistica/aiVerifyStop.js";

/**
 * @param {object} stop — client stop snapshot (may include pdfText)
 * @param {{ maxTokens?: number }} [opts]
 */
export async function runEnviosAiVerify(stop, opts = {}) {
  const pack = buildAiVerifyEvidencePack(stop || {});
  if (!pack.sources.length) {
    return {
      ok: false,
      error: "no_evidence",
      message: "Sin evidencia para interpretar.",
      proposal: normalizeAiVerifyProposal(null),
      evidence: pack,
    };
  }

  // Cheap short-circuit: no text signals at all
  const hasTextSignal = pack.sources.some(
    (s) => s.id !== "stop_fields" && String(s.content || "").trim().length > 8,
  );
  const hasPanels = (stop?.paneles || []).length > 0;
  if (!hasTextSignal && !hasPanels && pack.gaps.includes("sin_paneles")) {
    // Still allow LLM if raw fields might encode something in stop_fields only — but usually useless
  }

  let text;
  let provider;
  try {
    const result = await callAiCompletion({
      systemPrompt: buildAiVerifySystemPrompt(),
      userMessage: buildAiVerifyUserMessage(pack),
      maxTokens: opts.maxTokens ?? 1800,
    });
    text = result.text;
    provider = result.provider;
  } catch (err) {
    return {
      ok: false,
      error: "ai_failed",
      message: err instanceof Error ? err.message : String(err),
      details: err?.details,
      proposal: normalizeAiVerifyProposal(null),
      evidence: pack,
    };
  }

  const proposal = normalizeAiVerifyProposal(text);
  return {
    ok: proposal.ok || (proposal.needsHuman || []).length > 0,
    proposal,
    evidence: pack,
    provider,
    rawPreview: String(text || "").slice(0, 500),
  };
}
