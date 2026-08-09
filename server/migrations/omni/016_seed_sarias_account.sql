-- 016_seed_sarias_account.sql
-- Seed the sixth BMC mailbox missed by 009's seed: sarias@bmcuruguay.com.uy.
-- Part of the NetUy → Cloudflare→Gmail-hub migration: all six
-- @bmcuruguay.com.uy boxes forward to the hub Gmail and are demultiplexed
-- by the ingest allowlist (GMAIL_INGEST_ADDRESSES).

INSERT INTO omni_email_accounts (email, label) VALUES
  ('sarias@bmcuruguay.com.uy', 'S. Arias BMC')
ON CONFLICT (email) DO NOTHING;

INSERT INTO omni_schema_migrations (name) VALUES ('016_seed_sarias_account.sql')
ON CONFLICT (name) DO NOTHING;
