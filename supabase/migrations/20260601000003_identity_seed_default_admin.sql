-- ═══════════════════════════════════════════════════════════════════════════
-- identity — seed default admin (matias.portugau@gmail.com)
-- ───────────────────────────────────────────────────────────────────────────
-- Project: Calculadora-BMC
-- Purpose: ensure matias.portugau@gmail.com lands with admin + superadmin on
-- the first Google login, without ever consulting env vars at request time.
--
-- Privilege resolution at runtime is driven exclusively by identity.role_grants
-- (see server/lib/identityAuth.js _resolveTopRole / getModuleGrants). This
-- migration is the single source of truth for the default privileged user.
--
-- Idempotent — safe to re-run any time (uses `on conflict do nothing`).
--
-- Companion: 20260601000002_identity_seed_superadmins.sql (parameterized seed
-- via psql -v admins=...) remains for additional superadmins managed by ops.
-- ═══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

begin;

do $$
declare
  default_admin_email text := 'matias.portugau@gmail.com';
  uid                 uuid;
begin
  -- Pre-create the user row. email_verified stays false on purpose: the first
  -- /auth/google login will overwrite it once Google attests verification.
  -- google_sub remains null until that login binds the OAuth identity by email.
  insert into identity.users (email, email_verified, status)
  values (default_admin_email, false, 'active')
  on conflict (email) do update
    set status = 'active'
  returning user_id into uid;

  if uid is null then
    select user_id into uid from identity.users where email = default_admin_email;
  end if;

  if uid is null then
    raise exception '[seed_default_admin] could not resolve user_id for %', default_admin_email;
  end if;

  insert into identity.role_grants (user_id, role)
  values (uid, 'admin')
  on conflict (user_id, role) do nothing;

  insert into identity.role_grants (user_id, role)
  values (uid, 'superadmin')
  on conflict (user_id, role) do nothing;

  insert into identity.audit_log (actor_user_id, actor_kind, action, resource, resource_id, payload)
  values (
    uid,
    'system',
    'role_grant',
    'identity.role_grants',
    uid::text,
    jsonb_build_object(
      'roles', jsonb_build_array('admin', 'superadmin'),
      'source', 'migration_20260601000003_identity_seed_default_admin',
      'email', default_admin_email
    )
  );

  raise notice '[seed_default_admin] granted admin + superadmin to %', default_admin_email;
end $$;

commit;
