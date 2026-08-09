# Role

PEA **M3+M4 orchestrator** — Execute M3 platform harden then M4 staging/implement in one session. Preserve `PEA_*=0` prod default.

# Context

[CONFIRMED: MVP L0–M2c complete in repo.]

[CONFIRMED: Roadmap — M3 (04/04b/05) then M4 (10/11/12/13 partial).]

Working directory: `/Users/matias/calculadora-bmc`.

# Goal

Close remaining PEA milestones M3 and M4 with offline tests green, PROJECT-STATE updated, no prod enablement.

# Execution order

1. M3 — Principal, SideEffectRegistry, doom-loop, PEA route authz
2. M4 — `/api/environment`, staging guard, replay, manual L3 implementer
3. `npm run test:pea` + PROJECT-STATE

# Stop rule

Do not deploy staging Cloud Run or enable prod PEA flags in this run.
