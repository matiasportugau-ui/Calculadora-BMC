-- Single-use marker for OAuth state (reuse-rejection). See server/lib/oauthStateStore.js.
-- The callback consumes the state atomically (UPDATE ... SET consumed_at WHERE consumed_at IS NULL),
-- so a state can be used exactly once; replays are rejected.
--
-- Self-contained + idempotent: this also (re)creates the base table and index. The prod DB was
-- verified on 2026-06-13 to be MISSING public.oauth_states — the earlier
-- 20260607_add_oauth_states.sql had never been applied there, and oauthStateStore.js does no lazy
-- CREATE. Folding the base DDL in here means applying this one migration yields the full, correct
-- schema standalone and repairs the latent gap that left ML/Shopify OAuth state unbacked.
CREATE TABLE IF NOT EXISTS public.oauth_states (
  state text PRIMARY KEY,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON public.oauth_states (expires_at);

ALTER TABLE public.oauth_states
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz;
