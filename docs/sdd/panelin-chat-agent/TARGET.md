# TARGET — panelin-chat-agent

| Field | Value |
|-------|-------|
| **Slug** | `panelin-chat-agent` |
| **System name** | Panelin Chat Agent (BMC) |
| **Repo** | `/Users/matias/calculadora-bmc` (package `calculadora-bmc` v3.1.5) |
| **Depth** | Recreation-grade for the **AI agent surface** (chat + tools + voice + RAG/KB + training) |
| **Date** | 2026-07-18 |
| **Skill** | sdd-reverse-engineer → quality-auditor → evolution-loop → architect (target-state) |

## In scope

- Frontend: `PanelinChatPanel`, `useChat`, voice (`useHandsFreeVoice`, `useVoiceSession`, `PanelinVoicePanel`, `/panelin/live`)
- Backend: `server/routes/agentChat.js`, `agentVoice.js`, `agentTraining.js`, `agentTranscribe.js`, `agentFeedback.js`, `agentConversations.js`
- Brain: `agentCore.js`, `agentTools.js` (48 tools), `chatPrompts.js`, `rag.js`, `embeddings.js`, `costTelemetry.js`, `budget.js`, training KB
- Ops/docs: `docs/team/runbooks/PANELIN-IA-OPS.md`, `docs/team/PANELIN-CHAT-AGENT-SEC.md`
- Tests: `npm run test:agent`, `test:agent-golden`, `eval:agent`, voice probes

## Out of scope (v1)

- Full calculator BOM engine internals (referenced as dependency via loopback `/calc`)
- Omni inbox product (adjacent consumers of `agentCore`)
- Shopify / ML ETL pipelines except where agent tools call them
- Entire hub SPA modules unrelated to Panelin chat

## Success criteria

1. Sections 1–12 filled with CONFIRMED citations.
2. Recreation checklist ≥90% falsifiable items evidenced.
3. Quality-auditor composite ≥90 after evolution-loop.
4. Architect emits improved **target-state** SDD (`SDD-TARGET.md`) without inventing undeployed APIs as current fact.
