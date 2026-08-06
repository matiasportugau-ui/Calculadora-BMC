---
title: Hub Finanzas — Recuperación visual pack
version: 1.0
date: 2026-08-06
status: Accepted
source: as-built + feature design
target_path: /Users/matias/calculadora-bmc
---

# SDD: Hub Finanzas Recuperación

## 1. Introduction & Goals

Port the local IAlfred recovery meeting visual (KPI + waterfall + pipeline + sales + obligations) into production Hub at `/hub/finanzas/recuperacion`, behind existing auth + finanzas unlock. Numbers travel as an **authenticated snapshot**, never hard-coded in the Vercel bundle.

| ID | Goal | Priority |
|----|------|----------|
| G1 | Tab Recuperación with local-pack look (dark island) | P0 |
| G2 | GET/PUT snapshot API under `/api/banco` + unlock | P0 |
| G3 | Publish from `~/.ialfred/.../viz/data.json` without redeploy | P0 |
| G4 | No regression Banco / Cash Flow / Proyección | P0 |

## 2. Context (C4 L1)

```
Operator ──► Hub SPA (Vercel) ──► Cloud Run API
                                      │
                    GET/PUT /api/banco/recovery-snapshot
                                      │
                                      ▼
                              Postgres jsonb snapshot
IAlfred (local) ──publish script──► API PUT
Metalog / Sheets ──offline──► IAlfred pack ──► data.json
```

## 3. Containers

| Container | Tech | Role |
|-----------|------|------|
| Hub SPA | React/Vite | `RecuperacionModule` tab |
| API | Express | Snapshot store + unlock |
| DB | Postgres | `finanzas_recovery_snapshots` |
| IAlfred | local | Builds data.json |

## 4. Components

- `FinanzasModule` — adds tab `recuperacion`
- `RecuperacionModule` — dark island + recharts
- `server/lib/finanzasRecoverySnapshot.js` — validate + ensureSchema + CRUD
- `scripts/publish-recovery-snapshot.mjs` — operator publish

## 5. Runtime / data

**Contract:** same as local `viz/data.json` (`kpi`, `sales_monthly`, `pipeline`, `waterfall_usd`, `obligations`, `disclaimers`, `as_of`).

**Auth:** `requireUser({ module: "banco" })` + `requireFinanzasUnlock`. PUT requires `admin` or `superadmin`.

## 6. ADRs

- **ADR-R1:** Snapshot API over embedding private $ in SPA.
- **ADR-R2:** Dark island CSS scoped to `.fr-root` inside light hub.
- **ADR-R3:** recharts (already used by Proyección).

## 7. Crosscutting

- Security: unlock gate; no public route.
- Ops: as_of badge; publish after ledger refresh.
- Honesty: SIN_DATO fields remain null; disclaimers rendered.

## 8–12. Deployment / Risks / Evolution

Deploy API first (table ensure on write), then frontend, then publish snapshot. Stale snapshot risk mitigated by visible as_of. v1.1 may overlay live cash from `/api/banco`.
