# GAP-PLAN — Calculadora de Fletes BMC — 2026-07-19

## Score actual: 72/100 → Target: 100 (pass ≥90)

## Summary

Strong commercial rules and solid C4/sequence, but **schema drift** (Domain Rules stole §7–8 slots) and **missing Deployment View** block pass. Evidence is weak: no path citations, and FX is documented as BROU while code uses `dolarapi_uy`. Closing P0/P1 doc patches should lift composite into the 90s without code changes.

| ID | Dimensión | Gap | Severidad | Acción | Artefacto | Esfuerzo | Owner |
|----|-----------|-----|-----------|--------|-----------|----------|-------|
| G-SCHEMA-01 | schema_completeness | §8 Deployment View absent | P0 | Add §8: Vercel SPA ship, no new service, test cmds, FX failure | SDD §8 | S | reverse-engineer |
| G-SCHEMA-02 | schema_completeness | Sections renumbered vs SCHEMA-CONTRACT (§7 Domain Rules, Data Flow as §8, Glossary §13) | P0 | Renumber 1–12; move Domain Rules → Appendix A; Glossary → §12 | SDD whole | M | evolution-loop |
| G-SCHEMA-03 | schema_completeness | §6 title not `AI Architecture`; N/A nested under Component View | P1 | Rename §6 to AI Architecture (N/A) + move motor table to §5.1 or Appendix B | SDD §5–6 | S | evolution-loop |
| G-EVID-01 | evidence_grounding | No path:line / CONFIRMED tags for shipped modules | P0 | Evidence index + cite `fleteEngine.js`, `cargoPacking.js`, `FleteCotizarPanel.jsx`, `brouFx.js`, `tests/fleteEngine.test.js`, `TARIFAS_LOGISTICAS` | evidence/ + SDD | M | reverse-engineer |
| G-EVID-02 | evidence_grounding | FX claimed BROU; runtime `uy.dolarapi.com` / `dolarapi_uy` | P0 | Document actual FX provider; ADR or constraint update; keep “BROU intent” as product goal if still desired | SDD §2/§3/ADR | S | human + reverse-engineer |
| G-REC-01 | recreation_sufficiency | DoD checkboxes unchecked despite implemented-draft | P1 | Tick verified DoD items from tests/prod smoke; leave open only real gaps (Costa −10% TBD, locality map) | SDD §12→Appendix / DoD | S | reverse-engineer |
| G-REC-02 | recreation_sufficiency | No RECREATION-CHECKLIST.md | P1 | Add checklist: run tests, open wizard Flete, Cotizar Maldonado→280, FX fail path | `docs/sdd/calculadora-fletes/RECREATION-CHECKLIST.md` | S | reverse-engineer |
| G-C4-01 | c4_fidelity | `/logistica` as System_Ext vs internal module | P2 | Redraw L1/L2: packing lib internal; optional Person/System for PDF only | SDD §2/§5 | S | architect |
| G-ADR-01 | adr_quality | ADRs lack Alternatives; no FX-source ADR | P1 | Add alternatives to ADR-001/002; ADR-007 FX provider | SDD §10 | S | architect |
| G-XCUT-01 | crosscutting_wa | Thin obs/PII/deploy-coupling notes | P2 | One paragraph each on destino PII in logs + tariff-change deploy | SDD §9 | S | evolution-loop |
| G-EVO-01 | evolution_readiness | `status: Draft` vs shipped reality | P1 | Set `As-Built Draft` or `As-Built`; sync PROJECT-STATE pointer to audit | frontmatter | S | human |
| G-OPEN-01 | recreation_sufficiency | Open Q: Costa −10% full truck / locality map / 12–14 m cost | P2 | Keep open; track in audit Open Items until commercial decide | SDD §14 / backlog | L | human |

## Orden de cierre (PEV)

1. **P0:** G-SCHEMA-01, G-SCHEMA-02, G-EVID-01, G-EVID-02  
2. **P1 until ≥90:** G-SCHEMA-03, G-REC-01, G-REC-02, G-ADR-01, G-EVO-01  
3. **P2 optional:** G-C4-01, G-XCUT-01, G-OPEN-01  

## Re-score trigger

After P0 closure (schema renumber + deploy + evidence + FX truth), re-run `/sdd-quality-auditor`.

## Handoff

- Doc-only patches → `sdd-evolution-loop` / reverse-engineer.  
- If commercial wants official BROU API (not dolarapi) → product + small code change (out of auditor scope).  
- Dropbox freight corpus audit is a **separate** SDD/goal (was missing on prior branches); not required to pass this SDD.
