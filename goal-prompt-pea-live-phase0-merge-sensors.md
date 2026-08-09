# Role

PEA **live phase 0** — merge sensors + doc sync.

# Goal

PR-ready PEA with falsifiable CI: `test:pea` in gate + contracts + as-built docs.

# Done when

- `npm run gate:local:full` green
- `npm run test:pea` green (15 files)
- `validate-api-contracts.js` includes PEA routes
- RECREATION-CHECKLIST + SDD Appendix C + PROJECT-STATE updated
- Human: PR merged to main

# Verify

```bash
npm run gate:local:full && npm run test:pea
BMC_API_BASE=http://localhost:3001 npm run test:contracts
```

# Fix loop (max 3 PEV)

Red sensor → minimal fix → re-run full gate above.

# OUT

Prod migrate; `PEA_ENABLED=1` in Cloud Run
