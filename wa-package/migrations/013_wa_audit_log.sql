-- WA Cockpit — F-A1: tabla wa_audit_log (compliance + debugging).
--
-- Cada cambio de settings, outbound enviado, decisión AI elegida, login,
-- y revocación se loguea aquí con before/after para auditoría.

create table if not exists wa_audit_log (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  operator_id text,
  -- Acciones registradas (extensible):
  --   'setting.update', 'flag.toggle', 'operator.invite', 'operator.role_change',
  --   'operator.revoke', 'auth.login', 'auth.refresh', 'auth.logout',
  --   'outbound.send', 'suggestion.choose', 'rule.create', 'rule.update',
  --   'rule.delete', 'webhook.create', 'webhook.delete', 'config.export',
  --   'config.import'.
  action text not null,
  target text,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists wa_audit_occurred_idx on wa_audit_log (occurred_at desc);
create index if not exists wa_audit_operator_idx on wa_audit_log (operator_id, occurred_at desc);
create index if not exists wa_audit_action_idx on wa_audit_log (action, occurred_at desc);
