# /release-audit — Safe production readiness audit

Run this command to verify, in one pass, what is uncommitted, unmerged, ahead/behind `origin/main`, and which PRs are still open before pushing to production.

## Command

```bash
npm run release:audit:strict
```

## Behavior

1. Fetches remotes (`git fetch --all --prune`).
2. Audits branch divergence (`origin/main...HEAD`).
3. Lists local-only and remote-only commits.
4. Lists unmerged local branches and stash entries.
5. Pulls latest open/closed GitHub PRs.
6. Prints blockers and a safe integration sequence.

`release:audit:strict` exits with code `2` if blockers are found (dirty tree, behind `origin/main`, or local `main` commits not pushed), so it can be used as a gate in automation.
