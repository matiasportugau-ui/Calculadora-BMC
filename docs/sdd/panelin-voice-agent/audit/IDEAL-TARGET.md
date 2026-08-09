# Ideal 100% — Panelin Voice Agent SDD

## Target composite: 100 (pass ≥90) — current **91**

## System class

Bounded **voice feature subsystem** (dual transport: chat STT→agent + OpenAI Realtime Live) with improvement ladder to unified-brain voice agent.

## Must-have for 100%

| Item | Ideal |
|------|--------|
| As-built dual stack | Done |
| Target architecture | Done (brain vs transport) |
| Tier ladder + sprints | Done |
| Tool-bridge recreation detail | Spec: module path, I/O schema, mapping from Realtime function names → agent tools |
| Enumerate Live tools | Full `VALID_ACTION_TYPES` + tools[] table from agentVoice.js |
| C4Component L3 | HF path components vs Live path components |
| Exact path:line | Replace `65+` / `286+` with exclusive lines |
| Golden voice scripts | Named scripts in checklist for S1 verification |

## Acceptance for “ideal doc”

Implementer can start **Tier 2 tool bridge** without opening agentVoice.js first — only from SDD + checklist.
