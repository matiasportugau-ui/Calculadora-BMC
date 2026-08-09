# Role

PEA **live phase 2** — IMP-PEA-10 staging topology (T13).

# Goal

Provision isolated staging per `evidence/staging-topology-runbook.md`.

# Done when

- `panelin-calc-staging` + staging Postgres exist
- Migrations 001–003 applied on staging DB
- `GET /api/environment` shows `staging: true`
- `npm run pea:staging-check` passes with `PEA_STAGING_MODE=1`
- 48h soak documented (worker, no errors)
- Human: infra cost approved

# Verify

```bash
BMC_API_BASE=<staging-url> npm run test:contracts
BMC_API_BASE=<staging-url> npm run pea:live-probe -- --markdown
```

# OUT

Prod flag flip
