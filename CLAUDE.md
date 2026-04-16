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
| `npm run build` | Production Vite build |
| `npm run gate:local` | **lint** + **test** |
| `npm run gate:local:full` | **lint** + **test** + **build** |

**Pre-commit:** run `npm run gate:local` (or `gate:local:full` before larger UI/build changes).

## Architecture (repo layout)

- `src/` — React SPA (Vite)
- `server/` — Express entry and routes (`server/index.js`, `server/routes/*`)
- `tests/` — offline tests and checks
- `scripts/` — automation, smoke, tooling
- `docs/` — team docs, Sheets hub, procedures (`docs/team/PROJECT-STATE.md` for live status)

## Deployment

- **Frontend:** Vercel — **https://calculadora-bmc.vercel.app**
- **API:** Google **Cloud Run** — service **`panelin-calc-web`**, region **us-central1** (see deploy docs in `docs/procedimientos/`)

## Agent ecosystem (Claude Code)

Eleven agent definitions live under **`.claude/agents/`**:

`bmc-orchestrator`, `bmc-calc-specialist`, `bmc-security`, `bmc-deployment`, `bmc-fiscal`, `bmc-docs-sync`, `bmc-judge`, `bmc-sheets-mapping`, `bmc-panelin-chat`, `bmc-api-contract`, `calculo-especialist`.

Canonical human/agent instructions also live in **`AGENTS.md`**.

## Conventions

- **ES modules** everywhere; align with patterns in existing `server/` and `src/` code.
- **Secrets:** see **`.env.example`** for variable names — **never** commit `.env` or paste credentials into docs or chat.
- **Sheet IDs / tokens:** do not hardcode; read from `config` / `process.env` (see `AGENTS.md`).

## Session bootstrap

Remote sessions should run **`npm run env:ensure`** once per fresh clone (creates `.env` from `.env.example` when missing). The **SessionStart** hook in `.claude/settings.json` runs this and prints common dev commands.
