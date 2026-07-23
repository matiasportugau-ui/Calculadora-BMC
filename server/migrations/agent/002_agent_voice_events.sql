-- IMP-09: Persist voice analytics beyond Cloud Run cold starts.
-- Safe to re-run (IF NOT EXISTS). Also auto-ensured on first write from voiceErrorLog.js.

CREATE TABLE IF NOT EXISTS public.agent_voice_events (
  id         bigserial PRIMARY KEY,
  ts         timestamptz NOT NULL DEFAULT now(),
  kind       text        NOT NULL,
  message    text        NOT NULL DEFAULT '',
  status     int,
  detail     text
);

CREATE INDEX IF NOT EXISTS agent_voice_events_ts_idx
  ON public.agent_voice_events (ts DESC);

CREATE INDEX IF NOT EXISTS agent_voice_events_kind_ts_idx
  ON public.agent_voice_events (kind, ts DESC);
