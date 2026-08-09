# Ideal 100% — PAOS

## Current re-audit: **97** (2026-07-24T12:43:59Z)

Previous: **98** (2026-07-24T12:16:41Z). Drop is documentation drift vs shipped G2 + prod image lag surface, not a schema regression.

## What 100% means for *this* system

A recreation-ready hybrid Spec where:

1. **As-built CONFIRMED** covers every shipped G2 module (ledger, SM, eval+money guard, promote, workspace gate, routes, tests) with path:line.  
2. **TARGET** only remains for true P1 product (canary % Fast Loop, USER_OVERRIDE schema, privacy productization) and legal retention.  
3. **Deploy** pin includes: service `panelin-calc`, flags, migrations, and **verified** `GET /api/paos/health` → 200 with `enabled` reflecting env.  
4. **OpenAPI** matches shipped routes (including `/api/paos/health`, evaluate, approve modes).  
5. **ADRs** stay Accepted; no fine-tune; dual-loop inviolate.  
6. **Risks** reflect residual only (flags off, canary not wired, legal).  
7. **Evidence** stubs replaced by citable rows (no 1-line placeholders).

## Residual to 100 from 97

| Step | Delta (est.) | Item |
|------|-------------|------|
| G-DOC-01 narrative sync | +1 | TARGET→CONFIRMED shipped G2 |
| G-DOC-02 companions | +0.5–1 | checklist, OpenAPI, evidence stubs |
| G-DOC-03 risk refresh | +0.25 | residual-only risks |
| G-DEPLOY-01 + §8 note | +0.5 | health 200 or explicit blocked note with run id |
| Product P1 (06–08) | optional | not required for SDD 98–99 |
| G-LEGAL | optional | 100 polish |

## Acceptance for “docs done”

- Composite **≥90** (met)  
- User often wants **≥98** → close G-DOC-01..03 (+ optional deploy note) via `/sdd-evolution-loop` or reverse-engineer patch  
- Product P1 stays IMPLEMENTATION-GUIDE backlog
