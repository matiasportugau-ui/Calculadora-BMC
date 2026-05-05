-- ═══════════════════════════════════════════════════════════════════════════
-- identity — seed superadmin role for internal operator emails
-- ───────────────────────────────────────────────────────────────────────────
-- Reads INTERNAL_SUPERADMIN_EMAILS at deploy time and grants role='superadmin'
-- to those emails on first login. Idempotent — safe to re-run.
--
-- This migration only PRE-CREATES placeholder users for the listed emails so
-- that the role grant exists BEFORE the user logs in for the first time.
-- The first /auth/google call upserts the row (matched by email) and the
-- existing role_grants stay attached.
--
-- To customize the email list before applying:
--   psql -v admins='alice@bmc.uy,bob@bmc.uy' -f this-file.sql
-- Otherwise the placeholder list below is used (edit before applying).
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  emails text[] := array[
    -- Replace with real internal admin emails before applying:
    'matias@bmc.uy'
  ];
  e text;
  uid uuid;
begin
  foreach e in array emails
  loop
    insert into identity.users (email, email_verified, status)
    values (e, false, 'active')
    on conflict (email) do nothing
    returning user_id into uid;

    if uid is null then
      select user_id into uid from identity.users where email = e;
    end if;

    if uid is not null then
      insert into identity.role_grants (user_id, role) values (uid, 'superadmin')
      on conflict (user_id, role) do nothing;
    end if;
  end loop;
end $$;
