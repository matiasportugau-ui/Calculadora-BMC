# Evidence — traces (R3 primary flows)

## Trace T1 — Operator quotes on SPA

1. User opens `https://calculadora-bmc.vercel.app/` (Vite SPA).
2. Calculator UI (`PanelinCalculadoraV3_backup.jsx`) computes techo/pared via `calculations.js` + `constants.js`.
3. Optional PDF: client → `POST /api/pdf/generate` or `/calc/cotizar/pdf` (proxied Vercel → Cloud Run).
4. Optional CRM sync / Drive archive via `/api/*` Sheets/Drive routes.

**Evidence:** `vercel.json` rewrites; `src/utils/pdfGenerator.js`; calc routes.

## Trace T2 — GPT / agent cotiza via OpenAPI

1. Agent calls `GET /calc/informe` then `POST /calc/cotizar`.
2. Capabilities document lists operationIds and URLs under Cloud Run public base.
3. Agent tools may use loopback `calcLoopbackClient` when running inside the API process.

**Evidence:** `/capabilities` JSON; `server/routes/calc.js`; `server/lib/calcLoopbackClient.js`.

## Trace T3 — Panelin chat

1. UI chat → `POST /api/agent/chat` (SSE) gated by `ASSISTANTS_ACTIVE` / panelin flag.
2. `agentCore.js` provider chain (Anthropic + OpenAI fallback) + `agentTools.js`.
3. Optional RAG via pgvector embeddings (`server/lib/rag.js` / embeddings).
4. Training KB / auto-learn paths under agent training routes.

**Evidence:** `server/index.js` assistant gates; `server/lib/agentCore.js`.

## Trace T4 — WhatsApp inbound

1. Meta webhook → `POST /webhooks/whatsapp`.
2. WA router + Postgres `wa_*` tables; suggestions/quotes may call AI when assistant enabled.

**Evidence:** webhook mounts in `server/index.js`; `wa-package/migrations/`.

## Trace T5 — ML questions

1. OAuth `/auth/ml/start` → tokens in GCS (prod).
2. `/ml/questions` + `/api/crm/suggest-response` for AI draft answers.

**Evidence:** health `hasTokens:true`; ML routes in index.
