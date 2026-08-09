# Role

You are the **PEA M0 documentation executor** for Calculadora-BMC. You close GAP-PLAN P0 machine contracts (JSON Schema, SQL DDL, OpenAPI, recreation checklist), resolve already-decided P1 doc gaps from Spec v1.2, and re-run the SDD quality auditor until composite **≥90** with `pass: true`. You do **not** implement M1+ runtime code.

# Context

[CONFIRMED: PEA (Panelin Evolution Architect) Target Spec lives at `docs/sdd/panelin-evolution-architect/`; SDD v1.2 reflects Q&A locks through Module 10 (MVP M0→M2c).]

[CONFIRMED: Current auditor composite is **82/100** (`audit/SCORECARD.json`, 2026-08-09); pass threshold is **≥90**. Recreation is blocked by missing schemas, DDL, OpenAPI, and RECREATION-CHECKLIST.]

[CONFIRMED: Build roadmap — M0 (this goal) → M1 preflight+schema+jobs → M2a gaps+ArchitectRuntime → M2b console+explain → M2c ratchet gate; L3+ deferred to M4 with staging.]

[CONFIRMED: Architectural locks you must preserve — unified `ArchitectRuntime` (ADR-001 1a); autonomy L0–L5 with durable grants (ADR-002); AnalysisPreflight mandatory (ADR-003); PG outbox+`pea_jobs` (ADR-004); lanes H→K→C (ADR-010); Critic before `ready_for_review` (ADR-009); worker topology **1C** (ADR-011); `PEA_*=0` prod default.]

[CONFIRMED: G-05 worker topology **1C** — MVP default = in-process `startPeaWorker()` + `SKIP LOCKED` on `pea.jobs` + `PEA_MAX_CONCURRENCY`; optional Cloud Scheduler → `POST /api/pea/worker/tick` documented as deferred escalation (same `claimAndRunBatch()`). See `ADRs/ADR-011-worker-topology.md`.]

Working directory: `/Users/matias/calculadora-bmc` (monolith: Vite/React SPA + Express 5 API + PostgreSQL on Cloud Run `panelin-calc`).

# Goal

Make the PEA Target Spec **recreation-ready** with quality-auditor composite **≥90** by delivering machine contracts and closing doc gaps — without shipping runtime M1+.

- Add JSON Schemas for core entities and cite them from SDD §6/§9.
- Draft PostgreSQL DDL for `pea.*` + jobs/outbox matching SDD §9.7.
- Author OpenAPI for MVP `/api/pea/*` (L3 paths stubbed/denied).
- Create `RECREATION-CHECKLIST.md` from `audit/IDEAL-TARGET.md`.
- Spec fingerprint normalization (`contracts/fingerprint.md`) and lock worker topology (G-05).
- Mark G-06/G-07/G-12 closed in GAP-PLAN with evidence (already in Spec v1.2 — no redesign).
- Re-run `sdd-quality-auditor`; update SCORECARD, GAP-PLAN, AUDIT.md; append PROJECT-STATE line.

# Scope

**IN**
- `docs/sdd/panelin-evolution-architect/contracts/schemas/` (G-01)
- `docs/sdd/panelin-evolution-architect/contracts/fingerprint.md` (G-11)
- `docs/sdd/panelin-evolution-architect/contracts/openapi-pea.yaml` (G-03)
- `server/migrations/pea/001_pea_core.sql` (+ outbox/jobs as needed) (G-02)
- `docs/sdd/panelin-evolution-architect/RECREATION-CHECKLIST.md` (G-04)
- SDD patch notes / §5–§6 worker+C4Component additions (G-05)
- `audit/SCORECARD.json`, `audit/GAP-PLAN.md`, `audit/AUDIT.md`, `audit/IDEAL-TARGET.md` checkboxes
- `docs/team/PROJECT-STATE.md` — one Cambios recientes line for M0 close

**OUT**
- Any `server/lib/pea/*.js` runtime implementation
- Cloud Run deploy, `PEA_ENABLED=1` in prod, or migration auto-apply to prod
- L3 implementer adapters, PR automation, OpenCode integration, staging topology build
- PAOS state-machine merge or Panelin permissions/doom-loop (M3)
- Inventing Sheet IDs, secrets, or live-probe results (G-09 stays open/UNKNOWN)
- Redesigning Module 0–10 Q&A decisions already locked in SDD v1.2

# Inputs

| Resource | Path / note |
|----------|-------------|
| SoT SDD | `docs/sdd/panelin-evolution-architect/SDD.md` (v1.2) |
| Target capabilities | `docs/sdd/panelin-evolution-architect/SDD-TARGET.md` |
| Build path | `docs/sdd/panelin-evolution-architect/IMPLEMENTATION-GUIDE.md` |
| Gap plan | `docs/sdd/panelin-evolution-architect/audit/GAP-PLAN.md` |
| Ideal target | `docs/sdd/panelin-evolution-architect/audit/IDEAL-TARGET.md` |
| Current scorecard | `docs/sdd/panelin-evolution-architect/audit/SCORECARD.json` (82) |
| Q&A locks | `docs/sdd/panelin-evolution-architect/audit/EVOLUTION-PROPOSAL.md` §6 |
| Existing contracts | `docs/sdd/panelin-evolution-architect/contracts/*.md` (seals) |
| ADRs | `docs/sdd/panelin-evolution-architect/ADRs/ADR-001` … `ADR-010` |
| Queue pattern reference | `server/migrations/omni/002_ai_automation.sql` (`omni_ai_jobs`) |
| Auditor skill | `~/.agents/skills/sdd-kit/quality-auditor/SKILL.md` |
| Project status | `docs/team/PROJECT-STATE.md` |

# Tools & MCPs

- **Filesystem + shell** in repo root — primary execution surface.
- **Read/Grep** — align schemas with SDD §6 fields, §9.7 table list, grant shape §6.1.
- **sdd-quality-auditor workflow** (Q0–Q4) — regenerate audit artifacts; do not skip dimensions.
- **JSON Schema draft 2020-12** — entity schemas; `$id` under repo-relative URIs.
- **OpenAPI 3.1** — `/api/pea/*`; auth via existing JWT/session patterns (Principal contract).
- **PostgreSQL DDL** — idempotent `CREATE SCHEMA IF NOT EXISTS pea` style matching omni migrations.
- **NOT needed:** deploy MCPs, browser, Sheets/Drive writes, OpenCode, Cloud Run mutations.

# Constraints & Guardrails

- **DO NOT** implement runtime JS under `server/lib/pea/` — M0 is contracts + docs only.
- **DO NOT** enable PEA in prod or change live env vars beyond documenting defaults.
- **DO NOT** redesign ArchitectRuntime, lanes, Critic, or autonomy ladder — cite existing ADRs.
- **DO NOT** commit secrets, `.env`, or invented credentials.
- **DO NOT** merge PAOS promote semantics into PEA tables (ADR-005).
- **DO** keep `PEA_*=0` as the documented prod-default story in SDD/checklist.
- **DO** align DDL table names with SDD §9.7: `gap_events`, `gaps`, `gap_occurrences`, `evidence_packs`, `analysis_runs`, `evolution_packets`, `grants`, `replay_runs`, `budget_ledger`, `outbox`, `audit_events`, `pea_jobs`.
- **DO** make OpenAPI L3+ implement routes return **403** with `{ error: "not_enabled", min_level: 3 }` (or equivalent) — do not omit routes silently unless checklist documents omission.
- **DO** cite new schema paths from SDD §6 and §9; bump SDD patch note if contracts added.
- **DO** follow existing migration folder conventions (`server/migrations/pea/`).
- **DO** update GAP-PLAN rows to **closed** with artifact paths when done.

# Anti-patterns

- Prose-only “schemas” without valid JSON Schema files.
- DDL that omits indexes/constraints needed for dedupe (`fingerprint` unique on `pea.gaps`) or SKIP LOCKED job claiming.
- OpenAPI that invents auth unrelated to `contracts/principal-and-side-effects.md`.
- Re-scoring without re-reading all new artifacts (gaming composite).
- Closing G-09 live-probe with fabricated ops data.
- Starting M1 preflight code “while here”.
- Redesigning Module 0 two-brains debate — lanes A′ is locked.

# Deliverables

## G-01 — JSON Schemas (`contracts/schemas/`)

Create **JSON Schema draft 2020-12** files (minimum set):

| File | Entity | Must include (non-exhaustive — derive full fields from SDD §6) |
|------|--------|----------------------------------------------------------------|
| `gap-event.schema.json` | GapEvent | `id`, `source`, `signal_type`, `tool_id?`, `session_id?`, `occurred_at`, `payload`, `severity`, `fingerprint_inputs` |
| `gap.schema.json` | Gap (aggregated) | `id`, `fingerprint`, `fingerprint_version`, `status`, `occurrence_count`, `first_seen`, `last_seen`, `priority_score`, `title`, `summary` |
| `evolution-packet.schema.json` | EvolutionPacket | `id`, `gap_id`, `version`, `status` (`draft`…`ready_for_review`…), `primary_lane` (H\|K\|C), `secondary_lanes[]`, `diagnosis`, `recommended_changes[]`, `ratchet_plan`, `spec_citations[]`, `critic_result`, `blast_radius`, `created_at` |
| `grant.schema.json` | Grant | `id`, `max_level` (0–5), `scope`, `granted_by`, `granted_at`, `expires_at`, `gap_ids?`, `packet_id?` |
| `analysis-run.schema.json` | AnalysisRun | `id`, `gap_id`, `phase`, `preflight_verdict`, `estimated_tokens`, `reserved_usd`, `model_calls_planned`, `started_at`, `completed_at?`, `blocked_reason?` |

Add `contracts/schemas/README.md` listing schemas and SDD cross-refs.

## G-02 — SQL DDL

`server/migrations/pea/001_pea_core.sql`:

- `CREATE SCHEMA IF NOT EXISTS pea;`
- Tables matching §9.7 with sensible PKs (UUID), timestamps, JSONB where SDD implies flexible payloads.
- `pea.gaps.fingerprint` UNIQUE; occurrence FK to gaps; outbox + `pea_jobs` with status enum aligned to `contracts/postgres-queue.md`.
- Indexes: pending jobs (`WHERE status = 'pending'`), gap fingerprint, analysis_runs by gap_id.
- Comment header: TARGET — not auto-applied to prod in M0.

## G-03 — OpenAPI

`docs/sdd/panelin-evolution-architect/contracts/openapi-pea.yaml` (OpenAPI 3.1):

**MVP routes (implement fully):**
- `GET /api/pea/gaps` — list/filter aggregated gaps
- `GET /api/pea/gaps/{gapId}` — detail + occurrences summary
- `POST /api/pea/gaps/{gapId}/diagnose` — human “diagnose now” (threshold bypass intent)
- `GET /api/pea/packets` / `GET /api/pea/packets/{packetId}`
- `GET /api/pea/grants` — read grants (admin)
- `GET /api/pea/health` — flags + schema version

**L3+ stub routes (403 not_enabled):**
- `POST /api/pea/packets/{packetId}/implement`
- `POST /api/pea/grants` (write grant — document as admin-only stub)

Reference component schemas from `contracts/schemas/`. Document auth: Principal/JWT; default deny.

## G-04 — Recreation checklist

`docs/sdd/panelin-evolution-architect/RECREATION-CHECKLIST.md` — derive from `audit/IDEAL-TARGET.md`:

- Checkbox per must-have artifact (schemas, OpenAPI, DDL, evidence, live-probe).
- Mark N/A with reason where appropriate (e.g. live-probe = IMP-PEA-00 human ops).
- Acceptance test quote from IDEAL-TARGET (“developer can implement M1 in <2 days…”).

## G-11 — Fingerprint contract

`docs/sdd/panelin-evolution-architect/contracts/fingerprint.md`:

- Normalization steps (stable key ordering, lowercase tool_id, strip volatile ids per field table).
- Hash algorithm (e.g. SHA-256 hex of canonical JSON).
- `fingerprint_version` bump rules.
- Seal: `PEA_GAP_FINGERPRINT_V1`.

## G-05 — Worker topology lock (**1C — pre-locked**)

- **Already decided:** [`ADRs/ADR-011-worker-topology.md`](docs/sdd/panelin-evolution-architect/ADRs/ADR-011-worker-topology.md) — do not reopen.
- M0 executor must: cite ADR-011 from SDD §8 + §10; add brief **C4Component** in SDD §6 (GapIngest → Outbox → PeaWorker → Dedupe → Preflight → ArchitectRuntime → Critic → PacketStore).
- OpenAPI may document `POST /api/pea/worker/tick` as **x-deferred** (Scheduler escalation); not required to implement in M0.

## G-06 / G-07 / G-12 — Mark closed (no redesign)

In `audit/GAP-PLAN.md`, set status **closed** with evidence pointers:

- G-06 → SDD §6.4d + ADR-009
- G-07 → SDD §6.4c + ADR-010
- G-12 → EVOLUTION-PROPOSAL §6 + Module 0 A′ locked

## Audit refresh

Re-run quality auditor (Q0–Q4):

- Update `audit/SCORECARD.json` — target composite **≥90**, `"pass": true`, `"sdd_version": "1.2"`.
- Update `audit/GAP-PLAN.md` — P0 G-01..G-04 closed; P1 G-05, G-06, G-07, G-11, G-12 closed or waived with evidence.
- Update `audit/AUDIT.md` — human summary of new score and remaining P2 (G-09 live-probe, G-10 PII denylist).
- Update `audit/IDEAL-TARGET.md` checkboxes for completed artifacts.

## PROJECT-STATE

Append under **Cambios recientes** (Spanish, one line):

`PEA M0: contratos P0 (schemas, DDL, OpenAPI, checklist, fingerprint) + auditor ≥90 — Spec recreation-ready; runtime M1+ pendiente.`

# Success Criteria

1. All deliverable files exist at specified paths and cross-reference SDD v1.2 without contradiction.
2. `audit/SCORECARD.json` shows `"composite"` (rounded) **≥ 90** and `"pass": true`.
3. GAP-PLAN: **G-01, G-02, G-03, G-04** marked closed with artifact links; **G-05, G-06, G-07, G-11, G-12** closed or waived with evidence.
4. JSON Schemas validate as well-formed draft 2020-12 (lint or `ajv compile` if available).
5. SQL file is syntactically valid PostgreSQL and covers all §9.7 tables.
6. OpenAPI parses (optional: `npx @redocly/cli lint` if available).
7. RECREATION-CHECKLIST reflects actual repo state (no false [x]).
8. SDD still documents `PEA_*=0` prod default; no runtime code added under `server/lib/pea/`.
9. PROJECT-STATE Cambios recientes line present.

# Operational Anchors

- **Source hierarchy:** SDD v1.2 + Q&A EVOLUTION-PROPOSAL §6 > IMPLEMENTATION-GUIDE > audit artifacts > chat memory.
- **State labeling:** Tag new doc claims `CONFIRMED` / `TARGET` / `UNKNOWN` consistent with SDD discipline.
- **Triangulation:** Cross-check schemas against SDD §6 tables, §9.7 persistence, and existing contract seals.
- **Read-only zones:** Do not modify master price sheets, fiscal data, or production secrets.
- **Stop rule:** When composite ≥90 and success criteria pass — **stop**. Do not start M1. Human pipes next goal or runs IMP-PEA-02.

# Open Items

- [CONFIRMED: Worker topology 1C — ADR-011 accepted 2026-08-09]
- [ASSUMPTION: OpenAPI stubs L3 routes as 403 `not_enabled` rather than omitting them | verify preference]
- [ASSUMPTION: DDL lands under `server/migrations/pea/` and is **not** auto-applied to prod in this goal | verify before any migrate run]
- [ASSUMPTION: G-08 evidence path:line citations can remain partial if composite ≥90 without live-probe G-09 | acceptable P2 deferral]
- [ASSUMPTION: C4Component addition is a compact mermaid/table in SDD §6 — not a separate diagram file unless auditor requires]

# Execution order (recommended)

1. Read SDD §6, §9.7, existing contracts, GAP-PLAN, SCORECARD.
2. G-11 fingerprint → G-01 schemas (fingerprint fields depend on spec).
3. G-02 DDL aligned to schemas.
4. G-03 OpenAPI referencing schemas.
5. G-04 checklist; G-05 worker ADR + SDD component note.
6. Close G-06/G-07/G-12 in GAP-PLAN; SDD patch citations.
7. Re-run auditor → update SCORECARD/AUDIT/IDEAL-TARGET.
8. PROJECT-STATE line → verify success criteria → stop.
