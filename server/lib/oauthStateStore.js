import { getWaPool } from "./waDb.js"; // reuses DATABASE_URL + pg pool pattern

const TTL_MS = 10 * 60 * 1000; // 10 minutes

let pool = null;
let _testPool = null;

function getPool() {
  if (_testPool) return _testPool;
  if (!pool) {
    pool = getWaPool(process.env.DATABASE_URL);
  }
  return pool;
}

/** Test-only — inject an in-memory pg.Pool shim. Mirrors server/lib/quoteStore.js. */
export const __test__ = {
  setPool(p) { _testPool = p; },
  reset() { _testPool = null; },
};

/**
 * Persistent, single-use OAuth state store (replaces in-memory Maps).
 * Stores { codeVerifier, ...other } for PKCE flows (ML, Shopify, etc.).
 *
 * State is consumed atomically on callback (see `consume`), so each state is
 * usable exactly once — replays/reuse are rejected. Survives Cloud Run
 * scale-to-zero / multi-instance because it lives in Postgres, not process memory.
 *
 * Table: public.oauth_states (state text PK, payload jsonb, expires_at timestamptz,
 *   consumed_at timestamptz) — see supabase/migrations/*_oauth_states*.sql.
 */
export const oauthStateStore = {
  async set(state, data) {
    const db = getPool();
    const expiresAt = new Date(Date.now() + TTL_MS);
    await db.query(
      `INSERT INTO public.oauth_states (state, payload, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (state) DO UPDATE SET payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at, consumed_at = NULL`,
      [state, data, expiresAt]
    );
  },

  /**
   * Atomic single-use consume. Marks the state consumed and returns its payload
   * iff it is still pending and unexpired. Returns null otherwise (reused /
   * expired / unknown) — the caller must abort the OAuth flow in that case.
   */
  async consume(state) {
    const db = getPool();
    const { rows } = await db.query(
      `UPDATE public.oauth_states SET consumed_at = now()
        WHERE state = $1 AND consumed_at IS NULL AND expires_at > now()
       RETURNING payload`,
      [state]
    );
    return rows.length ? rows[0].payload : null;
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
