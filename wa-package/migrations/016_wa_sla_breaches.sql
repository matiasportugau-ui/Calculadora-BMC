-- WA Cockpit — F-A1: tabla wa_sla_breaches (SLA tracking automático).
--
-- Poblada por server/lib/waSlaWorker.js cada N segundos (sla.workerIntervalMs).
-- Dos kinds canónicos:
--   'unreplied'   — chat con last_msg_in_at más viejo que sla.unrepliedAlertHours
--                   (descontando business hours fuera de horario)
--   'unassigned'  — chat sin owner_op más viejo que sla.unassignedAlertHours
--
-- Cuando el operador responde / asigna, el worker mismo marca resolved_at.

create table if not exists wa_sla_breaches (
  id bigserial primary key,
  chat_id text not null,
  kind text not null check (kind in ('unreplied', 'unassigned')),
  breached_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text,
  -- Métricas para reporte:
  age_hours numeric,        -- horas (efectivas) de breach al detectarlo
  breach_action text,       -- "notify" | "reassign" | "webhook" — lo que se ejecutó
  meta jsonb not null default '{}'::jsonb
);

-- Un breach activo (resolved_at = null) por chat_id + kind. El worker hace
-- INSERT ON CONFLICT DO NOTHING usando este index parcial.
create unique index if not exists wa_sla_breaches_active_uniq
  on wa_sla_breaches (chat_id, kind)
  where resolved_at is null;

create index if not exists wa_sla_breaches_breached_idx on wa_sla_breaches (breached_at desc);
create index if not exists wa_sla_breaches_unresolved_idx on wa_sla_breaches (kind) where resolved_at is null;
