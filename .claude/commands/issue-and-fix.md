# /issue-and-fix

Orchestrates local **Agent Review Issue and Fix** (replaces Cursor premium Agent Review).

## Load skill

Read and execute: `.cursor/skills/issue-and-fix/SKILL.md`

## Default

Mode `full`: Bugbot → bmc-issue-fix-reviewer → gate:local (+ security if auth touched).

## User args

- `fix-only` — skip Bugbot
- `uncommitted` — diff scope
- `security` — security-first pipeline
