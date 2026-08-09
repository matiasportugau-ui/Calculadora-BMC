# Evidence — primary traces (R3)

## Trace T1 — Panelin quote turn (text)

1. Operator types in `PanelinChatPanel` → `useChat.send`
2. `POST /api/agent/chat` SSE (origin allowlist + publicLimiter 10/min)
3. `buildSystemPrompt` (`chatPrompts.js`) + optional RAG inject if `RAG_ENABLED`
4. Provider chain stream; model emits `tool_use` e.g. `calcular_cotizacion`
5. `executeTool` → `calcLoopbackClient.postCotizar` → `127.0.0.1:${port}/calc/cotizar` with `source: "ae_agent"`
6. SSE events: text deltas, tool_call/result, `verified_quote`, `done`
7. UI renders bubble + action pills (`VALID_ACTION_TYPES` in `agentChat.js`)

## Trace T2 — MCP external tool call

1. MCP client `npm run mcp:panelin`
2. `GET /api/agent/tools-manifest`
3. `POST /api/agent/exec-tool` with Bearer for gated tools
4. Same `executeTool` path as chat

## Trace T3 — ML suggest

1. Hub ML / CRM → `POST /api/crm/suggest-response`
2. `requireAssistantEnabled("ml")`
3. `suggestResponse.js` → `callAgentOnce({ channel: "ml" })`
4. Provider chain non-streaming completion + costTelemetry

## Trace T4 — Hands-free voice

1. Wake word → Web Speech STT → text into `useChat.send` (T1)
2. TTS via `speechSynthesis` (no OpenAI Realtime cost)

## Trace T5 — Realtime voice

1. `/panelin/live` → `POST /api/agent/voice/session` ephemeral secret
2. Browser WebRTC ↔ OpenAI Realtime
3. Function calls → `POST /voice/action`
