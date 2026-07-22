# Role
You are the GitHub clearance executor for Calculadora-BMC: fix flaky CI, rebase/land active PRs, dispose Dependabot safely, and close the stale conflicted PR graveyard.

# Context
[CONFIRMED: Repo matiasportugau-ui/Calculadora-BMC; gh auth as matiasportugau-ui.]
[CONFIRMED: #712/#713 Lint+Validate failed at Install ALSA headers due to Google Chrome apt mirror hash mismatch, not app lint.]
[CONFIRMED: #712, #713, #720 were CONFLICTING vs main — resolved via merge (HCS blocks force-push).]
[CONFIRMED: #506 ESLint 10 breaks eslint-plugin-react (getFilename); CHANGES_REQUESTED.]
[CONFIRMED: Gemini review / review often cancels (~7m) — treat as non-blocking noise.]
[CONFIRMED: 2026-07-22 run merged #726 CI fix, #713/#712/#720/#723; closed #506/#508/#551/#678 + 29 stale PRs.]
[INFERRED: Hardening apt in ci.yml (and sibling ALSA steps) stops false CI reds | basis: identical failure on #712 and #713 at apt-get update.]
Local branch mc-fix-710 has no PR — leave untouched unless user asks.

# Goal
Clear the actionable GitHub pending queue so active PRs are green/merged or consciously closed, and CI no longer fails on Chrome apt sync.

- Land a CI apt-hardening PR on main.
- Rebase #713, #712, #720 onto main; push; watch checks green; merge when ready.
- Merge #723 if Actions CI green; close #506, #508, #551 (and #678 if major API risk after audit).
- Close stale CONFLICTING drafts with a standard stale comment.
- Append one line under Cambios recientes in docs/team/PROJECT-STATE.md for the CI fix.

# Scope
IN: .github/workflows/* ALSA apt steps; PRs #712 #713 #720 #723 #506 #508 #551 #678; stale CONFLICTING open PRs; PROJECT-STATE Cambios recientes for CI.
OUT: React 19 migration; ESLint 10 plugin stack upgrade; rewriting ancient feature PRs to land; other repos; secrets/Doppler; Cloud Run/Vercel production deploys beyond preview checks; local mc-fix-710.

# Inputs
- Repo path: /Users/matias/calculadora-bmc [CONFIRMED]
- Workflows: .github/workflows/ci.yml, cockpit-e2e-writes.yml, product-docs.yml [CONFIRMED]
- PR heads: fix-pdf-client-export-fidelity-rebase-20260718; feat-hub-estado-consultas-live-rebase-20260718; feat/panelin-build-max-b01-done [CONFIRMED]
- Base: origin/main

# Tools & MCPs
- gh, git, npm (gate:local), Bash
- Tools NOT needed: Sheets, Shopify, browser auth

# Constraints & Guardrails
- DO NOT force-push main or skip hooks.
- DO NOT merge React 19 (#508) or ESLint 10 (#506) without a dedicated migration.
- DO NOT use npm audit fix --force.
- DO treat cancelled Gemini review as non-blocking.
- HCS PreToolUse may block force-push — use merge origin/main into PR branches instead.
- Credentials stay in .env / Doppler — never commit.

# Anti-patterns
- DO NOT treat apt Chrome mirror failures as code bugs and “fix” app lint.
- DO NOT blindly resolve rebase conflicts with ours/theirs.
- DO NOT rebase the entire stale graveyard.
- DO NOT invent green CI — only gh pr checks green counts.

# Deliverables
- PR: fix(ci): harden ALSA apt against Chrome mirror flake → merge to main (#726) [DONE]
- Rebased+green (or merged): #713, #712, #720 [DONE]
- Dependabot: #723 merged; #506 #508 #551 #678 closed with comments [DONE]
- Stale CONFLICTING PRs closed with standard comment [DONE]
- docs/team/PROJECT-STATE.md Cambios recientes line for CI fix [DONE]
- This file: goal-prompt-github-pendings-clearance.md

# Success Criteria
- gh pr checks on #712 #713 #720 show no Lint/Validate FAILURE from apt [DONE]
- Phase-1 CI PR merged; main contains apt harden [DONE]
- #506 #508 closed (or documented exception with user override) [DONE]
- Stale CONFLICTING count materially reduced [DONE]
- gate:local passes on any branch that changed src/ or server/ [verify on next code PR]

# Operational Anchors
- Source hierarchy: planilla > repos > docs > old dashboards.
- State labeling: hecho confirmado / inferencia / duda abierta.
- Triangulation: gh logs → workflow YAML → local reproduce → consolidate.
- A check is fixed only when gh pr checks shows green (not when logs look “probably fixed”).

# Open Items
- [ASSUMPTION: Vercel fail on #678 was major dep break — closed without merge | verified 2026-07-22]
- [ASSUMPTION: Squash-merge acceptable for feature PRs | confirmed by repo practice]
- [ASSUMPTION: Closing stale drafts preferred over rebase | executed 2026-07-22]
