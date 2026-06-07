// ═══════════════════════════════════════════════════════════════════════════
// server/lib/oauthStateStore.js — Postgres-backed OAuth state (Gate 0 / Gap 4)
// ───────────────────────────────────────────────────────────────────────────
// Persists the short-lived CSRF state + PKCE code_verifier for server-side
// OAuth flows that have no logged-in user (Mercado Libre, Shopify). Replaces
// in-memory Maps that lost state on Cloud Run restart / scale-out.
//
// State is SINGLE-USE: consumeOauthState() deletes the row atomically and
// returns it, so a replayed state finds nothing (reuse rejected). Expired rows
// are ignored by the `expires_at > now()` guard.
//
// Pool pattern mirrors server/lib/tasksDb.js. When DATABASE_URL is absent
// (local dev / offline tests) an in-memory fallback preserves the same
// single-use + expiry contract so the flows keep working without a database.
// ═══════════════════════════════════════════════════════════════════════════

import pg from "pg";

let pool = null;
const memStore = new Map(); // fallback when DATABASE_URL is unset
const DEFAULT_TTL_MS = 10 * 60 * 1000;

/** @param {string} databaseUrl */
export function getOauthStatePool(databaseUrl) {
  if (!databaseUrl) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    pool.on("error", (err) => {
      console.error("[oauthStateStore] idle client error:", err?.message);
    });
  }
  return pool;
}

/**
 * Persist an OAuth state entry.
 * @param {{ pool?: object, databaseUrl?: string, state: string, provider: string,
 *           codeVerifier: string, meta?: object|null, ttlMs?: number }} opts
 */
export async function saveOauthState({
  pool: injectedPool,
  databaseUrl,
  state,
  provider,
  codeVerifier,
  meta = null,
  ttlMs = DEFAULT_TTL_MS,
}) {
  if (!state || !provider || !codeVerifier) {
    throw new Error("saveOauthState requires state, provider and codeVerifier");
  }
  const p = injectedPool || getOauthStatePool(databaseUrl);
  const expiresAtMs = Date.now() + ttlMs;
  if (!p) {
    memStore.set(state, { provider, codeVerifier, meta, expiresAtMs });
    return;
  }
  await p.query(
    `INSERT INTO public.oauth_state (state, provider, code_verifier, meta, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (state) DO UPDATE
       SET provider = EXCLUDED.provider,
           code_verifier = EXCLUDED.code_verifier,
           meta = EXCLUDED.meta,
           expires_at = EXCLUDED.expires_at`,
    [state, provider, codeVerifier, meta ? JSON.stringify(meta) : null, new Date(expiresAtMs).toISOString()],
  );
}

/**
 * Atomically consume (delete + return) an OAuth state entry. Returns null when
 * the state is unknown, expired, already consumed (reuse), or provider-mismatched.
 * @param {{ pool?: object, databaseUrl?: string, state: string, provider?: string|null }} opts
 * @returns {Promise<{ provider: string, codeVerifier: string, meta: object|null } | null>}
 */
export async function consumeOauthState({ pool: injectedPool, databaseUrl, state, provider = null }) {
  if (!state) return null;
  const p = injectedPool || getOauthStatePool(databaseUrl);
  if (!p) {
    const entry = memStore.get(state);
    memStore.delete(state); // single-use: a second consume finds nothing
    if (!entry) return null;
    if (entry.expiresAtMs <= Date.now()) return null;
    if (provider && entry.provider !== provider) return null;
    return { provider: entry.provider, codeVerifier: entry.codeVerifier, meta: entry.meta ?? null };
  }
  const sql =
    `DELETE FROM public.oauth_state
      WHERE state = $1 AND expires_at > now()` +
    (provider ? " AND provider = $2" : "") +
    " RETURNING provider, code_verifier, meta";
  const { rows } = await p.query(sql, provider ? [state, provider] : [state]);
  if (!rows.length) return null;
  const row = rows[0];
  return { provider: row.provider, codeVerifier: row.code_verifier, meta: row.meta ?? null };
}

/** Tests only — reset module state between cases. */
export async function _resetOauthStateStoreForTests() {
  memStore.clear();
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}
