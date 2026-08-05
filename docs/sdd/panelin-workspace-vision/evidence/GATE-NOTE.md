# Gate note — Panelin Workspace store goal closeout

**Date:** 2026-08-04  
**Repo:** `calculadora-bmc`  
**Scope:** customers / quotes / files durable store + HTTP API

## Gate exercised

| Gate | Command | Result | Log |
|------|---------|--------|-----|
| Store (domain) | `node --test tests/workspace-store.test.js` | **4/4 pass** | `workspace-store-test.log` |
| HTTP API paths | `node --test tests/workspace-api-store.test.js` | **4/4 pass** | `workspace-api-test.log` |
| Migrate | `npm run workspace:migrate` | Applied (002) | — |

## Full `gate:local` deviation

**Not run for this closeout.**

**Reason (matches original goal plan deviation):**

- Original acceptance criterion 5 allows `gate:local` **or the narrowest existing test script that covers the changed modules**.
- Working tree on this machine carries unrelated dirty changes (WA cockpit, market-intel, paid-media SDD, etc.). Running full `npm run gate:local` (`lint && npm test && test:api`) would mix noise from those surfaces and is slow/disk-heavy.
- Touched modules for this goal are covered by the two workspace tests above against **real Postgres** (`DATABASE_URL`), including authenticated HTTP routes.

## Criterion map

| # | Criterion | Status |
|---|-----------|--------|
| 1 | SDD §1–12 store-centric | ✅ `SDD.md` v1.0 |
| 2 | SCORECARD + GAP-PLAN | ✅ composite **93**, pass |
| 3 | P0 closed via evolution | ✅ GAP-PLAN residual P2 only |
| 4 | Durable CRUD via **API paths** | ✅ HTTP test 4/4 |
| 5 | Gate + evidence | ✅ this note + logs |

## Residual P2 (not blocking goal 100%)

- SPA not fully wired to customers/quotes routes (`panelin-workspace`)
- Superadmin console incomplete
- GCS binary upload pipeline
- Omni/CRM dual SoT bridge

## Reproduce

```bash
cd ~/calculadora-bmc
npm run workspace:migrate
node --test tests/workspace-store.test.js
node --test tests/workspace-api-store.test.js
```
