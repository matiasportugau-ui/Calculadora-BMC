/**
 * presupOrchestrator.js
 *
 * High-level conductor for the full presupuestación automation flow.
 *
 * This is the project implementation of the "run" (runPresupFlow) from the
 * presupuestacion-orchestrator Grok skill.
 *
 * Design goals:
 * - Own the end-to-end saga/state machine
 * - Enforce cost + quality guardrails
 * - Delegate to existing primitives (aiProviderConfig, agentCore, agentTools, etc.)
 * - Integrate with hub-tasks for human approvals (when infra is ready)
 * - Emit structured events for monitoring
 *
 * Current status (2026-05-29):
 * - #1 internal testing route: DONE
 * - #2 prompt modules on disk: DONE
 * - #3 real ApprovalRouter (hub-tasks wiring + rich fallback): DONE (see approvalRouter.js)
 * - #4 structured logging + events: pending
 *
 * Feature freeze active for heavy new agents. This conductor + ApprovalRouter is
 * safe internal scaffolding that can be exercised via /api/internal/presup/run.
 */

import { estimateCostUSD } from "./aiProviderConfig.js";
import { callAgentOnce } from "./agentCore.js";
import { findRelevantExamples } from "./trainingKB.js";
import fs from "node:fs";
import path from "node:path";
import { createApprovalTask } from "./approvalRouter.js";

/**
 * Main entry point: runs a full presupuestación flow.
 *
 * @param {object} input
 * @param {string} input.channel - 'chat' | 'wa' | 'ml' | 'wolfboard' | 'manual'
 * @param {string} input.consulta
 * @param {object} [input.cliente]
 * @param {object} [input.calcState]
 * @param {object} [opts]
 * @param {"ligero" | "profundo"} [opts.mode]
 * @returns {Promise<object>} final flow state
 */
export async function runPresupFlow(input, opts = {}) {
  const state = {
    requestId: `BMC-${Date.now()}`,
    startedAt: new Date().toISOString(),
    input,
    mode: opts.mode || "ligero",
    trace: [],
    gates: {},
    artifacts: {},
    totalCostUsd: 0,
    status: "running",
  };

  try {
    // 0 — Preflight + Scope
    await _recordStep(state, "scope", { mode: state.mode });

    // 1 — Intake & Classification (Phase A prompt module)
    const intake = await _runSubAgent("IntakeClassification", {
      input,
      channel: input.channel,
    }, state);
    state.artifacts.intake = intake;

    if (intake.prioridad === "alta" && state.mode === "profundo") {
      // 2 — Context Builder
      const context = await _runSubAgent("ContextBuilder", {
        intake,
        useCachedEmbeddings: true,
      }, state);
      state.artifacts.context = context;

      // 3 — Pricing & BOM Reviewer (core quality gate)
      const pricingReview = await _runSubAgent("PricingBOMReviewer", {
        context,
        proposedQuote: input,
      }, state);
      state.gates.pricing = pricingReview;

      if (pricingReview.veredicto === "RECHAZAR") {
        return _closeFlow(state, {
          status: "rejected_by_pricing",
          reason: pricingReview,
        });
      }
    }

    // 4 — Document Gatekeeper (always for anything reaching PDF)
    const pdfGate = await _runSubAgent("DocumentGatekeeper", {
      layout: "simple-carbon",
      quoteId: state.requestId,
      version: 1,
    }, state);
    state.gates.pdf = pdfGate;

    if (pdfGate.veredicto === "FAIL") {
      return _escalate(state, {
        gate: "pdf",
        issues: pdfGate.problemas,
      });
    }

    // 5 — Delivery + Approval Router (hub-tasks integration point)
    // Real wiring via approvalRouter.js — creates real task when hub-tasks infra is live,
    // otherwise returns rich self-describing metadata (full context for approvers + future reconciliation).
    const approvalTask = await _runSubAgent("ApprovalRouter", {
      requestId: state.requestId,
      cliente: intake?.cliente || input.cliente,
      prioridad: intake?.prioridad || "media",
      resumen: `Presupuesto ${state.requestId} — ${intake?.flujo || "nueva_cotizacion"}`,
      artifacts: {
        pdfGate,
        intake: state.artifacts.intake,
        pricingReview: state.gates?.pricing || null,
      },
      pdfInfo: state.artifacts?.pdf || null,
      calcSnapshot: input.calcState || state.artifacts?.context || null,
      userId: input.userId || state.input?.userId || null,
    }, state);
    state.artifacts.approvalTask = approvalTask;

    // 6 — Close flow
    return _closeFlow(state, {
      status: "awaiting_approval",
      taskId: approvalTask?.id,
    });

  } catch (err) {
    state.status = "error";
    state.error = {
      message: err.message,
      stack: err.stack?.slice(0, 500),
    };
    await _recordStep(state, "error", state.error);
    return state;
  }
}

/**
 * Internal helper to run a sub-agent (prompt module or delegated logic).
 * In v1 this mostly calls through existing agent infrastructure + prompt templates.
 */
async function _runSubAgent(name, input, state) {
  const t0 = Date.now();

  let result;

  // For Phase A we delegate most heavy lifting to existing systems
  // and use the prompt templates defined in the skill for reasoning.
  switch (name) {
    case "IntakeClassification":
    case "ContextBuilder":
    case "PricingBOMReviewer":
    case "DocumentGatekeeper":
      // Use the high-quality path through agentCore (which now uses aiProviderConfig)
      result = await _callPromptModule(name, input, state);
      break;

    case "ApprovalRouter":
      // Real Approval Router — delegates to approvalRouter.js which attempts
      // hub-tasks (googleTasksClient + tasksDb) and always falls back gracefully
      // to a rich metadata object while the OAuth/sync infra is blocked.
      result = await createApprovalTask({
        requestId: input.requestId || state.requestId,
        cliente: input.cliente,
        prioridad: input.prioridad,
        resumen: input.resumen,
        userId: input.userId || state.input?.userId,
        artifacts: input.artifacts,
        calcSnapshot: input.calcSnapshot,
        pdfInfo: input.pdfInfo,
      });
      break;

    default:
      throw new Error(`Unknown sub-agent: ${name}`);
  }

  // Cost tracking (best effort)
  const cost = result?.costUsd || 0;
  state.totalCostUsd = (state.totalCostUsd || 0) + cost;

  await _recordStep(state, name.toLowerCase(), {
    durationMs: Date.now() - t0,
    costUsd: cost,
    summary: result?.veredicto || result?.flujo || "ok",
  });

  return result;
}

/**
 * Calls one of the prompt modules defined in the presupuestacion-orchestrator skill.
 * This is the bridge between the Grok skill prompts and real execution.
 */
async function _callPromptModule(moduleName, input, state) {
  // In a more mature version this would load the exact prompt from the skill
  // and call through a unified LLM interface.
  //
  // For v1 we use agentCore (which already has good prompting + KB + tools)
  // and inject the specific sub-agent instructions as additional system context.

  const promptInstructions = getPromptInstructions(moduleName);

  const messages = [
    { role: "system", content: promptInstructions },
    { role: "user", content: JSON.stringify(input, null, 2) },
  ];

  const response = await callAgentOnce(messages, {
    channel: "chat",
    calcState: state.artifacts?.context || {},
  });

  // Best-effort JSON parsing for structured sub-agents
  let parsed;
  try {
    parsed = JSON.parse(response.text);
  } catch {
    parsed = { raw: response.text };
  }

  return {
    ...parsed,
    provider: response.provider,
    model: response.model,
    latencyMs: response.latencyMs,
  };
}

/**
 * Carga el prompt de un sub-agente desde disco.
 * Los prompts viven en server/prompts/presup-orchestrator/ (single source of truth).
 */
function getPromptInstructions(moduleName) {
  const promptsDir = path.join(process.cwd(), "server/prompts/presup-orchestrator");
  const filePath = path.join(promptsDir, `${moduleName}.md`);

  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.warn(`[presupOrchestrator] No se pudo cargar prompt ${moduleName}.md, usando fallback.`);
    return "You are a helpful specialist for presupuestación workflows at BMC.";
  }
}

async function _recordStep(state, step, data) {
  state.trace.push({
    step,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

function _closeFlow(state, outcome) {
  state.status = outcome.status;
  state.finishedAt = new Date().toISOString();
  state.artifacts.outcome = outcome;

  // Always trigger Post-Mortem & Learning
  // (in real impl this would schedule a background job)
  schedulePostMortem(state, outcome);

  return state;
}

function _escalate(state, data) {
  state.status = "escalated";
  state.escalation = data;
  return state;
}

function schedulePostMortem(state, outcome) {
  // Placeholder — in production this would enqueue a job
  // that runs the Post-Mortem & Learning sub-agent
  console.log(`[presupOrchestrator] Post-mortem scheduled for ${state.requestId}`);
}

// Optional: simple helper to get current cost
export function getFlowCost(state) {
  return state.totalCostUsd || 0;
}
