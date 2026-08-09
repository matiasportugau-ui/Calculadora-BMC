-- PAOS Event Ledger (IMP-PAOS-01)
-- Also auto-ensured at runtime by server/lib/paosEventLedger.js when DATABASE_URL is set.

CREATE TABLE IF NOT EXISTS public.agent_events (
  id           bigserial PRIMARY KEY,
  ts           timestamptz NOT NULL DEFAULT now(),
  type         text        NOT NULL,
  session_id   text,
  actor        text,
  payload      jsonb       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS agent_events_ts_idx ON public.agent_events (ts DESC);
CREATE INDEX IF NOT EXISTS agent_events_session_idx ON public.agent_events (session_id, ts DESC);
