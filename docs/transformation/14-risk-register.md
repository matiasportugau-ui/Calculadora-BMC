# 14 — Risk Register

**Program:** EXPORT_SEAL::OMNICRM_AUTONOMOUS_TRANSFORMATION_PROGRAM_V2  
**Date:** 2026-06-22

---

## 1. Risk register (program-level)

| ID | Risk | Likelihood | Impact | Detection | Mitigation | Recovery | Owner |
|----|------|------------|--------|-----------|------------|----------|-------|
| R-01 | Dual-write drift wa/omni | High | High | Nightly reconcile; count alerts | Idempotency keys; B4 parity | Flag off; backfill fix | Platform |
| R-02 | False contact merge | Medium | High | Merge rate alert; review queue | Confidence thresholds; soft-merge | Un-merge from audit | Identity |
| R-03 | AI cost overrun | Medium | Medium | Daily cost metric vs budget | Rate limits; skip spam classify | Disable orchestrator | AI |
| R-04 | Sheets/omni monto conflict | Medium | High | Reconcile job delta | Sheets authority 90d | Manual finance reconcile | Deals/Finance |
| R-05 | Webhook handler regression | Medium | High | Error rate alert; smoke | omni failure non-blocking to legacy | Rollback shadow flag | Channels |
| R-06 | suggest-response auth break | Low | Medium | Integrator reports | 30d deprecation; document token | Emergency auth flag off | Security |
| R-07 | Meta cm-0 delay | High | Low | Human gate tracker | Phase 5 conditional; IG/FB partial OK | N/A | Matias |
| R-08 | PR scope creep | High | Medium | LOC review; >500 = draft | Tracks A–H atomic PRs | Split PR | TPM |
| R-09 | Postgres shared pool overload | Low | High | Connection pool metrics | Batch backfill throttle | Scale Cloud Run memory | Platform |
| R-10 | Doc/code drift continues | Medium | Medium | docs-sync agent | PROJECT-STATE protocol | Transformation pack as canonical | Docs |

---

## 2. Architectural failure analysis — Top 10

### F-01: Normalizer throws → Meta webhook 500 → message loss perception

| Field | Value |
|-------|-------|
| **Likelihood** | Medium |
| **Impact** | Critical |
| **Detection** | Webhook 5xx rate; Meta retry logs |
| **Mitigation** | Legacy write succeeds first; omni in try/catch non-blocking in P1 |
| **Recovery** | Disable shadow; Meta retries populate wa_* |
| **Owner** | Platform |

---

### F-02: Idempotency key collision across channels

| Field | Value |
|-------|-------|
| **Likelihood** | Low |
| **Impact** | High |
| **Detection** | Duplicate metric anomaly |
| **Mitigation** | Channel prefix in key: `wa:msg:`, `ml:question:` |
| **Recovery** | Fix key builder; re-backfill affected range |
| **Owner** | Omni Core |

---

### F-03: Automation infinite loop

| Field | Value |
|-------|-------|
| **Likelihood** | Low |
| **Impact** | High |
| **Detection** | automation executions spike |
| **Mitigation** | Max actions/event; no self-triggering rules |
| **Recovery** | Global disable rules |
| **Owner** | Automation |

---

### F-04: AI suggest sent without HITL

| Field | Value |
|-------|-------|
| **Likelihood** | Low |
| **Impact** | Critical (brand/revenue) |
| **Detection** | Audit: outbound without suggestion.accepted |
| **Mitigation** | Reply API requires accepted suggestion or manual compose |
| **Recovery** | Apology workflow; disable auto-send |
| **Owner** | AI + Workspace |

---

### F-05: Sheets sync writes wrong row

| Field | Value |
|-------|-------|
| **Likelihood** | Medium |
| **Impact** | High |
| **Detection** | Reconcile CRM row vs omni properties.crm.row |
| **Mitigation** | Row id immutable; verify before PATCH |
| **Recovery** | AUDIT_LOG + manual Sheets fix |
| **Owner** | Deals |

---

### F-06: JWT grant missing on new omni routes

| Field | Value |
|-------|-------|
| **Likelihood** | Medium |
| **Impact** | Critical (PII leak) |
| **Detection** | Security review; contract tests without auth → 401 |
| **Mitigation** | requireGrant on all /api/omni/* in D1 PR template |
| **Recovery** | Hotfix middleware |
| **Owner** | Security |

---

### F-07: Backfill duplicates inflate inbox

| Field | Value |
|-------|-------|
| **Likelihood** | Medium |
| **Impact** | Medium |
| **Detection** | B4 parity fail |
| **Mitigation** | ON CONFLICT DO NOTHING; dry-run first |
| **Recovery** | Delete source=backfill duplicates |
| **Owner** | Platform |

---

### F-08: Event bus subscriber crash mid-flight

| Field | Value |
|-------|-------|
| **Likelihood** | Medium |
| **Impact** | Medium |
| **Detection** | omni_ai_jobs pending backlog |
| **Mitigation** | Jobs persisted before async work; retry |
| **Recovery** | Replay dead jobs |
| **Owner** | AI |

---

### F-09: VITE_OMNI_INBOX enabled globally with bad data

| Field | Value |
|-------|-------|
| **Likelihood** | Low |
| **Impact** | High |
| **Detection** | Operator UAT; support tickets |
| **Mitigation** | Admin cohort first; per-user flag Phase 3 |
| **Recovery** | Flag off globally |
| **Owner** | Workspace |

---

### F-10: Provider API key leak via prompt injection

| Field | Value |
|-------|-------|
| **Likelihood** | Low |
| **Impact** | Critical |
| **Detection** | Anomaly in agent responses |
| **Mitigation** | No secrets in prompts; tool sandbox |
| **Recovery** | Rotate keys; patch prompt |
| **Owner** | Security |

---

## 3. Self-critique notes

| Weakness | Revision |
|----------|----------|
| Meta channels assumed Phase 5 | Explicit cm-0 gate; scores stay 25 until then |
| Cost estimates unvalidated | Marked ASSUMPTION_REQUIRED in exec summary |
| wacrm fork tension | Resolved ADR-010; risk R-11 added below |

### R-11: wacrm fork pursued in parallel

| Mitigation | ADR-010 defer; gate at week 6 on G2 parity |

---

## References

- [10-architecture-review.md](../discovery/10-architecture-review.md) §13
- [09-security-model.md](09-security-model.md)
- [17-technical-debt.md](17-technical-debt.md)
