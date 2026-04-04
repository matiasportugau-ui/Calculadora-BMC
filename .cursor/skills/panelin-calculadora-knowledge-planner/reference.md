# Reference — Areas and artifacts

## Repo areas (for scoped “single area” quests)

| Area | Typical paths | Notes |
|------|----------------|--------|
| Calculadora UI | `src/components/`, `src/utils/`, `vite.config.js` | [calculadora-bmc.vercel.app](https://calculadora-bmc.vercel.app) |
| API / Cloud Run | `server/`, `Dockerfile.bmc-dashboard`, `scripts/deploy-cloud-run.sh` | Routes under `/api`, `/calc` per AGENTS |
| GPT / actions / contracts | `server/gptActions.js`, `docs/openapi*.yaml`, `scripts/capabilities-snapshot.mjs` | Align with Builder / OpenAPI |
| CRM / Sheets | `server/routes/bmcDashboard.js`, `docs/google-sheets-module/` | 503 semantics for Sheets |
| ML / OAuth | ML routes, `docs/ML-OAUTH-SETUP.md` | Human gates cm-* |
| Shopify | `server/shopify*.js`, related routes | HMAC, env |
| Knowledge antenna | `scripts/knowledge-antenna-*.mjs`, `docs/team/knowledge/` | This skill’s inputs |
| CI / quality | `.github/workflows/`, `npm run gate:local:full` | |

## Knowledge artifacts (quick index)

- `references-catalog.json` — `references[]`: `title`, `url`, `summary`, `sourceId`, `publishedAt`
- `impact-map.json` — `mappings[]`: `domain`, `priority`, `targets`, `recommendation`
- `sources-registry.json` — `sources[]`: `rankScore`, `status`, `tags`
- `knowledge-db.json` — consolidated stats + eval hints from `knowledge-antenna-db.mjs`

## Refresh commands

- Full pipeline: `npm run knowledge:run`
- HTML only from JSON: `npm run knowledge:magazine`
