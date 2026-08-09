# Role

PEA **live campaign orchestrator** — run oleadas 0→7 in order with PEV quality loops. Do not advance if prior oleada gate is red.

# Context

[CONFIRMED: M0–M4 runtime in repo; `npm run test:pea` in `gate:local`; prod `PEA_*` default OFF.]

[CONFIRMED: Plan — PEA Full E2E Quality (oleadas 0–8).]

Working directory: `/Users/matias/calculadora-bmc`.

# Goal

Execute live campaign to SDD-TARGET T1–T14 with nested verify/fix/re-verify loops.

# Execution order

1. **Phase 0** — `goal-prompt-pea-live-phase0-merge-sensors.md`
2. **Phase 1** — `goal-prompt-pea-live-phase1-live-probe.md`
3. **Phase 2** — `goal-prompt-pea-live-phase2-staging-topology.md`
4. **Phase 3** — `goal-prompt-pea-live-phase3-prod-l2-observe.md`
5. **Phase 4** — `goal-prompt-pea-live-phase4-architect-llm.md`
6. **Phase 5** — `goal-prompt-pea-live-phase5-platform-harden.md`
7. **Phase 6** — `goal-prompt-pea-live-phase6-l3-e2e-staging.md`
8. **Phase 7** — `goal-prompt-pea-live-phase7-prod-ladder.md`

# Stop rule

Oleada N+1 forbidden while oleada N verify loop fails. Human gates (migrate, flags, L5 merge) require Matias approval — document evidence, do not fabricate.

# Verify matrix (each oleada)

`npm run gate:local:full` · `npm run test:pea` · `npm run test:contracts` (when API up) · `npm run smoke:prod` (post prod flip)
