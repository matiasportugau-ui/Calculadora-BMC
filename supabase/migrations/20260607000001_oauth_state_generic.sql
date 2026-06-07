-- Gate 0 / Gap 4 — Persist server-side OAuth state in Postgres.
-- Replaces the in-memory Maps used by the Mercado Libre (server/index.js) and
-- Shopify (server/routes/shopify.js) OAuth flows, which lost state on Cloud Run
-- restart / scale-out. Google Tasks keeps its own tasks.oauth_state table
-- (it carries a user_id FK to identity.users); these flows have no logged-in
-- user, so this table is intentionally generic and FK-free.

CREATE TABLE IF NOT EXISTS public.oauth_state (
  state         TEXT PRIMARY KEY,
  provider      TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  meta          JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_state_expires_at ON public.oauth_state(expires_at);

COMMENT ON TABLE public.oauth_state IS
  'Short-lived CSRF state + PKCE verifier for ML/Shopify OAuth (Gate 0 / Gap 4). Single-use: consumed via DELETE ... RETURNING; expired rows are ignored.';
