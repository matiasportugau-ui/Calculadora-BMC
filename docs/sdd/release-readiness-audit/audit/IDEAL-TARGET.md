# Ideal 100% — Release Readiness Audit Workflow

## Target composite: 100 (pass >= 90)

For this subsystem, ideal quality means a new maintainer can run the workflow safely and integrate it into release gates without guessing behavior.

## Ideal state by dimension

| Dimension | Ideal for this system |
|---|---|
| schema_completeness | Full SCHEMA-CONTRACT compliance with sections 1-12 and valid diagrams |
| c4_fidelity | Context and container views clearly show user, npm command, script, git, and GitHub API interactions |
| recreation_sufficiency | Includes standalone checklist with strict and normal usage, expected exit codes, and fail-safe sequence |
| evidence_grounding | Claims tagged as CONFIRMED/INFERRED/PROPOSED and backed by repo path:line evidence |
| ai_architecture_depth | Explicit N/A with supporting evidence that no AI runtime is involved |
| crosscutting_wa | Security/reliability/performance/observability/cost/sustainability tied to explicit operational controls |
| adr_quality | ADRs include context, decision, consequences, and alternatives considered |
| evolution_readiness | Versioned doc, glossary, risk table, and baseline-vs-current comparison notes |

## Acceptance test for "ideal"

1. A new engineer runs `npm run release:audit` and `npm run release:audit:strict` and understands differences from SDD alone.
2. The engineer can wire strict mode into CI gate behavior without additional tribal knowledge.
3. The engineer can interpret baseline outputs (`evidence/release-audit-baseline.txt`, `evidence/release-audit-strict-baseline.txt`) and reconcile blockers with safe sequence steps.
