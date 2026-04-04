---
name: bmc-panelin-chat
description: "Specialist for the Panelin AI chat system and Developer Training Mode. Knows PanelinChatPanel, PanelinDevPanel, useChat hook, agentChat SSE endpoint, training KB, chatPrompts, and the dev mode (Ctrl+Shift+D). Use when working on chat UI, Panelin responses, training corrections, KB entries, system prompt editing, devMode features, per-message Good/Correct buttons, or agentChat server route."
model: sonnet
---

# Panelin Chat Specialist — AI Chat + Training KB

**Project root:** `/Users/matias/Panelin calc loca/Calculadora-BMC`

---

## Architecture

```
Frontend                          Backend
─────────────────                 ──────────────────────────────
PanelinCalculadoraV3_backup.jsx   server/routes/agentChat.js   ← SSE endpoint
  └─ PanelinChatPanel.jsx            └─ server/lib/chatPrompts.js
       └─ PanelinDevPanel.jsx              └─ buildSystemPrompt()
  └─ src/hooks/useChat.js                       └─ trainingExamples injected
                                   server/routes/agentTraining.js  ← REST CRUD
                                   server/lib/trainingKB.js
```

## Key files

| File | Role |
|------|------|
| `src/components/PanelinChatPanel.jsx` | Chat drawer UI, messages, dev buttons |
| `src/components/PanelinDevPanel.jsx` | Train/KB/Prompt tabs (dev mode panel) |
| `src/components/PanelinCalculadoraV3_backup.jsx` | devMode state (~2153), toggleDevMode (~227), keyboard shortcut Ctrl+Shift+D (~2290) |
| `src/hooks/useChat.js` | Chat state, devMode flag, saveCorrection, reloadTrainingKB |
| `server/routes/agentChat.js` | SSE stream, devMode branch (~167), kb_match (~231) |
| `server/routes/agentTraining.js` | POST /agent/train, GET /agent/training-kb |
| `server/lib/trainingKB.js` | KB CRUD, findRelevantExamples() |
| `server/lib/chatPrompts.js` | buildSystemPrompt(), trainingExamples injection (~195-220) |

## Dev mode rules

- **Entry point:** `Ctrl/Cmd+Shift+D` only — no visible button for regular users
- DEV button in toolbar only renders when `devMode === true` (PanelinCalculadoraV3_backup.jsx)
- DEV button in chat header only renders when `devMode && onToggleDevMode` (PanelinChatPanel.jsx)
- Per-message Good/Correct buttons: only when `devMode && !isUser && msg.content`

## Training KB scope

Training KB is **chat-only** today. It feeds `buildSystemPrompt` via `findRelevantExamples()` in `agentChat.js`. It does NOT feed CRM suggest-response or ML sync. See `docs/team/DEV-TRAINING-MODE-SCOPE.md` for rationale and extension path.

## Style conventions (PanelinChatPanel.jsx)

Colors: `PRIMARY=#0071e3`, `SURFACE=#f5f5f7`, `BORDER=#e5e5ea`, `TEXT=#1d1d1f`, `SUBTEXT=#6e6e73`  
Inline styles only — no CSS modules, no Tailwind.  
Pill buttons: `borderRadius: 999`, `fontSize: 11`.

## Gates

```bash
npm run lint   # 0 errors required
npm test       # all tests pass
```

## Propagation

- If chat prompt changes → affects Panelin response quality → note in PROJECT-STATE
- If training KB schema changes → update agentTraining.js contract
- If devMode UI changes → verify keyboard shortcut still works, no visible UI leaks to regular users
