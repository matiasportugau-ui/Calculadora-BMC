# ADR-011: PEA worker topology — in-process default, Scheduler tick deferred

**Status**: Accepted  
**Date**: 2026-08-09 (G-05 — user chose **1C**)  
**Context**: SDD §8 listed dual options (in-process loop vs Cloud Scheduler → `/api/pea/worker/tick`). GAP-PLAN G-05 flagged L2 ambiguity blocking auditor ≥90. Calculadora-BMC already runs durable job workers in-process (`startOmniAiWorker`, transportista outbox, WA/Omni interval workers) with `FOR UPDATE SKIP LOCKED` on PostgreSQL. Cloud Run deploy uses `min-instances=0`; PEA slow loop tolerates minutes–hours of drain latency when the service is idle.  
**Decision**:

1. **MVP default (M1+):** In-process worker loop inside `panelin-calc` — `startPeaWorker()` on API boot when `PEA_ENABLED=1` and `PEA_WORKER_ENABLED=1`.
2. **Claim pattern:** Same as `omni_ai_jobs` — transactional batch claim on `pea.jobs` with `FOR UPDATE SKIP LOCKED`, shared retry/dead-letter helpers where possible (ADR-004).
3. **Concurrency:** Env `PEA_MAX_CONCURRENCY` (default **2**); in-process `running` guard + batch limit; one active analysis per fingerprint (SDD §9.2).
4. **Interval:** Env `PEA_WORKER_INTERVAL_MS` (suggested default **5000**, tunable).
5. **Escalation (deferred, documented):** Optional Cloud Scheduler → authenticated `POST /api/pea/worker/tick` that calls the **same** `claimAndRunBatch()` — no DDL or queue semantics change. Enable only if ops measures unacceptable gap drain latency with `min-instances=0` and idle traffic.
6. **Out of scope M1–M2:** Separate worker service, Pub/Sub fan-out, dedicated Cloud Run job runner.

**Consequences**:

- + Aligns with proven monolith pattern; lower M1 complexity; durable outbox survives scale-to-zero (latency only).
- + Scheduler path reserved without redesigning queue contract.
- − Idle Cloud Run instances may delay drain until next HTTP wake or optional Scheduler (acceptable for L0–L2 MVP volume ≤20 gaps/day).

**Alternatives considered**:

- In-process only, no documented Scheduler path (rejected — leaves scale-to-zero concern unaddressed in Spec).
- Cloud Scheduler as MVP default (rejected — extra infra; inconsistent with Omni/WA workers; PEA volume does not justify it day 1).
- Separate PEA worker Cloud Run service (rejected — ADR-008 same-repo module; premature split).

**Evidence (repo):**

- `server/lib/omni/orchestrator/aiWorker.js` — SKIP LOCKED batch claim.
- `server/lib/omni/snoozeWorker.js` — rationale for in-process vs external cron.
- `server/lib/transportistaOutboxWorker.js` — outbox + interval pattern.
- `.github/workflows/deploy-calc-api.yml` — `--min-instances=0`.

**Related:** ADR-004 (PG queue), `contracts/postgres-queue.md`, SDD §8 Deployment, IMP-PEA-03 (jobs worker).
