/**
 * PAOS admin routes — /api/paos/*
 * Auth: superadmin for all sensitive surfaces (aligned with Workspace CR approve).
 * Evaluate never accepts client {pass} — always runs offline money-guard.
 */

import { Router } from "express";
import { requireUser } from "../lib/identityAuth.js";
import { getPaosFlags, isPaosEnabled } from "../lib/paosConfig.js";
import {
  approveCandidate,
  completeEvaluation,
  createCandidate,
  getCandidate,
  listCandidates,
  rejectCandidate,
  rollbackCandidate,
} from "../lib/paosCandidates.js";
import { listPaosEvents, paosLedgerStats } from "../lib/paosEventLedger.js";

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const requirePaosAdmin = requireUser({ role: "superadmin" });

/**
 * @param {import("../config.js").config} [config]
 */
export default function createPaosRouter(config = {}) {
  const router = Router();

  router.get("/api/paos/health", (req, res) => {
    // Public liveness only — do not disclose enable/promote flags unauthenticated.
    res.json({ ok: true, service: "paos" });
  });

  router.get(
    "/api/paos/flags",
    requirePaosAdmin,
    (req, res) => {
      res.json({ ok: true, flags: getPaosFlags() });
    },
  );

  router.get(
    "/api/paos/events",
    requirePaosAdmin,
    (req, res) => {
      if (!isPaosEnabled()) {
        return res.status(503).json({ ok: false, error: "paos_disabled" });
      }
      const events = listPaosEvents({
        sessionId: req.query.session_id ? String(req.query.session_id) : undefined,
        type: req.query.type ? String(req.query.type) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : 100,
      });
      res.json({ ok: true, events });
    },
  );

  router.get(
    "/api/paos/metrics",
    requirePaosAdmin,
    asyncHandler(async (req, res) => {
      const all = await listCandidates();
      const byState = {};
      for (const c of all) {
        byState[c.state] = (byState[c.state] || 0) + 1;
      }
      res.json({
        ok: true,
        candidates: all.length,
        byState,
        ledger: paosLedgerStats(),
        flags: getPaosFlags(),
      });
    }),
  );

  router.get(
    "/api/paos/candidates",
    requirePaosAdmin,
    asyncHandler(async (req, res) => {
      if (!isPaosEnabled()) {
        return res.status(503).json({ ok: false, error: "paos_disabled" });
      }
      const state = req.query.state ? String(req.query.state) : undefined;
      res.json({ ok: true, candidates: await listCandidates({ state }) });
    }),
  );

  router.get(
    "/api/paos/candidates/:id",
    requirePaosAdmin,
    asyncHandler(async (req, res) => {
      const c = await getCandidate(req.params.id);
      if (!c) return res.status(404).json({ ok: false, error: "not_found" });
      res.json({ ok: true, candidate: c });
    }),
  );

  router.post(
    "/api/paos/candidates",
    requirePaosAdmin,
    asyncHandler(async (req, res) => {
      try {
        const c = await createCandidate({
          delta: req.body?.delta,
          scope: req.body?.scope,
          source: req.body?.source || "api",
          sessionId: req.body?.sessionId,
          // Never trust client calcProvenance / totalUsd / calcResult
          trustedProvenance: false,
        });
        res.status(201).json({ ok: true, candidate: c });
      } catch (e) {
        if (e?.code === "PAOS_DISABLED") {
          return res.status(503).json({ ok: false, error: "paos_disabled" });
        }
        throw e;
      }
    }),
  );

  router.post(
    "/api/paos/candidates/:id/evaluate",
    requirePaosAdmin,
    asyncHandler(async (req, res) => {
      try {
        // Always run offline evaluator — ignore body.pass (money-guard integrity).
        const c = await completeEvaluation(req.params.id, null);
        res.json({ ok: true, candidate: c });
      } catch (e) {
        if (e?.code === "PAOS_NOT_FOUND") {
          return res.status(404).json({ ok: false, error: "not_found" });
        }
        if (e?.code === "PAOS_ILLEGAL_TRANSITION") {
          return res.status(409).json({ ok: false, error: e.message });
        }
        throw e;
      }
    }),
  );

  router.post(
    "/api/paos/candidates/:id/approve",
    requirePaosAdmin,
    asyncHandler(async (req, res) => {
      try {
        const mode = req.body?.mode === "active" ? "active" : "canary";
        const c = await approveCandidate(req.params.id, mode);
        res.json({ ok: true, candidate: c });
      } catch (e) {
        if (e?.code === "PAOS_NOT_FOUND") {
          return res.status(404).json({ ok: false, error: "not_found" });
        }
        if (e?.code === "PAOS_PROMOTE_DISABLED") {
          return res.status(503).json({ ok: false, error: "paos_promote_disabled" });
        }
        if (e?.code === "PAOS_ILLEGAL_TRANSITION") {
          return res.status(409).json({ ok: false, error: e.message });
        }
        throw e;
      }
    }),
  );

  router.post(
    "/api/paos/candidates/:id/reject",
    requirePaosAdmin,
    asyncHandler(async (req, res) => {
      try {
        const c = await rejectCandidate(req.params.id, req.body?.reason);
        res.json({ ok: true, candidate: c });
      } catch (e) {
        if (e?.code === "PAOS_NOT_FOUND") {
          return res.status(404).json({ ok: false, error: "not_found" });
        }
        if (e?.code === "PAOS_ILLEGAL_TRANSITION") {
          return res.status(409).json({ ok: false, error: e.message });
        }
        throw e;
      }
    }),
  );

  router.post(
    "/api/paos/versions/:id/rollback",
    requirePaosAdmin,
    asyncHandler(async (req, res) => {
      try {
        const c = await rollbackCandidate(req.params.id);
        res.json({ ok: true, candidate: c });
      } catch (e) {
        if (e?.code === "PAOS_NOT_FOUND") {
          return res.status(404).json({ ok: false, error: "not_found" });
        }
        if (e?.code === "PAOS_ILLEGAL_TRANSITION") {
          return res.status(409).json({ ok: false, error: e.message });
        }
        throw e;
      }
    }),
  );

  return router;
}
