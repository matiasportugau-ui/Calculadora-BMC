# BMC Implementation Plan & Reporter — Reference

## Report structure (Solution / Coding teams)

```markdown
# BMC Dashboard — Report for Solution & Coding Teams

## Executive summary
1–2 paragraphs: current status, main gaps, top risks.

## Status by module (or wave)
Short table or bullets: Cotizaciones, Operaciones, Finanzas, Ventas, Invoque Panelin, Shell. What works, what is missing.

## Gaps
- Gap 1 (with source: brief or plan step).
- Gap 2.

## Risks
- Risk 1; mitigation.
- Risk 2.

## Handoff summary
- Solution → Coding: what Solution must deliver so Coding can proceed (e.g. approved IA, signed-off flows).
- Coding → Solution: what Coding delivers for Solution to validate (e.g. nav live, endpoints working).
```

## Implementation plan structure (Solution vs Coding)

```markdown
# Implementation Plan — Solution & Coding Teams

## Solution team tasks
| ID | Task | Owner | Depends on | Delivers to Coding |
|----|------|-------|------------|--------------------|
| S1 | Approve IA and section names | Solution | — | IA doc signed off |
| S2 | Sign off Cotizaciones flow | Solution | S1 | Flow spec |
| ... | | | | |

## Coding team tasks
| ID | Task | Owner | Depends on (Solution) | Acceptance |
|----|------|-------|------------------------|------------|
| C1 | Implement shell nav per IA | Coding | S1 | Nav links match IA |
| C2 | Wire /api/cotizaciones | Coding | — | GET returns 200 + data |
| ... | | | | |

## Handoff table
| When Solution delivers | Coding can start |
|------------------------|------------------|
| S1 (IA signed off) | C1 (nav) |
| S2 (Cotizaciones flow) | C3 (Cotizaciones UI) |
| When Coding delivers | Solution can |
| C1 (nav live) | Validate nav in browser |
| ... | ... |
```

Map improvement plan steps (from FULL-IMPROVEMENT-PLAN.md) into Solution vs Coding tasks; preserve order and dependencies.
