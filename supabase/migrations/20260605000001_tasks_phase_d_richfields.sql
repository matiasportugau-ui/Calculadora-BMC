-- Migration: 20260605000001_tasks_phase_d_richfields.sql
-- Tareas Phase D — Rich Task Field Support
-- Date: 2026-06-05 (after 20260602000001_tasks_init.sql)
--
-- Adds the time/all-day/recurrence dimensions the Google Tasks creation UI
-- exposes. The Google Tasks REST API v1 only persists title/notes/due(date)/
-- status/parent — time-of-day and repeat in the Google UI are backed by a
-- paired Google Calendar event. BMC mirrors that: it stays system-of-record
-- for these fields (they live here in tasks.tasks), and additionally pushes a
-- Calendar event when due_time or recurrence_rule is set. calendar_event_id
-- links the two so the sync handler can reconcile drift.
--
-- Representation decisions (see Phase D spec Open Items):
--   * all-day task  → is_all_day = TRUE,  due_time = NULL
--   * timed task    → is_all_day = FALSE, due_time = 'HH:MM:SS'
--   * "Does not repeat" → recurrence_rule = NULL
--   * recurring     → recurrence_rule = iCal RRULE string ('RRULE:FREQ=WEEKLY')
--
-- Additive + nullable-safe: existing rows default to is_all_day=TRUE (matching
-- the prior date-only semantics) with NULL time/recurrence/event link, so no
-- backfill is required.

-- ── New columns on tasks.tasks ──────────────────────────────────────────────
ALTER TABLE tasks.tasks
  ADD COLUMN IF NOT EXISTS due_time TIME NULL,
  ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT NULL,
  ADD COLUMN IF NOT EXISTS calendar_event_id TEXT NULL;

COMMENT ON COLUMN tasks.tasks.due_time IS 'Time-of-day for the task (NULL when is_all_day); mirrored to the paired Calendar event start time';
COMMENT ON COLUMN tasks.tasks.is_all_day IS 'TRUE = date-only (Google Tasks default); FALSE = timed (due_time required)';
COMMENT ON COLUMN tasks.tasks.recurrence_rule IS 'iCal RRULE string (RFC 5545), e.g. RRULE:FREQ=WEEKLY;BYDAY=MO. NULL = does not repeat. Google expands instances at render time.';
COMMENT ON COLUMN tasks.tasks.calendar_event_id IS 'Google Calendar event id paired with this task; populated only when due_time/recurrence_rule set. NULL = no Calendar mirror.';

-- recurrence_rule must be NULL or a well-formed RRULE prefix.
-- Inline-named so the constraint is discoverable; guard the re-run since
-- ADD CONSTRAINT has no IF NOT EXISTS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_recurrence_rule_format_check'
      AND conrelid = 'tasks.tasks'::regclass
  ) THEN
    ALTER TABLE tasks.tasks
      ADD CONSTRAINT tasks_recurrence_rule_format_check
      CHECK (recurrence_rule IS NULL OR recurrence_rule LIKE 'RRULE:%');
  END IF;
END $$;

-- Partial unique index: one task ↔ one Calendar event, but many NULLs allowed.
-- Serves both the uniqueness guarantee and the sync-join lookup by event id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_calendar_event_id
  ON tasks.tasks(calendar_event_id)
  WHERE calendar_event_id IS NOT NULL;

-- ── Extend sync_conflicts.conflict_type with 'calendar_drift' ───────────────
-- 'calendar_drift' = BMC's time/recurrence diverged from the paired Calendar
-- event (e.g. the user edited the event directly in Google Calendar). Detected
-- on the inbound sync pull; BMC wins by default (no auto-resolver this phase).
ALTER TABLE tasks.sync_conflicts
  DROP CONSTRAINT IF EXISTS sync_conflicts_conflict_type_check;

ALTER TABLE tasks.sync_conflicts
  ADD CONSTRAINT sync_conflicts_conflict_type_check
  CHECK (conflict_type IN (
    'soft_delete_mismatch',
    'update_timestamp_mismatch',
    'concurrent_edit',
    'calendar_drift'
  ));
