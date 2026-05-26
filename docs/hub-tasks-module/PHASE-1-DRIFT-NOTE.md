# Phase 1 — Master Prompt Drift Note

**Date:** 2026-05-19
**Status: RESOLVED** — corrections applied inline to `PHASE-1-MASTER-PROMPT.md` on 2026-05-26.
**Scope:** Resolve contradictions between `PHASE-1-MASTER-PROMPT.md` and the rest of the canonical sources (code, migration, ADRs) so Phase 1 implementation aligns with reality.

## TL;DR

`PHASE-1-MASTER-PROMPT.md` contradicts `05-decisions.md`, the applied migration, and the existing route code on **two points**:

| Topic | `PHASE-1-MASTER-PROMPT.md` (stale) | Canonical (code + migration + ADR-01) |
|---|---|---|
| Token encryption | AES-256-GCM (application-layer), key `GOOGLE_TASKS_TOKEN_KEY` | `pgp_sym_encrypt` (PostgreSQL native, pgcrypto), key `ENCRYPTION_KEY` |
| OAuth tokens table | `identity.tasks_oauth_tokens` | `tasks.oauth_tokens` |
| OAuth state table | `identity.tasks_oauth_state` | `tasks.oauth_state` *(see migration)* |
| Sync conflicts table | `identity.sync_conflicts` | `tasks.sync_conflicts` |

Everything else in `PHASE-1-MASTER-PROMPT.md` is still accurate.

## Canonical source of truth (in order)

1. **Migration** — `supabase/migrations/20260602000001_tasks_init.sql`
   - Schema: `tasks.*` (not `identity.tasks_*`)
   - FK: `tasks.task_lists.user_id` → `identity.users(user_id)` (only the FK lives in `identity`, not the tables themselves)
   - Encryption column comment: `'pgp_sym_encrypt(token, encryption_key)'`
2. **ADR-01** — `docs/hub-tasks-module/05-decisions.md` §ADR-01 "OAuth Token Storage Strategy"
   - **CHOSEN: Option A — pgp_sym_encrypt (PostgreSQL native)**
   - Key name in production: `ENCRYPTION_KEY` (Secret Manager → Cloud Run env)
3. **Code** — `server/routes/tasks.js`, `server/routes/tasksOAuth.js`, `server/routes/tasksSync.js`, `server/lib/tasksDb.js`
   - Queries reference `tasks.task_lists` / `tasks.tasks`
   - Code comments and TODOs reference `pgp_sym_encrypt` / `pgp_sym_decrypt`

## Implementation guidance for Phase 1

When `PHASE-1-MASTER-PROMPT.md` and the canonical sources disagree, **the canonical sources win**. Concretely:

- Use `pgp_sym_encrypt(token, current_setting('app.tasks_key'))` (or parameterized variant) on INSERT, `pgp_sym_decrypt(col::bytea, key)` on SELECT — not Node `crypto.createCipheriv`.
- Read/write tokens against `tasks.oauth_tokens`, not `identity.tasks_oauth_tokens`.
- The env var is `ENCRYPTION_KEY` per ADR-01 §4, not `GOOGLE_TASKS_TOKEN_KEY`. If operator already provisioned `GOOGLE_TASKS_TOKEN_KEY`, treat it as an alias or rename before code reads it (do not silently accept both — that masks misconfiguration).

## What this note intentionally does NOT do

- Does **not** modify `PHASE-1-MASTER-PROMPT.md` directly. That file may have other downstream readers (operator runbooks, external context) and a unilateral rewrite would erase its history. Instead, this note documents the deviation and points readers at canon. A follow-up doc cleanup PR can rewrite the master prompt if/when desired.
- Does **not** alter the migration, ADRs, or route code. Reality is already correct; only the master prompt drifted.

## Read this before:

- Running `/goal` against `PHASE-1-MASTER-PROMPT.md`.
- Implementing token encryption in `server/routes/tasksOAuth.js`.
- Writing Phase 1 contract tests that touch the `tasks.oauth_tokens` table.

## Open follow-ups (not blocking Phase 1 implementation)

- [ ] Decide whether to rewrite `PHASE-1-MASTER-PROMPT.md` inline or leave this note as the canonical override.
- [ ] Confirm with operator which env var name (`ENCRYPTION_KEY` vs `GOOGLE_TASKS_TOKEN_KEY`) is provisioned in Cloud Run; align `.env.example` and `server/config.js` with the chosen name.
- [ ] Verify `tasks.oauth_state` table exists in the migration (file truncated in the audit that produced this note; line 80+ not yet read).
