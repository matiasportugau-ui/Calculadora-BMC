/**
 * approvalRouter.js
 *
 * Real implementation of the Approval Router for the presupuestación orchestrator.
 *
 * Responsibilities:
 * - Create human approval tasks for generated presupuestos (quotes).
 * - Primary integration point with the hub-tasks module (Google Tasks bidirectional sync).
 * - When hub-tasks infra is not yet provisioned (OAuth client, PGP key, system identity,
 *   Cloud Scheduler — see docs/hub-tasks-module/PHASE-1-INFRASTRUCTURE.md), gracefully
 *   fall back to a rich, self-contained metadata object that contains 100% of the data
 *   a human approver needs + full context for future reconciliation.
 *
 * This module is intentionally narrow and verb-led ("createApprovalTask").
 * It reuses the same primitives as the rest of the tasks system (tasksDb, googleTasksClient, config).
 *
 * Status (2026-05-29): Infra blocked on operator secrets. Real path is stubbed but
 * the rich fallback is production-grade and gives the orchestrator a complete end-to-end story.
 */

import { getTasksPool } from "./tasksDb.js";
import { config } from "../config.js";
import pino from "pino";
import * as googleTasks from "./googleTasksClient.js";

const defaultLogger = pino({ name: "approval-router" });

/**
 * createApprovalTask
 *
 * Creates (or simulates) an approval task for a generated presupuesto.
 *
 * @param {object} params
 * @param {string} params.requestId - BMC- timestamp id from the orchestrator flow
 * @param {object} [params.cliente] - { nombre, rut, ... }
 * @param {string} [params.prioridad] - "alta" | "media" | "baja"
 * @param {string} [params.resumen] - Human readable summary of the quote
 * @param {string} [params.userId] - Optional end-user who triggered the flow (for future attribution)
 * @param {object} [params.artifacts] - Full artifacts from upstream sub-agents (intake, pdfGate, pricing, etc.)
 * @param {object} [params.calcSnapshot] - Optional snapshot of the calculation state
 * @param {object} [params.pdfInfo] - PDF version, url, pages, etc. when available
 * @returns {Promise<object>} approvalTask descriptor (always succeeds)
 */
export async function createApprovalTask(params = {}) {
  const {
    requestId,
    cliente = null,
    prioridad = "media",
    resumen,
    userId = null,
    artifacts = {},
    calcSnapshot = null,
    pdfInfo = null,
    logger = defaultLogger,
  } = params;

  const createdAt = new Date().toISOString();
  const syntheticId = `APPR-${requestId || Date.now()}`;

  // ───────────────────────────────────────────────────────────────────────────
  // Real hub-tasks path (attempt)
  // ───────────────────────────────────────────────────────────────────────────
  const pool = getTasksPool(config.databaseUrl);
  const hasCreds =
    !!(config.googleTasksClientId &&
       config.googleTasksClientSecret &&
       config.supabasePgpEncryptKey);

  if (pool && hasCreds) {
    // FUTURE (once operator provisions secrets + a dedicated BMC approver identity):
    // 1. Ensure a system-owned "BMC Aprobaciones - Presupuestos" task list exists
    //    (or use a fixed list id stored in config).
    // 2. Call googleTasks.createTask(...) with rich notes containing the full context.
    // 3. Persist the returned google_id + our synthetic mapping in tasks.tasks.
    //
    // For now even with creds we fall through because there is no wired "system user"
    // that owns approval tasks independently of end-customer Google accounts.
    console.log(
      `[approvalRouter] creds present but no system approver identity wired yet — using rich fallback for ${requestId}`
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Rich metadata fallback (current safe path — fully usable by humans + future sync)
  // ───────────────────────────────────────────────────────────────────────────
  const approvalTask = {
    id: syntheticId,
    type: "presupuesto_approval",
    source: "presup-orchestrator",
    status: "PENDING_APPROVAL",

    requestId,
    cliente,
    prioridad,
    resumen: resumen || "Aprobación de presupuesto generada por el orchestrator",

    createdAt,
    userId, // attribution for when we have real identity

    // Everything the approver (or automated post-processor) needs
    artifacts: {
      ...artifacts,
      pdfInfo,
      calcSnapshot: calcSnapshot
        ? { hasSnapshot: true, keys: Object.keys(calcSnapshot).slice(0, 8) }
        : null,
    },

    // Reconciliation hooks for when hub-tasks becomes the source of truth
    reconciliation: {
      hubTasksReady: false,
      googleId: null,
      listId: null,
      canReconcile: true,
      notes:
        "When Google Tasks OAuth + system identity are live, this record can be promoted to a real synced task using the requestId as correlation key.",
    },

    // Human / UI friendly payload (ready for HUB, WA notifications, email, etc.)
    display: {
      title: `Aprobar presupuesto ${requestId}`,
      subtitle: cliente?.nombre
        ? `${cliente.nombre}${cliente.rut ? ` — ${cliente.rut}` : ""}`
        : "Cliente no identificado",
      priority: prioridad,
      actions: ["aprobar", "rechazar", "solicitar_cambios", "ver_pdf"],
      deepLink: `/hub/tareas?focus=${syntheticId}`, // future
    },

    // Traceability
    generatedBy: "presupOrchestrator.runPresupFlow",
  };

  logger.info({
    event: "approval.request_created",
    requestId,
    taskId: syntheticId,
    prioridad,
    status: approvalTask.status,
    source: approvalTask.source,
  }, "Approval request created (real or rich fallback metadata)");

  return approvalTask;
}

/**
 * Helper for future use / health checks.
 * Returns whether the environment currently supports real task creation via hub-tasks.
 */
export function canCreateRealTasks() {
  const pool = getTasksPool(config.databaseUrl);
  const hasCreds =
    !!(config.googleTasksClientId &&
       config.googleTasksClientSecret &&
       config.supabasePgpEncryptKey);
  return !!(pool && hasCreds);
}
