-- PEA M4 — extend job types for implement + replay
ALTER TABLE pea.jobs DROP CONSTRAINT IF EXISTS pea_jobs_type_valid;
ALTER TABLE pea.jobs ADD CONSTRAINT pea_jobs_type_valid CHECK (
  job_type IN ('analyze_gap', 'dispatch_outbox', 'worker_tick', 'implement_gap', 'replay_gap')
);
