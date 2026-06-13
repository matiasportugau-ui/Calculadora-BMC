---
name: bmc-propagation-automate
description: >
  Automated propagation of changes across the BMC/Panelin team per PROJECT-TEAM-FULL-COVERAGE.md §4 and §5.
  Wraps scripts/propagate-change.mjs for use inside full automated runs (GOALs), after collector tasks, or any multi-area change.
  Handles PROJECT-STATE updates, Pendientes, centralization status markers, reports, and "next prompt" handoffs.
  Use at the end of any significant automated change (e.g. "run the propagation automate", "propagate this collector", "full run + propagate").
---

# BMC Propagation Automate

Official automation for the project's propagation protocol (no more manual copy-paste of §4 rules).

## When to Use
- End of a full automated GOAL run (collector, centralization, new feature, etc.)
- After implementing something that touches multiple areas (e.g. Panelin + Shopify + docs + STATE)
- User says: "propagate", "run propagation", "automate the sync", "close the run with propagation"
- As the final step inside a master prompt (recommended for "full automated run" discipline)

## Core Behavior
1. Detects (or is told) what changed (title, description, area, files, optional commit).
2. Parses the live propagation table from `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4.
3. Computes affected roles with keyword + direct table matching (plus always-on core sync roles).
4. Appends a high-signal entry to `docs/team/PROJECT-STATE.md` (Cambios recientes).
5. Adds follow-up items to "Pendientes de sincronización" when roles are affected.
6. For `product-centralization` area: marks the status doc as "shipped".
7. Emits a detailed report in `.runtime/propagation-report-*.md`.
8. Optional: emits a ready-to-paste "Updated Literal Next Prompt" handoff.

All updates follow the exact style and rules from AGENTS.md + PROJECT-TEAM-FULL-COVERAGE.md §5.2.

## Invocation (inside an agent / master prompt)
```bash
node scripts/propagate-change.mjs \
  --title "Product Centralization: Shopify-first collector implemented" \
  --area "product-centralization" \
  --description "Implemented ... . Completes collection baseline per PRODUCT-CENTRALIZATION-STATUS.md." \
  --files "scripts/collect-catalog-to-panelin.mjs,..." \
  --auto-next-prompt
```

Recommended flags for full automated runs:
- `--auto-detect` → pulls changed files + commit from git (zero-config in agent sessions)
- `--dry-run` → preview only (great for the "plan" phase of a GOAL)
- `--auto-next-prompt` → produces the handoff prompt for the next session

Always run **after** verification/gates in a collector or feature GOAL, and **before** declaring the run 100% complete.

## Integration Pattern (in a master GOAL prompt)
At the very end of the "Verifiable Completion Condition" and "Master Plan" sections, add a final atomic step:

> **Final automated propagation step**  
> Call `node scripts/propagate-change.mjs --title "..." --area "..." --description "..." --files "..." --auto-next-prompt` (use `--auto-detect` when inside a git-tracked branch).  
> This closes the loop on §4/§5, updates STATE, produces the report + next-prompt handoff.  
> Only then mark the GOAL complete.

## References
- Script: `scripts/propagate-change.mjs` (the actual automate)
- Propagation table: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4
- Sync protocol: same file §5
- Project Team Sync skill: `bmc-project-team-sync`
- Cross-Sync Propagation (calculadora-specific): `bmc-cross-sync-propagation`
- Example centralization collector master prompt: see previous GOAL artifacts in `.runtime/`

## Tips for Full Automated Runs
- Call it from the main agent or a dedicated "closer" subagent.
- Pass the exact title/description from the GOAL so the STATE entry matches the run narrative.
- The generated report + next prompt are the canonical handoff for the next person/session.
- Combine with `todo_write` (mark a "propagation" todo as the last one).
- In a GOAL prompt, make the verifiable condition require: "propagation report + STATE entry + (if applicable) centralization marker exist and are correct."

This skill turns the previously manual "after every change, remember to propagate" rule into a one-line, repeatable, auditable step at the end of any automated run.