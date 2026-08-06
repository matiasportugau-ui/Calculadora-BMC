-- Recovery meeting snapshot for Hub Finanzas «Recuperación»
-- Also auto-created by server/lib/finanzasRecoverySnapshot.js ensureSchema.

CREATE TABLE IF NOT EXISTS public.finanzas_recovery_snapshots (
  id            bigserial PRIMARY KEY,
  as_of         date,
  payload       jsonb NOT NULL,
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finanzas_recovery_snapshots_created_at_idx
  ON public.finanzas_recovery_snapshots (created_at DESC);
