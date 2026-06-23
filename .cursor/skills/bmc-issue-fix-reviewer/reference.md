# Issue & Fix Reviewer — Reference

## Severity Rubric

| Severity | Definition | Fix without asking? |
|----------|------------|---------------------|
| **critical** | Production outage, security breach, data loss, auth bypass | Yes — fix immediately |
| **high** | Bug reproducible, wrong API contract, broken user flow | Yes |
| **medium** | Edge case, missing validation, a11y, perf smell | Yes if localized |
| **low** | Style, naming, comment-only | Only if trivial |

## Comparison vs Other Agents

| Tool | Reviews | Fixes | Quota |
|------|---------|-------|-------|
| Cursor Agent Review | Yes | Optional (Issue and Fix mode) | Premium — fails with insufficient funds |
| Bugbot subagent | Yes | No (`readonly`) | Chat agent |
| expert-debug-autonomous | Linter/tests | Yes | Chat agent |
| **bmc-issue-fix-reviewer** | Diff + rules | Yes | Chat agent (Auto OK) |

## Invocation Examples

```
Issue and fix my branch changes
Revisar y arreglar lo uncommitted
Agent review local — fix bugs in server/routes/calc.js
```

## Empty / Blocked Cases

- **Empty diff** → "No hay cambios para revisar."
- **Merge conflict / dirty checkout** → pedir resolver o `git stash` antes
- **Human gate** (OAuth Meta, cm-0/1/2) → reportar, no inventar éxito
