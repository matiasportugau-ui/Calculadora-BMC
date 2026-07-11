/**
 * Pricing Audit System
 * 
 * Tracks all pricing changes with:
 * - User ID and timestamp
 * - Before/after prices
 * - Reason for change
 * - Automatic validation of calculation discrepancies
 * 
 * Location: server/lib/pricingAudit.js
 */

import { pool } from "../db.js";
import logger from "./logger.js";

/**
 * Ensure pricing audit table exists
 */
export async function ensurePricingAuditTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pricing_audits (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      entity_name TEXT,
      change_type TEXT NOT NULL CHECK (change_type IN ('override', 'bulk_update', 'calculation_discrepancy')),
      old_value NUMERIC(12,2),
      new_value NUMERIC(12,2),
      delta NUMERIC(12,2),
      percentage_change NUMERIC(5,2),
      reason TEXT,
      calculation_hash TEXT,
      calculated_vs_stored_delta NUMERIC(12,2),
      status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'discrepancy_flagged', 'resolved')),
      resolved_at TIMESTAMPTZ,
      resolved_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_pricing_audits_user_id ON pricing_audits(user_id);
    CREATE INDEX IF NOT EXISTS idx_pricing_audits_entity ON pricing_audits(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_pricing_audits_change_type ON pricing_audits(change_type);
    CREATE INDEX IF NOT EXISTS idx_pricing_audits_status ON pricing_audits(status);
    CREATE INDEX IF NOT EXISTS idx_pricing_audits_created_at ON pricing_audits(created_at DESC);
  `);
}

/**
 * Record a pricing override
 * 
 * @param {UUID} userId - User making the change
 * @param {string} entityType - Type (quote, line_item, etc)
 * @param {UUID} entityId - Entity ID being modified
 * @param {string} entityName - Human-readable name
 * @param {number} oldValue - Previous price (without IVA)
 * @param {number} newValue - New price (without IVA)
 * @param {string} reason - Why the change was made
 * @returns {Object} Audit record
 */
export async function recordPricingOverride(
  userId,
  entityType,
  entityId,
  entityName,
  oldValue,
  newValue,
  reason = "Manual override"
) {
  const delta = newValue - oldValue;
  const percentageChange = oldValue > 0 ? (delta / oldValue) * 100 : 0;

  const result = await pool.query(
    `INSERT INTO pricing_audits (
      user_id, entity_type, entity_id, entity_name,
      change_type, old_value, new_value, delta, percentage_change, reason
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      userId,
      entityType,
      entityId,
      entityName,
      "override",
      oldValue,
      newValue,
      delta,
      percentageChange,
      reason,
    ]
  );

  logger.info(
    {
      auditId: result.rows[0].id,
      userId,
      entityType,
      change: `${oldValue} → ${newValue} (${percentageChange.toFixed(2)}%)`,
      reason,
    },
    "Pricing override recorded"
  );

  // Alert if change is suspiciously large (>50%)
  if (Math.abs(percentageChange) > 50) {
    logger.warn(
      {
        auditId: result.rows[0].id,
        percentageChange,
        userId,
      },
      "⚠️  Large pricing change detected (>50%)"
    );
  }

  return result.rows[0];
}

/**
 * Record calculation discrepancy between frontend and backend
 * 
 * @param {UUID} quoteId - Quote ID
 * @param {number} frontendTotal - Total calculated by frontend
 * @param {number} backendTotal - Total calculated by backend
 * @param {string} calculationHash - Hash of calculation inputs
 * @returns {Object|null} Audit record if discrepancy exists
 */
export async function recordCalculationDiscrepancy(
  quoteId,
  frontendTotal,
  backendTotal,
  calculationHash
) {
  const delta = Math.abs(frontendTotal - backendTotal);
  const percentageDelta = frontendTotal > 0 ? (delta / frontendTotal) * 100 : 0;

  // Only record if discrepancy is significant (>0.01%)
  if (percentageDelta < 0.01) {
    return null;
  }

  const result = await pool.query(
    `INSERT INTO pricing_audits (
      user_id, entity_type, entity_id,
      change_type, old_value, new_value, 
      calculated_vs_stored_delta, reason, calculation_hash, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      null, // System-generated, no user
      "quote",
      quoteId,
      "calculation_discrepancy",
      frontendTotal,
      backendTotal,
      delta,
      `Frontend: ${frontendTotal}, Backend: ${backendTotal} (delta: ${delta}, ${percentageDelta.toFixed(2)}%)`,
      calculationHash,
      "discrepancy_flagged",
    ]
  );

  logger.error(
    {
      auditId: result.rows[0].id,
      quoteId,
      frontendTotal,
      backendTotal,
      delta: delta.toFixed(2),
      percentageDelta: percentageDelta.toFixed(2),
    },
    "❌ Calculation discrepancy detected!"
  );

  return result.rows[0];
}

/**
 * Get pricing audit trail for an entity
 * 
 * @param {string} entityType - Type (quote, line_item, etc)
 * @param {UUID} entityId - Entity ID
 * @param {number} limit - Max records
 * @returns {Array} Audit records
 */
export async function getPricingAuditTrail(
  entityType,
  entityId,
  limit = 50
) {
  const result = await pool.query(
    `SELECT 
      id, user_id, change_type, old_value, new_value, delta, percentage_change,
      reason, status, created_at, resolved_at, resolved_reason
    FROM pricing_audits
    WHERE entity_type = $1 AND entity_id = $2
    ORDER BY created_at DESC
    LIMIT $3`,
    [entityType, entityId, limit]
  );

  return result.rows;
}

/**
 * Flag a discrepancy as resolved
 * 
 * @param {number} auditId - Audit record ID
 * @param {string} resolvedReason - Explanation of resolution
 * @returns {Object} Updated audit record
 */
export async function resolveDiscrepancy(auditId, resolvedReason) {
  const result = await pool.query(
    `UPDATE pricing_audits
    SET status = 'resolved', resolved_at = now(), resolved_reason = $1, updated_at = now()
    WHERE id = $2
    RETURNING *`,
    [resolvedReason, auditId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Audit record ${auditId} not found`);
  }

  logger.info(
    { auditId, resolvedReason },
    "Pricing discrepancy resolved"
  );

  return result.rows[0];
}

/**
 * Get all unresolved discrepancies
 * 
 * @returns {Array} Unresolved audit records
 */
export async function getUnresolvedDiscrepancies() {
  const result = await pool.query(
    `SELECT *
    FROM pricing_audits
    WHERE status = 'discrepancy_flagged'
    ORDER BY created_at DESC`
  );

  return result.rows;
}

/**
 * Generate pricing audit report for a time period
 * 
 * @param {Date} startDate - Start of period
 * @param {Date} endDate - End of period
 * @returns {Object} Summary statistics
 */
export async function getPricingAuditReport(startDate, endDate) {
  const result = await pool.query(
    `SELECT 
      change_type,
      COUNT(*) as count,
      SUM(ABS(delta)) as total_delta,
      AVG(ABS(percentage_change)) as avg_percentage_change,
      MIN(delta) as min_delta,
      MAX(delta) as max_delta
    FROM pricing_audits
    WHERE created_at >= $1 AND created_at <= $2
    GROUP BY change_type`,
    [startDate, endDate]
  );

  const discrepancies = await pool.query(
    `SELECT COUNT(*) as count
    FROM pricing_audits
    WHERE status = 'discrepancy_flagged'
    AND created_at >= $1 AND created_at <= $2`,
    [startDate, endDate]
  );

  return {
    period: { start: startDate.toISOString(), end: endDate.toISOString() },
    byChangeType: result.rows,
    unresolvedDiscrepancies: discrepancies.rows[0].count,
  };
}

export default {
  ensurePricingAuditTable,
  recordPricingOverride,
  recordCalculationDiscrepancy,
  getPricingAuditTrail,
  resolveDiscrepancy,
  getUnresolvedDiscrepancies,
  getPricingAuditReport,
};
