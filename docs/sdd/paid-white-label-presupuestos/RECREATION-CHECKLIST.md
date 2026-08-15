# RECREATION-CHECKLIST — Paid White-Label Presupuestos

**System:** Modality 1 paid Comprador + white-label client PDF + BMC immutable copy  
**SDD:** [`SDD.md`](./SDD.md)  
**Status:** spec Accepted-for-build — runtime **not** shipped (2026-08-15)

Legend: `[x]` done · `[ ]` open · `N/A` justified

---

## 0. Prerequisites

- [x] Repo git root: `~/calculadora-bmc`
- [x] Identity live in prod (PROJECT-STATE 2026-05-20) — do **not** re-run `identity_init`
- [x] Goal prompt: `goal-prompt-paid-users-white-label-presupuestos.md`
- [ ] Implementation branch `feat/paid-white-label-presupuestos` from `origin/main`
- [ ] Node 24 + `doppler run -- npm run dev:full` for UAT

---

## 1. Schema (additive only)

- [ ] Migration adds `plan_tier` CHECK `base|plus|paid`
- [ ] `identity.users.branding` jsonb
- [ ] `identity.quotes.bmc_snapshot` + `bmc_snapshot_at`
- [ ] Applied to local/staging before prod
- [ ] **N/A** re-apply `20260601000001_identity_init.sql` as a “golive”

---

## 2. API

- [ ] `PATCH /api/admin/users/:id/plan-tier` (admin) + audit_log
- [ ] `GET /api/me/branding` (any user) 200 + null branding
- [ ] `POST /api/me/branding` unpaid → 403 `plan_required`
- [ ] `POST /api/me/branding` paid → stores GCS + jsonb
- [ ] Reject SVG / >1 MB
- [ ] Complete path exists (existing flip **or** `POST /api/me/quotes/:id/complete`)
- [ ] `GET /api/me/quotes` **omits** `bmc_snapshot`
- [ ] `export.pdf?audience=bmc` forbidden to comprador

---

## 3. PDF

- [ ] Paid `audience=client`: user logo present
- [ ] Paid `audience=client`: no `bmc-logo.png`, no header “BMC Uruguay”, no BMC RUT
- [ ] `audience=bmc`: BMC chrome + margin
- [ ] Anonymous / unpaid: BMC chrome unchanged

---

## 4. Freeze / audit

- [ ] First complete writes snapshot once
- [ ] Second complete does not mutate snapshot
- [ ] Tampered client totals → `price_drift` + server totals win
- [ ] Soft-delete keeps snapshot + `quote_events`
- [ ] Sheets enqueue only if `SHEETS_CLIENT_QUOTES_ENABLED=true`

---

## 5. UI

- [ ] `/mi-espacio` preferencias: logo + display name (paid)
- [ ] `/hub/admin/users`: set plan_tier
- [ ] `/` and `/calculadora` still work logged out

---

## 6. Tests & gates

- [ ] Unpaid cannot white-label
- [ ] Paid PDF omits BMC logo
- [ ] BMC snapshot ignores tampered prices
- [ ] Soft-delete keeps snapshot
- [ ] Anonymous PDF still BMC-branded
- [ ] `npm run lint` on touched files
- [ ] New `node --test` files pass; `gate:local` or named baseline fails

---

## 7. Ops

- [ ] `docs/team/runbooks/paid-white-label-mvp.md` exists
- [ ] Emergency SQL to set `plan_tier='paid'` documented
- [ ] PROJECT-STATE Cambios recientes dated
- [ ] PR open, **not** merged, **not** deployed without human OK
