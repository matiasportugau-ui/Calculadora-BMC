# Squad Knowledge — H1–H4

Track **H-Knowledge** (not hardening Track H).

| PR | Deliverable | Files |
|----|-------------|-------|
| H1 | Prompt + model registry contract | `aiRegistry.js`, `GET /api/internal/omni/prompts/:taskKey/active` |
| H2 | RAG embed pipeline | `knowledge/embedPipeline.js`, job type `embed` |
| H3 | KB bridge for omni context | `knowledge/kbBridge.js` → suggest augmentation |
| H4 | Eval + feedback loop | `knowledge/evalFeedback.js`, `GET /api/omni/ai/eval` |

**Contract:** Agents consume prompts via internal endpoint — do not edit registry from Agents squad.

**Rollback:** `RAG_ENABLED=0` disables embed; legacy `trainingKB.js` remains.
