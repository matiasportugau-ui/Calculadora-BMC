# Self-Critique — Transformation Package V2

**Date:** 2026-06-22  
**Scope:** Quality gate on `docs/transformation/` before implementation

---

## 1. Weaknesses identified

| # | Weakness | Mitigation applied |
|---|----------|-------------------|
| 1 | Cost/TCO figures in build-vs-buy are estimates | Marked ASSUMPTION_REQUIRED throughout |
| 2 | Meta IG/FB design ahead of cm-0 gate | Phase 5 conditional in 18-evolution-roadmap |
| 3 | omni message retention/legal not validated | Flagged in 03-domain-model + 09-security |
| 4 | Load/throughput thresholds unmeasured | 500 msg/min marked ASSUMPTION_REQUIRED in ADR-003 |
| 5 | Agent role names may not map 1:1 to humans | 16-domain-ownership uses agent roles as R with Matias as A |

---

## 2. Contradictions resolved

| Conflict | Resolution | Document |
|----------|------------|----------|
| WACRM fork vs evolve canales | Defer fork; evolve canales (Option A) | ADR-010 |
| clientes.* vs omni_contacts merge | Bridge FK, not merge | ADR-001, ADR-002 |
| Sheets vs omni money authority | Sheets-first 90d | ADR-006 |
| New /hub/omni vs /hub/canales | Evolve canales | ADR-010 |
| wa_suggestions vs omni_suggestions | omni_suggestions channel-agnostic | ADR-004, architecture review §12 |

---

## 3. Hidden assumptions catalog

| ID | Assumption | Impact if wrong |
|----|------------|-----------------|
| A1 | Single Cloud Run instance sufficient for v1 | Need outbox + horizontal scale earlier |
| A2 | DATABASE_URL shared pool acceptable | Need connection pool tuning or read replica |
| A3 | 2 FTE available for 12 weeks | Timeline slips; prioritize Tracks A,B,H |
| A4 | Operators accept canales evolution vs new product | UX research needed at G1 |
| A5 | Finance accepts dual-write deals 90d | Longer Sheets authority |
| A6 | GCP Cloud Trace available for OTel | Fall back to pino-only metrics |
| A7 | ML remains strategic channel | Build-vs-buy revisiting |

---

## 4. Migration risks (cross-check)

All migration risks in [14-risk-register.md](14-risk-register.md) trace to:

- [12-migration-strategy.md](12-migration-strategy.md) rollback tables
- [13-pr-roadmap.md](13-pr-roadmap.md) per-PR rollback column
- ADR-009 rollback strategy

**Gap found:** H4 SSRF PR not in original architecture review Track H — added to 09-security and 13-pr-roadmap implicitly via H1 extension. **Recommendation:** Add explicit PR H4 in implementation.

---

## 5. Operational risks (cross-check)

| Risk | Covered in |
|------|------------|
| No on-call rotation defined | 20-operational-readiness ASSUMPTION_REQUIRED |
| smoke:omni not yet scripted | 20-operational-readiness future |
| Prod delete backfill requires approval | RB-OMNI-005 references disk recovery rules |

---

## 6. Evidence coverage

| Area | Evidence source | Coverage |
|------|-----------------|----------|
| Current state | docs/discovery/* | Complete |
| Target normalizer | 10-architecture-review | Complete |
| Runtime omni code | NOT_FOUND (expected) | Documented as gap |
| Build vs buy pricing | External market | ASSUMPTION_REQUIRED |

---

## 7. Revisions made during self-critique

1. Added explicit H4 SSRF note in section 4
2. Confirmed all scores in 15-success-metrics reference discovery baseline
3. Cross-links from README to discovery index verified
4. ADR-010 explicitly references WACRM-FORK-DECISION deferral

---

## 8. Sign-off readiness

| Criterion | Status |
|-----------|--------|
| 20 core documents | Complete |
| 10 ADRs | Complete |
| Evidence blocks on major recommendations | Present |
| ASSUMPTION_REQUIRED marked | Yes |
| No implementation code | Confirmed |
| Quality gate scores | In 01 + 15 |

**Recommendation:** Proceed to ADR approval → Track A1 implementation.

---

## References

- [01-executive-summary.md](01-executive-summary.md)
- [discovery/README.md](../discovery/README.md)
