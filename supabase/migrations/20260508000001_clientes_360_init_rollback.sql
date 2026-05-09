-- ═══════════════════════════════════════════════════════════════════════════
-- 20260508000001_clientes_360_init_rollback.sql — emergency rollback
-- ───────────────────────────────────────────────────────────────────────────
-- Run ONLY when the kill switch fires (sec 9 of docs/clientes-360/MVP-1-PANTALLA.md).
-- After 30 days post-deploy with the primary metric stuck at 0 cotizaciones
-- rescatadas and the secondary metric below 30%, this script removes the
-- entire `clientes` schema. identity.* is untouched (no schema changes
-- applied there — only FKs *into* identity were created by the init).
--
-- PRE-FLIGHT (defensive — preserve human-curated audit log):
--   The followups table is the only one with operator-curated data
--   ("Sandra marked these as contactados"). Even if the experiment failed,
--   that data is useful business intelligence. Export to CSV first.
--
-- USAGE:
--   1. Connect to the Postgres instance with sufficient privileges.
--   2. Run section 1 ("export") and verify the CSV landed.
--   3. Run section 2 ("drop") to wipe the schema.
--
-- Section 1 uses psql's \copy meta-command — works only via psql client,
-- not via supabase MCP apply_migration. For MCP path, see Section 1' below.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Section 1 (psql client only): export curated followups to CSV ────────
\copy (
  select id, customer_id, due_date, reason, detail, tags, status,
         assigned_to_user_id, created_at, completed_at
    from clientes.customer_followups
   where status in ('done', 'dismissed')
   order by completed_at desc nulls last
) to '/tmp/clientes_followups_dropped.csv' with (format csv, header true);

-- ─── Section 1' (Supabase MCP / SQL editor alternative): in-DB backup ────
-- If you can't write to disk (e.g. running this through Supabase Studio),
-- copy the curated rows to a backup schema before dropping. Outlives the
-- DROP SCHEMA cascade because it lives in `archive`, not `clientes`.
--
-- create schema if not exists archive;
-- create table if not exists archive.clientes_followups_2026_06 as
--   select * from clientes.customer_followups
--    where status in ('done', 'dismissed');

-- ─── Section 2: destroy the experiment ────────────────────────────────────
-- CASCADE drops: 11 tables + 3 partitions of customer_events + indexes +
-- triggers + the touch_updated_at function. uuid-ossp / pgcrypto extensions
-- stay (other schemas use them).
drop schema if exists clientes cascade;

-- ═══════════════════════════════════════════════════════════════════════════
-- Post-rollback checklist (manual, outside this SQL):
--   [ ] Revert grants in identity.role_grants where module='clientes'
--   [ ] Remove src/modules/clientes/ from frontend (if shipped)
--   [ ] Remove server/routes/clientes/ if shipped
--   [ ] Update PROJECT-STATE.md noting kill switch fired and outcome
--   [ ] Archive the CSV from Section 1 to permanent storage
--   [ ] Document lessons learned in docs/clientes-360/POSTMORTEM.md
-- ═══════════════════════════════════════════════════════════════════════════
