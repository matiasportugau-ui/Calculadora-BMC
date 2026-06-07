import { getWaPool } from "./waDb.js"; // reuses DATABASE_URL + pg pool pattern

const TTL_MS = 10 * 60 * 1000; // 10 minutes

let pool = null;

function getPool() {
  if (!pool) {
    pool = getWaPool(process.env.DATABASE_URL);
  }
  return pool;
}

/**
 * Simple persistent OAuth state store (replaces the in-memory Map in server/index.js).
 * Stores { codeVerifier, ...other } for PKCE flows (ML, etc.).
 *
 * Table (apply via migration or manually):
 *   CREATE TABLE IF NOT EXISTS public.oauth_states (
 *     state text PRIMARY KEY,
 *     payload jsonb NOT NULL,
 *     expires_at timestamptz NOT NULL
 *   );
 *   CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON public.oauth_states (expires_at);
 */
export const oauthStateStore = {
  async set(state, data) {
    const db = getPool();
    const expiresAt = new Date(Date.now() + TTL_MS);
    await db.query(
      `INSERT INTO public.oauth_states (state, payload, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (state) DO UPDATE SET payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at`,
      [state, data, expiresAt]
    );
  },

  async get(state) {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT payload, expires_at FROM public.oauth_states WHERE state = $1`,
      [state]
    );
    if (rows.length === 0) return null;

    const row = rows[0];
    if (new Date(row.expires_at) < new Date()) {
      await this.delete(state);
      return null;
    }
    return row.payload;
  },

  async delete(state) {
    const db = getPool();
    await db.query(`DELETE FROM public.oauth_states WHERE state = $1`, [state]);
  },

  async cleanupExpired() {
    const db = getPool();
    await db.query(`DELETE FROM public.oauth_states WHERE expires_at < now()`);
  },
};

// Periodic cleanup (every 5 minutes)
setInterval(() => {
  oauthStateStore.cleanupExpired().catch(() => {});
}, 5 * 60 * 1000).unref();
