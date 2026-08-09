/**
 * PAOS admin routes — /api/paos/*
 * Auth: requireUser; promote/reject/rollback prefer superadmin when role present.
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

function requireSuperadmin(req, res, next) {
  const role = req.user?.role || "";
  const ok = role === "superadmin" || role === "admin" || req.user?.isSuperadmin === true;
  if (!ok) {
    return res.status(403).json({ ok: false, error: "superadmin_required" });
  }
  return next();
}

/**
 * @param {import("../config.js").config} [config]
 */
export default function createPaosRouter(config = {}) {
  const router = Router();

  router.get(
    "/api/paos/health",
    (req, res) => {
      res.json({ ok: true, paos: getPaosFlags(), ledger: paosLedgerStats() });
    },
  );

  router.get(
    "/api/paos/flags",
    requireUser({ authOnly: true }),
    (req, res) => {
      res.json({ ok: true, flags: getPaosFlags() });
    },
  );

  router.get(
    "/api/paos/events",
    requireUser({ authOnly: true }),
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
    requireUser({ authOnly: true }),
    (req, res) => {
      const all = listCandidates();
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
    },
  );

  router.get(
    "/api/paos/candidates",
    requireUser({ authOnly: true }),
    (req, res) => {
      if (!isPaosEnabled()) {
        return res.status(503).json({ ok: false, error: "paos_disabled" });
      }
      const state = req.query.state ? String(req.query.state) : undefined;
      res.json({ ok: true, candidates: listCandidates({ state }) });
    },
  );

  router.get(
    "/api/paos/candidates/:id",
    requireUser({ authOnly: true }),
    (req, res) => {
      const c = getCandidate(req.params.id);
      if (!c) return res.status(404).json({ ok: false, error: "not_found" });
      res.json({ ok: true, candidate: c });
    },
  );

  router.post(
    "/api/paos/candidates",
    requireUser({ authOnly: true }),
    asyncHandler(async (req, res) => {
      try {
        const c = createCandidate({
          delta: req.body?.delta,
          scope: req.body?.scope,
          source: req.body?.source || "api",
          sessionId: req.body?.sessionId,
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
    requireUser({ authOnly: true }),
    (req, res) => {
      try {
        // If body.pass is boolean, use explicit report; else run offline evaluator
        const hasExplicit = typeof req.body?.pass === "boolean";
        const c = completeEvaluation(
          req.params.id,
          hasExplicit
            ? { pass: !!req.body.pass, details: req.body?.details || {} }
            : null,
        );
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
    },
  );

  router.post(
    "/api/paos/candidates/:id/approve",
    requireUser({ authOnly: true }),
    requireSuperadmin,
    (req, res) => {
      try {
        const mode = req.body?.mode === "active" ? "active" : "canary";
        const c = approveCandidate(req.params.id, mode);
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
    },
  );

  router.post(
    "/api/paos/candidates/:id/reject",
    requireUser({ authOnly: true }),
    requireSuperadmin,
    (req, res) => {
      try {
        const c = rejectCandidate(req.params.id, req.body?.reason);
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
    },
  );

  router.post(
    "/api/paos/versions/:id/rollback",
    requireUser({ authOnly: true }),
    requireSuperadmin,
    (req, res) => {
      try {
        // id is candidate id for v1 pointer rollback
        const c = rollbackCandidate(req.params.id);
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
    },
  );

  return router;
}
