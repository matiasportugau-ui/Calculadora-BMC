-- B-05: Persist agent tool call telemetry beyond Cloud Run in-memory ring buffer.
-- Safe to re-run (IF NOT EXISTS). Also auto-ensured on first write from toolStats.js.

CREATE TABLE IF NOT EXISTS public.agent_tool_calls (
  id           bigserial PRIMARY KEY,
  ts           timestamptz NOT NULL DEFAULT now(),
  tool         text        NOT NULL,
  ok           boolean     NOT NULL,
  latency_ms   real        NOT NULL DEFAULT 0,
  error_class  text
);

CREATE INDEX IF NOT EXISTS agent_tool_calls_ts_idx
  ON public.agent_tool_calls (ts DESC);

CREATE INDEX IF NOT EXISTS agent_tool_calls_tool_ts_idx
  ON public.agent_tool_calls (tool, ts DESC);
