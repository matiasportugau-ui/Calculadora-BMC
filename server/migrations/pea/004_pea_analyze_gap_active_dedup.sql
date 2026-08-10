-- PEA Bug CF — at most one active analyze_gap job per gap.
-- Prevents unbounded enqueue from PEA_AUTO_DIAGNOSE threshold hits and
-- double-submit / spam on POST /api/pea/gaps/:gapId/diagnose (budget burn +
-- concurrent investigating/packet UPSERT races).
--
-- Active = pending | running | failed (failed is still claimable for retry).
-- Completed/dead jobs are outside the index so a later diagnose can re-enqueue.

CREATE UNIQUE INDEX IF NOT EXISTS pea_jobs_analyze_gap_active_dedup
  ON pea.jobs (gap_id)
  WHERE job_type = 'analyze_gap'
    AND status IN ('pending', 'running', 'failed');
