# Ideal 100% target — calculadora-bmc

What a perfect recreation-grade SDD would add beyond the current pass (≥90).

## Schema & structure (already near-ideal)

- [x] Sections 1–12 + as-built frontmatter
- [x] C4 L1/L2 + primary sequences
- [x] ADRs with alternatives

## Recreation completeness (to close residual)

1. **Runbook appendix** — one-page “day-0 bootstrap” with exact `doppler run` + migrate order + first smoke.
2. **Per-assistant matrix** — table of all `ASSISTANTS` keys (`canales`, `panelin`, `email`, `wa`, `ml`, `wolfboard`, `seam`) × enable env × UI surface.
3. **Postgres backup / RPO** — CONFIRMED platform note (Cloud SQL or managed) once ops documents schedule.
4. **C4 Level 3 (optional)** — component diagram for `agentCore` tool loop only (not full monorepo).
5. **Threat model one-pager** — STRIDE lite for webhooks + JWT + Sheets write paths.
6. **Golden quote fixture** — single fixed quote JSON hash as recreation acceptance test.

## AI depth (100 bar)

- Explicit token/cost budgets per assistant key
- Prompt packaging paths listed (`chatPrompts`, training KB file layout)
- Failure modes: provider outage → fallback chain documented with code refs

## Crosscutting (100 bar)

- Capacity numbers (p95 quote PDF latency targets) when measured
- Sustainability: cold-start policy for Cloud Run min instances (if set)

## Pass vs ideal

| Level | Composite | Meaning |
|-------|-----------|---------|
| Pass | ≥90 | Team can rebuild skeleton + integrate primary systems |
| Ideal | 98–100 | Day-0 ops + threat model + golden fixtures + measured SLOs |
