# WA Archive Review Training Mode

**Status:** v1 shipped (offline pipeline + HITL + pilot import)  
**Last updated:** 2026-07-14  
**Related:** [DEV-TRAINING-MODE-SCOPE.md](../../DEV-TRAINING-MODE-SCOPE.md), [Panelin-Gym](../../../.cursor/skills/panelin-gym/SKILL.md)

---

## Purpose

Turn the local WhatsApp Business Web export (`~/whatsapp-export`) into **human-approved** Training KB upgrades for Panelin — without fine-tuning weights, without scraping WA live, and without putting customer PII into LLM calls or permanent KB.

## Architecture

```
whatsapp-export/data/conversations.json
        │
        ▼
review/normalize_chats.py  →  corpus.redacted.jsonl  (gitignored)
        │
        ▼
review/extract_candidates.py  →  candidates.pending.json + .csv  (gitignored)
        │                         (heuristic Q→A; optional --llm later)
        ▼
Human HITL (edit/approve/reject in CSV or JSON)
        │
        ▼
review/approved-batch.json  (training-batch schema)
        │
        ▼
npm run panelin:train:import -- --file …   →  data/training-kb.json
        │
        ▼
chatPrompts / findRelevantExamples  (chat channel; see DEV-TRAINING-MODE-SCOPE)
```

## PII rules (hard)

1. Chat display names are **hashed** in the redacted corpus (`chat_id`), never stored as plaintext in review artifacts destined for LLM.
2. Phones / emails / long digit runs in message text are replaced with `[PHONE]` / `[EMAIL]` / `[ID]` before any extract step.
3. Do **not** commit `data/`, `analysis/*.csv`, or `review/*.json(l)` / `review/*.csv` — only scripts + this doc + reports without raw PII.
4. Prefer BMC (`BMC URUGUAY`) replies as `goodAnswer` sources. Pending chats (last msg from client) may contribute **questions only** for FAQ gap lists — never invent answers.

## Relation to Dev Training Mode

| Surface | Role |
|---------|------|
| Ctrl/Cmd+Shift+D + PanelinDevPanel | Live chat train / Good-Correct / KB edit |
| WA Archive Review (this mode) | Batch offline mine of historical WA |
| `POST /api/agent/autolearn` | Live conversation extract + approve queue |
| `npm run panelin:train:import` | Bulk load approved JSON into Training KB |

Training KB still feeds **chat** system prompt primarily ([DEV-TRAINING-MODE-SCOPE](../../DEV-TRAINING-MODE-SCOPE.md)). Optional field `goodAnswerWA` may be set for shorter channel tone; wiring into WA outbound is separate.

## Runbook (repeat after next export)

```bash
cd ~/whatsapp-export
# 1) Ensure fresh data/conversations.json (drive_export.js) — optional
python3 review/normalize_chats.py
python3 review/extract_candidates.py          # heuristic; $0 LLM
# optional: python3 review/extract_candidates.py --llm --max-chats 20 --usd-cap 5
python3 review/build_pilot_batch.py --limit 25

cd ~/calculadora-bmc
npm run panelin:train:import -- --file ~/whatsapp-export/review/approved-batch.json --dry-run
# With API up + API_AUTH_TOKEN:
npm run panelin:train:import -- --file ~/whatsapp-export/review/approved-batch.json
```

## Cost control

- Default extractor is **heuristic** (no LLM) — soft cap N/A.
- `--llm` mode (future/optional) must log estimated USD and abort above `--usd-cap` (default 5).

## Out of scope (v1)

- Dev Panel UI tab for WA review (CSV/JSON HITL is enough)
- Brain lessons / GCS `lessons.json`
- Prod Cloud Run import without explicit owner OK
- Re-scrape / QR login
