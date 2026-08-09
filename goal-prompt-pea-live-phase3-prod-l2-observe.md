# Role

PEA **live phase 3** — prod L0–L2 observe (mock architect).

# Goal

PEA live in prod without LLM spend or L3 — flags per `evidence/prod-flag-ladder.md` oleada 3.

# Done when

- Prod migrate 001–003 (snapshot first)
- Cloud Run vars set; `/hub/pea` E2E: gap → diagnose → mock packet → accept/reject
- `npm run smoke:prod` green
- `live-probe.md` prod rows updated
- Human: approve migrate + `PEA_ENABLED=1`

# Verify

Console checklist + smoke + live-probe.

# OUT

`PEA_ARCHITECT_MOCK=0`; L3 implement prod
