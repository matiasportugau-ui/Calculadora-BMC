// ═══════════════════════════════════════════════════════════════════════════
// server/routes/identityAdmin.js — admin-only user management endpoints.
// ───────────────────────────────────────────────────────────────────────────
// All routes require role=admin (superadmin inherited). Writes are audit-logged
// to identity.audit_log. Designed to drive a UI at /hub/admin/users.
//
//   GET    /api/admin/users                          list with filters + cursor
//   GET    /api/admin/users/:id                      full detail w/ grants + recent activity
//   POST   /api/admin/users/:id/role-grants          { role } — add
//   DELETE /api/admin/users/:id/role-grants/:role    remove
//   PATCH  /api/admin/users/:id/module-grants/:m     { level } — set or remove (level=none)
//   POST   /api/admin/users/:id/suspend              { reason? }
//   POST   /api/admin/users/:id/reactivate
//   POST   /api/admin/users/:id/revoke-sessions
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import rateLimit from "express-rate-limit";
import { getWaPool } from "../lib/waDb.js";
import { config } from "../config.js";
import { requireUser } from "../lib/identityAuth.js";
import { safeErr as _safeErr } from "../lib/safeErr.js";
import { logActivity } from "../lib/userActivityLog.js";

const router = express.Router();

let _testPool = null;
function pool() {
  if (_testPool) return _testPool;
  const p = getWaPool(config.databaseUrl);
  if (!p) throw Object.assign(new Error("db_unavailable"), { status: 503 });
  return p;
}

export const __test__ = {
  setPool(p) { _testPool = p; },
  reset() { _testPool = null; },
};

const VALID_ROLES = new Set(["comprador", "operator", "admin", "superadmin"]);
const VALID_LEVELS = new Set(["none", "read", "write", "admin"]);
const ROLE_RANK = { superadmin: 4, admin: 3, operator: 2, comprador: 1 };

async function audit({ actorId, action, resourceId, ip, userAgent, payload, req }) {
  try {
    await pool().query(
      `insert into identity.audit_log (actor_user_id, actor_kind, action, resource, resource_id, ip, user_agent, payload)
       values ($1, 'user', $2, 'identity.users', $3, $4, $5, $6::jsonb)`,
      [actorId, action, resourceId, ip || null, userAgent || null, JSON.stringify(payload || {})],
    );
  } catch {
    // audit failures must not block the action; surfaced via Cloud Logging from pino
  }
  // Dual-write to identity.user_activity_log so admin actions show up in
  // the /hub/admin/analytics surface and (for the actor) their own /mi-espacio
  // Historial. Same action name passes through.
  try {
    await logActivity({
      pool: pool(),
      actorId,
      action,
      resourceType: "identity.users",
      resourceId,
      payload: payload || {},
      req: req || (ip ? { ip, get: () => userAgent } : undefined),
    });
  } catch {
    // dual-write failure should never block the original action
  }
}

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── GET /api/admin/users ──────────────────────────────────────────────────
// Filters: search (email/name ILIKE), role, module, status, plan_tier
// Pagination: keyset on (created_at DESC, user_id DESC)
router.get("/api/admin/users", readLimiter, requireUser({ role: "admin" }), async (req, res) => {
  try {
    const search = String(req.query.search || "").trim().slice(0, 100);
    const role = String(req.query.role || "").trim();
    const moduleName = String(req.query.module || "").trim();
    const status = String(req.query.status || "").trim();
    const planTier = String(req.query.plan_tier || "").trim();
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const cursorTs = req.query.cursor_ts ? new Date(String(req.query.cursor_ts)) : null;
    const cursorId = req.query.cursor_id ? String(req.query.cursor_id) : null;

    const where = [];
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      where.push(`(u.email ILIKE $${params.length} OR u.name ILIKE $${params.length})`);
    }
    if (role && VALID_ROLES.has(role)) {
      params.push(role);
      where.push(`EXISTS (SELECT 1 FROM identity.role_grants rg WHERE rg.user_id = u.user_id AND rg.role = $${params.length})`);
    }
    if (moduleName) {
      params.push(moduleName);
      where.push(`EXISTS (SELECT 1 FROM identity.module_grants mg WHERE mg.user_id = u.user_id AND mg.module = $${params.length})`);
    }
    if (status) {
      params.push(status);
      where.push(`u.status = $${params.length}`);
    }
    if (planTier) {
      params.push(planTier);
      where.push(`u.plan_tier = $${params.length}`);
    }
    if (cursorTs && cursorId) {
      params.push(cursorTs.toISOString(), cursorId);
      where.push(`(u.created_at, u.user_id) < ($${params.length - 1}, $${params.length})`);
    }
    params.push(limit + 1);

    const sql = `
      SELECT u.user_id, u.email, u.name, u.picture_url, u.plan_tier, u.status,
             u.last_login_at, u.last_active_at, u.created_at, u.mfa_required,
             (SELECT array_agg(rg.role ORDER BY rg.role) FROM identity.role_grants rg WHERE rg.user_id = u.user_id) AS roles,
             (SELECT count(*) FROM identity.module_grants mg WHERE mg.user_id = u.user_id) AS module_grant_count
      FROM identity.users u
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY u.created_at DESC, u.user_id DESC
      LIMIT $${params.length}
    `;

    const { rows } = await pool().query(sql, params);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    res.json({
      ok: true,
      items,
      next_cursor: hasMore && last ? { ts: last.created_at, id: last.user_id } : null,
    });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// ─── GET /api/admin/users/:id ──────────────────────────────────────────────
router.get("/api/admin/users/:id", readLimiter, requireUser({ role: "admin" }), async (req, res) => {
  try {
    const { id } = req.params;
    const u = await pool().query(
      `SELECT user_id, email, name, picture_url, avatar_preset, plan_tier, status,
              last_login_at, last_active_at, jwt_revoked_at, mfa_required, created_at, updated_at
         FROM identity.users WHERE user_id = $1`,
      [id],
    );
    if (!u.rows.length) return res.status(404).json({ ok: false, error: "not_found" });
    const user = u.rows[0];

    const [roles, grants, sessions, recentAudit] = await Promise.all([
      pool().query(
        `SELECT role, granted_by, granted_at FROM identity.role_grants WHERE user_id = $1 ORDER BY role`,
        [id],
      ),
      pool().query(
        `SELECT module, level, granted_by, granted_at FROM identity.module_grants WHERE user_id = $1 ORDER BY module`,
        [id],
      ),
      pool().query(
        `SELECT session_id, ip, user_agent, created_at, refresh_expires_at, revoked_at
           FROM identity.sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [id],
      ),
      pool().query(
        `SELECT audit_id, actor_user_id, action, resource, resource_id, ip, payload, at
           FROM identity.audit_log
          WHERE actor_user_id = $1 OR resource_id = $1::text
          ORDER BY at DESC LIMIT 20`,
        [id],
      ),
    ]);

    res.json({
      ok: true,
      user,
      roles: roles.rows,
      module_grants: grants.rows,
      sessions: sessions.rows,
      recent_audit: recentAudit.rows,
    });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// ─── POST /api/admin/users/:id/role-grants ─────────────────────────────────
router.post("/api/admin/users/:id/role-grants", writeLimiter, requireUser({ role: "admin" }), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body || {};
    if (!VALID_ROLES.has(role)) {
      return res.status(400).json({ ok: false, error: "invalid_role", allowed: [...VALID_ROLES] });
    }
    if (id === req.user.id) {
      return res.status(403).json({ ok: false, error: "cannot_modify_self" });
    }
    // Only superadmin can grant/revoke superadmin.
    if (role === "superadmin" && req.user.role !== "superadmin") {
      return res.status(403).json({ ok: false, error: "superadmin_required" });
    }
    const exists = await pool().query(`SELECT 1 FROM identity.users WHERE user_id = $1`, [id]);
    if (!exists.rows.length) return res.status(404).json({ ok: false, error: "not_found" });
    await pool().query(
      `INSERT INTO identity.role_grants (user_id, role, granted_by)
       VALUES ($1, $2, $3) ON CONFLICT (user_id, role) DO NOTHING`,
      [id, role, req.user.id],
    );
    await audit({
      actorId: req.user.id,
      action: "admin.role_grant.add",
      resourceId: id,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      payload: { role },
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// ─── DELETE /api/admin/users/:id/role-grants/:role ─────────────────────────
router.delete("/api/admin/users/:id/role-grants/:role", writeLimiter, requireUser({ role: "admin" }), async (req, res) => {
  try {
    const { id, role } = req.params;
    if (!VALID_ROLES.has(role)) {
      return res.status(400).json({ ok: false, error: "invalid_role" });
    }
    if (id === req.user.id) {
      return res.status(403).json({ ok: false, error: "cannot_modify_self" });
    }
    // Demoting a superadmin requires superadmin actor.
    if (role === "superadmin" && req.user.role !== "superadmin") {
      return res.status(403).json({ ok: false, error: "superadmin_required" });
    }
    // An admin actor cannot demote a user that holds superadmin.
    if (req.user.role !== "superadmin") {
      const su = await pool().query(
        `SELECT 1 FROM identity.role_grants WHERE user_id = $1 AND role = 'superadmin'`,
        [id],
      );
      if (su.rows.length) return res.status(403).json({ ok: false, error: "target_is_superadmin" });
    }
    const { rowCount } = await pool().query(
      `DELETE FROM identity.role_grants WHERE user_id = $1 AND role = $2`,
      [id, role],
    );
    await audit({
      actorId: req.user.id,
      action: "admin.role_grant.remove",
      resourceId: id,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      payload: { role, removed: rowCount > 0 },
    });
    res.json({ ok: true, removed: rowCount > 0 });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// ─── PATCH /api/admin/users/:id/module-grants/:module ──────────────────────
// level="none" removes the explicit grant (falls back to role default)
router.patch("/api/admin/users/:id/module-grants/:module", writeLimiter, requireUser({ role: "admin" }), async (req, res) => {
  try {
    const { id, module: moduleName } = req.params;
    const { level } = req.body || {};
    if (!VALID_LEVELS.has(level)) {
      return res.status(400).json({ ok: false, error: "invalid_level", allowed: [...VALID_LEVELS] });
    }
    if (id === req.user.id) {
      return res.status(403).json({ ok: false, error: "cannot_modify_self" });
    }
    const mod = await pool().query(`SELECT 1 FROM identity.modules WHERE module = $1`, [moduleName]);
    if (!mod.rows.length) return res.status(400).json({ ok: false, error: "unknown_module" });
    const usr = await pool().query(`SELECT 1 FROM identity.users WHERE user_id = $1`, [id]);
    if (!usr.rows.length) return res.status(404).json({ ok: false, error: "not_found" });

    if (level === "none") {
      await pool().query(
        `DELETE FROM identity.module_grants WHERE user_id = $1 AND module = $2`,
        [id, moduleName],
      );
    } else {
      await pool().query(
        `INSERT INTO identity.module_grants (user_id, module, level, granted_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, module) DO UPDATE
            SET level = excluded.level, granted_by = excluded.granted_by, granted_at = now()`,
        [id, moduleName, level, req.user.id],
      );
    }
    await audit({
      actorId: req.user.id,
      action: "admin.module_grant.set",
      resourceId: id,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      payload: { module: moduleName, level },
    });
    res.json({ ok: true, module: moduleName, level });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// ─── POST /api/admin/users/:id/suspend ─────────────────────────────────────
router.post("/api/admin/users/:id/suspend", writeLimiter, requireUser({ role: "admin" }), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    if (id === req.user.id) {
      return res.status(403).json({ ok: false, error: "cannot_modify_self" });
    }
    if (req.user.role !== "superadmin") {
      const su = await pool().query(
        `SELECT 1 FROM identity.role_grants WHERE user_id = $1 AND role = 'superadmin'`,
        [id],
      );
      if (su.rows.length) return res.status(403).json({ ok: false, error: "target_is_superadmin" });
    }
    const { rows } = await pool().query(
      `UPDATE identity.users SET status='suspended', jwt_revoked_at=now(), updated_at=now()
       WHERE user_id = $1 RETURNING user_id, status`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: "not_found" });
    // Also revoke all live sessions
    await pool().query(
      `UPDATE identity.sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`,
      [id],
    );
    await audit({
      actorId: req.user.id,
      action: "admin.user.suspend",
      resourceId: id,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      payload: { reason: reason || null },
    });
    res.json({ ok: true, user: rows[0] });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// ─── POST /api/admin/users/:id/reactivate ──────────────────────────────────
router.post("/api/admin/users/:id/reactivate", writeLimiter, requireUser({ role: "admin" }), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool().query(
      `UPDATE identity.users SET status='active', updated_at=now()
       WHERE user_id = $1 RETURNING user_id, status`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: "not_found" });
    await audit({
      actorId: req.user.id,
      action: "admin.user.reactivate",
      resourceId: id,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
    res.json({ ok: true, user: rows[0] });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// ─── POST /api/admin/users/:id/revoke-sessions ─────────────────────────────
router.post("/api/admin/users/:id/revoke-sessions", writeLimiter, requireUser({ role: "admin" }), async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool().query(
      `UPDATE identity.sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`,
      [id],
    );
    await pool().query(
      `UPDATE identity.users SET jwt_revoked_at=now() WHERE user_id=$1`,
      [id],
    );
    await audit({
      actorId: req.user.id,
      action: "admin.user.revoke_sessions",
      resourceId: id,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      payload: { revoked_count: rowCount },
    });
    res.json({ ok: true, revoked_count: rowCount });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

export default router;
