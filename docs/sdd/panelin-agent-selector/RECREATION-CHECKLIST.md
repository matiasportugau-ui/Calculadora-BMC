# RECREATION-CHECKLIST — Panelin In-Chat Agent Selector

**SDD:** `docs/sdd/panelin-agent-selector/SDD.md` v1.1  
**Storage:** `localStorage["panelin-chat-ai-selection-v1"]` ← `useChat.js:7` (`STORAGE_AI`)

## Prerequisites

- [ ] Read SDD §§1–12 + §4.2 `resolveRealtimeModel`
- [ ] Repo `~/calculadora-bmc`, Node 20+

## Parent wire map (must all get selector)

| # | Parent | File:line | Props from useChat |
|---|--------|-----------|-------------------|
| 1 | Co-Work | `PanelinCoWorkPage.jsx:225` | `aiProvider`, `aiModel`, `aiOptions`, `aiOptionsError`, `setAiPick` |
| 2 | Backup embedded | `PanelinCalculadoraV3_backup.jsx:7848` | via `panelinChatPanelProps` |
| 3 | Backup floating | `…_backup.jsx:7866` | same spread |
| 4 | Backup detached | `…_backup.jsx:7904` | same spread |

- [x] Every row above passes selector props (Co-Work + backup props object)
- [x] No selector on main calculator chrome outside chat shell

## Phase 1 — Text selector UI

- [x] Create `src/components/ai/AgentModelSelector.jsx`
  - Options from `aiOptions.providers` + Auto
  - Calls `setAiPick("auto" | `${id}|` | `${id}|${modelId}`)`
  - Disables red readiness providers when live filter on
- [x] Mount under lights in `PanelinChatPanel` header
- [ ] Confirm network: next chat POST includes `aiProvider` / `aiModel` (manual)

## Phase 2 — Voice coupling

- [x] Implement pure `resolveRealtimeModel` (SDD §4.2) — unit tested
- [x] `POST /api/agent/voice/session` accepts optional `realtimeModel`
- [x] Allowlist: `config.openaiRealtimeModel`, `gpt-4o-realtime-preview`, `gpt-4o-mini-realtime-preview`
- [x] Reject non-allowlist with 400
- [x] `useVoiceSession({ realtimeModel })` from selection
- [x] UI copy when `aiProvider !== "openai"`: voice still OpenAI Realtime

## Phase 3 — Observability

- [ ] Client or server log `panelin_selector_pick` (provider/model only)
- [ ] Server log `panelin_voice_session` with resolved realtime model

## Done when

- [ ] SDD acceptance criteria (Appendix C) all true
- [ ] Unit tests for `resolveRealtimeModel` green
- [ ] Manual: chat Gemini → payload gemini; voice → realtime default or allowlisted model
