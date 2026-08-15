-- Paid white-label MVP (additive). Do NOT re-run identity_init.
-- plan_tier: base | plus | paid
-- users.branding jsonb; quotes.bmc_snapshot written once on complete.

alter table identity.users
  drop constraint if exists users_plan_tier_check;

alter table identity.users
  add constraint users_plan_tier_check
  check (plan_tier in ('base', 'plus', 'paid'));

alter table identity.users
  add column if not exists branding jsonb not null default '{}'::jsonb;

alter table identity.quotes
  add column if not exists bmc_snapshot jsonb;

alter table identity.quotes
  add column if not exists bmc_snapshot_at timestamptz;

comment on column identity.users.branding is
  'White-label header: {display_name, logo_gcs_uri, logo_data_url, logo_content_type, updated_at}';

comment on column identity.quotes.bmc_snapshot is
  'Immutable server-priced freeze; written once on first completed.';
