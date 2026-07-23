# Target — panelin-ai-agent-platform

| Field | Value |
|-------|-------|
| **Slug** | `panelin-ai-agent-platform` |
| **System name** | Panelin AI Agent Platform (BMC) |
| **Path** | `/Users/matias/calculadora-bmc` (bounded context inside package `calculadora-bmc` v3.1.5) |
| **Type** | Modular monolith AI surface (Express API + React SPA consumers + MCP sidecar) |
| **Depth** | Full recreation-grade for **AI agent development** (brain, tools, channels, RAG/KB, training, cost, control plane) |
| **Started** | 2026-07-23 |
| **Skill** | `sdd-reverse-engineer` → ready for `sdd-quality-auditor` + SDD-driven implementation |
| **Related slice** | `docs/sdd/panelin-chat-agent/` (chat/voice UI slice — subordinate; may lag tool counts) |

## In scope

- Shared brain: `agentCore.js`, `aiProviderConfig.js`, `providerCircuitBreaker.js`, `chatPrompts.js`
- Assistants control plane: `assistantRegistry.js`, `assistantsStatus.js`, `ASSISTANTS_ACTIVE`
- Tool runtime: `agentTools.js` (55 local / 51 prod 2026-07-23), OpenAPI, MCP `exec-tool`
- Calc contract: `calcLoopbackClient.js` + `AE-AGENT-CALC-CONTRACT.md`
- Channels: Panelin SSE chat, ML suggest, WA, Omni/canales, email-agent (Chatwoot), wolfboard, SuperAgent
- RAG / training: `rag.js`, `embeddings.js`, `trainingKB.js`, `autoLearnExtractor`, Dev panel
- Cost / obs: `costTelemetry.js`, `toolStats.js`, budgets, Omni daily USD cap
- Frontend consumers: `PanelinChatPanel`, `useChat`, Dev/Assistants panels, voice paths
- Tests/evals: `test:agent`, `test:agent-golden` (19), `eval:agent`, promptfoo presup

## Out of scope (v1)

- Full BOM/pricing engine internals (dependency via `/calc` only)
- Shopify / ML ETL pipelines except agent tool call sites
- Entire hub SPA modules unrelated to AI (finanzas UI, etc.)
- Cursor IDE agents / Claude Code team agents (documented elsewhere under `docs/team/AGENTS.md`)

## Success criteria

1. Sections 1–12 of `SDD.md` filled with CONFIRMED citations.
2. Actual-vs-goal matrix + `IMPLEMENTATION-GUIDE.md` with step TODOs for SDD-driven build-out.
3. Recreation checklist ≥90% falsifiable items evidenced.
4. Child slug `panelin-chat-agent` linked; tool-count drift called out explicitly.
