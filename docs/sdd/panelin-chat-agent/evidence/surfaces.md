# Evidence — Surfaces & contracts (R2)

## HTTP / SSE — Chat

| Method | Path | Auth / limits | Notes | Citation |
|--------|------|---------------|-------|----------|
| POST | `/api/agent/chat` | `publicLimiter` ~10/min; `requireAssistantEnabled("panelin")` | SSE stream | `agentChat.js:553`, `index.js:1032` |
| GET | `/api/agent/ai-options` | public | Provider/model list | `agentChat.js:155` |
| GET | `/api/agent/tools-manifest` | public | Tool names | `agentChat.js:177` |
| GET | `/api/agent/tool-stats` | gated | In-memory stats | `agentChat.js:166` |
| POST | `/api/agent/exec-tool` | `execToolLimiter` + auth | Dev tool exec | `agentChat.js:325` |

### Request shape (header comment)

`agentChat.js:6` — `{ messages, calcState, aiProvider?, aiModel?, surface? }` with surfaces `panelin_chat|mercado_libre|whatsapp|email|wolfboard`.

### SSE event types (client)

CONFIRMED in `useChat.js:430-527`: `text`, `action`, `error`, `info`, `cowork_ack`, `tool_call`, `verified_quote`, `kb_match`, `calc_validation`, `suggestions` (+ `done` when stream ends).

## HTTP — Voice Realtime

| Method | Path | Auth | Citation |
|--------|------|------|----------|
| POST | `/api/agent/voice/session` | session mint | `agentVoice.js:64` |
| POST | `/api/agent/voice/action` | action relay | `agentVoice.js:254` |
| GET | `/api/agent/voice/health` | `requireAuth` | `agentVoice.js:324` |
| GET | `/api/agent/voice/errors` | `requireAuth` | `agentVoice.js:298` |

Ephemeral secret: `https://api.openai.com/v1/realtime/client_secrets` — `agentVoice.js:19`. Long-lived key never to browser — comment `agentVoice.js:5-6`.

## Frontend surfaces

| UI | Hook / path | Voice |
|----|-------------|-------|
| Embedded Panelin | `PanelinChatPanel` → `useChat` | Hands-free `useHandsFreeVoice` via `PanelinVoicePanel` |
| Live character | `/panelin/live` | `useVoiceSession` WebRTC Realtime |
| Capability helpers | `voiceSupport.js` | `isHandsFreeSupported()` vs `isBrowserSupported()` |

## Provider chain

Default order (text, no vision): claude → grok → gemini → openai — `agentChat.js:4`, construction ~`990-1025`. Vision turns prefer Gemini — `agentChat.js:969+`.

## Tools

**48** tools in `AGENT_TOOLS` — CONFIRMED via `node` import 2026-07-18. Includes calc, CRM, WA, wolfboard, traktime, RAG `recuperar_casos_similares`, etc. Writes gated by `requireConfirmedAction` — `agentTools.js:1069`.

## Env names (no values)

`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL`, `GEMINI_API_KEY`, `GROK_API_KEY`, `API_AUTH_TOKEN`, `BUDGET_*`, `CHAT_LOG_CONVERSATIONS`, `DATABASE_URL` (pgvector RAG) — `server/config.js:117-134`, `rag.js:26`.
