# Skill index — progressive disclosure

Coding agents must **not** load every skill into context. Use this index to pick 1–3 skills per task.

## Repo-local (`.claude/skills`, `.agents/skills`, `.cursor/skills`)

| Trigger | Skill | Path |
|---------|-------|------|
| promptfoo / LLM evals | promptfoo | `.claude/skills/promptfoo/SKILL.md` |
| Applied AI UI look | applied-ai-design | `.claude/skills/applied-ai-design/SKILL.md` |
| Remotion video | remotion-best-practices | `.agents/skills/remotion-best-practices/SKILL.md` |
| Failure → permanent harness fix | harness-ratchet | `.claude/skills/harness-ratchet/SKILL.md` |
| Co-Work / Admin / Gmail OCR / wa_lead | panelin-cowork | `.cursor/skills/panelin-cowork/SKILL.md` |
| Multi-Context Agent (tabs shared + email R/W) | panelin-email-admin SDD | `docs/sdd/panelin-email-admin/SDD.md` |
| Panelin chat UI + Training KB | bmc-panelin-chat (agent) | `.claude/agents/bmc-panelin-chat.md` |
| Panelin-Gym / train / gold runs | panelin-gym | `.cursor/skills/panelin-gym/SKILL.md` |

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
| SDD family (design / as-built / score / evolve) | `sdd-kit` → then one of: `sdd-architect`, `sdd-reverse-engineer`, `sdd-quality-auditor`, `sdd-evolution-loop` |
| As-built system map (read first) | Bundle: `docs/sdd/calculadora-bmc/SDD.md` + `audit/ARCHITECT-IMPROVEMENTS.md` |
| Autonomous long condition | `goal` (Grok) / set-goal |

## Load rules

1. Read `AGENTS.md` + this index first.  
2. For non-trivial architecture work, open `docs/sdd/calculadora-bmc/SDD.md` (progressive sections) before loading sdd-* skills.  
3. Load full skill body only when the trigger matches — **one** sdd-* sub-skill per task.  
4. Prefer computational sensors (`gate:local`, fitness, goldens) over extra skills.  
5. Product arch backlog = `ARCHITECT-IMPROVEMENTS.md` (A1–A6); GAP-PLAN = documentation gaps only.
