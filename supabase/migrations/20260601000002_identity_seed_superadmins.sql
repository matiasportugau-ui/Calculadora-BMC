-- ═══════════════════════════════════════════════════════════════════════════
-- identity — seed superadmin role for internal operator emails
-- ───────────────────────────────────────────────────────────────────────────
-- Reads a comma-separated email list from psql variable :'admins' and
-- pre-creates `identity.users` rows + grants `superadmin` role so the listed
-- people land with full access on their first Google login.
--
-- Idempotent — safe to re-run any time (uses `on conflict do nothing`).
--
-- Usage (paste in shell):
--   ADMINS='alice@bmc.uy,bob@bmc.uy'
--   psql "$DATABASE_URL" -v admins="$ADMINS" \
--     -f supabase/migrations/20260601000002_identity_seed_superadmins.sql
--
-- Fallback when -v admins is omitted: the env var INTERNAL_SUPERADMIN_EMAILS
-- (server reads it for legacy code paths) — but psql does NOT auto-substitute
-- env vars, so missing -v leaves us with the empty default below. Pass -v.
-- ═══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

-- Default empty so the migration is harmless when run without -v admins.
-- (The script will report 0 rows and exit cleanly.)
\if :{?admins}
\else
  \set admins ''
\endif

do $$
declare
  raw_list text := :'admins';
  emails   text[];
  e        text;
  uid      uuid;
  granted  int := 0;
begin
  if raw_list is null or btrim(raw_list) = '' then
    raise notice '[seed_superadmins] no admins provided (-v admins=...). Skipping.';
    return;
  end if;

  emails := array(
    select btrim(lower(x))
      from regexp_split_to_table(raw_list, '\s*,\s*') as x
     where btrim(x) <> ''
  );

  raise notice '[seed_superadmins] processing % email(s)', array_length(emails, 1);

  foreach e in array emails
  loop
    -- Pre-create the user row (no google_sub yet — first /auth/google login
    -- merges by email and stamps it).
    insert into identity.users (email, email_verified, status)
    values (e, false, 'active')
    on conflict (email) do nothing
    returning user_id into uid;

    if uid is null then
      select user_id into uid from identity.users where email = e;
    end if;

    if uid is not null then
      insert into identity.role_grants (user_id, role)
      values (uid, 'superadmin')
      on conflict (user_id, role) do nothing;
      granted := granted + 1;
    else
      raise warning '[seed_superadmins] could not resolve user_id for %', e;
    end if;
  end loop;

  raise notice '[seed_superadmins] granted superadmin to % user(s)', granted;
end $$;
