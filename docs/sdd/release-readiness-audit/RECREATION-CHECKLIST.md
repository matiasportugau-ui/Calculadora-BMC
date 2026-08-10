# RECREATION-CHECKLIST — Release Readiness Audit Workflow

## Inputs

- [x] Repository contains `scripts/release-readiness-audit.mjs`
- [x] `package.json` includes `release:audit` and `release:audit:strict`
- [x] `.claude/commands/release-audit.md` exists

## Local recreation

1. [x] Run `npm run release:audit`
2. [x] Confirm output sections include:
   - Current Branch & Status
   - Main Divergence
   - Blockers
   - Local-only/Remote-only commits
   - Top branch divergence
   - Unmerged branches
   - Stash entries
   - Latest Open PRs / Latest Closed PRs
   - Recommended Safe Sequence
3. [x] Run `npm run release:audit:strict`
4. [x] Confirm strict returns `2` when blockers exist

## Evidence captured

- [x] `evidence/release-audit-baseline.txt`
- [x] `evidence/release-audit-strict-baseline.txt`

## Operational usage

- [x] Human runbook command documented at `.claude/commands/release-audit.md`
- [x] Strict mode behavior documented for automation gate

## Expected non-goals

- [x] No branch mutation or auto-fix operations
- [x] No dependency on external paid services
