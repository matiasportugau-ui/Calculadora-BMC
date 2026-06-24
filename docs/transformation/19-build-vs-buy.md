# 19 — Build vs Buy Analysis

**Program:** EXPORT_SEAL::OMNICRM_AUTONOMOUS_TRANSFORMATION_PROGRAM_V2  
**Date:** 2026-06-22

---

## 1. Evaluation criteria

| Criterion | Weight |
|-----------|--------|
| MercadoLibre support | 25% |
| AI potential / agentCore reuse | 20% |
| Flexibility (calculator, Sheets, WA Pro) | 20% |
| Long-term fit (BMC Uruguay ops) | 15% |
| Operational complexity | 10% |
| Cost (3-year TCO) | 10% |

---

## 2. Options compared

### Option A: Current OmniCRM vision (BUILD on calculadora-bmc)

Evolve existing stack per transformation package.

### Option B: Chatwoot (open source + hosted)

Omnichannel inbox; self-host or cloud.

### Option C: Zendesk

Enterprise support suite; Sunshine conversations.

### Option D: HubSpot CRM

Full CRM + marketing; conversation inbox via integrations.

### Option E: Intercom

AI-first customer messaging; Fin AI agent.

---

## 3. Score matrix (1–5 scale)

| Criterion | A Build | B Chatwoot | C Zendesk | D HubSpot | E Intercom |
|-----------|---------|------------|-----------|-----------|------------|
| ML support | 5 | 2 | 2 | 2 | 1 |
| AI potential | 5 | 3 | 3 | 4 | 5 |
| Flexibility | 5 | 3 | 2 | 2 | 2 |
| Long-term fit | 5 | 3 | 3 | 3 | 2 |
| Ops complexity | 3 | 3 | 4 | 4 | 4 |
| Cost (3y TCO) | 4 | 4 | 2 | 2 | 2 |
| **Weighted** | **4.55** | **2.75** | **2.65** | **2.70** | **2.65** |

**Note:** Cost scores use **ASSUMPTION_REQUIRED** estimates below.

---

## 4. MercadoLibre support (decisive)

| Product | ML native integration |
|---------|----------------------|
| **Build** | **IMPLEMENTED** — OAuth, webhook, ml-crm-sync, Answers API |
| Chatwoot | No native ML; custom API bridge required |
| Zendesk | No native ML LATAM marketplace focus |
| HubSpot | No ML |
| Intercom | No ML |

**Evidence:**
- Source: `docs/discovery/09-scorecard.md` §MercadoLibre 75
- Reasoning: ML is production-grade in current repo; buy options need full rebuild of ML path

---

## 5. AI potential

| Product | Assessment |
|---------|------------|
| **Build** | agentCore + RAG + training KB + calc tools — unique to BMC |
| Chatwoot | Captain AI add-on; separate from calculator |
| Zendesk | AI agents; generic |
| HubSpot | Breeze AI; CRM-centric |
| Intercom | Strong Fin; best-in-class chat AI but no calc/Sheets |

**Decision alignment:** ADR-004 reuse agentCore — buy would abandon sunk AI investment.

---

## 6. Cost comparison **ASSUMPTION_REQUIRED**

Assumptions: 3 operators, ~500 conversations/month, 3-year horizon, USD.

| Option | Year 1 | Year 2–3/yr | 3y TCO | Notes |
|--------|--------|-------------|--------|-------|
| **Build** | $60k eng + $3k infra + $2k AI | $30k eng/yr | **~$128k** | 0.5 FTE maintenance after launch |
| Chatwoot self-host | $20k eng + $5k infra | $15k/yr | ~$75k | ML bridge extra $20k+ |
| Chatwoot cloud | $7k–15k/yr seats | same | ~$36k | ML still custom |
| Zendesk | $20k–50k/yr | same | ~$120k | Per agent pricing |
| HubSpot | $15k–40k/yr | same | ~$105k | CRM bundle |
| Intercom | $20k–60k/yr | same | ~$140k | AI seats premium |

**Build TCO higher in year 1** but includes ML + calculator + Sheets integration that buy options lack or need custom SIs.

---

## 7. Operational complexity

| Option | Complexity |
|--------|------------|
| **Build** | Single Cloud Run + Postgres + Vercel — team knows stack |
| Chatwoot | +1 service; Redis/Postgres; upgrade path |
| Zendesk/HubSpot/Intercom | Vendor ops low; **integration ops high** for BMC stack |

---

## 8. Long-term fit

BMC requirements unique to build path:

- Cotización via calculadora-bmc + col AH quote link
- CRM_Operativo Sheets as finance bridge
- WA Pro quotes/runner/consent
- Uruguay/LATAM ML marketplace
- Panelin training KB and agent tools

No commercial product covers this without heavy customization ≈ build anyway.

---

## 9. Hybrid options considered

| Hybrid | Verdict |
|--------|---------|
| Chatwoot inbox + BMC API | Rejected — dual UI; ML bridge cost |
| wacrm fork for WA only | **Deferred** ADR-010 — borrow UX only if needed |
| HubSpot deals + BMC inbox | Rejected — Sheets authority conflict |

---

## 10. Recommendation

**BUILD the OmniCRM layer** on calculadora-bmc per transformation package.

**Rationale:**
1. ML integration is production — irreplaceable without rewrite
2. agentCore + calculator coupling is strategic differentiator
3. Sheets CRM_Operativo remains finance bridge — buy CRM duplicates
4. Weighted score highest on flexibility + ML + AI
5. Evolution path lower risk than migration to SaaS

**Revisit buy** if: team capacity <0.25 FTE for 6+ months OR omni program fails G2 gate twice.

---

## 11. Self-critique

| Assumption | Risk if wrong |
|------------|---------------|
| Eng cost $60k Y1 | Underestimate → extend timeline not switch buy |
| ML remains strategic | If BMC exits ML, Chatwoot viable |
| No compliance mandate for certified SaaS | Regulated industry could favor Zendesk |

---

## References

- [WACRM-FORK-DECISION.md](../team/WACRM-FORK-DECISION.md)
- [08-omni-gap-analysis.md](../discovery/08-omni-gap-analysis.md)
- [ADR-001](adrs/ADR-001-omni-core.md)
