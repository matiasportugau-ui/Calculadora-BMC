-- Contador de cotizaciones BC / Jenerik. Independiente de bmc_quote_counter.
-- Empieza en 0. BMC no lo lee ni lo incrementa.

create table if not exists bc_quote_counter (
  year        int          primary key,
  seq         int          not null default 0,
  updated_at  timestamptz  not null default now()
);
