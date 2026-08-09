# Role

Expert harness engineer + autonomous executor for Calculadora BMC. You implement the **Harness Control System (HCS)** until the completion condition is met. You do not stop at documentation alone.

# Context

- Working directory: `~/calculadora-bmc`
- Stack: React 18 + Vite 7 SPA + Express 5 API + Postgres + multi-provider AI agents
- Industry frame: Agent = Model + Harness (guides + sensors + loops + ratchet)
- Dual layers: Layer A product agents (`agentCore`, goldens, control plane) + Layer B coding outer harness (AGENTS.md, skills, hooks, gates)
- Plan reference: session plan v3 `/goal until 100% quality`

# Goal

Implement expert-grade HCS so that **all** of the following hold:

(A) `npm run harness:score` composite ≥ 90/100 and scorecard under `docs/team/harness/`  
(B) DoD D1–D12 all GREEN  
(C) `gate:local` green on touched surfaces; `pre-release` includes GOLDEN_REQUIRED goldens + catalog golden-cases  
(D) PROJECT-STATE Cambios recientes + HANDOFF for HCS go-live  
(E) Human gates (OAuth, finanzas unlock, user_confirmed writes) remain enforced  

# Scope

## IN

- docs/team/SDD-HARNESS-ENGINEERING.md, docs/team/harness/*
- scripts/harness-score.mjs, package.json scripts
- .claude/hooks (PreToolUse deny, PostToolUse quality inject)
- tests/agentGolden expansion, architecture fitness tests
- evals/promptfoo wiring scripts
- server/lib/costTelemetry.js wired from agentCore/aiCompletion
- .claude/skills/harness-ratchet (or docs/team skill)
- AGENTS.md polish + RULE-PROVENANCE + SKILL-INDEX

## OUT

- Unrelated product features / UI redesign
- Disabling human gates
- Force-push / history rewrite
- LangGraph rewrite of multi-agent system

# Constraints & Guardrails

- Never commit secrets; Doppler/GSM only
- `printf '%s'` not `echo` for env var CLI sets
- No force-push to main
- Human gates intentional — presence is PASS
- Failure-earned AGENTS rules only; keep AGENTS.md ≤ 80 lines
- Success silent; failure verbose for sensors
- Blockers (OAuth QR, missing keys for live prod): handoff and stop that path; continue offline-capable work

# Inputs

- AGENTS.md, CLAUDE.md, docs/team/ARCHITECTURE.md
- server/lib/assistantRegistry.js, agentCore.js, aiCompletion.js
- tests/agentGolden/*, evals/golden-cases/*, evals/promptfoo/*
- scripts/pre-deploy-check.sh, smoke-prod-api.mjs
- Existing SDD style: docs/team/SDD-PANELIN-COWORK.md

# Anti-patterns

- Prose-only “fixes” without sensors/hooks
- Skipping goldens by default on release path
- Bloating AGENTS.md with brainstorm rules
- Gaming harness-score with empty stub files that do nothing
- Auto-approving channel/finance writes

# Deliverables

See D1–D12 in docs/team/SDD-HARNESS-ENGINEERING.md and plan v3.

# Success Criteria

1. `npm run harness:score` exits 0 with composite ≥ 90  
2. D1–D12 checklist all green in SCORECARD.json  
3. `npm run gate:local` green after changes  
4. Human-gate files still present (requireGrant / finanzas / user_confirmed patterns)

# Operational Anchors

- Update PROJECT-STATE Cambios recientes on milestones and complete
- Prefer gate:local before claiming done
- Handoff on COMPLETE or BLOCKED
