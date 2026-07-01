-- 012_frt_breaches.sql — historical/audit trail of first-response-time SLA breaches.
--
-- GET /omni/actions/urgent (Wave 1) already computes SLA breach in real time per
-- request via scoreConversationUrgency() (server/lib/omni/urgency.js) — operators
-- see "act now" live with no dependency on this table. What's missing is a
-- *persisted timeline*: when did a conversation cross its SLA, when was it
-- resolved, so the cockpit can later report trends (breach count/week, average
-- breach duration) instead of only a live snapshot.
--
-- Populated by the optional omniFrtWorkerEnabled worker (default OFF) — this
-- migration only creates the table; nothing reads/writes it until the flag is on.
--
-- Idempotent. Apply with: npm run omni:migrate (server/migrations/omni/*.sql).

CREATE TABLE IF NOT EXISTS omni_frt_breaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES omni_conversations(id) ON DELETE CASCADE,
  channel VARCHAR(50),
  sla_target_hours NUMERIC(6, 2) NOT NULL,
  breach_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One open (unresolved) breach per conversation at a time — the worker checks
-- this before inserting, but the partial unique index makes it safe under
-- concurrent ticks (multi-instance Cloud Run) too.
CREATE UNIQUE INDEX IF NOT EXISTS omni_frt_breaches_open_unique
  ON omni_frt_breaches (conversation_id) WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS omni_frt_breaches_conversation_idx
  ON omni_frt_breaches (conversation_id);
CREATE INDEX IF NOT EXISTS omni_frt_breaches_breach_at_idx
  ON omni_frt_breaches (breach_at);
