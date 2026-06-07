-- TraKtiMe invoices. Issued invoices get a TRK-YYYY-NNNN number; drafts are
-- mutable until issued. status one of: draft | issued | paid | void.
create table if not exists tk_invoices (
  invoice_id    uuid primary key default gen_random_uuid(),
  client_id     uuid not null references tk_clients(client_id) on delete restrict,
  number        text unique,
  status        text not null default 'draft'
                  check (status in ('draft', 'issued', 'paid', 'void')),
  issue_date    date,
  due_date      date,
  period_from   timestamptz not null,
  period_to     timestamptz not null,
  subtotal_usd  numeric(12, 2) not null default 0,
  iva_rate      numeric(5, 4)  not null default 0.22,
  iva_usd       numeric(12, 2) not null default 0,
  total_usd     numeric(12, 2) not null default 0,
  notes         text,
  pdf_url       text,
  paid_at       timestamptz,
  voided_at     timestamptz,
  issued_by     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists tk_invoices_client_idx on tk_invoices (client_id);
create index if not exists tk_invoices_status_idx on tk_invoices (status);
create index if not exists tk_invoices_number_idx on tk_invoices (number);
