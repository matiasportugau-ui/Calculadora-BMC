# Ideal 100% — BMC Envíos (Cotizar flete + /logistica)

## Target composite: 100 (pass ≥90)

## System class

**In-monorepo operational module** (React SPA surfaces + pure-JS domain kernel) for Uruguay panel freight quote + truck packing ops — not a standalone courier SaaS.

## Must-have artifacts

| Artifact | Ideal |
|----------|--------|
| `docs/sdd/bmc-envios/SDD.md` | Schema 1–12; clear **As-Built** vs **Target** labels; status reflects truth |
| `TARGET.md` | DoD U1–U7 with checkbox state |
| `DESIGN-UI.md` | Liquid Glass matrix (present) |
| `RECREATION-CHECKLIST.md` | 100% closed or justified N/A |
| `evidence/INDEX.md` | Critical claims → path:line CONFIRMED |
| `diagrams/` (optional) | Mermaid sources if split |
| Code alignment | Dual `placeCargo` resolved **or** SDD status stays “partial as-built” with U1 open |

## Section-specific ideal

### §1 Goals
SMART goals + explicit “two surfaces, one kernel” outcome; link to TARGET DoD.

### §2 Context
C4 L1 actors match production; every external interface: direction, protocol, auth; maps marked roadmap only.

### §3 Constraints
Stack locks, legal packing numbers, FX truth (dolarapi vs BROU label), deploy inherit platform.

### §4 Strategy
Unification-first; CBM/TSP deferred with ADR.

### §5 Containers
Quote UI, Ops UI, Domain Kernel (packing, quote, bridge, FSM map), constants, FX, localStorage; optional PG only if P5 shipped.

### §6 AI
N/A with evidence (grep: no LLM in flete/packing path) — **already ideal**.

### §7 Data flows
As-built sequences for quote + ops; target bridge sequence marked Target; FSM map STOP_STATUS ↔ formal states.

### §8 Deployment
“Same Vercel SPA + Cloud Run API as calculadora-bmc” + pointer to platform SDD §8; env var **names** for any envíos flags; how to run local `dev:full` and open `/logistica` + wizard Flete.

### §9 Crosscutting
Auth roles for logistica; localStorage PII; FX fallback; quote audit log shape; print CSS for remito.

### §10 ADRs
Every Accepted ADR has alternatives; Proposed ADRs have exit criteria to Accepted.

### §11 Risks
Dual packing remains High until U1 closed; risk table dates last verified.

### §12 Glossary
Operator + agent terms (ENV, zona, filas, chargeable weight deferred).

## Acceptance test

> A developer (or coding agent) with repo access can: (1) run quote freight unit tests, (2) open `/logistica` and wizard Flete 10/11, (3) explain packing/tariff rules, (4) implement U1 single packing SoT **or** U2 bridge from SDD alone in **&lt; 1 day** without inventing zones or vehicle classes.

## Distance from current (2026-08-04 post evolution-loop)

| Ideal item | Now |
|------------|-----|
| Schema 1–12 | Yes (98) |
| Recreation checklist | **Yes** |
| Evidence folder | **Yes** INDEX E-01–E-23 |
| Single packing SoT in code | **No** (U1 OPEN — product) |
| Bridge quote→ops | **No** (U2 OPEN — product) |
| Liquid Glass chrome | **Yes** |
| Composite | **95 pass** → residual to 100 = U1/U2 code |
