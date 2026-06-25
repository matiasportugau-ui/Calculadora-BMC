# MercadoLibre Credentials & Connection — Playbook

> **One-stop reference for why the ML connection keeps "falling" and how to fix it.**
> If `/ml/*` returns 500, `/auth/ml/status` returns 404/503, or AI/CRM ML features go dark — start here.
> Last verified: 2026-06-24. Owner: Matias. Account: **BMC URUGUAY · seller_id `179969104`**.

---

## TL;DR — the 30-second mental model

There are **two tokens**, with **two lifespans** and **two completely different failure modes**:

| Token | Lifespan | Renewal | When it breaks |
|---|---|---|---|
| **access_token** | **6 hours** | Auto-refreshed silently 60s before expiry | You never notice — unless refresh itself fails |
| **refresh_token** | **~6 months, SINGLE-USE** | Manual: human re-authorizes in a browser | Everything goes dark; **no auto-recovery** |

**The system tells you "hasTokens: true" even when the token is dead.** `/health` and `/auth/ml/status`
only check that a token *exists* — not that it's valid or refreshable. Trust the **decision tree below**, not the health flag.

**Your most common real cause:** `ML_CLIENT_SECRET` is out of sync between `.env` → Cloud Run → the ML
Developers portal. When they disagree, refresh fails with `400 invalid_client` and only a re-sync + re-auth fixes it.

---

## The three failure modes (this is what "it fell again" actually is)

### 🔴 Mode A — `400 invalid_client` (wrong/stale client secret) — **MOST COMMON**
- **Symptom:** `/ml/*` returns 500; logs show `MercadoLibre OAuth token request failed` with payload `{"error":"invalid_client"}`.
- **Cause:** `ML_CLIENT_SECRET` on Cloud Run ≠ the current Secret Key in the [ML Developers portal](https://developers.mercadolibre.com.uy). ML rotates/invalidates secrets; or a deploy shipped a stale value.
- **Fix:** Re-sync the secret (Step 2 below), then **re-authorize** (Step 3).

### 🔴 Mode B — `400 invalid_grant` (refresh token dead/used) — **the "token dormido" problem**
- **Symptom:** `/auth/ml/status` shows an `expiresAt` in the past; refresh returns `invalid_grant`.
- **Cause:** The refresh_token is **single-use**. If it was already consumed, expired (6 mo), or lost on a cold start *before* the tokens were persisted to GCS — it can never be reused.
- **Fix:** **Re-authorize** (Step 3). This is unavoidable — there is no programmatic recovery. (Tracked: gh#419 — auto re-auth fallback when the dormant token fails.)

### 🔴 Mode C — `OAuth not initialized` / `Refresh token missing` (401) — never logged in / lost tokens
- **Symptom:** `/auth/ml/status` → `404 No token stored yet`; `/ml/*` → 401.
- **Cause:** OAuth flow was never completed on this environment, OR Cloud Run can't read/persist the GCS token object.
- **Fix:** Confirm GCS storage is wired (Step 4 checklist), then **authorize** (Step 3).

---

## Decision tree — run this when ML breaks

```
1. curl -s https://panelin-calc-q74zutv7dq-uc.a.run.app/auth/ml/status | jq .
   │
   ├─ 404 "No token stored yet"  ───────────────►  Mode C → Step 3 (authorize)
   ├─ 503 "Token store unavailable" ───────────►  Mode C → Step 4 (GCS/IAM), then Step 3
   └─ 200 {expiresAt, userId} 
        │
        ├─ expiresAt in the FUTURE → token should work. Test it:
        │     curl -s .../ml/users/me | jq .id
        │       ├─ returns 179969104 → ✅ healthy, look elsewhere
        │       └─ errors → token invalid despite status; go to Mode A/B
        │
        └─ expiresAt in the PAST → refresh will run on next call. Force it:
              curl -s .../ml/users/me | jq .
                ├─ "invalid_client"  → Mode A → Step 2 then Step 3
                └─ "invalid_grant"   → Mode B → Step 3
```

---

## The renewal procedure (the part you keep redoing)

### Step 1 — Confirm the current secret in the ML Developers portal
1. Go to <https://developers.mercadolibre.com.uy> → your app (**client_id `742811153438318`**).
2. Copy the current **Secret Key**. This is the source of truth; `.env` and Cloud Run must match it.

### Step 2 — Sync credentials to Cloud Run
```bash
cd ~/calculadora-bmc
# Put the current values in .env first (ML_CLIENT_ID, ML_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY, ML_TOKEN_GCS_BUCKET):
#   ML_CLIENT_SECRET=<secret from portal>     # use printf, NOT echo — trailing newline breaks === checks
npm run ml:cloud-run        # → ./run_ml_cloud_run_setup.sh — pushes ML_* + token env to the Cloud Run service
```
> Secrets canon: local-dev source of truth is **Doppler `bmc-frontend/prd` / `bmc-backend/prd`** (config `prd`).
> Production runtime reads Cloud Run env (set by the script above) — there is no auto-sync yet, so update both.

### Step 3 — Re-authorize (the human-in-the-loop step that mints a fresh refresh_token)
1. In a browser, open: <https://panelin-calc-q74zutv7dq-uc.a.run.app/auth/ml/start>
2. Log in as **BMC URUGUAY** and approve.
3. The `/auth/ml/callback` returns `{ ok: true, userId: 179969104, expiresAt: <future> }`.
4. Verify it stuck:
   ```bash
   curl -s https://panelin-calc-q74zutv7dq-uc.a.run.app/auth/ml/status | jq '{userId, expiresAt}'
   ```
> For **local dev**, the redirect is `http://localhost:3001/auth/ml/callback` — run the API, then open `http://localhost:3001/auth/ml/start`. If ML demands https, use ngrok and register that exact URL in the portal.

### Step 4 — (If Mode C) verify token persistence is actually wired
Tokens MUST persist to GCS or every Cloud Run cold start loses them:
- `ML_TOKEN_STORAGE=gcs`
- `ML_TOKEN_GCS_BUCKET=bmc-ml-tokens`  ·  `ML_TOKEN_GCS_OBJECT=ml-tokens.enc`
- `TOKEN_ENCRYPTION_KEY=<64 hex chars>` (AES-256-GCM). Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Cloud Run service account **`panelin-runner`** needs `roles/storage.objectAdmin` on `gs://bmc-ml-tokens`.
- **Critical (2026-06-23 hotfix):** the GCS client must use the **metadata-server identity** (`new Compute()`), NOT `GOOGLE_APPLICATION_CREDENTIALS` (that's the Sheets/Drive SA and its JWT exchange fails with "Premature close", taking down all `/ml/*`). Already fixed in `server/tokenStore.js`.

---

## Environment variables — the complete list

| Var | Default | Notes |
|---|---|---|
| `ML_CLIENT_ID` | `742811153438318` | App ID (stable) |
| `ML_CLIENT_SECRET` | `""` | **The usual culprit.** Must match portal + Cloud Run |
| `ML_AUTH_BASE` | `https://auth.mercadolibre.com.uy` | Authorization host |
| `ML_API_BASE` | `https://api.mercadolibre.com` | API host (token + data) |
| `ML_SITE_ID` | `MLU` | Uruguay |
| `ML_REDIRECT_URI_DEV` | `http://localhost:3001/auth/ml/callback` | Must match portal exactly |
| `ML_REDIRECT_URI_PROD` | derived from `PUBLIC_BASE_URL` | `.../auth/ml/callback` |
| `ML_USE_PROD_REDIRECT` | `true` on Cloud Run | Forces prod redirect |
| `ML_TOKEN_STORAGE` | `file` local / `gcs` on Cloud Run | |
| `ML_TOKEN_GCS_BUCKET` | `""` → set to `bmc-ml-tokens` | **Required in prod** for persistence |
| `ML_TOKEN_GCS_OBJECT` | `ml-tokens.enc` | |
| `ML_TOKEN_FILE` | `.ml-tokens.enc` | Local only; gitignored, per-machine |
| `TOKEN_ENCRYPTION_KEY` | `""` | 64 hex; empty = plaintext (dev only) |

---

## Useful endpoints & scripts

| What | Command |
|---|---|
| Token status (prod) | `curl -s https://panelin-calc-q74zutv7dq-uc.a.run.app/auth/ml/status \| jq .` |
| Health (config gaps) | `curl -s https://panelin-calc-q74zutv7dq-uc.a.run.app/health \| jq '{hasTokens, mlTokenStoreOk, missingConfig}'` |
| Who am I (live token test) | `curl -s https://panelin-calc-q74zutv7dq-uc.a.run.app/ml/users/me \| jq '{id, nickname}'` |
| Start OAuth (browser) | open `https://panelin-calc-q74zutv7dq-uc.a.run.app/auth/ml/start` |
| Sync env → Cloud Run | `npm run ml:cloud-run` |
| Verify OAuth config | `npm run ml:verify` (needs API running) |
| Pending ML questions workup | `npm run ml:pending-workup` |

> Production URL has two equivalent forms — `panelin-calc-q74zutv7dq-uc.a.run.app` (canonical) and
> `panelin-calc-642127786762.us-central1.run.app` (project-number form). Same service.
> The Vercel frontend proxies `/api`, `/calc`, `/auth`, `/sync` — **not `/ml`** — so hit Cloud Run directly for ML.

---

## Key code locations (for when behavior must change)

| Concern | File:line |
|---|---|
| Build auth URL / PKCE | `server/mercadoLibreClient.js:31` |
| OAuth start / callback | `server/index.js:297` / `:311` |
| Save token + compute `expires_at` | `server/mercadoLibreClient.js:45` |
| Auto-refresh (60s pre-expiry, in-flight coalescing) | `server/mercadoLibreClient.js:106` |
| Refresh exchange | `server/mercadoLibreClient.js:96` |
| GCS token store (metadata-server identity) | `server/tokenStore.js:67` |
| Encryption (AES-256-GCM) | `server/tokenStore.js:6` |
| Seller ID resolution | `server/mercadoLibreClient.js:191` |
| Status / health endpoints | `server/index.js:337` / `:234` |

## Related docs
- `docs/ML-OAUTH-SETUP.md` — step-by-step first-time setup
- `docs/mercadolibre-developers-auth-authorization-uy.md` — ML OAuth standard
- `goal-prompt-fix-ml-oauth-now.md` — the 2026-06-17 expired-token incident write-up
- `docs/team/PROJECT-STATE.md` — incident history (2026-06-23 GCS hotfix at the top)
