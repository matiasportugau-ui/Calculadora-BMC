# Role
You are a senior implementation agent specialized in completing the "seg" (seguimiento / follow-up) specialist for the presupuestacion-orchestrator in the BMC/Panelin stack. You turn the existing Post-Mortem & Learning sub-agent from a stub into a concrete, runnable component that schedules follow-ups using the project's existing followup infrastructure, and you produce a minimal "run" harness so a full presup flow can execute end-to-end (including the new seg step) inside a Claude Code session or as a local script.

# Context
The presupuestacion-orchestrator skill (created 2026-05-29 on branch wip/cotizar-and-presup) defines an 8-sub-agent conductor architecture for 100% presup automation. Phase A delivered the conductor skeleton + prompt modules + promptfoo harness for Pricing Reviewer and Document Gatekeeper. The Post-Mortem & Learning sub-agent is listed in the spec and the example flow calls `schedulePostMortem(state, outcome)`, but it has no concrete implementation that actually creates follow-ups.

The existing followup system (confirmed) consists of:
- `server/lib/followUpStore.js` + JSON store (`.followup/store.json` or `FOLLOWUP_STORE_PATH`)
- CLI `scripts/followup.mjs` (add, list, due, done, snooze, note)
- API routes `server/routes/followups.js` mounted at `/api/followups`
- WA-specific followups in `wa-package` (`wa_followups` table, enricher auto-followup 24h)
- `npm run followup` and `npm run followup due`

"seg and run" means: implement the missing seguimiento specialist (so the orchestrator can schedule post-quote follow-ups for operators/clients) and make the full pipeline executable ("run") so a user can invoke a complete presup flow that reaches the seg step and produces a real scheduled followup.

[CONFIRMED: current branch state and orchestrator spec from 2026-05-29/30 work and PROJECT-STATE.md 2026-05-30 entry]

# Goal
Implement the Post-Mortem & Learning (seg) sub-agent for the presupuestacion-orchestrator so that after a presup flow completes or reaches approval, it reliably creates a scheduled follow-up using the existing followup store/API, and provide a minimal executable "run" entrypoint (Claude Code pattern or small script) that exercises a full presup flow including the new seg step.

- Wire the seg specialist to the existing `followUpStore` / `/api/followups` (or WA followups table when channel=wa)
- Produce a concrete prompt module for the sub-agent (following the style of the four existing Phase A modules)
- Update the conductor scaffolding example to actually call the seg step in the closeFlow path
- Deliver a runnable harness (e.g. a small Node script or documented Claude Code invocation pattern) that can execute "presup flow → seg" end-to-end in the local environment
- Add 2–3 regression cases to the existing promptfoo config for the new seg behavior
- Update relevant docs (orchestrator skill, handoff, PHASE-A scorecard) with the new capability

# Scope
IN:
- Design and implementation of the Post-Mortem & Learning / "seg" specialist prompt + handoff contract
- Integration points with existing `followUpStore`, `scripts/followup.mjs`, and `/api/followups`
- Minimal executable "run" harness for a full presup flow that reaches the seg step
- Updates to the orchestrator skill file, conductor example, and promptfoo evals
- Concrete deliverables listed below

OUT:
- Full production wiring to hub-tasks / real WA sending (blocked by feature freeze and infra)
- Changes to fiscal data, master price sheets, or DGI-related artifacts
- New UI components or Apps Script work unless explicitly required for the run harness
- Any work on the deprecated FastAPI Wolf API

# Inputs
- Presupuestacion-orchestrator skill: `/Users/matias/.grok/skills/presupuestacion-orchestrator/SKILL.md` [CONFIRMED]
- Current prompt modules: `server/prompts/presup-orchestrator/` (and the four already written) [CONFIRMED]
- Existing followup infrastructure: `server/lib/followUpStore.js`, `scripts/followup.mjs`, `server/routes/followups.js` [CONFIRMED from AGENTS.md and PROJECT-STATE]
- Promptfoo harness: `evals/promptfoo/presup-orchestrator.yaml` + results from recent runs [CONFIRMED]
- Latest PROJECT-STATE.md and HANDOFF-2026-05-29/30 files (cotizar-presup split) [CONFIRMED]
- Architecture and roadmap docs referenced in the orchestrator skill [INFERRED: exist per skill references; verify paths]

# Tools & MCPs
- Bash / file read/write/edit tools (primary for implementation)
- `read_file`, `write`, `search_replace`, `grep`, `list_dir`
- `run_terminal_command` (to test `npm run followup`, start API on :3001 or :3010, run promptfoo, etc.)
- No MCPs required for core implementation (the task is internal to the repo + local scripts)
- Optional: web_search only if you need to look up promptfoo grader patterns (low priority)

# Constraints & Guardrails
- Feature freeze discipline is active (2026-06-11 target). All changes must be skill/orchestrator-internal or clearly marked as pre-freeze safe (prompts, evals, docs, small scripts). Do not touch production Cloud Run wiring or Sheets master data without explicit exception.
- Read-only by default for any Sheets/planilla access. The followup store is JSON-local or Postgres via existing lib — use it, do not invent a new persistence layer.
- All LLM calls (if any during implementation) must go through `server/lib/aiProviderConfig.js` patterns when touching production code paths.
- The "run" harness must be executable locally without production secrets (use mocks or the local JSON followup store).
- DO NOT mutate DGI fiscal data, master price sheets, parámetros tabs, or automation logs.

# Anti-patterns
- DO NOT invent a new followup persistence mechanism — reuse `followUpStore.js` and the existing CLI/API contract.
- DO NOT hardcode operator IDs, tokens, or Sheet IDs.
- DO NOT treat the orchestrator as a production backend yet (it is a skill + prompt system for now).
- DO NOT skip the promptfoo regression cases for the new seg specialist (the recent promptfoo work exists for exactly this reason).
- DO NOT confuse the WA `wa_followups` table with the general `.followup` store unless the channel explicitly requires it.

# Deliverables
- Updated `~/.grok/skills/presupuestacion-orchestrator/SKILL.md` with a concrete prompt module for the Post-Mortem & Learning / "seg" sub-agent (following the exact style and format of the existing four modules).
- Small implementation or clear wiring in the conductor scaffolding example (the pseudocode `schedulePostMortem` function) that actually creates a followup item.
- Minimal runnable harness (recommended: a small Node script in `scripts/` or a documented Claude Code invocation pattern + example command) that can execute a full presup flow and reach the seg step, producing a real scheduled followup visible via `npm run followup due`.
- 2–3 new test cases added to `evals/promptfoo/presup-orchestrator.yaml` exercising the seg specialist (with llm-rubric asserts for correct followup creation behavior).
- Updated docs: brief addition to the orchestrator skill "Integration Points" and the Phase A scorecard (if it exists at `docs/team/COTIZAR-PRESUP-PHASE-A-SCORECARD.md`).
- `goal-prompt-presup-orchestrator-seg-and-run.md` (this file) left as the handoff artifact.

# Success Criteria
- The new seg specialist prompt, when invoked with a realistic post-presup outcome object, produces a well-formed call (or direct use) of the followup store that results in a visible item via `node scripts/followup.mjs due` or the API.
- A single "run" command (Claude Code pattern or script) can be executed that goes through Intake → ... → Delivery → seg and ends with at least one scheduled followup created.
- `npm test` and `npm run lint` (on changed files) still pass after the changes.
- The promptfoo eval for the orchestrator now includes the seg cases and can be re-run without new provider errors.
- All changes are documented with epistemic tags in the updated orchestrator skill file.
- No new persistence layer or breaking changes to the existing followup contract.

# Operational Anchors
- Source hierarchy: planilla validada (operativa) > repos vigentes (lógica) > docs de fórmulas (documental) > dashboards viejos (auxiliar). The orchestrator skill and followup infrastructure in the repo are the authoritative sources for this task.
- State labeling: every claim you produce must be marked `hecho confirmado`, `inferencia`, or `duda abierta`.
- Triangulation: always cross-check the orchestrator skill spec, the actual followup code in `server/lib/followUpStore.js` + `scripts/followup.mjs`, and recent PROJECT-STATE entries before declaring something done.
- Read-only by default on anything outside the orchestrator skill, its prompts, the followup store usage, and the run harness script/docs.

# Open Items
- [ASSUMPTION: The user intends "seg" to mean the Post-Mortem & Learning / seguimiento specialist in the presupuestacion-orchestrator and "run" to mean a minimal executable flow that exercises it. If this is incorrect (e.g. a different "seg" module or pure WA follow-up work), the prompt will need adjustment.]
- [ASSUMPTION: The existing `followUpStore` + CLI is the intended target for scheduled post-presup follow-ups from the orchestrator. If WA-specific `wa_followups` should be the primary target for certain channels, that decision must be made before wiring.]
- [ASSUMPTION: The run harness can be a documented Claude Code pattern + small helper script rather than a full production worker (consistent with current feature-freeze state of the orchestrator).]
- No other major blockers identified in the orchestrator spec or followup infrastructure.

# Blockers
None. The task is ready to execute once this prompt is piped to a `/goal` or `claude -p` session. The two assumptions above should be validated by the executor at the very beginning of the run by reading the referenced files.