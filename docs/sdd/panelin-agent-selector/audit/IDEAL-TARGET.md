# Ideal 100% — Panelin In-Chat AI Agent Selector

## Target composite: 100 (pass ≥90)

## System class

**Feature subsystem** of Panelin chat (Vite SPA + Express): in-chat provider/model selector with shared preference for text + constrained voice (OpenAI Realtime).

## Must-have for 100%

| Artifact | Ideal |
|----------|--------|
| SDD.md §§1–12 | Present (already) |
| `RECREATION-CHECKLIST.md` | Parent file list, prop signatures, allowlist function tests |
| Exact wire map | Every mount of PanelinChatPanel → which props from useChat |
| Voice mapping | Deterministic function: `(aiProvider, aiModel) → realtimeModel \| default` |
| Observability | Log `selector_pick` + voice `realtimeModel` used (names only) |
| C4Component | Optional L3 for AgentModelSelector |

## Section-specific ideal

### §5 / parents
Document each entry:

| Parent | Path | Props to pass |
|--------|------|----------------|
| Co-Work | `PanelinCoWorkPage.jsx` | `aiProvider`, `aiModel`, `aiOptions`, `setAiPick` from `useChat` |
| Floating / embedded | primary calculator host | same |
| Detached window | if any | same |

### §6 Voice mapping
```
function resolveRealtimeModel(aiProvider, aiModel, defaultModel, allowlist):
  if aiProvider not in (openai, auto): return defaultModel
  if aiModel in allowlist: return aiModel
  return defaultModel
```

### §8
Cite `OPENAI_REALTIME_MODEL` from `server/config.js` field name only.

### §9
Add one observability event + sustainability note (prefer cheap models in auto).

## Acceptance test

> Implementer with only SDD + checklist wires selector in chat and voice mint override; text payload shows selected provider; voice session response shows allowlisted realtime model; red providers disabled.

## Out of ideal scope

- Multi-provider Realtime voice (Claude/Gemini WebRTC)
- Main calculadora toolbar selector
