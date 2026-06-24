# 11 — Testing Strategy

**Program:** EXPORT_SEAL::OMNICRM_AUTONOMOUS_TRANSFORMATION_PROGRAM_V2  
**Date:** 2026-06-22

---

## 1. Principles

1. **Offline-first** — `npm test` and `npm run test:api` gate every PR
2. **Contract stability** — `/api/omni/*` added to `test:contracts` when live
3. **Parity before flip** — no read/write flip without B4-style verification
4. **Feature-flagged** — tests run with flags on/off where applicable
5. **No prod writes in CI** — use test DATABASE_URL or mocked pool

---

## 2. Test pyramid

```mermaid
pyramid
  E2E["E2E smoke (manual + smoke:prod)"]
  Integration["Integration (API + DB)"]
  Contract["Contract (test:contracts)"]
  Unit["Unit (tests/*.js)"]
```

---

## 3. Unit tests

| Area | File pattern | Examples |
|------|--------------|----------|
| OmniInboundEvent Zod | `tests/omniTypes.test.js` | Valid/invalid payloads |
| Idempotency key builder | `tests/omniIdempotency.test.js` | wa:msg:, ml:question: |
| Condition DSL evaluator | `tests/omniAutomationConditions.test.js` | all/any/none |
| Identity normalize E.164 | `tests/omniIdentity.test.js` | Phone formats |
| Merge policy | `tests/omniMerge.test.js` | Survivor selection |

**Gate:** `npm run gate:local` — required every PR.

---

## 4. Contract tests

Extend [scripts/validate-api-contracts.js](../../scripts/validate-api-contracts.js):

| Endpoint | Contract shape |
|----------|----------------|
| `GET /api/omni/health` | `{ ok, schema_version }` |
| `GET /api/omni/conversations` | `{ items[], cursor? }` |
| `GET /api/omni/conversations/:id/messages` | `{ items[] }` |
| `GET /api/omni/deals` | `{ items[] }` |
| `GET /api/omni/metrics` | Prometheus or JSON schema |

**Run:** `npm run start:api` + `npm run test:contracts`

**Evidence:** Existing pattern validates Sheets 503 semantics — omni must follow same error semantics for unavailable DB.

---

## 5. Integration tests

| Suite | Requires | Scope |
|-------|----------|-------|
| `test:omni` (new) | DATABASE_URL + migrations | Normalizer persist + dedup |
| `test:omni-identity` | DATABASE_URL | resolveContact merge |
| `test:omni-ai` | Mock agentCore | Job queue lifecycle |
| `test:wa-pro` | Existing `npm run test:wa-pro` | WA unchanged regression |

Use transaction rollback per test or dedicated `omni_test` schema prefix.

---

## 6. Replay tests

**Purpose:** Verify idempotency and event handler stability.

1. Record golden webhook fixtures: `tests/fixtures/omni/wa_webhook_*.json`
2. POST twice → assert single omni_messages row
3. Replay `message.ingested` event → subscribers no duplicate actions

Tooling: extend ML sim batch pattern (`npm run ml:sim-batch`).

---

## 7. Migration tests

### WA backfill parity (PR B4)

```javascript
// tests/omniWaParity.test.js — conceptual
assert approxEqual(count(wa_messages), count(omni_messages WHERE channel='wa'));
sample 50 chat_ids: last message body hash match;
legacy.crm_sheet_row preserved in conversation.properties;
```

### ML CRM backfill

- Rows with ML origin in Sheets → omni conversation count
- question_id maps to channel_conversation_id

### Rollback test

- Enable shadow → disable → assert wa_* unchanged
- Delete backfill-tagged rows only

---

## 8. Parity tests

| Pair | Assertion |
|------|-----------|
| wa_rules vs omni_automation_rules | Same WA message → same tags/priority |
| suggestResponse vs omni suggest job | Same input → comparable output structure |
| Sheets queue vs omni list API | Same open count ± tolerance during dual-write |
| waEnricher category vs omni classify | Taxonomy mapping table 100% covered |

---

## 9. Load tests

**ASSUMPTION_REQUIRED** tool: k6 or autocannon

| Scenario | Target |
|----------|--------|
| WA webhook burst | 100 req/s 1min; p95 <1s; 0 lost messages |
| Omni list API | 50 concurrent operators; p95 <300ms |
| AI job enqueue | 200 jobs/min without backlog >1000 |

Run against staging Cloud Run before production read flip.

---

## 10. Failure injection tests

| Injection | Expected behavior |
|-----------|-------------------|
| Postgres connection drop mid-TX | Rollback; webhook 500; Meta retries; dedup safe |
| agentCore all providers fail | Job status=failed; retry; no outbound |
| Sheets API 503 | sync_crm action DLQ; ingest still succeeds |
| Duplicate webhook | 200 + duplicate:true; no double automation |
| Invalid HMAC ingest | 401; no DB write |

Chaos: manual staging only v1; automated chaos Phase 3.

---

## 11. PR track mapping

| Track | Required tests |
|-------|----------------|
| A Foundation | omniTypes, omniDb integration |
| B WA | wa parity, replay fixtures |
| C ML | ml crm backfill dry-run |
| D API | contract tests |
| E AI | job queue unit + mock agentCore |
| F Deals | stage machine unit |
| G UI | lint + manual QA checklist |
| H Hardening | auth on suggest-response regression |

---

## 12. CI integration

Add to `.github/workflows/ci.yml`:

```yaml
# Phase 2 — when omni migrations in CI postgres service
- run: npm run omni:migrate
- run: node tests/omniTypes.test.js
```

Until then: offline unit tests only in CI; integration manual staging.

---

## References

- [13-pr-roadmap.md](13-pr-roadmap.md)
- [12-migration-strategy.md](12-migration-strategy.md)
- [AGENTS.md](../../AGENTS.md) — gate:local
