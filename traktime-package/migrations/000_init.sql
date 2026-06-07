-- TraKtiMe — base extensions. Forward-only.
-- pgcrypto provides gen_random_uuid(); identity schema is already provisioned
-- by the identity/auth migrations (see server/lib/identityAuth.js). We do NOT
-- declare a cross-schema FK to identity.users (clunky), but tk_entries.user_id
-- conceptually references identity.users.user_id and is protected at the API
-- layer by requireUser().

create extension if not exists pgcrypto;
