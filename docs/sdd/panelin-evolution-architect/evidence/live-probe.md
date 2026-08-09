# Live probe — IMP-PEA-00 (human ops)

**Status:** PARTIAL — local script verified; prod/staging rows require human execution  
**Owner:** human ops / Matias  
**When:** Before enabling `PEA_ENABLED=1` in any environment  

## Automated helper

```bash
# Local (API must be up on :3001)
npm run pea:live-probe

# Prod or staging
BMC_API_BASE=https://panelin-calc-....run.app npm run pea:live-probe -- --markdown
```

Paste markdown output below after each campaign oleada (1, 3, 7).

## Checklist (read-only)

| Probe | Command / action | Expected (TARGET) | Result |
|-------|------------------|-------------------|--------|
| API health | `GET /health` | 200 | _pending prod_ |
| PEA health | `GET /api/pea/health` | 200; `pea_enabled` matches env | _pending prod_ |
| Environment | `GET /api/environment` | 200; `env`, `staging`, `db_label` | _pending prod_ |
| Postgres `pea` schema | `\dn pea` or information_schema | present after migrate | _pending prod_ |
| `PEA_ENABLED` env | Cloud Run describe / local `.env` | documented per oleada | _pending prod_ |
| `DATABASE_URL` | config label only | present for omni modules | _pending prod_ |
| JWT auth on pea routes | `GET /api/pea/gaps` without token | 401 | _verified by contract test offline + script_ |

## Local dev run (2026-08-09)

API was down during agent session — run `doppler run -- npm run dev:full` then re-run `npm run pea:live-probe -- --markdown` and attach output here.

## Notes

Do not fabricate prod results. Close G-09 when prod + staging rows filled and signed.

## Evidence

Attach command output snippets or screenshots path when complete.
