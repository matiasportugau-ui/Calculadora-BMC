# Evidence — inventory (R1)

**Date:** 2026-07-23  
**Command base:** repo `/Users/matias/calculadora-bmc`

## Top-level surface (AI-relevant)

| Path | Role |
|------|------|
| `server/lib/agentCore.js` | Shared non-SSE brain (`callAgentOnce`) |
| `server/lib/aiProviderConfig.js` | Provider chain SoT |
| `server/lib/providerCircuitBreaker.js` | Cooldown / health order |
| `server/lib/agentTools.js` | Tool definitions + `executeTool` |
| `server/lib/agentToolsOpenApi.js` | OpenAPI 3.1 export |
| `server/lib/calcLoopbackClient.js` | Loopback `/calc` |
| `server/lib/assistantRegistry.js` | Assistants CP |
| `server/lib/chatPrompts.js` | System prompts |
| `server/lib/rag.js` + `embeddings.js` | pgvector RAG |
| `server/lib/trainingKB.js` + `autoLearnExtractor.js` | Training KB |
| `server/lib/costTelemetry.js` + `toolStats.js` + `budget.js` | Cost / limits |
| `server/routes/agentChat.js` | SSE chat + exec-tool + manifest |
| `server/routes/agentTraining.js` | Train / KB / autolearn APIs |
| `server/routes/agentVoice.js` + `agentTranscribe.js` | Realtime + Whisper |
| `server/routes/superAgent.js` | `POST /quote-lead` (parallel path) |
| `server/routes/emailAgentChat.js` | Chatwoot email agent |
| `server/routes/assistantsStatus.js` | Hub assistants UI API |
| `scripts/mcp-panelin-http.mjs` | MCP stdio → HTTP |
| `src/components/PanelinChatPanel.jsx` | Chat UI + Multi-Context / Co-Work toolbar |
| `src/components/PanelinCoWorkPage.jsx` | Desk window `/panelin/cowork` |
| `src/utils/openDocumentPip.js` | Document PiP “Fijar arriba” |
| `src/hooks/useChat.js` | SSE client |
| `src/components/PanelinDevPanel.jsx` | Dev / training (Ctrl+Shift+D) |
| `migrations/0001_*.sql`, `0002_*.sql` | `quote_embeddings` |
| `tests/agentGolden/cases/*.json` | **22** golden cases |
| `docs/team/panelsim/AE-AGENT-CALC-CONTRACT.md` | Calc provenance contract |
| `docs/team/runbooks/PANELIN-IA-OPS.md` | Ops runbook |

## Runtime probes (CONFIRMED 2026-07-23)

### Local API `:3001`

```text
GET /health → {"ok":true,"appEnv":"development",...}
GET /api/agent/tools-manifest → {"ok":true,"count":55,...}
```

### Production Cloud Run

```text
GET https://panelin-calc-q74zutv7dq-uc.a.run.app/health
→ {"ok":true,"appEnv":"production","hasTokens":true,"hasSheets":true,...}

GET .../api/agent/tools-manifest → {"ok":true,"count":55,...}  (re-probed 2026-07-23 evening)
GET .../api/agent/tools/openapi → 200 OpenAPI 3.1.0, x-agent-tools length 55
```

**Drift:** local/prod tool counts **aligned at 55** after #742 deploy. Historical docs citing 42/48/51 are stale.

### Code count

```bash
node -e "import { AGENT_TOOLS } from './server/lib/agentTools.js'; console.log(AGENT_TOOLS.length)"
# → 55
```

## npm scripts (CONFIRMED `package.json`)

| Script | Purpose |
|--------|---------|
| `test:agent` | Offline agent suite |
| `test:agent-golden` | Golden runner |
| `eval:agent` | Eval script |
| `pre-release` | Includes `GOLDEN_REQUIRED=1` goldens |
| `mcp:panelin` | MCP bridge |
| `smoke:prod` | Prod API smoke |

## Stack locks

- Node `24.x`, `"type": "module"`, Express 5 API, React 18 + Vite 7 SPA — `package.json` / CLAUDE.md.
