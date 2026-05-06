-- WA Cockpit — F-A1: tabla wa_flags (feature flags con kill-switch).
--
-- Best practice 2026 (designrevision, Sachith): cada flag tiene owner,
-- expires_at, descripción, y rollout_percent (0-100) para rollouts graduales.
-- Healthy SaaS: <30 flags activos por servicio, cleanup tras 30d en 100%.

create table if not exists wa_flags (
  key text primary key,
  enabled boolean not null default false,
  rollout_percent int not null default 100 check (rollout_percent between 0 and 100),
  owner text,
  expires_at timestamptz,
  description text,
  updated_at timestamptz not null default now(),
  updated_by text
);

create index if not exists wa_flags_enabled_idx on wa_flags (enabled);
create index if not exists wa_flags_expires_idx on wa_flags (expires_at) where expires_at is not null;

-- Reusa el mismo NOTIFY channel que wa_settings — el loader invalida
-- cache para flags y settings juntos.
create or replace function wa_flags_notify_trigger()
returns trigger as $$
begin
  perform pg_notify(
    'wa_config_changed',
    'flag:tenant:' || coalesce(new.key, old.key)
  );
  return coalesce(new, old);
end;
$$ language plpgsql;

drop trigger if exists wa_flags_notify on wa_flags;
create trigger wa_flags_notify
after insert or update or delete on wa_flags
for each row execute function wa_flags_notify_trigger();
