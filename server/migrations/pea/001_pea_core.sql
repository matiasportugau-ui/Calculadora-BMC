-- PEA core schema (TARGET — Panelin Evolution Architect)
-- Milestone M0 contract draft. NOT auto-applied to prod by M0 goal.
-- Apply via future migrate path when PEA_ENABLED=1 (IMP-PEA-03).
-- Seal: PEA_POSTGRES_QUEUE_V1 · ADR-004 · ADR-011

CREATE SCHEMA IF NOT EXISTS pea;

-- ─── Gap ingest & dedupe ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pea.gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint CHAR(64) NOT NULL,
  fingerprint_version INT NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  signal_type VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'medium',
  occurrence_count INT NOT NULL DEFAULT 1,
  priority_score NUMERIC(10, 4) NOT NULL DEFAULT 0,
  title VARCHAR(256) NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  latest_packet_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pea_gaps_status_valid CHECK (
    status IN ('open', 'investigating', 'ready_for_review', 'resolved', 'ignored', 'blocked')
  ),
  CONSTRAINT pea_gaps_severity_valid CHECK (
    severity IN ('low', 'medium', 'high', 'critical')
  ),
  CONSTRAINT pea_gaps_fingerprint_unique UNIQUE (fingerprint, fingerprint_version)
);

CREATE INDEX IF NOT EXISTS pea_gaps_status_idx ON pea.gaps (status, priority_score DESC);
CREATE INDEX IF NOT EXISTS pea_gaps_last_seen_idx ON pea.gaps (last_seen DESC);

CREATE TABLE IF NOT EXISTS pea.gap_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id UUID REFERENCES pea.gaps(id) ON DELETE SET NULL,
  source VARCHAR(32) NOT NULL,
  signal_type VARCHAR(64) NOT NULL,
  tool_id VARCHAR(128),
  session_id VARCHAR(128),
  conversation_id UUID,
  severity VARCHAR(16) NOT NULL DEFAULT 'medium',
  fingerprint_inputs JSONB NOT NULL DEFAULT '{}'::JSONB,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pea_gap_events_source_valid CHECK (
    source IN ('panelin_fast', 'operator_feedback', 'system_probe')
  )
);

CREATE INDEX IF NOT EXISTS pea_gap_events_gap_id_idx ON pea.gap_events (gap_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS pea_gap_events_occurred_idx ON pea.gap_events (occurred_at DESC);

CREATE TABLE IF NOT EXISTS pea.gap_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id UUID NOT NULL REFERENCES pea.gaps(id) ON DELETE CASCADE,
  gap_event_id UUID NOT NULL REFERENCES pea.gap_events(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pea_gap_occurrences_event_unique UNIQUE (gap_event_id)
);

CREATE INDEX IF NOT EXISTS pea_gap_occurrences_gap_idx ON pea.gap_occurrences (gap_id, occurred_at DESC);

-- ─── Evidence & analysis ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pea.evidence_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id UUID NOT NULL REFERENCES pea.gaps(id) ON DELETE CASCADE,
  manifest JSONB NOT NULL DEFAULT '{}'::JSONB,
  file_refs JSONB NOT NULL DEFAULT '[]'::JSONB,
  token_estimate INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pea_evidence_packs_gap_idx ON pea.evidence_packs (gap_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pea.analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id UUID NOT NULL REFERENCES pea.gaps(id) ON DELETE CASCADE,
  packet_id UUID,
  phase VARCHAR(32) NOT NULL,
  preflight_verdict VARCHAR(32) NOT NULL,
  estimated_tokens INT NOT NULL DEFAULT 0,
  reserved_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  actual_tokens INT,
  actual_usd NUMERIC(10, 6),
  model_calls_planned INT NOT NULL DEFAULT 0,
  model_calls_used INT NOT NULL DEFAULT 0,
  evidence_pack_id UUID REFERENCES pea.evidence_packs(id) ON DELETE SET NULL,
  blocked_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT pea_analysis_runs_phase_valid CHECK (
    phase IN ('triage', 'explore', 'plan', 'critic', 'full_iteration')
  ),
  CONSTRAINT pea_analysis_runs_verdict_valid CHECK (
    preflight_verdict IN ('AUTO_RUN', 'ASK_INTERNAL', 'DECOMPOSE', 'DENY_UNPRICED', 'BLOCKED')
  )
);

CREATE INDEX IF NOT EXISTS pea_analysis_runs_gap_idx ON pea.analysis_runs (gap_id, started_at DESC);

CREATE TABLE IF NOT EXISTS pea.evolution_packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id UUID NOT NULL REFERENCES pea.gaps(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  primary_lane CHAR(1) NOT NULL,
  secondary_lanes JSONB NOT NULL DEFAULT '[]'::JSONB,
  diagnosis TEXT NOT NULL DEFAULT '',
  recommended_changes JSONB NOT NULL DEFAULT '[]'::JSONB,
  ratchet_plan JSONB NOT NULL DEFAULT '{}'::JSONB,
  spec_citations JSONB NOT NULL DEFAULT '[]'::JSONB,
  critic_result JSONB NOT NULL DEFAULT '{}'::JSONB,
  blast_radius JSONB NOT NULL DEFAULT '{}'::JSONB,
  analysis_run_id UUID REFERENCES pea.analysis_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pea_evolution_packets_status_valid CHECK (
    status IN ('draft', 'critic_pending', 'critic_failed', 'ready_for_review', 'accepted', 'rejected', 'superseded')
  ),
  CONSTRAINT pea_evolution_packets_lane_valid CHECK (
    primary_lane IN ('H', 'K', 'C')
  ),
  CONSTRAINT pea_evolution_packets_gap_version_unique UNIQUE (gap_id, version)
);

CREATE INDEX IF NOT EXISTS pea_evolution_packets_gap_idx ON pea.evolution_packets (gap_id, version DESC);
CREATE INDEX IF NOT EXISTS pea_evolution_packets_status_idx ON pea.evolution_packets (status, updated_at DESC);

ALTER TABLE pea.gaps
  DROP CONSTRAINT IF EXISTS pea_gaps_latest_packet_fk;
ALTER TABLE pea.gaps
  ADD CONSTRAINT pea_gaps_latest_packet_fk
  FOREIGN KEY (latest_packet_id) REFERENCES pea.evolution_packets(id) ON DELETE SET NULL;

ALTER TABLE pea.analysis_runs
  DROP CONSTRAINT IF EXISTS pea_analysis_runs_packet_fk;
ALTER TABLE pea.analysis_runs
  ADD CONSTRAINT pea_analysis_runs_packet_fk
  FOREIGN KEY (packet_id) REFERENCES pea.evolution_packets(id) ON DELETE SET NULL;

-- ─── Grants & replay ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pea.grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  max_level INT NOT NULL,
  scope VARCHAR(256) NOT NULL,
  granted_by VARCHAR(128) NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  gap_ids JSONB NOT NULL DEFAULT '[]'::JSONB,
  packet_id UUID REFERENCES pea.evolution_packets(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT pea_grants_level_valid CHECK (max_level >= 0 AND max_level <= 5)
);

CREATE INDEX IF NOT EXISTS pea_grants_active_idx ON pea.grants (expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS pea.replay_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id UUID REFERENCES pea.gaps(id) ON DELETE SET NULL,
  packet_id UUID REFERENCES pea.evolution_packets(id) ON DELETE SET NULL,
  mode VARCHAR(32) NOT NULL DEFAULT 'read_only',
  result JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ─── Budget ledger ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pea.budget_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id UUID REFERENCES pea.analysis_runs(id) ON DELETE SET NULL,
  gap_id UUID REFERENCES pea.gaps(id) ON DELETE SET NULL,
  entry_type VARCHAR(32) NOT NULL,
  amount_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  tokens INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pea_budget_ledger_type_valid CHECK (
    entry_type IN ('reserve', 'settle', 'refund', 'cap_block')
  )
);

CREATE INDEX IF NOT EXISTS pea_budget_ledger_day_idx ON pea.budget_ledger (created_at DESC);

-- ─── Outbox + durable jobs (ADR-004, ADR-011) ──────────────────────────────

CREATE TABLE IF NOT EXISTS pea.outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pea_outbox_unpublished_idx ON pea.outbox (created_at ASC)
  WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS pea.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(64) NOT NULL,
  gap_id UUID REFERENCES pea.gaps(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  input_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  output_json JSONB,
  error TEXT,
  attempts INT NOT NULL DEFAULT 0,
  run_after TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT pea_jobs_status_valid CHECK (
    status IN ('pending', 'running', 'completed', 'failed', 'dead')
  ),
  CONSTRAINT pea_jobs_type_valid CHECK (
    job_type IN ('analyze_gap', 'dispatch_outbox', 'worker_tick')
  )
);

CREATE INDEX IF NOT EXISTS pea_jobs_pending_idx ON pea.jobs (created_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS pea_jobs_gap_idx ON pea.jobs (gap_id, created_at DESC);

-- ─── Audit trail ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pea.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id VARCHAR(128),
  action VARCHAR(128) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pea_audit_events_created_idx ON pea.audit_events (created_at DESC);
