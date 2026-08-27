/**
 * Idempotent transportista DDL. Same CREATE TABLE IF NOT EXISTS style as
 * customer-track ensure. Called from Torre live/health before SELECT.
 */

export const TRANSPORTISTA_TABLES = Object.freeze([
  "trips",
  "trip_events",
  "driver_sessions",
  "outbox_notifications",
  "customer_track_tokens",
  "chofer_roster",
  "chofer_sessions",
]);

export const ENSURE_TRANSPORTISTA_STATEMENTS = Object.freeze([
  `create extension if not exists pgcrypto`,
  `create table if not exists trips (
    trip_id uuid primary key default gen_random_uuid(),
    status text not null default 'draft',
    plan_snapshot jsonb not null default '{}'::jsonb,
    assigned_driver_id uuid null,
    assigned_phone_e164 text null,
    confirmed_at timestamptz null,
    closed_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create index if not exists trips_status_idx on trips (status)`,
  `create table if not exists trip_events (
    event_id uuid primary key default gen_random_uuid(),
    trip_id uuid not null references trips (trip_id) on delete cascade,
    stop_id uuid null,
    event_type text not null,
    actor_type text not null,
    actor_id uuid null,
    idempotency_key text not null,
    at_client_ms bigint null,
    at_server timestamptz not null default now(),
    geo_lat double precision null,
    geo_lng double precision null,
    payload jsonb not null default '{}'::jsonb
  )`,
  `create unique index if not exists trip_events_trip_id_idem_uq
    on trip_events (trip_id, idempotency_key)`,
  `create index if not exists trip_events_trip_id_server_time_idx
    on trip_events (trip_id, at_server desc)`,
  `create table if not exists driver_sessions (
    session_id uuid primary key default gen_random_uuid(),
    trip_id uuid not null references trips (trip_id) on delete cascade,
    driver_id uuid not null,
    token_hash text not null,
    expires_at timestamptz not null,
    revoked_at timestamptz null,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists driver_sessions_trip_driver_idx
    on driver_sessions (trip_id, driver_id)`,
  `create index if not exists driver_sessions_token_hash_idx
    on driver_sessions (token_hash)`,
  `create table if not exists outbox_notifications (
    notification_id uuid primary key default gen_random_uuid(),
    trip_id uuid not null references trips (trip_id) on delete cascade,
    driver_id uuid not null,
    channel text not null,
    to_e164 text not null,
    payload jsonb not null,
    status text not null default 'pending',
    attempt_count int not null default 0,
    next_attempt_at timestamptz not null default now(),
    last_error_code text null,
    last_error jsonb null,
    created_at timestamptz not null default now(),
    sent_at timestamptz null
  )`,
  `create index if not exists outbox_notifications_pending_idx
    on outbox_notifications (status, next_attempt_at)`,
  `create table if not exists customer_track_tokens (
    token_id uuid primary key default gen_random_uuid(),
    token_hash text not null unique,
    trip_id uuid null references trips (trip_id) on delete set null,
    stop_id uuid null,
    quote_ref text null,
    public_snapshot jsonb not null default '{}'::jsonb,
    expires_at timestamptz not null,
    revoked_at timestamptz null,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists customer_track_tokens_hash_idx
    on customer_track_tokens (token_hash)`,
  `create index if not exists customer_track_tokens_trip_idx
    on customer_track_tokens (trip_id)`,
  `create index if not exists customer_track_tokens_quote_idx
    on customer_track_tokens (quote_ref)`,
  `create table if not exists chofer_roster (
    chofer_id uuid primary key default gen_random_uuid(),
    name text,
    email text,
    phone_e164 text,
    password_hash text not null,
    status text not null default 'active',
    created_at timestamptz not null default now(),
    last_seen_at timestamptz null
  )`,
  `create unique index if not exists chofer_roster_email_uq
    on chofer_roster (lower(email)) where email is not null`,
  `create unique index if not exists chofer_roster_phone_uq
    on chofer_roster (phone_e164) where phone_e164 is not null`,
  `create table if not exists chofer_sessions (
    session_id uuid primary key default gen_random_uuid(),
    chofer_id uuid not null references chofer_roster (chofer_id) on delete cascade,
    token_hash text not null,
    expires_at timestamptz not null,
    revoked_at timestamptz null,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists chofer_sessions_token_hash_idx
    on chofer_sessions (token_hash)`,
]);

/**
 * @param {{ query: Function }} pool
 */
export async function ensureTransportistaSchema(pool) {
  if (!pool?.query) throw new Error("no_pool");
  for (const sql of ENSURE_TRANSPORTISTA_STATEMENTS) {
    try {
      await pool.query(sql);
    } catch (err) {
      const msg = String(err?.message || err);
      if (/extension/i.test(sql) && /permission|must be owner|already exists/i.test(msg)) {
        continue;
      }
      throw err;
    }
  }
  return { ok: true, tables: TRANSPORTISTA_TABLES };
}
