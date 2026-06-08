// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15

import { randomUUID } from 'crypto';
import pino from 'pino';
import { pool } from './db.js';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

/**
 * Create a pending mystery shopping task.
 *
 * IMPORTANT: Tasks are NEVER auto-approved or auto-executed.
 * A human operator must review and approve before any field visit.
 *
 * @param {{ competitor_id: string, reason: 'blocked'|'manual_request'|'recurring_parse_error', notes?: string }} input
 * @returns {Promise<object>}
 */
export async function createMysteryShoppingTask(input) {
  const { rows } = await pool().query(
    `INSERT INTO bmc_market_intel.mystery_shopping_queue
       (id, competitor_id, reason, status, notes)
     VALUES ($1, $2, $3, 'pending', $4)
     RETURNING *`,
    [randomUUID(), input.competitor_id, input.reason, input.notes ?? null]
  );

  log.info({ taskId: rows[0].id, competitorId: input.competitor_id, reason: input.reason }, 'mystery shopping task created');
  return rows[0];
}

/**
 * Update the status of a mystery shopping task.
 * Valid transitions: pending→approved, approved→completed, pending|approved→cancelled.
 *
 * @param {string} taskId
 * @param {'approved'|'completed'|'cancelled'} newStatus
 * @param {string} [approvedBy]
 * @param {Date} [completedAt]
 * @returns {Promise<object|null>}
 */
export async function updateTaskStatus(taskId, newStatus, approvedBy, completedAt) {
  const { rows } = await pool().query(
    `UPDATE bmc_market_intel.mystery_shopping_queue
     SET status       = $1,
         approved_by  = COALESCE($2, approved_by),
         completed_at = COALESCE($3, completed_at),
         updated_at   = NOW()
     WHERE id = $4
     RETURNING *`,
    [newStatus, approvedBy ?? null, completedAt ?? null, taskId]
  );

  if (!rows.length) {
    log.warn({ taskId, newStatus }, 'task not found for status update');
    return null;
  }

  log.info({ taskId, newStatus }, 'mystery shopping task status updated');
  return rows[0];
}

/**
 * List pending mystery shopping tasks (paginated).
 *
 * @param {number} page
 * @param {number} perPage
 * @returns {Promise<{ tasks: object[], total: number }>}
 */
export async function listPendingTasks(page = 1, perPage = 25) {
  const offset = (page - 1) * perPage;

  const [{ rows: tasks }, { rows: countRows }] = await Promise.all([
    pool().query(
      `SELECT msq.*, c.name AS competitor_name, c.domain
       FROM bmc_market_intel.mystery_shopping_queue msq
       JOIN bmc_market_intel.competitors c ON c.id = msq.competitor_id
       WHERE msq.status = 'pending'
       ORDER BY msq.created_at DESC
       LIMIT $1 OFFSET $2`,
      [perPage, offset]
    ),
    pool().query(
      `SELECT COUNT(*) AS count FROM bmc_market_intel.mystery_shopping_queue WHERE status = 'pending'`
    ),
  ]);

  return { tasks, total: parseInt(countRows[0]?.count ?? '0', 10) };
}
