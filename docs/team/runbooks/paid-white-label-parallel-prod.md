# Parallel production — Paid White-Label (does NOT replace current prod)

**Current production (untouched):**

| Piece | Name | URL |
|-------|------|-----|
| SPA | Vercel production alias | https://calculadora-bmc.vercel.app |
| API | Cloud Run `panelin-calc` | https://panelin-calc-q74zutv7dq-uc.a.run.app |
| Deploy | CI on **`main` only** | `deploy-vercel.yml` production + `deploy-calc-api.yml` |

**This branch / PR #1051 does not replace that** until someone **merges to `main`**. Do not merge #1051 if you want current prod unchanged.

---

## Parallel sandbox (this version)

| Piece | Name | How |
|-------|------|-----|
| SPA | Vercel **preview** (never `--prod`) | `vercel.paid.json` → paid API |
| API | Cloud Run **`panelin-calc-paid`** | sibling service, same project/region |
| Trigger | Manual only | `gh workflow run deploy-paid-parallel.yml --ref feat/paid-white-label-presupuestos` |

Same GCP project (`chatbot-bmc-live`), **different Cloud Run service**. Traffic to `panelin-calc` is not switched.

### Shared DB (additive)

The paid API can use the same `DATABASE_URL`. Apply **only**:

`supabase/migrations/20260815000001_paid_white_label.sql`

That adds `plan_tier` value `paid`, `users.branding`, `quotes.bmc_snapshot`. Current prod code does not read those columns, so the live calculator on `main` stays the same.

If you want **zero shared schema**, clone Postgres and point `panelin-calc-paid` at a different `DATABASE_URL` (HITL — not in the workflow).

### What we never do for this sandbox

- `vercel deploy --prod`
- `gcloud run deploy panelin-calc` (the existing service)
- Merge #1051 to `main`
- Change `vercel.json` rewrites on `main` (they stay on `panelin-calc`)

---

## Launch

```bash
cd ~/calculadora-bmc
gh workflow run deploy-paid-parallel.yml --ref feat/paid-white-label-presupuestos
gh run watch
```

The workflow:

1. Builds the API image from **this branch**.
2. Deploys service **`panelin-calc-paid`** (creates it if missing).
3. Substitutes the real Cloud Run URL into `vercel.paid.json`.
4. `vercel deploy --prebuilt` **without** `--prod`.
5. Comments the preview URL on PR #1051.

### CORS / cookies

- Paid Cloud Run gets `CORS_ORIGIN` including the preview host (workflow sets it after Vercel URL is known, or you add it once).
- `IDENTITY_COOKIE_DOMAIN` can stay `.calculadora-bmc.vercel.app` so GIS login works on `*.calculadora-bmc.vercel.app` previews.

### Activate a test user (sandbox)

Same SQL as the MVP runbook — only after the additive migration:

```sql
UPDATE identity.users SET plan_tier = 'paid', updated_at = now()
 WHERE email = 'tu@email';
```

Use the **preview URL**, not calculadora-bmc.vercel.app.

---

## Promote later (only when you want this TO replace prod)

1. UAT on the parallel URL.
2. Merge #1051 → `main`.
3. Normal CI deploys `panelin-calc` + Vercel production.
4. Optionally delete `panelin-calc-paid`.
