-- WA Cockpit — F4: consent fields para Cloud API outbound (compliance Meta)

alter table wa_conversations
  add column if not exists consent_at timestamptz,
  add column if not exists consent_source text;

create index if not exists wa_conversations_consent_idx on wa_conversations (consent_at) where consent_at is not null;
