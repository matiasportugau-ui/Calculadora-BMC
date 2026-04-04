# Knowledge Antenna

Operational guide for a scripted AI-research antenna that feeds BMC/Panelin evolution decisions.

## Objective

- Track high-signal global AI + platform/dev-tool updates.
- Convert external updates into concrete impact for this repository.
- Persist learnings so each run improves source quality and relevance.

## Data Artifacts

- `docs/team/knowledge/sources-registry.json`: source inventory, authority, fit, rank policy, status (`active`, `watchlist`, `candidate`).
- `docs/team/knowledge/events-log.jsonl`: append-only event stream captured from external sources.
- `docs/team/knowledge/references-catalog.json`: deduplicated persistent references for future runs.
- `docs/team/knowledge/impact-map.json`: event-to-code/workflow mappings and recommended actions.
- `docs/team/knowledge/reports/KNOWLEDGE-REPORT-YYYY-MM-DD.md`: run reports.
- `docs/team/knowledge/reports/KNOWLEDGE-MAGAZINE-latest.html`: **Panelin Signal** — revista interna HTML (lectura humana; se regenera con cada scan o con `npm run knowledge:magazine`).
- `docs/team/knowledge/reports/KNOWLEDGE-MAGAZINE-YYYY-MM-DD.html`: copia fechada del mismo número.

## Commands

- Manual full run: `npm run knowledge:run`
- Run scanner/report only: `npm run knowledge:scan`
- Recompute ranking only: `npm run knowledge:rank`
- Recompute impact mapping only: `npm run knowledge:impact`
- Build knowledge DB + improvement evaluation: `npm run knowledge:db`
- Build development direction tracker (user-friendly): `npm run knowledge:direction`
- Run end-to-end development chain (step by step): `npm run development:chain`
- Run full chain including build gate: `npm run development:chain:full`
- Environment ensure (self-heal): `npm run knowledge:env:ensure`
- Environment check (no changes): `npm run knowledge:env:check`
- Pipeline preflight (strict): `npm run knowledge:preflight`
- Install schedule (launchd): `npm run knowledge:schedule:install`
- Remove schedule (launchd): `npm run knowledge:schedule:uninstall`
- Manual scheduler tick: `npm run knowledge:schedule:tick`
- Regenerar solo la revista HTML desde JSON actuales: `npm run knowledge:magazine`

## CI Automation

- **Push / PR (`main`, `develop`):** `.github/workflows/ci.yml` runs `validate`, `lint`, `channels_pipeline`, then calls the reusable workflow `.github/workflows/knowledge-antenna-reusable.yml` as job `knowledge_antenna` (after `validate` + `lint`). This keeps prod smoke / `humanGate` tied only to code events.
- **Daily cron + manual:** `.github/workflows/knowledge-antenna-scheduled.yml` triggers `workflow_dispatch` and `schedule` (10:20 UTC) and **only** invokes `knowledge-antenna-reusable.yml`, so transient prod issues do not fail unrelated jobs or spam notifications.

Steps: `knowledge:env:cwd:guard`, `knowledge:env:check`, `knowledge:preflight`, `knowledge:run`, summary log, artifact upload. `continue-on-error` is set on the reusable job so flaky external feeds do not fail the workflow run.

## Self-managed Environment and Dependencies

Before each full run (`knowledge:run`) the system now enforces:

- Node/npm presence and minimum Node major version.
- Common PATH bootstrapping (`/opt/homebrew/bin`, `/usr/local/bin`) for scheduler sessions.
- Optional `nvm` auto-load if available.
- Dependency presence (`node_modules`) and auto-install (`npm ci`/`npm install`) when needed.
- Writable knowledge directories and report output paths.
- Strict preflight: validates JSON schemas and connectivity to sampled active sources.
- Automatic improvement evaluation snapshot (`knowledge-db.json`) and a dated report in `knowledge/reports/KNOWLEDGE-IMPROVEMENT-EVAL-*.md`.
- Direction tracker files:
  - `docs/team/knowledge/development-direction-tracker.json` (machine + editable tracking fields)
  - `docs/team/knowledge/DEVELOPMENT-DIRECTION-TRACKER.md` (human-friendly board)
- Chain status files:
  - `docs/team/knowledge/development-chain-status.json` (machine status with steps and timings)
  - `docs/team/knowledge/DEVELOPMENT-CHAIN-STATUS.md` (human-friendly chain report)

Config knobs:

- `KNOWLEDGE_NODE_MIN_MAJOR` (default `20`)
- `KNOWLEDGE_AUTO_INSTALL_NODE` (default `0`)
- `KNOWLEDGE_AUTO_INSTALL_DEPS` (default `1`)

## Ranking Model

Composite rank score per source:

- authority (35%)
- freshness of successful checks (20%)
- historical signal quality from captured events (25%)
- project fit for BMC/Panelin stack (20%)

Thresholds:

- `>= 0.75`: candidate can auto-promote to `active`
- `<= 0.35`: active source is flagged to `watchlist`

## Source Governance

Accept a source when all are true:

- It is primary or high-quality secondary (lab changelog, official release notes, strong research feed).
- It repeatedly generates events that map to real project impact.
- It has stable access pattern (RSS, API, GitHub releases) with low failure rate.

Mark source as `watchlist` when any are true:

- Repeated fetch failures.
- Mostly low-signal/no-action events.
- Low rank score for 2+ consecutive runs.

## Weekly Review Cadence

- Monday: run `knowledge:run`, inspect `impact-map.json` high priorities.
- Midweek: add/remove candidate sources based on observed blind spots.
- Friday: archive key insights into `PROJECT-STATE.md` only if they imply concrete engineering actions.

## Output Contract

Each report must include:

- Executive summary (what changed in the ecosystem)
- Tactical recommendations (this week)
- Backlog candidates by impacted subsystem
- No-action section to suppress noise

## Migration Path (Phase 5)

Artifacts are JSON/JSONL with stable IDs and timestamps so they can be migrated later to Postgres:

- `sources` -> `knowledge_sources`
- `references` -> `knowledge_references`
- `events-log` -> `knowledge_events`
- `impact-map` -> `knowledge_impacts`

Migration rule: keep report generation logic unchanged and only swap persistence adapter.
