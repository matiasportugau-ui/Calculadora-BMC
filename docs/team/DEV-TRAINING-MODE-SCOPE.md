# Developer Training Mode — Architecture Scope

**Status:** Deliberate scope decision (not a bug).
**Last updated:** 2026-04-04

---

## What training KB actually feeds today

Training entries saved via `POST /agent/train` are stored by `server/lib/trainingKB.js` and injected
as few-shot examples into the chat system prompt via `server/lib/chatPrompts.js` → `buildSystemPrompt`
→ `findRelevantExamples()`. This happens exclusively inside `server/routes/agentChat.js` (the SSE
chat endpoint).

**Scope: chat only.**

---

## What training KB does NOT feed

| Module | Path | Status |
|--------|------|--------|
| CRM suggest-response | `server/lib/aiCompletion.js` | Not connected — builds its own prompt independently |
| ML price sync | `server/ml-crm-sync.js` | Not connected — no prompt involved |

The mermaid diagram in the original `panelin_developer_training_mode` plan showed training feeding both
CRM and ML. That diagram described a future vision, not the current implementation.

---

## Future extension path

If the business decides to extend training KB to CRM or ML, the entry point is already clean:

```js
import { findRelevantExamples } from "../lib/trainingKB.js";
```

Import this in `aiCompletion.js` or `ml-crm-sync.js` and prepend the returned examples to whichever
prompt is built there. No changes to `trainingKB.js` itself are needed.

---

## Why this scope was chosen

- CRM suggest-response and ML sync have different latency budgets and prompt structures — coupling them
  to the chat training loop would require non-trivial refactoring with unclear ROI.
- Training KB is new; validating it in the chat channel first reduces risk before broader rollout.
- Keeping scope small makes the training loop easier to audit and debug.
