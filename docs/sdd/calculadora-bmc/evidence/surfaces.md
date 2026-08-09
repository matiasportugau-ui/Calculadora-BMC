# Evidence — surfaces (R2)

## Prod probes (2026-07-19)

### GET `/health` (Cloud Run)

```json
{"ok":true,"appEnv":"production","hasTokens":true,"mlTokenStoreOk":true,"hasSheets":true,"sheets_diagnostics":{"ok":true,"tabs":["Form responses 1","CRM_Operativo",...],"missing":[]},"missingConfig":[]}
```

**CONFIRMED:** production Sheets + ML token store healthy at capture time.

### GET `/capabilities`

Returns `schema_version: "1"`, `public_base_url`, calculator OpenAPI actions under `/calc/*`, build `version: "3.1.5"`.

### Frontend

`GET https://calculadora-bmc.vercel.app/` → HTTP **200**.

## HTTP surface map (selected)

| Prefix | Mount | Auth notes | Source |
|--------|-------|------------|--------|
| `GET /health` | index | public | `server/index.js:269` |
| `GET /capabilities` | index | public | `server/index.js:256` |
| `GET /version` | index | public | `server/index.js:265` |
| `/calc/*` | `calcRouter` | mix public/auth | `server/index.js:996` |
| `/api/*` | many routers | grants / JWT / API token | mounts ~998+ |
| `/auth/ml/*` | ML OAuth | ML client | index |
| `/webhooks/whatsapp\|instagram\|messenger\|ml\|shopify` | inbound | verify tokens / HMAC | index |
| `POST /api/vitals` | RUM CWV | public beacon | index:324 |

### Calculator API (`server/routes/calc.js`) — CONFIRMED

| Method | Path | Notes |
|--------|------|-------|
| GET | `/calc/openapi` | OpenAPI for GPT Actions |
| GET | `/calc/gpt-entry-point` | Agent entry |
| GET | `/calc/informe` | Full pricing/rules context |
| GET | `/calc/catalogo` | Panel catalog |
| GET | `/calc/escenarios` | Scenario schemas |
| POST | `/calc/cotizar` | Quote |
| POST | `/calc/cotizar/presupuesto-libre` | Free-form budget |
| POST | `/calc/cotizar/pdf` | PDF generation |
| GET | `/calc/pdf/:id` | Fetch PDF |
| GET/POST | `/calc/cotizaciones*` | Auth-gated quote registry |

### AI / agent surfaces

| Path | Gate | Source |
|------|------|--------|
| `/api/agent/chat` | `requireAssistantEnabled("panelin")` | index:1032 |
| `/api/email-agent/chat` | assistant `email` | index:1033 |
| `/api/wa/suggestions/run`, `/api/wa/quotes/run` | assistant `wa` | index:1034-35 |
| `/api/crm/suggest-response` | ML assistant + limiter | index:1042 |
| `/api/wolfboard/quote-batch` | wolfboard | index:1043 |
| `/api/panelin/*` | `requireServiceOrUser()` | index:1103 |
| `/api/agent` (superAgent) | super agent router | index:1091 |

### Dashboard / CRM

Broad `/api` mount via `bmcDashboard.js` (Sheets-backed). Convention: **503** if Sheets unavailable; never 500 for Sheets-down (AGENTS.md / CLAUDE.md).

## Env var names (required / important) — values REDACTED

From `server/config.js` + `.env.example` (names only):

| Category | Names |
|----------|-------|
| Core | `PORT`, `APP_ENV`, `PUBLIC_BASE_URL`, `FRONTEND_BASE_URL`, `API_AUTH_TOKEN` |
| Identity | `IDENTITY_JWT_SECRET`, `GOOGLE_OAUTH_CLIENT_ID`, `WA_JWT_SECRET` (must differ) |
| Sheets | `BMC_SHEET_ID`, `BMC_PAGOS_SHEET_ID`, `BMC_MATRIZ_SHEET_ID`, `GOOGLE_APPLICATION_CREDENTIALS`, `WOLFB_*` |
| ML | `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_TOKEN_GCS_BUCKET`, `TOKEN_ENCRYPTION_KEY` |
| AI | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, OpenRouter vars (see aiProviderConfig) |
| Meta/WA | `WEBHOOK_VERIFY_TOKEN`, WA Cloud API tokens (see wa config) |
| Data | `DATABASE_URL` |
| Frontend Vite | `VITE_GOOGLE_CLIENT_ID`, `VITE_API_URL`, `VITE_OMNI_INBOX`, `VITE_FEATURE_BRAIN` |

**Secrets store (INFERRED/CONFIRMED ops docs):** Doppler `bmc-frontend/prd` + `bmc-backend/prd`; GCP Secret Manager for Cloud Run; never commit `.env`.

## Sheets error contract — CONFIRMED (project convention)

- `503` = Sheets unavailable  
- `200` + empty = no data  
- Never `500` for Sheets failures  
