# TODO — Persist OAuth State (definitive fix for Gap #4)

> **DONE (2026-06-13, PR-2 / Gate 0 item 6).** State is in Postgres
> (`public.oauth_states`) and now **single-use**: `server/lib/oauthStateStore.js`
> gained an atomic `consume()` (`UPDATE … SET consumed_at WHERE consumed_at IS NULL
> AND expires_at > now() RETURNING payload`). The `public.oauth_states` table already
> existed (`supabase/migrations/20260607_add_oauth_states.sql`); this PR only added the
> `consumed_at` column (`20260613000001_oauth_states_single_use.sql`). ML
> (`server/index.js`) and Shopify (`server/routes/shopify.js`) both consume atomically;
> Shopify's in-memory `Map` was removed. Google Tasks already used its own
> `tasks.oauth_state` table with atomic delete (unchanged); Google login is the GIS
> popup flow with no `state` param. The store uses the direct `DATABASE_URL` pg pool
> (no PostgREST service role), so no RLS was added.

**Created:** 2026-04-30 (security-hardening-202604)
**Priority:** Medium — current patch (session affinity) is safe for single-region single-AZ deploys
**Roadmap target:** v1.4+ (after Supabase Auth ships in Fase 1)
**ADR reference:** `docs/adr/0001-source-of-truth-post-supabase.md` — row "OAuth state"

---

## Problem

OAuth PKCE state (`codeVerifier`, `state` nonce) and Shopify OAuth state are stored in
in-memory Maps with TTL:

| Location | Map | TTL |
|----------|-----|-----|
| `server/index.js` | `oauthStates` | ~10 min (pruned on lookup) |
| `server/routes/shopify.js` | `oauthStateStore` | 10 min (pruned on start) |

Cloud Run can scale to multiple instances or cold-start a new instance between
`/auth/*/start` and `/auth/*/callback`, causing the callback to land on an instance
that has no record of the original state → OAuth flow breaks with "Invalid or expired state".

**Current patch:** Cloud Run session affinity (`--session-affinity`) makes start+callback
land on the same instance. This works for low traffic but does not survive instance restarts
or deployments that cycle instances.

---

## Proposed solution

### Option A — Supabase `oauth_state` table (preferred, aligns with ADR 0001)

```sql
create table oauth_state (
  id          text primary key,           -- the state nonce
  provider    text not null,              -- 'ml' | 'shopify'
  shop        text,                       -- shopify only
  code_verifier text not null,
  nonce       text,                       -- shopify only
  created_at  timestamptz default now(),
  expires_at  timestamptz not null        -- now() + interval '10 minutes'
);

-- TTL cleanup (run via pg_cron or a startup job)
delete from oauth_state where expires_at < now();

-- Index for fast lookup + cleanup
create index on oauth_state (expires_at);
```

**Code changes:**
- `server/index.js`: Replace `oauthStates.set/get/delete` with Supabase insert/select/delete
- `server/routes/shopify.js`: Same for `oauthStateStore`
- Add `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to config (already in v1.3 plan)
- `pruneStateStore()` in shopify.js → scheduled job or lazy cleanup on insert

**Cutover criterion:** when Cloud Run scales beyond 1 instance or when Supabase Fase 1 ships.

### Option B — Google Cloud Memorystore (Redis)

Simpler code swap (Redis `SET state ... EX 600`), but adds a VPC connector + Memorystore cost.
Suitable if Supabase is not yet available.

---

## Implementation checklist

- [ ] Create Supabase migration: `supabase/migrations/YYYYMMDDHHMMSS_oauth_state.sql`
- [ ] Update `server/index.js` `oauthStates` Map → Supabase client calls
- [ ] Update `server/routes/shopify.js` `oauthStateStore` Map → Supabase client calls
- [ ] Add `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to `server/config.js`
- [ ] Add both vars to `scripts/provision-secrets.sh` HIGH_SENS_KEYS
- [ ] Add `run_ml_cloud_run_setup.sh` `--update-secrets` entries for both vars
- [ ] Remove `--session-affinity` from Cloud Run once this ships (or keep it — it's harmless)
- [ ] Add test: simulate state stored on "instance A", callback on "instance B" via two separate process imports

---

## Related docs

- `docs/adr/0001-source-of-truth-post-supabase.md` — ADR row "OAuth state"
- `docs/procedimientos/OAUTH-CHECKLIST.md` — Gap #4 entry
- `docs/team/SECURITY-HARDENING-REPORT-202604.md` — context
