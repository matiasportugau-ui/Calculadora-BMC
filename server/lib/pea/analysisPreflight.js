/**
 * PEA AnalysisPreflight — mandatory gate before any ArchitectRuntime model call.
 * Seal: PEA_ANALYSIS_BUDGET_POLICY_V1
 */
import { estimateTokensSystem, estimateTokensText } from "../tokenEstimator.js";
import { getDailyPeaSpend, reserveBudget, settleBudget, refundBudget } from "./budgetLedger.js";

export const PEA_VERDICTS = Object.freeze([
  "AUTO_RUN",
  "ASK_INTERNAL",
  "DECOMPOSE",
  "DENY_UNPRICED",
]);

/**
 * @typedef {object} ModelPricing
 * @property {string} model_id
 * @property {number|null} cost_per_1k_input_usd
 * @property {number|null} cost_per_1k_output_usd
 * @property {number} [max_tokens]
 */

/**
 * @param {object} input
 * @param {string} [input.systemPrompt]
 * @param {object} [input.gapEvent]
 * @param {object} [input.evidence]
 * @param {object} [input.toolSchemas]
 * @param {number} [input.maxOutputTokens]
 * @param {number} [input.toolRounds]
 * @param {number} [input.retries]
 * @param {ModelPricing[]} [input.fallbackChain]
 * @param {number} [input.modelCallsPlanned]
 */
export function estimatePreflightUsage(input = {}) {
  const systemTokens = estimateTokensSystem(input.systemPrompt || "");
  const gapTokens = estimateTokensText(JSON.stringify(input.gapEvent || {}));
  const evidenceTokens = estimateTokensText(JSON.stringify(input.evidence || {}));
  const toolTokens = estimateTokensText(JSON.stringify(input.toolSchemas || {}));
  const maxOut = Math.max(0, Number(input.maxOutputTokens) || 0);
  const rounds = Math.max(1, Number(input.toolRounds) || 1);
  const retries = Math.max(0, Number(input.retries) || 0);
  const modelCalls = Math.max(1, Number(input.modelCallsPlanned) || 1);

  const inputTokens =
    systemTokens + gapTokens + evidenceTokens + toolTokens;
  const perCallInput = inputTokens * rounds;
  const perCallOutput = maxOut;
  const totalInputTokens = perCallInput * modelCalls * (1 + retries);
  const totalOutputTokens = perCallOutput * modelCalls * (1 + retries);

  return {
    breakdown: {
      systemTokens,
      gapTokens,
      evidenceTokens,
      toolTokens,
      maxOutputTokens: maxOut,
      toolRounds: rounds,
      retries,
      modelCallsPlanned: modelCalls,
    },
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
  };
}

/**
 * @param {ModelPricing[]} chain
 * @param {{ inputTokens: number, outputTokens: number }} usage
 */
export function estimateUsdForChain(chain, usage) {
  if (!Array.isArray(chain) || chain.length === 0) {
    return { totalUsd: null, unpriced: true, perModel: [] };
  }
  let sum = 0;
  const perModel = [];
  for (const model of chain) {
    const inRate = model.cost_per_1k_input_usd;
    const outRate = model.cost_per_1k_output_usd;
    if (inRate == null || outRate == null) {
      return { totalUsd: null, unpriced: true, perModel };
    }
    const usd =
      (usage.inputTokens / 1000) * Number(inRate) +
      (usage.outputTokens / 1000) * Number(outRate);
    sum += usd;
    perModel.push({ model_id: model.model_id, usd });
  }
  return { totalUsd: sum, unpriced: false, perModel };
}

/**
 * @param {object} args
 * @param {number} args.totalTokens
 * @param {number|null} args.totalUsd
 * @param {boolean} [args.unpriced]
 * @param {import('../../config.js').config} args.config
 */
export function resolvePreflightVerdict({ totalTokens, totalUsd, unpriced, config }) {
  if (unpriced || totalUsd == null) {
    if (config.peaRequireModelPricing) {
      return { verdict: "DENY_UNPRICED", reason: "model_pricing_missing" };
    }
    totalUsd = 0;
  }
  const safety = config.peaEstimateSafetyFactor || 1.2;
  const reservedUsd = totalUsd * safety;
  const tokens = Math.ceil(totalTokens * safety);

  if (tokens <= config.peaAutoMaxTotalTokens && reservedUsd <= config.peaAutoMaxCostUsd) {
    return { verdict: "AUTO_RUN", reservedUsd, estimatedTokens: tokens };
  }
  if (tokens <= config.peaApprovalMaxTotalTokens && reservedUsd <= config.peaApprovedMaxCostUsd) {
    return { verdict: "ASK_INTERNAL", reservedUsd, estimatedTokens: tokens };
  }
  return { verdict: "DECOMPOSE", reservedUsd, estimatedTokens: tokens, reason: "over_budget_caps" };
}

/**
 * Full preflight (pure estimate + verdict; optional DB reserve).
 * @param {import('pg').Pool|null} pool
 * @param {import('../../config.js').config} config
 * @param {object} input
 */
export async function runAnalysisPreflight(pool, config, input) {
  const usage = estimatePreflightUsage(input);
  const chain = Array.isArray(input.fallbackChain) ? input.fallbackChain : [];
  const mode = config.peaFallbackReservationMode || "sum";
  const chainForCost = mode === "sum" ? chain : chain.slice(0, 1);
  const priced = estimateUsdForChain(chainForCost, usage);
  let verdictResult = resolvePreflightVerdict({
    totalTokens: usage.totalTokens,
    totalUsd: priced.totalUsd,
    unpriced: priced.unpriced,
    config,
  });

  if (pool && verdictResult.verdict === "AUTO_RUN") {
    const daily = await getDailyPeaSpend(pool);
    if (daily + verdictResult.reservedUsd > config.peaAutoDailyBudgetUsd) {
      verdictResult = {
        verdict: "ASK_INTERNAL",
        reservedUsd: verdictResult.reservedUsd,
        estimatedTokens: verdictResult.estimatedTokens,
        reason: "daily_budget_exceeded",
      };
    }
  }

  return {
    ...verdictResult,
    usage,
    pricing: priced,
    fallback_mode: mode,
  };
}

/**
 * Reserve ledger row when proceeding with analysis.
 */
export async function preflightReserve(pool, config, preflight, meta = {}) {
  if (!pool || preflight.verdict !== "AUTO_RUN") {
    return { reserved: false, ledgerId: null };
  }
  const row = await reserveBudget(pool, {
    gapId: meta.gapId || null,
    analysisRunId: meta.analysisRunId || null,
    amountUsd: preflight.reservedUsd,
    tokens: preflight.estimatedTokens,
    metadata: { verdict: preflight.verdict, ...meta },
  });
  return { reserved: true, ledgerId: row.id };
}

export { settleBudget, refundBudget };
