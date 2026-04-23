# /nxt — Workspace snapshot & next steps

Core philosophy: **Fix → Deploy → Fix → Deploy.** Get each improvement live before starting the next. Stability and continuity over accumulation.

## What to do when invoked

Run these steps, then generate the report below:

1. Run `git status --short` and `git log --oneline -10` to see current branch, uncommitted work, and recent history.
2. Read `docs/team/PROJECT-STATE.md` if it exists — it holds live project state and pending items.
3. Read `docs/dev-trace/AUTOTRACE-UNRELEASED.md` if it exists — unreleased changes pending deploy.
4. Identify: what is uncommitted, what is committed but not deployed, what is live.
5. Infer active development areas from file paths in git status + recent commits.
6. Score each active area for quality and completeness based on what you can observe.
7. Output the structured report using the format below.

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
