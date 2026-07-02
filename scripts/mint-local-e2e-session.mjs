#!/usr/bin/env node
/**
 * mint-local-e2e-session.mjs — local E2E session without Google OAuth.
 *
 * Inserts a fresh identity.sessions row for a known BMC user and prints the
 * refresh token (bmc_sess value) on stdout. Dev/local only — never for prod CI.
 *
 * Env: DATABASE_URL (Doppler), optional TOUR_USER_EMAIL (default matias.portugau@gmail.com)
 *
 * Usage: COOKIE=$(doppler run -- node scripts/mint-local-e2e-session.mjs)
 */
import crypto from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ quiet: true });

const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000;
const EMAIL = (process.env.TOUR_USER_EMAIL || "matias.portugau@gmail.com").trim().toLowerCase();
const DATABASE_URL = process.env.DATABASE_URL || "";

function die(msg) {
  process.stderr.write(`[mint-local-e2e-session] ${msg}\n`);
  process.exit(1);
}

if (!DATABASE_URL) die("falta DATABASE_URL — doppler run -- node scripts/mint-local-e2e-session.mjs");

const pool = new pg.Pool({ connectionString: DATABASE_URL });
try {
  const userRes = await pool.query(
    "select user_id from identity.users where lower(email) = $1 and status = 'active' limit 1",
    [EMAIL],
  );
  const userId = userRes.rows[0]?.user_id;
  if (!userId) die(`usuario no encontrado o inactivo: ${EMAIL}`);

  const refreshToken = crypto.randomBytes(48).toString("hex");
  const refreshHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await pool.query(
    `insert into identity.sessions (
       user_id, refresh_token_hash, refresh_expires_at, ip, user_agent
     ) values ($1, $2, $3, $4, $5)`,
    [userId, refreshHash, refreshExpiresAt, "127.0.0.1", "mint-local-e2e-session"],
  );

  process.stderr.write(`[mint-local-e2e-session] sesión OK (${EMAIL})\n`);
  process.stdout.write(refreshToken);
} catch (e) {
  die(e?.message || String(e));
} finally {
  await pool.end();
}