-- wa-package/migrations/017_bmc_quote_counter.sql
-- Global quote counter for BMC Uruguay — one row per calendar year.
-- Annual reset is implicit: new year → INSERT creates row at seq=1.
-- Atomic increment via INSERT ... ON CONFLICT ... RETURNING.

create table if not exists bmc_quote_counter (
  year        int          primary key,
  seq         int          not null default 0,
  updated_at  timestamptz  not null default now()
);

-- Seed current year at 0 so GET /counter returns 0 before any POST.
insert into bmc_quote_counter (year, seq)
values (extract(year from now())::int, 0)
on conflict (year) do nothing;
