-- Invoice line items — one row per (invoice, project) bucket. Stores the
-- rounded hours and rate used at issue time so future rate changes don't
-- retroactively rewrite history.
create table if not exists tk_invoice_lines (
  invoice_line_id  uuid primary key default gen_random_uuid(),
  invoice_id       uuid not null references tk_invoices(invoice_id) on delete cascade,
  project_id       uuid not null references tk_projects(project_id) on delete restrict,
  description      text not null,
  hours            numeric(8, 2) not null,
  hourly_rate_usd  numeric(10, 2) not null,
  amount_usd       numeric(12, 2) not null,
  created_at       timestamptz not null default now()
);

create index if not exists tk_invoice_lines_invoice_idx on tk_invoice_lines (invoice_id);

-- Wire the FK on tk_entries.invoice_line_id (column added in 006, table now exists).
alter table tk_entries
  drop constraint if exists tk_entries_invoice_line_id_fkey;
alter table tk_entries
  add constraint tk_entries_invoice_line_id_fkey
  foreign key (invoice_line_id) references tk_invoice_lines(invoice_line_id) on delete set null;
