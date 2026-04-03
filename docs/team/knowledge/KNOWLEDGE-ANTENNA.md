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

## Commands

- Manual full run: `npm run knowledge:run`
- Run scanner/report only: `npm run knowledge:scan`
- Recompute ranking only: `npm run knowledge:rank`
- Recompute impact mapping only: `npm run knowledge:impact`
- Install schedule (launchd): `npm run knowledge:schedule:install`
- Remove schedule (launchd): `npm run knowledge:schedule:uninstall`
- Manual scheduler tick: `npm run knowledge:schedule:tick`

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
