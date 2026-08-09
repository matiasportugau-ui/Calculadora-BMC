/**
 * PEA routes — /api/pea/*
 * M1: health + read stubs; L3 returns not_enabled per OpenAPI contract.
 */
import { Router } from "express";
import { requireUser } from "../lib/identityAuth.js";
import { getPeaHealth } from "../lib/pea/peaHealth.js";
import { claimAndRunPeaBatch } from "../lib/pea/peaWorker.js";
import { getOmniPool } from "../lib/omni/omniDb.js";
import {
  acceptPeaPacket,
  rejectPeaPacket,
  escalatePeaPacket,
} from "../lib/pea/packetReview.js";
import { createPeaGrant, revokePeaGrant } from "../lib/pea/grants.js";
import { PEA_ACTIONS, requirePeaAction } from "../lib/pea/principal.js";
import { runImplementPacket } from "../lib/pea/implementGapJob.js";
import { runPeaReplay } from "../lib/pea/replayJob.js";

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function peaDisabled(res) {
  return res.status(503).json({ ok: false, error: "pea_disabled" });
}

function requirePeaEnabled(config, res) {
  if (!config.peaEnabled) {
    peaDisabled(res);
    return false;
  }
  return true;
}

function actorId(req) {
  return req.user?.sub || req.user?.id || req.user?.email || "unknown";
}

/**
 * @param {import('../config.js').config} config
 * @param {import('pino').Logger} [logger]
 */
export default function createPeaRouter(config, logger) {
  const router = Router();
  const pool = getOmniPool(config.databaseUrl);
  const peaRead = requirePeaAction(config, PEA_ACTIONS.GAP_READ);
  const peaAnalyze = requirePeaAction(config, PEA_ACTIONS.ANALYZE);
  const peaGrantRead = requirePeaAction(config, PEA_ACTIONS.GRANT_READ);
  const peaGrantWrite = requirePeaAction(config, PEA_ACTIONS.GRANT_WRITE);
  const peaImplement = requirePeaAction(config, PEA_ACTIONS.IMPLEMENT);
  const peaReplay = requirePeaAction(config, PEA_ACTIONS.REPLAY);
  // requireUser is a factory — must invoke requireUser() (Bug BS / #967).
  const authUser = requireUser();
  const authAdmin = requireUser({ role: "admin" });

  router.get(
    "/pea/health",
    asyncHandler(async (_req, res) => {
      const health = await getPeaHealth(pool, config);
      res.json(health);
    }),
  );

  router.get(
    "/pea/gaps",
    authUser,
    peaRead,
    asyncHandler(async (req, res) => {
      if (!requirePeaEnabled(config, res)) return;
      if (!pool) return res.status(503).json({ ok: false, error: "db_unavailable" });
      const health = await getPeaHealth(pool, config);
      if (!health.schema_ready) {
        return res.status(503).json({ ok: false, error: "pea_schema_missing" });
      }
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const params = [limit];
      let where = "";
      if (req.query.status) {
        where = "WHERE status = $2";
        params.push(String(req.query.status));
      }
      const { rows } = await pool.query(
        `SELECT id, fingerprint, status, occurrence_count, priority_score, title, summary, severity,
                first_seen, last_seen, latest_packet_id
           FROM pea.gaps ${where}
           ORDER BY last_seen DESC
           LIMIT $1`,
        params,
      );
      res.json({ gaps: rows, next_cursor: null });
    }),
  );

  router.get(
    "/pea/gaps/:gapId",
    authUser,
    peaRead,
    asyncHandler(async (req, res) => {
      if (!requirePeaEnabled(config, res)) return;
      if (!pool) return res.status(503).json({ ok: false, error: "db_unavailable" });
      const { rows } = await pool.query(`SELECT * FROM pea.gaps WHERE id = $1`, [req.params.gapId]);
      if (!rows[0]) return res.status(404).json({ ok: false, error: "not_found" });
      const occ = await pool.query(
        `SELECT COUNT(*)::int AS n, MAX(occurred_at) AS last FROM pea.gap_occurrences WHERE gap_id = $1`,
        [req.params.gapId],
      );
      res.json({
        gap: rows[0],
        recent_occurrences: occ.rows[0]?.n ?? 0,
        last_event_at: occ.rows[0]?.last ?? null,
      });
    }),
  );

  router.get(
    "/pea/gaps/:gapId/ratchet-links",
    authUser,
    peaRead,
    asyncHandler(async (req, res) => {
      if (!requirePeaEnabled(config, res)) return;
      if (!pool) return res.status(503).json({ ok: false, error: "db_unavailable" });
      const { listRatchetLinksForGap } = await import("../lib/pea/ratchetGate.js");
      const links = await listRatchetLinksForGap(pool, req.params.gapId);
      res.json({ gap_id: req.params.gapId, ratchet_links: links });
    }),
  );

  router.post(
    "/pea/gaps/:gapId/replay",
    authUser,
    peaReplay,
    asyncHandler(async (req, res) => {
      if (!requirePeaEnabled(config, res)) return;
      if (!pool) return res.status(503).json({ ok: false, error: "db_unavailable" });
      const result = await runPeaReplay(pool, config, {
        gapId: req.params.gapId,
        packetId: req.body?.packet_id || null,
        actorId: actorId(req),
      });
      if (result.error === "gap_not_found") return res.status(404).json({ ok: false, error: "not_found" });
      res.status(201).json(result);
    }),
  );

  router.post(
    "/pea/gaps/:gapId/diagnose",
    authUser,
    peaAnalyze,
    asyncHandler(async (req, res) => {
      if (!requirePeaEnabled(config, res)) return;
      if (!pool) return res.status(503).json({ ok: false, error: "db_unavailable" });
      const { rows } = await pool.query(
        `INSERT INTO pea.jobs (job_type, gap_id, status, input_json)
         VALUES ('analyze_gap', $1, 'pending', $2::jsonb)
         RETURNING id`,
        [req.params.gapId, JSON.stringify({ force: true, note: req.body?.note || null, by: req.user?.sub })],
      );
      res.status(202).json({ job_id: rows[0].id, gap_id: req.params.gapId, status: "pending" });
    }),
  );

  router.get("/pea/packets", authUser, peaRead, asyncHandler(async (req, res) => {
    if (!requirePeaEnabled(config, res)) return;
    if (!pool) return res.status(503).json({ ok: false, error: "db_unavailable" });
    const { rows } = await pool.query(
      `SELECT id, gap_id, version, status, primary_lane, created_at, updated_at
         FROM pea.evolution_packets
        ORDER BY updated_at DESC
        LIMIT 50`,
    );
    res.json({ packets: rows });
  }));

  router.get("/pea/packets/:packetId", authUser, peaRead, asyncHandler(async (req, res) => {
    if (!requirePeaEnabled(config, res)) return;
    if (!pool) return res.status(503).json({ ok: false, error: "db_unavailable" });
    const { rows } = await pool.query(`SELECT * FROM pea.evolution_packets WHERE id = $1`, [req.params.packetId]);
    if (!rows[0]) return res.status(404).json({ ok: false, error: "not_found" });
    res.json(rows[0]);
  }));

  router.post(
    "/pea/packets/:packetId/accept",
    authUser,
    peaGrantWrite,
    asyncHandler(async (req, res) => {
      if (!requirePeaEnabled(config, res)) return;
      if (!pool) return res.status(503).json({ ok: false, error: "db_unavailable" });
      const result = await acceptPeaPacket(pool, config, {
        packetId: req.params.packetId,
        actorId: actorId(req),
        note: req.body?.note || null,
        ratchet_links: req.body?.ratchet_links,
      });
      if (result.error === "not_found") return res.status(404).json({ ok: false, error: "not_found" });
      if (result.error === "invalid_status") {
        return res.status(409).json({ ok: false, error: "invalid_status", status: result.status });
      }
      if (result.error === "ratchet_required") {
        return res.status(422).json({
          ok: false,
          error: "ratchet_required",
          failures: result.failures,
          message: "Accept requires ≥1 ratchet link (golden | fitness_sensor | rule_provenance)",
        });
      }
      res.json(result);
    }),
  );

  router.post(
    "/pea/packets/:packetId/reject",
    authUser,
    peaGrantWrite,
    asyncHandler(async (req, res) => {
      if (!requirePeaEnabled(config, res)) return;
      if (!pool) return res.status(503).json({ ok: false, error: "db_unavailable" });
      const result = await rejectPeaPacket(pool, {
        packetId: req.params.packetId,
        actorId: actorId(req),
        reason: req.body?.reason || null,
      });
      if (result.error === "not_found") return res.status(404).json({ ok: false, error: "not_found" });
      if (result.error === "invalid_status") {
        return res.status(409).json({ ok: false, error: "invalid_status", status: result.status });
      }
      res.json(result);
    }),
  );

  router.post(
    "/pea/packets/:packetId/escalate",
    authUser,
    peaGrantWrite,
    asyncHandler(async (req, res) => {
      if (!requirePeaEnabled(config, res)) return;
      if (!pool) return res.status(503).json({ ok: false, error: "db_unavailable" });
      try {
        const result = await escalatePeaPacket(pool, config, {
          packetId: req.params.packetId,
          actorId: actorId(req),
          maxLevel: req.body?.max_level,
          note: req.body?.note || null,
        });
        if (result.error === "not_found") return res.status(404).json({ ok: false, error: "not_found" });
        res.status(201).json(result);
      } catch (e) {
        if (e.code === "grant_level_too_low") {
          return res.status(400).json({ ok: false, error: "grant_level_too_low" });
        }
        throw e;
      }
    }),
  );

  router.post("/pea/packets/:packetId/implement", authUser, peaImplement, asyncHandler(async (req, res) => {
    if (!requirePeaEnabled(config, res)) return;
    if (!pool) return res.status(503).json({ ok: false, error: "db_unavailable" });
    const result = await runImplementPacket(pool, config, {
      packetId: req.params.packetId,
      actorId: actorId(req),
      adapter: req.body?.adapter || "manual",
    });
    if (result.error === "not_found") return res.status(404).json({ ok: false, error: "not_found" });
    if (result.error === "grant_required") {
      return res.status(403).json({ ok: false, error: "grant_required", min_level: 3 });
    }
    if (result.error === "implement_disabled" || result.error === "implement_staging_only") {
      return res.status(403).json({ ok: false, error: result.error, info: result.info });
    }
    res.status(201).json(result);
  }));

  router.get("/pea/grants", authUser, peaGrantRead, asyncHandler(async (_req, res) => {
    if (!requirePeaEnabled(config, res)) return;
    if (!pool) return res.status(503).json({ ok: false, error: "db_unavailable" });
    const { rows } = await pool.query(
      `SELECT id, max_level, scope, granted_by, granted_at, expires_at, gap_ids, packet_id
         FROM pea.grants
        WHERE revoked_at IS NULL AND expires_at > now()
        ORDER BY granted_at DESC`,
    );
    res.json({ grants: rows });
  }));

  router.post("/pea/grants", authUser, peaGrantWrite, asyncHandler(async (req, res) => {
    if (!requirePeaEnabled(config, res)) return;
    if (!pool) return res.status(503).json({ ok: false, error: "db_unavailable" });
    try {
      const grant = await createPeaGrant(pool, config, {
        maxLevel: req.body?.max_level ?? 3,
        scope: req.body?.scope || `manual:${actorId(req)}`,
        grantedBy: actorId(req),
        gapIds: req.body?.gap_ids || [],
        packetId: req.body?.packet_id || null,
        ttlHours: req.body?.ttl_hours,
        metadata: req.body?.metadata || {},
      });
      res.status(201).json({ ok: true, grant });
    } catch (e) {
      if (e.code === "grant_level_too_low") {
        return res.status(400).json({ ok: false, error: "grant_level_too_low" });
      }
      if (e.message === "scope_required") {
        return res.status(400).json({ ok: false, error: "scope_required" });
      }
      throw e;
    }
  }));

  router.post("/pea/grants/:grantId/revoke", authUser, peaGrantWrite, asyncHandler(async (req, res) => {
    if (!requirePeaEnabled(config, res)) return;
    if (!pool) return res.status(503).json({ ok: false, error: "db_unavailable" });
    const revoked = await revokePeaGrant(pool, {
      grantId: req.params.grantId,
      revokedBy: actorId(req),
      reason: req.body?.reason || null,
    });
    if (!revoked) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, grant: revoked });
  }));

  router.post(
    "/pea/worker/tick",
    authAdmin,
    asyncHandler(async (_req, res) => {
      if (!config.peaEnabled) return peaDisabled(res);
      if (!pool) return res.status(503).json({ ok: false, error: "db_unavailable" });
      const result = await claimAndRunPeaBatch(pool, config, logger);
      res.json({ ok: true, ...result });
    }),
  );

  return router;
}
