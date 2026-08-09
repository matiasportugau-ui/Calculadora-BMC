# Contract — PEA Analysis Budget Policy

**Seal:** `PEA_ANALYSIS_BUDGET_POLICY_V1`  
**Status:** Accepted with SDD v1.0  
**Owner:** PEA / AnalysisPreflight

## Verdicts

| Verdict | Tokens (aggregate / iteration) | Reserved USD | Action |
|---------|--------------------------------|--------------|--------|
| AUTO_RUN | ≤ 32000 | ≤ 0.50 | Run triage→explore→plan |
| ASK_INTERNAL | 32001–96000 | 0.51–2.50 | Present estimate; wait |
| DECOMPOSE | > 96000 | > 2.50 | Split; do not run monolith analysis |
| DENY_UNPRICED | any | unknown | Block until priced |

## Estimation must include

1. System prompt  
2. GapEvent payload  
3. Selected logs/traces  
4. Retrieved files, tests, SDD slices  
5. Tool schemas  
6. Max output tokens  
7. Planned tool rounds  
8. Retries  
9. **All models in automatic fallback chain** (`PEA_FALLBACK_RESERVATION_MODE=sum`)  
10. Safety factor `PEA_ESTIMATE_SAFETY_FACTOR` (default 1.20)

## Pilot env defaults

See SDD.md §6.3. Recalibrate after ~100 real runs using p50/p90/p95.
