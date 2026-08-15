# IMPLEMENTATION-GUIDE — Paid White-Label Presupuestos

Bind to [`SDD.md`](./SDD.md) ADRs 001–008. Do not invent a `paid_base` role. Do not gate `/`.

**Cwd:** `~/calculadora-bmc`  
**Branch:** `feat/paid-white-label-presupuestos` from `origin/main`  
**Executor (Grok):** `/goal load goal-prompt-paid-white-label-presupuestos-grok.md`

---

## P0 — Audit (15 min, no product edits)

Write a 10-line gap list at the top of `docs/team/runbooks/paid-white-label-mvp.md` (create file).

Confirm:

1. Where (if anywhere) quote `status` becomes `completed`.
2. GCS upload helper used by WA-media / `quotes/pdf/`.
3. `SELECT plan_tier, count(*) FROM identity.users GROUP BY 1` (prod read-only via Doppler) — do not remap `plus`.
4. Whether `feat/pdf-customer-brand-identity` has reusable PDF hooks (cherry-pick only).

If no complete path: implement `POST /api/me/quotes/:id/complete` in P3 (specified in SDD §6).

---

## P1 — Entitlement

| Touch | Action |
|-------|--------|
| `supabase/migrations/*_paid_white_label.sql` | CHECK `plan_tier IN ('base','plus','paid')`; `users.branding`; `quotes.bmc_snapshot` + `_at` |
| `server/lib/identityAuth.js` | `isPaidTier(user)`, `requirePaid` middleware |
| `server/routes/identityAdmin.js` | `PATCH /api/admin/users/:id/plan-tier` + audit |
| `src/components/admin/users/*` | plan_tier control in drawer |
| tests | unpaid vs paid vs admin |

**Done when:** unpaid `POST /api/me/branding` 403 (even if branding handler is stubbed).

---

## P2 — Branding + PDF

| Touch | Action |
|-------|--------|
| `server/routes/identityMe.js` | `GET/POST /api/me/branding` |
| GCS helper | `identity-branding/{user_id}/logo` |
| `server/lib/quotePdf.js` | `audience=client\|bmc`; inline user logo |
| `src/pdf-templates/simple*.js` | accept branding override; paid client strips BMC chrome |
| `server/routes/quoteExport.js` | pass audience; forbid `bmc` for comprador |
| `src/components/MySpacePage.jsx` | preferencias upload |

**Done when:** fixture HTML/PDF for paid client has no `bmc-logo`; anonymous still has it.

---

## P3 — Freeze + snapshot

| Touch | Action |
|-------|--------|
| Complete route | existing flip or `POST /api/me/quotes/:id/complete` |
| Re-price | catalog / `p()` / LISTA_ACTIVA; set `price_drift` |
| `bmc_snapshot` | write once in same TX as `status=completed` |
| `quote_events` | `kind=completed` |
| `listMyQuotes` / `getMyQuote` | strip `bmc_snapshot` |

**Done when:** tamper test: client `total_usd=1` → snapshot uses server math.

---

## P4 — Sheets + runbook

| Touch | Action |
|-------|--------|
| `clientQuotesSheetSync.enqueue` | call from complete; honor flag |
| `docs/team/runbooks/paid-white-label-mvp.md` | activate SQL, UAT clicks, rollback `plan_tier='base'` |
| `docs/team/PROJECT-STATE.md` | Cambios recientes |

Do not create the Sheets tab in code.

---

## P5 — Tests + PR

Required tests (names indicative):

1. `unpaid cannot POST branding`
2. `paid client PDF omits BMC logo`
3. `snapshot ignores tampered client prices`
4. `soft-delete keeps snapshot`
5. `anonymous PDF still BMC-branded`

Commit: `feat(identity): paid plan + white-label presupuestos + BMC immutable copy`  
Open PR to `main`. **Do not merge. Do not deploy.**

---

## Emergency activation (runbook excerpt)

```sql
UPDATE identity.users
   SET plan_tier = 'paid', updated_at = now()
 WHERE email = 'usuario@example.com'
   AND status = 'active';
```

Rollback: set `plan_tier = 'base'`. Existing snapshots stay (audit).
