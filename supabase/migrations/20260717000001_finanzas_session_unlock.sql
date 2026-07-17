-- Finanzas module password gate: per-session unlock timestamp (12h TTL set by API).
alter table identity.sessions
  add column if not exists finanzas_unlocked_until timestamptz;
