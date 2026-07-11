/**
 * Pricing Audit API Routes
 * 
 * GET  /api/audit/pricing/quote/:quoteId     - Get audit trail for quote
 * GET  /api/audit/pricing/report              - Get audit report
 * GET  /api/audit/pricing/discrepancies       - Get unresolved discrepancies
 * PATCH /api/audit/pricing/:auditId/resolve   - Mark discrepancy as resolved
 * 
 * Location: server/routes/pricingAudit.js
 */

import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import * as pricingAudit from "../lib/pricingAudit.js";

const router = express.Router();

/**
 * GET /api/audit/pricing/quote/:quoteId
 * Get full pricing audit trail for a quote
 */
router.get("/pricing/quote/:quoteId", requireAuth, async (req, res) => {
  try {
    const { quoteId } = req.params;
    const { limit = 50 } = req.query;

    const trail = await pricingAudit.getPricingAuditTrail(
      "quote",
      quoteId,
      parseInt(limit, 10)
    );

    return res.json({
      quoteId,
      auditTrail: trail,
      count: trail.length,
    });
  } catch (err) {
    console.error("Error fetching pricing audit trail:", err);
    return res.status(500).json({ error: "Failed to fetch audit trail" });
  }
});

/**
 * GET /api/audit/pricing/report
 * Get pricing audit report for a date range
 */
router.get("/pricing/report", requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: "startDate and endDate query parameters required (ISO 8601)",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: "Invalid date format. Use ISO 8601 (YYYY-MM-DDTHH:mm:ssZ)",
      });
    }

    const report = await pricingAudit.getPricingAuditReport(start, end);

    return res.json(report);
  } catch (err) {
    console.error("Error generating pricing audit report:", err);
    return res.status(500).json({ error: "Failed to generate report" });
  }
});

/**
 * GET /api/audit/pricing/discrepancies
 * Get all unresolved calculation discrepancies
 */
router.get("/pricing/discrepancies", requireAuth, async (req, res) => {
  try {
    // Check if user has admin role for viewing all discrepancies
    if (req.user.role !== "admin") {
      return res.status(403).json({
        error: "Only admins can view all discrepancies",
      });
    }

    const discrepancies = await pricingAudit.getUnresolvedDiscrepancies();

    return res.json({
      count: discrepancies.length,
      discrepancies,
    });
  } catch (err) {
    console.error("Error fetching discrepancies:", err);
    return res.status(500).json({ error: "Failed to fetch discrepancies" });
  }
});

/**
 * PATCH /api/audit/pricing/:auditId/resolve
 * Mark a discrepancy as resolved
 */
router.patch(
  "/pricing/:auditId/resolve",
  requireAuth,
  async (req, res) => {
    try {
      const { auditId } = req.params;
      const { reason } = req.body;

      if (!reason || typeof reason !== "string") {
        return res.status(400).json({
          error: "reason (string) is required in request body",
        });
      }

      // Check if user has admin role
      if (req.user.role !== "admin") {
        return res.status(403).json({
          error: "Only admins can resolve discrepancies",
        });
      }

      const updated = await pricingAudit.resolveDiscrepancy(
        parseInt(auditId, 10),
        reason
      );

      return res.json({
        message: "Discrepancy resolved",
        auditRecord: updated,
      });
    } catch (err) {
      console.error("Error resolving discrepancy:", err);
      if (err.message.includes("not found")) {
        return res.status(404).json({ error: err.message });
      }
      return res.status(500).json({ error: "Failed to resolve discrepancy" });
    }
  }
);

export default router;
