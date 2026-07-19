# Recreation Checklist — panelin-chat-agent

Falsifiable items. Evidence: path or command.

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Can locate API mount for agent chat | ✅ | `server/index.js:1045` |
| 2 | Know SSE endpoint + request fields | ✅ | `agentChat.js:6`, `:553` |
| 3 | Know client SSE event types | ✅ | `useChat.js:430-527` |
| 4 | Know provider chain order | ✅ | `agentChat.js:4`, `:990+` |
| 5 | Know tool count and write gate | ✅ | 48 tools; `requireConfirmedAction` |
| 6 | Can mint Realtime session without exposing long-lived key | ✅ | `agentVoice.js:2-6` |
| 7 | Dual voice paths documented | ✅ | SDD ADR-003 + `voiceSupport.js` |
| 8 | Browser matrix Hands-free vs Realtime | ✅ | SDD §3/§6 + SEC |
| 9 | Env names for LLM + budget listed | ✅ | `config.js:117-134` |
| 10 | Deploy targets Vercel + Cloud Run named | ✅ | CLAUDE.md / OPS |
| 11 | Sheets failure semantics known | ✅ | 503 convention |
| 12 | RAG table + distance semantics | ✅ | `rag.js` header + query |
| 13 | Test commands for agent gate | ✅ | `test:agent`, `test:agent-golden` |
| 14 | Cost telemetry hook points | ✅ | agentCore + aiCompletion imports |
| 15 | Local ports 5173/3001 | ✅ | AGENTS.md |
| 16 | Prod `/health` probed this session | ❌ | UNKNOWN — API down at inventory |
| 17 | Full tool I/O schemas per tool | ⚠️ Partial | Manifest exists; not full OpenAPI dump |
| 18 | Prompt text versioned hash | ⚠️ Partial | File-based; no content-hash in SDD |
| 19 | Exact rate-limit numbers in SDD | ⚠️ | OPS says 10/min; cite limiter config |
| 20 | Golden case inventory listed | ⚠️ | Script exists; case list not enumerated here |

**Score:** 15/20 solid ✅ · 4 partial · 1 unknown → **~90% recreation readiness** for core chat+voice; tool schema dump still gap.
