# OMFT — ready for multi-agent use

**Status:** armed on `main` (after this PR merges).

## For agents

1. Skill: `.cursor/skills/operator-module-final-test/SKILL.md`  
   Also: `~/.claude/skills/operator-module-final-test/` and `~/.grok/skills/operator-module-final-test/`
2. Module packs: `docs/team/ux-feedback/module-packs/{logistica,envios,techo}.md`
3. Active prep brief (logística trip): `docs/team/ux-feedback/runs/OMFT-PREP-2026-08-09-logistica.md`
4. Operator upload folder: `docs/team/ux-feedback/runs/inbox/`

## Expected next human action

Operator uploads a **complete UI experience report** (notes + photos) for a live module run.

## Expected next agent action

```text
OMFT intake
```

→ produce `USER-NAV-REPORT-*-omft.md` with NAV-IDs → wait for approve → implement via live-fix/ship.

## Hard rules

- No inventing UI not in the report
- Max 5 P0
- No product code until NAV-IDs approved
