# Repo baseline citations — PEA evidence (G-08 partial)

**Date:** 2026-08-09  
**Purpose:** Path:line grounding for queue, budget, and auth claims in PEA SDD Appendix A.

## Queue / durable jobs

| Claim | Tag | Source |
|-------|-----|--------|
| `omni_ai_jobs` with SKIP LOCKED batch claim | CONFIRMED | `server/lib/omni/orchestrator/aiWorker.js:508-516` |
| In-process worker vs external cron rationale | CONFIRMED | `server/lib/omni/snoozeWorker.js:6-8` |
| Outbox + interval worker pattern | CONFIRMED | `server/lib/transportistaOutboxWorker.js:4-14` |
| Workers started from API boot | CONFIRMED | `server/index.js:1353-1358` |
| In-memory eventBus (unsuitable for PEA) | CONFIRMED | `server/lib/omni/eventBus.js` (grep consumers) |

## Budget / token estimate

| Claim | Tag | Source |
|-------|-----|--------|
| Soft daily budget for Omni AI jobs | CONFIRMED | `server/lib/omni/orchestrator/aiWorker.js:482-486` |
| `getDailyAiCost` from job rows | CONFIRMED | `server/lib/omni/orchestrator/aiWorker.js:231-237` |
| Token estimator module exists | CONFIRMED | `server/lib/tokenEstimator.js` |
| Agent chat budget memory | CONFIRMED | `server/lib/budget.js` (see grep `dailyBudget`) |

## Auth / identity

| Claim | Tag | Source |
|-------|-----|--------|
| JWT requireAuth middleware | CONFIRMED | `server/middleware/requireAuth.js` |
| Module grants RBAC | CONFIRMED | `server/middleware/requireGrant.js` |
| Identity JWT issuance | CONFIRMED | `server/lib/identityAuth.js` |

## PEA TARGET (not yet in repo)

| Claim | Tag | Source |
|-------|-----|--------|
| `pea.*` schema | TARGET | `server/migrations/pea/001_pea_core.sql` |
| `/api/pea/*` routes | TARGET | `contracts/openapi-pea.yaml` |
| `PEA_ENABLED` runtime | TARGET | SDD §8; default off |

## Live probe

See [`live-probe.md`](live-probe.md) — **UNKNOWN** until IMP-PEA-00 human ops run.
