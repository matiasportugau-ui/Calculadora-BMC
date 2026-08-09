# GAP-PLAN — calculadora-bmc SDD

**Baseline:** SCORECARD composite **94** (`pass: true`, min_pass 90)  
**Generated:** 2026-07-19  
**SDD version:** 0.2  
**Evolution iteration:** 2

## Summary

No **P0** gaps. All P1 from iteration 1 closed. Remaining **P2** ideal-100 work only.

## Gaps

| ID | Sev | Dimension | Gap | Owner | Action | Status |
|----|-----|-----------|-----|-------|--------|--------|
| G-AI-01 | P1 | ai_architecture_depth | Assistant key list incomplete in §6 | reverse-engineer | ASSISTANTS table | **closed** (§6.3) |
| G-REC-01 | P1 | recreation_sufficiency | No day-0 migrate+smoke runbook | reverse-engineer | §8.7 bootstrap | **closed** |
| G-EV-01 | P1 | evidence_grounding | Fragile line numbers on mounts | reverse-engineer | Path-stable citations | **closed** |
| G-SEC-01 | P2 | crosscutting_wa | No STRIDE / threat model appendix | architect (optional) | One-page if security review | open |
| G-OPS-01 | P2 | recreation_sufficiency | Postgres backup schedule UNKNOWN | human / ops | Document RPO | open |
| G-C4-01 | P2 | c4_fidelity | No C4 L3 for agent tool loop | reverse-engineer | Optional diagrams/ | open |
| G-GOLD-01 | P2 | recreation_sufficiency | No golden quote hash for recreation | calc specialist | Link validation goldens | open |

## Closed this cycle

| ID | Notes |
|----|-------|
| G-SCHEMA-00 | v0.1 thin draft → v0.2 full sections + ADRs + multi-sequence flows |
| G-AUDIT-00 | Empty `audit/` → SCORECARD + IDEAL + GAP-PLAN + AUDIT |
| G-AI-01 | Assistant registry table (`panelin`…`seam`) |
| G-REC-01 | Day-0 bootstrap §8.7 |
| G-EV-01 | Path-based mount evidence |

## Evolution stop

- pass ≥90: **yes (94)**  
- P0 remaining: **0**  
- Product redesign proposals: `ARCHITECT-IMPROVEMENTS.md` (A1–A6)
