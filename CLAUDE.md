# Calculadora BMC — context for Claude

## Project identity

**Calculadora BMC** (package `calculadora-bmc`, v3.1.5) is a production full-stack **quotation calculator** for insulation panels (**BMC Uruguay** / **METALOG SAS**). Business copy and operator-facing text are mostly **Spanish**; **list prices and money amounts are in USD**.

## Tech stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Vite 7 (SPA, dev server **:5173**) |
| **Backend** | Express 5 on Node.js **24.x**, ES modules (`"type":"module"`) — **:3001** |
| **Database** | PostgreSQL (`pg`) — Transportista & WhatsApp Cockpit; Google Sheets — CRM/finances |
| **Secondary DB** | Supabase (URL + keys via env, used in select features) |
| **AI/LLM** | Anthropic Claude, OpenAI, Google Gemini, Grok, **Vercel AI Gateway** (`aiGatewayClient.js`) |
| **Integrations** | Google Drive/Sheets, MercadoLibre OAuth, Shopify Admin API, WhatsApp Business (Meta) |
| **PDF** | Puppeteer Core + Canvas + html2pdf.js; 6 named templates in `src/pdf-templates/` |
| **Testing** | Node test harness (unit), Playwright (e2e/browser), Promptfoo (LLM evals) |
| **Logging** | Pino |
| **Validation** | Zod (runtime schemas, especially WA config) |
| **Auth** | JWT (`jsonwebtoken`), TOTP MFA (`otplib`), Google OAuth |
| **Modules** | **ES modules only** — `import` / `export` everywhere; no `require()` |

## Key commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite frontend only (runs `version:data` first) |
| `npm run dev:full` | API (`:3001`) + Vite (`:5173`) via `concurrently` |
| `npm run lint` | ESLint on `src/` |
| `npm test` | `tests/validation.js` + `tests/roofVisualQuoteConsistency.js` |
| `npm run test:api` | API route tests (`tests/calc-routes.validation.js`) |
| `npm run test:contracts` | API contract drift detection (requires API on `:3001`) |
| `npm run build` | Production Vite build |
| `npm run gate:local` | **lint** + **test** (run before every commit) |
| `npm run gate:local:full` | **lint** + **test** + **build** (run before UI/build changes) |

**Pre-commit:** always run `npm run gate:local`. Run `gate:local:full` before larger UI or build changes. There are 185 npm scripts total — see `AGENTS.md` for the full categorized reference.

## Architecture (repo layout)

```
/
├── src/            React SPA (51 JSX components, 5 hooks, utils, data)
├── server/         Express API (index.js + 27 route handlers + 96 lib modules)
├── tests/          44 test files + golden e2e suite + Playwright browser tests
├── scripts/        182 automation scripts (deploy, sync, KB, WA, ML, email …)
├── docs/           Team docs in 27 subdirs; docs/team/PROJECT-STATE.md = live status
├── .claude/        Claude Code config (12 agent defs, commands, settings.json)
├── .github/        8 GitHub Actions workflows
├── supabase/       Supabase migrations/config
├── public/         Static assets
├── Dockerfile      Production container (API)
└── vercel.json     Frontend deployment config
```

### Frontend — `src/`

**Key files:**

| File | Purpose |
|------|---------|
| `src/components/PanelinCalculadoraV3_backup.jsx` | **Canonical** main calculator (51-component tree) |
| `src/PanelinCalculadoraV3.jsx` | Re-export of the above |
| `src/data/constants.js` | Pricing engine, panel families, design tokens (621 lines) |
| `src/utils/calculations.js` | Core calc logic: slope, BOM, SKU resolution, autobracing (1318 lines) |
| `src/utils/helpers.js` | Shared utilities |
| `src/utils/roofPlanGeometry.js` | 2D roof plan geometry engine |
| `src/utils/pricingOverrides.js` | Runtime price overrides (LISTA_ACTIVA pattern) |
| `src/utils/projectFile.js` | Project save/load persistence |
| `src/pdf-templates/` | 6 PDF templates: bmc-pdf, blueprint, soft-modern, construction-bold, executive-dark, minimalist |
| `src/hooks/useChat.js` | Panelin AI chat SSE hook |
| `src/hooks/useVoiceSession.js` | Voice session management |
| `src/hooks/useRoofPreviewPlanLayout.js` | 2D plan layout hook |
| `src/contexts/BmcAuthProvider.jsx` | Auth context (JWT / Google OAuth) |

**Major component groups:**

- `src/components/roofPlan/` — 2D roof plan SVG editor, panel chain dimensions, cota obstacles
- `src/components/panelin/` — Panelin AI chat UI (`PanelinChatPanel`, `PanelinDevPanel`)
- `src/components/auth/` — Authentication screens
- `src/components/logistica/` — Logistics dashboard
- `src/components/BmcWaCockpit.jsx` — WhatsApp operator cockpit
- `src/components/BmcWolfboardHub.jsx` — CRM wolfboard integration
- `src/components/QuoteVisualVisor.jsx` — Quote preview / visor
- `src/components/AgentAdminModule.jsx` — Agent admin panel

### Backend — `server/`

**Entry & config:**

| File | Purpose |
|------|---------|
| `server/index.js` | Express app — CORS, OAuth, webhooks, rate limiting, DB init (1063 lines) |
| `server/config.js` | Environment config and feature flags |
| `server/tokenStore.js` | Token persistence (never commit plaintext tokens) |
| `server/middleware/requireAuth.js` | JWT auth gate |
| `server/middleware/requireGrant.js` | OAuth grant check |
| `server/middleware/requireServiceOrUser.js` | Service-or-user auth |

**Route handlers (`server/routes/` — 27 total):**

| Route | Purpose |
|-------|---------|
| `calc.js` | Core quotation calculation |
| `agentChat.js` | Panelin AI chat (SSE streaming) |
| `agentVoice.js` | Voice session |
| `agentTranscribe.js` | Speech-to-text |
| `agentTraining.js` | KB training endpoint |
| `agentConversations.js` | Chat history |
| `agentFeedback.js` | Per-message feedback |
| `bmcDashboard.js` | Financial dashboard & CRM |
| `shopify.js` | Shopify Admin API |
| `mlSearch.js` | MercadoLibre search |
| `mlEtlRun.js` | ML ETL pipeline |
| `wa.js` | WhatsApp Business (Meta) |
| `transportista.js` | Driver/logistics |
| `wolfboard.js` | CRM sync & batch quotes |
| `panelinInternal.js` | Internal agent API (RBAC) |
| `pdf.js` | PDF generation |
| `planInterpret.js` | 2D plan parsing |
| `deepResearch.js` | Deep research agent |
| `aiAnalytics.js` | AI analytics |
| `authGoogle.js` | Google OAuth flow |
| `authMfa.js` | TOTP MFA |
| `identityMe.js` | User identity |
| `legacyQuote.js` | Legacy quote compat |
| `quoteExport.js` | Quote export |
| `followups.js` | Follow-up tracker |
| `superAgent.js` | Master agent orchestrator |
| `teamAssist.js` | Team assistance |

**Key lib modules (`server/lib/` — 96 total), highlights:**

- `agentCore.js`, `agentTools.js` — agent orchestration & tool definitions
- `chatPrompts.js` — Panelin system prompts (edit with care)
- `aiCompletion.js`, `aiGatewayClient.js` — LLM routing & Vercel AI Gateway
- `trainingKB.js`, `kbSurface.js`, `kbAnalytics.js` — knowledge base
- `quoteStore.js`, `quoteDualWrite.js`, `quoteRegistry.js` — quote persistence & dual CRM write
- `crmSearch.js`, `crmAppend.js`, `crmRowParse.js` — Sheets CRM integration
- `waDb.js`, `waWebhooks.js`, `waQuoteRunner.js`, `waFollowupsWorker.js` — WhatsApp pipeline
- `transportistaDb.js`, `transportistaFsm.js` — Driver logistics state machine
- `identityAuth.js`, `mfaTotp.js` — user identity & MFA
- `driveUpload.js`, `gcsUpload.js` — Google Drive & GCS uploads
- `budget.js`, `tokenEstimator.js` — LLM rate limiting & token caps
- `autoLearnExtractor.js` — auto-learning from interactions
- `planInterpreter.js` — 2D plan interpretation
- `clientes/normalize.js`, `clientes/customerResolver.js` — customer 360 resolution

### Tests — `tests/`

44 test files. The main entry points:

| Command | Runs |
|---------|------|
| `npm test` | `tests/validation.js` (core, 6100+ lines) + `tests/roofVisualQuoteConsistency.js` |
| `npm run test:api` | `tests/calc-routes.validation.js` (API contracts) |
| `npm run test:e2e` | Playwright browser tests (`tests/e2e-browser.mjs`) |

Other notable test groups: identity/auth (MFA, routes, RBAC), WhatsApp pipeline (enricher, webhooks, SLA, routing), quote (dual-write, store, registry), agent tools, KB surface, budget, PDF pipeline, ML search.

Golden path fixtures live in `tests/agentGolden/` (9 JSON files).

## Deployment & CI

| Target | Tool | Config |
|--------|------|--------|
| Frontend | Vercel | `vercel.json`, `.github/workflows/deploy-vercel.yml` |
| API | Google Cloud Run (`panelin-calc`, `us-central1`) | `Dockerfile`, `.github/workflows/deploy-calc-api.yml` |
| CI (push/PR) | GitHub Actions | `.github/workflows/ci.yml` (lint → validate → test → build) |
| Nightly smoke | GitHub Actions | `.github/workflows/smoke-prod-scheduled.yml` |
| KB antenna | GitHub Actions | `.github/workflows/knowledge-antenna-scheduled.yml` |
| Drive OAuth check | GitHub Actions | `.github/workflows/drive-oauth-verify.yml` |

**Frontend URL:** `https://calculadora-bmc.vercel.app`

## Agent ecosystem (Claude Code)

Twelve agent definitions live under **`.claude/agents/`**:

| Agent | Role |
|-------|------|
| `bmc-orchestrator` | Coordinates full team runs |
| `bmc-calc-specialist` | Pricing, BOM, panel calculations |
| `bmc-panelin-chat` | Chat UI, training KB, Ctrl+Shift+D dev mode |
| `bmc-api-contract` | API response drift detection |
| `bmc-security` | OAuth, CORS, credential audits |
| `bmc-deployment` | Vercel + Cloud Run deploy/rollback |
| `bmc-fiscal` | IVA/IRAE/BPS fiscal oversight |
| `bmc-docs-sync` | PROJECT-STATE.md and docs/ sync |
| `bmc-judge` | Run reports, agent rankings |
| `bmc-sheets-mapping` | Google Sheets CRM column mappings |
| `calculo-especialist` | 2D roof plan SVG dimensioning (planta de cotas) |
| `bmc-panelin-mcp` | External MCP surface (22 tools) for GPT Builder / Cursor |

Canonical human/agent instructions and the full npm script reference live in **`AGENTS.md`**.

## Environment variables

See **`.env.example`** (329 lines) for all variable names. Never commit `.env` or paste values into docs/chat. Key groups:

- `BMC_DASHBOARD_*` — Google Sheets IDs (MATRIX, finances, sales, stock)
- `ML_*` — MercadoLibre OAuth
- `SHOPIFY_*` — Shopify OAuth & webhooks
- `GOOGLE_*` / `DRIVE_*` — Drive OAuth & GCS
- `WA_*` / `WHATSAPP_*` — WhatsApp Business (Meta)
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROK_API_KEY` — LLM providers
- `AI_GATEWAY_*` — Vercel AI Gateway config
- `JWT_SECRET` (>32 chars), `MFA_KEK` (hex) — identity/auth
- `SUPABASE_URL`, `SUPABASE_*_KEY` — Supabase
- `POSTGRES_*` / `DATABASE_URL` — PostgreSQL (Transportista, WA Cockpit)
- `PANELIN_BUDGET_*` — turn/token rate limits for Panelin chat

## Conventions

- **ES modules** everywhere; align with patterns in existing `server/` and `src/` code.
- **Secrets:** read from `config` / `process.env`. Never hardcode Sheet IDs, tokens, or API keys.
- **Commit messages:** English, prefixed with type: `feat` / `fix` / `refactor` / `docs` / `chore`.
- **Money:** prices in USD. IVA = 22% (Uruguay). Fiscal logic in `bmc-fiscal` agent.
- **Language:** business copy and UI text in Spanish; code, logs, and commit messages in English.
- **Zod:** use Zod schemas for all external/runtime data boundaries (WA config, quote payloads, etc.).
- **Pino:** use `pino` for structured server logging; avoid `console.log` in server code.
- **No `require()`:** this is a pure ES module project.

## Session bootstrap

Remote sessions should run **`npm run env:ensure`** once per fresh clone (creates `.env` from `.env.example` when missing). The **SessionStart** hook in `.claude/settings.json` runs this automatically and prints common dev commands.

## Workflow modes

- **Contribut mode** — two-phase input refinement: agent returns a structured draft first, executes only after `ACEPTO BORRADOR`. Invoke with `/contribut` or type `CONTRIBUT ON`. Protocol in `.claude/commands/contribut.md`.
- **Gate before push:** always run `npm run gate:local`; run `gate:local:full` before any UI/build change goes to main.
