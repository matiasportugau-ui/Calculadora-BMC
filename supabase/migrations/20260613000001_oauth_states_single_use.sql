-- Single-use marker for OAuth state (reuse-rejection). See server/lib/oauthStateStore.js.
-- The callback consumes the state atomically (UPDATE ... SET consumed_at WHERE consumed_at IS NULL),
-- so a state can be used exactly once; replays are rejected.
ALTER TABLE public.oauth_states
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz;
