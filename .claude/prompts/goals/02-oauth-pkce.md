# Goal 02 — Implement OAuth PKCE Flow for Google Tasks

## Objective
Replace Phase 0 stubs in `server/routes/tasksOAuth.js` with working OAuth 2.0 PKCE flow against Google Tasks API. Users can connect their Google account and obtain encrypted tokens stored in `tasks.oauth_tokens`.

## Prerequisites
- Goal 01 complete (canon docs fixed).
- `supabase/migrations/20260602000001_tasks_init.sql` applied (tables `tasks.oauth_tokens`, `tasks.oauth_state` exist).
- Env vars in `.env`: `GOOGLE_TASKS_CLIENT_ID`, `GOOGLE_TASKS_CLIENT_SECRET`, `ENCRYPTION_KEY`.

## Files to modify
- `server/routes/tasksOAuth.js` — replace 3 stub endpoints with real implementation
- `server/config.js` — add `googleTasksClientId`, `googleTasksClientSecret`, `tasksEncryptionKey` from env
- `.env.example` — add `GOOGLE_TASKS_CLIENT_ID=`, `GOOGLE_TASKS_CLIENT_SECRET=`, `ENCRYPTION_KEY=`

## Files to create
- `server/lib/tasksTokenCrypto.js` — `encryptToken(plaintext, key)` and `decryptToken(ciphertext, key)` using `pgp_sym_encrypt`/`pgp_sym_decrypt` via parameterized SQL (not app-layer crypto)

## Implementation spec

### GET /auth/tasks/init
1. Require authenticated user (`requireUser` middleware — already imported).
2. Generate PKCE verifier: `crypto.randomBytes(32).toString('base64url')`.
3. Compute challenge: `crypto.createHash('sha256').update(verifier).digest('base64url')`.
4. Generate state nonce: `crypto.randomBytes(16).toString('hex')`.
5. Store in DB: `INSERT INTO tasks.oauth_state (user_id, state_nonce, code_verifier, expires_at) VALUES ($1, $2, $3, now() + interval '10 minutes')`.
6. Build Google OAuth URL: `https://accounts.google.com/o/oauth2/v2/auth` with params: `client_id`, `redirect_uri=/auth/tasks/callback`, `response_type=code`, `scope=https://www.googleapis.com/auth/tasks`, `state`, `code_challenge`, `code_challenge_method=S256`, `access_type=offline`, `prompt=consent`.
7. `res.redirect(302, authUrl)`.

### GET /auth/tasks/callback?code=X&state=Y
1. If `error` param exists, return 400.
2. Lookup state: `SELECT * FROM tasks.oauth_state WHERE state_nonce = $1 AND expires_at > now()`.
3. If not found, return 400 `invalid_state`.
4. DELETE the used state row (single-use).
5. POST to `https://oauth2.googleapis.com/token` with: `code`, `client_id`, `client_secret`, `redirect_uri`, `grant_type=authorization_code`, `code_verifier` from DB.
6. Extract `access_token`, `refresh_token`, `expires_in`.
7. Store encrypted: `INSERT INTO tasks.oauth_tokens (user_id, access_token_encrypted, refresh_token_encrypted, expires_at, scope) VALUES ($1, pgp_sym_encrypt($2, $3), pgp_sym_encrypt($4, $3), now() + interval '..seconds', $5) ON CONFLICT (user_id) DO UPDATE SET ...`.
8. Log sync event: `INSERT INTO tasks.sync_log (user_id, event_type) VALUES ($1, 'token_acquired')`.
9. Redirect to frontend: `res.redirect('/hub/tareas?auth=success')`.

### POST /auth/tasks/revoke (requireUser)
1. Query `tasks.oauth_tokens WHERE user_id = $1 AND revoked_at IS NULL`.
2. If not found, return 404.
3. Decrypt access_token, POST to `https://oauth2.googleapis.com/revoke?token=<access_token>`.
4. Mark: `UPDATE tasks.oauth_tokens SET revoked_at = now() WHERE user_id = $1`.
5. Log: `INSERT INTO tasks.sync_log (user_id, event_type) VALUES ($1, 'token_revoked')`.
6. Return `{ ok: true }`.

## Security rules
- Never log tokens, codes, or verifiers. Use `req.log.info({ userId }, 'msg')` only.
- Encryption key comes from `config.tasksEncryptionKey` (never hardcoded).
- State nonces are single-use (DELETE after lookup).
- PKCE verifier stored server-side only (never sent to frontend).

## Verification
```bash
npm run lint -- server/routes/tasksOAuth.js server/lib/tasksTokenCrypto.js
npm run gate:local
```

## Exit
```bash
git add server/routes/tasksOAuth.js server/lib/tasksTokenCrypto.js server/config.js .env.example
git commit -m "feat(tasks-oauth): implement PKCE flow endpoints"
git push -u origin HEAD
```
