# /nxt — Workspace snapshot & next steps

Core philosophy: **Fix → Deploy → Fix → Deploy.** Get each improvement live before starting the next. Stability and continuity over accumulation.

## What to do when invoked

Run these steps, then generate the report below:

1. Run `git status --short` and `git log --oneline -10` to see current branch, uncommitted work, and recent history.
2. Read `docs/team/ROADMAP.md` — canonical mission, vision, area scores, exit criteria, and ordered next steps. Use this as the baseline: update scores based on what changed since it was written, carry forward unresolved items, and mark completed ones.
3. Read `docs/team/PROJECT-STATE.md` if it exists — live project state, recent changes, pending human gates (cm-0/1/2).
4. Read `docs/dev-trace/AUTOTRACE-UNRELEASED.md` if it exists — unreleased changes pending deploy.
5. Identify: what is uncommitted, what is committed but not deployed, what is live.
6. Compare current git state against ROADMAP.md items — what moved forward, what is new, what is still blocked.
7. Score each active area: start from ROADMAP.md baseline scores and adjust up/down based on evidence (new commits, fixes, open issues).
8. Output the structured report using the format below.

## Report format

```
# /nxt — Workspace snapshot

## Situación actual
Branch: [name] | Uncommitted: [N files] | Last commit: [hash + msg] | Deploy: [live/pending/unknown]

## Áreas activas y scores

| Área | Calidad | Completitud | Estado |
|------|---------|-------------|--------|
| [Area name] | 🟢 X/10 | 🟡 Y/10 | Stable / Active / Broken |

(Score guide: 🔴 <5 | 🟡 5–7 | 🟢 8–10)

## Próximos pasos — ordenados por impacto × criticidad

### 🔴 CRÍTICO | 1. [Title]
- **Situación**: what is broken or blocked
- **Área**: which files / modules
- **Acción "get it live"**: [specific fix] → `npm run gate:local` → commit → deploy
- **Impacto**: who or what breaks if not resolved

### 🟠 ALTO | 2. [Title]
- **Situación**: ...
- **Área**: ...
- **Acción "get it live"**: ...
- **Impacto**: ...

### 🟡 MEDIO | 3. [Title]
...

### 🔵 BAJO | 4. [Title]
...
```

## Priority labels

| Label | Meaning |
|-------|---------|
| 🔴 CRÍTICO | Broken in production or blocks other work |
| 🟠 ALTO | User-facing, high business value |
| 🟡 MEDIO | Quality, completeness, or tech debt |
| 🔵 BAJO | Nice to have, low urgency |

## "Get it live" action sequence (always include this)

Every next step must end with a concrete deploy path:
1. Make the fix
2. `npm run gate:local` (lint + test)
3. `git commit` with type prefix (feat/fix/refactor/docs)
4. Push to branch → PR → merge to main → CI deploys to Vercel + Cloud Run

## Language

Respond in **Spanish** when the user writes in Spanish. Technical terms, commands, and file paths stay in English.
