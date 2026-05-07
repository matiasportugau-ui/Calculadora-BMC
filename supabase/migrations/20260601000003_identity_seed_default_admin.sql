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
-- Idempotent — safe to re-run any time:
--   - users insert uses `do nothing` so a subsequent run NEVER reactivates an
--     account that ops intentionally moved to status='suspended' or 'deleted'
--     (verifyGoogleAndUpsert blocks non-active users, so silent reactivation
--     would be a privilege-escalation hazard);
--   - role_grants inserts use `do nothing` on (user_id, role);
--   - audit_log insert is gated on at least one new grant being created, so
--     replays don't spam the audit trail with synthetic events.
--
-- No explicit BEGIN/COMMIT: the Supabase migration runner already wraps each
-- file in a transaction, matching the pattern used by 20260601000002.
--
-- Companion: 20260601000002_identity_seed_superadmins.sql (parameterized seed
-- via psql -v admins=...) remains for additional superadmins managed by ops.
-- ═══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

do $$
declare
  default_admin_email text := 'matias.portugau@gmail.com';
  uid                 uuid;
  granted_count       int := 0;
  rc                  int;
begin
  -- Pre-create the user row. email_verified stays false on purpose: the first
  -- /auth/google login overwrites it once Google attests verification, and
  -- google_sub remains null until that login binds the OAuth identity by email.
  -- DO NOTHING on conflict so a re-run never overrides a later status change.
  insert into identity.users (email, email_verified, status)
  values (default_admin_email, false, 'active')
  on conflict (email) do nothing
  returning user_id into uid;

  -- On conflict, RETURNING produces no row; fetch the existing user_id.
  if uid is null then
    select user_id into uid from identity.users where email = default_admin_email;
  end if;

  if uid is null then
    raise exception '[seed_default_admin] could not resolve user_id for %', default_admin_email;
  end if;

  insert into identity.role_grants (user_id, role)
  values (uid, 'admin')
  on conflict (user_id, role) do nothing;
  get diagnostics rc = row_count;
  granted_count := granted_count + rc;

  insert into identity.role_grants (user_id, role)
  values (uid, 'superadmin')
  on conflict (user_id, role) do nothing;
  get diagnostics rc = row_count;
  granted_count := granted_count + rc;

  -- Audit only when at least one new grant landed. Keeps the audit trail
  -- aligned with actual privilege changes across replays.
  if granted_count > 0 then
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
        'email', default_admin_email,
        'granted_count', granted_count
      )
    );
  end if;

  raise notice '[seed_default_admin] % — % new grant(s) this run',
               default_admin_email, granted_count;
end $$;
