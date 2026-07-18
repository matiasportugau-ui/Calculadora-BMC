# AGENTS.md — Calculadora BMC / Panelin Dashboard

Single Vite SPA (React 18) + Express 5 API + Postgres. State: `docs/team/PROJECT-STATE.md`.  
**Harness Control System:** `docs/team/harness/README.md` · map · score · PEV.

## Quick Start

| Command | Purpose |
|---------|---------|
| `doppler run -- npm run dev:full` | API :3001 + Vite :5173 with secrets |
| `npm run gate:local` | lint + test + test:api before PR |
| `npm run gate:local:full` | + build |
| `npm run pre-release` | full gate + fitness + goldens + score |
| `npm run harness:score` | HCS composite (need ≥90 for expert complete) |
| `npm run test:contracts` | Live API contracts (API must be up) |

## Rules (failure-earned — see `docs/team/harness/RULE-PROVENANCE.md`)

- ES modules only (`import`/`export`); Node 24.x
- Never hardcode sheet IDs, tokens, prod URLs — config/env only
- Sheets errors: **503** unavailable; never 500 for Sheets-down
- Log with pino in server; no `console.log` in prod paths (cost telemetry JSON OK)
- `BMC_DISK_PRECHECK_SKIP=1` only when disk precheck blocks legitimately
- Before commit: `npm run lint` if `src/` touched; prefer `gate:local`
- After behavior change: append **Cambios recientes** in PROJECT-STATE
- Skills: load only via `docs/team/harness/SKILL-INDEX.md` (progressive disclosure)
- Release: do not ship with silent golden skip — use `pre-release` / `GOLDEN_REQUIRED=1`
- Human gates stay: grants, finanzas unlock, `user_confirmed` writes — never “optimize away”

## Architecture hotspots

- `server/index.js` mounts `/api`; calc in `routes/calc.js`
- AI: `server/lib/agentCore.js` + `assistantRegistry.js` + `costTelemetry.js`
- Calculator UI: `src/components/PanelinCalculadoraV3_backup.jsx` (canonical)

## Do Not

- Commit `.env` / credentials
- `npm audit fix --force`
- Force-push main or `rm -rf` destructive paths from agent loop (PreToolUse deny)
- Modify PROJECT-STATE without Cambios recientes
- Disable ASSISTANTS_ACTIVE / human gates to green a smoke

## Before non-trivial work

1. `docs/team/PROJECT-STATE.md`  
2. This file + `docs/team/harness/HARNESS-MAP.md`  
3. Role knowledge under `docs/team/knowledge/` if applicable  
