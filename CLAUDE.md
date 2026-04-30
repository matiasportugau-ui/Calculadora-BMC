# Calculadora BMC — context for Claude

## Project identity

**Calculadora BMC** (package `calculadora-bmc`, v3.1.5) is a production full-stack **quotation calculator** for insulation panels (**BMC Uruguay** / **METALOG SAS**). Business copy and operator-facing text are mostly **Spanish**; **list prices and money amounts are in USD**.

## Tech stack

- **Frontend:** React 18 + **Vite 7** (dev server **:5173**)
- **API:** **Express 5** on **Node.js** (target **20 LTS**; ES modules via `"type": "module"`) — **:3001**
- **Data / ops:** **PostgreSQL** (`pg`) where the Transportista / migrations flow applies; Google Sheets + Cloud integrations per feature
- **Modules:** **ES modules only** (`import` / `export`) — no `require()`

## Key commands

| Command | Purpose |
|--------|---------|
| `npm run dev` | Vite frontend only (runs `version:data` + Vite) |
| `npm run dev:full` | API (`start:api`) + Vite via `concurrently` |
| `npm run lint` | ESLint on `src/` |
| `npm test` | `tests/validation.js` + `tests/roofVisualQuoteConsistency.js` |
| `npm run test:api` | API route tests |
| `npm run build` | Production Vite build |
| `npm run gate:local` | **lint** + **test** |
| `npm run gate:local:full` | **lint** + **test** + **build** |

**Pre-commit:** run `npm run gate:local` (or `gate:local:full` before larger UI/build changes).

## Architecture (repo layout)

- `src/` — React SPA (Vite): components, hooks, utils, `data/constants.js`
- `server/` — Express entry and routes (`server/index.js`, `server/routes/*`)
- `tests/` — offline tests and checks
- `scripts/` — automation, smoke, tooling
- `docs/` — team docs, Sheets hub, procedures (`docs/team/PROJECT-STATE.md` for live status)

### Key frontend files

- `src/components/PanelinCalculadoraV3.jsx` — main calculator component (canonical; `src/PanelinCalculadoraV3.jsx` is a re-export)
- `src/data/constants.js` — pricing, panels, profiles, scenarios
- `src/utils/calculations.js` — core calculation logic
- `src/utils/helpers.js` — shared utilities

### Key backend files

- `server/index.js` — Express app entry point
- `server/config.js` — environment config and feature flags
- `server/routes/calc.js` — calculation API
- `server/routes/agentChat.js` — AI chat (SSE)
- `server/routes/bmcDashboard.js` — financial dashboard

## Deployment

- **Frontend:** Vercel — **https://calculadora-bmc.vercel.app**
- **API:** Google **Cloud Run** — service **`panelin-calc`**, region **us-central1** (see deploy docs in `docs/procedimientos/`)
- **CI:** GitHub Actions (`.github/workflows/ci.yml` on push to main)

## Agent ecosystem (Claude Code)

Eleven agent definitions live under **`.claude/agents/`**:

| Agent | Role |
|-------|------|
| `bmc-orchestrator` | Coordinates full team runs |
| `bmc-calc-specialist` | Pricing, BOM, panel calculations |
| `bmc-panelin-chat` | Chat UI, training KB, dev mode |
| `bmc-api-contract` | API response drift detection |
| `bmc-security` | OAuth, CORS, credential audits |
| `bmc-deployment` | Vercel + Cloud Run deploy/rollback |
| `bmc-fiscal` | IVA/IRAE/BPS fiscal oversight |
| `bmc-docs-sync` | PROJECT-STATE.md and docs/ sync |
| `bmc-judge` | Run reports, agent rankings |
| `bmc-sheets-mapping` | Google Sheets CRM integration |
| `calculo-especialist` | 2D roof plan SVG dimensioning |

Canonical human/agent instructions also live in **`AGENTS.md`**.

## Conventions

- **ES modules** everywhere; align with patterns in existing `server/` and `src/` code.
- **Secrets:** see **`.env.example`** for variable names — **never** commit `.env` or paste credentials into docs or chat.
- **Sheet IDs / tokens:** do not hardcode; read from `config` / `process.env` (see `AGENTS.md`).
- Commit messages: concise, in English, prefixed with type (feat/fix/refactor/docs).

## Session bootstrap

Remote sessions should run **`npm run env:ensure`** once per fresh clone (creates `.env` from `.env.example` when missing). The **SessionStart** hook in `.claude/settings.json` runs this and prints common dev commands.

## Workflow modes

- **Contribut mode** — two-phase input refinement: agent returns a structured draft first, executes only after `ACEPTO BORRADOR`. Invoke with `/contribut` or type `CONTRIBUT ON`. Protocol defined in `.claude/commands/contribut.md`.
