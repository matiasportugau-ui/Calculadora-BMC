# SDD-TARGET — Panelin Evolution Architect (PEA)

> North star. Done when falsifiable. Parent: [`SDD.md`](SDD.md).

| ID | Capability | Done when |
|----|------------|-----------|
| T1 | Dual-loop | Fast Panelin never opens PRs or mutates `pea.*` mid-turn except emit GapEvent |
| T2 | GapEvents | Tool/provider/calc/feedback signals → `pea.gap_events` with fingerprint + occurrences |
| T3 | Mass dedupe |  N identical failures → 1 gap, impact=N; no model call before dedupe |
| T4 | AnalysisPreflight | Every model call blocked without verdict; ledger reservation settled |
| T5 | ArchitectRuntime models | `pea:triage\|explore\|plan\|critic` registered with pricing; DENY_UNPRICED works |
| T6 | Architect L1–L2 | Explore→plan produces versioned EvolutionPacket; no file writes |
| T6b | Threshold | AUTO_RUN skipped when occurrences &lt; N unless severity/human |
| T6c | Lanes A′ | Packet has `primary_lane` H\|K\|C; preference H→K→C enforced in triage rules |
| T6d | Critic | No `ready_for_review` without Critic pass (Spec/golden citation + ratchet) |
| T7 | Grants | L3+ rejected without durable `pea.grants` row; L4/L5 not chat-only |
| T8 | PEA API + console | Auth’d list gaps/packets; approve/reject; request escalate |
| T9 | `pea_explain_gap` | Panelin tool narrates packet; commerce path unblocked |
| T10 | Queue | Outbox + `pea_jobs` SKIP LOCKED survives process restart |
| T11 | Budget isolation | PEA daily USD not drawn from Omni/Panelin chat budget |
| T12 | Principal + SideEffectRegistry | PEA actions fail-closed; unregistered deny (platform shared) |
| T13 | Staging gate | CI/docs prove staging topology before first L3 job in prod path |
| T14 | Ratchet | Accepted packet checklist creates golden and/or sensor and/or provenance row |

## Non-goals

- Fine-tune / weight updates  
- OpenCode on Cloud Run  
- Pub/Sub in MVP  
- Auto-merge without L5 grant  
- Treating Vercel Preview as staging  
- Merging PEA promote into PAOS `learning_candidates` SM  

## Success metrics (pilot)

| Metric | Target |
|--------|--------|
| Time GapEvent → packet (AUTO_RUN) | p50 &lt; 5 min |
| PEA auto spend | ≤ USD 10/day |
| False-dupe rate (manual splits) | Track; &lt; 10% of gaps |
| % packets reviewed / week | &gt; 50% of ready_for_review |
| L3 escalations with grant | 100% of PRs from PEA |
