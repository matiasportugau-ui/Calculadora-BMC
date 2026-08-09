# Role

PEA **live phase 7** — prod autonomy ladder.

# Goal

Progressive prod flags per `evidence/prod-flag-ladder.md` steps 7a–7d.

# Done when

- Each step deployed separately with human approval
- `live-probe.md` refreshed; `smoke:prod` after each step
- Metrics: gaps/day, PEA $/day, % packets reviewed
- Step 7d skipped unless staging native E2E ≥3

# Verify

```bash
npm run smoke:prod
npm run pea:live-probe -- --markdown
```

# Human gate

Matias approves each flag change in GitHub vars + redeploy.
