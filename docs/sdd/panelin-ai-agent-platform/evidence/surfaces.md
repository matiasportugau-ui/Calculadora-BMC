# Evidence — runtime surfaces (R2)

**Date:** 2026-07-23

## HTTP API (AI-related)

| Method | Path | Gate | Notes | Evidence |
|--------|------|------|-------|----------|
| POST | `/api/agent/chat` | `requireAssistantEnabled("panelin")` + rate limit | SSE tool loop; `done` emits `provider_used`, `latency_ms`, optional `ttft_ms` (IMP-12) | `agentChat.js` |
| POST | `/api/agent/exec-tool` | Bearer for auth tools; 60/min | MCP / single tool | `agentChat.js:351-395` |
| GET | `/api/agent/tools-manifest` | public | Tool list | local count 55 |
| GET | `/api/agent/tools/openapi` | public | OpenAPI 3.1 | `agentToolsOpenApi.js` |
| GET | `/api/agent/ai-options` | public | Providers/models (no secrets) | `aiProviderConfig.js` |
| GET | `/api/agent/tool-stats` | (dev/ops) | In-memory latency | `toolStats.js` |
| POST | `/api/agent/quote-lead` | SuperAgent router | Parallel Haiku extract | `superAgent.js` |
| * | `/api/agent/train*`, `/training-kb*`, `/autolearn*` | Dev token | Training | `agentTraining.js` |
| POST | `/api/agent/feedback` | — | Feedback | routes |
| POST | `/api/agent/voice/session`, `/voice/action` | auth/grants | Realtime mint | `agentVoice.js` |
| POST | `/api/agent/transcribe` | — | Whisper | `agentTranscribe.js` |
| POST | `/api/email-agent/chat` | assistant `email` | Chatwoot tools | `emailAgentChat.js` |
| GET/POST | `/api/assistants/status*` | auth admin | Control plane | `assistantsStatus.js` |
| POST | `/api/crm/suggest-response` | assistant `ml` + auth | ML suggest → `callAgentOnce` | `suggestResponse.js` |
| * | `/api/omni/.../assist` | assistant `canales` | Omni copilot | `omni.js` |
| GET | `/api/ai-analytics/trends` | auth | Trends | `aiAnalytics.js` |
| POST | `/calc/cotizar`, `/calc/cotizar/pdf`, … | calc routes | Math SoT for tools | `calcLoopbackClient.js` |

## Rate limits (CONFIRMED `agentChat.js:434-452`)

| Limiter | Window | Max |
|---------|--------|-----|
| `publicLimiter` (chat) | 60s | **10** |
| `devModeLimiter` | 60s | **30** |
| `execToolLimiter` | 60s | **60** |

## Assistants (CONFIRMED `assistantRegistry.js:50-114`)

| Key | Label | Channel | Terminal |
|-----|-------|---------|----------|
| `canales` | Canales (Omni copilot) | chat | no |
| `panelin` | Panelin Chat | chat | no |
| `email` | Email Agent | chat | no |
| `wa` | WhatsApp Cockpit | wa | no |
| `ml` | MercadoLibre | ml | no |
| `wolfboard` | Wolfboard Batch | chat | no |
| `seam` | Shared agentCore seam | chat | **yes (always on)** |

Master switch: `ASSISTANTS_ACTIVE` + runtime `wa_settings.assistants` override (`assistantRegistry.js:132-143`).

## Provider chain (CONFIRMED `aiProviderConfig.js:110,173-175`)

Order: `claude → grok → gemini → openai → openrouter` (only those with keys; openrouter needs `OPENROUTER_FALLBACK_ENABLED`).

Defaults: Claude `claude-opus-4-7`, Grok `grok-3-mini`, Gemini `gemini-2.5-flash`, OpenAI `gpt-4o-mini`.

## Frontend consumers

| Surface | Route | Client |
|---------|-------|--------|
| Embedded chat | `/`, `/calculadora` | `PanelinChatPanel` + `useChat` |
| Co-Work | `/panelin/cowork` | Co-Work page |
| Live voice | `/panelin/live` | Realtime WebRTC |
| Assistants admin | `/hub/admin/assistants` | `AssistantsStatusPanel` |
| Canales / WA / ML | `/hub/canales`, `/hub/wa`, `/hub/ml` | Omni / WA / ML AI |
| Dev training | Ctrl/Cmd+Shift+D | `PanelinDevPanel` |

## Channel → brain wiring

| Channel | Entry | Brain path |
|---------|-------|------------|
| Web chat | `POST /api/agent/chat` | **Own SSE streaming tool loop** (not `callAgentOnce` for main turn) |
| ML / CRM | `suggestResponse.js` | `callAgentOnce({ channel: "ml" })` |
| WA | `wa.js` / enricher | `callAgentOnce({ channel: "wa" })` |
| Omni | `dispatchAssistant("canales")` | → `callAgentOnce` |
| Email Chatwoot | `emailAgentChat.js` | `callAgentOnce` + `EMAIL_AGENT_TOOLS` |
| Wolfboard batch | wolfboard route | `callAgentOnce` / tool `wolfboard_quote_batch` |
| SuperAgent | `/api/agent/quote-lead` | Direct Anthropic Haiku (parallel to tools) |
| MCP | `mcp-panelin-http.mjs` | `tools-manifest` + `exec-tool` |

## SSE `done` event (IMP-12, 2026-07-23)

| Field | Type | Notes |
|-------|------|-------|
| `type` | `"done"` | Terminal |
| `provider_used` | string\|null | Winning provider or null on total failure |
| `model` | string\|null | Resolved model id |
| `latency_ms` | number\|null | Provider-attempt wall ms |
| `ttft_ms` | number? | First text delta − attempt start |

Dev panel (`PanelinDevPanel` train tab) shows last turn via `useChat` `devMeta.lastTurn`.
