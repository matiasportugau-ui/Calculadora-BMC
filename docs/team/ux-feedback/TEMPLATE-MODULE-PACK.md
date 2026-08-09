# Module pack — `<slug>`

> Copy to `docs/team/ux-feedback/module-packs/<slug>.md`.  
> Used by **OMFT PREP** (`operator-module-final-test`). Edit success criteria before a live run.

---

## 1. Identity

| Field | Value |
|-------|--------|
| **Slug** | `<slug>` |
| **Title** | |
| **Owner / product area** | |
| **Default base URL** | `https://calculadora-bmc.vercel.app` |
| **Primary routes** | e.g. `/logistica` |
| **Auth required** | yes \| no \| partial |
| **Last pack update** | YYYY-MM-DD |

## 2. What this module is for (1–3 sentences)

…

## 3. Primary screens / surfaces

| Surface | Route or entry | Notes |
|---------|----------------|-------|
| | | |

## 4. Happy-path skeleton (optional checklist)

Operators may skip or reorder. This is a **map**, not a rigid script.

1. …
2. …
3. …

## 5. Success criteria (operator POV — edit before run)

- [ ] …
- [ ] …
- [ ] …

## 6. Real data / fixtures needed

| Need | Example | Secret? |
|------|---------|---------|
| Signed-in account | prod operator | yes — do not commit |
| Sample order / quote | client name only in reports | redact ids if needed |
| PDF / adjunto | Drive or Dropbox link | public test link preferred |

## 7. Out of scope (this pack)

- …
- …

## 8. Known recent context (refresh in PREP)

| Item | Value |
|------|--------|
| `origin/main` tip (if checked) | |
| Related merges / notes | |
| Known open bugs / drafts | |

## 9. Related docs (links only)

- SDD: …
- Prior UX reports: …
- Handoffs: …

## 10. Capture protocol (fixed)

| Field | Meaning |
|-------|---------|
| Step # | Order |
| ACTION | What the operator did |
| EXPECT | Correct behavior (operator POV) |
| OBSERVED | What happened |
| Verdict | OK \| FAIL \| CONFUSING \| BLOCKED |
| Fig | Photo id |
| Severity | P0 \| P1 \| P2 if FAIL |

## 11. Code touch hints (optional, non-binding)

Plausible paths for implementers after intake (grep, do not assume):

- `src/…`
- `server/…` or API routes
- `docs/…`
