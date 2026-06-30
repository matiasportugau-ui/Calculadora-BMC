# 21 — Wave Execution Model

**Program:** EXPORT_SEAL::OMNICRM_AUTONOMOUS_TRANSFORMATION_PROGRAM_V2  
**Date:** 2026-06-22

---

## Wave overview

| Wave | Scope | Parallelism | Risk |
|------|-------|-------------|------|
| **WAVE 0** | A0 Governance, L1 Fitness, L2 Principles, M1 SLO, N1 FinOps | 100% parallel | Green |
| **WAVE 1** | A1 Omni Foundation → A2 Identity → A3 Event + `normalizeAndPersist()` | **Sequential** | Yellow |
| **WAVE 2** | Squads WA (B1–B4), ML (C1–C3), Email (E1–E3), Omni API (D1–D3) | **4 squads parallel** | Green |
| **WAVE 3** | Squads AI (E1–E4), Automation (F1–F4), Observability (K1–K4), Reliability (M2–M4) | **4 squads parallel** | Green |
| **WAVE 4+** | Deals (G), Knowledge (H), Agents (I), read/write flips | Mixed | Yellow |

---

## WAVE 1 gate (required before WAVE 2)

- [ ] `npm run omni:migrate` idempotent on staging `DATABASE_URL`
- [ ] `server/lib/omni/types.js` — Zod `OmniInboundEvent`
- [ ] `server/lib/omni/identity/*` — resolveContact + resolveConversation
- [ ] `server/lib/omni/normalizer.js` — `normalizeAndPersist()` + dedup
- [ ] `GET /api/omni/health` → 200 + `schema_version`
- [ ] `npm run gate:local` green

### Mapping WAVE 1 ↔ PR roadmap

| WAVE label | PR roadmap | Notes |
|------------|------------|-------|
| A1 Omni Foundation | A1 | DDL + `omniDb.js` + migrate script |
| A2 Identity Resolution | A3 | resolveContact / resolveConversation |
| A3 Event Model | A2 + core of A4 | Types + normalizer (no event bus yet) |

---

## WAVE 2 — parallel squads

All squads call **`normalizeAndPersist(OmniInboundEvent)`** — no cross-squad file ownership beyond `config.js` flags.

| Squad | PRs | Flag |
|-------|-----|------|
| WhatsApp | B1→(B2∥B3)→B4 | `OMNI_WA_SHADOW_WRITE` |
| MercadoLibre | C1→(C2∥C3) | `OMNI_ML_SHADOW_WRITE` |
| Email | E1→E2→E3 | `OMNI_EMAIL_SHADOW_WRITE` |
| Omni API | D1→D2→D3 (D3 after B1+C1) | — |

### Runtime layout

```
server/lib/omni/
  types.js, normalizer.js, omniDb.js
  identity/resolveContact.js, resolveConversation.js
  adapters/waWebhook.js, waExtension.js, mlCrmRow.js, emailIngest.js, mlOutboundMirror.js
  outbound/waReply.js, mlReply.js
server/routes/omni.js
server/migrations/omni/001_core.sql
scripts/omni-migrate.mjs, omni-backfill-*.mjs
```

### Commands

| Command | Purpose |
|---------|---------|
| `npm run omni:migrate` | Apply omni DDL |
| `npm run omni:backfill-wa` | B3 historical WA |
| `npm run omni:backfill-ml-crm` | C2 Sheets ML rows |
| `npm run omni:backfill-email-crm` | E2 Sheets Email rows |
| `npm run test:omni:parity` | B4 + E3 offline parity |

---

## WAVE 2 exit checklist

- [ ] Shadow flags tested in staging (24h per channel, error rate &lt; 0.1%)
- [ ] Backfill dry-run reports in `.runtime/`
- [ ] `npm run test:omni:parity` green
- [ ] `GET /api/omni/conversations` lists WA + ML + Email threads
- [ ] `npm run gate:local` + `npm run test:contracts` green
- [ ] Prod flags remain **OFF** until operator UAT

---

## WAVE 3 — Intelligence + Platform (parallel)

**Entry:** WAVE 2 shadow-write stable on WA + ML + Email.

| Squad | Items | Flags |
|-------|-------|-------|
| AI | E1–E4 | `OMNI_AI_ORCHESTRATOR_ENABLED` |
| Automation | F1–F4 | `OMNI_AUTOMATION_ENABLED` |
| Observability | K1–K4 | `OTEL_ENABLED` (optional) |
| Reliability | M2–M4 | backfill/reconcile scripts |

Doc pack: [wave-3/README.md](wave-3/README.md)

### Runtime (WAVE 3 additions)

```
server/migrations/omni/002_ai_automation.sql
server/lib/omni/orchestrator/aiWorker.js
server/lib/omni/orchestrator/automationEngine.js
server/lib/omni/orchestrator/bootstrap.js
server/lib/omni/omniMetrics.js
server/lib/omni/trace.js
server/lib/omni/eventBus.js
scripts/smoke-omni.mjs
scripts/wave3-exit-gate.mjs
scripts/omni-reconcile-channels.mjs
```

### Commands

| Command | Purpose |
|---------|---------|
| `npm run omni:migrate` | Apply 001 + 002 DDL |
| `npm run omni:migrate-wa-rules` | F3 wa_rules → omni |
| `npm run smoke:omni` | K4 health + metrics |
| `npm run wave3:exit-gate` | Exit checklist → WAVE 4 |

### WAVE 3 exit checklist

- [ ] `npm run wave3:exit-gate` green (staging)
- [ ] E1+E2 classify + suggest on ingest
- [ ] `GET /api/omni/metrics` → 200
- [ ] M3 ML parity pass
- [ ] F2 automation error rate &lt;10%

---

## WAVE 4 — Deals + Knowledge + Agents (implemented)

**Entry:** WAVE 3 exit gate + E1 live in staging.

| Squad | Scope | Doc |
|-------|-------|-----|
| Deals | F1–F3 + G1–G4 | [wave-4/squad-deals.md](wave-4/squad-deals.md) |
| Knowledge | H1–H4 | [wave-4/squad-knowledge.md](wave-4/squad-knowledge.md) |
| Agents | I1–I4 | [wave-4/squad-agents.md](wave-4/squad-agents.md) |

### Key paths

```
server/migrations/omni/003_deals_knowledge.sql
server/lib/omni/deals/
server/lib/omni/knowledge/
src/components/hub/canales/panels/Omni*.jsx
scripts/omni-reconcile-deals.mjs
scripts/wave4-exit-gate.mjs
```

### Commands

| Command | Purpose |
|---------|---------|
| `npm run omni:migrate` | Apply 001–003 DDL |
| `npm run omni:reconcile-deals` | F3 drift report |
| `npm run wave4:exit-gate` | Exit checklist → WAVE 5 |

### WAVE 4 exit checklist

- [ ] `npm run wave4:exit-gate` green
- [ ] HITL accept/reject E2E staging
- [ ] Reconcile deals drift &lt; 10 rows
- [ ] `VITE_OMNI_INBOX=1` UAT admin cohort

---

## References

- [13-pr-roadmap.md](13-pr-roadmap.md)
- [12-migration-strategy.md](12-migration-strategy.md)
- [ADR-001](adrs/ADR-001-omni-core.md), [ADR-009](adrs/ADR-009-migration-strategy.md)
