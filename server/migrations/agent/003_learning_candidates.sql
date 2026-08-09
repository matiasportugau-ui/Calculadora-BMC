-- PAOS Learning Candidates (G2 remaining)
-- Also auto-ensured by server/lib/paosCandidates.js when DATABASE_URL is set.

CREATE TABLE IF NOT EXISTS public.learning_candidates (
  id           text PRIMARY KEY,
  state        text NOT NULL,
  scope        text,
  source       text,
  session_id   text,
  delta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  eval_report  jsonb,
  training_kb_id text,
  reject_reason text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS learning_candidates_state_idx
  ON public.learning_candidates (state, updated_at DESC);
