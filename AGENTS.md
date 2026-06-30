# AGENTS.md — Calculadora BMC / Panelin Dashboard

Single Vite SPA (React 18) + Express 5 API + Postgres. Architecture at `docs/bmc-dashboard-modernization/DASHBOARD-INTERFACE-MAP.md`. State at `docs/team/PROJECT-STATE.md`.

## Quick Start

| Command | Purpose |
|---------|---------|
| `npm run dev:full` | API (:3001) + Vite (:5173) via concurrently |
| `doppler run -- npm run dev:full` | Same with secrets (project dir: `~/calculadora-bmc`) |
| `npm run start:api` | API only |
| `npm run gate:local:full` | **Pre-commit gate:** lint → test → build |
| `npm run test:contracts` | API contract tests (needs server on :3001) |

## Rules

- ES modules everywhere (`import`/`export`, no `require()`)
- Node 24.x (`engines.node`). ALSA headers needed on Linux (`sudo apt-get install -y libasound2-dev`)
- Disk precheck runs before `dev`/`build`; skip with `BMC_DISK_PRECHECK_SKIP=1`
- Log with `pino`/`pino-http`, never `console.log` in prod
- `503` = Sheets unavailable; never `500` for Sheets errors
- Sheet IDs, tokens, URLs: never hardcoded, always from `.env` or `config.*`
- Run `npm run lint` before any commit touching `src/`
- After completing work, update `docs/team/PROJECT-STATE.md` (add entry in "Cambios recientes")

## Architecture

- `server/index.js` — mounts all routes on `/api`
- `server/routes/bmcDashboard.js` — main `/api/*` routes. Calc routes in `routes/calc.js`
- AI/agent coordination: `docs/team/` — roles, skills, project state, human gates
- Before working: read `docs/team/PROJECT-STATE.md`
- Human-gated steps (cm-0/1/2: Meta OAuth, ML OAuth, email ingest): follow `docs/team/HUMAN-GATES-ONE-BY-ONE.md`

## Do Not

- Hardcode sheet IDs, tokens, prod URLs
- Commit `.env` or credentials
- Use `npm audit fix --force` (can break Vite)
- Skip `npm run lint` before committing `src/` changes
- Modify `PROJECT-STATE.md` without a "Cambios recientes" entry
