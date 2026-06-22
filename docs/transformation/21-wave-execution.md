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
| **WAVE 3+** | Track E AI, G UI, read/write flips, D4 extension | Mixed | Yellow |

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

## References

- [13-pr-roadmap.md](13-pr-roadmap.md)
- [12-migration-strategy.md](12-migration-strategy.md)
- [ADR-001](adrs/ADR-001-omni-core.md), [ADR-009](adrs/ADR-009-migration-strategy.md)
