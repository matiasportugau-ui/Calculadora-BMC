-- Per-year invoice number generator. UPSERT on (year) yields the next seq.
-- Format: TRK-YYYY-NNNN (e.g. TRK-2026-0001).
create table if not exists tk_invoice_seq (
  year       integer primary key,
  last_seq   integer not null default 0,
  updated_at timestamptz not null default now()
);
