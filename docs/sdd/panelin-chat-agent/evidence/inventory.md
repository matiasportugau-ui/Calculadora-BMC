# Evidence — Inventory (R1)

**Date:** 2026-07-18 · **Tag:** CONFIRMED unless noted

## Entrypoints

| Path | Role | Evidence |
|------|------|----------|
| `server/index.js:1045` | Mounts `agentChatRouter` on `/api` | import + `app.use("/api", agentChatRouter)` |
| `server/index.js:1049` | Mounts `agentVoiceRouter` on `/api` | same |
| `server/index.js:1032` | `requireAssistantEnabled("panelin")` on `/api/agent/chat` | assistant flag gate |
| `server/index.js:996` | Calc loopback at `/calc` | tools call via `calcLoopbackClient` |
| `src/App.jsx` | SPA routes including calculator + hub | INFERRED from CLAUDE.md architecture |
| `package.json` | `engines.node = 24.x`, scripts `test:agent`, `test:agent-golden`, `eval:agent` | CONFIRMED |

## Hot files (LOC snapshot 2026-07-18)

| File | LOC | Role |
|------|----:|------|
| `server/routes/agentChat.js` | 1590 | SSE chat, provider chain, rate limits |
| `server/lib/agentTools.js` | 2312 | 48 tools + `executeTool` |
| `server/lib/chatPrompts.js` | 724 | System prompts + voice compact prompt |
| `server/lib/agentCore.js` | 482 | Shared brain / non-SSE callers |
| `server/routes/agentVoice.js` | 366 | Realtime session mint |
| `src/hooks/useChat.js` | 853 | SSE client |
| `src/components/PanelinChatPanel.jsx` | ~1700+ | Chat UI shell |

## Related routes

`agentTraining.js`, `agentTranscribe.js`, `agentFeedback.js`, `agentConversations.js` under `server/routes/`.

## Deploy surfaces

| Surface | Host | Evidence |
|---------|------|----------|
| Frontend SPA | Vercel `calculadora-bmc.vercel.app` | `vercel.json`, CLAUDE.md |
| API | Cloud Run `panelin-calc` us-central1 | CLAUDE.md, PANELIN-IA-OPS |
| Local | Vite `:5173` + Express `:3001` | AGENTS.md |

## Live probe (session)

| Target | Result | Tag |
|--------|--------|-----|
| `localhost:3001/health` | Down at first inventory | was UNKNOWN |
| `https://panelin-calc-q74zutv7dq-uc.a.run.app/health` | `{"ok":true,"appEnv":"production","hasTokens":true,"hasSheets":true,…}` | **CONFIRMED** 2026-07-18 |

Also generated: `evidence/tools-manifest.md` (48 tools), `evidence/goldens.md` (15 cases).
