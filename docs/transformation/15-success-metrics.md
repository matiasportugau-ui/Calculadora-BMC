# 15 — Success Metrics

**Program:** EXPORT_SEAL::OMNICRM_AUTONOMOUS_TRANSFORMATION_PROGRAM_V2  
**Date:** 2026-06-22

---

## 1. Quality gate scores

Scoring scale (from discovery): 0 Missing · 25 Partial · 50 Functional · 75 Advanced · 100 Production Ready

### Summary table

| Category | Current | Target (W12) | Target (W28) | Gap | Primary recommendation | Effort | Risk |
|----------|---------|--------------|--------------|-----|------------------------|--------|------|
| **Architecture** | 40 | 85 | 98 | omni_* not runtime | Track A–D | 4w | Med |
| **Migration** | 35 | 80 | 95 | No shadow write | ADR-009 phases | 12w | High |
| **Security** | 50 | 90 | 98 | Open routes; SSRF | H1 + H4 | 2w | Med |
| **AI Governance** | 45 | 80 | 95 | No registry/jobs | Track E + ADR-004 | 4w | Med |
| **Observability** | 50 | 75 | 95 | No OTel | H3 + ADR-008 | 3w | Low |
| **Scalability** | 55 | 70 | 90 | Sheets bottleneck | omni read layer | 8w | Med |
| **Maintainability** | 45 | 75 | 92 | Three models | Migration completion | 12w | High |
| **Developer Experience** | 60 | 80 | 95 | Doc drift | docs-sync; contracts | ongoing | Low |
| **Operational Excellence** | 55 | 80 | 95 | No omni smoke | H3 + runbooks | 2w | Low |
| **Business Value** | 65 | 85 | 98 | Fragmented UX | Track G workspace | 6w | Med |

---

## 2. Gaps below 95 — detail

### Architecture (40 → 98)

**Gap:** Omni normalizer, IRE, omni API NOT_FOUND  
**Reason:** Design ahead of implementation  
**Recommendation:** Execute Tracks A–D  
**Effort:** ~4 engineer-months  
**Risk:** Dual-model complexity  

**Evidence:** `docs/discovery/08-omni-gap-analysis.md` P0 gaps

---

### Migration (35 → 95)

**Gap:** No reversible migration path executed  
**Reason:** Greenfield omni layer  
**Recommendation:** Shadow → flip with B4 parity gates  
**Effort:** 12 weeks calendar  
**Risk:** Data drift  

---

### Security (50 → 98)

**Gap:** suggest-response open; SSRF absent  
**Reason:** Historical CRM openness  
**Recommendation:** H1 immediate; SSRF before E3 webhooks  
**Effort:** 1–2 weeks  
**Risk:** Integrator breakage  

---

### AI Governance (45 → 95)

**Gap:** No prompt/model registry; per-channel silos  
**Reason:** Organic AI growth  
**Recommendation:** omni_ai_jobs + registries + HITL  
**Effort:** 3 weeks  
**Risk:** Cost  

---

### Observability (50 → 95)

**Gap:** No distributed trace; no omni metrics  
**Reason:** pino sufficient for monolith v1  
**Recommendation:** Correlation IDs + /api/omni/metrics + OTel Phase 2  
**Effort:** 2–3 weeks  
**Risk:** PII in traces  

---

## 3. Operational KPIs

| KPI | Baseline | W12 target | W28 target |
|-----|----------|------------|------------|
| Ingest success rate | N/A | >99.9% | >99.95% |
| Ingest p95 latency | N/A | <500ms | <300ms |
| WA omni message parity | N/A | >99.99% | >99.999% |
| Duplicate ingest rate | N/A | <0.01% | <0.001% |
| AI suggest accept rate | ~**ASSUMPTION_REQUIRED** | >40% | >55% |
| AI cost USD / accepted suggest | N/A | <$0.05 | <$0.03 |
| Automation failure rate | N/A | <2% | <0.5% |
| Deal Sheets reconcile drift | N/A | <10 rows/night | 0 rows |
| Omni inbox MTTR | N/A | <30min | <15min |

---

## 4. Business KPIs

| KPI | Baseline | Target |
|-----|----------|--------|
| Operator channel switches / ticket | ~3 **ASSUMPTION_REQUIRED** | 1 (omni workspace) |
| Mean time to first response | Track from Sheets | -20% W28 |
| Cotización → quote link conversion | col AH fill rate | +15% |
| Pipeline visibility | Sheets manual | Real-time kanban |
| Cross-channel customer recognition | 0% auto | >80% WA+ML overlap |

---

## 5. AI KPIs

| KPI | Measurement |
|-----|-------------|
| Classification accuracy | Golden set eval >85% |
| Suggest latency p95 | <8s |
| Human override rate | Track reject/total |
| Prompt version regression | Block flip if >5% drop |
| RAG hit rate (chat) | Separate from omni v1 |

---

## 6. Support KPIs

| KPI | Target |
|-----|--------|
| P0 omni incidents / month | 0 at W12 |
| Rollback executions | ≤1 per quarter |
| Operator training time (omni inbox) | <2h |

---

## 7. Reliability SLOs

| SLO | Target |
|-----|--------|
| Omni API availability | 99.9% |
| Webhook processing (legacy path) | 99.95% |
| Error budget | 43min/month |

---

## 8. Security KPIs

| KPI | Target |
|-----|--------|
| Open CRM endpoints | 0 at W4 |
| SSRF blocks logged | 100% blocked attempts |
| Failed auth on /api/omni/* | 100% deny |
| Secrets in code scan | 0 |

---

## 9. Developer experience KPIs

| KPI | Target |
|-----|--------|
| gate:local pass rate on omni PRs | 100% |
| test:contracts omni routes | 100% covered at D1 |
| Doc drift incidents | 0 post docs-sync protocol |
| PR median LOC | <400 |

---

## 10. Measurement tooling

| KPI area | Tool |
|----------|------|
| Operational | `/api/omni/metrics`, Cloud Monitoring |
| Business | Sheets analytics + omni_deals export |
| AI | omni_ai_jobs aggregates |
| Reliability | smoke:prod + smoke-omni |
| Security | npm audit; manual pen test quarterly |

---

## References

- [09-scorecard.md](../discovery/09-scorecard.md)
- [10-observability-model.md](10-observability-model.md)
- [01-executive-summary.md](01-executive-summary.md) §8
