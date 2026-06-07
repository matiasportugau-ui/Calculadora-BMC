-- Phase 0 fix: Persistent OAuth state store (replaces in-memory Map in server/index.js)
-- Used for ML (and potentially other) PKCE OAuth flows to survive Cloud Run restarts / multi-instance.

CREATE TABLE IF NOT EXISTS public.oauth_states (
  state text PRIMARY KEY,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON public.oauth_states (expires_at);

-- Optional: comment for future humans
COMMENT ON TABLE public.oauth_states IS 'Short-lived OAuth state for PKCE flows (ML, etc.). TTL ~10min. Cleaned by app.';
