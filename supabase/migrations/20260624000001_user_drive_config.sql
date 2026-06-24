-- ═══════════════════════════════════════════════════════════════════════════
-- identity.user_drive_config — per-user Google Drive destination folder
-- ───────────────────────────────────────────────────────────────────────────
-- Project: Calculadora-BMC (htnwozvopveibwppyjhg)
-- Purpose: each internal user (Matias, Sandra, Ramiro, Martín) configures, once,
-- the Google Drive folder where their quotations auto-save. Selection is done
-- client-side via Google Picker (drive.file scope) and validated for write
-- permission with the user's own OAuth token; only the resulting
-- { folderId, folderName } is persisted here. See SPEC §8.
--
-- Companion: docs/team/PROJECT-STATE.md (Cambios recientes)
--
-- Lives under the `identity` schema alongside the rest of the user identity /
-- RBAC tables. Depends on identity.users + identity.touch_updated_at() from
-- 20260601000001_identity_init.sql.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists identity.user_drive_config (
  user_id           uuid primary key references identity.users(user_id) on delete cascade,
  email             citext not null,
  folder_id         text,
  folder_name       text,
  configured_at     timestamptz,
  last_validated_at timestamptz,
  valid             boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists user_drive_config_email_idx on identity.user_drive_config(email);

drop trigger if exists user_drive_config_touch on identity.user_drive_config;
create trigger user_drive_config_touch before update on identity.user_drive_config
  for each row execute function identity.touch_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- Row Level Security — same posture as the rest of the identity schema:
-- service_role full access; clients reach this table only via the REST API
-- (identityAuth.requireUser), never directly.
-- ───────────────────────────────────────────────────────────────────────────
alter table identity.user_drive_config enable row level security;
drop policy if exists "service_role_all_user_drive_config" on identity.user_drive_config;
create policy "service_role_all_user_drive_config" on identity.user_drive_config
  for all to service_role using (true) with check (true);
