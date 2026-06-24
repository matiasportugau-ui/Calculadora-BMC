# 20 — Operational Readiness

**Program:** EXPORT_SEAL::OMNICRM_AUTONOMOUS_TRANSFORMATION_PROGRAM_V2  
**Date:** 2026-06-22

---

## 1. Pre-flight checklist (before Track A1)

| # | Item | Command / doc | Owner |
|---|------|---------------|-------|
| 1 | DATABASE_URL prod/staging verified | `npm run wa:migrate` (existing) | Platform |
| 2 | Doppler secrets synced | bmc-backend/prd | Matias |
| 3 | ADRs 001–010 approved | This folder | Architecture |
| 4 | Backup Postgres snapshot | GCP console **ASSUMPTION_REQUIRED** | Platform |
| 5 | Rollback runbook read | [12-migration-strategy.md](12-migration-strategy.md) | All track leads |
| 6 | gate:local baseline green | `npm run gate:local` | CI |
| 7 | smoke:prod baseline | `npm run smoke:prod` | Deployment |

---

## 2. Environment variables (new omni)

Add to `.env.example` when implementing (design reference):

```bash
# Omni Core
OMNI_WA_SHADOW_WRITE=0
OMNI_ML_SHADOW_WRITE=0
OMNI_EMAIL_SHADOW_WRITE=0
OMNI_EVENT_BUS_ENABLED=0
OMNI_AI_ORCHESTRATOR_ENABLED=0
OMNI_DEALS_SHEETS_AUTHORITY=1
OMNI_AI_DAILY_BUDGET_USD=50

# Frontend (Vite)
VITE_OMNI_INBOX=0
VITE_OMNI_DEALS=0

# Observability
OTEL_ENABLED=0
```

Sync to Cloud Run: `npm run ml:cloud-run` pattern extended for omni vars **when implemented**.

---

## 3. Deploy checklist (per PR merge)

1. `npm run gate:local` — required
2. `npm run gate:local:full` — if `src/` changed
3. Feature flag **OFF** in prod on first merge
4. Staging: enable flag → smoke
5. `npm run pre-deploy` — health, contracts, PROJECT-STATE
6. Cloud Run deploy panelin-calc
7. Vercel deploy if frontend
8. `npm run smoke:prod`
9. Append PROJECT-STATE Cambios recientes

Skill: `.cursor/skills/bmc-calculadora-deploy-from-cursor/SKILL.md`

---

## 4. Runbooks

### RB-OMNI-001: Disable omni shadow write (emergency)

```bash
# Cloud Run / Doppler
OMNI_WA_SHADOW_WRITE=0
OMNI_ML_SHADOW_WRITE=0
OMNI_EVENT_BUS_ENABLED=0
# Redeploy or env refresh
```

Verify: new messages only in wa_* / Sheets; omni ingest rate → 0.

---

### RB-OMNI-002: Rollback read flip

```bash
VITE_OMNI_INBOX=0  # Vercel env
```

Operators see legacy Sheets queue immediately.

---

### RB-OMNI-003: AI cost circuit breaker

```bash
OMNI_AI_ORCHESTRATOR_ENABLED=0
OMNI_AI_DAILY_BUDGET_USD=10  # throttle
```

Drain: `SELECT count(*) FROM omni_ai_jobs WHERE status='pending'`

---

### RB-OMNI-004: Reconcile drift investigation

```bash
npm run omni:reconcile-deals -- --dry-run   # when implemented
# Report: .runtime/omni-reconcile-deals-*.json
```

Compare Sheets Monto vs omni_deals.value_usd.

---

### RB-OMNI-005: Backfill recovery

```bash
node scripts/omni-backfill-wa.mjs --dry-run
# If bad batch: DELETE FROM omni_messages WHERE metadata->>'source' = 'wa_backfill' AND created_at > ...
```

Only with Matias approval per disk/recovery rules for prod deletes.

---

## 5. Smoke tests

| Test | When | Command |
|------|------|---------|
| Prod baseline | Every deploy | `npm run smoke:prod` |
| Omni health | After D1 | `curl /api/omni/health` |
| Omni full smoke | After H3 | `npm run smoke:omni` **future** |
| Contract | API changes | `npm run test:contracts` |
| WA parity | Before P3 | `npm run test:omni:parity` **future** |

---

## 6. Human gates

| Gate | Doc | Blocks |
|------|-----|--------|
| cm-0 Meta OAuth | [HUMAN-GATES-ONE-BY-ONE.md](../team/HUMAN-GATES-ONE-BY-ONE.md) | IG/FB Phase 5 |
| cm-1 ML OAuth | ML-OAUTH-SETUP.md | Already passed — maintain |
| Sheets write schema | google-sheets-module | Deal sync columns |

---

## 7. On-call **ASSUMPTION_REQUIRED**

| Tier | Scope | Contact |
|------|-------|---------|
| L1 | Operator issues | Internal WA/ML ops |
| L2 | API/webhook | Platform on-call |
| L3 | Data/finance | Matias |

Alert channels: existing BMC ops (Telegram/email) — not new tooling in v1.

---

## 8. Incident response

1. **Detect:** Alert or operator report
2. **Triage:** Check `/api/omni/metrics`, Cloud Run logs, trace_id
3. **Mitigate:** Feature flag off per runbook
4. **Communicate:** #ops or equivalent
5. **Post-mortem:** `docs/team/incidents/OMNI-YYYY-MM-DD.md` template

Severity:
- **SEV1:** Message loss, wrong customer send, money error
- **SEV2:** Inbox down, AI runaway cost
- **SEV3:** UI glitch, non-blocking

---

## 9. Training (operators)

| Topic | Duration | When |
|-------|----------|------|
| Omni inbox overview | 30min | Before VITE_OMNI_INBOX cohort |
| Legacy deep links | 15min | Same |
| AI suggest HITL | 15min | Before E2 prod |
| Deals kanban | 30min | Before G4 |

Doc: extend [wa-cockpit/OPERATOR-GUIDE.md](../wa-cockpit/OPERATOR-GUIDE.md) with omni section Phase 3.

---

## 10. Production readiness gates

| Gate | Criteria |
|------|----------|
| **G-PROD-OMNI-P1** | Shadow write 7d staging, error <0.1% |
| **G-PROD-OMNI-P2** | B4 parity pass |
| **G-PROD-OMNI-P3** | Admin cohort UAT 5 operators |
| **G-PROD-OMNI-P4** | Finance sign-off on deal sync |
| **G-PROD-OMNI-GLOBAL** | All above + smoke:prod + pre-deploy |

---

## 11. Monitoring dashboard links **ASSUMPTION_REQUIRED**

| Dashboard | URL |
|-----------|-----|
| Cloud Run panelin-calc | GCP console |
| Vercel calculadora-bmc | Vercel dashboard |
| Omni metrics | `/api/omni/metrics` (after H3) |
| WA metrics existing | `/api/wa/metrics` |

---

## References

- [AGENTS.md](../../AGENTS.md)
- [CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md](../procedimientos/CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md)
- [12-migration-strategy.md](12-migration-strategy.md)
- [14-risk-register.md](14-risk-register.md)
