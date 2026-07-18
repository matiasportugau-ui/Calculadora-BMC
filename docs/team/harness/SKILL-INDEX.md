# Skill index — progressive disclosure

Coding agents must **not** load every skill into context. Use this index to pick 1–3 skills per task.

## Repo-local (`.claude/skills`, `.agents/skills`)

| Trigger | Skill | Path |
|---------|-------|------|
| promptfoo / LLM evals | promptfoo | `.claude/skills/promptfoo/SKILL.md` |
| Applied AI UI look | applied-ai-design | `.claude/skills/applied-ai-design/SKILL.md` |
| Remotion video | remotion-best-practices | `.agents/skills/remotion-best-practices/SKILL.md` |
| Failure → permanent harness fix | harness-ratchet | `.claude/skills/harness-ratchet/SKILL.md` |

## Workspace (`~/.claude/skills`) — high leverage for BMC

| Trigger | Skill |
|---------|-------|
| What's next / TODOs | `nxt` |
| Commit→push→CI→prod | `ship` |
| Prod bug visible in browser | `live-fix` |
| End of session handoff | `closeout` |
| Pre multi-agent run audit | `preflight` |
| Multi-agent orchestration | `team-orchestrator` |
| Quote pipeline / presupuestación | `presupuestacion-orchestrator` (Grok) / sheet-quote-pipeline |
| Bank ledger Metalog | `metalog-bank-ledger` |
| SDD architecture docs | `sdd-architect` |
| Autonomous long condition | `goal` (Grok) / set-goal |

## Load rules

1. Read `AGENTS.md` + this index first.  
2. Load full skill body only when the trigger matches.  
3. Prefer computational sensors (`gate:local`, fitness, goldens) over extra skills.
