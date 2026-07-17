/**
 * Finanzas module password gate — shared team secret + session-scoped unlock.
 * Enforced server-side on /api/banco/* (except health + unlock endpoints).
 */
import crypto from "node:crypto";

function sha256Digest(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest();
}

/** Timing-safe compare of plaintext input vs configured secret. */
export function verifyFinanzasPassword(input, secret) {
  if (!secret || input == null || input === "") return false;
  const a = sha256Digest(input);
  const b = sha256Digest(secret);
  return crypto.timingSafeEqual(a, b);
}

/** Gate active in production; skipped in local development (mirrors RequireGrant dev relax). */
export function isFinanzasGateEnabled(config) {
  const appEnv = config?.appEnv || process.env.APP_ENV || process.env.NODE_ENV || "development";
  return appEnv !== "development";
}

export function shouldBypassFinanzasUnlock(req, config) {
  if (!isFinanzasGateEnabled(config)) return true;
  if (req.user?.role === "superadmin") return true;
  return false;
}

export async function isFinanzasUnlocked(pool, sessionId) {
  if (!pool || !sessionId) return false;
  const { rows } = await pool.query(
    `select finanzas_unlocked_until
       from identity.sessions
      where session_id = $1
        and revoked_at is null`,
    [sessionId],
  );
  const until = rows[0]?.finanzas_unlocked_until;
  if (!until) return false;
  return new Date(until).getTime() > Date.now();
}

export async function getFinanzasUnlockExpiry(pool, sessionId) {
  if (!pool || !sessionId) return null;
  const { rows } = await pool.query(
    `select finanzas_unlocked_until
       from identity.sessions
      where session_id = $1
        and revoked_at is null`,
    [sessionId],
  );
  return rows[0]?.finanzas_unlocked_until ?? null;
}

export async function setFinanzasUnlock(pool, sessionId, ttlHours) {
  const hours = Math.max(1, Math.min(72, Number(ttlHours) || 12));
  const until = new Date(Date.now() + hours * 3600 * 1000);
  await pool.query(
    `update identity.sessions
        set finanzas_unlocked_until = $2
      where session_id = $1
        and revoked_at is null`,
    [sessionId, until],
  );
  return until;
}

export async function clearFinanzasUnlock(pool, sessionId) {
  if (!pool || !sessionId) return;
  await pool.query(
    `update identity.sessions
        set finanzas_unlocked_until = null
      where session_id = $1`,
    [sessionId],
  );
}

export function requireFinanzasUnlock(config, pool) {
  return async (req, res, next) => {
    try {
      if (shouldBypassFinanzasUnlock(req, config)) return next();
      if (!pool) {
        return res.status(503).json({ ok: false, error: "DATABASE_URL not configured" });
      }
      const sessionId = req.user?.sessionId;
      if (!sessionId) {
        return res.status(403).json({ ok: false, error: "finanzas_locked" });
      }
      const unlocked = await isFinanzasUnlocked(pool, sessionId);
      if (!unlocked) {
        return res.status(403).json({ ok: false, error: "finanzas_locked" });
      }
      return next();
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || "finanzas_unlock_internal" });
    }
  };
}
