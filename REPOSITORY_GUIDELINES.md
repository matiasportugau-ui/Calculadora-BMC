# Repository Guidelines

## Project Structure & Module Organization

- `src/` — React 18 + Vite frontend. Key files: `App.jsx`, `PanelinCalculadoraV3.jsx` (main calculator), `components/`, `utils/`, `data/`, `pdf-templates/`, `hooks/`.
- `server/` — Express 5 backend (Node ESM). Routes under `server/routes/`, core logic in `server/lib/`, entry point `server/index.js`.
- `tests/` — Offline tests as standalone Node scripts.
- `scripts/` — Automation, smoke tests, migrations, and operational tooling.
- `docs/` and `docs/team/` — Documentation, architecture, team processes, and agent knowledge.

The project is a full-stack quotation system for BMC Uruguay (insulation panels). Business logic and UI are primarily in Spanish; prices are in USD (ex-IVA).

## Build, Test, and Development Commands

- `npm run dev` — Start Vite on :5173 (runs `version:data` first).
- `npm run dev:full` — Run API (`start:api` on :3001) + Vite concurrently.
- `npm run start:api` — Start Express API only.
- `npm run lint` — Run ESLint on `src/`.
- `npm test` — Execute core offline tests (validation, calculations, agents, KB, etc.).
- `npm run gate:local` — `lint` + `test` + `test:api`.
- `npm run gate:local:full` — `gate:local` + `build`.
- `npm run build` — Production Vite build to `dist/`.
- `npm run test:contracts` — Live API contract validation (requires running server).
- `npm run smoke:prod` — Smoke tests against production Cloud Run API.

`predev` and `prebuild` run disk space prechecks (can be skipped with `BMC_DISK_PRECHECK_SKIP=1`).

## Coding Style & Naming Conventions

- Strict ES Modules (`"type": "module"` in `package.json`).
- Node.js 24.x required (see `engines`).
- ESLint flat config (`eslint.config.js`) with React, react-hooks, and custom `bmc-help` plugin.
- React components live in `src/components/` (PascalCase filenames). Utilities in `src/utils/`.
- Never hardcode secrets, sheet IDs, or tokens — use `server/config.js` or environment variables.
- `npm run lint` must pass before commits that touch `src/`.

## Testing Guidelines

- Tests are plain Node.js scripts in `tests/` (no Jest/Vitest runner).
- Run groups via `npm run test:*` or the top-level `npm test`.
- `npm run test:api` covers route and integration behavior.
- `npm run test:contracts` validates API responses against the running server.
- Playwright-based browser tests exist under `scripts/` (e.g., `test:browser:full`).
- Run relevant tests after changes to calculations, pricing, agents, or API routes.

## Commit & Pull Request Guidelines

- Use Conventional Commits with scopes where helpful: `feat:`, `fix:`, `fix(security):`, `docs(bug-reports):`, `chore:`.
- Large PRs (>500 LOC added) must be opened as DRAFT.
- Run `npm run gate:local` (ideally `gate:local:full`) before significant PRs.
- When behavior or contracts change, update `docs/team/PROJECT-STATE.md` under "Cambios recientes".
- Link issues or internal tracking references when applicable.

## Agent-Specific Notes

This repository is heavily used with AI coding agents (Claude, Cursor, Grok, etc.). See the root `AGENTS.md` for the full operational command catalog, team structure, and agent coordination rules. The long-form `AGENTS.md` takes precedence for agent workflows.
