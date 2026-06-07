-- TraKtiMe audit log. Append-only. Mirrored to Sheets via watermark on occurred_at.
create table if not exists tk_audit_log (
  audit_id    bigserial primary key,
  occurred_at timestamptz not null default now(),
  action      text not null,
  row_table   text,
  row_id      uuid,
  before      jsonb not null default '{}'::jsonb,
  after       jsonb not null default '{}'::jsonb,
  user_email  text,
  meta        jsonb not null default '{}'::jsonb
);

create index if not exists tk_audit_log_occurred_idx on tk_audit_log (occurred_at);
create index if not exists tk_audit_log_table_row_idx on tk_audit_log (row_table, row_id);
