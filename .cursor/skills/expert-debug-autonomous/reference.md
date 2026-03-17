# Expert Debug Autonomous — Reference

## Priority Criteria

| Severity | Source | Example |
|----------|--------|---------|
| Critical | Build fails | Syntax error, missing module |
| Error | Linter/TS | ESLint error, TypeScript error |
| Warning | Linter/TS | Unused var, implicit any |
| Info | cSpell | Unknown word |

## Edge Cases

- **Circular dependency** — Refactor to break cycle; do not add `// eslint-disable`.
- **External package type missing** — Add `@types/` or declare module; avoid `any`.
- **cSpell in code** — Prefer `cspell.json` over inline `cspell:ignore`.
- **Test flake** — Fix test or code; do not skip without reason.

## Iteration Logic

```
iteration = 0
prev_count = ∞
while iteration < 5:
  problems = gather()
  if len(problems) == 0: done
  if len(problems) >= prev_count: stop (no progress)
  fix_next_batch(problems)
  prev_count = len(problems)
  iteration++
```

## Output Format

```
=== Debug Cycle Complete ===
Iterations: N
Files modified: X
Issues fixed: Y
Remaining: Z (list if any)
```
