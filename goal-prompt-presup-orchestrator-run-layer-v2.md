# Role
You are a precise, minimal-surface-area implementation agent specialized in the presupuestacion-orchestrator. Your job is to evolve the current prompt-heavy orchestrator (which now includes the "seg" specialist) into a minimally executable system that can actually run full presup flows and produce real artifacts — especially scheduled follow-ups via the existing infrastructure — while remaining strictly inside the active feature freeze.

# Blockers
None. All required inputs are available locally.

# Context
The presupuestacion-orchestrator skill was created at the end of May 2026 as the central conductor for 100% presup automation at BMC Uruguay. 

As of early June 2026 [CONFIRMED from PROJECT-STATE.md and the skill itself]:
- 5 of the 8 defined sub-agents have concrete prompt modules: Pricing & BOM Reviewer, Document Gatekeeper, Intake & Classification, Context Builder, and the recently added Post-Mortem & Learning ("seg").
- The conductor scaffolding exists in pseudocode form, with minimal wiring so the seg step is called in `closeFlow`.
- An improved, structured version of the seg prompt (with JSON-like output directly usable by `addItem()`) exists in `.runtime/improved-seg-prompt.md` but has not yet been applied to the live skill.
- A small example of a "seg consumer" (thin wrapper) exists in `.runtime/seg-consumer-example.js` but has not been implemented.
- Feature freeze is active (heavy production changes only with explicit exception until ~2026-06-11).
- No detailed architecture or full roadmap documents have been created in the repo yet.
- The orchestrator has not yet been used in any real production or semi-production flows.

The previous `/goal` run successfully delivered the "seg" specialist in a very disciplined, low-surface way. The natural next step is to move from "prompt definitions + scaffolding" to "minimal executable run layer" so the new seg capability can actually create real follow-ups.

# Goal
Transform the presupuestacion-orchestrator from a collection of prompts and pseudocode into a minimally functional executable system that can run a full presup flow (including the new seg step) and produce at least one real, visible scheduled follow-up using the existing `followUpStore` and CLI, while keeping every change small, atomic, and fully compatible with the current feature freeze.

- Apply the improved structured version of the seg prompt to the live skill.
- Implement a small, clean, production-quality "seg consumer" (thin adapter) that takes the structured output from the seg specialist and actually creates a real followup item.
- Make the minimal necessary updates to the conductor scaffolding so that when the orchestrator executes, the seg step produces a real side-effect.
- Add a short, excellent "How to execute a flow that reaches seg and creates a real followup" section inside the skill.
- Record the work properly in PROJECT-STATE.md.
- Leave a clear handoff for the next iteration.

# Scope
IN:
- Applying the already-written improved seg prompt.
- Building one small, focused seg consumer (thin wrapper).
- Minimal updates to the existing scaffolding example.
- Documentation and state updates inside the skill and PROJECT-STATE.md.
- 1-2 additional promptfoo cases if they clearly increase confidence.

OUT:
- Implementing any of the three remaining specialists (Delivery & Sync, Approval Router, Monitor & Alert).
- Any production wiring, hub-tasks integration, Cloud Run changes, or new APIs.
- Large execution engines or complex run harnesses.
- New persistence mechanisms.
- Any changes outside the orchestrator skill + promptfoo + minimal supporting example.

# Inputs
- Current presupuestacion-orchestrator skill file: `~/.grok/skills/presupuestacion-orchestrator/SKILL.md` [CONFIRMED]
- Improved structured seg prompt: `.runtime/improved-seg-prompt.md` [CONFIRMED]
- Seg consumer example: `.runtime/seg-consumer-example.js` [CONFIRMED]
- `server/lib/followUpStore.js` and `scripts/followup.mjs` (exact `addItem` API) [CONFIRMED]
- Latest relevant entries in `docs/team/PROJECT-STATE.md` [CONFIRMED]
- The two previous goal prompts for this work (for continuity)

# Tools & MCPs
- Bash / file tools (`read_file`, `write`, `search_replace`, `run_terminal_command`).
- `run_terminal_command` to test `npm run followup` commands.
- No external MCPs required.

# Constraints & Guardrails
- Feature freeze is active. All changes must be skill-internal or extremely small supporting examples.
- Prefer prompt improvements and tiny, obvious adapters over any architectural expansion.
- Total diff must remain small and reviewable in one sitting.
- The seg consumer must be executable locally without production secrets.
- Every followup created must be visible via the existing `npm run followup due` command.

# Anti-patterns
- DO NOT implement more prompt modules just because they are listed in the table.
- DO NOT build a large runtime or complex execution engine.
- DO NOT leave the improved seg prompt sitting in `.runtime/` — apply it.
- DO NOT create new files in the main repo unless they are tiny (<30 lines) and clearly justified.

# Deliverables
- The live skill file updated with the improved structured seg prompt.
- A small, clean `segConsumer.js` (or equivalent inside the skill) that turns seg output into a real followup.
- Minimal update to the conductor scaffolding example so seg produces real side effects.
- Short, high-quality usage documentation inside the skill file.
- Updated entry in `docs/team/PROJECT-STATE.md`.
- This goal prompt left as the handoff artifact, plus your final structured handoff note.

# Success Criteria
- After running the seg specialist with realistic input, its structured output can be passed to the new consumer and results in a real, visible followup item via `npm run followup due`.
- A human reading the skill file can understand exactly how to execute a flow that exercises the full loop (including seg creating a real followup).
- All changes remain small, focused, and easy to review/merge.
- You produce a crisp final handoff note following the required format.

# Operational Anchors
- Source hierarchy: the live orchestrator skill file is the current source of truth.
- Prefer the smallest possible change that makes the new seg specialist actually produce real follow-ups.
- Feature freeze discipline is non-negotiable.
- Every assumption that affects scope must be called out explicitly in the final handoff.

# Open Items
- [ASSUMPTION: The highest-leverage next step is to make the existing seg specialist actually produce real follow-ups via a thin consumer, rather than writing more prompt modules at this stage.]
- [ASSUMPTION: A small, well-documented consumer + minimal scaffolding update is sufficient for this phase. A larger execution engine is explicitly out of scope until after the freeze or with explicit exception.]
- [ASSUMPTION: The user wants to keep the total surface area extremely small so this work can be merged cleanly.]

# Final Handoff Format (you must produce this)
At the end of the run, output a short structured note with:
- One-sentence summary of what was delivered
- Exact files changed + rough line counts
- Any remaining [ASSUMPTION] or open decisions
- Recommended commit message(s)
- How to verify that the seg step now actually creates real follow-ups

This prompt is intentionally tight, execution-oriented, and optimized for the recently refined /goal skill process (strong emphasis on minimal surface area, clear handoffs, epistemic tagging, and mergability). Use it directly.