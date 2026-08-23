-- WA Cockpit — Coexistence onboarding (Embedded Signup / Facebook Login for Business).
--
-- Un número conectado por self-service desde /hub/wa queda aquí: metadata queryable
-- + el access token de negocio CIFRADO (AES-256-GCM, TOKEN_ENCRYPTION_KEY — mismo
-- esquema que server/tokenStore.js / server/lib/secretBox.js). El token NUNCA se
-- devuelve por las rutas de listado; solo lo lee el resolver de salida
-- (server/lib/wa/waCredentials.js), con fallback a WHATSAPP_ACCESS_TOKEN del env.
--
-- Escrito/leído por server/lib/wa/waConnectionStore.js. Se aplica con `npm run wa:migrate`.

create table if not exists wa_connections (
  phone_number_id      text primary key,
  waba_id              text,
  display_phone_number text,
  verified_name        text,
  quality_rating       text,
  access_token_enc     text,               -- envelope JSON de secretBox (cifrado)
  status               text not null default 'active' check (status in ('active', 'inactive')),
  subscribed           boolean not null default false,
  connected_by         text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- El resolver de salida busca la conexión activa (una primaria por defecto).
create index if not exists wa_connections_active_idx
  on wa_connections (status, updated_at desc)
  where status = 'active';
