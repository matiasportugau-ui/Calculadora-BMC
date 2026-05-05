-- WA Cockpit — F-A1: tabla wa_operators (auth multi-operador).
--
-- Roles canónicos Missive: Owner (1 solo), Admin (configura), Member (opera).
-- Auth pattern Auth.js v5: magic link → access JWT 15min + refresh 30d con rotación.

create table if not exists wa_operators (
  operator_id text primary key,
  email text not null unique,
  name text,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  -- Magic link en curso (si hay) — sólo se usa una vez, después se invalida.
  magic_token_hash text,
  magic_token_expires_at timestamptz,
  -- Refresh token actual (si está logueado). Hash, no el plaintext.
  refresh_token_hash text,
  refresh_expires_at timestamptz,
  -- Para revocación instantánea de todos los JWT emitidos:
  -- el middleware compara JWT.iat > jwt_revoked_at.
  jwt_revoked_at timestamptz,
  -- Overrides de settings personalizados de este operador (jsonb por key).
  overrides jsonb not null default '{}'::jsonb,
  -- Business hours específicas (override de tenant default).
  business_hours jsonb,
  -- Audit trail
  created_at timestamptz not null default now(),
  invited_by text,
  last_login_at timestamptz,
  last_active_at timestamptz
);

create index if not exists wa_operators_email_idx on wa_operators (email);
create index if not exists wa_operators_status_idx on wa_operators (status);
create index if not exists wa_operators_last_active_idx on wa_operators (last_active_at desc nulls last);
