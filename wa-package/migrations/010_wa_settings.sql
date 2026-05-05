-- WA Cockpit — F-A1: tabla wa_settings (runtime config persistente).
--
-- Single source of truth para runtime config del módulo WA.
-- Schema canónico (zod) en server/lib/waConfigSchema.js — esta tabla
-- guarda los overrides activos por scope.
--
-- Precedencia leída por server/lib/waConfig.js:
--   wa_settings (scope='operator', scope_id=<op>)  →  wa_settings (scope='tenant', scope_id='tenant')
--   →  process.env  →  default del schema.
--
-- Cada UPDATE/INSERT debe disparar NOTIFY 'wa_config_changed' para
-- invalidar el cache LRU del loader (LISTEN/NOTIFY pattern).

create table if not exists wa_settings (
  key text not null,
  scope text not null check (scope in ('tenant', 'operator')),
  scope_id text not null default 'tenant',
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (key, scope, scope_id)
);

create index if not exists wa_settings_scope_idx on wa_settings (scope, scope_id);
create index if not exists wa_settings_updated_at_idx on wa_settings (updated_at desc);

-- Trigger para emitir NOTIFY 'wa_config_changed' tras cualquier cambio.
-- Payload: '<scope>:<scope_id>:<key>'.
create or replace function wa_settings_notify_trigger()
returns trigger as $$
begin
  perform pg_notify(
    'wa_config_changed',
    coalesce(new.scope, old.scope) || ':' || coalesce(new.scope_id, old.scope_id) || ':' || coalesce(new.key, old.key)
  );
  return coalesce(new, old);
end;
$$ language plpgsql;

drop trigger if exists wa_settings_notify on wa_settings;
create trigger wa_settings_notify
after insert or update or delete on wa_settings
for each row execute function wa_settings_notify_trigger();
