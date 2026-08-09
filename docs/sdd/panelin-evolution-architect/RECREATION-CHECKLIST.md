# RECREATION-CHECKLIST — Panelin Evolution Architect (PEA)

**System:** `panelin-evolution-architect`  
**SDD:** [`SDD.md`](SDD.md) v1.2.1 (Target + As-Built appendix)  
**Milestone:** M0–M4 runtime in repo; live prod flags **OFF** until campaign oleadas 2–3  
**Last updated:** 2026-08-09  

Use this checklist to verify a developer can operate and extend PEA **without inventing API or SQL shapes**.

## Must-have artifacts

| Item | Status | Path / note |
|------|--------|-------------|
| SDD 12 sections | [x] | [`SDD.md`](SDD.md) |
| JSON Schemas (5 entities) | [x] | [`contracts/schemas/`](contracts/schemas/) |
| Fingerprint contract | [x] | [`contracts/fingerprint.md`](contracts/fingerprint.md) |
| OpenAPI `/api/pea/*` | [x] | [`contracts/openapi-pea.yaml`](contracts/openapi-pea.yaml) |
| SQL DDL `pea.*` + jobs | [x] | [`server/migrations/pea/001_pea_core.sql`](../../server/migrations/pea/001_pea_core.sql) … `003_pea_m4_jobs.sql` |
| Queue / budget / runtime seals | [x] | [`contracts/`](contracts/) |
| ADRs 001–012 | [x] | [`ADRs/`](ADRs/) incl. ADR-012 IMP-05b risk acceptance |
| IMPLEMENTATION-GUIDE | [x] | [`IMPLEMENTATION-GUIDE.md`](IMPLEMENTATION-GUIDE.md) |
| Audit scorecard ≥90 | [x] | [`audit/SCORECARD.json`](audit/SCORECARD.json) |
| Runtime `server/lib/pea/*.js` | [x] | 24+ modules; Hub `/hub/pea` |
| `npm run test:pea` in gate:local | [x] | 15 test files |
| Live probe (IMP-PEA-00) | [~] | [`evidence/live-probe.md`](evidence/live-probe.md) + `npm run pea:live-probe` — prod rows pending human |
| PII denylist operational | [x] | [`server/lib/pea/piiDenylist.js`](../../server/lib/pea/piiDenylist.js) + `tests/peaPiiDenylist.test.js` |

## Section-specific

### §5–§6 Containers & AI

| Item | Status | Evidence |
|------|--------|----------|
| Worker topology locked (1C) | [x] | ADR-011; `peaWorker.js` |
| C4Component flow | [x] | SDD §6.0 + as-built paths |
| Critic before ready_for_review | [x] | `critic.js`, `evolutionPackets.js` |
| Evolution lanes H/K/C | [x] | `laneRouter.js` |
| ArchitectRuntime mock + LLM path | [x] | `architectRuntime.js`, `architectLlm.js` (`PEA_ARCHITECT_MOCK`) |

### §8 Deployment

| Item | Status | Note |
|------|--------|------|
| Worker default documented | [x] | In-process `startPeaWorker` |
| Scheduler tick deferred | [x] | `POST /api/pea/worker/tick` route exists |
| `PEA_*=0` prod default | [x] | `server/config.js` |
| Migrate command | [x] | `node scripts/pea-apply-migration.mjs` (001–003) |
| Staging topology | [~] | Runbook: [`evidence/staging-topology-runbook.md`](evidence/staging-topology-runbook.md) — infra pending human |
| Deploy env vars | [x] | `.github/workflows/deploy-calc-api.yml` + `.env.example` |

### §9 Crosscutting

| Item | Status |
|------|--------|
| Principal + SideEffectRegistry | [x] `principal.js`, `sideEffectRegistry.js` |
| Outbox + SKIP LOCKED jobs | [x] `outbox.js`, `peaWorker.js` |
| Grant TTL in schema | [x] `grant.schema.json` |
| PII redaction denylist | [x] G-10 closed in repo |

## Acceptance test

> A developer with repo access can run M1–M4 locally (`PEA_ENABLED=1`, migrate, `test:pea`, `/hub/pea`) using SDD + contracts + this checklist.

**Verdict:** **As-built recreation-ready** for L0–L2; L3+ requires staging topology (oleada 2) before prod.

## Explicitly deferred (post-campaign)

- [ ] OpenCode / Cursor implementer adapters
- [ ] Auto-ratchet writer on Accept
- [ ] `PEA_ENABLED=1` prod (human gate oleada 3+)

## Re-score

After contract change, re-run `sdd-quality-auditor` → update [`audit/SCORECARD.json`](audit/SCORECARD.json).
