-- WA Cockpit — F-A1: tabla wa_webhooks (webhooks salientes con HMAC).
--
-- Eventos disparables (consumidos por server/lib/waWebhooks.js):
--   message.in     — al insertar mensaje inbound
--   message.out    — al enviar mensaje outbound (cualquier kind)
--   quote.created  — al crear quote (manual o auto)
--   followup.due   — cuando waFollowupsWorker dispara un follow-up
--   sla.breach     — cuando waSlaWorker detecta breach
--   operator.invited
--
-- Firma: header `X-WA-Signature: sha256=<hex>` con HMAC del body usando `secret`.
-- Retry policy: por default 3 reintentos exponenciales (1s, 5s, 30s).
-- Dead letter: tras N fallos consecutivos, last_status = 'dead' y queda fuera
-- del scheduler hasta corrección manual.

create table if not exists wa_webhooks (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  url text not null,
  secret text not null,
  headers jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  retry_policy jsonb not null default '{"maxAttempts": 3, "delaysMs": [1000, 5000, 30000]}'::jsonb,
  last_status text,
  last_status_code int,
  last_error text,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  failure_count int not null default 0,
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now()
);

create index if not exists wa_webhooks_event_idx on wa_webhooks (event) where enabled = true;
create index if not exists wa_webhooks_status_idx on wa_webhooks (last_status, last_attempt_at desc nulls last);
